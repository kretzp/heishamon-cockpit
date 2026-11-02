#!/bin/sh
set -eu
if [ "${1:-}" = '--help' ]; then
  echo 'Usage: sh installation/update-raspberry-pi.sh [ABSOLUTE-INSTALL-DIRECTORY [ABSOLUTE-EXTRACTED-PACKAGE-DIRECTORY]]'
  echo 'Without a directory, detects the installation from heishamon-cockpit.service.'
  echo 'Requires ARM64 Linux and a 64-bit userspace.'
  exit 0
fi
case "$(uname -s)-$(uname -m)" in
  Linux-aarch64|Linux-arm64) ;;
  *) echo 'Raspberry Pi updates require ARM64 Linux.' >&2; exit 1 ;;
esac
if [ "$(getconf LONG_BIT)" != 64 ]; then echo 'A 64-bit userspace is required.' >&2; exit 1; fi
directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec sh "$directory/update-linux.sh" "$@"
