"""Isolated MCP security/contract tests; no production network or MQTT."""
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading
from unittest.mock import patch
import uuid

from cockpit_mcp import Api, NoRedirect, SafeError, Server, tools


class FakeApi:
    def __init__(self):
        self.calls = []
        self.fail = False
        self.identifier = str(uuid.uuid4())
        self.role = "admin"

    def connect(self, write=False):
        self.calls.append(("connect", write))

    def request(self, path, data=None):
        self.calls.append((path, data))
        if self.fail:
            raise SafeError("simulated failure")
        if path == "/api/v1/settings" and data is None:
            return {"values": {"plantName": "SIMULIERT", "retentionDays": 700, "revision": 2}}
        return {"id": self.identifier, "state": "validated", "source": "simulator"}


class McpTests(unittest.TestCase):
    def setUp(self):
        self.api = FakeApi()
        self.server = Server(self.api, True)

    def prepare(self):
        return self.server.call("prepare_command", {
            "commandType": "setDhwTemperature", "desiredValue": 51,
            "expectedStateRevision": "SIMULATED", "idempotencyKey": str(uuid.uuid4())})

    def test_default_has_no_write_tools_and_rejects_hidden_writes(self):
        server = Server(self.api)
        self.assertTrue(all(t["annotations"]["readOnlyHint"] for t in tools(False)))
        with self.assertRaises(SafeError):
            server.call("confirm_command", {})
        self.assertEqual([], self.api.calls)

    def test_readonly_http_guard_and_explicit_credentials(self):
        api = Api("http://127.0.0.1:5080", credentials={"username": "SIMULATED", "password": "SIMULATED-PASSWORD"}, read_only=True)
        for path in ("/api/v1/settings", "/api/v1/commands", "/api/v1/commands/id/confirm", "/api/v1/auth/logout"):
            with self.assertRaises(SafeError):
                api.request(path, {})
        with patch.object(api, "request", side_effect=[{"csrfToken": "before"}, None, {"csrfToken": "after", "authenticated": True, "role": "reader"}]) as request:
            api.connect()
            self.assertEqual({"username": "SIMULATED", "password": "SIMULATED-PASSWORD"}, request.call_args_list[1].args[1])

    def test_confirmation_is_bound_to_current_session_and_explicit_true(self):
        identifier = self.prepare()["id"]
        args = {"area": "scalar", "id": identifier, "confirmed": False}
        with self.assertRaises(SafeError):
            self.server.call("confirm_command", args)
        with self.assertRaises(SafeError):
            Server(self.api, True).call("confirm_command", {**args, "confirmed": True})
        self.server.call("confirm_command", {**args, "confirmed": True})
        with self.assertRaises(SafeError):
            self.server.call("confirm_command", {**args, "confirmed": True})
        self.assertEqual(1, sum(path.endswith("/confirm") for path, _ in self.api.calls))

    def test_uncertain_send_cannot_replay(self):
        identifier = self.prepare()["id"]
        self.api.fail = True
        args = {"area": "scalar", "id": identifier, "confirmed": True}
        for _ in range(2):
            with self.assertRaises(SafeError):
                self.server.call("confirm_command", args)
        self.assertEqual(1, sum(path.endswith("/confirm") for path, _ in self.api.calls))

    def test_expired_draft_not_sent(self):
        with patch("cockpit_mcp.time.monotonic", return_value=0):
            identifier = self.prepare()["id"]
        with patch("cockpit_mcp.time.monotonic", return_value=61):
            with self.assertRaises(SafeError):
                self.server.call("confirm_command", {"area": "scalar", "id": identifier, "confirmed": True})

    def test_unknown_fields_nan_bool_number_and_path_injection_rejected(self):
        for name, args in [
            ("get_system", {"url": "https://evil.invalid"}),
            ("get_command", {"area": "scalar", "id": "../../auth/session"}),
            ("prepare_command", {"commandType": "setDhwTemperature", "desiredValue": float("nan"), "expectedStateRevision": "r", "idempotencyKey": str(uuid.uuid4())}),
            ("get_energy", {"year": True}),
            ("confirm_command", {"area": "scalar", "id": str(uuid.uuid4()), "confirmed": "true"})]:
            result = self.server.dispatch({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": args}})
            self.assertTrue(result["result"]["isError"])
        self.assertFalse(any(path.startswith("/api/") for path, _ in self.api.calls))

    def test_settings_two_phase_exact_payload_and_revision(self):
        desired = {"plantName": "SIMULIERT neu", "retentionDays": 700, "revision": 2, "confirmReduction": False}
        result = self.server.call("prepare_settings", desired)
        self.assertFalse(any(data is not None for path, data in self.api.calls if path.startswith("/api/")))
        self.server.call("confirm_settings", {"id": result["id"], "confirmed": True})
        self.assertEqual(("/api/v1/settings", desired), self.api.calls[-1])
        with self.assertRaises(SafeError):
            self.server.call("prepare_settings", {**desired, "revision": 1})

    def test_settings_require_admin_even_for_a_writer(self):
        self.api.role = "writer"
        desired = {"plantName": "SIMULATED", "retentionDays": 700, "revision": 2, "confirmReduction": False}
        with self.assertRaises(SafeError):
            self.server.call("prepare_settings", desired)
        self.assertFalse(any(path.startswith("/api/") for path, _ in self.api.calls))

    def test_curve_routes_and_cancel(self):
        self.server.call("prepare_curve", {"desired": {"xCold": -10, "yCold": 40, "xWarm": 15, "yWarm": 25, "heatDelta": 5, "heatingOffTemperature": 20}, "expectedStateRevision": "r", "idempotencyKey": str(uuid.uuid4())})
        self.assertEqual("/api/v1/heating-curve/commands", self.api.calls[-1][0])
        self.server.call("cancel_command", {"area": "curve", "id": self.api.identifier})
        self.assertTrue(self.api.calls[-1][0].endswith("/cancel"))

    def test_query_encoded_no_extra_endpoint(self):
        self.server.call("get_events", {"kind": "x&url=https://evil.invalid"})
        self.assertEqual("/api/v1/events?kind=x%26url%3Dhttps%3A%2F%2Fevil.invalid", self.api.calls[-1][0])

    def test_url_and_redirect_guards(self):
        for url in ["http://example.invalid:5080", "http://localhost:5080", "https://user:secret@example.org", "https://example.org/api", "file:///etc/passwd", "https://example.org?x=1"]:
            with self.assertRaises(SafeError):
                Api(url)
        Api("http://127.0.0.1:5080")
        with self.assertRaises(SafeError):
            NoRedirect().redirect_request(None, None, 302, "", {}, "https://evil.invalid")

    def test_login_csrf_refresh_operator_and_no_cookie_exposure(self):
        api = Api("http://127.0.0.1:5080")
        with patch.dict("os.environ", {"COCKPIT_MCP_USERNAME": "SIMULIERT", "COCKPIT_MCP_PASSWORD": "NOT-A-REAL-PASSWORD"}):
            with patch.object(api, "request", side_effect=[{"csrfToken": "before"}, None, {"csrfToken": "after", "authenticated": True, "role": "writer"}]) as req:
                api.connect(True)
                self.assertEqual("/api/v1/auth/login", req.call_args_list[1].args[0])
                self.assertEqual("after", api.csrf)
        with patch.object(api, "request", return_value={"authenticated": True, "role": "reader", "csrfToken": "x"}):
            with self.assertRaises(SafeError):
                api.connect(True)

    def test_all_three_roles_and_missing_login(self):
        api = Api("http://127.0.0.1:5080")
        with patch.dict("os.environ", {}, clear=True):
            with patch.object(api, "request", return_value={"authenticated": False}):
                with self.assertRaises(SafeError):
                    api.connect()
            for role in ("reader", "writer", "admin"):
                with self.subTest(role=role), patch.object(api, "request", return_value={"authenticated": True, "role": role, "csrfToken": "x"}):
                    api.connect()
                    if role == "reader":
                        with self.assertRaises(SafeError):
                            api.connect(True)
                    else:
                        api.connect(True)

    def test_rpc_notifications_bad_params_and_redacted_error(self):
        self.assertIsNone(self.server.dispatch({"jsonrpc": "2.0", "method": "notifications/initialized"}))
        self.assertEqual(-32602, self.server.dispatch({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": []})["error"]["code"])
        with patch.object(self.api, "connect", side_effect=RuntimeError("SECRET")):
            response = self.server.dispatch({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_system"}})
            self.assertNotIn("SECRET", json.dumps(response))

    def test_subprocess_stdio_utf8_initialize_list_and_parse_error(self):
        messages = ["bad json", json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "isolated-test", "version": "1"}}}), json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}), json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})]
        run = subprocess.run([sys.executable, str(Path(__file__).with_name("cockpit_mcp.py"))], input=("\n".join(messages) + "\n").encode(), capture_output=True, timeout=10)
        self.assertEqual(0, run.returncode, run.stderr)
        replies = [json.loads(line) for line in run.stdout.decode("utf-8").splitlines()]
        self.assertEqual(3, len(replies))
        self.assertEqual(-32700, replies[0]["error"]["code"])
        self.assertEqual("2025-06-18", replies[1]["result"]["protocolVersion"])
        self.assertIn("get_snapshot", [t["name"] for t in replies[2]["result"]["tools"]])


class HttpTests(unittest.TestCase):
    def test_real_http_cookie_login_csrf_and_two_phase_command(self):
        identifier = str(uuid.uuid4())
        requests = []

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def reply(self, status, value, cookie=None):
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                if cookie:
                    self.send_header("Set-Cookie", cookie)
                self.end_headers()
                self.wfile.write(json.dumps(value).encode())

            def do_GET(self):
                requests.append(("GET", self.path))
                if self.path == "/api/v1/auth/session":
                    authenticated = "session=SIMULATED" in self.headers.get("Cookie", "")
                    self.reply(200, {"loginRequired": True, "authenticated": authenticated, "role": "writer" if authenticated else None, "csrfToken": "AFTER" if authenticated else "BEFORE"}, "csrf=SIMULATED; HttpOnly; Path=/")
                elif self.path == "/api/v1/snapshot":
                    self.reply(200, {"source": "simulator", "values": [{"key": "outdoor", "value": None, "quality": "unknown"}]})
                else:
                    self.reply(404, {})

            def do_POST(self):
                data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                requests.append(("POST", self.path))
                if self.path == "/api/v1/auth/login":
                    if self.headers.get("X-CSRF-TOKEN") != "BEFORE" or "csrf=SIMULATED" not in self.headers.get("Cookie", ""):
                        self.reply(400, {"secret": "MUST-NOT-LEAK"})
                    else:
                        self.reply(200, None, "session=SIMULATED; HttpOnly; Path=/")
                elif self.headers.get("X-CSRF-TOKEN") != "AFTER" or "session=SIMULATED" not in self.headers.get("Cookie", ""):
                    self.reply(403, {"secret": "MUST-NOT-LEAK"})
                elif self.path == "/api/v1/commands":
                    self.reply(200, {"id": identifier, "state": "validated", "desiredValue": data["desiredValue"], "source": "simulator"})
                elif self.path.endswith("/confirm"):
                    self.reply(202, {"id": identifier, "state": "sent", "source": "simulator"})
                else:
                    self.reply(422, {"secret": "MUST-NOT-LEAK"})

        http = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=http.serve_forever, daemon=True)
        worker.start()
        try:
            api = Api(f"http://127.0.0.1:{http.server_port}")
            server = Server(api, True)
            with patch.dict("os.environ", {"COCKPIT_MCP_USERNAME": "SIMULATED", "COCKPIT_MCP_PASSWORD": "SIMULATED-PASSWORD"}):
                snapshot = server.call("get_snapshot", {})
                self.assertIsNone(snapshot["values"][0]["value"])
                draft = server.call("prepare_command", {"commandType": "setDhwTemperature", "desiredValue": 51, "expectedStateRevision": "SIMULATED", "idempotencyKey": str(uuid.uuid4())})
                self.assertFalse(any(path.endswith("/confirm") for _, path in requests))
                result = server.call("confirm_command", {"area": "scalar", "id": draft["id"], "confirmed": True})
                self.assertEqual("sent", result["state"])
                self.assertEqual(1, requests.count(("POST", "/api/v1/auth/login")))
                with self.assertRaises(SafeError) as error:
                    api.request("/invalid", {})
                self.assertNotIn("MUST-NOT-LEAK", str(error.exception))
        finally:
            http.shutdown()
            http.server_close()
            worker.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
