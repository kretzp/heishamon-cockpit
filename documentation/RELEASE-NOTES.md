# Release notes

## 1.0.4 — MQTT indoor temperature across views, 2026-11-23

- Move the MQTT house-temperature configuration from Configure model to the new
  Settings → Temperature data tab, preserving existing topics and payload paths.
- When enabled, use the MQTT reading as Indoor in temperature history, its CSV
  export, the overview tile and the tile's measurement chart, as well as the house drawing.
  Disabling restores the indoor-unit source. Saved changes apply without a restart.
- Preserve stale and retained readings in live displays. Missing or invalid MQTT
  readings remain unavailable without falling back to the indoor unit; historical
  charts retain their existing quality gaps. Original indoor telemetry remains available.
- Add desktop and mobile regression checks for source selection and the relocated
  administrator settings. No database migration is required.

## 1.0.3 — System model, MQTT room temperature and daily history, 2026-11-22

- Open measurement charts directly from the System model power overview,
  component status and measurement explorer, with the existing time ranges,
  chart settings and CSV export. Power charts follow heating, hot-water and
  cooling operation.
- Preserve measurement aliases and show the System model context in chart
  details. Explain that model identifiers have no measurement history.
- Simplify the chart header by removing the duplicate language selector.
- Align date fields and range actions in measurement charts and history.
- Refine the hydraulic diagram with straight supply and return connections,
  aligned home and heating circuits, and clearer pipe and label placement.
- Animate flow through floor heating and radiators in both heating circuits,
  through the hot-water tank coil and through the buffer. Route the hot-water
  supply into the lower-left tank connection and the return out of the upper-right
  connection. Move the buffer into the shared return immediately after the house,
  keeping the second heating-circuit supply clear of it.
- Show the reported flow target temperature (HeishaMon TOP7) above the supply
  pipe alongside the actual temperature. Display missing or invalid temperatures
  as `-`, while keeping stale and retained temperatures visible, including the
  last MQTT room temperature after a disconnect. Animation still requires fresh data.
- Add an optional MQTT room-temperature source under Configure model, with an
  exact topic and payload path using the configured broker. When enabled, it
  replaces the room temperature in the house drawing. Saving applies without
  restarting; disabling restores the indoor-unit reading. Existing installations
  default to disabled, and the original indoor telemetry remains unchanged.
- Add a daily-history completeness threshold under Installation & data storage,
  defaulting to 20 h and configurable from 1 to 24 h. Apply it immediately to past
  calendar days, status labels and CSV exports without changing recorded data or
  calculated energy. Preserve current/future/missing days and handle daylight-saving
  day lengths correctly.
- Show an active Sterilisation mode from fresh TOP69 status, including electric
  heating with the compressor stopped, and append the TOP70 sterilisation target
  after the normal hot-water target in the diagram and overview. Defrost and Off
  retain priority; stale status never announces an active cycle.
- Add an About page between Settings and Logout with direct repository,
  Discussions and Issues links, installed version and release notes in all six
  supported languages. Bundle the version-matched notes during the build and
  reject missing or outdated translations instead of showing stale release text.
- Extend desktop, mobile and language regression coverage for chart access,
  operating modes, diagram geometry, range-control alignment, MQTT temperature
  quality, retrospective daily completeness and localized About content.
- No database migration is required.

## 1.0.2 — Additional heat pump models, 2026-11-18

- Add model IDs 91–95, including the revised 5 kW L-series split,
  16 kW M-series T-CAP monoblock, 12 kW K-series T-CAP split,
  revised 9 kW L-series All-in-One and 7 kW K-series split.
- Assign ID 91 to the previously recognized local L-series signature while
  preserving existing model IDs and hexadecimal identification.
- Add matching housing profiles to the system model and hydraulic prototype and document
  the indoor/outdoor units, kit names, power ratings and phases.
- Extend regression coverage for numeric IDs, exact signatures and formatting
  variations. Unknown model revisions continue to display their raw identifiers.
- No database migration is required.

## 1.0.1 — Pump-speed circulation and mobile system model, 2026-11-17

- Determine circulation from valid, current pump speed instead of water flow.
  With the compressor stopped, positive rpm indicates Circulation and zero rpm
  indicates Standby. Unavailable or invalid pump speed leaves the activity Unknown;
  water flow is never used as a fallback.
- Drive pump rotation and water-flow animation tempo from pump speed. Keep water
  flow visible as a measurement, including when it disagrees with pump speed.
- Add an Off activity for a heat pump reporting `heatpumpState = 0`. Defrosting
  retains priority, and valid pump run-on remains animated while the unit is Off.
- Fit the complete system diagram to mobile and tablet widths without horizontal
  scrolling. Preserve the existing desktop diagram layout and sizing.
- Extend regression coverage for pump-speed quality, conflicting flow readings,
  Off activity, animation timing and complete mobile diagram visibility.
- Update the English System model guide. No database migration is required.
- Fix a timing race in the stale-session E2E regression: finish startup session
  reads before delaying access checks, so cancelled component requests cannot
  cause a timeout. Preserve the check that an older successful session response
  cannot restore access after a newer unauthorized response. This changes tests
  only; installed applications do not require another update.

## 1.0.0 — Animated Aquarea system model, 2026-11-15

- The animated system model was inspired by
  [heatpump-hydraulic-card](https://github.com/Sturmi77/heatpump-hydraulic-card)
  by [Sturmi77](https://github.com/Sturmi77).
- Make Anlagenmodell the initial view, ahead of Overview. Select proportionate
  outdoor and indoor housings automatically from all 91 legacy model IDs and
  the confirmed local L-series signature. Unknown models use a neutral drawing.
- Animate pumps, fans and pipe flow from valid live measurements, with distinct
  heating, cooling, hot-water, defrost, circulation and idle states. Keep rotor
  axes fixed during animation and telemetry updates.
- Save one or two heating circuits, floor heating/radiators, storage and display
  options per installation. Only administrators can edit them; saves require
  CSRF protection and a matching settings revision.
- Place component selectors beneath the animated desktop diagram and show
  their measurements in the wider status panel to its right. Increase the
  diagram size, labels and measurement text for better readability while
  preserving device proportions. Add a searchable measurement explorer and
  translations for all supported languages.
- Exclude local runtime data from published applications so development and
  preview JSON files cannot enter installation packages.
- Show flow temperature, return temperature, temperature difference and water
  pressure with exactly two decimal places throughout the System model view.

- Recognize the operator-confirmed signature `E2 D5 0B 34 99 83 92 0D 27 98`
  as **Panasonic WH-SDC0509L3E5 / WH-WDG05LE5**. Match this exact signature
  without assigning an unofficial numeric model ID or matching other unknown
  revisions. Existing model IDs, control permissions and history remain unchanged.

## 0.9.6 — Reliable setup and automatic model identification, 2026-11-15

- Fix [#10](https://github.com/kretzp/heishamon-cockpit/issues/10): initial
  installation with anonymous MQTT no longer aborts at control authorization.
  A separate question explains anonymous-access security risks and asks the
  operator to accept them and enable control at their own risk. `yes`/`y`
  permits control only after the device and conflicting-controller confirmations;
  `no`/`n` or Enter completes installation read-only. Declining a later control
  confirmation also continues read-only.
- Save anonymous-control consent explicitly and honor it in runtime control
  authorization. Existing configurations default this consent to false;
  anonymous broker access alone does not authorize control. Credentialed
  authorization and the credential requirements of bounded live tests remain
  in place.
- Validate the initial administrator password immediately. A password outside
  the 12–128-character range or a mismatched repeat triggers another prompt
  before continuing to MQTT configuration. End-of-input cancels setup.
- Document configuration-only retries with `./Cockpit.Web --setup-installation`
  on Linux/Pi or `.\Cockpit.Web.exe --setup-installation` on Windows. Unfinished
  initial setup can be repeated using the existing binary without rebuilding
  or opening an MQTT connection. Existing accounts and configuration are not
  overwritten; successful installations use the web Settings for changes.
- Fix [#12](https://github.com/kretzp/heishamon-cockpit/issues/12): identify the
  heat-pump model from HeishaMon TOP92 (`main/Heat_Pump_Model`) instead of
  displaying a fixed L-series model. Settings and the application header show
  the detected indoor/outdoor models. Unknown identifiers remain visible as
  raw values; missing or invalid identifiers do not fall back to an L-series
  model. Support hexadecimal identifiers and legacy numeric model IDs.
- Treat model identification as optional metadata. Missing TOP92 does not
  degrade measurement freshness or block other telemetry. Retained identifiers
  can identify a model but do not establish fresh measurements for commands;
  model identifiers are excluded from numeric history queries.
- Replace the manual L-series profile dropdown with the detected model and
  retain explicit control confirmations for HeishaMon-connected Aquarea models.
  Existing saved L-series control profiles remain compatible. Detection itself
  does not enable control, change command ranges, or verify firmware and
  individual command compatibility.
- Fix a race in the isolated MQTT heating-curve integration test. Wait for new
  receipts of unchanged fields as well as matching values before acknowledging
  each readback. Add a partial-readback regression and a per-step assertion;
  production control behavior and timeout limits are unchanged.
- Update release version metadata and regenerate the affected dependency
  lockfiles for Windows x64, Linux x64 and Linux ARM64. No database schema
  migration is required; existing history, accounts and broker settings remain
  compatible.

See [configuration retries](LINUX-INSTALL.md#repeat-configuration-without-rebuilding),
[control setup](CONTROL-SETUP.md) and [model identification and limits](SUPPORTED-DEVICES.md).

## 0.9.5 — Settings layout and usability, 2026-11-12

- Organize settings into five sections: system and data, MQTT connection,
  control and relays, power measurements, and users and access.
- Add consistent field labels, helper text, toggle switches, expandable account
  editors and save/discard actions for each section. Align broker host and port
  inputs even when only one field has helper text.
- Save each section independently while preserving unsaved drafts elsewhere.
  Detect conflicting remote changes when refreshing another section, retaining
  the existing server-side revision checks.
- Preserve role restrictions, MQTT editing locks and explicit control
  confirmations. Show the required retention-reduction confirmation in relay
  and power settings while a saved reduction is awaiting restart.
- Support desktop and mobile layouts, keyboard navigation, all three themes
  and all six interface languages. Update the feature guides for the new
  navigation and save actions.
- No database schema migration is required. Existing data, settings and control
  permissions are preserved.

## 0.9.4 — Relay switching and status history, 2026-11-12

- Add two optional relay cards to **Overview → Anlagenstatus**, using the large
  metric-card layout with relay icons, receipt time, message age, quality and
  retained-state metadata.
- Enable the cards through **Settings → Enable Relay Switching**. The setting is
  disabled by default and takes effect without restarting. Switching additionally
  requires a writer/admin account and enabled device control.
- Provide accessible toggle switches with a clear on/off position, theme-aware
  color, keyboard focus and a larger touch target. Toggle clicks send directly,
  without an additional confirmation dialog; clicking elsewhere opens history.
- Publish nonretained `0`/`1` commands to the HeishaMon relay topics. Wait for
  matching feedback, show pending and unconfirmed states, avoid unchanged-value
  commands, and never retry automatically. Reconnection and permission changes
  are checked before sending.
- Add Heizstab-style on/off history diagrams and state labels for both relays.
  Preserve gaps and reject mixed-state averages. History follows the configured
  sampling interval; retained-only readings do not establish valid history.
- Document relay setup, permissions, MQTT topics and troubleshooting, plus Docker
  update, full-data backup and rollback procedures. Refresh the README image.
- Relay topic behavior was tested with **HeishaMon v4.3.1 on the ESP32 large
  board**. Hardware/firmware support is not detected automatically. No history
  database schema migration is required; existing settings default relay
  switching to off.
- See [relay usage](RELAYS.md) and [container updates](CONTAINERS.md).

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
