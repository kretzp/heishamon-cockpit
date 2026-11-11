"""Smoke-test a built image: python tools/test_container.py <image>.

Uses only a network-isolated simulator and a disposable, uniquely named volume.
No installation prompts, accounts, certificates or broker credentials are needed.
"""
from contextlib import closing
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import tempfile
import time
import uuid


def docker(*args: str) -> str:
    return subprocess.run(
        ["docker", *args], check=True, capture_output=True, text=True,
        encoding="utf-8", timeout=30
    ).stdout.strip()


def request(container: str, path: str) -> tuple[int, str]:
    # HTTP/1.0 avoids chunked encoding. Probe loopback inside the container;
    # no host ports or external networking are needed, nor curl in the image.
    response = docker(
        "exec", container, "/bin/bash", "-c",
        'exec 3<>/dev/tcp/127.0.0.1/5080; '
        'printf "GET %s HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n" "$1" >&3; '
        'cat <&3', "probe", path,
    )
    headers, body = response.split("\n\n", 1)
    return int(headers.splitlines()[0].split()[1]), body


def wait_ready(container: str) -> None:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            status, body = request(container, "/health/ready")
            if status == 200 and json.loads(body)["status"] == "ready":
                return
        except subprocess.CalledProcessError:
            if docker("inspect", "--format", "{{.State.Running}}", container) != "true":
                raise RuntimeError("Simulator container exited during startup.")
        time.sleep(1)
    raise RuntimeError("Simulator storage was not ready within 60 seconds.")


def check(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def verify(container: str) -> None:
    wait_ready(container)
    status, body = request(container, "/health/live")
    check(status == 200 and json.loads(body)["status"] == "alive", "Liveness failed.")
    status, body = request(container, "/")
    check(status == 200 and 'id="root"' in body, "Built React frontend is missing.")
    asset = re.search(r'src="(/assets/[^" ]+\.js)"', body)
    check(asset is not None, "Frontend script reference is missing.")
    status, body = request(container, asset[1])
    check(status == 200 and len(body) > 100, "Built JavaScript asset is missing.")
    status, body = request(container, "/api/v1/system")
    check(status == 200, "System endpoint failed.")
    system = json.loads(body)
    check(system["source"] == "simulator", "Unexpected telemetry source.")
    check(system["readOnly"] and not system["liveControlArmed"], "Control is enabled.")
    check(not any("command" in value.lower() for value in system["capabilities"]),
          "Command capabilities are exposed.")
    check(docker("exec", container, "id", "-u") != "0", "Container runs as root.")
    docker("exec", container, "/bin/sh", "-c",
           "test -s /data/data/simulator.db && test -s /data/appsettings.json")


def recorded_history(container: str) -> tuple[tuple, int]:
    # Copy only after a clean stop, so SQLite has checkpointed its WAL.
    with tempfile.TemporaryDirectory(prefix="cockpit-ci-") as directory:
        database = Path(directory) / "history.db"
        docker("cp", f"{container}:/data/data/simulator.db", str(database))
        with closing(sqlite3.connect(database)) as connection:
            sample = connection.execute(
                "SELECT Key, Time, Value, Text FROM Samples ORDER BY Time, Key LIMIT 1"
            ).fetchone()
            starts = connection.execute(
                "SELECT COUNT(*) FROM Events WHERE Kind = 'system' AND Key = 'recorder'"
            ).fetchone()[0]
        check(sample is not None, "Simulator did not record any history samples.")
        return sample, starts


def main(image: str) -> None:
    name = "cockpit-ci-" + uuid.uuid4().hex
    volume = name + "-data"
    docker("volume", "create", volume)
    original_sample = None
    original_starts = 0
    try:
        for iteration in range(2):
            docker(
                "run", "--detach", "--name", name, "--network", "none",
                "--mount", f"type=volume,src={volume},dst=/data",
                "--env", "Source=simulator", "--env", "Access__RequireLogin=false",
                "--env", "Control__Enabled=false", "--env", "LiveControl__Enabled=false",
                "--env", "LiveTest__Enabled=false", "--env", "HeatingCurve__Enabled=false",
                image,
            )
            verify(name)
            docker("stop", "--time", "10", name)
            sample, starts = recorded_history(name)
            if iteration == 0:
                original_sample = sample
                original_starts = starts
            else:
                check(sample == original_sample,
                      "Recorded history did not survive container recreation.")
                check(original_starts > 0 and starts > original_starts,
                      "Recorder startup events did not accumulate across recreation.")
            docker("rm", name)
        print("PASS: Linux simulator, frontend, read-only mode, non-root user and persistence.")
    except Exception:
        subprocess.run(["docker", "logs", name], check=False, timeout=30)
        raise
    finally:
        subprocess.run(["docker", "rm", "--force", name], check=False,
                       capture_output=True, timeout=30)
        docker("volume", "rm", volume)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python tools/test_container.py <image>")
    main(sys.argv[1])
