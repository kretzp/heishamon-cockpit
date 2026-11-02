"""Transactional updates of a standard Cockpit installation; stdlib only."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import socket
import ssl
import subprocess
import tempfile
import time
import urllib.request
import xml.etree.ElementTree as ET


class UpdateError(RuntimeError):
    pass


def command(args: list[str]) -> str:
    result = subprocess.run(args, capture_output=True, text=True, check=False)
    if result.returncode:
        raise UpdateError(f"Command failed: {args[0]} (exit {result.returncode}).")
    return result.stdout.strip()


def powershell(script: str, target: Path) -> str:
    # PowerShell 7 module paths cannot be reused by the Windows PowerShell 5 host.
    env = {key: value for key, value in os.environ.items() if key.lower() != "psmodulepath"}
    env["COCKPIT_UPDATE_TARGET"] = str(target)
    exe = str(Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe")
    result = subprocess.run([exe, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command",
                             "$ErrorActionPreference='Stop'; Import-Module Microsoft.PowerShell.Security,Microsoft.PowerShell.Management,CimCmdlets; " + script],
                            env=env, capture_output=True, text=True, check=False)
    if result.returncode:
        raise UpdateError("Windows service/file operation failed; check permissions and service status.")
    return result.stdout.strip()


class Service:
    """Control only the existing service belonging to the selected installation."""
    def __init__(self, target: Path) -> None:
        self.target = target
        self.exists = False
        self.running = False
        if os.name == "nt":
            text = powershell("$s=Get-CimInstance Win32_Service -Filter \"Name='HeishaMonCockpit'\"; "
                              "if($s){$s | Select-Object State,PathName | ConvertTo-Json -Compress}", target)
            if text:
                info = json.loads(text)
                wrapper = target / "HeishaMonCockpitService.exe"
                if info["PathName"].strip().strip('"').casefold() != str(wrapper).casefold():
                    raise UpdateError("Existing Windows service belongs to a different installation.")
                xml = ET.parse(target / "HeishaMonCockpitService.xml").getroot()
                if xml.findtext("executable") != r"%BASE%\Cockpit.Web.exe" or xml.findtext("workingdirectory") != "%BASE%" or xml.findall("env") or xml.findtext("arguments") or xml.findtext("startarguments"):
                    raise UpdateError("Custom WinSW paths/environment require a manual update.")
                if info["State"] not in ("Running", "Stopped"):
                    raise UpdateError("Wait until the existing service is fully running or stopped.")
                self.exists, self.running = True, info["State"] == "Running"
        elif shutil.which("systemctl"):
            try:
                state = command(["systemctl", "show", "--property=LoadState", "--value", "heishamon-cockpit.service"])
            except UpdateError:
                if any((Path(base) / "heishamon-cockpit.service").exists() for base in
                       ("/etc/systemd/system", "/run/systemd/system", "/usr/lib/systemd/system", "/lib/systemd/system")):
                    raise
                return  # Manual installation on a host without a running systemd manager.
            if state != "not-found":
                if state != "loaded":
                    raise UpdateError("Repair the existing systemd service before updating.")
                directory = command(["systemctl", "show", "--property=WorkingDirectory", "--value", "heishamon-cockpit.service"])
                if Path(directory).resolve() != target:
                    raise UpdateError("Existing systemd service belongs to a different installation.")
                import pwd
                owner = command(["systemctl", "show", "--property=User", "--value", "heishamon-cockpit.service"])
                if owner not in (str(os.geteuid()), pwd.getpwuid(os.geteuid()).pw_name):
                    raise UpdateError("Service identity does not match the installing user.")
                for field in ("DropInPaths", "Environment", "EnvironmentFiles", "PassEnvironment", "RootDirectory", "RootImage", "ExecStartPre", "ExecStartPost"):
                    if command(["systemctl", "show", f"--property={field}", "--value", "heishamon-cockpit.service"]):
                        raise UpdateError("Custom service environment/overrides require a manual update.")
                executable = re.escape(str(target / "Cockpit.Web"))
                execution = command(["systemctl", "show", "--property=ExecStart", "--value", "heishamon-cockpit.service"])
                if not re.match(r"^\{ path=" + executable + r" ; argv\[\]=" + executable + r" ; ignore_errors=no ;", execution) or execution.count("{ path=") != 1:
                    raise UpdateError("Custom service command/arguments require a manual update.")
                active = command(["systemctl", "show", "--property=ActiveState", "--value", "heishamon-cockpit.service"])
                if active not in ("active", "inactive", "failed"):
                    raise UpdateError("Wait until the existing service is fully running or stopped.")
                self.exists, self.running = True, active == "active"

    def stop(self) -> None:
        if os.name == "nt":
            powershell("Stop-Service HeishaMonCockpit; "
                       "(Get-Service HeishaMonCockpit).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))", self.target)
        else:
            command(["sudo", "systemctl", "stop", "heishamon-cockpit.service"])

    def start(self) -> None:
        if os.name == "nt":
            powershell("Start-Service HeishaMonCockpit; "
                       "(Get-Service HeishaMonCockpit).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))", self.target)
        else:
            command(["sudo", "systemctl", "start", "heishamon-cockpit.service"])

    def active(self) -> bool:
        if os.name == "nt":
            return powershell("(Get-Service HeishaMonCockpit).Status.ToString()", self.target) == "Running"
        return command(["systemctl", "show", "--property=ActiveState", "--value", "heishamon-cockpit.service"]) == "active"


def no_links(root: Path) -> None:
    for path in [root, *root.rglob("*")]:
        # Reparse points include Windows junctions, not just symbolic links.
        if path.is_symlink() or (getattr(path.lstat(), "st_file_attributes", 0) & 0x400):
            raise UpdateError("Linked files/junctions require a manual update: " + str(path))


def configuration(target: Path, base: Path | None = None) -> tuple[int, bool, tuple[Path, ...]]:
    # Environment-specific JSON is loaded by .NET before appsettings.Local.json.
    # Only the standard installer layout is covered by this backup contract.
    for directory in {target, (base or target / "appsettings.json").parent}:
        if any(path.name.casefold() not in ("appsettings.local.json", "appsettings.local.example.json")
               for path in directory.glob("appsettings.*.json")):
            raise UpdateError("Environment-specific configuration requires a manual update.")
    def merge(left: dict, right: dict) -> dict:
        if any(":" in key for key in (*left, *right)):
            raise UpdateError("Flattened configuration keys require a manual update.")
        result = {key.casefold(): value for key, value in left.items()}
        for key, value in right.items():
            key = key.casefold()
            result[key] = merge(result.get(key, {}), value) if isinstance(value, dict) else value
        return result
    config: dict = {}
    for path in (base or target / "appsettings.json", target / "appsettings.Local.json"):
        if path.exists():
            config = merge(config, json.loads(path.read_text(encoding="utf-8-sig")))
    source = config.get("source", "simulator")
    history = config.get("history", {}).get("path") or f"data/{source}.db"
    users = config.get("access", {}).get("databasepath") or str(Path(history).parent / "users.db")
    secrets = config.get("mqtt", {}).get("secretdirectory") or str(Path(users).parent / "mqtt-secrets")
    paths = tuple((Path(value) if Path(value).is_absolute() else target / value).resolve() for value in (history, users, secrets))
    if any(not path.is_relative_to(target) for path in paths):
        raise UpdateError("External data paths require a separately coordinated backup/update.")
    if any(not path.is_relative_to(target / "data") for path in paths):
        raise UpdateError("Data/key paths outside the installation's data directory require a manual update.")
    port = config.get("localport", 5080)
    if isinstance(port, bool) or not isinstance(port, int) or not 1024 <= port <= 65535:
        raise UpdateError("Invalid installation LocalPort.")
    return port, config.get("access", {}).get("localhttps", False), paths


def copy_acl(source: Path, destination: Path) -> None:
    import ctypes
    from ctypes import wintypes
    # Copy only the DACL with the native API; no ownership or audit privilege is needed.
    api = ctypes.WinDLL("advapi32", use_last_error=True)
    pointer = ctypes.c_void_p
    api.GetNamedSecurityInfoW.argtypes = [wintypes.LPWSTR, ctypes.c_int, wintypes.DWORD,
                                        pointer, pointer, pointer, pointer, pointer]
    api.SetNamedSecurityInfoW.argtypes = [wintypes.LPWSTR, ctypes.c_int, wintypes.DWORD,
                                        pointer, pointer, pointer, pointer]
    api.GetSecurityDescriptorControl.argtypes = [pointer, pointer, pointer]
    descriptor, dacl = pointer(), pointer()
    code = api.GetNamedSecurityInfoW(str(source), 1, 4, None, None, ctypes.byref(dacl), None, ctypes.byref(descriptor))
    if code:
        raise UpdateError(f"Could not read Windows permissions (error {code}).")
    try:
        control, revision = wintypes.WORD(), wintypes.DWORD()
        if not api.GetSecurityDescriptorControl(descriptor, ctypes.byref(control), ctypes.byref(revision)):
            raise UpdateError("Could not read Windows inheritance flags.")
        flags = 4 | (0x80000000 if control.value & 0x1000 else 0x20000000)
        code = api.SetNamedSecurityInfoW(str(destination), 1, flags, None, None, dacl, None)
        if code:
            raise UpdateError(f"Could not copy Windows permissions (error {code}).")
    finally:
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.LocalFree.argtypes = [pointer]
        kernel.LocalFree(descriptor)


def copy_tree(source: Path, destination: Path, preserve_acl: bool = False) -> None:
    if os.name == "nt":
        result = subprocess.run(["robocopy.exe", str(source), str(destination), "/E",
                                 "/COPY:DATS" if preserve_acl else "/COPY:DAT",
                                 "/DCOPY:DAT", "/R:1", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS"],
                                capture_output=True, check=False)
        if result.returncode >= 8:
            raise UpdateError("File copy failed; update was not completed.")
        if preserve_acl:
            copy_acl(source, destination)
    else:
        shutil.copytree(source, destination, dirs_exist_ok=True, copy_function=shutil.copy2)
        shutil.copystat(source, destination)


def port_free(port: int) -> None:
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError as error:
            raise UpdateError("The web port is still in use. Stop any manual instance before updating.") from error


def wait_ready(port: int, https: bool, service: Service, timeout: float = 45) -> None:
    url = f"{'https' if https else 'http'}://127.0.0.1:{port}/health/ready"
    # The installer creates a self-signed certificate. This exception is loopback-only.
    context = ssl._create_unverified_context() if https else None
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    handlers = [urllib.request.ProxyHandler({}), NoRedirect()]
    if https:
        handlers.append(urllib.request.HTTPSHandler(context=context))
    opener = urllib.request.build_opener(*handlers)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with opener.open(url, timeout=2) as response:
                if json.load(response).get("status") == "ready" and service.active():
                    return
        except (OSError, ValueError):
            pass
        time.sleep(1)
    raise UpdateError("Updated application did not become ready; restoring the backup.")


def update(target: Path, package: Path, runtime: str, service: Service | None = None,
           health=wait_ready, check_port=port_free) -> Path:
    if not target.is_absolute() or not package.is_absolute():
        raise UpdateError("Installation and package directories must be absolute paths.")
    if target.is_symlink() or package.is_symlink():
        raise UpdateError("Use real installation/package directories, not links.")
    target, package = target.resolve(), package.resolve()
    executable = "Cockpit.Web.exe" if runtime == "win-x64" else "Cockpit.Web"
    if target == target.parent or not (target / executable).is_file() or not (target / "data").is_dir():
        raise UpdateError("Select an existing standard Cockpit installation.")
    if os.name != "nt" and target.stat().st_uid != os.geteuid():
        raise UpdateError("Run the updater as the installation owner, not with sudo.")
    no_links(target)
    no_links(package)
    if package.is_relative_to(target) or target.is_relative_to(package):
        raise UpdateError("Installation and package directories must not overlap.")
    payload = package / "app"
    if f"Target: {runtime}" not in (package / "PACKAGE-INFO.txt").read_text(encoding="utf-8").splitlines() or not (payload / executable).is_file():
        raise UpdateError("Package architecture or application payload does not match.")
    protected = {"data", "logs", "appsettings.Local.json", "HeishaMonCockpitService.exe", "HeishaMonCockpitService.xml"}
    if any((payload / name).exists() for name in protected):
        raise UpdateError("Package unexpectedly contains installation-specific data/configuration.")
    override_keys = {"history__path", "access__databasepath", "mqtt__secretdirectory", "source", "localport", "access__localhttps"}
    if any(key.casefold().replace(":", "__") in override_keys for key in os.environ):
        raise UpdateError("Clear storage/source/port environment overrides before updating.")
    port, https, paths = configuration(target)
    incoming_base = payload / "appsettings.json"
    if configuration(target, incoming_base) != (port, https, paths):
        raise UpdateError("Package changes effective storage or listener settings; a manual migration is required.")
    service = service or Service(target)
    lock = target.with_name(target.name + ".update.lock")
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise UpdateError("Another update is active, or a previous update lock needs inspection.") from error
    try:
        transaction = Path(tempfile.mkdtemp(prefix=target.name + ".update-", dir=target.parent))
        if os.name == "nt":
            copy_acl(target, transaction)
    except BaseException:
        os.close(descriptor)
        lock.unlink()
        raise
    candidate, backup = transaction / "candidate", transaction / "backup"
    stopped = False
    swapped = False
    try:
        if service.running:
            service.stop()
            stopped = True
        check_port(port)
        copy_tree(target, candidate, preserve_acl=True)
        # Remove obsolete program content only inside the private candidate tree.
        for name in ("wwwroot", "runtimes", "third-party"):
            path = candidate / name
            if path.exists():
                shutil.rmtree(path)
        for path in candidate.iterdir():
            if path.is_file() and (path.suffix in (".dll", ".pdb") or path.name.endswith((".deps.json", ".runtimeconfig.json"))):
                path.unlink()
        copy_tree(payload, candidate)
        # Keep installer-owner permissions on the candidate root after overlay.
        if os.name != "nt":
            shutil.copystat(target, candidate)
            (candidate / executable).chmod((candidate / executable).stat().st_mode | 0o100)
        target.rename(backup)
        try:
            candidate.rename(target)
        except BaseException:
            backup.rename(target)
            raise
        swapped = True
        if service.running:
            service.start()
            health(port, https, service)
        print(f"Update complete. Previous installation and data: {backup}")
        if not service.running:
            print("The application was stopped before the update and remains stopped.")
        return backup
    except BaseException as error:
        if swapped:
            try:
                if service.running:
                    service.stop()
                target.rename(transaction / "failed-update")
                # Restore a copy so the original backup stays untouched for inspection.
                copy_tree(backup, target, preserve_acl=True)
                if service.running:
                    service.start()
                    health(port, https, service)
            except BaseException as rollback_error:
                raise UpdateError(f"Update and recovery failed. Preserve {transaction}; restore manually before starting. {rollback_error}") from error
        elif stopped:
            service.start()
        raise UpdateError(f"Update failed; previous installation restored/preserved. Backup/workspace: {transaction}. {error}") from error
    finally:
        os.close(descriptor)
        lock.unlink()


def main() -> int:
    import signal
    def interrupted(signum: int, frame: object) -> None:
        raise UpdateError("Update interrupted; attempting recovery.")
    signal.signal(signal.SIGTERM, interrupted)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install-dir", required=True, type=Path)
    parser.add_argument("--package-directory", required=True, type=Path)
    parser.add_argument("--runtime", required=True, choices=("win-x64", "linux-x64", "linux-arm64"))
    parser.add_argument("--result-file", type=Path)
    args = parser.parse_args()
    try:
        backup = update(args.install_dir, args.package_directory, args.runtime)
        result, code = {"ok": True, "backup": str(backup)}, 0
    except Exception as error:
        result, code = {"ok": False, "message": str(error)}, 1
        print(str(error))
    if args.result_file:
        try:
            args.result_file.write_text(json.dumps(result), encoding="utf-8")
        except OSError:
            print("Could not save the result file; inspect the update output/workspace.")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
