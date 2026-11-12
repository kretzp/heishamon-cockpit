# Heat-pump control configuration

The installed default remains read-only. An authenticated administrator can open **Settings → Control & relays → Heat-pump control**, select the supported `aquarea-l-wh-wdg` profile, and explicitly confirm the device and installation match, that other writers have been checked, and, for MQTT, that the configured broker account may be used for writing. MQTT credentials must already be configured. The selection is stored locally and takes effect without restarting. Saving it does not send a device command.

Enabling or disabling control takes effect when the change is saved. Deactivation waits for any publish already in progress to finish; no new publish may start after deactivation is confirmed. A command already sent cannot be recalled. Reactivation is rejected while a previous command is still being resolved or cancelled; wait until it finishes. Activation and deactivation are not device commands and do not restore previous heat-pump values.

The saved confirmation is bound to the source, broker host, port, TLS mode and HeishaMon topic base. If these do not match at startup, the application remains read-only and the administrator must review and confirm again. While real MQTT control is active, broker settings are locked; turn control off before changing them. Configuration managed by legacy startup flags cannot be changed from this screen.

The profile is based on the Panasonic WH-SDC0509L3E5 indoor unit and WH-WDG05LE5 outdoor unit; it does not imply support for other devices. See [SUPPORTED-DEVICES.md](SUPPORTED-DEVICES.md) for source evidence and unresolved compatibility questions. Firmware and individual commands are not automatically verified or restricted by the profile. In a simulator, an enabled configuration selects the normal control-capable scenario. Commands remain subject to server-side role checks, freshness and mode guards, audit, per-command confirmation and readback. MQTT acknowledgement or a matching observation does not prove that the heat pump executed a particular command. Account access and broker connection alone do not grant permission to change a real installation.


## Relay switching

The two HeishaMon relay switches additionally require the separately saved
**Enable Relay Switching** checkbox under **Settings**. It is unchecked by
default. Relay toggles are direct manual commands with matching-state feedback,
without the per-command confirmation dialog used for heat-pump controls. Only
writer/admin accounts can operate them when device control is enabled. See
[relay setup and operation](RELAYS.md) for card metadata, on/off diagrams,
MQTT topics and troubleshooting.
