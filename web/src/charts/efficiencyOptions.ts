import { getLocale, text as localizeText, t as translate } from "../i18n/core.ts";
import type { EChartsOption } from 'echarts';
import { axisTime, chartNumber, chartTime } from './chartFormat.ts';
import { trendSeries, type TrendPoint } from './trendOptions.ts';
export type CopPoint = {
  time: string;
  mode: 'heat' | 'dhw' | null;
  cop: number | null;
  average: number | null;
  validSeconds: number;
  expectedSeconds: number;
};
export type CopResult = {
  electricalSource?: string;
  from: string;
  to: string;
  bucketSeconds: number;
  windowMinutes: number;
  source: string;
  minimumElectricalWatts: number;
  maxPairSeconds: number;
  validSeconds: number;
  expectedSeconds: number;
  energyRatio: number | null;
  points: CopPoint[];
};
export type EnergyDay = {
  minOutdoorTemperatureC?: number | null;
  outdoorTemperatureSamples?: number;
  heatpumpKwh?: number | null;
  heaterKwh?: number | null;
  heatpumpValidSeconds?: number;
  heaterValidSeconds?: number;
  date: string;
  from: string;
  to: string;
  kwh: number | null;
  validSeconds: number;
  expectedSeconds: number;
  status: 'complete' | 'partial' | 'missing' | 'current' | 'future';
};
export type EnergyResult = {
  electricalSource?: string;
  maxGapSeconds?: number;
  year: number;
  source: string;
  unit: string;
  timeZone: string;
  days: EnergyDay[];
};
export const dayStatus = {
  complete: 'Vollständig',
  partial: 'Unvollständig',
  missing: 'Keine Daten',
  current: 'Laufender Tag',
  future: 'Zukünftig'
};
export function copOptions(result: CopResult, trend = false): EChartsOption {
  const option: EChartsOption = {
    animation: false,
    aria: {
      enabled: true
    },
    grid: {
      left: 55,
      right: 25,
      top: 45,
      bottom: 55
    },
    xAxis: {
      type: 'time',
      splitNumber: 5,
      axisLabel: {
        formatter: axisTime,
        hideOverlap: true
      },
      axisPointer: {
        label: {
          formatter: p => chartTime(Number(p.value))
        }
      }
    },
    yAxis: {
      type: 'value',
      name: 'COP',
      min: 0
    },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      formatter: (raw: unknown) => {
        const rows = raw as {
          seriesName: string;
          value: [number, number | null];
        }[];
        return rows.length ? chartTime(rows[0].value[0]) + '\n' + rows.map(r => r.seriesName + ': ' + (r.value[1] === null ? translate("unbekannt") : chartNumber(r.value[1]))).join('\n') : '';
      }
    },
    series: (['heat', 'dhw'] as const).flatMap((mode, index) => (['cop', 'average'] as const).map(key => ({
      type: 'line' as const,
      name: (mode === 'heat' ? translate("Heizen") : translate("Warmwasser")) + (key === 'average' ? ` · ${result.windowMinutes} min` : ' · COP'),
      connectNulls: false,
      showSymbol: true,
      symbolSize: 4,
      lineStyle: {
        width: key === 'average' ? 3 : 1,
        type: key === 'average' ? 'solid' as const : 'dashed' as const
      },
      itemStyle: {
        color: index === 0 ? '#0964d8' : '#a42b6c'
      },
      data: result.points.map(p => [Date.parse(p.time), p.mode === mode ? p[key] : null])
    })))
  };
  if (trend) for (const [index, mode] of (['heat', 'dhw'] as const).entries()) {
    const points: TrendPoint[] = result.points.map(p => [Date.parse(p.time), p.mode === mode ? p.cop : null]);
    (option.series as object[]).push(trendSeries('cop-' + mode, mode === 'heat' ? translate('Heizen') : translate('Warmwasser'), points, result.bucketSeconds, index === 0 ? '#0964d8' : '#a42b6c'));
  }
  return option;
}
export function energyOptions(result: EnergyResult): EChartsOption {
  const colored = (d: EnergyDay) => d.kwh !== null && (d.status === 'complete' || d.status === 'partial' && d.validSeconds >= 20 * 3600);
  const maximum = Math.max(1, ...result.days.filter(colored).map(d => d.kwh ?? 0));
  return {
    animation: false,
    aria: {
      enabled: true
    },
    tooltip: {
      renderMode: 'richText',
      formatter: (raw: unknown) => {
        const p = raw as {
          value: [string, number];
        };
        const d = result.days.find(day => day.date === p.value?.[0]);
        return d ? `${d.date} · ${translate(dayStatus[d.status])}\n${d.kwh === null ? translate("Keine erfasste Energie") : chartNumber(d.kwh) + translate(' kWh erfasst')}\n${chartNumber(d.validSeconds / 3600)} / ${chartNumber(d.expectedSeconds / 3600)} h` : '';
      }
    },
    visualMap: {
      min: 0,
      max: maximum,
      seriesIndex: [0, 2, 4, 6],
      dimension: 1,
      orient: 'horizontal',
      left: 'center',
      bottom: 5,
      text: [`${chartNumber(maximum)} kWh`, '0 kWh'],
      inRange: {
        color: ['#deedf7', '#0964d8', '#102c63']
      },
      calculable: false
    },
    calendar: [0, 1, 2, 3].map(q => ({
      top: 80 + q * 410,
      left: 35,
      right: 15,
      cellSize: ['auto', 44],
      range: [`${result.year}-${String(q * 3 + 1).padStart(2, '0')}-01`, `${result.year}-${String(q * 3 + 3).padStart(2, '0')}-${q === 0 || q === 3 ? 31 : 30}`],
      yearLabel: {
        show: false
      },
      monthLabel: {
        nameMap: [translate("Jan"), translate("Feb"), translate("Mär"), translate("Apr"), translate("Mai"), translate("Jun"), translate("Jul"), translate("Aug"), translate("Sep"), translate("Okt"), translate("Nov"), translate("Dez")]
      },
      dayLabel: {
        firstDay: 1,
        nameMap: [translate("So"), translate("Mo"), translate("Di"), translate("Mi"), translate("Do"), translate("Fr"), translate("Sa")]
      },
      splitLine: {
        lineStyle: {
          color: '#62758b',
          width: 1
        }
      },
      itemStyle: {
        borderWidth: 1,
        borderColor: '#fff'
      }
    })),
    series: [0, 1, 2, 3].flatMap(q => {
      const days = result.days.filter(d => Math.floor((Number(d.date.slice(5, 7)) - 1) / 3) === q);
      return [{
        type: 'heatmap' as const,
        coordinateSystem: 'calendar' as const,
        calendarIndex: q,
        data: days.filter(colored).map(d => ({
          value: [d.date, d.kwh],
          label: { show: d.status === 'partial', formatter: '!', color: '#fff', fontSize: 11, textBorderColor: '#35445a', textBorderWidth: 2 }
        }))
      }, {
        type: 'heatmap' as const,
        coordinateSystem: 'calendar' as const,
        calendarIndex: q,
        data: days.filter(d => !colored(d)).map(d => ({
          value: [d.date, 0],
          itemStyle: {
            color: d.status === 'partial' ? '#f6db9c' : d.status === 'current' ? '#d6e7de' : '#edf0f3'
          },
          label: {
            show: true,
            color: '#35445a',
            fontSize: 11,
            formatter: d.status === 'partial' ? '!' : d.status === 'current' ? '…' : d.status === 'missing' ? '–' : ''
          }
        }))
      }];
    })
  };
}
