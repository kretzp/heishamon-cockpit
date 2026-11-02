#!/bin/sh
set -eu
umask 077
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ "${1:-}" = '--help' ]; then
  echo 'Usage: sh installation/update-linux.sh [ABSOLUTE-INSTALL-DIRECTORY [ABSOLUTE-EXTRACTED-PACKAGE-DIRECTORY]]'
  echo 'Without a directory, detects the installation from heishamon-cockpit.service.'
  echo 'Builds the current checkout unless a prepared package is supplied. Run git pull --ff-only first.'
  exit 0
fi
if [ "$#" -gt 2 ]; then echo 'Provide the installation directory and optionally an extracted package.' >&2; exit 1; fi
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) runtime=linux-x64 ;;
  Linux-aarch64|Linux-arm64) runtime=linux-arm64 ;;
  *) echo 'Requires Linux x64 or ARM64.' >&2; exit 1 ;;
esac
command -v python3 >/dev/null 2>&1 || { echo 'Python 3.10+ is required.' >&2; exit 1; }
python3 -c 'import sys,ssl; assert sys.version_info >= (3,10)'
if [ "$#" -eq 0 ]; then
  target=$(python3 "$root/installation/update_installation.py" --resolve-install-dir)
else
  target=$(python3 "$root/installation/update_installation.py" --resolve-install-dir --install-dir "$1")
fi
echo "Installation directory: $target"
if [ "$#" -eq 2 ]; then
  package=$2
else
  mkdir -p "$root/artifacts"
  output=$(mktemp -d "$root/artifacts/update.XXXXXXXX")
  echo "Building the current checkout before stopping the application: $output"
  HPC_PACKAGE_OUTPUT="$output" sh "$root/packaging/build.sh" "$runtime"
  package="$output/extracted"
  mkdir "$package"
  tar -xzf "$output/heishamon-cockpit-$runtime.tar.gz" -C "$package"
fi
echo 'A running service will be stopped and restarted. Restarting opens its configured MQTT connection.'
exec python3 "$root/installation/update_installation.py" --install-dir "$target" --package-directory "$package" --runtime "$runtime"
