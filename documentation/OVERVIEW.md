# Overview cards

Choose **Overview → Arrange tiles** to show the visibility checkboxes for the
upper readings, system measurements and the five lower operating-state cards. Select or clear a checkbox to show or
hide a card. Drag visible cards or use their keyboard controls to change order.
Visibility and ordering are saved in the current browser, not shared between
devices. Existing order preferences are preserved when enabling new cards.
Hiding a card does not disable its MQTT subscription or history recording.

The following temperature cards are available from version 1.0.5 and start hidden:

| Card | HeishaMon identifier | Topic below the configured MQTT prefix |
| --- | --- | --- |
| Outdoor unit pipe temperature | TOP21 | `main/Outside_Pipe_Temp` |
| Evaporator outlet temperature | TOP53 | `main/Eva_Outlet_Temp` |
| Compressor discharge temperature | TOP50 | `main/Discharge_Temp` |

These are read-only measurements in degrees Celsius, displayed with two decimal places in cards, chart tooltips and axes. Opening a temperature
card uses the existing measurement chart, time ranges and CSV export. Enable a
hidden card before opening its chart. Only values received and recorded after collection
started are available; adding a measurement does not backfill earlier history.
Missing or invalid values remain unavailable, and historical charts preserve
quality gaps instead of inventing readings. Simulator mode supplies sample values
for the additional measurements without connecting to a heat pump.

## Actual and target temperatures

The **Flow / Target** and **Hot water / Target** cards show both readings. The
flow target uses TOP7 (`main/Main_Target_Temp`); there is no separate flow-target
card. Clicking either combined card opens actual and target curves with a shared
legend and time range. Actual values use a solid line and targets a dashed line
in a different color. CSV export and the original-value table include both
measurements. Missing or invalid targets remain gaps; they are not replaced by
actual readings. The German headings are **Vorlauf / Soll** and **Warmwasser / Soll**.

The **Spread / Target** card combines the measured flow/return spread with the
existing heating delta TOP23 (`main/Heat_Delta`) in kelvins, with two decimal
places. Its chart, table and CSV contain both readings. Its German heading is
**Spreizung / Soll**. The indoor card is labelled **Indoor / Target** (**Innen / Soll**)
and retains its separately configured room and target temperature sources.

In Arrange tiles, the **Visible operating states** group sits directly above the
lower heat pump, heater, heating control, quiet mode and error-status cards.
Each has its own visibility checkbox; the choice persists after reloading.
