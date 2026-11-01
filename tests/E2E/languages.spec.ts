import { test, expect } from './coverage-fixture';

const languages = [
  { code: 'de', overview: 'Übersicht', flow: 'Vorlauf', curve: 'Heizkurve', history: 'Verlauf', settings: 'Einstellungen', controls: 'Steuerung', events: 'Ereignisse', number: '34,50', cutoff: 'Heizgrenze', simulation: 'SIMULATION' },
  { code: 'en', overview: 'Overview', flow: 'Flow', curve: 'Heating curve', history: 'History', settings: 'Settings', controls: 'Controls', events: 'Events', number: '34.50', cutoff: 'Heating cutoff', simulation: 'SIMULATION' },
  { code: 'fr', overview: 'Vue d’ensemble', flow: 'Départ', curve: 'Courbe de chauffe', history: 'Historique', settings: 'Paramètres', controls: 'Commande', events: 'Événements', number: '34,50', cutoff: 'Seuil d’arrêt du chauffage', simulation: 'SIMULATION' },
  { code: 'es', overview: 'Resumen', flow: 'Impulsión', curve: 'Curva de calefacción', history: 'Historial', settings: 'Ajustes', controls: 'Control', events: 'Eventos', number: '34,50', cutoff: 'Límite de calefacción', simulation: 'SIMULACIÓN' },
  { code: 'it', overview: 'Panoramica', flow: 'Mandata', curve: 'Curva climatica', history: 'Storico', settings: 'Impostazioni', controls: 'Controllo', events: 'Eventi', number: '34,50', cutoff: 'Limite di riscaldamento', simulation: 'SIMULAZIONE' },
  { code: 'pt', overview: 'Visão geral', flow: 'Ida', curve: 'Curva de aquecimento', history: 'Histórico', settings: 'Definições', controls: 'Controlo', events: 'Eventos', number: '34,50', cutoff: 'Limite de aquecimento', simulation: 'SIMULAÇÃO' },
];
const titles: Record<string, string> = { de: "HeishaMon Cockpit", en: "HeishaMon Cockpit", fr: "HeishaMon Cockpit", es: "HeishaMon Cockpit", it: "HeishaMon Cockpit", pt: "HeishaMon Cockpit" };

test('all six languages switch at runtime across views and persist with the selected theme', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('article', { name: 'Vorlauf', exact: true })).toContainText('34,50');
  await page.getByRole('button', { name: 'Dunkel', exact: true }).click();
  for (const language of languages) {
    await page.getByTestId('language-picker').selectOption(language.code);
    await expect(page.locator('html')).toHaveAttribute('lang', language.code);
    await expect(page).toHaveTitle(titles[language.code]);
    await expect(page.locator('.brand-title')).toHaveText(titles[language.code]);
    await expect(page.getByRole('heading', { name: language.overview, exact: true })).toBeVisible();
    await expect(page.getByRole('article', { name: language.flow, exact: true })).toContainText(language.number);
    await expect(page.locator('main > .simulation')).toContainText(language.simulation);
    if (language.code !== 'de') await expect(page.locator('.storage-note')).not.toContainText('Aufbewahrung');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: info.outputPath(`${language.code}-overview.png`) });
    for (const name of [language.history, language.controls, language.curve, language.events, language.settings]) {
      await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
      await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
    await page.getByRole('button', { name: language.overview, exact: true }).click();
    await page.reload();
    await expect(page.getByTestId('language-picker')).toHaveValue(language.code);
    await expect(page.getByRole('heading', { name: language.overview, exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  }
  expect(errors).toEqual([]);
});

test('switching languages keeps curve drafts and chart preferences and sends no plant commands', async ({ page }) => {
  const commands: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && /commands/.test(request.url())) commands.push(request.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Heizkurve', exact: true }).click();
  const cold = page.locator('#curve-xCold');
  await expect(cold).toHaveValue('-10');
  await cold.fill('-12'); await cold.press('Enter');
  for (const language of languages.slice(1)) {
    await page.getByTestId('language-picker').selectOption(language.code);
    await expect(cold).toHaveValue('-12');
    await expect(page.locator('.curve-chart')).toContainText(language.code === 'en' ? 'Outdoor temperature' : language.code === 'fr' ? 'Température extérieure' : language.code === 'it' ? 'Temperatura esterna' : 'Temperatura exterior');
  }
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await page.getByRole('button', { name: 'Ida – Abrir gráfico', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('details').first().locator('summary').click();
  await dialog.locator('input[type=color]').fill('#aa2244');
  await dialog.getByTestId('language-picker').selectOption('en');
  await expect(dialog.getByRole('heading')).toContainText('Flow');
  await expect(dialog.locator('input[type=color]')).toHaveValue('#aa2244');
  await expect(dialog.getByRole('button', { name: 'Apply options' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Flow – Open chart', exact: true })).toBeFocused();
  expect(commands).toEqual([]);
});

test('language selection is keyboard accessible at login and preserves user entered text', async ({ page }) => {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { loginRequired: true, authenticated: false } }));
  await page.goto('/');
  await page.getByLabel('Benutzername').fill('Heizen');
  const picker = page.getByTestId('language-picker');
  await picker.focus();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(picker).toHaveValue('en');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('.brand-title')).toHaveText(titles.en);
  await expect(page.getByLabel('Username')).toHaveValue('Heizen');
  await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password');
  await picker.selectOption('pt');
  await expect(page.getByRole('heading', { name: 'Iniciar sessão', exact: true })).toBeVisible();
  await expect(page.locator('.brand-title')).toHaveText(titles.pt);
  await expect(page.getByLabel('Nome de utilizador')).toHaveValue('Heizen');
});

test('invalid saved language falls back safely and unavailable storage still permits switching', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('heishamon-cockpit.language.v1', 'invalid'));
  await page.goto('/');
  await expect(page.getByTestId('language-picker')).toHaveValue('de');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
  await page.getByTestId('language-picker').selectOption('pt');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
  await expect(page.getByText('O idioma aplica-se apenas a esta sessão: armazenamento do navegador indisponível.')).toBeVisible();
});

test('language synchronizes between tabs while custom plant names remain unchanged', async ({ page, context, request }) => {
  const system = await (await request.get('/api/v1/system')).json();
  await context.route('**/api/v1/system', route => route.fulfill({ json: { ...system, plantName: 'Heizen' } }));
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.locator('.brand-plant-name')).toHaveText('Heizen');
  await page.getByTestId('language-picker').selectOption('pt');
  await expect(other.getByTestId('language-picker')).toHaveValue('pt');
  await expect(other.locator('.brand-title')).toHaveText(titles.pt);
  await expect(other.locator('.brand-plant-name')).toHaveText('Heizen');
  await other.close();
});


test('sorting names and announcements use complete translated sentences', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Kacheln anordnen', exact: true }).click();
  const cases = [
    ['de', 'Vorlauf verschieben', 'Vorlauf nach hinten', 'Vorlauf auf Position 2 von'],
    ['en', 'Move Flow', 'Move Flow later', 'Flow at position 2 of'],
    ['fr', 'Déplacer Départ', 'Déplacer Départ vers la fin', 'Départ à la position 2 sur'],
    ['es', 'Mover Impulsión', 'Mover Impulsión hacia el final', 'Impulsión en la posición 2 de'],
    ['it', 'Sposta Mandata', 'Sposta Mandata indietro', 'Mandata alla posizione 2 di'],
    ['pt', 'Mover Ida', 'Mover Ida para trás', 'Ida na posição 2 de'],
  ];
  for (const [code, handle, later, announcement] of cases) {
    await page.getByTestId('language-picker').selectOption(code);
    const grip = page.getByRole('button', { name: handle, exact: true });
    await expect(grip).toBeVisible();
    if (code !== 'de') await expect(page.locator('.temperature-grid .sort-announcement')).toContainText(announcement.replace('2', '1'));
    await page.getByRole('button', { name: later, exact: true }).click();
    await expect(page.locator('.temperature-grid .sort-announcement')).toContainText(announcement);
    await grip.focus(); await page.keyboard.press('ArrowLeft');
    expect(await page.locator('.temperature-grid > .metric').first().getAttribute('data-sort-key')).toBe('flowTemperature');
  }
});


test('empty simulator and live logs render grammatical translations without sending commands', async ({ page, request }) => {
  const system = await (await request.get('/api/v1/system')).json();
  let live = false;
  const writes: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (req.method() !== 'GET') { writes.push(path); await route.abort(); return; }
    if (path.endsWith('/system')) return route.fulfill({ json: { ...system, capabilities: [...system.capabilities, live ? 'liveCommands' : 'simulatorCommands'] } });
    if (path.endsWith('/auth/session')) return route.fulfill({ json: { loginRequired: true, authenticated: true, username: 'simulated-operator', role: 'operator', csrfToken: 'simulated' } });
    if (path.endsWith('/commands/context')) return route.fulfill({ json: { expectedStateRevision: 'simulated', currentValue: 50, available: true, minimum: 40, maximum: 60, step: 1, unit: '°C', timeoutSeconds: 20 } });
    if (path.endsWith('/commands')) return route.fulfill({ json: [] });
    return route.continue();
  });
  for (const real of [false, true]) {
    live = real;
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button').nth(2).click();
    for (const [code, simulator, actual] of [
      ['de', 'Noch keine Simulatorbefehle.', 'Noch keine Live-Befehle.'],
      ['en', 'No simulator commands yet.', 'No live commands yet.'],
      ['fr', 'Aucune commande du simulateur pour le moment.', 'Aucune commande réelle pour le moment.'],
      ['es', 'Todavía no hay órdenes del simulador.', 'Todavía no hay órdenes reales.'],
      ['it', 'Nessun comando del simulatore per il momento.', 'Nessun comando reale per il momento.'],
      ['pt', 'Ainda não há comandos do simulador.', 'Ainda não há comandos reais.'],
    ]) {
      await page.getByTestId('language-picker').selectOption(code);
      await expect(page.locator('.simulator-control')).toContainText(real ? actual : simulator);
    }
  }
  expect(writes).toEqual([]);
});
