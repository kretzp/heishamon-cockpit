# Relay switching and status history

Cockpit can display and manually switch the two HeishaMon relays. The topic
behavior was tested with **HeishaMon v4.3.1 on the ESP32 large board**. Cockpit
does not automatically detect the board or relay firmware support.

## Enable the cards

1. Sign in as an **Administrator** and open **Settings** (**Einstellungen**).
2. Under **System & Data storage** (**Anlage & Datenspeicherung**), check
   **Enable Relay Switching**
   (**Relaisschaltung aktivieren**) and click **Save settings**
   (**Einstellungen speichern**).
3. Open **Overview** (**Übersicht**). **Relay 1** and **Relay 2** appear as
   individual large cards in **Anlagenstatus**, alongside cards such as
   **Verdichter**. They can be rearranged within this group.

The checkbox is **unchecked by default**. Saving it takes effect without a
restart and sends no relay command. Unchecking and saving hides both cards and
disables relay commands without changing either physical relay. The setting is
shared by the installation, rather than being a browser-only preference.

## Use the toggle switches

To operate a relay, sign in as **Reader + Writer** or **Administrator**. The
existing **Settings → Heat-pump control** permission must also be enabled; see
[control setup](CONTROL-SETUP.md). Enabling the relay checkbox alone does not
grant device-control permission. Readers can view enabled cards and their
history but cannot switch them.

Click the toggle on the corresponding card to request on or off. **The toggle
itself sends the command directly; there is no additional confirmation dialog.**
Click elsewhere on the card to open its diagram instead.

Each switch follows the last reported state, not an optimistic prediction.
While waiting for feedback, the card displays **Switching…**
(**Wird geschaltet …**) and disables that switch. The other relay remains
independently usable. A matching new state confirms the displayed position.

If no matching feedback arrives within three seconds, or the request fails, the
card displays **Change not confirmed** (**Änderung nicht bestätigt**). Cockpit
does not automatically retry. Check the reported state and connection before
trying again; missing confirmation does not prove the physical relay stayed
unchanged. Matching telemetry also does not identify which MQTT writer caused a
change.

The switches are disabled for readers, unknown or invalid states, disconnected
connections, offline devices, inactive device control, and while arranging cards.
After reconnecting, the server requires a new relay state receipt before it will
send another command. A retained state can initialize a switch and be used as
its known starting state.

## Read the card metadata and diagram

Each card uses the standard System Status metadata: quality, receipt time,
relative message age and the retained-message indication when applicable. For
example, **Received 12:00:00 · 5 s ago** refers to an actual state message.
Sending a command does not refresh this timestamp.

HeishaMon reports relay changes rather than continuously repeating the same
state. An old receipt time alone therefore does not make a live relay state
expire. Retained messages remain visibly marked as historical; during a
connection outage the last reported state is shown as stale.

Click either card outside its toggle to open the **On/Off** (**Ein/Aus**)
timeline, using the same diagram style as **Heizstab**. Choose a period, refresh
the history, or expand the original-values table to see **Off (0)** / **On (1)**.
The normal chart and CSV export controls are available.

History uses the configured sampling interval, normally **30 seconds**. Shorter
changes can be missed, just as with the Heizstab diagram. Missing, invalid,
stale and retained-only readings remain gaps; Cockpit does not reconstruct
unrecorded transitions. Initial retained state alone does not create valid
history: recording needs a live state change. Once a valid live state has
arrived, it is sampled until the state or connection changes. Hiding the relay
cards does not stop their telemetry subscriptions or history recording.

## MQTT topics and troubleshooting

`<base>` is the configured **HeishaMon topic base**:

| Relay | Command topic | State topic |
| --- | --- | --- |
| Relay 1 | `<base>/gpio/relay/one` | `<base>/gpio/relay/one/state` |
| Relay 2 | `<base>/gpio/relay/two` | `<base>/gpio/relay/two/state` |

Commands contain exactly `1` (on) or `0` (off), use QoS 0 and are **not retained**.
The broker account needs publish permission on the command topics and subscribe
permission on the state topics. HeishaMon publishes changed state as retained
`0` or `1`; a live delivery of that publication can confirm a command.

Sending the current value again does not produce another state message on the
tested firmware. Cockpit avoids sending unchanged values. The observed 6–25 ms
feedback in the original device test is not a guaranteed response time.

If the cards are missing, check the saved checkbox. If a switch is disabled,
check your role, device-control permission, connections and received relay state.
If the diagram is empty, select a period with recorded valid relay states and
allow time for the next history sample.

The feature requires **no database schema migration**. Its checkbox is persisted
in the existing settings JSON and defaults to false for older installations.
Docker updates retain it with the existing `/data` volume; see the
[container update instructions](CONTAINERS.md#updating-an-existing-installation-without-losing-data).
