import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowed = new Set(['win-x64', 'linux-x64', 'linux-arm64']);
const rid = process.argv[2];
if (!allowed.has(rid)) throw Error('Choose win-x64, linux-x64 or linux-arm64.');
const tool = (name) => process.platform === 'win32' && name === 'npm' ? 'npm.cmd' : name;
function run(exe, args, cwd = root) {
  const result = spawnSync(tool(exe), args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && exe === 'npm' });
  if (result.status !== 0) throw Error(`${exe} failed (${result.status ?? result.error?.message}).`);
}
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 24) throw Error('Node.js 24 is required.');
const version = spawnSync('dotnet', ['--version'], { cwd: root, encoding: 'utf8' });
if (version.status !== 0 || version.stdout.trim() !== '10.0.303') throw Error('.NET SDK 10.0.303 is required.');
const dir = mkdtempSync(join(tmpdir(), 'heat-pump-package-'));
const stage = join(dir, 'payload'); mkdirSync(stage);
run('npm', ['ci'], join(root, 'web'));
run('npm', ['run', 'build'], join(root, 'web'));
run('dotnet', ['publish', 'src/Cockpit.Web/Cockpit.Web.csproj', '-c', 'Release', '-r', rid, '--self-contained', 'true', '-o', join(stage, 'app'), '-p:RestoreLockedMode=true', `-p:NuGetLockFilePath=packages.${rid}.lock.json`, '-m:1', '-p:BuildInParallel=false']);
copyFileSync(join(root, 'tools', 'cockpit_mcp.py'), join(stage, 'app', 'cockpit_mcp.py'));
for (const notice of ['LICENSE', 'COPYRIGHT']) copyFileSync(join(root, notice), join(stage, 'app', notice));
copyFileSync(join(root, 'THIRD-PARTY-NOTICES.md'), join(stage, 'app', 'THIRD-PARTY-NOTICES.md'));
cpSync(join(root, 'third-party'), join(stage, 'app', 'third-party'), { recursive: true });
copyFileSync(join(root, 'installation', rid.startsWith('win-') ? 'install.ps1' : 'install.sh'), join(stage, rid.startsWith('win-') ? 'install.ps1' : 'install.sh'));
const serviceFiles = rid.startsWith('win-') ? ['install-service.ps1', 'WinSW-LICENSE.txt'] : ['install-service.sh'];
for (const file of serviceFiles) copyFileSync(join(root, 'installation', file), join(stage, file));
writeFileSync(join(stage, 'PACKAGE-INFO.txt'), `HeishaMon Cockpit\nTarget: ${rid}\nLocal development package; not approved for public distribution.\n`);
const output = process.env.HPC_PACKAGE_OUTPUT ? resolve(process.env.HPC_PACKAGE_OUTPUT) : join(root, 'artifacts');
mkdirSync(output, { recursive: true });
const archive = join(output, `heishamon-cockpit-${rid}.tar.gz`);
if (existsSync(archive)) throw Error(`Package already exists: ${archive}. Move it before building again.`);
run('tar', ['-czf', archive, '-C', stage, '.']);
console.log(`Package: ${archive}`);
console.log(`Build staging retained for inspection: ${dir}`);
