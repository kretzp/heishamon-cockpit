#!/bin/sh
set -eu
umask 077

if [ "${1:-}" = '--help' ]; then
  echo 'Usage: sh bootstrap-raspberry-pi.sh [NEW-ABSOLUTE-INSTALL-DIRECTORY]'
  echo 'Requires 64-bit Raspberry Pi OS (ARM64); clones current master, builds and installs interactively.'
  exit 0
fi
if [ "$#" -gt 1 ]; then echo 'Provide at most one installation directory.' >&2; exit 1; fi
case "$(uname -s)-$(uname -m)" in
  Linux-aarch64|Linux-arm64) ;;
  *) echo 'This script requires 64-bit Linux on ARM64, such as Raspberry Pi OS 64-bit.' >&2; exit 1 ;;
esac
if ! command -v getconf >/dev/null 2>&1 || [ "$(getconf LONG_BIT)" != 64 ]; then
  echo 'A 64-bit userspace is required; 32-bit Raspberry Pi OS is not supported.' >&2; exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo 'Git is required. Install it using your distribution package manager and retry.' >&2; exit 1
fi
if [ "$#" -eq 1 ]; then
  case "$1" in /*) ;; *) echo 'Installation directory must be an absolute path.' >&2; exit 1 ;; esac
  if [ -e "$1" ] || [ -L "$1" ]; then echo 'Installation directory already exists; choose a new path.' >&2; exit 1; fi
fi
checkout=$(mktemp -d "$HOME/heishamon-cockpit-source.XXXXXXXX")
echo "Cloning the current master branch into: $checkout"
git clone --depth 1 --single-branch --branch master -- https://github.com/kretzp/heishamon-cockpit.git "$checkout"
echo 'Building the ARM64 application package and starting interactive installation.'
echo "Source checkout retained at: $checkout"
exec sh "$checkout/installation/install-raspberry-pi.sh" "$@"
