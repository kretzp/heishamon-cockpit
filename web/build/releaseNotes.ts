import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

type Notes = { title: string; items: string[] };
const languages = ['de', 'fr', 'es', 'it', 'pt'] as const;
export function readReleaseNotes(root: string) {
  const version: string = JSON.parse(readFileSync(resolve(root, 'web/package.json'), 'utf8')).version;
  const backendVersion = readFileSync(resolve(root, 'Directory.Build.props'), 'utf8').match(/<Version>([^<]+)<\/Version>/)?.[1];
  if (version !== backendVersion) throw new Error('Frontend and backend release versions must match.');
  const markdown = readFileSync(resolve(root, 'documentation/RELEASE-NOTES.md'), 'utf8').replace(/\r\n/g, '\n');
  const section = markdown.split(/(?=^## )/m).find(section => section.startsWith(`## ${version} — `))?.trim();
  if (!section) throw new Error(`Release notes missing for ${version}.`);
  const [heading, ...lines] = section.split('\n');
  const header = heading.match(/^## [^ ]+ — (.+), (\d{4}-\d{2}-\d{2})$/);
  if (!header) throw new Error(`Invalid release heading for ${version}.`);
  const items: string[] = [];
  for (const line of lines) {
    if (line.startsWith('- ')) items.push(line.slice(2).trim());
    else if (line.trim() && items.length) items[items.length - 1] += ' ' + line.trim();
  }
  if (!items.length) throw new Error(`Empty release notes for ${version}.`);
  const localized = JSON.parse(readFileSync(resolve(root, `documentation/release-notes/${version}.json`), 'utf8'));
  if (localized.sourceSha256 !== createHash('sha256').update(section).digest('hex'))
    throw new Error(`Release notes changed: update all translations for ${version}.`);
  const translations: Record<string, Notes> = { en: { title: header[1], items } };
  for (const language of languages) {
    const notes = localized.translations[language];
    if (!notes || typeof notes.title !== 'string' || !notes.title.trim() || !Array.isArray(notes.items)
      || notes.items.length !== items.length || notes.items.some((item: unknown) => typeof item !== 'string' || !item.trim()))
      throw new Error(`Release translation missing or incomplete: ${version}/${language}.`);
    translations[language] = notes;
  }
  return { version, date: header[2], translations };
}
export function releaseNotesPlugin(root: string): Plugin {
  const id = 'virtual:release-notes';
  return {
    name: 'cockpit-release-notes',
    resolveId(source) { if (source === id) return '\0' + id; },
    load(source) { if (source === '\0' + id) return `export default ${JSON.stringify(readReleaseNotes(root))};`; }
  };
}
