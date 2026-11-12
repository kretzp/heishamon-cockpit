# Docker and Podman

The root `Dockerfile` builds the React UI and .NET backend into a Linux image.
It runs as the .NET image's unprivileged `app` user. The host needs Docker with
Compose, or Podman with an installed Compose provider. Run commands from the
repository root. For Podman, replace `docker compose` with `podman compose`.

## First installation

Building the image is non-interactive and requires no accounts, certificates or
MQTT credentials. These are created by `--setup-installation` **after** the build
and stored only in the installation's data volume, never in the image.

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

## Updating an existing installation without losing data

Use the same repository directory, Compose files and project name as the existing
installation. Compose prefixes the named volume with its project name; changing
that name can start an apparently empty installation on a different volume.
If you originally used `docker compose -p <name>` or extra `-f` files, include
those options in every command below. Do not rerun `--setup-installation`.

Build first while the old container is still running. From PowerShell in the
repository root, run each command only after the preceding command succeeds:

```powershell
docker compose ps --all
docker compose build cockpit

# Record the old image for rollback before recreating the container.
$container = docker compose ps --all --quiet cockpit
if ($LASTEXITCODE -ne 0 -or -not $container) { throw "Existing Cockpit container not found." }
$oldImage = docker inspect --format '{{.Image}}' $container
if ($LASTEXITCODE -ne 0) { throw "Cannot identify the existing image." }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$rollbackImage = "localhost/heishamon-cockpit:rollback-$stamp"
docker image tag $oldImage $rollbackImage
if ($LASTEXITCODE -ne 0) { throw "Cannot retain rollback image." }

# A clean stop makes the SQLite database and any WAL files consistent.
docker compose stop cockpit
if ($LASTEXITCODE -ne 0) { throw "Stop failed; do not copy a live database." }
$backup = Join-Path (Get-Location) "artifacts/docker-backups/$stamp"
New-Item -ItemType Directory -Path $backup -ErrorAction Stop | Out-Null
docker compose cp cockpit:/data/. $backup
if ($LASTEXITCODE -ne 0) { throw "Backup failed; keep the existing container." }
$rollbackImage | Set-Content (Join-Path $backup 'rollback-image.txt')

# Recreate only the application, reusing its existing data volume.
docker compose up -d --no-build --no-deps cockpit
docker compose ps
docker compose logs --tail=100 cockpit
```

Back up **all of `/data`**, including configuration, databases, SQLite sidecar
files, certificates, encryption keys and MQTT credential storage. Check that the
backup contains the installation configuration and database files before
recreating the container. `artifacts/` is excluded from Git; backups contain
secrets and should be protected and copied to suitable backup storage.

Open <https://localhost:5080> (or your existing configured URL), check
`/health/ready`, log in, and verify historical data and saved settings. Confirm
that the recreated container still mounts the same volume at `/data`, using
`docker inspect --format '{{json .Mounts}}' <container-id>`.

The relay-switching feature does not introduce a history database schema
migration. Its `EnableRelaySwitching` setting is stored in the existing settings
JSON and defaults to false when absent. Existing database initialization applies
pending EF migrations automatically, but refuses a different telemetry source or
history sampling interval. Do not switch an MQTT database to simulator mode or
change its sampling interval for this update. Use a separate volume for a
simulator-only test, and never run two Cockpit instances against the same database.

If startup or data verification fails, stop the new container and retain the
backup. To reuse the previous image, tag the recorded rollback image as
`localhost/heishamon-cockpit:local` and recreate with `--no-build`. If a future
update changes the database schema, restore the complete stopped backup into a
new volume and point Compose at that volume before starting the previous image;
reverting the image alone does not undo a database migration. A restore must
preserve or restore writable ownership for the application UID (1654); files
copied from a host backup as root can otherwise prevent startup. Preserve the
failed volume until recovery has been verified.

`docker compose down` preserves named volumes. **Never use `down -v` or remove
the data volume when retaining the installation.** The container needs write
access to `/data`; a host bind mount must grant access to the image's `app` UID
(1654), including appropriate SELinux labeling where applicable. The supplied
Compose file uses a named volume to avoid host path permissions.

## Operations

```sh
docker compose logs --tail=100 cockpit
docker compose stop cockpit
docker compose start cockpit
```

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

## Continuous integration

The Linux x64 Docker job in `.github/workflows/ci.yml` builds the image and checks
Compose configuration on relevant pull requests and pushes to `master`.
`python tools/test_container.py <image>` runs the smoke test locally as well.
It starts a simulator with login and control disabled, without published ports,
using Docker's `none` network. It checks readiness, liveness, the built frontend,
read-only simulator status, the unprivileged user and writable data storage.
It recreates the container with the same volume to check persistence, then removes
its uniquely named test containers and volume, including on failure.
No interactive setup or GitHub secrets are needed. This smoke test does not cover
production login, HTTPS or MQTT connections; those use the installation procedure
above.

References: [Microsoft .NET container guide](https://docs.docker.com/guides/dotnet/)
and [Podman Compose provider documentation](https://docs.podman.io/en/latest/markdown/podman-compose.1.html).
