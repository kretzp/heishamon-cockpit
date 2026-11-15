import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derivePlantState, readNumber, readConfiguration } from './src/plant/plantModelState.ts';
import { resolve, models, layout } from './src/plant/plantHousing.ts';

const now = Date.now();
const value = (key, number, quality = 'valid') => ({ key, value: number, quality, unit: '', receivedAtUtc: new Date(now).toISOString(), retained: false });
const sample = (changes = {}) => ({ brokerConnected: true, deviceAvailability: 'online', values: Object.entries({ heatpumpState: 1, compressorFrequency: 34, waterFlow: 20, fanSpeed: 420, defrostState: 0, threeWayValveState: 0, operatingMode: 4, ...changes }).map(([key, n]) => value(key, n)) });

test('actual activity uses valve, defrost and compressor rather than selected mode alone', () => {
  assert.equal(derivePlantState(sample(), true).activity, 'heating');
  assert.equal(derivePlantState(sample({ threeWayValveState: 1 }), true).activity, 'dhw');
  assert.equal(derivePlantState(sample({ defrostState: 1 }), true).activity, 'defrost');
  assert.equal(derivePlantState(sample({ operatingMode: 1 }), true).activity, 'cooling');
  const idle = derivePlantState(sample({ compressorFrequency: 0, waterFlow: 0, fanSpeed: 0 }), true);
  assert.equal(idle.activity, 'idle');
  const trailing = derivePlantState(sample({ compressorFrequency: 0 }), true);
  assert.equal(trailing.pumpRunning, true);
  assert.equal(trailing.fanRunning, true);
  assert.equal(trailing.refrigerantRunning, false);
});
test('missing, retained and disconnected inputs never animate as live data', () => {
  for (const sampleValue of [value('x', null), value('x', '34'), value('x', NaN), value('x', 34, 'stale'), { ...value('x', 34), retained: true }]) assert.equal(readNumber([sampleValue], 'x', true), null);
  assert.equal(readNumber([value('x', 0)], 'x', true), 0);
  for (const snapshot of [null, { ...sample(), brokerConnected: false }, { ...sample(), deviceAvailability: 'offline' }]) {
    const state = derivePlantState(snapshot, true);
    assert.equal(state.pumpRunning, false); assert.equal(state.fanRunning, false);
  }
  assert.equal(derivePlantState(sample(), false).activity, 'unknown');
  const state = derivePlantState({ ...sample(), values: sample().values.map(v => v.key === 'waterFlow' ? { ...v, quality: 'stale' } : v) }, true);
  assert.equal(state.pumpRunning, false);
});
test('configuration is validated and never grants device control', () => {
  assert.deepEqual(readConfiguration('{broken'), readConfiguration(null));
  assert.equal(readConfiguration('{"zones":6,"zone1":"invalid","speed":99}').zones, 1);
  assert.equal(readConfiguration('{"zones":2,"zone1":"radiator","speed":1.5}').zone1, 'radiator');
});
test('visual profiles stay in sync with every backend model and preserve proportions', () => {
  const source = readFileSync('../src/Cockpit.Domain/HeatPumpModels.cs', 'utf8');
  const entries = [...source.matchAll(/new\((\d+|null), "([^"]+)", "([^"]+)"\)/g)];
  assert.equal(models.length, entries.length);
  for (const [, id, signature, name] of entries) {
    assert.equal(resolve(signature).name, name);
    if (id !== 'null') assert.equal(resolve(id).name, name);
    const geometry = layout(resolve(signature));
    if (geometry.indoor) assert.ok(Math.abs(geometry.indoor.width / geometry.indoor.mmWidth - geometry.scale) < 1e-9);
  }
  assert.equal(resolve('unknown').known, false);
});
