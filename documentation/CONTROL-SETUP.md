# Heat-pump control configuration

The installed default remains read-only. An authenticated administrator can open **Settings → Control & relays → Heat-pump control**, review the automatically detected **Device profile**, select **Enable control**, and explicitly confirm the device and installation match, that other writers have been checked, and, for MQTT, that the configured broker account may be used for writing. MQTT credentials must already be configured. The selection is stored locally and takes effect without restarting. Saving it does not send a device command.

Enabling or disabling control takes effect when the change is saved. Deactivation waits for any publish already in progress to finish; no new publish may start after deactivation is confirmed. A command already sent cannot be recalled. Reactivation is rejected while a previous command is still being resolved or cancelled; wait until it finishes. Activation and deactivation are not device commands and do not restore previous heat-pump values.

Initial installation also supports anonymous MQTT control after the operator explicitly accepts the security risks and use at their own risk, confirms the device profile and checks other controllers. This consent is stored separately and defaults to false for existing configurations. Declining consent finishes installation read-only. The web interface still requires broker credentials to enable control; it can disable an anonymously authorized installation. See the [installer's exact risk question](LINUX-INSTALL.md#setup-prompts).

The saved confirmation is bound to the source, broker host, port, TLS mode and HeishaMon topic base. If these do not match at startup, the application remains read-only and the administrator must review and confirm again. While real MQTT control is active, broker settings are locked; turn control off before changing them. Configuration managed by legacy startup flags cannot be changed from this screen.

The device profile is a read-only model display, also visible in read-only mode. It uses HeishaMon TOP92 (`<topic base>/main/Heat_Pump_Model`) and the bundled upstream model table. Known identifiers display the Panasonic indoor/outdoor model names; unknown identifiers display their raw value. Before TOP92 arrives, Cockpit shows a waiting message instead of assuming an L-series device. Older firmware numeric model IDs are also recognized. The application header uses the same detected model.

Control is no longer restricted to selecting the former fixed L-series profile. The internal setup token is now `aquarea-heishamon`; existing `aquarea-l-wh-wdg` setups still load and are migrated when saved again. Model identification, including an unknown or missing identifier, does not enable control or certify compatibility. All existing confirmation checkboxes remain required. Checking them alone does not activate control: select **Enable control**, complete the confirmations and click **Save control settings**. See [SUPPORTED-DEVICES.md](SUPPORTED-DEVICES.md) for source evidence and unresolved compatibility questions. Firmware and individual commands are not automatically verified or restricted by the profile. In a simulator, an enabled configuration selects the normal control-capable scenario. Commands remain subject to server-side role checks, freshness and mode guards, audit, per-command confirmation and readback. MQTT acknowledgement or a matching observation does not prove that the heat pump executed a particular command. Account access and broker connection alone do not grant permission to change a real installation.


## Relay switching

The two HeishaMon relay switches additionally require the separately saved
**Enable Relay Switching** checkbox under **Settings**. It is unchecked by
default. Relay toggles are direct manual commands with matching-state feedback,
without the per-command confirmation dialog used for heat-pump controls. Only
writer/admin accounts can operate them when device control is enabled. See
[relay setup and operation](RELAYS.md) for card metadata, on/off diagrams,
MQTT topics and troubleshooting.
