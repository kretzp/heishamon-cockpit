import { test, expect } from './coverage-fixture';

test('relay setting defaults off, displays existing metadata, and switches wait for confirmation', async ({ page }) => {
  let enabled = false;
  let sends = 0;
  let release: (() => void) | undefined;
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { loginRequired: true, authenticated: true, username: 'admin', role: 'admin', csrfToken: 'test' } }));
  await page.route('**/api/v1/system', async route => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), settingsEnabled: true, enableRelaySwitching: enabled, capabilities: ['simulatorCommands'] } });
  });
  await page.route('**/api/v1/settings', async route => {
    if (route.request().method() === 'POST') enabled = route.request().postDataJSON().enableRelaySwitching;
    const values = { plantName: 'Test', retentionDays: 700, revision: 0, enableRelaySwitching: enabled };
    await route.fulfill({ json: route.request().method() === 'POST' ? values : { values, enabled: true, source: 'simulator', sampleSeconds: 5, activeRetentionDays: 700, restartRequired: false } });
  });
  await page.route('**/api/v1/users', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/settings/control', route => route.fulfill({ json: { enabled: false, active: false, revision: 0, source: 'simulator', brokerMatches: true } }));
  await page.route('**/api/v1/settings/mqtt', route => route.fulfill({ json: { host: '127.0.0.1', port: 18883, prefix: 'test', revision: 0 } }));
  await page.route('**/api/v1/commands/relays/one', async route => {
    sends++;
    expect(route.request().postDataJSON()).toEqual({ value: 1 });
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { confirmed: false } });
  });
  await page.route('**/api/v1/history/intervals?*', route => {
    const url = new URL(route.request().url());
    const key = url.searchParams.get('keys')!;
    const from = url.searchParams.get('from')!, to = url.searchParams.get('to')!;
    const middle = new Date((Date.parse(from) + Date.parse(to)) / 2).toISOString();
    return route.fulfill({ json: { from, to, bucketSeconds: 5, sampleSeconds: 5, resolution: 'sampled', series: [
      { key, unit: 'enum', source: 'simulator', aggregation: 'observedIntervals', points: [], intervals: [
        { from, to: middle, value: 0, quality: 'valid', startObserved: false, endObserved: true },
        { from: middle, to, value: 1, quality: 'valid', startObserved: true, endObserved: false }
      ] }
    ] } });
  });
  await page.goto('/');
  await expect(page.getByRole('switch', { name: 'Relais 1', exact: true })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'Einstellungen', exact: true }).click();
  const checkbox = page.getByLabel('Relaisschaltung aktivieren', { exact: true });
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.getByRole('button', { name: 'Einstellungen speichern', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Übersicht', exact: true }).click();
  const relay = page.locator('article.relayOne');
  await expect(page.locator('.plant-grid > article.relayOne.plant-metric')).toBeVisible();
  await expect(page.locator('.plant-grid > article.relayTwo.plant-metric')).toBeVisible();
  await expect(page.locator('.plant-details article.relayOne, .plant-details article.relayTwo')).toHaveCount(0);
  await expect(relay.locator('svg.metric-icon')).toBeVisible();
  await expect(relay.getByRole('switch')).toBeEnabled();
  await expect(relay.locator('.age')).toContainText('Empfangen');
  await expect(page.locator('article.relayTwo')).toBeVisible();
  await relay.getByRole('switch').click();
  await expect(relay.getByRole('switch')).toBeDisabled();
  await expect(relay.getByRole('status')).toContainText('Wird geschaltet');
  await expect(relay.getByRole('switch')).not.toBeChecked();
  await expect.poll(() => !!release).toBe(true);
  release!();
  await expect(relay.getByRole('status')).toHaveText('Änderung nicht bestätigt');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const number of [1, 2]) {
    const history = page.waitForRequest(request => request.url().includes('/history/intervals?') && new URL(request.url()).searchParams.get('keys') === (number === 1 ? 'relayOne' : 'relayTwo'));
    await page.getByRole('button', { name: `Relais ${number} – Diagramm öffnen`, exact: true }).click();
    await history;
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: `Relais ${number} – Diagramm`, exact: true })).toBeVisible();
    await dialog.getByText('Originalwerte und Qualität (letzte 100 Einträge)', { exact: true }).click();
    await expect(dialog.getByRole('cell', { name: 'Aus (0)', exact: true })).toBeVisible();
    await expect(dialog.getByRole('cell', { name: 'Ein (1)', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Diagramm schließen', exact: true }).click();
  }
  expect(sends).toBe(1);

  await page.getByRole('navigation').getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await checkbox.uncheck();
  await page.getByRole('button', { name: 'Einstellungen speichern', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Übersicht', exact: true }).click();
  await expect(page.locator('article.relayOne')).toHaveCount(0);
  expect(sends).toBe(1);
});
