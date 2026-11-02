# Optional automatic service startup (0.9.1)

After account, MQTT and HTTPS setup has succeeded, every Windows, Linux and Raspberry Pi installer asks:

```text
Install as a service that starts automatically at boot? (yes/no) [no]
```

Enter `yes` (also `y`, `j` or `ja`), or press Enter for **no**. With no, nothing is registered or started. With yes, the installer requests administrator/UAC or sudo access, registers automatic startup and starts the application immediately. **This opens the configured MQTT connection.** The existing control opt-in is unchanged. The same prompt is available when installing a built package directly or using either source installation method.

An existing service with the same name is never replaced. A cancelled elevation, missing service manager, download/checksum error or failed service setup preserves the installed application for manual startup. Inspect the reported diagnostics. If registration succeeds but initial startup fails, the installer attempts to disable autostart and preserves the service definition for inspection. Do not run a manual instance alongside the service: they would compete for the web port and database writer lock.

The installer checks the service-manager state again after a short startup interval. This is not an application or MQTT health check; open the web interface and inspect the connection status and logs after installation. Later failures are handled by the service manager and remain visible in its status/logs.

## Windows x64

Service name: **HeishaMonCockpit**. The installer downloads the standalone x64 [WinSW v2.12.0 release](https://github.com/winsw/winsw/releases/tag/v2.12.0) only after yes. It verifies the fixed SHA256 `05B82D46AD331CC16BDC00DE5C6332C1EF818DF8CEEFCD49C726553209B3A0DA` before executing it. This hash was calculated from the official release asset; WinSW does not provide a checksum file for this release. Its MIT license is included as `WinSW-LICENSE.txt`.

The service runs as **NT AUTHORITY\LocalService**, not as an administrator and without storing a Windows password. This account receives read/execute access to the installation and modify access to `data` and `logs`; the installing owner retains access, and SYSTEM/Administrators receive full access. Existing filesystem-based MQTT key material and the HTTPS certificate remain in `data`. The generated wrapper configuration uses the installation as its working directory and sets automatic startup. It does not create firewall or certificate-trust rules.

Run these in an **elevated PowerShell**:

```powershell
Get-Service HeishaMonCockpit
Start-Service HeishaMonCockpit
Stop-Service HeishaMonCockpit
Restart-Service HeishaMonCockpit
```

Logs are under `<installation>\logs`: `HeishaMonCockpitService.out.log`, `.err.log` and the service installation transcript `service-install.log`. Output/error logs rotate at 10 MB and retain up to eight older files each. To watch application output, substitute the actual installation path:

```powershell
Get-Content 'C:\path\to\HeishaMonCockpit\logs\HeishaMonCockpitService.out.log' -Tail 100 -Wait
```

To remove only the service, leaving application files and data intact:

```powershell
Set-Location 'C:\path\to\HeishaMonCockpit'
.\HeishaMonCockpitService.exe stop
.\HeishaMonCockpitService.exe uninstall
```

The helper and wrapper files are kept for diagnostics. Failed registration may require inspecting the transcript before removing a partial service. For a manual start after stopping/removing the service, run `Cockpit.Web.exe` from the installation directory.

## Linux x64 and Raspberry Pi ARM64

Service name: **heishamon-cockpit.service**. Requires a running **systemd system manager** and `sudo`. Run the installer as the normal application user; service installation from a root session is rejected. The system service runs under that user's numeric UID/GID and works even when the user is logged out. Its working directory is the installation; private directory/file permissions remain unchanged. No additional account is created. Native .NET libraries must still be present. Encrypted or unavailable home directories must be mounted before service startup.

The unit is created at `/etc/systemd/system/heishamon-cockpit.service`, ordered after `network-online.target`, enabled for `multi-user.target` and started immediately. It uses `UMask=0077`, `NoNewPrivileges=true` and restarts after process failures. Application output is sent to the systemd journal.

```sh
systemctl status heishamon-cockpit.service --no-pager
sudo systemctl start heishamon-cockpit.service
sudo systemctl stop heishamon-cockpit.service
sudo systemctl restart heishamon-cockpit.service
sudo journalctl -u heishamon-cockpit.service -n 100 --no-pager
sudo journalctl -u heishamon-cockpit.service -f
```

To remove only the service, preserving the installation and its data:

```sh
sudo systemctl disable --now heishamon-cockpit.service
sudo rm /etc/systemd/system/heishamon-cockpit.service
sudo systemctl daemon-reload
```

Systems without systemd can use the existing manual startup. The installer does not substitute another service manager, create firewall rules, trust certificates or schedule backups.

## Verification scope

Service generation, opt-in/default-no behavior, failure paths and preservation of existing services are tested with isolated command stubs. Generated Linux units are additionally checked with the real `systemd-analyze verify` parser in Linux CI, including paths with spaces, dollar signs and percent signs. The installer also runs this check before registration when `systemd-analyze` is available. Actual UAC/service registration, startup at boot and hardware-specific behavior must additionally be verified on the intended target. The tests do not start production MQTT connections or install a real service.

## Repair an early 0.9.1 Linux unit

An early installer incorrectly quoted `WorkingDirectory`, which systemd interprets as part of the path. If service setup reported a bad unit file but application setup completed, do not reinstall or recreate accounts. Use `sudo systemctl edit --full heishamon-cockpit.service` to change only `WorkingDirectory="/your/installation"` to `WorkingDirectory=/your/installation`. Keep the quoted `ExecStart` line unchanged. Then validate and start:

```sh
sudo systemd-analyze verify /etc/systemd/system/heishamon-cockpit.service
sudo systemctl daemon-reload
sudo systemctl enable --now heishamon-cockpit.service
systemctl status heishamon-cockpit.service --no-pager
```

Starting the repaired service opens the configured MQTT connection. Application configuration and databases remain unchanged.
