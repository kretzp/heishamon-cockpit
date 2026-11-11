#!/bin/sh
set -eu
node_version=24.20.0
sdk_version=10.0.404
root=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
tools_dir="$root/.cache/build-tools"
NUGET_HTTP_CACHE_PATH=${NUGET_HTTP_CACHE_PATH:-"$root/.cache/nuget/http"}
NUGET_PACKAGES=${NUGET_PACKAGES:-"$root/.cache/nuget/packages"}
export NUGET_HTTP_CACHE_PATH NUGET_PACKAGES
mkdir -p "$NUGET_HTTP_CACHE_PATH" "$NUGET_PACKAGES"
cd "$root"
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) node_target=linux-x64 ;;
  Linux-aarch64|Linux-arm64) node_target=linux-arm64 ;;
  *) echo 'Unsupported build host.' >&2; exit 1 ;;
esac
command -v tar >/dev/null || { echo 'tar is required.' >&2; exit 1; }
if command -v node >/dev/null && command -v npm >/dev/null && [ "$(node --version)" = "v$node_version" ]; then
  node_bin=$(dirname "$(command -v node)")
  echo "Using existing Node.js $node_version and npm."
else
  command -v curl >/dev/null || { echo 'curl is required to download Node.js.' >&2; exit 1; }
  node_dir="$tools_dir/node-v$node_version-$node_target"
  mkdir -p "$tools_dir"
  if [ ! -x "$node_dir/bin/node" ]; then
    archive="node-v$node_version-$node_target.tar.gz"
    curl --fail --location --silent --show-error "https://nodejs.org/dist/v$node_version/$archive" -o "$tools_dir/$archive"
    curl --fail --location --silent --show-error "https://nodejs.org/dist/v$node_version/SHASUMS256.txt" -o "$tools_dir/SHASUMS256.txt"
    expected=$(awk -v filename="$archive" '$2 == filename {print $1}' "$tools_dir/SHASUMS256.txt")
    if command -v sha256sum >/dev/null; then actual=$(sha256sum "$tools_dir/$archive" | awk '{print $1}'); else actual=$(shasum -a 256 "$tools_dir/$archive" | awk '{print $1}'); fi
    [ -n "$expected" ] && [ "$actual" = "$expected" ] || { echo 'Node.js checksum mismatch.' >&2; exit 1; }
    tar -xzf "$tools_dir/$archive" -C "$tools_dir"
  fi
  node_bin="$node_dir/bin"
fi
if command -v dotnet >/dev/null && [ "$(dotnet --version 2>/dev/null || true)" = "$sdk_version" ]; then
  dotnet_bin=$(dirname "$(command -v dotnet)")
  echo "Using existing .NET SDK $sdk_version."
else
  command -v curl >/dev/null || { echo 'curl is required to download .NET.' >&2; exit 1; }
  mkdir -p "$tools_dir"
  if [ ! -x "$tools_dir/dotnet/dotnet" ] || [ "$("$tools_dir/dotnet/dotnet" --version)" != "$sdk_version" ]; then
    curl --fail --location --silent --show-error https://dot.net/v1/dotnet-install.sh -o "$tools_dir/dotnet-install.sh"
    command -v bash >/dev/null || { echo 'bash is required to install .NET.' >&2; exit 1; }
    bash "$tools_dir/dotnet-install.sh" --version "$sdk_version" --install-dir "$tools_dir/dotnet" --no-path
  fi
  dotnet_bin="$tools_dir/dotnet"
fi
PATH="$node_bin:$dotnet_bin:$PATH"; export PATH
exec "$node_bin/node" tools/build-package.mjs "${1:-}"
