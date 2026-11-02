"""Run: python -m unittest discover -s tools -p test_update_installation.py -v.

Only temporary dummy installations and fake service controls are used.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "update_installation", Path(__file__).resolve().parents[1] / "installation/update_installation.py")
updater = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(updater)


class FakeService:
    def __init__(self, running: bool = True, exists: bool = True) -> None:
        self.running, self.exists = running, exists
        self.stops = 0
        self.starts = 0

    def stop(self) -> None:
        self.stops += 1

    def start(self) -> None:
        self.starts += 1

    def active(self) -> bool:
        return self.running


class UpdateTests(unittest.TestCase):
    def test_rejects_data_paths_in_replaced_program_content(self) -> None:
        for history in ("wwwroot/history.db", "runtimes/history.db", "third-party/history.db", "history.dll"):
            with self.subTest(history=history):
                (self.target / "appsettings.Local.json").write_text(json.dumps({"History": {"Path": history}}))
                service = FakeService()
                with self.assertRaises(updater.UpdateError):
                    updater.update(self.target, self.package, self.runtime, service)
                self.assertEqual(0, service.stops)

    def test_rejects_environment_specific_and_flattened_configuration(self) -> None:
        profile = self.target / "appsettings.Production.json"
        profile.write_text('{"History":{"Path":"/external/history.db"}}')
        with self.assertRaises(updater.UpdateError):
            updater.update(self.target, self.package, self.runtime, FakeService())
        profile.unlink()
        (self.target / "appsettings.Local.json").write_text('{"History:Path":"/external/history.db"}')
        with self.assertRaises(updater.UpdateError):
            updater.update(self.target, self.package, self.runtime, FakeService())

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="cockpit update test ")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.target = self.root / "installed app"
        self.package = self.root / "package"
        self.runtime = "win-x64" if os.name == "nt" else "linux-x64"
        self.executable = "Cockpit.Web.exe" if os.name == "nt" else "Cockpit.Web"
        (self.target / "data/mqtt-secrets").mkdir(parents=True)
        (self.target / "wwwroot").mkdir()
        (self.package / "app/wwwroot").mkdir(parents=True)
        for name, value in {
            self.executable: "old app", "obsolete.dll": "obsolete code",
            "wwwroot/old.js": "old asset", "data/history.db": "old database",
            "data/history.db-wal": "old wal", "data/users.db": "accounts",
            "data/mqtt-secrets/key.xml": "key material", "data/localhost.pfx": "certificate",
            "HeishaMonCockpitService.xml": "service definition",
            "appsettings.Local.json": json.dumps({"Source": "simulator", "LocalPort": 55123}),
        }.items():
            (self.target / name).write_text(value)
        for name, value in {self.executable: "new app", "new.dll": "new code", "wwwroot/new.js": "new asset"}.items():
            (self.package / "app" / name).write_text(value)
        (self.package / "PACKAGE-INFO.txt").write_text(f"Target: {self.runtime}\n")
        self.service = FakeService()
        self.health_calls = 0

    def health(self, port: int, https: bool, service: FakeService) -> None:
        self.health_calls += 1

    def update(self, **kwargs) -> Path:
        return updater.update(self.target, self.package, self.runtime,
                              service=self.service, health=kwargs.pop("health", self.health),
                              check_port=kwargs.pop("check_port", lambda port: None), **kwargs)

    def test_updates_program_preserves_settings_data_keys_and_backup(self) -> None:
        original_config = (self.target / "appsettings.Local.json").read_bytes()
        backup = self.update()
        self.assertEqual("new app", (self.target / self.executable).read_text())
        self.assertEqual("old app", (backup / self.executable).read_text())
        self.assertFalse((self.target / "obsolete.dll").exists())
        self.assertFalse((self.target / "wwwroot/old.js").exists())
        self.assertTrue((self.target / "wwwroot/new.js").exists())
        self.assertEqual(original_config, (self.target / "appsettings.Local.json").read_bytes())
        for name in ("data/history.db", "data/history.db-wal", "data/users.db",
                     "data/mqtt-secrets/key.xml", "data/localhost.pfx", "HeishaMonCockpitService.xml"):
            self.assertEqual((backup / name).read_bytes(), (self.target / name).read_bytes())
        self.assertEqual((1, 1, 1), (self.service.stops, self.service.starts, self.health_calls))
        self.assertFalse(self.target.with_name(self.target.name + ".update.lock").exists())

    def test_failed_start_restores_database_modified_by_new_version(self) -> None:
        def health(port: int, https: bool, service: FakeService) -> None:
            self.health_calls += 1
            if self.health_calls == 1:
                (self.target / "data/history.db").write_text("migrated database")
                (self.target / "data/users.db").write_text("changed accounts")
                raise updater.UpdateError("simulated readiness failure")
        with self.assertRaisesRegex(updater.UpdateError, "previous installation restored"):
            self.update(health=health)
        self.assertEqual("old app", (self.target / self.executable).read_text())
        self.assertEqual("old database", (self.target / "data/history.db").read_text())
        self.assertEqual("accounts", (self.target / "data/users.db").read_text())
        transaction = next(self.root.glob("installed app.update-*"))
        self.assertEqual("old database", (transaction / "backup/data/history.db").read_text())
        self.assertEqual("migrated database", (transaction / "failed-update/data/history.db").read_text())
        self.assertEqual((2, 2), (self.service.stops, self.service.starts))

    def test_stopped_service_and_manual_installation_remain_stopped(self) -> None:
        self.service = FakeService(running=False, exists=False)
        self.update()
        self.assertEqual((0, 0, 0), (self.service.stops, self.service.starts, self.health_calls))

    def test_copy_failure_preserves_old_installation_and_restarts_service(self) -> None:
        with patch.object(updater, "copy_tree", side_effect=OSError("disk full")):
            with self.assertRaisesRegex(updater.UpdateError, "disk full"):
                self.update()
        self.assertEqual("old app", (self.target / self.executable).read_text())
        self.assertEqual((1, 1), (self.service.stops, self.service.starts))

    def test_swap_failure_puts_original_directory_back(self) -> None:
        original = Path.rename
        def rename(path: Path, destination: Path) -> Path:
            if path.name == "candidate":
                raise OSError("rename failed")
            return original(path, destination)
        with patch.object(Path, "rename", rename):
            with self.assertRaisesRegex(updater.UpdateError, "rename failed"):
                self.update()
        self.assertEqual("old app", (self.target / self.executable).read_text())

    def test_rejects_wrong_architecture_before_stopping(self) -> None:
        (self.package / "PACKAGE-INFO.txt").write_text("Target: wrong-runtime\n")
        with self.assertRaisesRegex(updater.UpdateError, "architecture"):
            self.update()
        self.assertEqual(0, self.service.stops)

    def test_rejects_payload_containing_local_configuration(self) -> None:
        (self.package / "app/appsettings.Local.json").write_text("{}")
        with self.assertRaisesRegex(updater.UpdateError, "installation-specific"):
            self.update()
        self.assertEqual(0, self.service.stops)

    def test_rejects_external_data_paths(self) -> None:
        (self.target / "appsettings.Local.json").write_text(json.dumps({"History": {"Path": str(self.root / "external.db")}}))
        with self.assertRaisesRegex(updater.UpdateError, "External data"):
            self.update()
        self.assertEqual(0, self.service.stops)

    def test_rejects_external_data_in_base_or_incoming_configuration(self) -> None:
        for location in (self.target / "appsettings.json", self.package / "app/appsettings.json"):
            with self.subTest(location=location):
                location.write_text(json.dumps({"History": {"Path": str(self.root / "external.db")}}))
                with self.assertRaisesRegex(updater.UpdateError, "External data"):
                    self.update()
                self.assertEqual(0, self.service.stops)
                location.unlink()

    def test_rejects_storage_relocation_inside_installation(self) -> None:
        (self.package / "app/appsettings.json").write_text(json.dumps({"History": {"Path": "data/different.db"}}))
        with self.assertRaisesRegex(updater.UpdateError, "changes effective storage"):
            self.update()
        self.assertEqual(0, self.service.stops)

    def test_rejects_package_ancestor_before_copy(self) -> None:
        with self.assertRaisesRegex(updater.UpdateError, "must not overlap"):
            updater.update(self.target, self.root, self.runtime, service=self.service)
        self.assertEqual(0, self.service.stops)

    @unittest.skipIf(os.name == "nt", "POSIX ownership guard")
    def test_rejects_updating_as_a_different_owner(self) -> None:
        with patch.object(updater.os, "geteuid", return_value=self.target.stat().st_uid + 1):
            with self.assertRaisesRegex(updater.UpdateError, "installation owner"):
                self.update()
        self.assertEqual(0, self.service.stops)

    def test_rejects_environment_storage_overrides(self) -> None:
        with patch.dict(os.environ, {"History__Path": str(self.root / "outside.db")}):
            with self.assertRaisesRegex(updater.UpdateError, "environment overrides"):
                self.update()
        self.assertEqual(0, self.service.stops)

    def test_existing_update_lock_is_not_removed(self) -> None:
        lock = self.target.with_name(self.target.name + ".update.lock")
        lock.write_text("another update")
        with self.assertRaisesRegex(updater.UpdateError, "Another update"):
            self.update()
        self.assertEqual("another update", lock.read_text())
        self.assertEqual(0, self.service.stops)

    def test_busy_port_does_not_replace_files(self) -> None:
        def busy(port: int) -> None:
            raise updater.UpdateError("port busy")
        with self.assertRaisesRegex(updater.UpdateError, "port busy"):
            self.update(check_port=busy)
        self.assertEqual("old app", (self.target / self.executable).read_text())
        self.assertEqual(1, self.service.starts)


class InstallationDetectionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="cockpit detection ")
        self.addCleanup(self.temporary.cleanup)
        self.target = Path(self.temporary.name) / "installed app"
        self.target.mkdir()
        (self.target / "Cockpit.Web").touch()
        (self.target / "data").mkdir()

    def test_explicit_path_does_not_query_service(self) -> None:
        with patch.object(updater, "command", side_effect=AssertionError("No service lookup")):
            self.assertEqual(self.target.resolve(), updater.resolve_linux_installation(self.target))

    def test_detects_service_directory_including_spaces(self) -> None:
        with patch.object(updater.shutil, "which", return_value="systemctl"), patch.object(
                updater, "command", side_effect=["loaded", str(self.target)]) as query:
            self.assertEqual(self.target.resolve(), updater.resolve_linux_installation())
            self.assertIn("--property=WorkingDirectory", query.call_args.args[0])

    def test_missing_service_requires_explicit_path(self) -> None:
        with patch.object(updater.shutil, "which", return_value="systemctl"), patch.object(
                updater, "command", return_value="not-found"):
            with self.assertRaisesRegex(updater.UpdateError, "Supply the absolute"):
                updater.resolve_linux_installation()

    def test_unavailable_systemd_requires_explicit_path(self) -> None:
        with patch.object(updater.shutil, "which", return_value=None):
            with self.assertRaisesRegex(updater.UpdateError, "Supply the absolute"):
                updater.resolve_linux_installation()
        with patch.object(updater.shutil, "which", return_value="systemctl"), patch.object(
                updater, "command", side_effect=updater.UpdateError("No system bus")):
            with self.assertRaisesRegex(updater.UpdateError, "Supply the absolute"):
                updater.resolve_linux_installation()

    @unittest.skipIf(os.name == "nt", "POSIX symlink guard")
    def test_linked_target_is_rejected_before_resolution(self) -> None:
        link = self.target.parent / "linked install"
        link.symlink_to(self.target, target_is_directory=True)
        with self.assertRaisesRegex(updater.UpdateError, "Linked installation"):
            updater.resolve_linux_installation(link)

    def test_empty_or_relative_service_directory_is_rejected(self) -> None:
        for value in ("", "relative/path"):
            with self.subTest(value=value), patch.object(updater.shutil, "which", return_value="systemctl"), patch.object(
                    updater, "command", side_effect=["loaded", value]):
                with self.assertRaises(updater.UpdateError):
                    updater.resolve_linux_installation()

    def test_wrong_or_inaccessible_target_is_rejected(self) -> None:
        with self.assertRaises(updater.UpdateError):
            updater.resolve_linux_installation(self.target.parent)
        with patch.object(updater.os, "access", return_value=False):
            with self.assertRaisesRegex(updater.UpdateError, "accessible and writable"):
                updater.resolve_linux_installation(self.target)


class UpdateEntryTests(unittest.TestCase):
    """Exercise the actual entry scripts with a fake builder/update engine."""
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="cockpit update entries ")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / "source checkout"
        self.installation = self.source / "installation"
        self.installation.mkdir(parents=True)
        (self.source / "packaging").mkdir()
        self.target = self.root / "installed app"
        self.package = self.root / "prepared package"
        self.package.mkdir()
        source = Path(__file__).resolve().parents[1] / "installation"
        for name in ("update-linux.sh", "update-raspberry-pi.sh", "update-windows.ps1"):
            shutil.copy2(source / name, self.installation / name)
        (self.installation / "update_installation.py").write_text(
            "import argparse,json,os\nfrom pathlib import Path\np=argparse.ArgumentParser()\n"
            "p.add_argument('--install-dir');p.add_argument('--package-directory');p.add_argument('--runtime');p.add_argument('--result-file');p.add_argument('--resolve-install-dir',action='store_true')\n"
            "a=p.parse_args()\n"
            "if a.resolve_install_dir:\n"
            " if os.environ.get('UPDATE_TEST_RESOLVE_FAIL'): raise SystemExit(1)\n"
            " print(a.install_dir or os.environ['UPDATE_TEST_TARGET']);raise SystemExit(0)\n"
            "Path(os.environ['UPDATE_TEST_TRACE']).write_text(json.dumps(vars(a)))\n")
        self.environment = {key: value for key, value in os.environ.items() if key.lower() != "psmodulepath"}
        self.environment.update(UPDATE_TEST_TRACE=str(self.root / "trace.json"), UPDATE_TEST_PYTHON=sys.executable,
                                UPDATE_TEST_ROOT=str(self.root), UPDATE_TEST_TARGET=str(self.target))

    def invoke_linux(self, pi: bool = False, prepared: bool = False, arch: str = "x86_64", detect: bool = False) -> subprocess.CompletedProcess:
        bin_dir = self.root / "bin"
        bin_dir.mkdir()
        for name, text in {"uname": f"#!/bin/sh\ncase \"$1\" in -s) echo Linux;; -m) echo {arch};; esac\n",
                           "getconf": "#!/bin/sh\necho 64\n"}.items():
            (bin_dir / name).write_text(text)
            (bin_dir / name).chmod(0o700)
        (self.source / "packaging/build.sh").write_text(
            '#!/bin/sh\necho built > "$UPDATE_TEST_ROOT/built"\nmkdir "$HPC_PACKAGE_OUTPUT/content"\n'
            'tar -czf "$HPC_PACKAGE_OUTPUT/heishamon-cockpit-$1.tar.gz" -C "$HPC_PACKAGE_OUTPUT/content" .\n')
        args = ["sh", str(self.installation / ("update-raspberry-pi.sh" if pi else "update-linux.sh"))]
        if not detect:
            args.append(str(self.target))
        if prepared:
            args.append(str(self.package))
        return subprocess.run(args, env={**self.environment, "PATH": str(bin_dir) + ":" + os.environ["PATH"]},
                              text=True, capture_output=True, timeout=20)

    @unittest.skipIf(os.name == "nt", "Native Linux entrypoint")
    def test_linux_detects_target_before_build(self) -> None:
        result = self.invoke_linux(detect=True)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(str(self.target), json.loads((self.root / "trace.json").read_text())["install_dir"])

    @unittest.skipIf(os.name == "nt", "Native Linux entrypoint")
    def test_failed_detection_does_not_build(self) -> None:
        self.environment['UPDATE_TEST_RESOLVE_FAIL'] = '1'
        result = self.invoke_linux(detect=True)
        self.assertNotEqual(0, result.returncode)
        self.assertFalse((self.root / "built").exists())

    @unittest.skipIf(os.name == "nt", "Native ARM64 wrapper dispatch")
    def test_pi_detects_target(self) -> None:
        result = self.invoke_linux(pi=True, arch="aarch64", detect=True)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(str(self.target), json.loads((self.root / "trace.json").read_text())["install_dir"])

    @unittest.skipIf(os.name == "nt", "Native Linux entrypoint")
    def test_linux_builds_before_invoking_engine(self) -> None:
        result = self.invoke_linux()
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue((self.root / "built").exists())
        self.assertEqual("linux-x64", json.loads((self.root / "trace.json").read_text())["runtime"])

    @unittest.skipIf(os.name == "nt", "Native Linux entrypoint")
    def test_linux_prepared_package_skips_build(self) -> None:
        result = self.invoke_linux(prepared=True)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertFalse((self.root / "built").exists())

    @unittest.skipIf(os.name == "nt", "Native ARM64 wrapper dispatch")
    def test_pi_dispatches_arm64(self) -> None:
        result = self.invoke_linux(pi=True, arch="aarch64")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual("linux-arm64", json.loads((self.root / "trace.json").read_text())["runtime"])

    @unittest.skipIf(os.name == "nt", "Native ARM64 wrapper dispatch")
    def test_pi_refuses_x64_before_build(self) -> None:
        result = self.invoke_linux(pi=True)
        self.assertNotEqual(0, result.returncode)
        self.assertFalse((self.root / "built").exists())
        self.assertFalse((self.root / "trace.json").exists())

    def invoke_windows(self, prepared: bool, detect: bool = False, valid: bool = True,
                       service: bool = False, service_arguments: bool = False,
                       mismatched_service: bool = False) -> subprocess.CompletedProcess:
        if valid:
            (self.target / 'data').mkdir(parents=True)
            (self.target / 'Cockpit.Web.exe').touch()
        if service:
            self.target.mkdir(parents=True, exist_ok=True)
            (self.target / 'HeishaMonCockpitService.exe').touch()
            (self.target / 'HeishaMonCockpitService.xml').write_text(
                '<service><executable>%BASE%\\Cockpit.Web.exe</executable><workingdirectory>%BASE%</workingdirectory></service>')
        (self.installation / "ensure-python.ps1").write_text("function Find-CockpitPython { return $env:UPDATE_TEST_PYTHON }\n")
        (self.source / "packaging/build.ps1").write_text(
            "param([string]$Runtime)\nSet-Content -LiteralPath (Join-Path $env:UPDATE_TEST_ROOT 'built') -Value built\n"
            "$content=Join-Path $env:HPC_PACKAGE_OUTPUT 'content'; New-Item -ItemType Directory -Path $content | Out-Null\n"
            "& tar.exe -czf (Join-Path $env:HPC_PACKAGE_OUTPUT ('heishamon-cockpit-'+$Runtime+'.tar.gz')) -C $content .\n")
        script = "function Get-Service { param($Name); return $null }; "
        if service:
            script += ("function Get-CimInstance { param($ClassName,$Filter); "
                       "[pscustomobject]@{State='Stopped';PathName=('\"'+(Join-Path $env:UPDATE_TEST_SERVICE_TARGET 'HeishaMonCockpitService.exe')+'\"'"
                       + ("+' --custom'" if service_arguments else "") + ")} }; ")
        else:
            script += "function Get-CimInstance { param($ClassName,$Filter); return $null }; "
        script += "& $env:UPDATE_TEST_ENTRY"
        if not detect:
            script += " -InstallDirectory $env:UPDATE_TEST_TARGET"
        if prepared:
            script += " -PackageDirectory $env:UPDATE_TEST_PACKAGE"
        return subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
                              env={**self.environment, "UPDATE_TEST_ENTRY": str(self.installation / "update-windows.ps1"),
                                   "UPDATE_TEST_TARGET": str(self.target), "UPDATE_TEST_PACKAGE": str(self.package),
                                   "UPDATE_TEST_SERVICE_TARGET": str(self.root / 'other installation' if mismatched_service else self.target)},
                              text=True, capture_output=True, timeout=20)

    @unittest.skipUnless(os.name == "nt", "Native Windows entrypoint")
    def test_windows_detects_service_path_including_spaces(self) -> None:
        result = self.invoke_windows(prepared=False, detect=True, service=True)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn(str(self.target), result.stdout)
        self.assertEqual(str(self.target), json.loads((self.root / 'trace.json').read_text())['install_dir'])

    @unittest.skipUnless(os.name == "nt", "Native Windows entrypoint")
    def test_windows_missing_service_requires_path_before_build(self) -> None:
        result = self.invoke_windows(prepared=False, detect=True)
        self.assertNotEqual(0, result.returncode)
        self.assertIn('-InstallDirectory', result.stderr)
        self.assertFalse((self.root / 'built').exists())

    @unittest.skipUnless(os.name == "nt", "Native Windows entrypoint")
    def test_windows_invalid_target_fails_before_build(self) -> None:
        result = self.invoke_windows(prepared=False, valid=False)
        self.assertNotEqual(0, result.returncode)
        self.assertFalse((self.root / 'built').exists())

    @unittest.skipUnless(os.name == "nt", "Native Windows entrypoint")
    def test_windows_explicit_path_must_match_registered_service(self) -> None:
        result = self.invoke_windows(prepared=False, service=True, mismatched_service=True)
        self.assertNotEqual(0, result.returncode)
        self.assertIn('different installation', result.stderr)
        self.assertFalse((self.root / 'built').exists())

    @unittest.skipUnless(os.name == "nt", "Native Windows entrypoint")
    def test_windows_custom_service_command_fails_before_build(self) -> None:
        result = self.invoke_windows(prepared=False, detect=True, service=True, service_arguments=True)
        self.assertNotEqual(0, result.returncode)
        self.assertFalse((self.root / 'built').exists())

    @unittest.skipUnless(os.name == "nt", "Native Windows entrypoint")
    def test_windows_builds_before_invoking_engine(self) -> None:
        result = self.invoke_windows(prepared=False)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue((self.root / "built").exists())
        self.assertEqual("win-x64", json.loads((self.root / "trace.json").read_text())["runtime"])

    @unittest.skipUnless(os.name == "nt", "Native Windows entrypoint")
    def test_windows_prepared_package_skips_build(self) -> None:
        result = self.invoke_windows(prepared=True)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertFalse((self.root / "built").exists())


if __name__ == "__main__":
    unittest.main()
