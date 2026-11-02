import { test, expect, type Page } from './coverage-fixture';

test('Dallas tiles reorder, hide and restore with browser persistence', async ({ page, request, context, isMobile }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  const sensors = ['28abcdef01234567', '28abcdef01234568'].map((address, index) => ({
    key: `ds18b20_${address}`, alias: `Sensor ${index + 1}`, value: 20 + index, unit: '°C', quality: 'valid',
    receivedAtUtc: new Date().toISOString(), retained: false, sourceKind: 'mqtt'
  }));
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: {
    ...snapshot, revision: Number.MAX_SAFE_INTEGER, values: [...snapshot.values, ...sensors]
  } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Dallas-1-Wire', exact: true }).click();
  await page.getByRole('button', { name: 'Kacheln anordnen', exact: true }).click();
  const cards = page.locator('.dallas-grid article');
  await cards.first().getByRole('button', { name: /verschieben$/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(cards.first().getByRole('heading')).toHaveText('Sensor 2');
  const visibility = page.getByRole('group', { name: 'Sichtbare Sensoren' });
  await visibility.getByRole('checkbox', { name: 'Sensor 1 · 28abcdef01234567', exact: true }).uncheck();
  await expect(cards).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Dallas-1-Wire', exact: true }).click();
  await expect(cards).toHaveCount(1);
  await page.getByRole('button', { name: 'Kacheln anordnen', exact: true }).click();
  await visibility.getByRole('checkbox', { name: 'Sensor 2 · 28abcdef01234568', exact: true }).uncheck();
  await expect(cards).toHaveCount(0);
  await page.getByRole('button', { name: 'Anordnung fertig', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dallas-1-Wire', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kacheln anordnen', exact: true }).click();
  for (const checkbox of await visibility.getByRole('checkbox').all()) await checkbox.check();
  await expect(cards.getByRole('heading')).toHaveText(['Sensor 2', 'Sensor 1']);
  // Pointer/touch dragging uses the same controls as the overview.
  const handle = cards.first().getByRole('button', { name: /verschieben$/ });
  await handle.scrollIntoViewIfNeeded();
  const beforeScroll = (await cards.last().boundingBox())!;
  await page.evaluate(end => window.scrollBy(0, Math.max(0, end - (innerHeight - 80))), beforeScroll.y + 30);
  const from = (await handle.boundingBox())!;
  const to = (await cards.last().boundingBox())!;
  const x = from.x + from.width / 2, y = from.y + from.height / 2;
  const tx = to.x + to.width / 2, ty = to.y + 30;
  if (isMobile) {
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 10; i++) await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x + (tx - x) * i / 10, y: y + (ty - y) * i / 10 }]
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await client.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(tx, ty, { steps: 10 });
    await page.mouse.up();
  }
  await expect(cards.getByRole('heading')).toHaveText(['Sensor 1', 'Sensor 2']);
  await page.getByRole('button', { name: 'Anordnung fertig', exact: true }).click();
  await expect(cards.first().getByRole('button', { name: /Diagramm öffnen$/ })).toBeEnabled();
});

test('Dallas-1-Wire stays hidden without MQTT temperatures', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Übersicht', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dallas-1-Wire', exact: true })).toHaveCount(0);
});

test('Dallas-1-Wire shows aliases, addresses, two decimals, red non-OK statuses and sensor history', async ({ page, request }, testInfo) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  const sensors = [
    { key: 'ds18b20_28abcdef01234567', alias: 'Puffer', value: 23.5, quality: 'valid', retained: false },
    { key: 'ds18b20_28abcdef01234568', alias: null, value: -5.25, quality: 'stale', retained: true },
    { key: 'ds18b20_28abcdef01234569', alias: '<script>alert(1)</script>', value: null, quality: 'invalid', retained: false },
    { key: 'ds18b20_28abcdef0123456a', alias: 'Unbekannter Sensor', value: null, quality: 'unknown', retained: false }
  ].map(v => ({ ...v, receivedAtUtc: new Date(Date.now() - 15_000).toISOString(), unit: '°C', sourceKind: 'mqtt' }));
  await page.route('**/api/v1/snapshot', r => r.fulfill({ json: { ...snapshot, revision: Number.MAX_SAFE_INTEGER,
    brokerConnected: true, deviceAvailability: 'online', values: [...snapshot.values, ...sensors] } }));
  await fixtures(page);
  const requested: string[] = [];
  page.on('request', r => {
    const url = new URL(r.url());
    if (url.pathname === '/api/v1/history') requested.push(url.searchParams.get('keys')!);
  });
  await page.goto('/');
  const tab = page.getByRole('button', { name: 'Dallas-1-Wire', exact: true });
  await tab.click();
  const names = await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button').allTextContents();
  expect(names.indexOf('Dallas-1-Wire')).toBe(names.indexOf('Heizkurve') + 1);
  expect(names.indexOf('Ereignisse')).toBe(names.indexOf('Dallas-1-Wire') + 1);
  const cards = page.locator('.dallas-grid article');
  await expect(cards).toHaveCount(4);
  await expect(cards.first().getByRole('heading')).toHaveText('Puffer');
  await expect(cards.first()).toContainText('28abcdef01234567');
  await expect(cards.first().locator('.value')).toHaveText('23,50 °C');
  const age = cards.first().locator('.age-elapsed');
  await expect(age).toHaveText(/ · vor \d+ s/);
  const elapsed = Number((await age.innerText()).match(/\d+/)![0]);
  expect(elapsed).toBeGreaterThanOrEqual(15);
  await expect.poll(async () => Number((await age.innerText()).match(/\d+/)![0])).toBeGreaterThan(elapsed);
  const layout = await cards.first().evaluate(card => {
    const address = card.querySelector('.dallas-address')!.getBoundingClientRect();
    const temperature = card.querySelector('.value')!.getBoundingClientRect();
    const code = card.querySelector('code')!;
    return { addressWidth: address.width, separateRows: temperature.top >= address.bottom,
      addressFits: code.scrollWidth <= code.clientWidth + 1 };
  });
  expect(layout.addressWidth).toBeGreaterThan(200);
  expect(layout.separateRows && layout.addressFits).toBeTruthy();
  await expect(cards.first().locator('.dallas-status')).toHaveText('OK');
  await expect(cards.nth(1).getByRole('heading')).toHaveText('Dallas-Sensor');
  await expect(cards.nth(1).locator('.value')).toHaveText('-5,25 °C');
  await expect(cards.nth(2).getByRole('heading')).toHaveText('<script>alert(1)</script>');
  await expect(page.locator('.dallas-status-error')).toHaveText(['Veraltet', 'Ungültig', 'Unbekannt']);
  for (const theme of ['light', 'dark', 'nordic']) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    await expect.poll(async () => {
      const colors = await page.locator('.dallas-status-error').evaluateAll(elements => elements.map(element => ({
        actual: getComputedStyle(element).color,
        expected: (() => { const probe = document.createElement('span'); probe.style.color = 'var(--danger)'; element.append(probe);
          const color = getComputedStyle(probe).color; probe.remove(); return color; })()
      })));
      return colors.every(color => color.actual === color.expected);
    }).toBeTruthy();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('dallas-one-wire.png'), fullPage: true });
  await cards.first().getByRole('button').focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toHaveText('Puffer · 28abcdef01234567 – Diagramm');
  await expect.poll(() => requested.includes('ds18b20_28abcdef01234567')).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('Dallas-1-Wire marks offline sensors red while keeping history accessible', async ({ page, request }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  await page.route('**/api/v1/snapshot', r => r.fulfill({ json: { ...snapshot, revision: Number.MAX_SAFE_INTEGER,
    brokerConnected: false, deviceAvailability: 'offline', values: [...snapshot.values, {
      key: 'ds18b20_28abcdef01234567', alias: 'Tank', value: 20, unit: '°C', quality: 'stale',
      receivedAtUtc: new Date().toISOString(), retained: false, sourceKind: 'mqtt'
    }] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Dallas-1-Wire', exact: true }).click();
  await expect(page.locator('.dallas-status-error')).toHaveText('Offline');
  await expect(page.locator('.dallas-grid .value')).toHaveText('20,00 °C');
  await expect(page.locator('.dallas-grid button')).toBeEnabled();
});

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
