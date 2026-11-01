# User accounts

The installer creates the first administrator interactively. Accounts are stored in SQLite; passwords use PBKDF2-SHA256 with a random per-account salt and 600,000 iterations. Sessions expire after 30 minutes.

| Role | Read data | Confirm enabled device changes | Manage users and settings |
| --- | --- | --- | --- |
| Reader | Yes | No | No |
| Reader + Writer | Yes | Yes | No |
| Administrator | Yes | Yes | Yes |

In Settings, administrators create accounts, change roles, reset passwords and disable or re-enable users. At least one active administrator must remain. Saving an account invalidates its existing sessions, including your own session when editing your account.

Login is required for MQTT operation. Network access requires HTTPS and login. Changes are validated on the server, including role, session, CSRF and concurrent-edit checks. The MCP bridge uses the same accounts; MCP writing additionally requires its explicit opt-in and enabled server control.

The account database defaults to users.db beside the history database. Unix installations restrict access to the installing account; Windows installations restrict the installation directory through ACLs. Protect the containing directory and SQLite journal files. Do not commit credentials or databases.
