import type { CustomSeriesOption, HeatmapSeriesOption, VisualMapComponentOption } from 'echarts';
import type { EnergyDay, EnergyResult } from './efficiencyOptions.ts';
import { getLocale } from '../i18n/core.ts';

export type EnergyCalendarMode = 'consumption' | 'temperature' | 'split';
const temperatureColors = ['#102c63', '#297ac0', '#deedf7', '#f5ba74', '#c62828'];
const consumptionColors = ['#deedf7', '#0964d8', '#102c63'];

export function calendarColor(value: number, min: number, max: number, colors: string[]): string {
  const position = Math.max(0, Math.min(1, (value - min) / (max - min))) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(position));
  const fraction = position - index;
  const rgb = [1, 3, 5].map(offset => Math.round(
    parseInt(colors[index].slice(offset, offset + 2), 16) * (1 - fraction)
    + parseInt(colors[index + 1].slice(offset, offset + 2), 16) * fraction));
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
}

export function temperatureLegend(seriesIndex: number[]): VisualMapComponentOption {
  return { type: 'continuous', min: -15, max: 30, dimension: 1, seriesIndex,
    orient: 'horizontal', left: 'center', bottom: 5, calculable: false,
    text: ['+30 °C', '−15 °C'], inRange: { color: temperatureColors } };
}

export function calendarModeSeries(result: EnergyResult, mode: 'temperature' | 'split', maximum: number,
  colored: (day: EnergyDay) => boolean): (CustomSeriesOption | HeatmapSeriesOption)[] {
  const number = (value: number, digits: number) => new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return [0, 1, 2, 3].map(q => {
    const days = result.days.filter(d => Math.floor((Number(d.date.slice(5, 7)) - 1) / 3) === q);
    if (mode === 'temperature') return {
      type: 'heatmap', coordinateSystem: 'calendar', calendarIndex: q,
      data: days.map(d => {
        const temperature = d.status !== 'future' ? d.averageOutdoorTemperatureC : null;
        return { value: [d.date, temperature ?? 0],
          ...(temperature == null ? { itemStyle: { color: '#edf0f3' } } : {}),
          label: { show: true, fontSize: 11, color: '#fff', textBorderColor: '#35445a', textBorderWidth: 2,
            formatter: d.status === 'future' ? '' : temperature == null ? '—' : number(temperature, 1) + '°C' } };
      })
    } satisfies HeatmapSeriesOption;
    return {
      type: 'custom', coordinateSystem: 'calendar', calendarIndex: q,
      data: days.map(d => [d.date, d.kwh ?? 0, d.averageOutdoorTemperatureC ?? 0]),
      renderItem: (params, api) => {
        const d = days[params.dataIndex];
        const [x, y] = api.coord([d.date]);
        // ECharts exposes these calendar fields at runtime (calendar/prepareCustom).
        const { cellWidth: width, cellHeight: height } = params.coordSys as typeof params.coordSys & { cellWidth: number; cellHeight: number };
        const future = d.status === 'future';
        const background = colored(d) ? calendarColor(d.kwh!, 0, maximum, consumptionColors)
          : d.status === 'partial' ? '#f6db9c' : d.status === 'current' ? '#d6e7de' : '#edf0f3';
        const temperature = future ? null : d.averageOutdoorTemperatureC;
        const marker = d.status === 'partial' ? '! ' : d.status === 'current' ? '… ' : '';
        const half = (top: boolean, fill: string, label: string) => [
          { type: 'rect' as const, shape: { x: x - width / 2 + .5, y: y - height / 2 + (top ? 0 : height / 2) + .5,
            width: width - 1, height: height / 2 - 1 }, style: { fill } },
          { type: 'text' as const, style: { x, y: y + (top ? -height / 4 : height / 4), text: label,
            align: 'center' as const, verticalAlign: 'middle' as const, fontSize: 10,
            fill: '#fff', stroke: '#35445a', lineWidth: 2 } }
        ];
        return { type: 'group', children: [
          ...half(true, background, future ? '' : marker + (d.kwh == null ? '—' : number(d.kwh, 2) + ' kWh')),
          ...half(false, temperature == null ? '#edf0f3' : calendarColor(temperature, -15, 30, temperatureColors),
            future ? '' : temperature == null ? '—' : number(temperature, 1) + '°C')
        ] };
      }
    } satisfies CustomSeriesOption;
  });
}
