import { test, expect } from './coverage-fixture';
import { models, families, resolve, layout } from '../../web/src/plant/plantHousing';

const representatives = Object.keys(families).filter(family => family !== 'generic').map(family => models.find(model => model.family === family)!);
representatives.push(models.find(model => model.type === 'aio' && model.generation === 'H')!, models.find(model => model.name.includes('M9E83'))!);

for (const model of representatives) test(`housing matrix: ${model.name}`, async ({ page, request }, info) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: { ...snapshot, revision: Number.MAX_SAFE_INTEGER,
    heatPumpModel: { known: true, rawIdentifier: model.signature, displayName: model.name } } }));
  // Authentication is intentionally disabled on read-only simulator installations.
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { loginRequired: false, authenticated: false } }));
  await page.route('**/api/v1/settings/plant-model', route => route.fulfill({ json: { revision: 7, editable: false,
    configuration: { zones: 2, zone1: 'radiator', zone2: 'floor', tank: true, buffer: true, sensors: true, motion: true, speed: 1 } } }));
  await page.goto('/');
  await expect(page.locator(`[data-family="${model.family}"]`)).toBeVisible();
  await expect(page.locator('#plant-zone2')).toBeVisible();
  await expect(page.locator('#plant-buffer')).toBeVisible();
  await expect(page.locator('#zone1-label')).toContainText('Heizkörper');
  await expect(page.getByText('Anlagenmodell-Konfiguration konnte nicht geladen werden.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Modell konfigurieren', exact: true })).toHaveCount(0);
  await expect(page.locator('.plant-model .fan')).toHaveCount(families[model.family].fans);
  await expect(page.locator(`[data-pump-location="${model.type === 'none' ? 'outdoor' : 'indoor'}"]`)).toBeVisible();
  if (info.project.name === 'mobile') {
    const diagram = page.locator('.plant-diagram');
    const region = page.locator('.plant-diagram-scroll');
    const bounds = await diagram.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
  }
  const geometry = layout(resolve(model.signature));
  expect(geometry.outdoor.width / geometry.outdoor.height).toBeCloseTo(geometry.outdoor.mmWidth / geometry.outdoor.mmHeight, 8);
  if (geometry.indoor) expect(geometry.indoor.width / geometry.indoor.height).toBeCloseTo(geometry.indoor.mmWidth / geometry.indoor.mmHeight, 8);
  const axes = await page.locator('.plant-model .rotor-anchor').evaluateAll(anchors => anchors.map(anchor => {
    const rotor = anchor.querySelector('.fan,.pump') as SVGGraphicsElement;
    const animation = rotor.getAnimations()[0];
    animation.pause(); animation.currentTime = Number(animation.effect!.getComputedTiming().duration) * .37;
    const origin = new DOMPoint(0, 0).matrixTransform((anchor as SVGGraphicsElement).getCTM()!);
    const actual = new DOMPoint(0, 0).matrixTransform(rotor.getCTM()!);
    return Math.hypot(actual.x - origin.x, actual.y - origin.y);
  }));
  for (const error of axes) expect(error).toBeLessThan(.01);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath('housing.png'), fullPage: true });
});

const states = [
  { name: 'off', changes: { heatpumpState: 0, compressorFrequency: 0, fanSpeed: 0, pumpSpeed: 0 }, water: false, fan: false, refrigerant: false },
  { name: 'heating', changes: {}, water: true, fan: true, refrigerant: true },
  { name: 'dhw', changes: { threeWayValveState: 1 }, water: true, fan: true, refrigerant: true },
  { name: 'cooling', changes: { operatingMode: 1 }, water: true, fan: true, refrigerant: true },
  { name: 'defrost', changes: { defrostState: 1, fanSpeed: 0 }, water: true, fan: false, refrigerant: true },
  { name: 'circulate', changes: { compressorFrequency: 0, fanSpeed: 0, waterFlow: 0, pumpSpeed: 2000 }, water: true, fan: false, refrigerant: false },
  { name: 'idle', changes: { compressorFrequency: 0, fanSpeed: 0, waterFlow: 20, pumpSpeed: 0 }, water: false, fan: false, refrigerant: false },
  { name: 'unknown', changes: {}, offline: true, water: false, fan: false, refrigerant: false },
];
for (const state of states) test(`operating matrix: ${state.name}`, async ({ page, request }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  const readings: Record<string, number> = { heatpumpState: 1, compressorFrequency: 40, waterFlow: 20, pumpSpeed: 2000, fanSpeed: 420, defrostState: 0, threeWayValveState: 0, operatingMode: 4, ...state.changes };
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: { ...snapshot, revision: Number.MAX_SAFE_INTEGER,
    brokerConnected: !state.offline, deviceAvailability: state.offline ? 'offline' : 'online',
    values: [...snapshot.values.filter((v: { key: string }) => !(v.key in readings)), ...Object.entries(readings).map(([key, value]) => ({ key, value, quality: 'valid', retained: false, unit: '', receivedAtUtc: new Date().toISOString() }))] } }));
  await page.goto('/');
  const plant = page.locator('.plant-model');
  await expect(plant).toHaveClass(new RegExp(`mode-${state.name}`));
  if (state.water) {
    await expect(plant).toHaveCSS('--flow-duration', '1.45s');
    await expect(plant).toHaveCSS('--pump-duration', '1.2s');
  }
  for (const [flag, active] of [['water', state.water], ['fan', state.fan], ['refrigerant', state.refrigerant]] as const) {
    if (active) await expect(plant).toHaveClass(new RegExp(`${flag}-active`));
    else await expect(plant).not.toHaveClass(new RegExp(`${flag}-active`));
  }
});
