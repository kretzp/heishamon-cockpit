# Supported devices and control requirements

## Automatic model identification

Cockpit reads HeishaMon TOP92 (`main/Heat_Pump_Model`) and displays the detected model under **Settings → Control & relays → Device profile**, replacing the manual dropdown. The same model appears in the application header. TOP92 is optional, so older devices or brokers without this topic can still provide telemetry. A retained identifier is usable for identification; it never establishes fresh telemetry for command guards.

The bundled mapping contains the model facts (IDs 0–90) from [HeishaMon HeatPumpType.md at ad7804e](https://github.com/heishamon/HeishaMon/blob/ad7804eb02779f48ed8bf397861474ce608d8bbb/HeatPumpType.md), retrieved on 15 November 2026. HeishaMon derives the hexadecimal identifier from normal telegram bytes 129–138. Cockpit accepts whitespace/case variations and legacy numeric IDs. Unknown identifiers are displayed unchanged after trimming outer whitespace. Missing or invalid payloads show a waiting message; no L-series fallback is assumed. To update the mapping, review the upstream table and update `src/Cockpit.Domain/HeatPumpModels.cs` with its source revision, retaining existing IDs and tests.

For example, `E2 D5 0B 08 95 02 D6 0E 66 95` identifies **WH-SDC0309K3E5 / WH-UDZ05KE5** (K series), fixing [issue #12](https://github.com/kretzp/heishamon-cockpit/issues/12). `E2 D5 0B 34 99 83 92 0C 27 98` identifies **WH-SDC0509L3E5 / WH-WDG05LE5**. Monoblocks display their outdoor model once.

This is model identification, not an individual serial number. Upstream describes uniqueness of these bytes as an assumption. The mapping does not verify wiring, configuration, firmware or individual command compatibility.

In addition to the upstream table, the operator supplied IDs 91–95 on 18 November 2026. ID 91 assigns a numeric ID to the exact signature previously confirmed locally on 15 November 2026. Existing IDs remain unchanged. Other unlisted revision variants continue to display their raw identifiers.

| ID | Bytes 129–138 | IDU | ODU | KIT | Power (kW) | Phases | Type |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 91 | E2 D5 0B 34 99 83 92 0D 27 98 | WH-SDC0509L3E5 | WH-WDG05LE5 | KIT-WC05L3E5 | 5 | 1ph | HP - split L-series 3kW elec heating - revised model |
| 92 | 12 D7 0E 85 11 39 94 0F 85 10 | Monoblock | WH-WXG16ME8 | Monoblock | 16 | 3ph | T-CAP |
| 93 | E2 D5 0D 15 95 43 D6 0E 72 95 | WH-SXC12K9E8 | WH-UXZ12KE8 | KIT-WXC12K9E8 | 12 | 3ph | T-CAP - split K-series R32 |
| 94 | E2 D5 0C 29 99 83 92 0D 29 98 | WH-ADC0509L3E5 | WH-WDG09LE5 | KIT-ADC09L3E5 | 9 | 1ph | HP - All-In-One L-series - revised model |
| 95 | E2 D5 0D 08 95 02 D6 10 67 95 | WH-SDC0309K3E5 | WH-UDZ07KE5 | KIT-WC07K3E5 | 7 | 1ph | HP - split K-series 3kW elec heating |

## Control requirements

The original command ranges were derived from documentation for the Panasonic WH-SDC0509L3E5 indoor unit and WH-WDG05LE5 outdoor unit. Control can now be explicitly enabled for other HeishaMon-connected Aquarea models using the existing confirmation checkboxes; the detected model is informational and does not alter command ranges. Review the installed device and command semantics before enabling control.

The [Panasonic operating instructions](https://tda.panasonic-europe-service.com/docs/2z69138055z3z42947z656ez706466z27za0e6e6ecec90670b69c9d765c1afb44ea3a0a7d1/tsn3/data/ALL/WHSDC0509L3E5/OI/998713/WEB-ACXF55-36270-EN.pdf) describe heating-curve settings for this family. Operating limits also depend on outside temperature and installation conditions. Model detection cannot establish that every allowed value is safe for a particular installation.

The [HeishaMon v4.2.3 MQTT topic documentation](https://github.com/heishamon/HeishaMon/blob/v4.2.3/MQTT-Topics.md) lists sterilization temperature and duration settings as experimental. They are absent from the v4.2.0 topic documentation. The firmware currently installed at a site must be checked separately. The application does not detect firmware compatibility or block these settings on older firmware.

The same HeishaMon documentation describes the zone 1 heat request temperature as -5 to 5 or 20 to max, depending on its context. The application also permits room targets from 16 to 19 °C in the relevant room-sensor mode. The sources reviewed do not resolve whether these descriptions refer to the same mode and value. Do not use values below 20 °C until the installed configuration and command semantics have been independently verified. The application does not enforce that restriction.

Check the installed firmware, sensor mode, operating limits, all other writers and the consequences of an individual command before any physical test. A separate operator decision is required for each real-world test. Broker acknowledgements and matching observations are not proof that a specific command was executed.
