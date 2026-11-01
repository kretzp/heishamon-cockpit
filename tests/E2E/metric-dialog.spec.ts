import { test, expect, type Page } from './coverage-fixture';

test('smoothed trend starts enabled and metric opt-out persists', async ({ page }) => {
  await fixtures(page);
  await page.route('**/api/v1/history?*', r => {
    const q = new URL(r.request().url()).searchParams;
    const from = q.get('from')!, to = q.get('to')!, bucketSeconds = Number(q.get('bucketSeconds'));
    return r.fulfill({ json: { from, to, bucketSeconds, series: q.get('keys')!.split(',').map(key => ({ key, unit: '°C', source: 'simulator', aggregation: 'mean',
      points: [20, 21, 28, 22, 23, 21, 20].map((value, i) => ({ time: new Date(Date.parse(from) + i * bucketSeconds * 1000).toISOString(), value, quality: 'valid', samples: 1 })) })) } });
  });
  await page.goto('/');
  const open = page.getByRole('button', { name: 'Vorlauf – Diagramm öffnen', exact: true });
  await open.click();
  const dialog = page.getByRole('dialog');
  const toggle = dialog.getByRole('checkbox', { name: 'Geglättete Trendkurve (Fit)', exact: true });
  await expect(toggle).toBeChecked();
  const trend = dialog.locator('.metric-detail-chart svg path[stroke-width="3"][stroke-dasharray]');
  await expect(trend).toHaveCount(1);
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(toggle).not.toBeChecked();
  await expect(trend).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.reload(); await open.click();
  await expect(toggle).not.toBeChecked();
  await toggle.check(); await expect(trend).toHaveCount(1);
});

async function fixtures(page: Page) {
  await page.route('**/api/v1/storage', r => r.fulfill({ json: { state: 'ready', sampleSeconds: 30, retentionDays: 700 } }));
  await page.route(/\/api\/v1\/history\?/, r => {
    const q = new URL(r.request().url()).searchParams;
    const from = q.get('from')!, to = q.get('to')!, bucketSeconds = Number(q.get('bucketSeconds'));
    return r.fulfill({ json: { from, to, bucketSeconds, series: q.get('keys')!.split(',').map(key => ({ key, unit: '°C', source: 'simulator', aggregation: 'mean',
      points: [0, 1, 2, 3].map(i => ({ time: new Date(Date.parse(from) + i * bucketSeconds * 1000).toISOString(), value: i === 1 ? null : i, quality: i === 1 ? 'unknown' : 'valid', samples: 1 })) })) } });
  });
}

test('quiet mode appears in overview order, opens by keyboard and follows operating mode in history', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('heishamon-cockpit.overview-order.v1', JSON.stringify({
    details: ['heatpumpState', 'internalHeaterState', 'heatingControlMode', 'activeError']
  })));
  await fixtures(page);
  await page.route(/\/api\/v1\/history(?:\/intervals)?\?/, r => {
    const q = new URL(r.request().url()).searchParams;
    const from = q.get('from')!, to = q.get('to')!, bucketSeconds = Number(q.get('bucketSeconds'));
    return r.fulfill({ json: { from, to, bucketSeconds, series: q.get('keys')!.split(',').map(key => ({
      key, unit: 'enum', source: 'simulator', aggregation: 'observedIntervals', points: [],
      intervals: [{ from, to, value: 3, quality: 'valid' }]
    })) } });
  });
  await page.goto('/');
  await expect(page.locator('.plant-details [data-sort-key]')).toHaveCount(5);
  expect(await page.locator('.plant-details [data-sort-key]').evaluateAll(cards => cards.map(card => card.getAttribute('data-sort-key'))))
    .toEqual(['heatpumpState', 'internalHeaterState', 'heatingControlMode', 'quietMode', 'activeError']);
  await page.getByRole('button', { name: 'Flüstermodus – Diagramm öffnen', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').locator('svg').getByText('Stufe 3 (3)', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  await expect(page.locator('.state-timeline h3').filter({ hasText: /^(Betriebsart|Flüstermodus|Heizstab)$/ }))
    .toHaveText(['Betriebsart', 'Flüstermodus', 'Heizstab']);
});

test('five overview status tiles share a desktop row without overflow and remain readable on mobile', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('.plant-details > article');
  await expect(cards).toHaveCount(5);
  for (const width of [1920, 1440, 1280, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const boxes = await cards.evaluateAll(items => items.map(item => {
      const box = item.getBoundingClientRect();
      return { top: box.top, width: box.width, overflow: item.scrollWidth > item.clientWidth + 1 };
    }));
    if (width > 960) expect(Math.max(...boxes.map(b => b.top)) - Math.min(...boxes.map(b => b.top))).toBeLessThan(1);
    else expect(boxes[1].top).toBeGreaterThan(boxes[0].top);
    expect(boxes.every(b => !b.overflow), `Card overflow at ${width}px: ${JSON.stringify(boxes)}`).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test('overview temperatures show actual and target while opening only actual history', async ({ page, request }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  let targetQuality = 'valid';
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: {
    ...snapshot, revision: Number.MAX_SAFE_INTEGER,
    values: snapshot.values.map((v: { key: string }) => {
      const values: Record<string, number> = { dhwTemperature: 46, dhwTargetTemperature: 53, indoorTemperature: 21, indoorTargetTemperature: 22 };
      if (!(v.key in values)) return v;
      const isTarget = v.key.endsWith('TargetTemperature');
      return { ...v, value: isTarget && targetQuality === 'unknown' ? null : values[v.key],
        quality: isTarget ? targetQuality : 'valid', retained: false };
    })
  } }));
  await fixtures(page);
  const requestedKeys: string[] = [];
  page.on('request', r => {
    const url = new URL(r.url());
    if (url.pathname === '/api/v1/history') requestedKeys.push(url.searchParams.get('keys')!);
  });
  await page.goto('/');
  await expect(page.locator('.dhwTemperature .value')).toHaveText('46 °C / 53 °C');
  await expect(page.locator('.indoorTemperature .value')).toHaveText('21 °C / 22 °C');
  for (const [name, key] of [['Warmwasser', 'dhwTemperature'], ['Innen', 'indoorTemperature']]) {
    await page.getByRole('button', { name: `${name} – Diagramm öffnen`, exact: true }).click();
    await expect.poll(() => requestedKeys.includes(key)).toBeTruthy();
    await page.keyboard.press('Escape');
  }
  expect(requestedKeys).not.toContain('dhwTargetTemperature');
  expect(requestedKeys).not.toContain('indoorTargetTemperature');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  targetQuality = 'unknown';
  await page.reload();
  await expect(page.locator('.dhwTemperature .value')).toHaveText('46 °C / —');
  await expect(page.locator('.indoorTemperature .value')).toHaveText('21 °C / —');
  targetQuality = 'stale';
  await page.reload();
  await expect(page.locator('.dhwTemperature .target-quality')).toContainText('Veraltet');
  await expect(page.locator('.indoorTemperature .target-quality')).toContainText('Veraltet');
});

test('metric dialog opens with keyboard, persists options, handles invalid JSON and restores focus', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await fixtures(page); await page.goto('/');
  const open = page.getByRole('button', { name: 'Vorlauf – Diagramm öffnen', exact: true });
  await open.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible(); await expect(dialog.locator('.metric-detail-chart svg')).toBeVisible();
  await expect(dialog).toContainText('SIMULATION');
  await page.screenshot({ path: info.outputPath('metric-chart.png') });
  await dialog.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await dialog.getByRole('button', { name: 'Gesamter Zeitraum', exact: true }).click();
  const imageDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Diagrammbild speichern', exact: true }).click();
  expect((await imageDownload).suggestedFilename()).toBe('messwertdiagramm.svg');
  await dialog.getByText('Diagramm anpassen', { exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Darstellung', exact: true }).selectOption('bar');
  await dialog.getByLabel('Erweiterte ECharts-Optionen (JSON)').fill('{');
  await dialog.getByRole('button', { name: 'Optionen anwenden', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Ungültige Optionen');
  await dialog.getByLabel('Erweiterte ECharts-Optionen (JSON)').fill('{"title":{"text":"Mein Vorlauf"},"series":[{"markLine":{"data":[{"yAxis":2}]}}]}');
  await dialog.getByRole('button', { name: 'Optionen anwenden', exact: true }).click();
  await expect(dialog.locator('svg')).toContainText('Mein Vorlauf');
  await dialog.getByRole('combobox', { name: 'Renderer', exact: true }).selectOption('canvas');
  await expect(dialog.locator('canvas').first()).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Renderer', exact: true }).selectOption('svg');
  await dialog.getByText('Originalwerte und Qualität (letzte 100 Einträge)', { exact: true }).click();
  await expect(dialog.locator('tbody')).toContainText('0 °C'); await expect(dialog.locator('tbody')).toContainText('Unbekannt');
  await page.screenshot({ path: info.outputPath('metric-dialog.png') });
  expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBeTruthy();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(open).toBeFocused();
  await page.reload(); await open.click(); await dialog.getByText('Diagramm anpassen', { exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Darstellung', exact: true })).toHaveValue('bar');
  await dialog.getByRole('button', { name: 'Einstellungen zurücksetzen' }).click();
  await expect(dialog.getByRole('combobox', { name: 'Darstellung', exact: true })).toHaveValue('line');
  await dialog.getByRole('button', { name: 'Diagramm schließen' }).click();
  await page.getByRole('button', { name: 'Kacheln anordnen', exact: true }).click();
  await expect(open).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('all numerical overview tiles use supported history keys and state charts render labels', async ({ page, request }) => {
  await expect.poll(async () => (await (await request.get('/api/v1/storage')).json()).state).toBe('ready');
  await page.goto('/');
  const keys = await page.locator('[data-sort-key]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-sort-key')!).filter(k => k !== 'activeError'));
  expect(keys.length).toBe(25);
  expect(keys).toContain('heishamonCop');
  for (const key of keys) {
    const q = new URLSearchParams({ keys: key, from: new Date(Date.now() - 3600000).toISOString(), to: new Date().toISOString(), bucketSeconds: '30' });
    const response = await request.get('/api/v1/history?' + q);
    expect(response.ok(), key).toBeTruthy();
    expect((await response.json()).series[0].key).toBe(key);
  }
  await page.route('**/api/v1/history/intervals?*', r => {
    const q = new URL(r.request().url()).searchParams;
    return r.fulfill({ json: { from: q.get('from'), to: q.get('to'), bucketSeconds: 30, resolution: 'sampled', series: [{ key: 'heatpumpState', unit: 'enum', source: 'simulator', aggregation: 'observedIntervals', points: [], intervals: [{ from: q.get('from'), to: q.get('to'), value: 1, quality: 'valid' }] }] } });
  });
  await page.getByRole('button', { name: 'Wärmepumpe – Diagramm öffnen', exact: true }).click();
  await expect(page.getByRole('dialog').locator('svg')).toContainText('Ein (1)');
});

test('metric dialog reports loading failures and uses error events for text codes', async ({ page }) => {
  await fixtures(page); await page.goto('/');
  await page.route('**/api/v1/history?*', r => r.fulfill({ status: 503, json: {} }));
  await page.getByRole('button', { name: 'Innen – Diagramm öffnen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Verlauf konnte nicht geladen werden');
  await expect(dialog.getByRole('button', { name: 'Messwerte als CSV' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Diagramm schließen' }).click();
  await page.getByRole('button', { name: 'Fehlerstatus – Diagramm öffnen', exact: true }).click();
  await expect(dialog).toContainText('Fehlercodes sind Textwerte');
  await expect(dialog.getByLabel('Ereignisart')).toHaveValue('error');
});
