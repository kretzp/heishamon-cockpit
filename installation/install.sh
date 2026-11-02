#!/bin/sh
set -eu
umask 077
package_dir=$(CDPATH= cd "$(dirname -- "$0")" && pwd)
install_dir=${1:-"$HOME/.local/share/heishamon-cockpit"}
case "$install_dir" in /*) ;; *) echo "Installation path must be absolute." >&2; exit 1 ;; esac
if [ -e "$install_dir" ] || [ -L "$install_dir" ]; then
  echo "Installation path already exists; choose a new path." >&2
  exit 1
fi
mkdir -p "$(dirname -- "$install_dir")"
mkdir "$install_dir"
chmod 700 "$install_dir"
cp -R "$package_dir/app/." "$install_dir/"
chmod u+x "$install_dir/Cockpit.Web"
cd -- "$install_dir"
./Cockpit.Web --setup-installation
cp "$package_dir/install-service.sh" "$install_dir/install-service.sh"
printf '\nTo start later: cd "%s" && ./Cockpit.Web\n' "$install_dir"
echo 'Choosing yes starts the service immediately and connects to the configured MQTT broker. Control settings remain unchanged.'
while :; do
  printf 'Install as a service that starts automatically at boot? (yes/y/no/n) [no]: '
  IFS= read -r service_answer || service_answer=''
  service_answer=$(printf '%s' "$service_answer" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  case "$service_answer" in
    ''|n|no|nein|y|yes|j|ja) break ;;
    *) echo 'Invalid value. Enter yes/y or no/n, or press Enter for no.' ;;
  esac
done
case "$service_answer" in
  y|Y|yes|Yes|YES|j|J|ja|Ja|JA)
    if ! sh "$install_dir/install-service.sh" "$install_dir"; then
      echo 'Service setup was not completed. The installation remains available for manual startup.' >&2
    fi ;;
  *) echo 'No service installed. Start the application manually when ready.' ;;
esac
