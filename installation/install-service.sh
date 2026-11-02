#!/bin/sh
# Called only after explicit service opt-in. Linux x64 and Raspberry Pi ARM64.
set -eu
umask 077
install_dir=${1:?Provide the installation directory.}
case "$install_dir" in /*) ;; *) echo 'Installation path must be absolute.' >&2; exit 1 ;; esac
if printf '%s' "$install_dir" | LC_ALL=C grep -q '[[:cntrl:]]'; then
  echo 'Control characters in installation paths are not supported for services.' >&2; exit 1
fi
if [ ! -x "$install_dir/Cockpit.Web" ]; then echo 'Installed application not found.' >&2; exit 1; fi
if [ "$(id -u)" -eq 0 ]; then echo 'Run installation as the normal application user; sudo is used only for service setup.' >&2; exit 1; fi
if ! command -v systemctl >/dev/null 2>&1 || ! systemctl show --property=Version --value >/dev/null 2>&1; then
  echo 'A running systemd system manager is required. Start the application manually on this system.' >&2; exit 1
fi
if ! command -v sudo >/dev/null 2>&1; then echo 'sudo is required to install the system service.' >&2; exit 1; fi
service=heishamon-cockpit.service
unit_file=/etc/systemd/system/$service
load_state=$(systemctl show --property=LoadState --value "$service")
if [ "$load_state" != 'not-found' ] || [ -e "$unit_file" ] || [ -L "$unit_file" ]; then
  echo 'A heishamon-cockpit service already exists.'
  while :; do
    printf 'Choose [A]bort, [D]elete and reinstall, or [S]tart existing service [A]: '
    IFS= read -r existing_action || existing_action='a'
    case "$existing_action" in
      ''|a|A) echo 'Aborted. Existing service was not changed.'; exit 0 ;;
      s|S)
        sudo systemctl start "$service"
        sleep 2
        if ! systemctl is-active --quiet "$service"; then echo 'Existing service did not start; inspect journalctl.' >&2; exit 1; fi
        systemctl status "$service" --no-pager
        exit 0 ;;
      d|D) break ;;
      *) echo 'Invalid value. Enter A, D or S.' ;;
    esac
  done
  dropins=$(systemctl show --property=DropInPaths --value "$service")
  if [ -n "$dropins" ]; then
    echo 'Existing service has drop-in overrides. Remove or migrate them explicitly before Delete; the service was preserved.' >&2
    printf 'Overrides: %s\n' "$dropins" >&2
    exit 1
  fi
  fragment=$(systemctl show --property=FragmentPath --value "$service")
  case "$fragment" in
    ''|"$unit_file"|/run/systemd/system/heishamon-cockpit.service|/usr/lib/systemd/system/heishamon-cockpit.service|/lib/systemd/system/heishamon-cockpit.service) ;;
    *) echo "Service definition has an unsupported location; preserved: $fragment" >&2; exit 1 ;;
  esac
  if ! sudo systemctl disable --now "$service"; then
    if systemctl is-active --quiet "$service"; then echo 'Existing service could not be stopped; it was not deleted.' >&2; exit 1; fi
  fi
  sudo rm -f -- "$unit_file"
  if [ -n "$fragment" ] && [ "$fragment" != "$unit_file" ]; then sudo rm -f -- "$fragment"; fi
  sudo systemctl daemon-reload
  sudo systemctl reset-failed "$service" 2>/dev/null || true
  echo 'Existing service removed. Installing the new service; application files and data were preserved.'
fi
unit_dir=$(mktemp -d)
unit="$unit_dir/heishamon-cockpit.service"
trap 'rm -f -- "$unit"; rmdir -- "$unit_dir"' EXIT HUP INT TERM
# WorkingDirectory is a raw path. ExecStart's executable token supports quoting,
# but not environment-variable expansion. Both values expand percent specifiers.
directory=$(printf '%s' "$install_dir" | sed 's/%/%%/g')
executable=$(printf '%s' "$directory/Cockpit.Web" | sed 's/\\/\\\\/g; s/"/\\"/g')
cat > "$unit" <<EOF
[Unit]
Description=HeishaMon Cockpit
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=$(id -u)
Group=$(id -g)
WorkingDirectory=$directory
ExecStart="$executable"
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
if command -v systemd-analyze >/dev/null 2>&1; then
  systemd-analyze verify "$unit"
else
  echo 'systemd-analyze is unavailable; generated unit syntax could not be checked locally.' >&2
fi
# noclobber also rejects an existing symlink; do not overwrite an existing unit.
sudo sh -c 'set -euC; umask 022; cat -- "$1" > "$2"' sh "$unit" "$unit_file"
sudo systemctl daemon-reload
if ! sudo systemctl enable --now "$service"; then
  sudo systemctl disable --now "$service" || true
  echo 'Service start failed. Autostart was disabled; the unit and application were preserved.' >&2
  echo 'Inspect: sudo journalctl -u heishamon-cockpit.service -n 100 --no-pager' >&2
  exit 1
fi
sleep 2
if ! systemctl is-active --quiet "$service"; then
  sudo systemctl disable --now "$service" || true
  echo 'Service is not running. Autostart was disabled; inspect journalctl.' >&2; exit 1
fi
echo 'Service installed, enabled at boot and started.'
systemctl status "$service" --no-pager
echo 'Status: systemctl status heishamon-cockpit.service'
echo 'Start/stop: sudo systemctl start heishamon-cockpit.service / sudo systemctl stop heishamon-cockpit.service'
echo 'Logs: sudo journalctl -u heishamon-cockpit.service -f'
echo 'Remove: sudo systemctl disable --now heishamon-cockpit.service; sudo rm /etc/systemd/system/heishamon-cockpit.service; sudo systemctl daemon-reload'
