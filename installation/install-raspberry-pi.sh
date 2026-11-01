#!/bin/sh
set -eu

if [ "${1:-}" = "--help" ]; then
  echo 'Usage: sh installation/install-raspberry-pi.sh [NEW-ABSOLUTE-INSTALL-DIRECTORY]'
  echo 'Requires 64-bit Raspberry Pi OS (ARM64).'
  exit 0
fi
if [ "$#" -gt 1 ]; then
  echo 'Provide at most one installation directory.' >&2
  exit 1
fi
case "$(uname -s)-$(uname -m)" in
  Linux-aarch64|Linux-arm64) ;;
  *) echo 'This installer requires 64-bit Linux on ARM64, such as Raspberry Pi OS 64-bit.' >&2; exit 1 ;;
esac
if ! command -v getconf >/dev/null 2>&1 || [ "$(getconf LONG_BIT)" != 64 ]; then
  echo 'A 64-bit userspace is required; 32-bit Raspberry Pi OS is not supported.' >&2
  exit 1
fi
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
echo 'Starting the ARM64 build and interactive installation.'
exec sh "$root/install-linux.sh" "$@"
