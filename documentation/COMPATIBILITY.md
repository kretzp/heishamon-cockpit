# Compatibility

| Platform | Installation target | Verification scope |
| --- | --- | --- |
| Windows x64 | 64-bit PowerShell, Windows tar.exe | Source build, interactive setup, HTTPS login and simulator operation tested |
| Linux x64 | Compatible 64-bit Linux; apt-based prerequisite installation where available | Linux Mint 22.3 x64 installation, HTTPS, simulator control and isolated MQTT tested |
| Raspberry Pi ARM64 | 64-bit ARM Linux | Raspberry Pi 5 with Debian 12 ARM64: native build, installation, HTTPS login and simulator tested |

Raspberry Pi OS specifically has not been independently verified. 32-bit Raspberry Pi systems, Windows ARM64 and macOS are not supported by these installers. Broader OS-version support is not established by these checks.

Python 3.10+ with SSL is required for MCP. Automatic Windows installation requires WinGet. The missing-Python Windows installation branch has been tested with a simulated package manager; an actual fresh Python installation remains a release-verification item.

MCP client registration and complete client workflows require validation with the chosen client. Device compatibility and command support depend on the heat pump, firmware and installation; see [supported devices](SUPPORTED-DEVICES.md).
