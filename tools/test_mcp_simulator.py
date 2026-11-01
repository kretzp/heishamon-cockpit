"""Explicit end-to-end acceptance through MCP stdio against actual .NET simulator."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time
import unittest
import uuid


class SimulatorAcceptance(unittest.TestCase):
    def test_read_and_write_through_stdio(self):
        launcher = Path(__file__).with_name("cockpit_mcp_simulator.py")
        process = subprocess.Popen([sys.executable, str(launcher)], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        replies = queue.Queue()

        def reader():
            for line in process.stdout:
                replies.put(json.loads(line))
            replies.put(None)

        thread = threading.Thread(target=reader, daemon=True)
        thread.start()
        counter = 0

        def rpc(method, params):
            nonlocal counter
            counter += 1
            process.stdin.write((json.dumps({"jsonrpc": "2.0", "id": counter, "method": method, "params": params}) + "\n").encode())
            process.stdin.flush()
            result = replies.get(timeout=45)
            self.assertIsNotNone(result, "MCP unexpectedly stopped")
            self.assertEqual(counter, result["id"])
            self.assertNotIn("error", result, result)
            return result["result"]

        def call(name, **arguments):
            response = rpc("tools/call", {"name": name, "arguments": arguments})
            self.assertFalse(response.get("isError"), response)
            return json.loads(response["content"][0]["text"])

        def wait_for(action, predicate, seconds=25):
            deadline = time.monotonic() + seconds
            while True:
                value = action()
                if predicate(value):
                    return value
                if time.monotonic() > deadline:
                    self.fail("Simulator acceptance timeout: " + json.dumps(value))
                time.sleep(1)

        try:
            initialized = rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "simulator-acceptance", "version": "1"}})
            self.assertEqual("2025-06-18", initialized["protocolVersion"])
            process.stdin.write(b'{"jsonrpc":"2.0","method":"notifications/initialized"}\n')
            process.stdin.flush()
            self.assertIn("confirm_command", [tool["name"] for tool in rpc("tools/list", {})["tools"]])
            system = call("get_system")
            self.assertEqual("simulator", system["source"])
            snapshot = call("get_snapshot")
            self.assertTrue(snapshot["values"])
            wait_for(lambda: call("get_storage"), lambda value: value["state"] == "ready")
            time.sleep(6)
            end = datetime.now(timezone.utc)
            history = call("get_history", keys="flowTemperature", **{"from": (end - timedelta(minutes=2)).isoformat(), "to": end.isoformat(), "bucketSeconds": 5})
            self.assertIsNotNone(history)
            print("PASS: MCP initialize/tools, simulator source, snapshot, storage, history", flush=True)

            context = call("get_command_context", commandType="setDhwTemperature")
            self.assertTrue(context["available"], context)
            target = 51 if context["currentValue"] != 51 else 52
            draft = call("prepare_command", commandType="setDhwTemperature", desiredValue=target,
                         expectedStateRevision=context["expectedStateRevision"], idempotencyKey=str(uuid.uuid4()))
            self.assertEqual("validated", draft["state"])
            call("confirm_command", area="scalar", id=draft["id"], confirmed=True)
            record = wait_for(lambda: call("get_command", area="scalar", id=draft["id"]), lambda value: value["state"] == "observedMatchingState")
            self.assertEqual(target, record["observedValue"])
            print(f"PASS: simulated DHW {context['currentValue']} -> {target}, audit and observedMatchingState", flush=True)

            context = call("get_curve_context")
            self.assertTrue(context["available"], context)
            desired = dict(context["current"])
            desired["heatDelta"] = 6 if desired["heatDelta"] != 6 else 5
            curve = call("prepare_curve", desired=desired, expectedStateRevision=context["expectedStateRevision"], idempotencyKey=str(uuid.uuid4()))
            call("confirm_command", area="curve", id=curve["id"], confirmed=True)
            record = wait_for(lambda: call("get_command", area="curve", id=curve["id"]), lambda value: value["state"] == "observedMatchingState", seconds=30)
            self.assertEqual(desired, record["desired"])
            print("PASS: simulated heating curve heatDelta, audit and observedMatchingState", flush=True)

            settings = call("get_settings")
            draft = call("prepare_settings", plantName="SIMULIERT MCP-Abnahme", retentionDays=700,
                         revision=settings["values"]["revision"], confirmReduction=False)
            call("confirm_settings", id=draft["id"], confirmed=True)
            self.assertEqual("SIMULIERT MCP-Abnahme", call("get_settings")["values"]["plantName"])
            self.assertTrue(call("list_commands", area="scalar"))
            self.assertTrue(call("list_commands", area="curve"))
            print("PASS: simulated settings write/read and both command journals", flush=True)
        finally:
            process.stdin.close()
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
            self.assertEqual(0, process.returncode, process.stderr.read().decode("utf-8", errors="replace"))
            process.stdout.close()
            process.stderr.close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
