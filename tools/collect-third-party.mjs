import { existsSync, readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = join(root, 'third-party'); mkdirSync(output, { recursive: true });
const records = [];
const supplements = JSON.parse(readFileSync(join(root, 'third-party-supplements/sources.json')));
function collect(ecosystem, name, version, directory, license, metadata = []) {
  const id = name.replace(/[^a-zA-Z0-9._-]/g, '_') + '-' + version;
  const destination = join(output, ecosystem, id); mkdirSync(destination, { recursive: true });
  const files = [];
  function visit(dir, depth = 0) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory() && depth < 2 && /^(licenses?|notices?)$/i.test(entry.name)) visit(path, depth + 1);
      if (entry.isFile() && (/licen[cs]e|notice|copying|copyright/i.test(entry.name) || depth > 0 || metadata.includes(entry.name))) {
        const rel = relative(directory, path); const dest = join(destination, rel); mkdirSync(resolve(dest, '..'), { recursive: true }); copyFileSync(path, dest);
        files.push({ path: relative(output, dest).replaceAll('\\', '/'), sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
      }
    }
  }
  visit(directory);
  const sources = supplements.filter(s => s.packages.includes(name + '@' + version));
  for (const source of sources) {
    const bytes = readFileSync(join(root, 'third-party-supplements', source.file));
    const dest = join(destination, source.file); writeFileSync(dest, bytes);
    files.push({ path: relative(output, dest).replaceAll('\\', '/'), sha256: createHash('sha256').update(bytes).digest('hex'), upstream: source.url });
  }
  const embeddedMit = name === 'imurmurhash' && version === '0.1.4' && files.some(f => /readme/i.test(f.path) && /Copyright \(c\) 2013 Gary Court, Jens Taylor/.test(readFileSync(join(output, f.path), 'utf8')));
  const ownerConfirmed = ecosystem === 'npm' && (name === 'size-sensor' && version === '1.0.3' || name === 'tr46' && version === '0.0.3');
  records.push({ ecosystem, name, version, license, files, ownerConfirmed, requiresReview: !ownerConfirmed && !embeddedMit && !files.some(f => /licen[cs]e|notice|copying|copyright/i.test(f.path.split('/').at(-1))) });
}
const lock = JSON.parse(readFileSync(join(root, 'web/package-lock.json')));
for (const [path, item] of Object.entries(lock.packages)) {
  if (!path || !existsSync(join(root, 'web', path))) continue;
  const dir = join(root, 'web', path); const meta = JSON.parse(readFileSync(join(dir, 'package.json')));
  collect('npm', meta.name, item.version, dir, item.license ?? meta.license ?? 'not declared', ['package.json', 'README.md', 'readme.md']);
}
const cache = process.env.NUGET_PACKAGES || join(root, '.cache/nuget/packages');
if (!existsSync(cache)) throw Error('Restore NuGet dependencies into NUGET_PACKAGES before collecting notices.');
for (const pkg of readdirSync(cache, { withFileTypes: true }).filter(x => x.isDirectory())) {
  for (const version of readdirSync(join(cache, pkg.name), { withFileTypes: true }).filter(x => x.isDirectory())) {
    const dir = join(cache, pkg.name, version.name); const nuspec = readdirSync(dir).find(x => x.endsWith('.nuspec'));
    if (!nuspec) continue;
    const xml = readFileSync(join(dir, nuspec), 'utf8');
    collect('nuget', pkg.name, version.name, dir, xml.match(/<license[^>]*>([^<]+)<\/license>/)?.[1] ?? 'see package metadata', [nuspec, 'README.md']);
  }
}
collect('source', 'shadcn-ui', '2023', join(root, 'web/src/components/ui'), 'MIT');
const manifest = { scope: 'Installed npm packages and locally restored NuGet packages, including development dependencies; not an artifact inclusion claim.', records };
writeFileSync(join(output, 'inventory.json'), JSON.stringify(manifest, null, 2) + '\n');
const missing = records.filter(r => r.requiresReview);
writeFileSync(join(output, 'REVIEW.md'), '# Notice collection review\n\nThis collection preserves supplied texts and metadata. A detected notice file does not establish completeness. Runtime packages for every shipped target must be restored before final collection.\n\nOwner confirmation, 1 November 2026: Peter Kretz independently checked size-sensor 1.0.3 as ISC and tr46 0.0.3 as MIT, and explicitly closed publication item 3. These records are marked ownerConfirmed in the inventory. This confirmation does not assert that a missing historical upstream notice file was newly found.\n\nRemaining flagged records:\n\n' + (missing.length ? missing.map(r => `- ${r.ecosystem}: ${r.name} ${r.version} (${r.license})`).join('\n') : 'None.') + '\n');
console.log(`Collected ${records.length} package records; ${missing.length} require explicit notice review.`);
