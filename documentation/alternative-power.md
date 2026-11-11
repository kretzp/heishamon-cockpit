# Alternative electrical power measurements

Administrators can enable two external power measurements in **Settings → Plant
& data storage → Alternative power measurements**. Both sources use the configured
MQTT broker and must report **watts**. Saving applies the change immediately and
reconnects the read-only MQTT subscription when its configuration changes.

| Measurement | Example topic | Payload path |
| --- | --- | --- |
| Heat pump, channel C | `waermepumpe/events/rpc` | `$.params["em:0"].c_act_power` |
| Immersion heater, channel A | `waermepumpe/events/rpc` | `$.params["em:0"].a_act_power` |

This example reflects the reference installation. Verify topic and physical channel
assignment for each installation.

An empty payload path reads a JSON number directly, such as `850`. Supported paths
include `$`, object properties (`$.power`), quoted property names (`$["em:0"]`) and
array indices (`$.meters[0].power`). Filters, scripts, recursive searches and
wildcards are unsupported. MQTT topics must be exact; `+` and `#` are rejected.
Numeric strings, negative or non-finite numbers and invalid JSON are not valid readings.

## COP and dashboard

The heating and hot-water COP history uses:

`COP = HeishaMon Extra thermal power / (heat-pump electrical power + heater electrical power)`

Daily energy also integrates the sum of these electrical measurements during
periods recorded with the alternative source enabled. The existing **COP ·
HeishaMon** tile and its individual history continue to use HeishaMon Extra.
The two additional plant-status tiles support sorting, history and export.
Disabling the feature hides them while retaining their configuration and recorded
history until normal retention expires.

Alternative COP requires valid readings for both electrical channels and the
corresponding thermal power. Readings may be at most 120 seconds old; electrical
and thermal readings must be within 60 seconds by default. The default minimum
electrical power is 200 W. Retained messages are excluded from COP. Missing or
invalid readings are neither treated as zero nor replaced by HeishaMon readings.
An explicitly reported `0` is valid.

Partial messages update only the included channels; each channel retains its own
receipt timestamp. External measurement quality depends on broker connectivity
and age, independently of HeishaMon LWT. COP additionally requires valid plant
states. Existing exclusions for defrost, active internal heater, stopped compressor
and incompatible operating modes remain in force. The thermal measurement boundary
has not been validated for a total COP including an active immersion heater.

The selected source and configuration generation are recorded with measurements.
Historical periods retain their original source; existing history without source
markers uses HeishaMon Extra. Source and configuration changes break COP intervals
and moving-average windows. Mixed-source periods are identified in the chart.

Heating and hot water are aggregated separately, including partially measured
buckets. Partial buckets appear as isolated points with measured/expected duration;
lines and trends do not bridge them. Missing buckets remain visible in the table.
Moving averages restart after gaps, mode changes and source-generation changes.
The API provides per-mode `series`; the legacy `points` field remains available.

## Daily energy and imported Shelly history

The calendar identifies the electrical source actually used. Alternative energy
sums both channels independently of HeishaMon plant state and thermal power.
Explicit zero readings are recorded. CSV exports include each channel's energy and
valid duration; tooltips show the individual channel energies. The total includes
only intervals where both channels are valid and paired, so channel totals may
not add up to the combined total when their coverage differs.

New alternative measurements are integrated at the configured recording interval.
Only adjacent samples with the same source and configuration generation are paired.
Both interval ends must be valid, with a freshness limit of 120 seconds. Missing
intervals are not extrapolated. Periods recorded with the feature disabled retain
the existing HeishaMon Extra calculation.

An imported `ShellySamples` table is read at its original resolution, using the
legacy calculation: channel C for the heat pump, channel A for the heater, at most
20 seconds between samples and for reading age, and at most 10 seconds between
channels. Daily boundaries use Europe/Berlin, including 23- and 25-hour DST days.
Original Shelly data takes precedence during its recorded period; converted
30-second readings are not counted again. Subsequent periods can use newly recorded
alternative measurements. Shelly gaps are not replaced by HeishaMon values.

Installation-specific migration scripts, tests and production records are maintained
in the separate Wärmepumpe repository under `deploy/pi/heishamon-migration/`.
They are not part of this application's installation workflow.

## Verification

Coverage includes `AlternativePowerTests`, `ExtraCopTests`, `EfficiencyTests`,
`DailyMeterEnergyTests`, `AppSettingsTests`, chart tests and dashboard E2E tests.
E2E tests use the loopback simulator with device control disabled. The feature adds
no dependencies and requires no application database migration.
