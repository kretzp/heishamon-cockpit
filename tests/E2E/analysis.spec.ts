import { test, expect, type Page } from './coverage-fixture';

async function fixtures(page: Page) {
  const requests: URL[] = [];
  await page.route('**/api/v1/storage', r => r.fulfill({ json: { state: 'ready', sampleSeconds: 30, retentionDays: 700 } }));
  await page.route(/\/api\/v1\/history(?:\/pairs|\/intervals)?\?/, async route => {
    const url = new URL(route.request().url()); requests.push(url);
    const q = url.searchParams, from = q.get('from')!, to = q.get('to')!, bucketSeconds = Number(q.get('bucketSeconds'));
    const start = Date.parse(from), end = Date.parse(to);
    if (url.pathname.endsWith('/pairs')) {
      return route.fulfill({ json: { from, to, bucketSeconds, source: 'simulator', maxPairSeconds: 10,
        points: Array.from({ length: Math.min(800, Math.ceil((end - start) / (bucketSeconds * 1000))) }, (_, i) => ({ time: new Date(start + i * bucketSeconds * 1000).toISOString(),
          flow: i === 2 ? null : 30, return: i === 2 ? null : 35, spread: i === 2 ? null : -5,
          quality: i === 2 ? 'unknown' : 'valid', validPairs: i === 2 ? 0 : 1, expectedPairs: 1 })) } });
    }
    if (url.pathname.endsWith('/intervals')) return route.fulfill({ json: { from, to, bucketSeconds: 30, sampleSeconds: 30, resolution: 'sampled',
      series: q.get('keys')!.split(',').map(key => ({ key, unit: 'enum', source: 'simulator', aggregation: 'observedIntervals', points: [], intervals: [
        { from: new Date(start + (end - start) / 4).toISOString(), to: new Date(start + (end - start) / 2).toISOString(), value: 1, quality: 'valid', startObserved: true, endObserved: false }
      ] })) } });
    return route.fulfill({ json: { from, to, bucketSeconds, series: q.get('keys')!.split(',').map((key, j) => ({ key, unit: key.includes('Power') ? 'W' : key === 'waterPressure' ? 'bar' : '°C', source: 'simulator', aggregation: 'mean',
      points: Array.from({ length: Math.min(800, Math.ceil((end - start) / (bucketSeconds * 1000))) }, (_, i) => ({ time: new Date(start + i * bucketSeconds * 1000).toISOString(), value: j === 0 ? 30 : 35, quality: 'valid', samples: 1 })) })) } });
  });
  return requests;
}

test('each history chart owns its range, zoom, refresh, height and CSV selection', async ({ page }) => {
  const requests = await fixtures(page);
  await page.goto('/'); await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  await expect(page.locator('.state-timeline')).toHaveCount(7);
  const temperature = page.locator('[data-history-kind="temperature"]');
  const pressure = page.locator('[data-history-kind="pressure"]');
  const quiet = page.locator('[data-history-kind="state"]').filter({ has: page.getByRole('heading', { name: 'Flüstermodus', exact: true }).first() });
  await expect(pressure.getByLabel('Bis (UTC)')).not.toHaveValue('');
  const pressureTo = await pressure.getByLabel('Bis (UTC)').inputValue();
  const quietTo = await quiet.getByLabel('Bis (UTC)').inputValue();
  await temperature.getByRole('button', { name: 'Vergrößern', exact: true }).click();
  await expect(temperature.getByLabel('Live folgen', { exact: true })).not.toBeChecked();
  await expect(pressure.getByLabel('Live folgen', { exact: true })).toBeChecked();
  await expect(pressure.getByLabel('Bis (UTC)')).toHaveValue(pressureTo);
  await expect(quiet.getByLabel('Bis (UTC)')).toHaveValue(quietTo);
  await expect.poll(() => requests.some(u => u.pathname === '/api/v1/history' && u.searchParams.get('keys')!.includes('flowTemperature') && Date.parse(u.searchParams.get('to')!) - Date.parse(u.searchParams.get('from')!) === 3 * 3600000)).toBeTruthy();
  const selected = [...requests].reverse().find(u => u.pathname === '/api/v1/history' && u.searchParams.get('keys')!.includes('flowTemperature'))!.searchParams;
  await temperature.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
  await expect(temperature.getByRole('status')).toHaveCount(0);
  await temperature.getByLabel('Diagrammhöhe').selectOption('320');
  await expect(temperature.locator('.history-chart')).toHaveCSS('height', '320px');
  await expect(pressure.locator('.history-chart')).toHaveCSS('height', '640px');
  const exported = page.waitForRequest(r => r.url().includes('/api/v1/export.csv?'));
  await temperature.getByRole('button', { name: 'CSV exportieren', exact: true }).click();
  const q = new URL((await exported).url()).searchParams;
  expect(q.get('from')).toBe(selected.get('from')); expect(q.get('to')).toBe(selected.get('to'));
  await quiet.getByRole('button', { name: '1 h', exact: true }).click();
  await expect.poll(() => requests.some(u => u.pathname.endsWith('/intervals') && u.searchParams.get('keys') === 'quietMode' && Date.parse(u.searchParams.get('to')!) - Date.parse(u.searchParams.get('from')!) === 3600000)).toBeTruthy();
  await expect(temperature.getByLabel('Live folgen', { exact: true })).not.toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('E2 signed pair band and observed sterilization markers stay distinct from completion', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await fixtures(page); await page.goto('/'); await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  await page.getByLabel('Spreizungsband', { exact: true }).check();
  await expect(page.locator('.history-chart').first().locator('path[fill="#177b83"]')).not.toHaveCount(0);
  await page.getByText('Wertepaare und Abdeckung (letzte 20 Intervalle)', { exact: true }).click();
  await expect(page.locator('[data-history-kind="temperature"]')).toContainText('-5,00 K');
  const events = page.getByRole('region', { name: 'Sterilisationsereignisse' });
  await expect(events).toContainText('Aktivwechsel beobachtet');
  await expect(events).toContainText('Ende unbekannt');
  await expect(events).toContainText('kein Nachweis eines abgeschlossenen Sterilisationslaufs');
  await page.locator('.history-chart').first().screenshot({ path: info.outputPath('paired-band.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('E2 backend validates analysis ranges and returns source and resolution', async ({ request }) => {
  await expect.poll(async () => (await (await request.get('/api/v1/storage')).json()).state).toBe('ready');
  const params = new URLSearchParams({ keys: 'flowTemperature,returnTemperature', from: new Date(Date.now() - 3600000).toISOString(), to: new Date().toISOString(), bucketSeconds: '30' });
  const response = await request.get('/api/v1/history/pairs?' + params);
  expect(response.ok()).toBeTruthy(); expect(await response.json()).toMatchObject({ source: 'simulator', maxPairSeconds: 10 });
  params.set('keys', 'sterilizationState');
  const intervals = await request.get('/api/v1/history/intervals?' + params);
  expect(intervals.ok()).toBeTruthy(); expect(await intervals.json()).toMatchObject({ resolution: 'sampled' });
  params.set('keys', 'flowTemperature');
  expect((await request.get('/api/v1/history/intervals?' + params)).status()).toBe(400);
  params.set('keys', 'flowTemperature,returnTemperature'); params.set('from', '2026-09-20T10:00:00');
  expect((await request.get('/api/v1/history/pairs?' + params)).status()).toBe(400);
});

test('E2 chart gesture zoom reloads and plain mouse wheel remains available for page scrolling', async ({ page }) => {
  const requests = await fixtures(page);
  await page.goto('/'); await expect(page.locator('.history-chart svg')).toBeVisible();
  await expect(page.locator('.history-chart path[stroke="#0964d8"][fill="none"]').first()).toHaveAttribute('d', /L/);
  await page.locator('.history-chart').scrollIntoViewIfNeeded();
  const box = await page.locator('.history-chart').boundingBox();
  const initial = requests.length;
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 100);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -250); await page.keyboard.up('Control');
  await expect.poll(() => requests.length).toBeGreaterThan(initial);
  const last = requests.at(-1)!.searchParams;
  expect(Date.parse(last.get('to')!) - Date.parse(last.get('from')!)).toBeLessThan(6 * 3600000);
  await expect(page.getByLabel('Live folgen', { exact: true })).not.toBeChecked();
  const before = await page.getByLabel('Bis (UTC)').inputValue();
  await page.mouse.wheel(0, 150);
  await expect(page.getByLabel('Bis (UTC)')).toHaveValue(before);
});

test('E2 optional analysis failure preserves existing charts and reports the limitation', async ({ page }) => {
  await fixtures(page);
  await page.route('**/api/v1/history/pairs?*', r => r.fulfill({ status: 503, json: { title: 'Paaranalyse gestört' } }));
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: 'Paaranalyse nicht verfügbar' })).toBeVisible();
  await expect(page.locator('.history-chart svg')).toBeVisible();
  await page.getByLabel('Spreizungsband', { exact: true }).check();
  await expect(page.locator('.history-chart path[fill="#177b83"]')).toHaveCount(0);
});
