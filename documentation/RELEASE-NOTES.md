# Release notes

## Initial version

- HeishaMon MQTT monitoring, SQLite history, charts and CSV export.
- COP overview and history using HeishaMon Extra power readings. Individual valid history points remain visible across gaps.
- Administrator, reader and reader/writer accounts.
- Administrator configuration of users, broker connection and topic base.
- Explicitly confirmed heat-pump commands and control-mode switching without restarting the application.
- Authenticated MCP stdio bridge.
- Windows x64, Linux x64 and Raspberry Pi ARM64 source installers.
- English, German, French, Spanish, Italian and Portuguese interface languages.

Known platform and device limits are documented in [compatibility](COMPATIBILITY.md) and [supported devices](SUPPORTED-DEVICES.md). Services, automatic startup, firewall rules, certificate trust and backup jobs are not installed automatically. Existing installations are not upgraded by the fresh-install scripts.
