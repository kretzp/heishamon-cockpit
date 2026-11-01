import assert from 'node:assert/strict';
import { test } from 'node:test';
import { themeChart } from './src/charts/chartTheme.ts';

test('chart themes preserve measured zero, quality gaps, state colors and callbacks', () => {
  const formatter = () => 'Simulierter Wert';
  const series = [{ type: 'line', data: [[1, 0], [2, null], [3, 34.5]], connectNulls: false, itemStyle: { color: '#123456' } }];
  const option = { xAxis: { type: 'time' }, yAxis: [{ type: 'value', axisLabel: { formatter } }],
    tooltip: { formatter }, dataZoom: [{ type: 'slider', start: 20, end: 60 }], series };
  for (const theme of ['light', 'dark', 'nordic']) {
    const result = themeChart(option, theme);
    assert.deepEqual(result.series, series);
    assert.equal(result.yAxis[0].axisLabel.formatter, formatter);
    assert.equal(result.tooltip.formatter, formatter);
    assert.equal(result.dataZoom[0].start, 20);
    assert.equal(result.dataZoom[0].end, 60);
    assert.notEqual(result.textStyle.color, result.backgroundColor);
  }
  assert.equal(option.backgroundColor, undefined);
  assert.equal(option.yAxis[0].axisLabel.color, undefined);
});
