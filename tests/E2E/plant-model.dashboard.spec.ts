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
  const diagram = page.locator('.plant-diagram');
  const geometryCheck = await diagram.evaluate(svg => {
    const headings = Array.from(svg.querySelectorAll<SVGTextElement>('.section-label'));
    const house = svg.querySelector<SVGPathElement>('#plant-zone1 .equipment')!;
    const houseBounds = house.getBBox();
    const [left, right] = [houseBounds.x, houseBounds.x + houseBounds.width].map(x =>
      new DOMPoint(x, 0).matrixTransform(house.getCTM()!).matrixTransform((svg as SVGSVGElement).getCTM()!.inverse()).x);
    const supply = svg.querySelector<SVGPathElement>(':scope > .pipe.hot')!;
    const returnPipe = svg.querySelector<SVGPathElement>(':scope > .pipe.cold')!;
    const supplyEnd = supply.getPointAtLength(supply.getTotalLength());
    const returnStart = returnPipe.getPointAtLength(0);
    return {
      headingsAligned: headings.every(heading => heading.y.baseVal.getItem(0).value === headings[0].y.baseVal.getItem(0).value),
      headingCenterError: headings[2].x.baseVal.getItem(0).value - (left + right) / 2,
      supplyError: supplyEnd.x - left,
      returnError: returnStart.x - left,
      supplyStraight: supply.getBBox().height === 0,
      returnStraight: returnPipe.getBBox().height === 0,
    };
  });
  expect(geometryCheck.headingsAligned).toBeTruthy();
  expect(geometryCheck.headingCenterError).toBeCloseTo(0, 3);
  expect(geometryCheck.supplyError).toBeCloseTo(0, 3);
  expect(geometryCheck.returnError).toBeCloseTo(0, 3);
  expect(geometryCheck.supplyStraight && geometryCheck.returnStraight).toBeTruthy();
  await expect(page.locator('#plant-buffer')).toBeVisible();
  await expect(page.locator('#zone1-label')).toContainText('Heizkörper');
  await expect(page.getByText('Anlagenmodell-Konfiguration konnte nicht geladen werden.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Modell konfigurieren', exact: true })).toHaveCount(0);
  await expect(page.locator('.plant-model .fan')).toHaveCount(families[model.family].fans);
  await expect(page.locator(`[data-pump-location="${model.type === 'none' ? 'outdoor' : 'indoor'}"]`)).toBeVisible();
  if (info.project.name === 'mobile') {
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

test('system model KPI, status and explorer open the shared metric chart', async ({ page, request }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: {
    ...snapshot, revision: Number.MAX_SAFE_INTEGER, brokerConnected: false
  } }));
  await page.goto('/');

  const dialog = page.getByRole('dialog');
  for (const [target, key, heading] of [
    [page.getByRole('button', { name: 'Thermische Leistung – Diagramm öffnen' }), 'heatPowerProduction', 'Heizen thermisch'],
    [page.getByRole('complementary', { name: 'Anlagenstatus' }).getByRole('button', { name: 'Verdichterfrequenz – Diagramm öffnen' }), 'compressorFrequency', 'Verdichterfrequenz'],
    [page.locator('.plant-explorer').getByRole('button', { name: 'Vorlauf – Diagramm öffnen', exact: true }), 'flowTemperature', 'Vorlauf']
  ] as const) {
    const history = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/v1/history' && url.searchParams.get('keys') === key;
    });
    await target.click();
    await expect(dialog.getByRole('heading', { name: `${heading} – Diagramm` })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Messwerte als CSV' })).toBeVisible();
    expect((await history).ok()).toBeTruthy();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});

for (const state of states) test(`operating matrix: ${state.name}`, async ({ page, request }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  const readings: Record<string, number> = { heatpumpState: 1, compressorFrequency: 40, waterFlow: 20, pumpSpeed: 2000, fanSpeed: 420, defrostState: 0, threeWayValveState: 0, operatingMode: 4, ...state.changes };
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: { ...snapshot, revision: Number.MAX_SAFE_INTEGER,
    brokerConnected: !state.offline, deviceAvailability: state.offline ? 'offline' : 'online',
    values: [...snapshot.values.filter((v: { key: string }) => !(v.key in readings)), ...Object.entries(readings).map(([key, value]) => ({ key, value, quality: 'valid', retained: false, unit: '', receivedAtUtc: new Date().toISOString() }))] } }));
  await page.route('**/api/v1/settings/plant-model', route => route.fulfill({ json: { revision: 7, editable: false,
    configuration: { zones: 2, zone1: 'radiator', zone2: 'floor', tank: true, buffer: true, sensors: true, motion: true, speed: 1 } } }));
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
  for (const selector of ['#plant-zone1 .surface-flow', '#plant-zone1 .surface-return', '#plant-zone2 .surface-flow', '#plant-zone2 .surface-return', '#plant-buffer .buffer-flow']) {
    await expect(plant.locator(selector)).toHaveCSS('opacity', state.water && state.name !== 'dhw' ? '1' : '0');
  }
  await expect(plant.locator('.tank-flow')).toHaveCSS('opacity', state.water && state.name === 'dhw' ? '1' : '0');
  if (state.name === 'dhw' || state.name === 'cooling') {
    const cooling = state.name === 'cooling';
    const key = cooling ? 'coolPowerProduction' : 'dhwPowerProduction';
    const history = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/v1/history' && url.searchParams.get('keys') === key;
    });
    await plant.getByRole('button', { name: `${cooling ? 'Kälteleistung' : 'Thermische Leistung'} – Diagramm öffnen` }).click();
    expect((await history).ok()).toBeTruthy();
  }
});

for (const zone1 of ['floor', 'radiator'] as const) test(`internal flow paths connect equipment ports: ${zone1}`, async ({ page }) => {
  await page.route('**/api/v1/settings/plant-model', route => route.fulfill({ json: { revision: 7, editable: false,
    configuration: { zones: 2, zone1, zone2: zone1 === 'floor' ? 'radiator' : 'floor', tank: true, buffer: true, sensors: true, motion: true, speed: 1 } } }));
  await page.goto('/');
  await expect(page.locator('#plant-zone2 .surface-flow')).toHaveCount(1);
  const geometry = await page.locator('.plant-diagram').evaluate(svg => {
    const ends = (selector: string) => {
      const p = svg.querySelector<SVGPathElement>(selector)!;
      const transform = (svg as SVGSVGElement).getCTM()!.inverse().multiply(p.getCTM()!);
      return [p.getPointAtLength(0), p.getPointAtLength(p.getTotalLength())].map(point => {
        const result = new DOMPoint(point.x, point.y).matrixTransform(transform);
        return [result.x, result.y];
      });
    };
    return { tank: ends('.tank-flow'), inlet: ends('#plant-dhw-pipes .pipe.hot'), outlet: ends('#plant-dhw-pipes .pipe.cold'),
      zone1: ends('#plant-zone1 .surface-flow'), zone1Return: ends('#plant-zone1 .surface-return'),
      zone2: ends('#plant-zone2 .surface-flow'), zone2Return: ends('#plant-zone2 .surface-return'), buffer: ends('.buffer-flow') };
  });
  expect(geometry.tank).toEqual([[490, 470], [565, 408]]);
  expect(geometry.inlet[1]).toEqual(geometry.tank[0]);
  expect(geometry.outlet[0]).toEqual(geometry.tank[1]);
  expect(geometry.zone1[0]).toEqual([821, 205]);
  expect(geometry.zone1[1]).toEqual(geometry.zone1Return[0]);
  expect(geometry.zone1Return[1]).toEqual([821, 325]);
  expect(geometry.zone2[0]).toEqual([847, 408]);
  expect(geometry.zone2[1]).toEqual(geometry.zone2Return[0]);
  expect(geometry.zone2Return[1]).toEqual([847, 468]);
  expect(geometry.zone2Return[1][1]).toBeGreaterThan(geometry.zone2[1][1]);
  expect(geometry.buffer).toEqual([[801, 325], [735, 325]]);
});

for (const mode of ['disabled', 'valid', 'stale', 'retained', 'offline', 'missing', 'invalid'] as const) test(`MQTT house temperature selection: ${mode}`, async ({ page, request }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: { ...snapshot, revision: Number.MAX_SAFE_INTEGER,
    brokerConnected: mode !== 'offline', deviceAvailability: mode === 'offline' ? 'offline' : 'online', values: [
      ...snapshot.values.filter((v: { key: string }) => !['indoorTemperature', 'mqttHouseTemperature'].includes(v.key)),
      { key: 'indoorTemperature', value: 26, unit: '°C', quality: 'valid', retained: false, receivedAtUtc: new Date().toISOString() },
      ...(mode === 'missing' ? [] : [{ key: 'mqttHouseTemperature', value: 19.5, unit: '°C', quality: mode === 'stale' || mode === 'offline' ? 'stale' : mode === 'invalid' ? 'invalid' : 'valid', retained: mode === 'retained', receivedAtUtc: new Date().toISOString() }])
    ] } }));
  await page.route('**/api/v1/settings/plant-model', route => route.fulfill({ json: { revision: 7, editable: false,
    configuration: { houseTemperature: { enabled: mode !== 'disabled', input: { topic: 'house/sensor', payloadPath: '$.temperature' } } } } }));
  await page.goto('/');
  await expect(page.locator('#room-value')).toHaveText(mode === 'disabled' ? '26 °C' : mode === 'missing' || mode === 'invalid' ? '-' : '19,5 °C');
  await page.locator('.plant-explorer input[type=search]').fill('indoorTemperature');
  await expect(page.locator('.plant-explorer tbody tr').filter({ hasText: 'indoorTemperature' }).locator('td').nth(1)).toHaveText('26 °C');
  const expectedKey = mode === 'disabled' ? 'indoorTemperature' : 'mqttHouseTemperature';
  const historyRequest = page.waitForRequest(r => r.url().includes('/api/v1/history?') && !!new URL(r.url()).searchParams.get('keys')?.split(',').includes(expectedKey));
  await page.getByRole('navigation').getByRole('button', { name: 'Übersicht', exact: true }).click();
  const tile = page.locator('.temperature-grid article').filter({ has: page.getByRole('heading', { name: 'Innen', exact: true }) });
  await expect(tile).toContainText(mode === 'disabled' ? '26' : mode === 'missing' || mode === 'invalid' ? '—' : '19,5');
  await historyRequest;

});

test('administrator configures MQTT house temperature with checkbox, topic and payload path', async ({ page }) => {
  await page.route('**/api/v1/system', async route => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), settingsEnabled: true } });
  });
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: { loginRequired: false, authenticated: true, role: 'admin', csrfToken: 'isolated-test' } }));
  let configuration = { houseTemperature: { enabled: false, input: { topic: '', payloadPath: '' } }, houseTargetTemperature: { enabled: false, input: { topic: '', payloadPath: '' } } };
  await page.route('**/api/v1/settings/plant-model', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().headers()['x-csrf-token']).toBe('isolated-test');
      configuration = route.request().postDataJSON().configuration;
    }
    await route.fulfill({ json: { revision: 7, editable: true, configuration } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Modell konfigurieren', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Modell konfigurieren' }).getByLabel('MQTT-Topic', { exact: true })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('tab', { name: 'Temperaturdaten', exact: true }).click();
  const editor = page.getByRole('tabpanel', { name: 'Temperaturdaten', exact: true }).getByRole('group', { name: 'Haustemperatur per MQTT', exact: true });
  await expect(editor.getByLabel('MQTT-Topic', { exact: true })).toBeDisabled();
  await editor.getByLabel('MQTT-Haustemperatur verwenden', { exact: true }).check();
  await editor.getByLabel('MQTT-Topic', { exact: true }).fill('house/sensor');
  await editor.getByLabel('Payload-Pfad', { exact: true }).fill('$.temperature');
  await page.getByRole('tabpanel', { name: 'Temperaturdaten', exact: true }).getByRole('button', { name: 'Einstellungen speichern', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Temperaturdaten', exact: true }).getByText('Keine offenen Änderungen', { exact: true })).toBeVisible();
  expect(configuration.houseTemperature).toEqual({ enabled: true, input: { topic: 'house/sensor', payloadPath: '$.temperature' } });
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('tab', { name: 'Temperaturdaten', exact: true }).click();
  await expect(editor.getByLabel('MQTT-Haustemperatur verwenden', { exact: true })).toBeChecked();
  await expect(editor.getByLabel('MQTT-Topic', { exact: true })).toHaveValue('house/sensor');
  await expect(editor.getByLabel('Payload-Pfad', { exact: true })).toHaveValue('$.temperature');
  const targetEditor = page.getByRole('group', { name: 'Haustemperatur Soll per MQTT', exact: true });
  await expect(targetEditor.getByLabel('MQTT-Topic', { exact: true })).toBeDisabled();
  await targetEditor.getByLabel('MQTT-Haustemperatur Soll verwenden', { exact: true }).check();
  await targetEditor.getByLabel('MQTT-Topic', { exact: true }).fill('house/sensor');
  await targetEditor.getByLabel('Payload-Pfad', { exact: true }).fill('$.target');
  await page.getByRole('tabpanel', { name: 'Temperaturdaten', exact: true }).getByRole('button', { name: 'Einstellungen speichern', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Temperaturdaten', exact: true }).getByText('Keine offenen Änderungen', { exact: true })).toBeVisible();
  expect(configuration.houseTargetTemperature).toEqual({ enabled: true, input: { topic: 'house/sensor', payloadPath: '$.target' } });
  expect(configuration.houseTemperature.enabled).toBe(true);

});

for (const quality of ['valid', 'stale', 'missing'] as const) test(`flow target temperature in hydraulic diagram: ${quality}`, async ({ page, request }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: { ...snapshot, revision: Number.MAX_SAFE_INTEGER,
    values: [...snapshot.values.filter((v: { key: string }) => !['mainTargetTemperature', 'flowTemperature'].includes(v.key)),
      { key: 'flowTemperature', value: 31, unit: '°C', quality: 'valid', retained: false, receivedAtUtc: new Date().toISOString() },
      ...(quality === 'missing' ? [] : [{ key: 'mainTargetTemperature', value: 35.5, unit: '°C', quality, retained: false, receivedAtUtc: new Date().toISOString(), sourceTopic: 'panasonic_heat_pump/main/Main_Target_Temp' }])]
  } }));
  await page.route('**/api/v1/settings/plant-model', route => route.fulfill({ json: { revision: 7, editable: false, configuration: { sensors: true } } }));
  await page.goto('/');
  await expect(page.locator('#flow-value')).toHaveText('31,00 °C');
  await expect(page.locator('#flow-target-value')).toHaveText(`Vorlauf-Soll (Anlage): ${quality === 'missing' ? '-' : '35,50 °C'}`);
  const positions = await page.locator('.plant-diagram').evaluate(svg => {
    const actual = svg.querySelector<SVGTextElement>('#flow-value')!.getBBox();
    const target = svg.querySelector<SVGTextElement>('#flow-target-value')!.getBBox();
    return { actualBottom: actual.y + actual.height, targetTop: target.y, targetBottom: target.y + target.height };
  });
  expect(positions.targetTop).toBeGreaterThan(positions.actualBottom);
  expect(positions.actualBottom).toBeLessThan(201);
  expect(positions.targetBottom).toBeLessThan(201);
});

for (const state of ['active', 'inactive', 'stale', 'retained', 'offline', 'defrost', 'off'] as const) test(`sterilisation mode and target: ${state}`, async ({ page, request }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  const readings: Record<string, number> = { heatpumpState: state === 'off' ? 0 : 1, compressorFrequency: 0, pumpSpeed: 2000, fanSpeed: 0,
    defrostState: state === 'defrost' ? 1 : 0, threeWayValveState: 1, operatingMode: 3, dhwTemperature: 48,
    dhwTargetTemperature: 50, sterilizationState: state === 'inactive' ? 0 : 1, sterilizationTemperature: 65 };
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: { ...snapshot, revision: Number.MAX_SAFE_INTEGER,
    brokerConnected: state !== 'offline', deviceAvailability: state === 'offline' ? 'offline' : 'online',
    values: [...snapshot.values.filter((v: { key: string }) => !(v.key in readings)), ...Object.entries(readings).map(([key, value]) => ({ key, value,
      unit: key.endsWith('Temperature') ? '°C' : '', quality: key === 'sterilizationState' && state === 'stale' ? 'stale' : 'valid',
      retained: key === 'sterilizationState' && state === 'retained', receivedAtUtc: new Date().toISOString() }))] } }));
  await page.route('**/api/v1/settings/plant-model', route => route.fulfill({ json: { revision: 1, editable: false, configuration: { tank: true } } }));
  await page.goto('/');
  const expected = state === 'active' ? 'sterilization' : state === 'offline' ? 'unknown' : state === 'defrost' ? 'defrost' : state === 'off' ? 'off' : 'circulate';
  await expect(page.locator('.plant-model')).toHaveClass(new RegExp(`mode-${expected}`));
  if (state === 'active') {
    await expect(page.locator('#sterilization-target-value')).toHaveText(' · Sterilisation: 65 °C');
    await expect(page.locator('.plant-section-heading').first()).toContainText('Sterilisation');
    for (const language of ['de', 'en', 'fr', 'es', 'it', 'pt']) {
      await page.getByTestId('language-picker').first().selectOption(language);
      const rightEdge = await page.locator('#sterilization-target-value').evaluate(element => {
        const bounds = (element.parentElement as unknown as SVGTextElement).getBBox();
        return bounds.x + bounds.width;
      });
      expect(rightEdge).toBeLessThanOrEqual(1000);
    }
    await page.getByTestId('language-picker').first().selectOption('de');

  } else await expect(page.locator('#sterilization-target-value')).toHaveCount(0);
  await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
  const target = page.locator('.dhwTemperature .sterilization-target');
  if (state === 'active') {
    await expect(page.locator('.header-mode')).toContainText('Sterilisation');
    await expect(target).toHaveText(' · Sterilisation: 65 °C');
    await expect(page.locator('.dhwTemperature .target-reading')).toContainText('50');
  } else await expect(target).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

for (const mode of ['disabled', 'valid', 'stale', 'missing', 'invalid'] as const) test(`MQTT house target selection: ${mode}`, async ({ page, request }) => {
  const snapshot = await (await request.get('/api/v1/snapshot')).json();
  await page.route('**/api/v1/snapshot', route => route.fulfill({ json: { ...snapshot, revision: Number.MAX_SAFE_INTEGER, values: [
    ...snapshot.values.filter((v: { key: string }) => !['indoorTemperature', 'indoorTargetTemperature', 'mqttHouseTargetTemperature'].includes(v.key)),
    { key: 'indoorTemperature', value: 26, unit: '°C', quality: 'valid', retained: false, receivedAtUtc: new Date().toISOString() },
    { key: 'indoorTargetTemperature', value: 24, unit: '°C', quality: 'valid', retained: false, receivedAtUtc: new Date().toISOString() },
    ...(mode === 'missing' ? [] : [{ key: 'mqttHouseTargetTemperature', value: 21.5, unit: '°C', quality: mode === 'invalid' ? 'invalid' : mode === 'stale' ? 'stale' : 'valid', retained: false, receivedAtUtc: new Date().toISOString() }])
  ] } }));
  await page.route('**/api/v1/settings/plant-model', route => route.fulfill({ json: { revision: 7, editable: false, configuration: {
    houseTemperature: { enabled: false }, houseTargetTemperature: { enabled: mode !== 'disabled', input: { topic: 'house', payloadPath: '$.target' } }
  } } }));
  await page.goto('/');
  await expect(page.locator('#room-value')).toHaveText('26 °C');
  if (mode === 'valid' || mode === 'stale') {
    await expect(page.locator('#room-target-value')).toHaveText('Innen-Soll: 21,5 °C');
    const actual = await page.locator('#room-value').boundingBox();
    const target = await page.locator('#room-target-value').boundingBox();
    expect(target!.y).toBeGreaterThan(actual!.y);
    expect(target!.height).toBeLessThan(actual!.height);
  } else await expect(page.locator('#room-target-value')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'Übersicht', exact: true }).click();
  const tile = page.locator('.temperature-grid article.indoorTemperature');
  await expect(tile.locator('.target-reading')).toContainText(mode === 'disabled' ? '24' : mode === 'missing' || mode === 'invalid' ? '—' : '21,5');
});
