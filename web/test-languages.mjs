import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalog } from './src/i18n/catalog.ts';
import { getLanguage, getLocale, isLanguage, setLanguage, t, text } from './src/i18n/core.ts';
import { chartNumber, chartTime, stateLabel } from './src/charts/chartFormat.ts';
import { lineOptions } from './src/charts/historyOptions.ts';
import { settingsEntries, settingsText } from './src/i18n/settings.ts';

test('settings labels and safety messages exist in all supported languages', () => {
  for (const [source, translations] of Object.entries(settingsEntries)) {
    assert.equal(translations.length, 6, source);
    assert.ok(translations.every(value => value.trim().length > 0), source);
    for (const [index, language] of ['de','en','fr','es','it','pt'].entries()) {
      setLanguage(language);
      assert.equal(settingsText(source), translations[index]);
    }
  }
  setLanguage('de');
});

test('all catalogue entries contain five translations with identical placeholders', () => {
  const placeholders = value => [...value.matchAll(/\{(\d+)\}/g)].map(m => m[1]).sort();
  for (const [source, translations] of Object.entries(catalog)) {
    assert.equal(translations.length, 5, source);
    for (const translated of translations) {
      assert.ok(translated.trim(), source);
      assert.deepEqual(placeholders(translated), placeholders(source), source);
    }
  }
});

test('language selection, interpolation and derived labels keep stable data identifiers', () => {
  for (const [language, overview, locale] of [['de', 'Übersicht', 'de-DE'], ['en', 'Overview', 'en-GB'], ['fr', 'Vue d’ensemble', 'fr-FR'], ['es', 'Resumen', 'es-ES'], ['it', 'Panoramica', 'it-IT'], ['pt', 'Visão geral', 'pt-PT']]) {
    setLanguage(language);
    assert.equal(getLocale(), locale);
    assert.equal(t('Übersicht'), overview);
    assert.equal(t('flowTemperature'), 'flowTemperature');
    assert.equal(text(0), 0);
    assert.equal(text(null), null);
    assert.equal(t('H76'), 'H76');
    assert.equal(t(' · vor {0} s', [5]).includes('5'), true);
  }
  setLanguage('en');
  assert.equal(t('Vorlauf – Diagramm öffnen'), 'Flow – Open chart');
  assert.equal(t(' Tage Aufbewahrung'), ' days retention');
  assert.equal(t('Ganze Zahl von -20 bis 15 °C.'), 'Whole number from -20 to 15 °C.');
  assert.equal(t('Nicht übernommen. Außen niedrig muss kleiner als Außen hoch sein. Der bisherige Wert bleibt erhalten.'),
    'Not applied. The low outdoor value must be below the high outdoor value. The previous value is retained.');
  assert.equal(isLanguage('it'), true);
  assert.equal(isLanguage('pt'), true);
  setLanguage('invalid');
  assert.equal(getLanguage(), 'en');
  setLanguage('de');
});

test('numbers, state labels and chart names switch language without changing measurements', () => {
  const data = { from: '2026-01-01T00:00:00Z', to: '2026-01-01T01:00:00Z', bucketSeconds: 30,
    series: [{ key: 'flowTemperature', unit: '°C', source: 'simulator', aggregation: 'mean', points: [
      { time: '2026-01-01T00:00:00Z', value: 0, quality: 'valid' },
      { time: '2026-01-01T00:00:30Z', value: null, quality: 'unknown' },
    ] }] };
  for (const [language, name, number, state] of [['de', 'Vorlauf', '34,5', 'Heizen (0)'], ['en', 'Flow', '34.5', 'Heating (0)'], ['fr', 'Départ', '34,5', 'Chauffage (0)'], ['es', 'Impulsión', '34,5', 'Calefacción (0)'], ['it', 'Mandata', '34,5', 'Riscaldamento (0)'], ['pt', 'Ida', '34,5', 'Aquecimento (0)']]) {
    setLanguage(language);
    assert.equal(chartNumber(34.5), number);
    assert.equal(stateLabel('operatingMode', 0), state);
    const option = lineOptions(data, { flowTemperature: 'Vorlauf' });
    assert.equal(option.series[0].name, name);
    assert.deepEqual(option.series[0].data.map(p => p[1]), [0, null]);
    assert.equal(option.series[0].connectNulls, false);
    assert.match(chartTime('2026-01-01T00:00:00Z'), /01:00:00/);
  }
  setLanguage('de');
});


test('empty command logs are complete sentences in every language', () => {
  for (const [language, simulator, live] of [
    ['de', 'Noch keine Simulatorbefehle.', 'Noch keine Live-Befehle.'],
    ['en', 'No simulator commands yet.', 'No live commands yet.'],
    ['fr', 'Aucune commande du simulateur pour le moment.', 'Aucune commande réelle pour le moment.'],
    ['es', 'Todavía no hay órdenes del simulador.', 'Todavía no hay órdenes reales.'],
    ['it', 'Nessun comando del simulatore per il momento.', 'Nessun comando reale per il momento.'],
    ['pt', 'Ainda não há comandos do simulador.', 'Ainda não há comandos reais.'],
  ]) {
    setLanguage(language);
    assert.equal(t('Noch keine Simulatorbefehle.'), simulator);
    assert.equal(t('Noch keine Live-Befehle.'), live);
  }
  setLanguage('de');
});
