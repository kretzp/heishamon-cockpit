# Raspberry Pi installation from source

This installer targets **64-bit Raspberry Pi OS on ARM64**. The 32-bit operating system is not supported. The tested hardware is a Raspberry Pi 5 with Debian 12 ARM64; Raspberry Pi OS specifically has not been independently verified. A working internet connection is required for build tools and npm and NuGet dependencies.

Open a terminal on the Raspberry Pi in the source checkout. Clone the GitHub repository and change into its directory first. Run the installer as the user who will run the application:

```sh
sh installation/install-raspberry-pi.sh
```

The script checks for 64-bit ARM Linux and delegates to the shared Linux installer. It checks common tools and Python 3; on Raspberry Pi OS, missing common tools can be installed with `apt-get` and `sudo`. Node.js 24.20.0 and .NET SDK 10.0.303 are reused when available or downloaded into the checkout. NuGet caches default to `.cache/nuget` in the checkout; explicitly configured NuGet cache paths are respected. The script then builds a self-contained `linux-arm64` package and runs its interactive installer. The archive is retained under `artifacts/build.*` in the checkout. The host must also have the native libraries required by .NET and a working TLS setup.

The default installation directory is `~/.local/share/heishamon-cockpit`. If an existing `~/.local` or `~/.local/share` is not accessible to the current user, the script uses `~/heishamon-cockpit` instead and prints the chosen path. To choose a different new directory, pass its absolute path:

```sh
sh installation/install-raspberry-pi.sh "$HOME/.local/share/heishamon-cockpit-manual"
```

The installer will not overwrite an existing directory. If setup fails after creating a directory, inspect it and choose a new destination for a retry.

## Setup prompts

Enter a new administrator username and password of at least 12 characters. Enter the MQTT broker address, port (default `1883`), HeishaMon topic base (default `panasonic_heat_pump`), TLS choice (default `no`), and broker credentials if required. The topic base must not include `/main/`, `/extra/`, a trailing slash or wildcards. Passwords are entered without echo.

Choose the web interface port (default `5080`) and whether to allow heat-pump control (default `no`, read-only). Enabling control requires broker credentials and explicit confirmation of the device profile, installation and other controllers. Setup creates an empty SQLite account database and a self-signed HTTPS certificate. It does not start the application or contact the broker.

## Start and check

```sh
cd "$HOME/.local/share/heishamon-cockpit"
./Cockpit.Web
```

If you chose a different directory, or the installer selected `~/heishamon-cockpit`, use that directory instead. The application now connects to the configured broker. Open `https://<raspberry-pi-ip>:5080/` from a browser, substituting the Pi's address and the selected port. Use `hostname -I` on the Pi to find its current addresses. Sign in as the administrator and check the connection and readings. Stop the application with `Ctrl+C`.

The installed application listens on all IPv4 interfaces and requires HTTPS and login. Allow the port through the firewall for the clients you intend to use. The certificate is self-signed and contains the Pi's IPv4 addresses at installation time. Verify its fingerprint through a trusted channel before trusting it on a client. A later IP address change can require a suitable replacement certificate.

To check the application without contacting the configured broker, use `Source=simulator ./Cockpit.Web`. Simulator values are not measurements from the installation. Before enabling physical control, review [CONTROL-SETUP.md](CONTROL-SETUP.md) and [SUPPORTED-DEVICES.md](SUPPORTED-DEVICES.md), and verify the device, firmware and other controllers.

The installer does not configure a background service, automatic startup, firewall rules, certificate trust or backup jobs. To restrict future starts to the Pi itself, set `Access:ListenAddress` to `localhost` in the local configuration. Non-loopback access requires HTTPS and login.

## MCP Python prerequisite

The source installer verifies Python 3.10+ with SSL and the required standard-library modules. If Python is missing or unusable, it installs the distribution Python package using apt and sudo and verifies it again. If the distribution cannot provide Python 3.10+, upgrade the distribution or provide a compatible python3 on PATH. No pip packages are required. The interpreter path is printed; configure it with cockpit_mcp.py in your MCP client. The installer does not start or register the bridge or store MCP login credentials.
