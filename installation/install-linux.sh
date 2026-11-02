#!/bin/sh
set -eu
umask 077

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ "$#" -gt 0 ]; then
  install_dir=$1
else
  install_dir="$HOME/.local/share/heishamon-cockpit"
  for parent in "$HOME/.local" "$HOME/.local/share"; do
    if [ -e "$parent" ] && { [ ! -w "$parent" ] || [ ! -x "$parent" ]; }; then
      install_dir="$HOME/heishamon-cockpit"
      echo "The usual installation directory is not accessible; using $install_dir"
      break
    fi
  done
fi
if [ "${1:-}" = "--help" ]; then
  echo 'Usage: sh installation/install-linux.sh [NEW-ABSOLUTE-INSTALL-DIRECTORY]'
  exit 0
fi
if [ "$#" -gt 1 ]; then echo 'Provide at most one installation directory.' >&2; exit 1; fi
case "$install_dir" in /*) ;; *) echo 'The installation directory must be an absolute path.' >&2; exit 1 ;; esac
if [ -e "$install_dir" ] || [ -L "$install_dir" ]; then
  echo "Installation directory already exists: $install_dir" >&2; exit 1
fi
if [ ! -t 0 ]; then echo 'Run this installer in an interactive terminal.' >&2; exit 1; fi
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) runtime=linux-x64 ;;
  Linux-aarch64|Linux-arm64) runtime=linux-arm64 ;;
  *) echo 'Supported systems are Linux x86-64 and Linux ARM64.' >&2; exit 1 ;;
esac

missing=''
for command in bash curl tar gzip awk sha256sum python3; do
  command -v "$command" >/dev/null 2>&1 || missing="$missing $command"
done
python_ready() {
  command -v python3 >/dev/null 2>&1 && python3 -c 'import sys,ssl,urllib.request,http.cookiejar,json; assert sys.version_info >= (3,10)' >/dev/null 2>&1
}
if ! python_ready; then missing="$missing python3-with-ssl-3.10+"; fi
if [ -n "$missing" ]; then
  echo "Missing prerequisites:$missing"
  if ! command -v apt-get >/dev/null 2>&1; then
    echo 'Install the missing prerequisites with your system package manager and run this script again.' >&2; exit 1
  fi
  if [ "$(id -u)" -eq 0 ]; then
    apt-get update
    apt-get install -y bash curl ca-certificates tar gzip gawk coreutils python3
  elif command -v sudo >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y bash curl ca-certificates tar gzip gawk coreutils python3
  else
    echo 'Administrator access is required to install missing system prerequisites.' >&2; exit 1
  fi
fi
if ! python_ready; then
  echo 'MCP requires working Python 3.10+ with SSL. Upgrade your distribution or provide a compatible python3 on PATH.' >&2
  exit 1
fi
echo "MCP Python: $(command -v python3)"

mkdir -p "$root/artifacts"
build_dir=$(mktemp -d "$root/artifacts/build.XXXXXXXX")
echo "Building $runtime package in $build_dir"
HPC_PACKAGE_OUTPUT="$build_dir" sh "$root/packaging/build.sh" "$runtime"
mkdir "$build_dir/extracted"
tar -xzf "$build_dir/heishamon-cockpit-$runtime.tar.gz" -C "$build_dir/extracted"
echo 'Configure the initial administrator and MQTT connection when prompted.'
sh "$build_dir/extracted/install.sh" "$install_dir"
printf '\nPackage retained at: %s\n' "$build_dir/heishamon-cockpit-$runtime.tar.gz"
echo 'The application starts and connects to MQTT only if service startup was explicitly selected.'
