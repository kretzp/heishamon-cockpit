# Overview cards

Choose **Overview → Arrange tiles** to show the visibility checkboxes for the
upper readings and system-status cards. Select or clear a checkbox to show or
hide a card. Drag visible cards or use their keyboard controls to change order.
Visibility and ordering are saved in the current browser, not shared between
devices. Existing order preferences are preserved when enabling new cards.
Hiding a card does not disable its MQTT subscription or history recording.

The following temperature cards are available from version 1.0.5 and start hidden:

| Card | HeishaMon identifier | Topic below the configured MQTT prefix |
| --- | --- | --- |
| Flow target temperature | TOP7 | `main/Main_Target_Temp` |
| Outdoor unit pipe temperature | TOP21 | `main/Outside_Pipe_Temp` |
| Evaporator outlet temperature | TOP53 | `main/Eva_Outlet_Temp` |
| Compressor discharge temperature | TOP50 | `main/Discharge_Temp` |

These are read-only measurements in degrees Celsius. Opening a temperature
card uses the existing measurement chart, time ranges and CSV export. Enable a
hidden card before opening its chart. Only values received and recorded after collection
started are available; adding a measurement does not backfill earlier history.
Missing or invalid values remain unavailable, and historical charts preserve
quality gaps instead of inventing readings. Simulator mode supplies sample values
for the additional measurements without connecting to a heat pump.
