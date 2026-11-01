# Linux installation from source

On Linux x86-64 or 64-bit Raspberry Pi OS, open a terminal in the source checkout. Clone the GitHub repository and change into its directory.

```sh
sh installation/install-linux.sh
```

The script detects the architecture, checks common tools, builds a new package and runs its interactive installer. If common tools or Python 3 are missing and `apt-get` is available, it uses `sudo` to install them. Otherwise, install missing system tools using the distribution's package manager and retry. The build bootstrap uses Node.js 24.20.0 and .NET SDK 10.0.303 if present, or downloads them into `.cache/build-tools` in the checkout. NuGet caches default to `.cache/nuget` in the checkout; explicitly configured NuGet cache paths are respected. An internet connection, working system libraries and access to the npm and NuGet registries are needed. The generated archive is kept in a unique `artifacts/build.*` directory.

The default destination is `~/.local/share/heishamon-cockpit`. If an existing `~/.local` or `~/.local/share` is not accessible to the current user, the script uses `~/heishamon-cockpit` instead and prints the chosen path. To use a different, new directory:

```sh
sh installation/install-linux.sh "$HOME/.local/share/heishamon-cockpit-manual"
```

An existing destination is never overwritten. If setup fails after it has created the installation directory, inspect that directory and choose another path for a retry.

## Setup prompts

Enter a new administrator name and password (at least 12 characters). Then enter the real MQTT broker host, port (default `1883`), HeishaMon topic base (default `panasonic_heat_pump`), TLS choice (default `no`), and, if applicable, broker username and password. Enter the topic base without `/main/`, `/extra/`, a trailing slash or wildcards. Passwords are entered without echo. Select the web interface port (default `5080`) and whether to allow heat-pump control (default `no`). The installer does not start the application or connect to MQTT.

The installer creates an empty SQLite account database, broker configuration and a self-signed local HTTPS certificate. No previous measurements or accounts are imported. The initial MQTT mode is read-only unless control is explicitly enabled and the required confirmations are supplied during setup. Control requires configured MQTT credentials.

## Start and check

From the installation directory, run (use `~/heishamon-cockpit` if the installer selected the fallback):

```sh
cd "$HOME/.local/share/heishamon-cockpit"
./Cockpit.Web
```

If you selected another directory, use that directory instead. Starting without `Source=simulator` connects to the configured MQTT broker. Open `https://localhost:5080/` on the Linux computer, or `https://<linux-ip>:5080/` from another computer, using the port chosen during setup. On Linux, `hostname -I` shows the current IP addresses. Sign in as the new administrator. Check the displayed connection status and measurements, and review the topic base under Settings. Stop the application with `Ctrl+C`.

The installed application listens on all IPv4 interfaces and requires HTTPS and login. Your firewall must allow the chosen port for the clients you want to use. The certificate is self-signed; it contains the machine's IPv4 addresses at installation time. Verify its fingerprint through a trusted channel before trusting it on each client. A changed IP address or a certificate from an earlier installation may cause a name mismatch and requires a suitable replacement certificate.

To start without contacting the real broker, use `Source=simulator ./Cockpit.Web`. Simulated values are not measurements from the real installation.

The installer does not set up a service, firewall rules, certificate trust or backup jobs. To restrict a future start to this machine, set `Access:ListenAddress` to `localhost` in the local configuration. Non-loopback access requires HTTPS and login. Before enabling any physical control, review [CONTROL-SETUP.md](CONTROL-SETUP.md) and [SUPPORTED-DEVICES.md](SUPPORTED-DEVICES.md), verify the actual device and firmware, and decide on each real-world test separately.

## MCP Python prerequisite

The source installer verifies Python 3.10+ with SSL and the required standard-library modules. If Python is missing or unusable, it installs the distribution Python package using apt and sudo and verifies it again. If the distribution cannot provide Python 3.10+, upgrade the distribution or provide a compatible python3 on PATH. No pip packages are required. The interpreter path is printed; configure it with cockpit_mcp.py in your MCP client. The installer does not start or register the bridge or store MCP login credentials.
