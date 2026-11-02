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

function runLinux(scenario, input, existingAnswer) {
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
  'show --property=LoadState --value '*) case "$TEST_SCENARIO" in existing*) echo loaded;; *) echo not-found;; esac ;;
  'show --property=DropInPaths --value '*) if [ "$TEST_SCENARIO" = existing-overrides ]; then echo /etc/systemd/system/heishamon-cockpit.service.d/override.conf; fi ;;
  'show --property=FragmentPath --value '*) echo /etc/systemd/system/heishamon-cockpit.service ;;
  'enable --now '*) [ "$TEST_SCENARIO" != startfail ] ;;
  'is-active --quiet '*) [ "$TEST_SCENARIO" != inactive ] ;;
esac
`);
  put(join(bin, 'sudo'), `#!/bin/sh
if [ "$1" = sh ]; then
  cp "$5" "$TEST_TRACE/unit"
  exit 0
fi
if [ "$1" = rm ]; then printf '%s\\n' "$*" >> "$TEST_TRACE/commands"; exit 0; fi
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
        TEST_UID: scenario === 'root' ? '0' : '1001' }, input: existingAnswer ?? input, encoding: 'utf8', timeout: 10000 });
    return { ...result, commands: existsSync(join(folder, 'commands')) ? readFileSync(join(folder, 'commands'), 'utf8') : '',
      unit: existsSync(join(folder, 'unit')) ? readFileSync(join(folder, 'unit'), 'utf8') : '',
      selected: existsSync(join(folder, 'selected')), setup: existsSync(join(folder, 'setup')) };
  } finally { rmSync(folder, { recursive: true, force: true }); }
}

test('Linux service uses installing UID, escaped paths and enables immediate startup', () => {
  const result = runLinux('success');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.unit, /User=1001\nGroup=1001/);
  assert.match(result.unit, /WorkingDirectory=\/.*app \$value %%value\n/);
  assert.match(result.unit, /ExecStart=".*app \$value %%value\/Cockpit.Web"/);
  assert.match(result.unit, /UMask=0077\nNoNewPrivileges=true/);
  assert.match(result.commands, /enable --now heishamon-cockpit.service/);
});
for (const [scenario, message] of [['nosystemd', /running systemd/], ['root', /normal application user/]]) {
  test(`Linux ${scenario} refuses before service creation`, () => {
    const result = runLinux(scenario);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
    assert.equal(result.unit, '');
    assert.doesNotMatch(result.commands, /enable --now/);
  });
}
for (const choice of ['a','A','s','S','d','D','invalid\nD']) {
  test(`Linux existing service choice ${JSON.stringify(choice)}`, () => {
    const result = runLinux('existing', undefined, choice + '\n');
    assert.equal(result.status, 0, result.stderr);
    const action = choice.at(-1).toLowerCase();
    if (action === 'a') {
      assert.equal(result.unit, '');
      assert.doesNotMatch(result.commands, /start heishamon|disable|rm /);
    } else if (action === 's') {
      assert.equal(result.unit, '');
      assert.match(result.commands, /start heishamon-cockpit.service/);
      assert.doesNotMatch(result.commands, /enable --now|disable|rm /);
    } else {
      assert.notEqual(result.unit, '');
      assert.match(result.commands, /disable --now heishamon-cockpit.service/);
      assert.match(result.commands, /rm -f -- \/etc\/systemd\/system\/heishamon-cockpit.service/);
      assert.match(result.commands, /enable --now heishamon-cockpit.service/);
    }
    if (choice.startsWith('invalid')) assert.match(result.stdout, /Invalid value/);
  });
}
test('Linux Delete refuses existing drop-in overrides before changing the service', () => {
  const result = runLinux('existing-overrides', undefined, 'd\n');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /drop-in overrides/);
  assert.doesNotMatch(result.commands, /disable|enable --now|rm /);
  assert.equal(result.unit, '');
});
for (const scenario of ['startfail','inactive']) {
  test(`Linux ${scenario} disables autostart and reports failure`, () => {
    const result = runLinux(scenario);
    assert.notEqual(result.status, 0);
    assert.match(result.commands, /disable --now heishamon-cockpit.service/);
    assert.match(result.stderr, /Autostart was disabled/);
  });
}
for (const answer of ['', '\n', 'no\n', 'yes\n', 'ja\n', 'y\n', 'n\n', ' Y \n', 'invalid\nwrong\ny\n', 'invalid\nn\n']) {
  test(`package installer service selection ${JSON.stringify(answer)}`, () => {
    const result = runLinux('success', answer);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.setup);
    const lastAnswer = answer.trim().split('\n').at(-1).trim().toLowerCase();
    assert.equal(result.selected, ['yes','y','ja','j'].includes(lastAnswer));
    if (answer.startsWith('invalid')) assert.match(result.stdout, /Invalid value/);
  });
}
for (const scenario of ['success','existing','existing-delete','existing-start','existing-retry','existing-stopfail','existing-elevation','checksum','startup','elevation','prompt-yes','prompt-no','prompt-empty']) {
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
