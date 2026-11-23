import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { readReleaseNotes } from './build/releaseNotes.ts';
const root = resolve(import.meta.dirname, '..');
function fixture() {
  const temporary = mkdtempSync(resolve(tmpdir(), 'cockpit-release-notes-'));
  const version = JSON.parse(readFileSync(resolve(root, 'web/package.json'), 'utf8')).version;
  for (const file of ['web/package.json', 'Directory.Build.props', 'documentation/RELEASE-NOTES.md', `documentation/release-notes/${version}.json`]) {
    mkdirSync(resolve(temporary, file, '..'), { recursive: true });
    writeFileSync(resolve(temporary, file), readFileSync(resolve(root, file)));
  }
  return { temporary, version };
}
test('build includes current release notes in all six languages', () => {
  const notes = readReleaseNotes(root);
  assert.deepEqual(Object.keys(notes.translations).sort(), ['de', 'en', 'es', 'fr', 'it', 'pt']);
  assert.equal(notes.version, JSON.parse(readFileSync(resolve(root, 'web/package.json'), 'utf8')).version);
  assert.ok(notes.translations.en.items[0].startsWith('Move the MQTT'));
  assert.ok(notes.translations.de.items[0].startsWith('Die MQTT'));
});
for (const change of ['source', 'missing-language', 'version']) test(`build rejects outdated release data: ${change}`, () => {
  const { temporary, version } = fixture();
  try {
    if (change === 'source') {
      const path = resolve(temporary, 'documentation/RELEASE-NOTES.md');
      writeFileSync(path, readFileSync(path, 'utf8').replace('Move the MQTT', 'Update the MQTT'));
    } else if (change === 'version') {
      const path = resolve(temporary, 'web/package.json');
      const metadata = JSON.parse(readFileSync(path, 'utf8')); metadata.version = '99.0.0'; writeFileSync(path, JSON.stringify(metadata));
    } else {
      const path = resolve(temporary, `documentation/release-notes/${version}.json`);
      const notes = JSON.parse(readFileSync(path, 'utf8')); delete notes.translations.fr; writeFileSync(path, JSON.stringify(notes));
    }
    assert.throws(() => readReleaseNotes(temporary));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
