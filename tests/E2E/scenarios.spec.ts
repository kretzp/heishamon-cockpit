import { test, expect } from './coverage-fixture';

test('simulator fault scenario is represented honestly', async ({ page }) => {
  const scenario = process.env.COCKPIT_TEST_SCENARIO;
  await page.goto('/');
  if (scenario === 'no-error' || scenario === 'no-error-retained') {
    const retained = scenario === 'no-error-retained';
    for (const tab of ['Übersicht', 'Ereignisse']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      const error = page.getByRole('article', { name: 'Fehlerstatus', exact: true });
      await expect(error).toContainText('Fehlerfrei');
      await expect(error).toContainText(retained ? 'Veraltet' : 'Aktuell');
      if (retained) await expect(error.locator('.value')).not.toHaveCSS('color', 'rgb(23, 100, 53)');
      else await expect(error.locator('.value')).toHaveCSS('color', 'rgb(23, 100, 53)');
    }
    await page.getByLabel('Ereignisart', { exact: true }).selectOption('error');
    const message = page.locator('.event-list p').filter({ hasText: 'Fehlerstatus: Fehlerfrei' }).first();
    await expect(message).toBeVisible();
    if (retained) {
      await expect(message).toContainText('(veraltet)');
      await expect(message).not.toHaveCSS('color', 'rgb(23, 100, 53)');
    } else await expect(message).toHaveCSS('color', 'rgb(23, 100, 53)');
    return;
  }
  for (const key of ['pumpSpeed', 'fanSpeed', 'compressorCurrent', 'highPressure']) {
    const card = page.locator('.plant-grid .' + key);
    await expect(card).toContainText(scenario === 'invalid' ? 'Ungültig' : scenario === 'unknown' ? 'Unbekannt' : 'Veraltet', { timeout: 10000 });
    if (scenario === 'invalid' || scenario === 'unknown') await expect(card.locator('.value')).toHaveText('—');
    else await expect(card.locator('.value')).not.toContainText('—');
  }
  const flow = page.getByRole('article', { name: 'Vorlauf', exact: true });
  await expect(flow).toBeVisible();
  const expected = scenario === 'invalid' ? 'Ungültig' : scenario === 'unknown' ? 'Unbekannt' : 'Veraltet';
  await expect(flow).toContainText(expected, { timeout: 10000 });
  if (scenario === 'invalid' || scenario === 'unknown') await expect(flow).toContainText('—');
  if (scenario === 'retained' || scenario === 'reconnect') await expect(flow).toContainText('Retained');
  if (scenario === 'offline' || scenario === 'disconnected')
    await expect(page.getByRole('alert')).toContainText('Verbindungsausfall der Datenquelle');
  await expect(page.getByRole('article', { name: 'Fehlerstatus', exact: true }).getByText('Fehlerstatus unbekannt', { exact: true })).toBeVisible();
  const spread = page.getByRole('article', { name: 'Spreizung', exact: true });
  if (scenario === 'unknown' || scenario === 'retained') await expect(spread).toContainText('—');
  else {
    await expect(spread).toContainText('4,5');
    await expect(spread).toContainText(scenario === 'invalid' ? 'Aktuell' : 'Veraltet');
  }
  if (scenario === 'invalid') {
    await page.getByRole('button', { name: 'Ereignisse', exact: true }).click();
    await page.getByLabel('Ereignisart', { exact: true }).selectOption('quality');
    await expect(page.locator('.event-list')).toContainText('Spreizung verworfen');
  }
  await expect(page.getByText('SIMULATION · Alle Messwerte und Verbindungszustände sind simuliert.')).toBeVisible();
});
