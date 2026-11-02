import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Command stubs only: no network, package build, system changes or real setup.
const windows = process.platform === 'win32';
const shell = windows ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/sh';
const shellPath = path => windows ? path.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase()) : path;
const root = resolve(import.meta.dirname, '..');
const put = (path, text) => writeFileSync(path, text, { mode: 0o700 });

function fixture() {
  const folder = mkdtempSync(join(tmpdir(), 'cockpit bootstrap '));
  const bin = join(folder, 'bin');
  mkdirSync(bin);
  const fakeInstaller = join(folder, 'installer.sh');
  put(fakeInstaller, '#!/bin/sh\nprintf "%s\\n" "$0" "$@" > "$TEST_TRACE/installer"\nexit "${TEST_INSTALL_EXIT:-0}"\n');
  put(join(bin, 'uname'), '#!/bin/sh\ncase "$1" in -s) echo Linux;; -m) echo "${TEST_ARCH:-x86_64}";; esac\n');
  put(join(bin, 'getconf'), '#!/bin/sh\necho "${TEST_BITS:-64}"\n');
  put(join(bin, 'git'), `#!/bin/sh
printf '%s\\n' "$@" > "$TEST_TRACE/clone-args"
if [ "\${TEST_CLONE_FAIL:-0}" = 1 ]; then exit 17; fi
for checkout do :; done
mkdir -p "$checkout/installation"
cp "$TEST_FIXTURE" "$checkout/installation/install-linux.sh"
cp "$TEST_FIXTURE" "$checkout/installation/install-raspberry-pi.sh"
`);
  return { folder, env: { ...process.env, HOME: shellPath(folder), TEST_HOME: shellPath(folder), TEST_BIN: shellPath(bin),
    PATH: shellPath(bin) + ':' + (windows ? '/usr/bin:/bin' : process.env.PATH),
    TEST_TRACE: shellPath(folder), TEST_FIXTURE: shellPath(fakeInstaller) } };
}

function runShell(script, args = [], extraEnv = {}) {
  const setup = fixture();
  try {
    const destination = shellPath(join(setup.folder, 'new install'));
    const result = spawnSync(shell, ['-c', 'export PATH="$TEST_BIN:/usr/bin:/bin" HOME="$TEST_HOME"; exec sh "$@"', 'bootstrap-test',
      shellPath(join(root, 'installation', script)), ...args.map(arg => arg === '$destination' ? destination : arg)],
      { env: { ...setup.env, ...extraEnv }, encoding: 'utf8', timeout: 10000 });
    return { ...result, destination,
      cloneArgs: existsSync(join(setup.folder, 'clone-args')) ? readFileSync(join(setup.folder, 'clone-args'), 'utf8') : '',
      installer: existsSync(join(setup.folder, 'installer')) ? readFileSync(join(setup.folder, 'installer'), 'utf8') : '' };
  } finally { rmSync(setup.folder, { recursive: true, force: true }); }
}

for (const [script, arch, installer] of [
  ['bootstrap-linux.sh', 'x86_64', 'install-linux.sh'],
  ['bootstrap-raspberry-pi.sh', 'aarch64', 'install-raspberry-pi.sh']
]) {
  test(`${script} clones master and forwards paths with spaces to its source installer`, () => {
    const result = runShell(script, ['$destination'], { TEST_ARCH: arch });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.cloneArgs, /clone\n--depth\n1\n--single-branch\n--branch\nmaster\n--\nhttps:\/\/github.com\/kretzp\/heishamon-cockpit.git\n/);
    assert.ok(result.installer.split('\n')[0].endsWith('/installation/' + installer));
    assert.equal(result.installer.split('\n')[1], result.destination);
  });
  test(`${script} stops on clone failure`, () => {
    const result = runShell(script, [], { TEST_ARCH: arch, TEST_CLONE_FAIL: '1' });
    assert.equal(result.status, 17);
    assert.equal(result.installer, '');
  });
  test(`${script} propagates installer failure`, () => {
    const result = runShell(script, [], { TEST_ARCH: arch, TEST_INSTALL_EXIT: '23' });
    assert.equal(result.status, 23);
  });
  test(`${script} rejects an existing installation before cloning`, () => {
    const result = runShell(script, ['/'], { TEST_ARCH: arch });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Installation directory already exists/);
    assert.equal(result.cloneArgs, '');
  });
}

test('Pi bootstrap rejects wrong architecture and 32-bit userspace before cloning', () => {
  for (const env of [{ TEST_ARCH: 'x86_64' }, { TEST_ARCH: 'aarch64', TEST_BITS: '32' }]) {
    const result = runShell('bootstrap-raspberry-pi.sh', [], env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, env.TEST_BITS ? /64-bit userspace is required/ : /requires 64-bit Linux on ARM64/);
    assert.equal(result.cloneArgs, '');
  }
});

test('shell bootstraps reject relative destinations before cloning', () => {
  const result = runShell('bootstrap-linux.sh', ['relative']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Installation directory must be an absolute path/);
  assert.equal(result.cloneArgs, '');
});

test('Windows bootstrap clones master, forwards destination and preserves existing source', { skip: !windows }, () => {
  const folder = mkdtempSync(join(tmpdir(), 'cockpit bootstrap windows '));
  const source = join(folder, 'source');
  const destination = join(folder, 'install');
  const command = `
$ErrorActionPreference = 'Stop'
function git {
  $args | Set-Content -LiteralPath (Join-Path $env:TEST_ROOT 'clone-args')
  New-Item -ItemType Directory -Path (Join-Path $args[-1] 'installation') | Out-Null
  'param([string]$InstallDirectory); $InstallDirectory | Set-Content -LiteralPath (Join-Path $env:TEST_ROOT "installed")' | Set-Content -LiteralPath (Join-Path $args[-1] 'installation/install-windows.ps1')
  $global:LASTEXITCODE = 0
}
& $env:TEST_SCRIPT -SourceDirectory $env:TEST_SOURCE -InstallDirectory $env:TEST_DESTINATION
try { & $env:TEST_SCRIPT -SourceDirectory $env:TEST_SOURCE; throw 'Existing source accepted.' }
catch { if ($_.Exception.Message -notlike '*already exists*') { throw } }
exit 0
`;
  try {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8', timeout: 15000,
      env: { ...process.env, TEST_ROOT: folder, TEST_SOURCE: source, TEST_DESTINATION: destination,
        TEST_SCRIPT: join(root, 'installation/bootstrap-windows.ps1') } });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const clone = readFileSync(join(folder, 'clone-args'), 'utf8').replaceAll('\r', '');
    // PowerShell consumes -- when invoking the mocked function instead of a native executable.
    assert.match(clone, /--branch\nmaster\n(?:--\n)?https:\/\/github.com\/kretzp\/heishamon-cockpit.git/);
    assert.equal(readFileSync(join(folder, 'installed'), 'utf8').trim(), destination);
    assert.ok(existsSync(source));
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
