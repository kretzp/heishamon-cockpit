import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lineOptions, stateIntervals, numericScale } from './src/charts/historyOptions.ts';
import { stateLabel, stateColor, metricColor, metricNumber, chartTime } from './src/charts/chartFormat.ts';
import { bandSegments } from './src/charts/analysisOptions.ts';
import { boundedRange, csvAllowed, zoomRange } from './src/charts/historyRange.ts';
import { copOptions, copDisplayPoints, energyOptions, energySourceLabel } from './src/charts/efficiencyOptions.ts';
import { metricOptions, defaults, parseOptions, readPreferences } from './src/charts/metricChartOptions.ts';
import { trendPoints } from './src/charts/trendOptions.ts';

test('COP table preserves missing intervals and both modes in mixed buckets', () => {
  const point = (time, mode, cop, validSeconds) => ({ time, mode, cop, average: null, validSeconds, expectedSeconds: 120 });
  const times = ['2026-11-11T10:00:00Z', '2026-11-11T10:02:00Z'];
  const missing = point(times[1], null, null, 0);
  const heat = point(times[0], 'heat', 4, 30), dhw = point(times[0], 'dhw', 3, 60);
  assert.deepEqual(copDisplayPoints({ points: [point(times[0], null, null, 90), missing], series: [
    { mode: 'heat', points: [heat, missing] }, { mode: 'dhw', points: [dhw, missing] }
  ] }), [dhw, heat, missing]);
});

test('partial COP buckets retain both modes as isolated measured points', () => {
  const time = '2026-11-11T10:00:00Z';
  const point = (mode, cop) => ({ time, mode, cop, average: null, validSeconds: 30, expectedSeconds: 120 });
  const option = copOptions({ points: [point(null, null)], series: [
    { mode: 'heat', points: [point('heat', 4)] }, { mode: 'dhw', points: [point('dhw', 3)] }
  ], windowMinutes: 15, bucketSeconds: 120 }, true);
  assert.deepEqual(option.series[0].data.map(p => p[1]), [null, 4, null]);
  assert.deepEqual(option.series[2].data.map(p => p[1]), [null, 3, null]);
  assert.ok(option.series.slice(4).every(s => s.data.every(p => p[1] === null)));
  assert.match(option.tooltip.formatter([{ seriesName: 'Heizen', value: option.series[0].data[1] }]), /30 \/ 120 s/);
});

test('daily meter energy labels and tooltip preserve source and individual channel readings', () => {
  assert.equal(energySourceLabel('shelly-ac'), 'Shelly · C + A');
  assert.equal(energySourceLabel('alternative-mqtt'), 'Alternative Leistungsdaten');
  assert.equal(energySourceLabel('mixed'), 'Gemischte Quellen im Zeitraum');
  assert.equal(energySourceLabel('heishamon-extra'), 'HeishaMon-Extra');
  const option = energyOptions({ year: 2026, source: 'mqtt', electricalSource: 'shelly-ac', unit: 'kWh', timeZone: 'Europe/Berlin',
    days: [{ date: '2026-11-01', kwh: 8.5, heatpumpKwh: 8, heaterKwh: .5, validSeconds: 86400, expectedSeconds: 86400, status: 'complete' }] });
  const tooltip = option.tooltip.formatter({ value: ['2026-11-01', 8.5] });
  assert.match(tooltip, /Wärmepumpe elektrisch: 8 kWh/);
  assert.match(tooltip, /Heizstab elektrisch: 0,5 kWh/);
});

test('trend smooths without mutating measurements, inventing zeros or crossing gaps', () => {
  const points = [[0, 0], [30000, 9], [60000, 0]];
  const original = structuredClone(points);
  assert.deepEqual(trendPoints(points, 30), [[0, 3], [30000, 3.375], [60000, 3]]);
  assert.deepEqual(points, original);
  assert.deepEqual(trendPoints([[0, 0], [30000, 0]], 30), [[0, null], [30000, null]]);
  assert.deepEqual(trendPoints([[0, 0], [30000, 0], [60000, 0], [120000, 100], [150000, 100], [180000, 100]], 30),
    [[0, 0], [30000, 0], [60000, 0], [90000, null], [120000, 100], [150000, 100], [180000, 100]]);
  assert.deepEqual(trendPoints([[0, 1], [30000, NaN], [60000, 1]], 30).map(p => p[1]), [null, null, null]);
});

test('trend defaults and stored opt-out survive preference migration', () => {
  const previous = globalThis.localStorage;
  try {
    const old = { ...defaults }; delete old.trend;
    globalThis.localStorage = { getItem: () => JSON.stringify(old) };
    assert.equal(readPreferences('flowTemperature').trend, true);
    old.trend = false;
    assert.equal(readPreferences('flowTemperature').trend, false);
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
});

test('trend remains a separate optional line with advanced chart overrides', () => {
  const data = history([point(0, 1), point(30, 3), point(60, 1)]);
  const option = metricOptions(data, 'Vorlauf', { ...defaults, type: 'bar', advanced: '{"series":[{"itemStyle":{"color":"#112233"}}]}' });
  assert.equal(option.series.length, 2);
  assert.equal(option.series[0].type, 'bar');
  assert.equal(option.series[1].id, 'trend:flowTemperature');
  assert.equal(option.series[1].type, 'line');
  assert.equal(metricOptions(data, 'Vorlauf', { ...defaults, trend: false }).series.length, 1);
});

test('metric options retain quality gaps and measured zero while merging advanced styles', () => {
  const data = { from: '2026-01-01T00:00:00Z', to: '2026-01-01T01:00:00Z', bucketSeconds: 30,
    series: [{ key: 'flowTemperature', unit: '°C', source: 'simulator', aggregation: 'mean', points: [
      { time: '2026-01-01T00:00:00Z', value: 0, quality: 'valid' },
      { time: '2026-01-01T00:00:30Z', value: 90, quality: 'invalid' },
      { time: '2026-01-01T00:01:30Z', value: 3, quality: 'valid' }
    ] }] };
  const option = metricOptions(data, 'Vorlauf', { ...defaults, advanced: '{"series":[{"lineStyle":{"width":5}}],"legend":{"show":true}}' });
  assert.deepEqual(option.series[0].data.map(p => p[1]), [0, null, null, 3]);
  assert.equal(option.series[0].connectNulls, false);
  assert.equal(option.series[0].lineStyle.width, 5);
  assert.equal(option.legend.show, true);
  assert.throws(() => parseOptions('[]'));
  assert.throws(() => parseOptions('{"__proto__":{}}'));
  assert.throws(() => parseOptions('{'));
  assert.equal(stateLabel('heatingControlMode', 0), 'Heizkurve (0)');
});

test('COP keeps mode separation and incomplete moving windows as gaps', () => {
  const options = copOptions({ windowMinutes: 15, points: [
    { time: '2026-01-01T00:00:00Z', mode: 'heat', cop: 4, average: null },
    { time: '2026-01-01T00:00:30Z', mode: null, cop: null, average: null },
    { time: '2026-01-01T00:01:00Z', mode: 'dhw', cop: 3, average: 3 }
  ] });
  assert.deepEqual(options.series[0].data.map(p => p[1]), [4, null, null]);
  assert.deepEqual(options.series[3].data.map(p => p[1]), [null, null, 3]);
  assert.ok(options.series.every(s => s.connectNulls === false));
  assert.ok(options.series.every(s => s.showSymbol === true && s.symbolSize > 0));
});

test('COP trends never mix heating and hot water samples', () => {
  const options = copOptions({ bucketSeconds: 30, windowMinutes: 15, points: Array.from({ length: 6 }, (_, i) => ({
    time: new Date(start + i * 30000).toISOString(), mode: i < 3 ? 'heat' : 'dhw', cop: i < 3 ? 4 : 2, average: null
  })) }, true);
  assert.equal(options.series.length, 6);
  assert.deepEqual(options.series[4].data.map(p => p[1]), [4, 4, 4, null, null, null]);
  assert.deepEqual(options.series[5].data.map(p => p[1]), [null, null, null, 2, 2, 2]);
});
test('calendar colors partial days from 20 hours while retaining status and measured zero', () => {
  const options = energyOptions({ year: 2026, days: [
    { date: '2026-01-01', kwh: 0, status: 'complete' },
    { date: '2026-01-02', kwh: 100, status: 'partial', validSeconds: 20 * 3600 - 1 },
    { date: '2026-01-03', kwh: null, status: 'missing' },
    { date: '2026-01-04', kwh: 12, status: 'partial', validSeconds: 20 * 3600 },
    { date: '2026-01-05', kwh: 15, status: 'partial', validSeconds: 23 * 3600 },
    { date: '2026-01-06', kwh: 200, status: 'current', validSeconds: 21 * 3600 }
  ] });
  assert.deepEqual(options.series[0].data.map(d => d.value), [['2026-01-01', 0], ['2026-01-04', 12], ['2026-01-05', 15]]);
  assert.equal(options.series[0].data[1].label.formatter, '!');
  assert.equal(options.series[0].data[1].label.show, true);
  assert.equal(options.visualMap.max, 15);
  assert.equal(options.series[1].data[0].label.formatter, '!');
  assert.equal(options.series[1].data[1].label.formatter, '–');
  assert.ok(options.calendar.every(c => c.dayLabel.firstDay === 1));
});

const start = Date.parse('2026-09-20T10:00:00Z');
const point = (seconds, value, quality = 'valid') => ({ time: new Date(start + seconds * 1000).toISOString(), value, quality, samples: 1 });
const history = (points, key = 'flowTemperature', unit = '°C') => ({ from: new Date(start).toISOString(), to: new Date(start + 300000).toISOString(), bucketSeconds: 30,
  series: [{ key, unit, source: 'simulator', aggregation: unit === 'enum' ? 'stableState' : 'mean', points }] });

test('lines retain valid zero, null, stale and missing raster slots without smoothing', () => {
  const data = history([point(0, 0), point(30, 5, 'stale'), point(60, null, 'unknown'), point(120, 12)]);
  const option = lineOptions(data, {});
  assert.deepEqual(option.series[0].data.map(p => p[1]), [0, null, null, null, 12]);
  assert.equal(option.series[0].connectNulls, false);
  assert.equal(option.series[0].smooth, false);
});
test('temperature ticks contain negative constant and broad ranges with five degree steps', () => {
  for (const values of [[-7.3, 34.5], [20, 20], [-40, 100]]) {
    const scale = numericScale(values, true, false);
    assert.ok(scale.min <= Math.min(...values) && scale.max >= Math.max(...values));
    assert.equal(scale.interval % 5, 0);
    assert.ok((scale.max - scale.min) / scale.interval + 1 <= 10);
  }
});
test('invalid outlier does not distort the scale; degrees and kelvin have distinct axes', () => {
  const data = history([point(0, 20), point(30, 9999, 'invalid')]);
  data.series.push({ ...history([point(0, 4)], 'temperatureSpread', 'K').series[0] });
  const option = lineOptions(data, {}, true);
  assert.deepEqual(option.yAxis.map(a => a.name), ['°C', 'K']);
  assert.equal(option.series[1].yAxisIndex, 1);
  assert.ok(option.yAxis[0].max < 100);
  assert.ok(numericScale([1.6], false, true).min >= 0);
});
test('state intervals clip edges, merge only adjacent equal states and preserve gaps', () => {
  const data = history([point(-15, 0), point(15, 0), point(45, 1), point(75, null, 'unknown'), point(105, 1), point(285, 1)], 'heatpumpState', 'enum');
  const intervals = stateIntervals(data, data.series[0]);
  assert.deepEqual(intervals.map(i => [(i.start - start) / 1000, (i.end - start) / 1000, i.label]),
    [[0, 45, 'Aus (0)'], [45, 75, 'Ein (1)'], [105, 135, 'Ein (1)'], [285, 300, 'Ein (1)']]);
});
test('quiet mode shows all levels and preserves unknown, invalid and stale gaps in both charts', () => {
  const data = history([point(0, 0), point(30, 1), point(60, 2), point(90, 3),
    point(120, null, 'unknown'), point(150, 0, 'stale'), point(180, 2, 'invalid'),
    point(210, 4), point(240, -1), point(270, 1.5)], 'quietMode', 'enum');
  assert.deepEqual(stateIntervals(data, data.series[0]).map(i => i.label),
    ['Aus (0)', 'Stufe 1 (1)', 'Stufe 2 (2)', 'Stufe 3 (3)']);
  const options = metricOptions(data, 'Flüstermodus', defaults);
  assert.equal(options.series[0].type, 'custom');
  assert.equal(options.series[0].data.length, 4);
  for (const value of [-1, 4, 1.5, NaN]) assert.equal(stateLabel('quietMode', value), null);
});

test('unknown enum, stale values and invalid state do not become off', () => {
  const data = history([point(0, 42), point(30, 0, 'stale'), point(60, -1), point(90, 1.5)], 'heatpumpState', 'enum');
  assert.deepEqual(stateIntervals(data, data.series[0]), []);
  assert.equal(stateLabel('operatingMode', 4), 'Heizen + Warmwasser (4)');
  assert.equal(stateLabel('threeWayValveState', 1), 'Warmwasser (1)');
  assert.equal(stateLabel('operatingMode', 8), 'Auto (Kühlen) + Warmwasser (8)');
  assert.notEqual(stateColor(0), stateColor(1));
  assert.equal(metricColor('flowTemperature'), '#0964d8');
});
test('Berlin timestamps distinguish repeated autumn hours regardless of host timezone', () => {
  assert.match(chartTime('2026-10-25T00:30:00Z'), /02:30:00.*GMT\+2/);
  assert.match(chartTime('2026-10-25T01:30:00Z'), /02:30:00.*GMT\+1/);
});
test('paired band cannot bridge an incomplete bucket or missing slot', () => {
  const points = [0, 30, 60, 90, 150].map(seconds => ({ time: new Date(start + seconds * 1000).toISOString(), flow: 30, return: 35, spread: -5, quality: seconds === 60 ? 'unknown' : 'valid', validPairs: 1, expectedPairs: 1 }));
  const segments = bandSegments({ bucketSeconds: 30, points });
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0], [start, start + 30000, 30, 35, 30, 35]);
});
test('zoom is bounded and export uses the actual selected duration and series count', () => {
  const domain = { from: start, to: start + 3600000 };
  const zoomed = zoomRange(domain, .5, domain);
  assert.equal(zoomed.to - zoomed.from, 1800000);
  assert.deepEqual(zoomRange(zoomed, 5, domain), domain);
  assert.equal(boundedRange(start, start), null);
  assert.equal(boundedRange(start, start + 701 * 86400000), null);
  assert.equal(csvAllowed(domain, 8, 30), true);
  assert.equal(csvAllowed({ from: start, to: start + 30 * 86400000 }, 8, 30), false);
});


test('temperatures including Dallas sensors retain two decimals in chart tooltips and axes', () => {
  for (const key of ['flowTemperature', 'returnTemperature', 'temperatureSpread', 'ds18b20_28abcdef01234567']) {
    assert.equal(metricNumber(34.5, key), '34,50');
    assert.equal(metricNumber(0, key), '0,00');
    assert.equal(metricNumber(-1.236, key), '-1,24');
    const data = history([{ time: new Date(start).toISOString(), value: 34.5, quality: 'valid', samples: 1 }], key);
    const option = lineOptions(data, { [key]: key });
    assert.equal(option.series[0].tooltip.valueFormatter(34.5), '34,50 °C');
    assert.equal(option.yAxis[0].axisLabel.formatter(35), '35,00');
    assert.match(option.tooltip.formatter([{ value: [start, 34.5], seriesId: 'trend:' + key, seriesName: key }]), /34,50/);
    assert.equal(data.series[0].points[0].value, 34.5);
  }
  assert.equal(metricNumber(34.5, 'outsideTemperature'), '34,5');
});


test('daily CSV preserves zero, negative minima, missing values and coverage; excludes future days', async () => {
  const { energyCsv } = await import('./src/charts/energyCsv.ts');
  const base = { date: '2026-03-29', kwh: 0, minOutdoorTemperatureC: -5.25, outdoorTemperatureSamples: 2,
    validSeconds: 60, expectedSeconds: 23 * 3600, status: 'partial' };
  const result = { year: 2026, source: 'simulator', electricalSource: 'heishamon-extra', timeZone: 'Europe/Berlin', days: [base,
    { ...base, date: '2026-03-30', kwh: null, minOutdoorTemperatureC: null, status: 'missing' },
    { ...base, date: '2026-03-31', status: 'future' }] };
  const csv = energyCsv(result);
  assert.ok(csv.startsWith('\uFEFFdate;consumptionKwh;minOutdoorTemperatureC'));
  assert.ok(csv.includes('"2026-03-29";0;-5,25;2;60;82800;"partial"'));
  assert.ok(csv.includes('"2026-03-30";;;2'));
  assert.ok(!csv.includes('2026-03-31'));
  assert.ok(csv.includes('"simulator";"heishamon-extra"'));
});

test('export filenames include a safe diagram name and local timestamp', async () => {
  const { exportFilename } = await import('./src/charts/exportFilename.ts');
  assert.equal(exportFilename('Temperatur / Verlauf', 'csv', new Date(2026, 9, 31, 8, 4, 5)), 'Temperatur - Verlauf-20261031-080405.csv');
});

test('relay states use on/off labels and the existing interval chart', () => {
  for (const key of ['relayOne', 'relayTwo']) {
    assert.equal(stateLabel(key, 0), 'Aus (0)');
    assert.equal(stateLabel(key, 1), 'Ein (1)');
    assert.equal(stateLabel(key, 2), null);
    const from = '2026-11-12T10:00:00Z', to = '2026-11-12T10:01:00Z';
    const series = { key, unit: 'enum', aggregation: 'observedIntervals', points: [], intervals: [
      { from, to, value: 1, quality: 'valid' }, { from, to, value: 0, quality: 'stale' }
    ] };
    const data = { from, to, bucketSeconds: 30, series: [series] };
    assert.equal(stateIntervals(data, series).length, 1);
    assert.equal(metricOptions(data, key, defaults).series[0].type, 'custom');
  }
});
