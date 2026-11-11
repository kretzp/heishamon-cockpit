# Linux installation from source

## Method 1: Download, clone, build and install

On Linux x86-64 or ARM64, use an interactive terminal as the account that will run the application. Install Git, curl and HTTPS certificates first. On Debian/Ubuntu:

```sh
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
```

On other distributions use their package manager. Download the script to a file:

```sh
curl --fail --location --proto '=https' --tlsv1.2 \
  https://raw.githubusercontent.com/kretzp/heishamon-cockpit/master/installation/bootstrap-linux.sh \
  -o "$HOME/heishamon-bootstrap-linux.sh"
```

Review the file, then run it without `sudo`:

```sh
sh "$HOME/heishamon-bootstrap-linux.sh"
```

The script clones the current GitHub `master` branch into a new `$HOME/heishamon-cockpit-source.<unique-id>` directory and runs `installation/install-linux.sh` from that clone. The existing installer builds the package and starts interactive setup; missing build prerequisites may require `sudo`. Source, downloaded tools and artifacts remain in the clone, including after a failure. Each invocation uses a new source directory and does not update an existing checkout or installation.

To choose a new installation destination:

```sh
sh "$HOME/heishamon-bootstrap-linux.sh" "$HOME/.local/share/heishamon-cockpit-manual"
```

The installation path must be absolute and must not already exist. Download to a file rather than piping into `sh`, so setup can read your answers from the terminal. Continue with the setup prompts and startup instructions below. The application remains stopped unless you explicitly choose service installation at the final prompt; choosing yes starts it and connects to MQTT.

## Method 2: Install from an existing source checkout

On Linux x86-64 or 64-bit Raspberry Pi OS, open a terminal in the source checkout. Clone the GitHub repository and change into its directory.

```sh
sh installation/install-linux.sh
```

The script detects the architecture, checks common tools, builds a new package and runs its interactive installer. If common tools or Python 3 are missing and `apt-get` is available, it uses `sudo` to install them. Otherwise, install missing system tools using the distribution's package manager and retry. The build bootstrap uses Node.js 24.20.0 and .NET SDK 10.0.404 if present, or downloads them into `.cache/build-tools` in the checkout. NuGet caches default to `.cache/nuget` in the checkout; explicitly configured NuGet cache paths are respected. An internet connection, working system libraries and access to the npm and NuGet registries are needed. The generated archive is kept in a unique `artifacts/build.*` directory.

The default destination is `~/.local/share/heishamon-cockpit`. If an existing `~/.local` or `~/.local/share` is not accessible to the current user, the script uses `~/heishamon-cockpit` instead and prints the chosen path. To use a different, new directory:

```sh
sh installation/install-linux.sh "$HOME/.local/share/heishamon-cockpit-manual"
```

An existing destination is never overwritten. If setup fails after it has created the installation directory, inspect that directory and choose another path for a retry.

## Setup prompts

Yes/no questions accept `yes`/`y` and `no`/`n` regardless of case; Enter defaults to no. Invalid answers display a message and repeat the same question.

Enter a new administrator name and password (at least 12 characters). Then enter the real MQTT broker host, port (default `1883`), HeishaMon topic base (default `panasonic_heat_pump`), TLS choice (default `no`), and, if applicable, broker username and password. Enter the topic base without `/main/`, `/extra/`, a trailing slash or wildcards. Passwords are entered without echo. Select the web interface port (default `5080`) and whether to allow heat-pump control (default `no`). The application remains stopped unless service installation is explicitly selected at the final prompt; choosing yes starts it and connects to MQTT.

The installer creates an empty SQLite account database, broker configuration and a self-signed local HTTPS certificate. No previous measurements or accounts are imported. The initial MQTT mode is read-only unless control is explicitly enabled and the required confirmations are supplied during setup. Control requires configured MQTT credentials.

## Optional service installation

At the final automatic-service prompt, **Enter means no**. Choosing yes uses `sudo` to install **heishamon-cockpit.service**, enables it at boot and starts it immediately, opening the MQTT connection. A running systemd system manager is required. Run setup as the normal application user; the service keeps that user's UID/GID. For an existing service, choose Abort (`a/A`), Delete and reinstall (`d/D`), or Start (`s/S`); invalid input repeats the question. Enter defaults to Abort. Failure preserves the application for manual startup.

Use `systemctl status heishamon-cockpit.service`, `sudo systemctl start heishamon-cockpit.service`, `sudo systemctl stop heishamon-cockpit.service` and `sudo journalctl -u heishamon-cockpit.service -f`. For removal, run `sudo systemctl disable --now heishamon-cockpit.service`, remove `/etc/systemd/system/heishamon-cockpit.service` with sudo, then run `sudo systemctl daemon-reload`. Application files/data remain. See [service setup and diagnostics](SERVICE.md) for details and limitations.

## Update an existing installation

From the source checkout, as the installation owner:

```sh
git pull --ff-only
sh installation/update-linux.sh "$HOME/.local/share/heishamon-cockpit"
```

Use your actual installation path, including `"$HOME/heishamon-cockpit"` if the installer selected that fallback. Stop a manually started instance first. Run without sudo; service management requests sudo when needed. The updater preserves settings and data, retains a full backup and restarts only a previously running service. See [update prerequisites, recovery and prepared packages](UPDATE.md).

## Start and check

If service installation was selected, the application is already running. Use the service commands below instead of starting a second instance. Otherwise start it manually:

From the installation directory, run (use `~/heishamon-cockpit` if the installer selected the fallback):

```sh
cd "$HOME/.local/share/heishamon-cockpit"
./Cockpit.Web
```

If you selected another directory, use that directory instead. Starting without `Source=simulator` connects to the configured MQTT broker. Open `https://localhost:5080/` on the Linux computer, or `https://<linux-ip>:5080/` from another computer, using the port chosen during setup. On Linux, `hostname -I` shows the current IP addresses. Sign in as the new administrator. Check the displayed connection status and measurements, and review the topic base under Settings. Stop the application with `Ctrl+C`.

The installed application listens on all IPv4 interfaces and requires HTTPS and login. Your firewall must allow the chosen port for the clients you want to use. The certificate is self-signed; it contains the machine's IPv4 addresses at installation time. Verify its fingerprint through a trusted channel before trusting it on each client. A changed IP address or a certificate from an earlier installation may cause a name mismatch and requires a suitable replacement certificate.

To start without contacting the real broker, use `Source=simulator ./Cockpit.Web`. Simulated values are not measurements from the real installation.

A systemd service with automatic startup is optional (default no). Firewall rules, certificate trust and backup jobs are not configured. To restrict a future start to this machine, set `Access:ListenAddress` to `localhost` in the local configuration. Non-loopback access requires HTTPS and login. Before enabling any physical control, review [CONTROL-SETUP.md](CONTROL-SETUP.md) and [SUPPORTED-DEVICES.md](SUPPORTED-DEVICES.md), verify the actual device and firmware, and decide on each real-world test separately.

## MCP Python prerequisite

The source installer verifies Python 3.10+ with SSL and the required standard-library modules. If Python is missing or unusable, it installs the distribution Python package using apt and sudo and verifies it again. If the distribution cannot provide Python 3.10+, upgrade the distribution or provide a compatible python3 on PATH. No pip packages are required. The interpreter path is printed; configure it with cockpit_mcp.py in your MCP client. The installer does not start or register the bridge or store MCP login credentials.
