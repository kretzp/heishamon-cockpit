#!/bin/sh
# Verify the actual generated unit with systemd's parser; never install/start it.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
command -v systemd-analyze >/dev/null
workspace=$(mktemp -d)
trap 'rm -rf -- "$workspace"' EXIT HUP INT TERM
mkdir "$workspace/bin"
export TEST_UNIT="$workspace/heishamon-cockpit.service"
cat > "$workspace/bin/id" <<'EOF'
#!/bin/sh
echo 1000
EOF
cat > "$workspace/bin/systemctl" <<'EOF'
#!/bin/sh
case "$*" in
  'show --property=LoadState --value '*) echo not-found ;;
esac
exit 0
EOF
cat > "$workspace/bin/sudo" <<'EOF'
#!/bin/sh
if [ "$1" = sh ]; then cp "$5" "$TEST_UNIT"; else "$@"; fi
EOF
cat > "$workspace/bin/sleep" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod 700 "$workspace/bin/"*
export PATH="$workspace/bin:$PATH"
for name in plain 'with spaces' 'with $dollar %percent'; do
  target="$workspace/$name"
  mkdir "$target"
  printf '#!/bin/sh\nexit 0\n' > "$target/Cockpit.Web"
  chmod 700 "$target/Cockpit.Web"
  sh "$root/installation/install-service.sh" "$target" > /dev/null
  systemd-analyze verify "$TEST_UNIT"
  printf 'PASS: systemd parser (%s)\n' "$name"
done
