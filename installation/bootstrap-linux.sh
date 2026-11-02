#!/bin/sh
set -eu
umask 077

if [ "${1:-}" = '--help' ]; then
  echo 'Usage: sh bootstrap-linux.sh [NEW-ABSOLUTE-INSTALL-DIRECTORY]'
  echo 'Downloads current master into a new source directory under your home, builds and installs interactively.'
  exit 0
fi
if [ "$#" -gt 1 ]; then echo 'Provide at most one installation directory.' >&2; exit 1; fi
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64|Linux-aarch64|Linux-arm64) ;;
  *) echo 'Supported systems are Linux x86-64 and Linux ARM64.' >&2; exit 1 ;;
esac
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
echo 'Building the application package and starting interactive installation.'
echo "Source checkout retained at: $checkout"
exec sh "$checkout/installation/install-linux.sh" "$@"
