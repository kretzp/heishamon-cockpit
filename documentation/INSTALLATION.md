# Build and installation

Use the platform guide for a complete source build and interactive installation:

- [Windows x64](WINDOWS-INSTALL.md)
- [Linux x64](LINUX-INSTALL.md)
- [Raspberry Pi ARM64](RASPBERRY-PI-INSTALL.md)

## Download and install current source

The first method in each platform guide downloads a standalone bootstrap script: `installation/bootstrap-windows.ps1`, `installation/bootstrap-linux.sh` or `installation/bootstrap-raspberry-pi.sh`. It clones the current GitHub `master` branch into a fresh directory, then uses the existing source installer to build the package and run interactive setup. Git is required before starting. No existing checkout or installation is overwritten, and the application is started separately unless service installation is explicitly selected. The guides also retain installation from an existing checkout as Method 2.

## Package build

The build restores locked dependencies, compiles the frontend, publishes a self-contained .NET application and produces a tar.gz archive. Supported runtime identifiers are win-x64, linux-x64 and linux-arm64.

On Windows, run packaging/build.ps1 -Runtime win-x64 from the project root. On Linux, run sh packaging/build.sh linux-x64; use linux-arm64 for ARM64. The build bootstraps the pinned Node.js and .NET SDK versions into .cache/build-tools. NuGet caches default to .cache/nuget; explicit cache environment variables are respected. An existing output archive is not overwritten.

## Install a package

Extract the archive on the matching target. Run install.ps1 on Windows or sh install.sh on Linux from the extracted package. Their source files live in installation/. Supply a new absolute installation directory if needed. Existing destinations are never overwritten. Run as the account that will run the application.

Setup asks for the administrator, MQTT address and credentials, port (1883), TLS choice (no), HeishaMon topic base (panasonic_heat_pump), web port (5080) and control opt-in (no). Password input is hidden. Setup creates fresh SQLite accounts, encrypted broker settings and a self-signed HTTPS certificate. It starts the application and connects to the broker only if service installation is explicitly selected at the final prompt. Failed setup preserves the destination for inspection.

All yes/no questions accept `yes`/`y` and `no`/`n`, case-insensitively and with surrounding whitespace ignored (`ja`/`j` and `nein` are also accepted). Enter keeps the default **no**. An invalid answer produces a message and repeats the same question until a valid answer is given. A valid no to a mandatory control confirmation still refuses control setup; an ended input stream does not imply consent.

## Prerequisites and operation

Version **0.9.1** adds a final optional service prompt, default **no**, to all installation routes. With yes, automatic startup is registered and the application starts immediately and connects to MQTT. Windows uses checksum-pinned WinSW as LocalService; Linux/Pi use a systemd system service under the installing user's UID/GID. For an existing service, choose Abort (`a/A`), Delete and reinstall (`d/D`), or Start (`s/S`); invalid input repeats the question. Enter defaults to Abort. See [service commands, logs, removal and verification scope](SERVICE.md).

The source installers verify Python 3.10+ with SSL for MCP. Windows installs missing Python with WinGet for the current user; Linux and Pi use apt where available. Extracted package installers do not install Python or native system prerequisites. Configure the MCP client separately.

Installed HTTPS instances listen on IPv4 interfaces and require login. The certificate includes current IPv4 addresses at setup time; verify its fingerprint on each client. Changed addresses can require a replacement certificate. Firewall rules and certificate trust are configured separately.

Configuration and databases reside in the installation's data directory by default. Preserve the entire data directory, including encryption keys, when managing updates or backups. The fresh-install scripts do not upgrade existing installations. Service installation with automatic startup is optional (default no); backup jobs are not created. See [compatibility](COMPATIBILITY.md) for the tested target scope.
