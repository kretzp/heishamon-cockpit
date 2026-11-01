# Windows installation from source

Use Windows x64 and a 64-bit PowerShell terminal. Windows ARM64 is not supported by this installer. Internet access, working HTTPS certificate trust and Windows `tar.exe` are required. Run as the account that will run the application.

Open the source checkout in PowerShell. Clone the GitHub repository and change into its directory first. Run:

```powershell
.\installation\install-windows.ps1
```

If local execution policy blocks a reviewed script, you can use a process-only policy for this invocation:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installation\install-windows.ps1
```

Organizational policy may override this. Do not change a managed policy to bypass it.

The installer downloads pinned Node.js 24.20.0 and .NET SDK 10.0.303 into `.cache/build-tools`, checks the Node archive checksum, restores locked dependencies, builds the frontend and publishes a self-contained Windows package. NuGet caches default to `.cache/nuget`; explicit cache environment variables are respected. Each build is retained in a new `artifacts/build-*` directory. The package is extracted and its interactive installer is run.

The default destination is `%LOCALAPPDATA%\HeishaMonCockpit`. An existing installation is never overwritten. For another new directory:

```powershell
.\installation\install-windows.ps1 -InstallDirectory "$env:LOCALAPPDATA\HeishaMonCockpitManual"
```

## Setup prompts

Enter a new administrator username and password of at least 12 characters. Enter the MQTT broker address, port (default `1883`), HeishaMon topic base (default `panasonic_heat_pump`), TLS choice (default `no`) and optional broker credentials. The topic base must not include `/main/`, `/extra/`, wildcards or a trailing slash. Password input is hidden.

Choose the web interface port (default `5080`) and whether to allow control (default `no`, read-only). Control requires MQTT credentials and the device, installation and other-controller confirmations. Setup creates an empty SQLite account database and a self-signed HTTPS certificate. It restricts the installation directory to the installing account. Failed setup preserves the directory for inspection; use a new destination for another attempt.

## Start and check

```powershell
Set-Location "$env:LOCALAPPDATA\HeishaMonCockpit"
.\Cockpit.Web.exe
```

Use your selected directory if different. Starting the application connects to the configured broker. Open `https://localhost:5080/` on the Windows computer, or `https://<windows-ip>:5080/` from another device, using your chosen port. Sign in with the administrator account. Stop the application with `Ctrl+C`.

The application listens on all IPv4 interfaces and requires HTTPS and login. Windows Firewall must allow the selected port for the intended clients; firewall rules are not installed automatically. The self-signed certificate includes the computer's IPv4 addresses at setup time. Verify its fingerprint through a trusted channel before trusting it on another device. Changed addresses can require a replacement certificate.

To start without contacting the configured broker:

```powershell
$env:Source = 'simulator'
.\Cockpit.Web.exe
Remove-Item Env:Source
```

Simulator values are synthetic. Review [CONTROL-SETUP.md](CONTROL-SETUP.md) and [SUPPORTED-DEVICES.md](SUPPORTED-DEVICES.md) before enabling physical control. The installer does not configure a Windows service, automatic startup, certificate trust, firewall rules or backup jobs. The source installer checks for Python 3.10+ with SSL and the required standard-library modules. If missing, it installs Python 3.14 for the current user using winget and verifies it. Windows App Installer (winget) is required for automatic installation. Existing compatible Python installations are reused. The detected interpreter path is printed for MCP client configuration. The MCP bridge is not started or registered automatically.
