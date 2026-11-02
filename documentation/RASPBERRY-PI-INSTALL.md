# Raspberry Pi installation from source

This installer targets **64-bit Raspberry Pi OS on ARM64**. The 32-bit operating system is not supported. The tested hardware is a Raspberry Pi 5 with Debian 12 ARM64; Raspberry Pi OS specifically has not been independently verified. A working internet connection is required for build tools and npm and NuGet dependencies.

## Method 1: Download, clone, build and install

Open an interactive terminal on the Pi as the user who will run the application. Install the download and clone prerequisites:

```sh
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
```

Download the Raspberry Pi bootstrap script:

```sh
curl --fail --location --proto '=https' --tlsv1.2 \
  https://raw.githubusercontent.com/kretzp/heishamon-cockpit/master/installation/bootstrap-raspberry-pi.sh \
  -o "$HOME/heishamon-bootstrap-raspberry-pi.sh"
```

Review the file, then run it without `sudo`:

```sh
sh "$HOME/heishamon-bootstrap-raspberry-pi.sh"
```

The script checks ARM64 and a 64-bit userspace, clones the current GitHub `master` branch into a new `$HOME/heishamon-cockpit-source.<unique-id>` directory and runs `installation/install-raspberry-pi.sh` from the clone. That entry point builds the ARM64 package and starts interactive setup. Missing build prerequisites may require `sudo`. Source, build tools and package artifacts remain in the clone, including after a failure. Each invocation uses a fresh clone; existing checkouts and installations are not overwritten.

To choose a new installation directory:

```sh
sh "$HOME/heishamon-bootstrap-raspberry-pi.sh" "$HOME/.local/share/heishamon-cockpit-manual"
```

The path must be absolute and must not already exist. Download the script to a file rather than piping it into `sh`, so the terminal remains available for setup answers. Continue with the prompts and application startup below. The application remains stopped unless you explicitly choose service installation at the final prompt; choosing yes starts it and connects to MQTT.

## Method 2: Install from an existing source checkout

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

Yes/no questions accept `yes`/`y` and `no`/`n` regardless of case; Enter defaults to no. Invalid answers display a message and repeat the same question.

Enter a new administrator username and password of at least 12 characters. Enter the MQTT broker address, port (default `1883`), HeishaMon topic base (default `panasonic_heat_pump`), TLS choice (default `no`), and broker credentials if required. The topic base must not include `/main/`, `/extra/`, a trailing slash or wildcards. Passwords are entered without echo.

Choose the web interface port (default `5080`) and whether to allow heat-pump control (default `no`, read-only). Enabling control requires broker credentials and explicit confirmation of the device profile, installation and other controllers. Setup creates an empty SQLite account database and a self-signed HTTPS certificate. It starts the application and connects to the broker only if you choose service installation at the final prompt.

## Optional service installation

At the final automatic-service prompt, **Enter means no**. Choosing yes uses `sudo` to install **heishamon-cockpit.service**, enables it at boot and starts it immediately, opening the MQTT connection. A running systemd system manager is required. Run setup as the normal application user; the service keeps that user's UID/GID. For an existing service, choose Abort (`a/A`), Delete and reinstall (`d/D`), or Start (`s/S`); invalid input repeats the question. Enter defaults to Abort. Failure preserves the application for manual startup.

Use `systemctl status heishamon-cockpit.service`, `sudo systemctl start heishamon-cockpit.service`, `sudo systemctl stop heishamon-cockpit.service` and `sudo journalctl -u heishamon-cockpit.service -f`. For removal, run `sudo systemctl disable --now heishamon-cockpit.service`, remove `/etc/systemd/system/heishamon-cockpit.service` with sudo, then run `sudo systemctl daemon-reload`. Application files/data remain. See [service setup and diagnostics](SERVICE.md) for details and limitations, including home-directory availability at boot.

## Start and check

If service installation was selected, the application is already running. Use the service commands below instead of starting a second instance. Otherwise start it manually:

```sh
cd "$HOME/.local/share/heishamon-cockpit"
./Cockpit.Web
```

If you chose a different directory, or the installer selected `~/heishamon-cockpit`, use that directory instead. The application now connects to the configured broker. Open `https://<raspberry-pi-ip>:5080/` from a browser, substituting the Pi's address and the selected port. Use `hostname -I` on the Pi to find its current addresses. Sign in as the administrator and check the connection and readings. Stop the application with `Ctrl+C`.

The installed application listens on all IPv4 interfaces and requires HTTPS and login. Allow the port through the firewall for the clients you intend to use. The certificate is self-signed and contains the Pi's IPv4 addresses at installation time. Verify its fingerprint through a trusted channel before trusting it on a client. A later IP address change can require a suitable replacement certificate.

To check the application without contacting the configured broker, use `Source=simulator ./Cockpit.Web`. Simulator values are not measurements from the installation. Before enabling physical control, review [CONTROL-SETUP.md](CONTROL-SETUP.md) and [SUPPORTED-DEVICES.md](SUPPORTED-DEVICES.md), and verify the device, firmware and other controllers.

A systemd service with automatic startup is optional (default no). Firewall rules, certificate trust and backup jobs are not configured. To restrict future starts to the Pi itself, set `Access:ListenAddress` to `localhost` in the local configuration. Non-loopback access requires HTTPS and login.

## MCP Python prerequisite

The source installer verifies Python 3.10+ with SSL and the required standard-library modules. If Python is missing or unusable, it installs the distribution Python package using apt and sudo and verifies it again. If the distribution cannot provide Python 3.10+, upgrade the distribution or provide a compatible python3 on PATH. No pip packages are required. The interpreter path is printed; configure it with cockpit_mcp.py in your MCP client. The installer does not start or register the bridge or store MCP login credentials.
