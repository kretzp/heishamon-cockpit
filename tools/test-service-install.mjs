import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const windows = process.platform === 'win32';
const shell = windows ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/sh';
const shellPath = path => windows ? path.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase()) : path;
const put = (path, text) => writeFileSync(path, text, { mode: 0o700 });

function runLinux(scenario, input) {
  const folder = mkdtempSync(join(tmpdir(), 'cockpit service '));
  const bin = join(folder, 'bin'); mkdirSync(bin);
  const install = join(folder, 'app $value %value'); mkdirSync(install);
  put(join(install, 'Cockpit.Web'), '#!/bin/sh\nexit 0\n');
  put(join(bin, 'id'), '#!/bin/sh\ncase "$1" in -u|-g) echo "${TEST_UID:-1001}";; esac\n');
  put(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n');
  put(join(bin, 'systemctl'), `#!/bin/sh
printf '%s\\n' "$*" >> "$TEST_TRACE/commands"
case "$*" in
  'show --property=Version --value') [ "$TEST_SCENARIO" != nosystemd ] ;;
  'show --property=LoadState --value '*) if [ "$TEST_SCENARIO" = existing ]; then echo loaded; else echo not-found; fi ;;
  'enable --now '*) [ "$TEST_SCENARIO" != startfail ] ;;
  'is-active --quiet '*) [ "$TEST_SCENARIO" != inactive ] ;;
esac
`);
  put(join(bin, 'sudo'), `#!/bin/sh
if [ "$1" = sh ]; then
  cp "$5" "$TEST_TRACE/unit"
  exit 0
fi
exec "$@"
`);
  let script = join(root, 'installation/install-service.sh');
  let destination = shellPath(install);
  if (input !== undefined) {
    const packageDir = join(folder, 'package'); mkdirSync(packageDir); mkdirSync(join(packageDir, 'app'));
    put(join(packageDir, 'app/Cockpit.Web'), '#!/bin/sh\nprintf "%s\\n" "$*" > "$TEST_TRACE/setup"\n');
    put(join(packageDir, 'install-service.sh'), '#!/bin/sh\necho selected > "$TEST_TRACE/selected"\n');
    // Use the real package installer, with a fake application and service helper.
    writeFileSync(join(packageDir, 'install.sh'), readFileSync(join(root, 'installation/install.sh')));
    script = join(packageDir, 'install.sh'); destination = shellPath(join(folder, 'new installation'));
  }
  try {
    const result = spawnSync(shell, ['-c', 'export PATH="$TEST_BIN:/usr/bin:/bin"; exec sh "$@"', 'service-test', shellPath(script), destination],
      { env: { ...process.env, TEST_BIN: shellPath(bin), TEST_TRACE: shellPath(folder), TEST_SCENARIO: scenario,
        TEST_UID: scenario === 'root' ? '0' : '1001' }, input, encoding: 'utf8', timeout: 10000 });
    return { ...result, commands: existsSync(join(folder, 'commands')) ? readFileSync(join(folder, 'commands'), 'utf8') : '',
      unit: existsSync(join(folder, 'unit')) ? readFileSync(join(folder, 'unit'), 'utf8') : '',
      selected: existsSync(join(folder, 'selected')), setup: existsSync(join(folder, 'setup')) };
  } finally { rmSync(folder, { recursive: true, force: true }); }
}

test('Linux service uses installing UID, escaped paths and enables immediate startup', () => {
  const result = runLinux('success');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.unit, /User=1001\nGroup=1001/);
  assert.match(result.unit, /WorkingDirectory=".*app \$value %%value"/);
  assert.match(result.unit, /ExecStart=".*app \$\$value %%value\/Cockpit.Web"/);
  assert.match(result.unit, /UMask=0077\nNoNewPrivileges=true/);
  assert.match(result.commands, /enable --now heishamon-cockpit.service/);
});
for (const [scenario, message] of [['existing', /already exists/], ['nosystemd', /running systemd/], ['root', /normal application user/]]) {
  test(`Linux ${scenario} refuses before service creation`, () => {
    const result = runLinux(scenario);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
    assert.equal(result.unit, '');
    assert.doesNotMatch(result.commands, /enable --now/);
  });
}
for (const scenario of ['startfail','inactive']) {
  test(`Linux ${scenario} disables autostart and reports failure`, () => {
    const result = runLinux(scenario);
    assert.notEqual(result.status, 0);
    assert.match(result.commands, /disable --now heishamon-cockpit.service/);
    assert.match(result.stderr, /Autostart was disabled/);
  });
}
for (const answer of ['', '\n', 'no\n', 'yes\n', 'ja\n']) {
  test(`package installer service selection ${JSON.stringify(answer)}`, () => {
    const result = runLinux('success', answer);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.setup);
    assert.equal(result.selected, ['yes\n','ja\n'].includes(answer));
  });
}
for (const scenario of ['success','existing','checksum','startup','elevation']) {
  test(`Windows service ${scenario}`, { skip: !windows }, () => {
    const folder = mkdtempSync(join(tmpdir(), 'cockpit windows service '));
    try {
      const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'tools/test-service-install.ps1'),
        '-Root', folder, '-Helper', join(root, 'installation/install-service.ps1'), '-Scenario', scenario], { encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, 0, result.stderr + result.stdout);
      assert.match(result.stdout, /PASS: Windows/);
    } finally { rmSync(folder, { recursive: true, force: true }); }
  });
}
