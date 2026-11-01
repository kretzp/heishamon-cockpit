import { test, expect, type Page } from './coverage-fixture';

test('overview shows the separate COP calculated from HeishaMon Extra power', async ({ page }, info) => {
  await page.goto('/');
  const status = page.getByRole('region', { name: 'Anlagenstatus', exact: true });
  const cop = status.getByRole('article', { name: 'COP · HeishaMon', exact: true });
  await expect(cop).toBeVisible();
  await expect(cop).toContainText('Aus HeishaMon-Extra-Leistung berechnet');
  await expect(cop.getByRole('button', { name: 'COP · HeishaMon – Diagramm öffnen' })).toBeVisible();
  await cop.screenshot({ path: info.outputPath('heishamon-cop.png') });
  const query = page.waitForResponse(response => response.url().includes('/api/v1/history?') && new URL(response.url()).searchParams.get('keys') === 'heishamonCop');
  await cop.getByRole('button').click();
  expect((await query).status()).toBe(200);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'COP · HeishaMon – Diagramm' })).toBeVisible();
  await expect(dialog.locator('.metric-detail-chart svg')).toBeVisible();
  await dialog.screenshot({ path: info.outputPath('heishamon-cop-chart.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

async function fixtures(page: Page) {
  await page.route('**/api/v1/history/cop?*', route => {
    const q = new URL(route.request().url()).searchParams;
    const from = q.get('from')!, to = q.get('to')!, windowMinutes = Number(q.get('windowMinutes'));
    const start = Date.parse(from), width = (Date.parse(to) - start) / 40;
    return route.fulfill({ json: { from, to, windowMinutes, bucketSeconds: width / 1000, source: 'simulator',
      electricalSource: 'heishamon-extra', 
      minimumElectricalWatts: 200, maxPairSeconds: 10, validSeconds: 18000, expectedSeconds: 21600, energyRatio: 3.6,
      points: Array.from({ length: 40 }, (_, i) => ({ time: new Date(start + i * width).toISOString(), mode: i < 20 ? 'heat' : 'dhw',
        cop: i === 20 ? null : 3 + i % 4 * .2, average: i < 4 || i >= 20 && i < 24 ? null : 3.3, validSeconds: i === 20 ? 0 : width / 1000, expectedSeconds: width / 1000 })) } });
  });
  await page.route('**/api/v1/history/energy?*', route => {
    const year = Number(new URL(route.request().url()).searchParams.get('year'));
    const count = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
    return route.fulfill({ json: { year, source: 'simulator', unit: 'kWh', timeZone: 'Europe/Berlin', electricalSource: 'heishamon-extra',
      days: Array.from({ length: count }, (_, i) => {
        const date = new Date(Date.UTC(year, 0, i + 1)).toISOString().slice(0, 10);
        const from = date === '2026-03-29' ? '2026-03-28T23:00:00Z' : date + 'T00:00:00Z';
        const to = date === '2026-03-29' ? '2026-03-29T22:00:00Z' : new Date(Date.parse(from) + 86400000).toISOString();
        return { date, from, to, minOutdoorTemperatureC: -5.25, outdoorTemperatureSamples: 2, kwh: i % 10 === 0 ? null : i % 5 === 0 ? 0 : 8 + i % 20,
          heatpumpKwh: null, heaterKwh: null, heatpumpValidSeconds: 3600, heaterValidSeconds: 3600,
          validSeconds: i % 10 === 0 ? 0 : i % 7 === 0 ? 3600 : (Date.parse(to) - Date.parse(from)) / 1000,
          expectedSeconds: (Date.parse(to) - Date.parse(from)) / 1000,
          status: i % 10 === 0 ? 'missing' : i % 7 === 0 ? 'partial' : 'complete' };
      }) } });
  });
}
test('E3 COP lines, window selection and calendar distinguish incomplete and zero days', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await fixtures(page); await page.goto('/'); await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Effizienz und Tagesenergie' });
  await expect(panel.getByText('Simulation · synthetische Messgrenze', { exact: false })).toBeVisible();
  await expect(panel.locator('.history-chart path[stroke="#0964d8"]')).not.toHaveCount(0);
  const request = page.waitForRequest(r => r.url().includes('/history/cop?') && r.url().includes('windowMinutes=5'));
  await page.getByRole('combobox', { name: /^Gleitender Mittelwert/ }).selectOption('5'); await request;
  await panel.locator('.energy-calendar').scrollIntoViewIfNeeded();
  await expect(panel.locator('.energy-calendar svg')).toBeVisible();
  await panel.locator('.energy-calendar').screenshot({ path: info.outputPath('energy-calendar.png') });
  await panel.locator('.history-chart').screenshot({ path: info.outputPath('cop.png') });
  await page.getByText('Tagestabelle und Tagesauswahl', { exact: true }).click();
  await expect(panel.locator('tr').filter({ hasText: '2026-01-06' })).toContainText('0 kWh');
  await expect(panel.locator('tr').filter({ hasText: '2026-01-08' })).toContainText('Unvollständig');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
test('E3 keyboard day selection opens Berlin DST boundaries and stops live following', async ({ page }) => {
  await fixtures(page); await page.goto('/'); await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  await page.getByText('Tagestabelle und Tagesauswahl', { exact: true }).click();
  const request = page.waitForRequest(r => r.url().includes('/history/cop?') && new URL(r.url()).searchParams.get('from') === '2026-03-28T23:00:00.000Z');
  const day = page.getByRole('button', { name: '2026-03-29', exact: true }); await day.focus(); await page.keyboard.press('Enter');
  const url = new URL((await request).url());
  expect(url.searchParams.get('to')).toBe('2026-03-29T22:00:00.000Z');
  await expect(page.locator('[data-history-kind="efficiency"]').getByLabel('Live folgen', { exact: true })).not.toBeChecked();
  await expect(page.locator('[data-history-kind="efficiency"]').getByLabel('Von (UTC)')).toHaveValue('2026-03-28T23:00');
});
test('E3 real analysis APIs validate requests and return calendar quality', async ({ request }) => {
  await expect.poll(async () => (await (await request.get('/api/v1/storage')).json()).state).toBe('ready');
  const query = new URLSearchParams({ keys: 'heatPowerConsumption', from: new Date(Date.now() - 3600000).toISOString(), to: new Date().toISOString(), bucketSeconds: '30', windowMinutes: '15' });
  const cop = await request.get('/api/v1/history/cop?' + query);
  expect(cop.status()).toBe(200); expect(await cop.json()).toMatchObject({ source: 'simulator', windowMinutes: 15 });
  query.set('windowMinutes', '7'); expect((await request.get('/api/v1/history/cop?' + query)).status()).toBe(400);
  const year = new Date().getUTCFullYear(); const energy = await request.get('/api/v1/history/energy?year=' + year);
  expect(energy.status()).toBe(200); const body = await energy.json(); expect(body.timeZone).toBe('Europe/Berlin'); expect(body.days.length).toBeGreaterThanOrEqual(365);
  expect(body.days[0].kwh).toBeNull(); expect(body.days[0].status).toBe('missing');
  expect((await request.get('/api/v1/history/energy?year=9999')).status()).toBe(400);
});

test('E3 clicking a calendar cell selects its actual date', async ({ page }) => {
  await fixtures(page); await page.goto('/'); await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const cell = page.locator('.energy-calendar path[fill="#f6db9c"]').first();
  await cell.scrollIntoViewIfNeeded();
  const request = page.waitForRequest(r => r.url().includes('/history/cop?') && new URL(r.url()).searchParams.get('from') === '2026-01-08T00:00:00.000Z');
  const bounds = await cell.boundingBox();
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2); await request;
  await expect(page.locator('[data-history-kind="efficiency"]').getByLabel('Live folgen', { exact: true })).not.toBeChecked();
});

test('E3 MQTT COP is shown without a boundary confirmation', async ({ page }) => {
  await fixtures(page);
  await page.route('**/api/v1/history/cop?*', r => r.fulfill({ json: { source: 'mqtt',
    minimumElectricalWatts: 200, maxPairSeconds: 60, validSeconds: 30, expectedSeconds: 30, energyRatio: 4, windowMinutes: 15,
    points: [{ time: '2026-01-01T12:00:00Z', mode: 'heat', cop: 4, average: null, validSeconds: 30, expectedSeconds: 30 }] } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Effizienz und Tagesenergie' });
  await expect(panel).not.toContainText('COP unbekannt: Messgrenze');
  await expect(panel.locator('.history-chart')).toBeVisible();
  await expect(panel.locator('.energy-calendar svg')).toBeVisible();
});


test('calendar refresh and COP controls do not reload other diagrams', async ({ page }) => {
  await fixtures(page);
  const queries: URL[] = [];
  page.on('request', request => { if (request.url().includes('/api/v1/history/')) queries.push(new URL(request.url())); });
  await page.goto('/'); await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const cop = page.locator('[data-history-kind="efficiency"]');
  const calendar = cop.getByRole('region', { name: 'Tagesverbrauch', exact: true });
  await expect(calendar.locator('svg')).toBeVisible();
  const energyBefore = queries.filter(q => q.pathname.endsWith('/energy')).length;
  const response = page.waitForResponse(r => r.url().includes('/history/cop?') && r.url().includes('windowMinutes=5'));
  await cop.getByRole('combobox', { name: /^Gleitender Mittelwert/ }).selectOption('5'); await response;
  expect(queries.filter(q => q.pathname.endsWith('/energy')).length).toBe(energyBefore);
  const copBefore = queries.filter(q => q.pathname.endsWith('/cop')).length;
  const refreshed = page.waitForResponse(r => r.url().includes('/history/energy?'));
  await calendar.getByRole('button', { name: 'Kalender aktualisieren' }).click(); await refreshed;
  expect(queries.filter(q => q.pathname.endsWith('/cop')).length).toBe(copBefore);
});


test('calendar downloads the selected year with consumption and outdoor minima', async ({ page }) => {
  await fixtures(page);
  await page.goto('/'); await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const calendar = page.getByRole('region', { name: 'Tagesverbrauch', exact: true });
  await calendar.getByRole('combobox', { name: 'Kalenderjahr', exact: true }).selectOption('2025');
  const button = calendar.getByRole('button', { name: 'CSV exportieren', exact: true });
  await expect(button).toBeEnabled();
  const downloaded = page.waitForEvent('download'); await button.click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/^Tagesverbrauch 2025-\d{8}-\d{6}\.csv$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('date;consumptionKwh;minOutdoorTemperatureC');
  expect(csv).toContain('"2025-01-02";9;-5,25;2');
  expect(csv).toContain('"simulator";"heishamon-extra";;');
  expect(csv).not.toContain('2026-');
});
