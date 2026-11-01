import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve('.');
const inventory = JSON.parse(readFileSync(join(root, 'third-party/inventory.json')));
const results = [];
for (const runtime of ['win-x64', 'linux-x64', 'linux-arm64']) {
  const dir = join(root, '.cache/runtime-license-check', runtime);
  const deps = JSON.parse(readFileSync(join(dir, 'Cockpit.Web.deps.json')));
  const packages = [];
  for (const [id, metadata] of Object.entries(deps.libraries)) {
    if (metadata.type === 'project') continue;
    const split = id.lastIndexOf('/'); const name = id.slice(0, split).replace(/^runtimepack\./, '').toLowerCase(); const version = id.slice(split + 1);
    const notice = inventory.records.find(r => r.ecosystem === 'nuget' && r.name === name && r.version === version);
    if (!notice || notice.requiresReview) throw Error(`Missing notice for ${runtime}: ${id}`);
    packages.push({ id, noticeFiles: notice.files.map(f => f.path) });
  }
  const nativeSqlite = readdirSync(dir).filter(f => /e_sqlite3/.test(f)).map(file => ({ file, sha256: createHash('sha256').update(readFileSync(join(dir, file))).digest('hex') }));
  if (!nativeSqlite.length) throw Error('Missing native SQLite: ' + runtime);
  results.push({ runtime, target: deps.runtimeTarget.name, packages, nativeSqlite });
}
writeFileSync(join(root, 'third-party/runtime-audit.json'), JSON.stringify(results, null, 2) + '\n');
console.log('PASS: all three published runtime dependency sets have collected notices and native SQLite.');
