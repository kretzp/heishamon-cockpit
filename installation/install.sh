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
printf '\nTo start later: cd "%s" && ./Cockpit.Web\n' "$install_dir"
