# Docker and Podman

The root `Dockerfile` builds the React UI and .NET backend into a Linux image.
It runs as the .NET image's unprivileged `app` user. The host needs Docker with
Compose, or Podman with an installed Compose provider. Run commands from the
repository root. For Podman, replace `docker compose` with `podman compose`.

## First installation

```sh
docker compose build
docker compose run --rm cockpit --setup-installation
docker compose up -d
```

The setup command is interactive: use a terminal so passwords can be entered
without echo. It creates the administrator, HTTPS certificate and MQTT settings
without connecting to the broker. Enter **5080** for the web interface port.
Use a broker hostname or IP reachable from the container; `localhost` means the
container itself. Choose **no** for heat-pump control unless you intend to
configure and authorize it. Starting the service connects to the configured
broker.

Open <https://localhost:5080> and log in with the administrator account created
during setup. Verify the generated certificate's fingerprint before trusting it.
The default port mapping permits access from the container host only.

All installation state lives in the named `cockpit-data` volume mounted at
`/data`: configuration, certificate, databases, MQTT credentials and encryption
keys. Setup refuses to overwrite an existing installation. No host configuration
or credentials are copied into the build context. Login and HTTPS requirements
are preserved by the existing application.

## Operations

```sh
docker compose logs --tail=100 cockpit
docker compose down
docker compose up -d --build
```

`down` preserves the data volume. **`down -v` deletes the installation data.**
Stop the service before backing up the complete volume, including encryption
keys and certificates; protect backups as secrets. The container needs write
access to `/data`; a host bind mount must grant access to the image's `app` UID
(1654), including appropriate SELinux labeling where applicable. The supplied
Compose file uses a named volume to avoid host path permissions.

To change settings, stop the service and edit `/data/appsettings.Local.json`
using a volume administration tool. Recreate the service after changes. If you
change the internal port, update both the application setting and Compose port
mapping. Environment variables can also override .NET configuration using `__`
between sections, for example `Simulator__Scenario`.

For LAN access, change the host side of the port mapping deliberately and replace
`/data/data/localhost.pfx` with a passwordless PFX certificate valid for the host's
DNS name or LAN IP. The generated certificate covers localhost and the setup
container's addresses, not the host's LAN address. Keep HTTPS and login enabled.
See [control setup](CONTROL-SETUP.md) before enabling device control.

The image uses native architecture base images; Linux x64 and ARM64 builds are
intended. Cross-platform builds require a builder configured for that platform.
Container packaging does not establish compatibility with real heat-pump hardware.

References: [Microsoft .NET container guide](https://docs.docker.com/guides/dotnet/)
and [Podman Compose provider documentation](https://docs.podman.io/en/latest/markdown/podman-compose.1.html).
