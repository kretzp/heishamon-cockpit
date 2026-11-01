"""Codex entry point: own isolated simulator and MCP, ephemeral credentials/data."""
import hashlib
import os
from pathlib import Path
import secrets
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time

import cockpit_mcp


def main():
    root = Path(__file__).resolve().parent.parent
    assembly = root / "src/Cockpit.Web/bin/Debug/net10.0/Cockpit.Web.dll"
    dotnet = shutil.which("dotnet")
    if not dotnet or not assembly.is_file():
        print("Simulator benötigt dotnet und Debug-Build von Cockpit.Web.", file=sys.stderr)
        return 1
    with socket.socket() as reserve:
        reserve.bind(("127.0.0.1", 0))
        port = reserve.getsockname()[1]
    password = secrets.token_urlsafe(32)
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600000, 32)
    # Never load appsettings.Local.json or inherited production configuration.
    environment = {key: value for key, value in os.environ.items()
                   if "__" not in key and key not in ("Source", "LocalPort", "COCKPIT_MCP_PASSWORD", "COCKPIT_MCP_USERNAME")}
    with tempfile.TemporaryDirectory(prefix="cockpit-mcp-simulator-") as directory:
        # This isolated test fixture is discarded with its temporary directory.
        users_path = str(Path(directory) / "users.db")
        with sqlite3.connect(users_path) as database:
            database.execute("CREATE TABLE Users (Username TEXT PRIMARY KEY COLLATE BINARY, Role TEXT NOT NULL, Disabled INTEGER NOT NULL, Salt BLOB NOT NULL, PasswordHash BLOB NOT NULL, Iterations INTEGER NOT NULL, Version INTEGER NOT NULL)")
            database.execute("INSERT INTO Users VALUES (?, ?, 0, ?, ?, 600000, 1)", ("mcp-simulator", "admin", salt, derived))
        if os.name != "nt":
            os.chmod(users_path, 0o600)
        environment.update({
            "Source": "simulator", "Simulator__Scenario": "normal", "LocalPort": str(port),
            "Control__Enabled": "false", "LiveTest__Enabled": "false", "HeatingCurve__Enabled": "false",
            "LiveControl__Enabled": "true", "LiveControl__Armed": "false",
            "Settings__Enabled": "true", "Access__RequireLogin": "true", "Access__RequireHttps": "false",
            "Control__Outcome": "match", "Access__DatabasePath": users_path,
            "History__Path": str(Path(directory) / "simulator.db"), "History__SampleSeconds": "5",
            "History__RetentionDays": "700",
            "Logging__LogLevel__Default": "Warning", "Logging__LogLevel__Microsoft.Hosting.Lifetime": "Warning"})
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        process = subprocess.Popen([dotnet, str(assembly), "--contentRoot", directory],
                                   cwd=directory, env=environment, stdin=subprocess.DEVNULL,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=creationflags)
        previous = {key: os.environ.get(key) for key in ("COCKPIT_MCP_USERNAME", "COCKPIT_MCP_PASSWORD", "COCKPIT_MCP_ALLOW_WRITES")}
        try:
            os.environ.update({"COCKPIT_MCP_USERNAME": "mcp-simulator", "COCKPIT_MCP_PASSWORD": password,
                               "COCKPIT_MCP_ALLOW_WRITES": "1"})
            url = f"http://127.0.0.1:{port}"
            api = cockpit_mcp.Api(url)
            deadline = time.monotonic() + 30
            while True:
                if process.poll() is not None:
                    raise cockpit_mcp.SafeError("Isolierter Simulator konnte nicht starten.")
                try:
                    api.connect(True)
                    system = api.request("/api/v1/system")
                    if system.get("source") != "simulator":
                        raise cockpit_mcp.SafeError("Simulator-Quellenprüfung fehlgeschlagen.")
                    break
                except cockpit_mcp.SafeError:
                    if time.monotonic() >= deadline:
                        raise cockpit_mcp.SafeError("Simulator-Startfrist abgelaufen.") from None
                    time.sleep(0.25)
            print("MCP: isolierter Simulator, Schreiben aktiv, keine echte Anlage.", file=sys.stderr)
            sys.argv = [str(root / "tools/cockpit_mcp.py"), "--url", url]
            return cockpit_mcp.main()
        except cockpit_mcp.SafeError as error:
            print(str(error), file=sys.stderr)
            return 1
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
