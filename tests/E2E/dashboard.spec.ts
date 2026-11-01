import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, chromium } from './coverage-fixture';

test('account action ends navigation and preserves login logout and error handling', async ({ page }, info) => {
  let authenticated = true, rejectLogout = true;
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: {
    loginRequired: true, authenticated, username: authenticated ? 'simulation' : undefined, role: 'operator', csrfToken: 'simulated-csrf'
  } }));
  await page.route('**/api/v1/auth/logout', route => {
    expect(route.request().headers()['x-csrf-token']).toBe('simulated-csrf');
    if (rejectLogout) return route.fulfill({ status: 503 });
    authenticated = false;
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/v1/auth/login', route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe('simulated-csrf');
    authenticated = true;
    return route.fulfill({ json: {} });
  });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  const logout = nav.getByRole('button', { name: 'Abmelden', exact: true });
  await expect(nav.getByRole('button').last()).toHaveAccessibleName('Abmelden');
  await expect(logout).toContainText('simulation');
  await expect(page.locator('.access-bar')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 1000));
  await logout.focus(); await page.keyboard.press('Enter');
  await expect(nav.getByRole('alert')).toBeVisible();
  await expect(logout).toBeEnabled();
  rejectLogout = false;
  await logout.click();
  await expect(page.getByRole('heading', { name: 'Anmelden', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.getByLabel('Benutzername', { exact: true }).fill('simulation');
  await page.getByLabel('Passwort', { exact: true }).fill('simulated-test-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(nav.getByRole('button').last()).toHaveAccessibleName('Abmelden');
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath('account-menu.png') });
});

test('navigation stays reachable while scrolling', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('.navigation')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  const box = await page.locator('.navigation').boundingBox();
  expect(box!.y).toBeCloseTo(0, 0);
  expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath('sticky-navigation.png') });
  const history = page.getByRole('navigation').getByRole('button', { name: 'Verlauf', exact: true });
  await history.click();
  await expect(history).toBeVisible();
});

test('simulated dashboard, readonly API and honest placeholders', async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('SIMULATION · Alle Messwerte und Verbindungszustände sind simuliert.')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Vorlauf', exact: true })).toContainText('34,50');
  await expect(page.getByRole('article', { name: 'Spreizung', exact: true })).toContainText('4,5');
  await expect(page.getByRole('article', { name: 'Innen', exact: true })).toContainText('21,5');
  await expect(page.locator('.temperature-grid h2')).toHaveText(['Vorlauf', 'Rücklauf', 'Spreizung', 'Außen', 'Innen', 'Warmwasser']);
  await expect(page.getByRole('article', { name: 'Fehlerstatus', exact: true }).getByText('Fehlerstatus unbekannt', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  if (testInfo.project.name === 'desktop') {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const outside = await page.getByRole('article', { name: 'Außentemperatur', exact: true }).boundingBox();
    const inside = await page.getByRole('article', { name: 'Innen', exact: true }).boundingBox();
    expect(inside!.y).toBe(outside!.y);
    expect(inside!.x).toBeGreaterThan(outside!.x + outside!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath('dashboard-wide.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  for (const name of ['Verlauf', 'Steuerung', 'Ereignisse', 'Einstellungen']) {
    await page.getByRole('button', { name }).click();
    if (name === 'Steuerung') {
      await expect(page.getByRole('heading', { name: 'Noch nicht verfügbar' })).toBeVisible();
      // Layout editing is available even when plant commands are disabled.
      await expect(page.getByRole('button', { name: 'Kacheln anordnen', exact: true })).toBeEnabled();
      for (const control of await page.locator('main button, main input, main select').filter({ hasNotText: 'Kacheln anordnen' }).all()) await expect(control).toBeDisabled();
    } else if (name === 'Einstellungen') {
      await expect(page.getByLabel('Anlagenname', {exact:true})).toBeDisabled();
      await expect(page.getByRole('button', {name:'Verlauf / CSV-Export öffnen'})).toBeEnabled();
    } else if (name === 'Verlauf') {
      await expect(page.locator('[data-history-kind="temperature"]').getByRole('button', { name: 'CSV exportieren' })).toBeEnabled();
      await expect(page.locator('[data-history-kind="temperature"]').getByRole('button', { name: '700 Tage', exact: true })).toBeVisible();
    } else {
      await expect(page.getByLabel('Ereignisart', { exact: true })).toBeEnabled();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  }
  const sys = await (await request.get('/api/v1/system')).json();
  expect(sys).toMatchObject({ source: 'simulator', readOnly: true, capabilities: ['snapshot', 'liveTelemetry', 'history', 'events', 'csv'] });
  expect(JSON.stringify(sys)).not.toMatch(/password|username|host|prefix/i);
  const one = await (await request.get('/api/v1/snapshot')).json();
  const two = await (await request.get('/api/v1/snapshot')).json();
  expect(two.revision).toBeGreaterThan(one.revision);
  expect(two.instanceId).toBe(sys.instanceId);
  expect(two.values.find((v: { key: string }) => v.key === 'activeError').value).toBeNull();
  expect((await request.post('/api/v1/commands', { data: {} })).status()).toBe(404);
  expect((await request.post('/api/v1/snapshot', { data: {} })).status()).toBe(405);
  expect((await request.get('/health/live')).ok()).toBeTruthy();
  expect(errors).toEqual([]);
});

test('keyboard navigation has visible focus', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Übersicht', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('language-picker')).toBeFocused();
  for (const name of ['Hell', 'Dunkel', 'Nordisch']) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name, exact: true })).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Übersicht' })).toBeFocused();
  const focusStyle = await page.getByRole('button', { name: 'Übersicht' }).evaluate(el => getComputedStyle(el).outlineStyle);
  expect(focusStyle).not.toBe('none');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Verlauf', exact: true })).toBeVisible();
});

test('transport loss makes values stale and reconnect fetches full snapshot', async ({ page, context }) => {
  let snapshotRequests = 0;
  page.on('request', r => { if (r.url().endsWith('/api/v1/snapshot')) snapshotRequests++; });
  await page.goto('/');
  const flow = page.getByRole('article', { name: 'Vorlauf', exact: true });
  await expect(flow).toContainText('Aktuell');
  await expect.poll(() => snapshotRequests).toBeGreaterThan(0);
  const before = snapshotRequests;
  await context.setOffline(true);
  await expect(page.getByRole('alert').filter({ hasText: 'Liveverbindung zum Backend' })).toBeVisible({ timeout: 15000 });
  await expect(flow).toContainText('Veraltet');
  await context.setOffline(false);
  await expect.poll(() => snapshotRequests, { timeout: 30000 }).toBeGreaterThan(before);
  await expect(flow).toContainText('Aktuell');
  await expect(page.getByRole('alert')).toHaveCount(0);
});


test('M2 history, CSV and events use bounded read-only APIs', async ({ page, request }) => {
  await expect.poll(async () => (await (await request.get('/api/v1/storage')).json()).state).toBe('ready');
  const storage = await (await request.get('/api/v1/storage')).json();
  expect(storage.retentionDays).toBe(700);
  const to = new Date(Date.now() + 1000).toISOString();
  const from = new Date(Date.now() - 3600000).toISOString();
  const params = new URLSearchParams({ keys: 'flowTemperature,indoorTemperature', from, to, bucketSeconds: '30' });
  const history = await request.get('/api/v1/history?' + params);
  expect(history.ok()).toBeTruthy();
  const data = await history.json();
  expect(data.series).toHaveLength(2);
  expect(data.series[1].key).toBe('indoorTemperature');
  expect(data.series[0].source).toBe('simulator');
  expect(data.series[0].points.some((p: { samples: number }) => p.samples > 0)).toBeTruthy();
  const csv = await request.get('/api/v1/export.csv?' + params);
  expect(csv.ok()).toBeTruthy();
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(await csv.text()).toContain('timeUtc;key;value;unit;quality;source;receivedAtUtc;retained');
  expect(await csv.text()).toContain('simulator');
  const invalid = await request.get('/api/v1/history?keys=bad&from=' + from + '&to=' + to);
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({ errorCode: 'invalid_keys' });
  const tooLong = new URLSearchParams({ keys: 'flowTemperature', from: new Date(Date.now() - 701 * 86400000).toISOString(), to, bucketSeconds: '86400' });
  expect((await request.get('/api/v1/history?' + tooLong)).status()).toBe(400);
  const fullRange = new URLSearchParams({ keys: 'flowTemperature', from: new Date(Date.parse(to) - 700 * 86400000).toISOString(), to, bucketSeconds: '86400' });
  expect((await request.get('/api/v1/history?' + fullRange)).ok()).toBeTruthy();
  expect((await request.get('/api/v1/export.csv?' + fullRange)).status()).toBe(400);
  const events = await (await request.get('/api/v1/events?kind=system')).json();
  expect(events.items.length).toBeGreaterThan(0);
  expect(events.items.every((e: { kind: string }) => e.kind === 'system')).toBeTruthy();
  expect((await request.delete('/api/v1/events')).status()).toBe(405);
  await page.goto('/');
  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  await expect(page.locator('[data-history-kind="temperature"]').getByRole('button', { name: 'CSV exportieren' })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.locator('[data-history-kind="temperature"]').getByRole('button', { name: 'CSV exportieren' }).click();
  expect((await download).suggestedFilename()).toMatch(/^Temperaturverlauf-\d{8}-\d{6}\.csv$/);
  await page.locator('[data-history-kind="temperature"]').getByRole('button', { name: '700 Tage', exact: true }).click();
  await expect(page.locator('[data-history-kind="temperature"]').getByRole('button', { name: '700 Tage', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Ereignisse', exact: true }).click();
  await page.getByLabel('Ereignisart', { exact: true }).selectOption('system');
  await expect(page.locator('.event-list')).toContainText('Aufzeichnung gestartet');
});


test('storage failure remains visible while live readings continue', async ({ page }) => {
  await page.route('**/api/v1/storage', route => route.fulfill({ json: { state: 'failed', lastWriteUtc: null, sampleSeconds: 30, retentionDays: 700 } }));
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: 'Aufzeichnung gestört' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Vorlauf', exact: true })).toContainText('Aktuell');
});


test('temperature chart does not connect a missing interval', async ({ page }) => {
  await page.route('**/api/v1/history?*', route => { const q = new URL(route.request().url()).searchParams; const from = q.get('from')!;
    return route.fulfill({ json: { from, to: q.get('to'), bucketSeconds: 30, series: [{ key: 'flowTemperature', unit: '°C', source: 'simulator', aggregation: 'mean', points: [
    { time: from, value: 30, quality: 'valid', samples: 1 },
    { time: new Date(Date.parse(from) + 30000).toISOString(), value: null, quality: 'unknown', samples: 0 },
    { time: new Date(Date.parse(from) + 60000).toISOString(), value: 35, quality: 'valid', samples: 1 }
  ] }] } }); });
  await page.goto('/');
  const path = page.locator('.history-chart path[stroke="#0964d8"][fill="none"]').first();
  await expect(path).toHaveAttribute('d', /M/);
  const d = await path.getAttribute('d');
  expect(d?.match(/M/g)).toHaveLength(2);
  expect(d).not.toContain('L');
});


test('state timelines show stable colors and enum labels inside duration bars', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/history/intervals?*', async route => {
    const keys = new URL(route.request().url()).searchParams.get('keys')!.split(',');
    if (!keys.includes('heatpumpState')) return route.continue();
    await route.fulfill({ json: { from: '2026-09-20T10:00:00Z', to: '2026-09-20T11:00:00Z', bucketSeconds: 900,
      series: keys.map(key => ({ key, unit: 'enum', source: 'simulator', aggregation: 'stableState',
        points: [0, 1, null, 1].map((value, i) => ({ time: `2026-09-20T10:${String(i * 15).padStart(2, '0')}:00Z`, value, quality: value === null ? 'unknown' : 'valid', samples: value === null ? 0 : 30 })) })) } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  await page.locator('[data-history-kind="state"][aria-label="Wärmepumpe"]').getByLabel('Von (UTC)').fill('2026-09-20T10:00');
  await page.locator('[data-history-kind="state"][aria-label="Wärmepumpe"]').getByLabel('Bis (UTC)').fill('2026-09-20T11:00');
  await page.locator('[data-history-kind="state"][aria-label="Wärmepumpe"]').getByRole('button', { name: 'Zeitraum anzeigen' }).click();
  await expect(page.locator('.state-timeline')).toHaveCount(7);
  const pump = page.locator('.state-timeline').filter({ has: page.getByRole('heading', { name: 'Wärmepumpe', exact: true }) });
  await expect(pump.locator('svg text').filter({ hasText: 'Aus (0)' })).toBeVisible();
  await expect(pump.locator('svg text').filter({ hasText: 'Ein (1)' })).toHaveCount(2);
  const off = pump.locator('svg path[fill="#526277"]');
  const on = pump.locator('svg path[fill="#17633d"]');
  await expect(off).toHaveCount(1); await expect(on).toHaveCount(2);
  const boxes = await Promise.all([off, on.nth(0), on.nth(1)].map(l => l.boundingBox()));
  expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x);
  expect(Math.abs(boxes[1]!.width - boxes[0]!.width)).toBeLessThan(2);
  expect(boxes[2]!.x - boxes[1]!.x).toBeGreaterThan(boxes[1]!.width * 1.8);
  await pump.getByText('Zustandsintervalle · Wärmepumpe', { exact: true }).click();
  await expect(pump.locator('tbody tr')).toHaveCount(3);
  await expect(pump.locator('tbody')).toContainText('900 s');
  await page.locator('.state-timeline').last().screenshot({ path: info.outputPath('state-timeline.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('ECharts renders the maximum history response and disposes charts on navigation', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/history?*', async route => {
    const q = new URL(route.request().url()).searchParams;
    const start = Date.parse(q.get('from')!);
    const step = (Date.parse(q.get('to')!) - start) / 4000;
    const keys = ['flowTemperature', 'returnTemperature', 'outsideTemperature', 'indoorTemperature', 'dhwTemperature'];
    await route.fulfill({ json: { from: q.get('from'), to: q.get('to'), bucketSeconds: step / 1000,
      series: keys.map((key, j) => ({ key, unit: '°C', source: 'simulator', aggregation: 'mean',
        points: Array.from({ length: 4000 }, (_, i) => ({ time: new Date(start + i * step).toISOString(), value: 20 + j * 5 + Math.sin(i / 100), quality: 'valid', samples: 1 })) })) } });
  });
  const started = Date.now();
  await page.goto('/');
  await expect(page.locator('.history-chart svg')).toBeVisible();
  await expect(page.locator('.history-chart path[stroke="#0964d8"][fill="none"]').first()).toHaveAttribute('d', /L/);
  await info.attach('render-duration', { body: `${Date.now() - started} ms until visible; simulated 20,000 points`, contentType: 'text/plain' });
  await page.locator('.history-panel').screenshot({ path: info.outputPath('temperature-20000.png') });
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Ereignisse', exact: true }).click();
    await expect(page.locator('.echarts-for-react')).toHaveCount(0);
    await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
    await expect(page.locator('.history-chart svg')).toHaveCount(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('overview omits controls and indoor target remains on control page', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.control-panel, .mobile-current, .dhwTargetTemperature, .dhwHeatDelta')).toHaveCount(0);
  await expect(page.locator('.temperature-grid .dhwTemperature')).toBeVisible();
  await page.getByRole('button', { name: 'Steuerung', exact: true }).click();
  const indoor = page.getByRole('region', { name: 'Innen – nur lesen' });
  await expect(indoor.locator('article h3')).toHaveText(['Innen-Soll', 'Innen']);
  await expect(indoor.getByRole('article', { name: 'Innen-Soll', exact: true })).toContainText('22 °C');
  await expect(indoor.getByRole('article', { name: 'Innen', exact: true })).toContainText('21,5 °C');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('innen-soll-steuerung.png'), fullPage: true });
});


test('temperature axes use multiples of five across negative, constant and wide ranges', async ({ page }) => {
  let values = [-7.3, 34.5];
  await page.route('**/api/v1/history?*', route => route.fulfill({ json: {
    from: '2026-09-19T10:00:00Z', to: '2026-09-19T11:00:00Z', bucketSeconds: 30,
    series: [{ key: 'flowTemperature', unit: '°C', source: 'simulator', aggregation: 'mean',
      points: values.map((value, i) => ({ time: '2026-09-19T10:0' + i + ':00Z', value, quality: 'valid', samples: 1 })) }]
  } }));
  for (const range of [[-7.3, 34.5], [20, 20], [-40, 100]]) {
    values = range;
    await page.goto('/');
    const labels = page.locator('[data-history-kind="temperature"] .history-chart svg text').filter({ hasText: /^-?\d+,\d{2}$/ });
    await expect(labels.first()).toBeVisible();
    const ticks = (await labels.allTextContents()).map(label => Number(label.replace(',', '.')));
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.length).toBeLessThanOrEqual(10);
    expect(ticks.every(t => Number.isInteger(t) && t % 5 === 0)).toBeTruthy();
    expect(Math.min(...ticks)).toBeLessThanOrEqual(Math.min(...range));
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(Math.max(...range));
  }
});

test('history presets and calendar work on overview and history', async ({ page }, testInfo) => {
  await page.goto('/');
  for (const tab of ['Übersicht', 'Verlauf']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    for (const hours of [1, 4]) {
      const response = page.waitForResponse(r => {
        if (!r.url().includes('/api/v1/history?')) return false;
        const q = new URL(r.url()).searchParams;
        return Date.parse(q.get('to')!) - Date.parse(q.get('from')!) === hours * 3600000;
      });
      await page.locator('[data-history-kind="temperature"]').getByRole('button', { name: hours + ' h', exact: true }).click();
      expect((await response).ok()).toBeTruthy();
      await expect(page.locator('[data-history-kind="temperature"]').getByRole('button', { name: hours + ' h', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    await page.locator('[data-history-kind="temperature"]').getByLabel('Von (UTC)', { exact: true }).fill('2026-09-18T10:00');
    await page.locator('[data-history-kind="temperature"]').getByLabel('Bis (UTC)', { exact: true }).fill('2026-09-18T14:00');
    const response = page.waitForResponse(r => {
      if (!r.url().includes('/api/v1/history?')) return false;
      const q = new URL(r.url()).searchParams;
      return q.get('from') === '2026-09-18T10:00:00.000Z' && q.get('to') === '2026-09-18T14:00:00.000Z';
    });
    await page.locator('[data-history-kind="temperature"]').getByRole('button', { name: 'Zeitraum anzeigen', exact: true }).click();
    expect((await response).ok()).toBeTruthy();
    await expect(page.locator('[data-history-kind="temperature"]').getByRole('button', { name: '4 h', exact: true })).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath('calendar-' + tab + '.png'), fullPage: true });
    await page.locator('[data-history-kind="temperature"]').getByRole('button', { name: '1 h', exact: true }).click();
    await expect(page.locator('[data-history-kind="temperature"]').getByRole('button', { name: '1 h', exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
});


test('plant status shows counters valve pressure and distinct icons', async ({ page }, testInfo) => {
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'Anlagenstatus', exact: true });
  for (const [label, value] of [['Betriebsstunden', '12.345 h'], ['Betriebszähler', '2.345'], ['3-Wege-Ventil', 'Raumheizung'], ['Wasserdruck', '1,60 bar']]) {
    const card = panel.getByRole('article', { name: label, exact: true });
    await expect(card.locator('.value')).toHaveText(value);
    await expect(card).toContainText('Aktuell');
    await expect(card.locator('svg')).toBeVisible();
    await expect(card.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  }
  expect(new Set(await panel.locator('.operationsHours svg, .operationsCounter svg, .threeWayValveState svg, .waterPressure svg').evaluateAll(icons => icons.map(i => i.innerHTML))).size).toBe(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await panel.screenshot({ path: testInfo.outputPath('anlagenstatus.png') });
  if (testInfo.project.name === 'desktop') {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await panel.screenshot({ path: testInfo.outputPath('anlagenstatus-wide.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});


test('events display captured values on overview and events page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('article', { name: 'Wasserdruck', exact: true }).locator('.value')).toHaveText('1,60 bar');
  await page.route('**/api/v1/events*', route => route.fulfill({ json: { items: [
    { id: 3, time: '2026-09-19T10:00:00Z', kind: 'quality', key: 'waterPressure', message: 'Datenqualität: Valid · Wert: 1,60 bar', source: 'simulator' },
    { id: 2, time: '2026-09-19T10:00:00Z', kind: 'state', key: 'threeWayValveState', message: 'Beobachteter Zustand: Warmwasser (1)', source: 'simulator' },
    { id: 1, time: '2026-09-19T10:00:00Z', kind: 'quality', key: 'flowTemperature', message: 'Datenqualität: Unknown · Wert: —', source: 'simulator' }
  ], nextCursor: null } }));
  await page.reload();
  for (const tab of ['Übersicht', 'Ereignisse']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const events = page.getByRole('region', { name: 'Gespeicherte Ereignisse', exact: true });
    await expect(events).toContainText('Aktuell · Wert: 1,60 bar');
    await expect(events).toContainText('Warmwasser (1)');
    await expect(events).toContainText('Unbekannt · Wert: —');
  }
});


test('pressure history has its own scale units gaps and independent time range', async ({ page }) => {
  const requests: URLSearchParams[] = [];
  await page.route('**/api/v1/history?*', async route => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get('keys') !== 'waterPressure') return route.continue();
    requests.push(q);
    const start = Date.parse(q.get('from')!);
    await route.fulfill({ json: { from: q.get('from'), to: q.get('to'), bucketSeconds: 30, series: [
      { key: 'waterPressure', unit: 'bar', source: 'simulator', aggregation: 'mean', points: [1.6, null, 1.65].map((value, i) => ({ time: new Date(start + i * 30000).toISOString(), value, quality: value === null ? 'unknown' : 'valid', samples: value === null ? 0 : 1 })) }
    ] } });
  });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Wasserdruckverlauf', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Wasserdruckverlauf', exact: true });
  await expect(panel.locator('svg')).toBeVisible();
  await expect(panel).toContainText('Wasserdruck (bar)');
  const pressurePath = panel.locator('path[stroke="#0964d8"][fill="none"]').first();
  await expect(pressurePath).toHaveAttribute('d', /M/);
  expect((await pressurePath.getAttribute('d'))?.match(/M/g)).toHaveLength(2);
  const pressureTicks = panel.locator('svg text').filter({ hasText: /^\d+,\d{2}$/ });
  expect(await pressureTicks.count()).toBeGreaterThan(1);
  await panel.locator('summary').click();
  await expect(panel.locator('table')).toContainText('1,60 bar');
  await expect(panel.locator('table')).toContainText('1,65 bar');
  await panel.getByRole('button', { name: '1 h', exact: true }).click();
  await expect.poll(() => requests.some(q => Date.parse(q.get('to')!) - Date.parse(q.get('from')!) === 3600000)).toBeTruthy();
  await expect(panel.getByRole('button', { name: 'CSV exportieren' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});


test('M3d equal plant cards, warm water order and responsive layout', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('.pumpSpeed .value')).toHaveText('1.750 U/min');
  await expect(page.locator('.fanSpeed .value')).toHaveText('650 U/min');
  await expect(page.locator('.compressorCurrent .value')).toHaveText('4,4 A');
  await expect(page.locator('.highPressure .value')).toHaveText('10,2 kgf/cm²');
  await expect(page.getByRole('article', { name: 'Pumpendrehzahl 1.750 Umdrehungen pro Minute · Aktuell', exact: true })).toBeVisible();
  await expect(page.locator('.plant-panel .dhwTemperature')).toHaveCount(0);
  await expect(page.locator('.temperature-grid .indoorTemperature + .dhwTemperature')).toHaveCount(1);
  await expect(page.locator('.dhwTemperature')).toHaveCount(1);
  await expect(page.locator('.dhwTemperature .value')).toContainText('48,2 °C /');
  await expect(page.locator('.plant-grid > article h3')).toHaveText(['Verdichter', 'Durchfluss', 'COP · HeishaMon', 'Pumpendrehzahl', 'Ventilatordrehzahl', 'Verdichterstrom', 'Hochdruck', 'Betriebsstunden', 'Betriebszähler', '3-Wege-Ventil', 'Wasserdruck', 'Heizen elektrisch', 'Heizen thermisch', 'Warmwasser elektrisch', 'Warmwasser thermisch']);
  await expect(page.locator('.plant-grid')).toHaveCount(1);
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const boxes = await page.locator('.plant-grid > article').evaluateAll(cards => cards.map(c => {
      const r = c.getBoundingClientRect();
      return { width: r.width, height: r.height, overflow: c.scrollWidth > c.clientWidth };
    }));
    expect(boxes.every(b => Math.abs(b.width - boxes[0].width) < 1 && Math.abs(b.height - boxes[0].height) < 1 && !b.overflow)).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const inside = await page.locator('.temperature-grid .indoorTemperature').boundingBox();
    const water = await page.locator('.temperature-grid .dhwTemperature').boundingBox();
    if (width > 650) { expect(water!.y).toBe(inside!.y); expect(water!.x).toBeGreaterThan(inside!.x); }
    await page.locator('.overview-main').screenshot({ path: info.outputPath('m3d-' + width + '.png') });
  }
});

test('M3d technical history uses selected metric, units, gaps and CSV', async ({ page }) => {
  await page.route('**/api/v1/history?*', async route => {
    const q = new URL(route.request().url()).searchParams;
    const key = q.get('keys')!;
    const values: Record<string, [number, string]> = { pumpSpeed: [1750, 'U/min'], fanSpeed: [0, 'U/min'], compressorCurrent: [4.44, 'A'], highPressure: [10.24, 'kgf/cm²'] };
    if (!(key in values)) return route.continue();
    const [value, unit] = values[key];
    await route.fulfill({ json: { from: q.get('from'), to: q.get('to'), bucketSeconds: 30, series: [{ key, unit, source: 'simulator', aggregation: 'mean', points: [value, null, value].map((value, i) => ({ time: new Date(Date.parse(q.get('from')!) + i * 30000).toISOString(), value, quality: value === null ? 'stale' : 'valid', samples: value === null ? 0 : 1 })) }] } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Technische Anlagenwerte', exact: true });
  for (const [key, label, unit] of [['pumpSpeed', 'Pumpendrehzahl', 'U/min'], ['fanSpeed', 'Ventilatordrehzahl', 'U/min'], ['compressorCurrent', 'Verdichterstrom', 'A'], ['highPressure', 'Hochdruck', 'kgf/cm²']]) {
    await panel.getByRole('combobox', { name: 'Messwert', exact: true }).selectOption(key);
    await expect(panel.locator('.chart-legend')).toContainText(label + ' (' + unit + ')');
    const color = { pumpSpeed: '#0964d8', fanSpeed: '#247642', compressorCurrent: '#784ac2', highPressure: '#a63b15' }[key];
    const line = panel.locator(`path[stroke="${color}"][fill="none"]`).first();
    await expect(line).toHaveAttribute('d', /M/);
    expect((await line.getAttribute('d'))?.match(/M/g)).toHaveLength(2);
    const response = page.waitForResponse(r => r.url().includes('/api/v1/export.csv?') && new URL(r.url()).searchParams.get('keys') === key);
    await panel.getByRole('button', { name: 'CSV exportieren' }).click();
    expect((await response).ok()).toBeTruthy();
  }
});


test('M3d zero and malformed values remain honest and widths stable', async ({ page, request }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  const technical = ['pumpSpeed', 'fanSpeed', 'compressorCurrent', 'highPressure'];
  let mode = 'zero';
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: { ...snapshot, revision: Number.MAX_SAFE_INTEGER, values: snapshot.values.map((v: { key: string }) => technical.includes(v.key) ? { ...v, value: mode === 'zero' ? 0 : mode === 'invalid' ? 'NaN' : null, quality: mode === 'invalid' ? 'invalid' : mode === 'missing' ? 'unknown' : 'valid' } : v) } }));
  let widths: number[] = [];
  for (mode of ['zero', 'invalid', 'missing']) {
    await page.goto('/');
    for (const key of technical) {
      const card = page.locator('.plant-grid .' + key);
      await expect(card).toContainText(mode === 'zero' ? 'Aktuell' : mode === 'invalid' ? 'Ungültig' : 'Unbekannt');
      await expect(card.locator('.value')).toContainText(mode === 'zero' ? '0' : '—');
      await expect(card).not.toContainText(/NaN|null|undefined/);
    }
    const current = await page.locator('.plant-grid > article').evaluateAll(cards => cards.map(c => c.getBoundingClientRect().width));
    if (widths.length) expect(current).toEqual(widths); else widths = current;
  }
});


test('version and operating label come from system response', async ({ page, request }) => {
  const system = await (await request.get('/api/v1/system')).json();
  await page.route('**/api/v1/system', route => route.fulfill({ json: { ...system, appVersion: '9.8.7', source: 'mqtt', readOnly: false, capabilities: ['liveCommands', 'heatingCurveCommands'] } }));
  await page.goto('/');
  await expect(page.locator('.page-heading')).toContainText('Version 9.8.7 · Lokaler Bedienbetrieb');
  await expect(page.locator('.control-panel, .mobile-current')).toHaveCount(0);
});


test('power tiles show existing electrical and thermal readings including zero', async ({ page }) => {
  await page.goto('/');
  for (const [key,label,value] of [['heatPowerConsumption','Heizen elektrisch','850 W'],['heatPowerProduction','Heizen thermisch','3.400 W'],['dhwPowerConsumption','Warmwasser elektrisch','0 W'],['dhwPowerProduction','Warmwasser thermisch','0 W']]) {
    const tile=page.locator('.plant-grid .'+key);
    await expect(tile.locator('h3')).toHaveText(label);
    await expect(tile.locator('.value')).toHaveText(value);
    await expect(tile).toContainText('Aktuell');
  }
});

test('card order supports keyboard, persistent reload and independent groups', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button',{name:'Kacheln anordnen',exact:true}).click();
  const handle=page.getByRole('button',{name:'Vorlauf verschieben',exact:true});
  await handle.focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('.temperature-grid > article').nth(1)).toHaveClass(/flowTemperature/);
  await expect(handle).toBeFocused();
  const powerIndex = await page.locator('.plant-grid > article').evaluateAll(nodes => nodes.findIndex(el => el.getAttribute('data-sort-key') === 'heatPowerConsumption'));
  const errorIndex = await page.locator('.plant-details > article').evaluateAll(nodes => nodes.findIndex(el => el.getAttribute('data-sort-key') === 'activeError'));
  expect(powerIndex).toBeGreaterThan(0); expect(errorIndex).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Heizen elektrisch nach vorne',exact:true}).click();
  await expect(page.locator('.plant-grid > article').nth(powerIndex - 1)).toHaveClass(/heatPowerConsumption/);
  await page.getByRole('button',{name:'Fehlerstatus nach vorne',exact:true}).click();
  await expect(page.locator('.plant-details > article').nth(errorIndex - 1)).toHaveClass(/activeError/);
  await page.reload();
  await expect(page.locator('.temperature-grid > article').nth(1)).toHaveClass(/flowTemperature/);
  await expect(page.locator('.plant-grid > article').nth(powerIndex - 1)).toHaveClass(/heatPowerConsumption/);
  await expect(page.locator('.plant-details > article').nth(errorIndex - 1)).toHaveClass(/activeError/);
  await page.getByRole('button',{name:'Verlauf',exact:true}).click();await page.getByRole('button',{name:'Übersicht',exact:true}).click();
  await expect(page.locator('.temperature-grid > article').nth(1)).toHaveClass(/flowTemperature/);
});

test('mouse dragging commits on drop and Escape cancels', async ({ page }, info) => {
  await page.setViewportSize({width:1280,height:1600});await page.goto('/');
  await page.getByRole('button',{name:'Kacheln anordnen',exact:true}).click();
  const source=page.getByRole('button',{name:'Vorlauf verschieben',exact:true});
  const destination=page.locator('.temperature-grid .returnTemperature');
  await source.scrollIntoViewIfNeeded();
  const a=(await source.boundingBox())!,b=(await destination.boundingBox())!;
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});
  await expect(destination).toHaveClass(/sort-target/);
  await page.keyboard.press('Escape');await page.mouse.up();
  await expect(page.locator('.temperature-grid > article').first()).toHaveClass(/flowTemperature/);
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();
  await expect(page.locator('.temperature-grid > article').nth(1)).toHaveClass(/flowTemperature/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:info.outputPath('sortable-overview.png'),fullPage:true});
});

test('invalid saved keys are removed and new cards are appended', async ({ page }) => {
  await page.addInitScript(()=>localStorage.setItem('heishamon-cockpit.overview-order.v1',JSON.stringify({temperatures:['dhwTemperature','unknown','dhwTemperature'],plant:['waterPressure']})));
  await page.goto('/');
  await expect(page.locator('.temperature-grid > article').first()).toHaveClass(/dhwTemperature/);
  await expect(page.locator('.temperature-grid > article')).toHaveCount(6);
  await expect(page.locator('.plant-grid > article').first()).toHaveClass(/waterPressure/);
  await expect(page.locator('.plant-grid > article')).toHaveCount(15);
  await expect(page.locator('.plant-grid .heishamonCop')).toHaveCount(1);
  await expect(page.locator('.plant-grid .heatPowerConsumption')).toHaveCount(1);
});

test('unavailable persistent storage reports session-only sorting', async ({ page }) => {
  await page.addInitScript(()=>{ Storage.prototype.setItem=()=>{throw new DOMException('blocked','QuotaExceededError');}; });
  await page.goto('/');await page.getByRole('button',{name:'Kacheln anordnen',exact:true}).click();
  await page.getByRole('button',{name:'Vorlauf nach hinten',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('nur für diese Sitzung');
  await expect(page.locator('.temperature-grid > article').nth(1)).toHaveClass(/flowTemperature/);
});


test('touch dragging reorders cards on mobile', async ({ page, context }, info) => {
  test.skip(info.project.name!=='mobile','Touch device only');
  await page.goto('/');await page.getByRole('button',{name:'Kacheln anordnen',exact:true}).click();
  const source=page.getByRole('button',{name:'Vorlauf verschieben',exact:true});
  await source.evaluate(el => el.scrollIntoView({block:'center'}));
  const destination = page.locator('.temperature-grid .returnTemperature');
  const beforeScroll = (await destination.boundingBox())!;
  // Keep the entire gesture inside the viewport and outside the autoscroll edge.
  await page.evaluate(end => window.scrollBy(0, Math.max(0, end - (innerHeight - 80))), beforeScroll.y + Math.min(70, beforeScroll.height / 2));
  const a=(await source.boundingBox())!,b=(await destination.boundingBox())!;
  const client=await context.newCDPSession(page);
  const x=a.x+a.width/2,y=a.y+a.height/2,tx=b.x+b.width/2,ty=b.y+Math.min(70,b.height/2);
  expect(await page.evaluate(({x,y}) => document.elementFromPoint(x,y)?.closest('[data-sort-key]')?.getAttribute('data-sort-key'), {x,y})).toBe('flowTemperature');
  expect(await page.evaluate(({x,y}) => document.elementFromPoint(x,y)?.closest('[data-sort-key]')?.getAttribute('data-sort-key'), {x:tx,y:ty})).toBe('returnTemperature');
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*i/8,y:y+(ty-y)*i/8}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('.temperature-grid > article').nth(1)).toHaveClass(/flowTemperature/);
  await page.reload();await expect(page.locator('.temperature-grid > article').nth(1)).toHaveClass(/flowTemperature/);
});

test('saved order survives browser process restart', async ({ baseURL }, info) => {
  test.skip(info.project.name!=='desktop','One persistent browser restart is sufficient');
  const directory=mkdtempSync(join(tmpdir(),'cockpit-layout-'));
  let browserContext=await chromium.launchPersistentContext(directory,{headless:true,channel:'chromium'});
  try {
    let page=await browserContext.newPage();await page.goto(baseURL!);
    await page.getByRole('button',{name:'Kacheln anordnen',exact:true}).click();
    await page.getByRole('button',{name:'Warmwasser nach vorne',exact:true}).click();
    await expect(page.locator('.temperature-grid > article').nth(4)).toHaveClass(/dhwTemperature/);
    await browserContext.close();
    browserContext=await chromium.launchPersistentContext(directory,{headless:true,channel:'chromium'});
    page=await browserContext.newPage();await page.goto(baseURL!);
    await expect(page.locator('.temperature-grid > article').nth(4)).toHaveClass(/dhwTemperature/);
  } finally {await browserContext.close();rmSync(directory,{recursive:true,force:true});}
});

test('control cards reorder independently and persist without moving the final panel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Kacheln anordnen',exact:true}).click();
  await page.getByRole('button', {name:'Vorlauf nach hinten',exact:true}).click();
  await page.getByRole('button', {name:'Steuerung',exact:true}).click();
  const toggle=page.getByRole('button', {name:'Kacheln anordnen',exact:true});
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await toggle.click();
  const cards=page.locator('.control-status-grid > [data-sort-key]');
  await expect(cards).toHaveCount(5);
  const handle=page.getByRole('button', {name:'Betriebsart verschieben',exact:true});
  await handle.focus(); await page.keyboard.press('ArrowRight');
  await expect(cards.nth(1)).toHaveAttribute('data-sort-key','mode');
  await expect(handle).toBeFocused();
  await page.getByRole('button', {name:'Sterilisation nach vorne',exact:true}).click();
  await expect(cards.nth(3)).toHaveAttribute('data-sort-key','sterilization');
  await expect(page.locator('.control-page > :last-child [data-sort-key]')).toHaveCount(0);
  await expect(page.locator('.control-page > :last-child .sort-controls')).toHaveCount(0);
  await page.getByRole('button', {name:'Anordnung fertig',exact:true}).click();
  await expect(page.locator('.control-status-grid .sort-controls')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.temperature-grid > article').nth(1)).toHaveClass(/flowTemperature/);
  await page.getByRole('button', {name:'Steuerung',exact:true}).click();
  await expect(cards.nth(1)).toHaveAttribute('data-sort-key','mode');
  await expect(cards.nth(3)).toHaveAttribute('data-sort-key','sterilization');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('control cards support pointer dragging on desktop and touch', async ({ page, context }, info) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Steuerung',exact:true}).click();
  await page.getByRole('button', {name:'Kacheln anordnen',exact:true}).click();
  const source=page.getByRole('button', {name:'Betriebsart verschieben',exact:true});
  await source.evaluate(el=>el.scrollIntoView({block:'center'}));
  const a=(await source.boundingBox())!;
  const b=(await page.locator('.control-status-grid > [data-sort-key="indoor"]').boundingBox())!;
  const x=a.x+a.width/2,y=a.y+a.height/2,tx=b.x+b.width/2,ty=b.y+30;
  if(info.project.name==='mobile') {
    const client=await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=8;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*i/8,y:y+(ty-y)*i/8}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  } else {
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(tx,ty,{steps:8});await page.mouse.up();
  }
  await expect(page.locator('.control-status-grid > [data-sort-key]').nth(1)).toHaveAttribute('data-sort-key','mode');
  await page.screenshot({path:info.outputPath('sortable-control.png'),fullPage:true});
});


test('Vorlauf, Rücklauf und Spreizung zeigen exakt zwei Nachkommastellen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('article', { name: 'Vorlauf', exact: true }).locator('.value')).toHaveText('34,50 °C');
  await expect(page.getByRole('article', { name: 'Rücklauf', exact: true }).locator('.value')).toHaveText('30,00 °C');
  await expect(page.getByRole('article', { name: 'Spreizung', exact: true }).locator('.value')).toHaveText('4,50 K');
});
