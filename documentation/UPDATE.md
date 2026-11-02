# Update an existing installation

Use the updater matching the target OS. It builds the **current local checkout** first; update that checkout with `git pull --ff-only` before running it. The scripts do not fetch or reset your source files themselves. Run as the account that installed the application. Build prerequisites are the same as for initial installation, including Python 3.10+ with SSL. The existing pinned build helpers and runtime lockfiles are reused.

These are application updates. They do not rerun account/MQTT setup, recreate the service, reset control opt-in or change its automatic-start setting. Do not use the fresh-install scripts or the service helper's Delete option to update application files.

## Windows x64

In 64-bit PowerShell, change into the source checkout:

```powershell
git pull --ff-only
.\installation\update-windows.ps1
```

Without `-InstallDirectory`, the script detects the directory from the registered `HeishaMonCockpit` service executable. Before building, it validates the path, application files, read access and standard service configuration, and prints the target. If there is no service, provide an explicit absolute path, e.g. `.\installation\update-windows.ps1 -InstallDirectory "$env:LOCALAPPDATA\HeishaMonCockpit"` (replace with your actual path). No default path is guessed. Inspect a registered service with `Get-CimInstance Win32_Service -Filter "Name='HeishaMonCockpit'" | Select-Object -ExpandProperty PathName`; use the directory containing `HeishaMonCockpitService.exe`. A manual installation directory contains `Cockpit.Web.exe` and `data/`. Use the same process-only execution-policy procedure from the Windows installation guide if necessary. An existing Windows service requires UAC elevation for stop/start; the package is built first, without elevating the build. Python is located using the initial installer's detection logic; no additional Python packages are required. The existing WinSW wrapper, XML, LocalService permissions and service registration remain in place.

## Linux x64 or ARM64

From the source checkout:

```sh
git pull --ff-only
sh installation/update-linux.sh
```

With no path argument, the script reads `WorkingDirectory` from `heishamon-cockpit.service`, prints the detected path and validates access before building. Check it with `systemctl show heishamon-cockpit.service --property=WorkingDirectory --value`. If no service can be detected, supply the absolute directory containing `Cockpit.Web` and `data/`, for example `sh installation/update-linux.sh "$HOME/heishamon-cockpit"`. The script never guesses a default installation path. Do not run the updater with sudo: it refuses a different installation owner. It requests sudo only to stop/start an existing systemd service. A manual installation without a service remains manual and stopped after the update.

## Raspberry Pi ARM64

From the source checkout on a 64-bit ARM Linux system:

```sh
git pull --ff-only
sh installation/update-raspberry-pi.sh
```

The same automatic systemd path detection and pre-build validation apply. For a manual installation or an explicit path, use e.g. `sh installation/update-raspberry-pi.sh "$HOME/heishamon-cockpit"`. The Pi entrypoint rejects x64 and 32-bit systems and delegates to the common Linux updater for a `linux-arm64` package.

## What the update does

1. Build a new self-contained package in a unique `artifacts/update.*` or `artifacts/update-*` directory. A build failure leaves the running installation untouched.
2. Validate the package architecture, installed configuration and service target. Only a service registered for this exact installation is controlled.
3. Stop the service **only if it was running**. An occupied web port causes an abort; stop manual application processes yourself before updating.
4. While stopped, copy the installation into a private candidate directory. Preserve `data/`, all SQLite files/sidecars, accounts, MQTT encryption keys, HTTPS certificate, `appsettings.Local.json`, logs and service artifacts. Replace program files, removing obsolete DLLs and web assets from the candidate.
5. Move the original installation into a backup on the same filesystem, then move the prepared candidate into the original installation path.
6. Restart only an originally running service and poll loopback `/health/ready` for up to 45 seconds. Readiness requires the history recorder to have initialized successfully. A stopped service remains stopped, with its enabled/disabled state unchanged.

Restarting a running service opens the configured MQTT connection and uses its existing control settings. For the self-signed HTTPS certificate, the readiness probe skips certificate validation **only for the loopback request**, with HTTP proxies and redirects disabled. It does not change certificate trust for browsers or the application.

## Backup and rollback

The updater prints a directory such as:

```text
<installation-parent>/<installation-name>.update-<unique-id>/backup
```

It contains the entire previous installation and the stopped-state data snapshot. Backups contain credentials/key material and private measurements: keep them private. They are not deleted automatically. Sufficient disk space is needed for the candidate and retained backup, including the whole database history.

If file replacement or the new service's readiness check fails, the updater attempts to stop the new service, restore the previous files **and pre-update databases**, then restart the old service only if it was previously running. This also undoes data migrations performed by a failed new version. A failed-update tree is retained alongside the untouched backup for inspection.

If automatic recovery also fails, the updater reports its transaction directory and stops. Keep all backup/workspace files, stop any remaining service/process, restore the **complete backup** to the original installation path, and verify permissions before restarting. Do not mix old binaries with newly migrated databases. A power loss, forced process kill or a machine reboot during the directory swap can require this manual recovery. A leftover `<installation>.update.lock` must be inspected and removed only after confirming that no update is still running and that the installation has been restored consistently.

Automatic rollback applies during this update attempt. It is not a later downgrade mechanism: after a successful update has accepted new user data, restoring an old backup would discard those subsequent changes.

## Prepared-package updates

You may reuse a matching **extracted package directory containing `app/` and `PACKAGE-INFO.txt`** to skip rebuilding:

```sh
sh installation/update-linux.sh /absolute/installation /absolute/extracted-package
sh installation/update-raspberry-pi.sh /absolute/installation /absolute/extracted-arm64-package
```

```powershell
.\installation\update-windows.ps1 -InstallDirectory 'C:\absolute\installation' -PackageDirectory 'C:\absolute\extracted-package'
```

Use only a package you trust. The runtime marker is a compatibility check, not a digital signature. The package and installation directories must not overlap.

## Supported layouts and checks

The automatic workflow targets the standard installation layout, with databases and MQTT keys inside `data/`. Other database/key paths, storage/source/port environment overrides, environment-specific JSON profiles, flattened JSON keys such as `History:Path`, linked files/junctions and custom service commands, service environments or systemd drop-ins require a separately planned manual update. Both the installed and incoming base configuration are merged with the retained local configuration and checked before stopping anything. An update that changes effective storage or listener settings is refused.

After completion, open the configured web address, sign in, check the version, MQTT connection and recorded history. For services, also inspect `Get-Service HeishaMonCockpit` on Windows or `systemctl status heishamon-cockpit.service` and `journalctl` on Linux/Pi. A readiness check does not establish device compatibility or prove physical command execution.

Tests exercise native temporary file/permission operations on Windows and Linux, rollback after simulated data migrations, stopped/manual installations, package validation and the three entrypoints using isolated build/service stubs. Raspberry Pi architecture dispatch and ARM64 publishing are checked; hardware-specific service behavior still requires verification on the actual Pi. No test needs a real MQTT broker or heat pump.
