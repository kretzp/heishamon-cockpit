# Build and installation

Use the platform guide for a complete source build and interactive installation:

- [Windows x64](WINDOWS-INSTALL.md)
- [Linux x64](LINUX-INSTALL.md)
- [Raspberry Pi ARM64](RASPBERRY-PI-INSTALL.md)

## Package build

The build restores locked dependencies, compiles the frontend, publishes a self-contained .NET application and produces a tar.gz archive. Supported runtime identifiers are win-x64, linux-x64 and linux-arm64.

On Windows, run packaging/build.ps1 -Runtime win-x64 from the project root. On Linux, run sh packaging/build.sh linux-x64; use linux-arm64 for ARM64. The build bootstraps the pinned Node.js and .NET SDK versions into .cache/build-tools. NuGet caches default to .cache/nuget; explicit cache environment variables are respected. An existing output archive is not overwritten.

## Install a package

Extract the archive on the matching target. Run install.ps1 on Windows or sh install.sh on Linux from the extracted package. Their source files live in installation/. Supply a new absolute installation directory if needed. Existing destinations are never overwritten. Run as the account that will run the application.

Setup asks for the administrator, MQTT address and credentials, port (1883), TLS choice (no), HeishaMon topic base (panasonic_heat_pump), web port (5080) and control opt-in (no). Password input is hidden. Setup creates fresh SQLite accounts, encrypted broker settings and a self-signed HTTPS certificate. It neither starts the application nor contacts the broker. Failed setup preserves the destination for inspection.

## Prerequisites and operation

The source installers verify Python 3.10+ with SSL for MCP. Windows installs missing Python with WinGet for the current user; Linux and Pi use apt where available. Extracted package installers do not install Python or native system prerequisites. Configure the MCP client separately.

Installed HTTPS instances listen on IPv4 interfaces and require login. The certificate includes current IPv4 addresses at setup time; verify its fingerprint on each client. Changed addresses can require a replacement certificate. Firewall rules and certificate trust are configured separately.

Configuration and databases reside in the installation's data directory by default. Preserve the entire data directory, including encryption keys, when managing updates or backups. The fresh-install scripts do not upgrade existing installations. Services, automatic startup and backup jobs are not created. See [compatibility](COMPATIBILITY.md) for the tested target scope.
