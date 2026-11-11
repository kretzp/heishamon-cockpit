# HeishaMon Cockpit

A self-hosted heat pump dashboard and control interface built on HeishaMon (https://github.com/heishamon/HeishaMon). **Requires HeishaMon and an MQTT broker.**
Thx to all Heishamon contributors for this peace of software.

This is an independent companion application for HeishaMon, with historical charts, role-based accounts and explicitly confirmed control actions. The repository name is `heishamon-cockpit`.

Windows x64, Linux x64 and Raspberry Pi ARM64 installation targets are available. See [compatibility](documentation/COMPATIBILITY.md) for tested systems and limitations, and [release notes](documentation/RELEASE-NOTES.md) for the initial feature set.

## Features

- Live measurements and connection status from HeishaMon MQTT topics.
- Dallas DS18B20 sensors appear in **Dallas-1-Wire** between Heating curve and Events once MQTT temperatures arrive. Each card shows its alias, full sensor address, two-decimal temperature and status; all statuses other than OK are red. Click a card for stored history and CSV export. Choose **Arrange tiles** to drag cards or move them with keyboard arrows/buttons, and select visible sensors to hide or restore cards. Order and visibility are saved per sensor address in the current browser; hiding a card does not stop history recording.
- SQLite measurement history, charts, daily energy views and CSV export.
- COP calculated from HeishaMon Extra power readings, with separate heating and hot-water history.
- Optional [external MQTT power measurements](documentation/alternative-power.md) for historical COP and daily electrical energy, including imported Shelly history.
- Administrator, reader and reader/writer accounts with hashed passwords.
- Administrator settings for users, MQTT connection, HeishaMon topic base and control mode.
- Control activation and deactivation without an application restart, with separate confirmation for each device change.
- An authenticated MCP stdio bridge using the same application accounts and permissions.
- Interface languages: English, German, French, Spanish, Italian and Portuguese.

<img width="2525" height="1127" alt="image" src="https://github.com/user-attachments/assets/ec237616-5574-47b1-b962-bbb8e77d7ea5" />


## Requirements and supported targets

An existing HeishaMon installation and reachable MQTT broker are required for real measurements. Available readings depend on the device and firmware; missing data remains unknown. The application starts with a fresh database and does not require a Shelly meter or import previous measurements.

| Target | Download bootstrap | Existing checkout installer | Guide |
| --- | --- | --- | --- |
| Windows x64, 64-bit PowerShell | `installation/bootstrap-windows.ps1` | `installation/install-windows.ps1` | [Windows](documentation/WINDOWS-INSTALL.md) |
| Linux x64 | `installation/bootstrap-linux.sh` | `installation/install-linux.sh` | [Linux](documentation/LINUX-INSTALL.md) |
| Raspberry Pi with 64-bit ARM Linux | `installation/bootstrap-raspberry-pi.sh` | `installation/install-raspberry-pi.sh` | [Raspberry Pi](documentation/RASPBERRY-PI-INSTALL.md) |

The observed Raspberry Pi target runs Debian 12 ARM64; Raspberry Pi OS specifically has not yet been independently verified. The Pi installer rejects 32-bit systems. Windows ARM64 and macOS are not supported by these installers.

Source builds require internet access. The installers provide pinned Node.js and .NET build tools. Python 3.10+ with SSL is required for MCP: Windows installs it with WinGet when needed; Linux and Pi use apt when available. See each guide for prerequisite details and failure handling.

## Install from source

### Method 1: Download, clone, build and install

Use a terminal as the account that will run the application. Install Git first; Linux and Raspberry Pi also need curl and working HTTPS certificates (`sudo apt-get install git curl ca-certificates` on Debian/Ubuntu). No existing source checkout is needed. Download the appropriate script, review it, then run it:

Windows x64, in 64-bit PowerShell:

```powershell
$bootstrap = Join-Path $HOME 'heishamon-bootstrap-windows.ps1'
Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/kretzp/heishamon-cockpit/master/installation/bootstrap-windows.ps1' -OutFile $bootstrap
# Review the downloaded file before running it.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $bootstrap
```

Linux x64/ARM64:

```sh
curl --fail --location --proto '=https' --tlsv1.2 \
  https://raw.githubusercontent.com/kretzp/heishamon-cockpit/master/installation/bootstrap-linux.sh \
  -o "$HOME/heishamon-bootstrap-linux.sh"
# Review the downloaded file before running it.
sh "$HOME/heishamon-bootstrap-linux.sh"
```

Raspberry Pi with a 64-bit ARM operating system:

```sh
curl --fail --location --proto '=https' --tlsv1.2 \
  https://raw.githubusercontent.com/kretzp/heishamon-cockpit/master/installation/bootstrap-raspberry-pi.sh \
  -o "$HOME/heishamon-bootstrap-raspberry-pi.sh"
# Review the downloaded file before running it.
sh "$HOME/heishamon-bootstrap-raspberry-pi.sh"
```

Each script clones the current `master` branch into a new source directory under your home, builds through the existing platform installer and starts interactive installation. It retains the clone and build artifacts and never overwrites an existing installation. Run it as your normal user; the Linux/Pi installer requests `sudo` for missing system prerequisites and, if selected, service registration. Windows uses a process-only execution policy; organizational restrictions still apply. The application remains stopped unless you explicitly choose service installation at the final prompt; choosing yes starts it and connects to MQTT. See the platform guides above for custom directories, setup prompts and startup.

### Method 2: Install from an existing source checkout

Open a source checkout or a supplied source snapshot. Use a terminal as the account that will run the application.

Windows:

```powershell
.\installation\install-windows.ps1
```

Linux:

```sh
sh installation/install-linux.sh
```

Raspberry Pi:

```sh
sh installation/install-raspberry-pi.sh
```

Each entry point builds a self-contained application package and runs its interactive setup. An existing installation directory is never overwritten. The setup asks for:

| Setting | Default |
| --- | --- |
| Initial administrator username and password | Enter during setup; password at least 12 characters |
| MQTT broker address | Enter during setup |
| MQTT broker port | `1883` |
| HeishaMon topic base | `panasonic_heat_pump` |
| MQTT TLS | `no` |
| Broker username and password | Enter if required by the broker |
| Web interface port | `5080` |
| Heat-pump control | Disabled; read-only |

Use the actual topic base configured in HeishaMon, without `/main/`, `/extra/`, wildcards or a trailing slash. Choose MQTT TLS and credentials to match the broker. Password entry is hidden. The application remains stopped unless you explicitly choose service installation at the final prompt; choosing yes starts it and connects to the broker.

Yes/no questions accept `yes`/`y` and `no`/`n` without regard to case. Enter defaults to no; invalid answers show a message and repeat the question.

For package-only installation and custom destinations, see [installation details](documentation/INSTALLATION.md).

## Update an existing installation

Run these commands on the computer where Cockpit is installed, from your source checkout. Choose **only the command block for your operating system**:

### Windows (PowerShell)

```powershell
git pull --ff-only
.\installation\update-windows.ps1
```

### Linux (x64 or ARM64, terminal)

```sh
git pull --ff-only
sh installation/update-linux.sh
```

### Raspberry Pi (64-bit Raspberry Pi OS / Linux ARM64, terminal or SSH)

```sh
git pull --ff-only
sh installation/update-raspberry-pi.sh
```

On Linux and Raspberry Pi, omitting the directory detects and prints the actual installation path from `heishamon-cockpit.service` before building. No default path is guessed. To check it yourself:

```sh
systemctl show heishamon-cockpit.service --property=WorkingDirectory --value
```

For a manual installation without a service, use the directory containing `Cockpit.Web` and `data/`. You can also supply a known absolute path explicitly (for example, if the command above prints `/home/openhabian/heishamon-cockpit`):

```sh
# Linux:
sh installation/update-linux.sh "/home/openhabian/heishamon-cockpit"
# Raspberry Pi:
sh installation/update-raspberry-pi.sh "/home/openhabian/heishamon-cockpit"
```

On Windows, omitting `-InstallDirectory` detects the installation directory from the registered `HeishaMonCockpit` service. Before building, the script checks the path, application files, read access and standard service configuration, and prints the detected path. It does not guess a default path. To inspect the service executable path yourself:

```powershell
Get-CimInstance Win32_Service -Filter "Name='HeishaMonCockpit'" | Select-Object -ExpandProperty PathName
```

To specify a path explicitly, pass the directory containing `HeishaMonCockpitService.exe` as `-InstallDirectory`. Without a service, this argument is required: use the directory containing `Cockpit.Web.exe` and `data/`, for example:

```powershell
.\installation\update-windows.ps1 -InstallDirectory "$env:LOCALAPPDATA\HeishaMonCockpit"
```

Replace that example with your actual installation directory. A registered service pointing elsewhere causes an abort.

 Stop a manually started application first. The updater builds the current checkout, preserves configuration and data, retains a complete backup and restarts an existing service only if it was running. If startup fails, it attempts to restore the previous installation and databases. See [update prerequisites, rollback and prepared packages](documentation/UPDATE.md).

## Start the application

Since **0.9.1**, installation ends with an optional **automatic service startup** prompt (default **no**). Choosing yes requests administrator/sudo access, registers a Windows service or Linux/Pi systemd service and **starts the application immediately, connecting to MQTT**. For an existing service, choose Abort (`a/A`), Delete and reinstall (`d/D`), or Start (`s/S`); invalid input repeats the question. Enter defaults to Abort. See [service management, logs and removal](documentation/SERVICE.md).

If the service was installed, it is already running; use the service commands instead of starting another instance. Otherwise start manually:

On Windows, from the default installation directory:

```powershell
Set-Location "$env:LOCALAPPDATA\HeishaMonCockpit"
.\Cockpit.Web.exe
```

On Linux and Pi:

```sh
cd "$HOME/.local/share/heishamon-cockpit"
./Cockpit.Web
```

If the installer selected the fallback `~/heishamon-cockpit`, or you supplied another directory, use that directory instead. Starting normally connects to the configured broker. Open `https://localhost:5080/`, or `https://<server-ip>:5080/` from another device, using the selected port. Sign in with the initial administrator account.

Installed instances use HTTPS, require login and listen on IPv4 interfaces. Firewall access must be configured separately. The self-signed certificate includes the machine's IPv4 addresses at installation time; verify its fingerprint before trusting it on a client. An address change may require a replacement certificate. Use `Ctrl+C` to stop a foreground instance.

For a local test without contacting the broker, start with `Source=simulator ./Cockpit.Web` on Linux/Pi, or set `$env:Source = 'simulator'` before starting the Windows executable. Remove that Windows environment variable with `Remove-Item Env:Source` when finished. Simulated readings are synthetic.

## Accounts and control

| Role | Permissions |
| --- | --- |
| Reader | Read application data |
| Reader + Writer | Read data and request enabled, individually confirmed device changes |
| Administrator | Manage users and application settings; request confirmed device changes |

Passwords use salted PBKDF2-SHA256 hashes. Account changes revoke existing sessions, and the last active administrator is protected. See [user accounts](documentation/USER-ACCOUNTS.md).

An administrator enables control under **Settings → Heat-pump control**. Enabling it does not itself send a device command. Disabling waits for an in-progress send; an already sent command cannot be recalled. The server applies role, freshness, operating-mode and command checks. MQTT acknowledgement or matching telemetry is not proof that the device executed a specific command.

The existing control profile is based on Panasonic WH-SDC0509L3E5 / WH-WDG05LE5 units. Verify the installed device, firmware and configuration before use. Firmware compatibility is not detected automatically; some commands remain experimental. Read [control setup](documentation/CONTROL-SETUP.md) and [profile review](documentation/SUPPORTED-DEVICES.md).

## COP and history

COP is thermal power divided by electrical power, using HeishaMon Extra readings. The overview shows the current eligible ratio. History uses stored valid intervals, separates heating and hot water, and offers 5-, 15- or 30-minute moving averages. Missing or invalid measurements and operating changes interrupt the series. No measurement-boundary confirmation is required.

These readings describe the HeishaMon measurement boundary and do not establish a certified whole-installation energy measurement or an annual performance factor. An empty history database needs time to accumulate usable intervals.

## MCP integration

Installation includes `cockpit_mcp.py`. Configure your MCP client to launch it with the detected Python interpreter and the running application's HTTPS URL:

```text
python /path/to/installation/cockpit_mcp.py --url https://localhost:5080 --ca-file /path/to/trusted-certificate.pem
```

Replace the paths and port for your installation. The CA file must be a trusted PEM certificate appropriate for the server; TLS verification remains enabled. A `.pfx` file is not a PEM CA file.

Provide `COCKPIT_MCP_USERNAME` and `COCKPIT_MCP_PASSWORD` securely through the MCP client's process environment. They identify an existing Cockpit account. Do not commit credentials or place passwords in command-line arguments. MCP writing is disabled by default; it additionally requires `COCKPIT_MCP_ALLOW_WRITES=1`, a writer/admin account, enabled server control and explicit command confirmation. The bridge uses stdio and authenticates through the application API. It does not connect directly to MQTT or the database. Client registration is not automatic.

## Containers

For Docker or Podman installation, including Compose, persistent storage and
interactive HTTPS/account setup, see [container instructions](documentation/CONTAINERS.md).

## Development and verification

The build pins are in `global.json`, `.node-version` and dependency lockfiles. With matching tools available:

```sh
dotnet test Cockpit.slnx
npm --prefix web ci
npm --prefix web run build
```

Use simulator or isolated loopback brokers for development tests. Do not issue test commands to a real heat pump. Tested systems and limitations are documented in [COMPATIBILITY.md](documentation/COMPATIBILITY.md).

The installers optionally register a service with automatic startup (default no). Certificate trust, firewall rules and backup jobs are not configured. Updates must preserve configuration and databases; rerunning the fresh-install script does not upgrade an existing destination. Backups are the operator's responsibility.

## License

Original project contributions are Copyright © 2026 Peter Kretz and licensed under the [Mozilla Public License 2.0](LICENSE). See [COPYRIGHT](COPYRIGHT). Third-party components retain their own licenses, including the [shadcn MIT notice](web/src/components/ui/LICENSE.md). See [third-party notices](THIRD-PARTY-NOTICES.md) for the collected texts and recorded owner confirmations.
