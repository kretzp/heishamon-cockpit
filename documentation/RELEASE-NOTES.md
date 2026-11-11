# Release notes

## 0.9.3 — Container deployment, 2026-11-12

- Add a Dockerfile and Compose configuration for Docker and Podman, with an
  unprivileged runtime user and persistent installation data.
- Keep image builds non-interactive. Configure accounts, HTTPS certificates and
  MQTT settings afterwards through the existing interactive installation setup;
  credentials are stored in the data volume rather than the image.
- Update the pinned .NET SDK and installer build tooling to 10.0.404.
- Add a Linux x64 Docker CI job for relevant pull requests and pushes to `master`.
  Its isolated, read-only simulator checks frontend assets, health endpoints,
  the unprivileged user and recorded history across container recreation.
  The initial GitHub Actions run passed; Podman execution remains unverified.
- See [container installation and operation](CONTAINERS.md) for setup, storage
  and network access instructions.

## 0.9.2 — COP mode separation, 2026-11-11

- Preserve separate heating and hot-water COP measurements in partially covered buckets.
- Show partial measurements as isolated points with coverage; keep missing intervals
  visible in the value table and avoid connecting gaps or mixing operating modes.
- Update version metadata and all affected package lockfiles for supported installers.
- Keep installation-specific migration tooling and records in the separate legacy
  Wärmepumpe repository rather than distributing them with the application.

## 0.9.1 — Alternative power measurements, 2026-11-11

- Configure two external MQTT electrical power channels for heat pump and heater.
- Apply source changes without an application restart and preserve configuration
  while the feature is disabled.
- Record source selection and configuration generations for historical COP and energy.
- Use original imported Shelly samples for daily energy without double-counting
  converted samples; preserve measured zero, missing intervals and per-channel coverage.
- Add dashboard tiles, source labels, CSV fields and translated settings.
- See [alternative power measurements](alternative-power.md) for configuration and limits.

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
