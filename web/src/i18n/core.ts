import { catalog } from './catalog.ts';

export const languages = ['de', 'en', 'fr', 'es', 'it', 'pt'] as const;
export type Language = typeof languages[number];
export const languageStorageKey = 'heishamon-cockpit.language.v1';
const locales = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT' };
let language: Language = 'de';
const listeners = new Set<() => void>();
export const isLanguage = (value: unknown): value is Language => languages.includes(value as Language);
export const getLanguage = () => language;
export const getLocale = () => locales[language];
export function subscribeLanguage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function setLanguage(next: Language) {
  if (!isLanguage(next)) return;
  language = next;
  if (typeof document !== 'undefined') { document.documentElement.lang = next; document.title = t('HeishaMon Cockpit'); }
  listeners.forEach(listener => listener());
}
export function readLanguage(): Language {
  try { const value = localStorage.getItem(languageStorageKey); return isLanguage(value) ? value : 'de'; }
  catch { return 'de'; }
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.keys(catalog).filter(key => /\{\d+\}/.test(key)).sort((a, b) => b.length - a.length).map(key => ({
  key, pattern: new RegExp('^' + key.split(/\{\d+\}/).map(escape).join('([\\s\\S]*?)') + '$'),
}));
// Derived UI labels may concatenate source fragments (e.g. a metric and its unit).
// This is used only at presentation boundaries, never for identifiers or stored data.
const fragments = Object.keys(catalog).filter(key => !/\{\d+\}/.test(key)).sort((a, b) => b.length - a.length);
const fragmentPattern = new RegExp(fragments.map(key =>
  (/^[\p{L}\p{N}]/u.test(key) ? '(?<![\\p{L}\\p{N}])' : '') + escape(key) +
  (/[\p{L}\p{N}]$/u.test(key) ? '(?![\\p{L}\\p{N}])' : '')).join('|'), 'gu');
export function t(source: string, values: readonly unknown[] = []): string {
  const index = languages.indexOf(language) - 1;
  const entry = catalog[source];
  // JSX fragments often retain surrounding spaces. Match the entire label before
  // translating individual words, otherwise e.g. " Tage" masks "Tage Aufbewahrung".
  const trimmed = source.trim();
  if (index >= 0 && !entry && trimmed !== source && catalog[trimmed]) {
    return source.slice(0, source.indexOf(trimmed)) + t(trimmed, values) + source.slice(source.indexOf(trimmed) + trimmed.length);
  }
  let result = index < 0 ? source : entry?.[index];
  if (result === undefined) {
    for (const template of templates) {
      const match = template.pattern.exec(source);
      if (match) return t(template.key, match.slice(1).map(value => t(value)));
    }
    result = source.replace(fragmentPattern, key => catalog[key]?.[index] ?? key);
  }
  return result.replace(/\{(\d+)\}/g, (placeholder, index: string) => values[Number(index)] === undefined ? placeholder : String(values[Number(index)]));
}
/** Translate string-valued display expressions while retaining React nodes and numbers. */
export function text<T>(value: T): T { return (typeof value === 'string' ? t(value) : value) as T; }
