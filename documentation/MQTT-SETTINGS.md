# MQTT broker settings

An administrator can configure the broker host, port, HeishaMon topic base and TLS in Settings. The topic base is the exact prefix preceding HeishaMon's `/main/` and `/extra/` topics, with no trailing slash or wildcards. Credentials can be retained, replaced or removed. The API does not return the stored username or password. Settings are validated server-side and protected against concurrent edits with a revision. A saved setting reconnects the read-only MQTT source; the simulator does not connect to a broker.

When a real MQTT command mode is enabled, broker updates are rejected. Disable that mode before changing the broker; this prevents the reader and an existing writer from pointing at different installations. Changing the broker does not itself enable command modes. A successful save only confirms that the settings were stored; it does not establish that a broker is reachable, credentials work, or a heat pump has accepted a command.

MQTT settings, including credentials, are protected with ASP.NET Core Data Protection. The encrypted file and key ring reside in a dedicated service-private directory (`Mqtt:SecretDirectory`, by default `mqtt-secrets` beside the account database). On Unix-like systems a newly created directory is owner-only and a pre-existing directory granting group/other access is rejected. On Windows its inherited ACL must be restricted by the installer to the service identity and authorized administrators before use. Encryption does not protect secrets against an account that can read both the protected file and its keys. Deleting or losing the key ring makes the saved settings unreadable.

The installer asks for the initial broker settings and HeishaMon topic base. Administrators can change them later in Settings.
