# Windows installation from source

Use Windows x64 and a 64-bit PowerShell terminal. Windows ARM64 is not supported by this installer. Internet access, working HTTPS certificate trust and Windows `tar.exe` are required. Run as the account that will run the application.

## Method 1: Download, clone, build and install

Install **Git for Windows** first and open a new 64-bit PowerShell terminal. Download the bootstrap script into your home directory:

```powershell
$bootstrap = Join-Path $HOME 'heishamon-bootstrap-windows.ps1'
Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/kretzp/heishamon-cockpit/master/installation/bootstrap-windows.ps1' -OutFile $bootstrap
```

Review the downloaded script, then run it as your normal user:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $bootstrap
```

The execution policy applies only to this process; organizational policy may override it. The script clones the current GitHub `master` branch into a new `heishamon-cockpit-source-<unique-id>` directory under your user profile, then invokes `installation/install-windows.ps1` from that clone. That installer builds the package and starts interactive setup. Build tools, source and package artifacts are retained in the clone. No existing checkout or installation is overwritten. A failed clone or setup leaves its source directory available for inspection; another invocation uses a new source directory.

To select new source and installation directories:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $bootstrap -SourceDirectory "$HOME\cockpit-source" -InstallDirectory "$env:LOCALAPPDATA\HeishaMonCockpitManual"
```

Both paths must be absolute and must not already exist. Setup prompts and application startup are described below. This method requires Git, HTTPS access and the same build prerequisites as Method 2; it starts the server and connects to MQTT only if service installation is explicitly selected at the final prompt.

## Method 2: Install from an existing source checkout

Open the source checkout in PowerShell. Clone the GitHub repository and change into its directory first. Run:

```powershell
.\installation\install-windows.ps1
```

If local execution policy blocks a reviewed script, you can use a process-only policy for this invocation:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installation\install-windows.ps1
```

Organizational policy may override this. Do not change a managed policy to bypass it.

The installer downloads pinned Node.js 24.20.0 and .NET SDK 10.0.404 into `.cache/build-tools`, checks the Node archive checksum, restores locked dependencies, builds the frontend and publishes a self-contained Windows package. NuGet caches default to `.cache/nuget`; explicit cache environment variables are respected. Each build is retained in a new `artifacts/build-*` directory. The package is extracted and its interactive installer is run.

The default destination is `%LOCALAPPDATA%\HeishaMonCockpit`. An existing installation is never overwritten. For another new directory:

```powershell
.\installation\install-windows.ps1 -InstallDirectory "$env:LOCALAPPDATA\HeishaMonCockpitManual"
```

## Setup prompts

Yes/no questions accept `yes`/`y` and `no`/`n` regardless of case; Enter defaults to no. Invalid answers display a message and repeat the same question.

Enter a new administrator username and password of at least 12 characters. Enter the MQTT broker address, port (default `1883`), HeishaMon topic base (default `panasonic_heat_pump`), TLS choice (default `no`) and optional broker credentials. The topic base must not include `/main/`, `/extra/`, wildcards or a trailing slash. Password input is hidden.

Choose the web interface port (default `5080`) and whether to allow control (default `no`, read-only). Control requires MQTT credentials and the device, installation and other-controller confirmations. Setup creates an empty SQLite account database and a self-signed HTTPS certificate. It restricts the installation directory to the installing account. Failed setup preserves the directory for inspection; use a new destination for another attempt.

## Optional service installation

The final prompt asks whether to install a service with automatic startup; **Enter means no**. Choosing yes requests UAC elevation, downloads and verifies WinSW v2.12.0, installs **HeishaMonCockpit** as **LocalService** and starts it immediately, opening the MQTT connection. For an existing service, choose Abort (`a/A`), Delete and reinstall (`d/D`), or Start (`s/S`); invalid input repeats the question. Enter defaults to Abort. Failure leaves the application available for manual startup. See [service setup and diagnostics](SERVICE.md) for the pinned checksum, permissions, rotated log files and removal steps.

In elevated PowerShell: `Get-Service HeishaMonCockpit`, `Start-Service HeishaMonCockpit` or `Stop-Service HeishaMonCockpit`. Logs are in `<installation>\logs`; remove the service with `HeishaMonCockpitService.exe stop` followed by `HeishaMonCockpitService.exe uninstall` from the installation directory, in an elevated terminal. Application files and data are preserved.

## Update an existing installation

From the source checkout in 64-bit PowerShell:

```powershell
git pull --ff-only
.\installation\update-windows.ps1 -InstallDirectory "$env:LOCALAPPDATA\HeishaMonCockpit"
```

Supply your actual installation path if different. Stop a manually started instance first. The updater builds the source, preserves configuration and data, retains a full backup and restarts only a previously running service. UAC is requested for existing service management. See [update prerequisites, recovery and prepared packages](UPDATE.md).

## Start and check

If service installation was selected, the application is already running. Use the service commands below instead of starting a second instance. Otherwise start it manually:

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

Simulator values are synthetic. Review [CONTROL-SETUP.md](CONTROL-SETUP.md) and [SUPPORTED-DEVICES.md](SUPPORTED-DEVICES.md) before enabling physical control. Windows service installation and automatic startup are optional (default no). Certificate trust, firewall rules and backup jobs are not configured. The source installer checks for Python 3.10+ with SSL and the required standard-library modules. If missing, it installs Python 3.14 for the current user using winget and verifies it. Windows App Installer (winget) is required for automatic installation. Existing compatible Python installations are reused. The detected interpreter path is printed for MCP client configuration. The MCP bridge is not started or registered automatically.
