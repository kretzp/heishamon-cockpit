import { getLocale, text as localizeText, t as translate } from "../i18n/core.ts";
import type { EChartsOption, LineSeriesOption, CustomSeriesOption } from 'echarts';
import { format } from 'echarts/core.js';
import { metricNumber, axisTime, chartNumber, chartTime, metricColor, stateColor, stateLabel } from './chartFormat.ts';
import { trendSeries, type TrendPoint } from './trendOptions.ts';
export type Point = {
  time: string;
  value: number | null;
  quality: string;
  samples: number;
};
export type ObservedInterval = {
  from: string;
  to: string;
  value: number;
  quality: string;
  startObserved: boolean;
  endObserved: boolean;
};
export type Series = {
  key: string;
  unit: string;
  source: string;
  aggregation: string;
  points: Point[];
  intervals?: ObservedInterval[];
};
export type History = {
  from: string;
  to: string;
  bucketSeconds: number;
  series: Series[];
  resolution?: 'sampled' | 'bucketed';
  sampleSeconds?: number;
};
export type PairPoint = {
  time: string;
  flow: number | null;
  return: number | null;
  spread: number | null;
  quality: string;
  validPairs: number;
  expectedPairs: number;
};
export type PairResult = {
  from: string;
  to: string;
  bucketSeconds: number;
  source: string;
  maxPairSeconds: number;
  points: PairPoint[];
};
export const validPoint = (p: Point) => p.quality === 'valid' && p.value !== null && Number.isFinite(p.value);
export function numericScale(values: number[], temperature: boolean, pressure: boolean) {
  let min = Infinity,
    max = -Infinity;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!values.length) {
    min = 0;
    max = 1;
  }
  const padding = Math.max(pressure ? .1 : 1, (max - min) * .1);
  const step = pressure ? Math.max(.05, Math.ceil((max - min + 2 * padding) / 4 / .05) * .05) : Math.max(5, Math.ceil((max - min + 2 * padding) / 8 / 5) * 5);
  const low = pressure ? Math.max(0, Math.floor((min - padding) / step) * step) : temperature ? Math.floor((min - padding) / step) * step : min - padding;
  const high = temperature || pressure ? Math.ceil((max + padding) / step) * step : max + padding;
  return {
    min: low,
    max: high,
    interval: temperature || pressure ? step : undefined
  };
}
export function lineOptions(data: History, labels: Record<string, string>, temperature = false, pressure = false, trend = false): EChartsOption {
  const units = [...new Set(data.series.map(s => s.unit))];
  const series: LineSeriesOption[] = data.series.map(s => {
    const points: [number, number | null][] = [];
    let previous: number | undefined;
    for (const p of s.points) {
      const t = Date.parse(p.time);
      // Defensively preserve missing raster slots even if omitted by a response.
      if (previous !== undefined && t - previous > data.bucketSeconds * 1000) points.push([previous + data.bucketSeconds * 1000, null]);
      points.push([t, validPoint(p) ? p.value : null]);
      previous = t;
    }
    return {
      id: s.key,
      name: s.key.startsWith('ds18b20_') ? labels[s.key] ?? s.key : translate(labels[s.key] ?? s.key),
      type: 'line',
      data: points,
      yAxisIndex: units.indexOf(s.unit),
      connectNulls: false,
      smooth: false,
      showAllSymbol: true,
      symbol: 'circle',
      symbolSize: 5,
      itemStyle: {
        color: metricColor(s.key)
      },
      lineStyle: {
        width: 2,
        type: s.key.endsWith('Production') ? 'dashed' : 'solid'
      },
      tooltip: {
        valueFormatter: value => typeof value === 'number' ? `${metricNumber(value, s.key, pressure)} ${s.unit}` : translate("Unbekannt")
      }
    };
  });
  if (trend) for (const [index, s] of data.series.entries()) {
    if (s.aggregation !== 'mean') continue;
    series.push(trendSeries(s.key, translate(labels[s.key] ?? s.key), series[index].data as TrendPoint[], data.bucketSeconds, metricColor(s.key), units.indexOf(s.unit)));
  }
  return {
    animation: false,
    textStyle: {
      fontFamily: 'Segoe UI, sans-serif',
      color: '#40536b'
    },
    grid: {
      left: 65,
      right: units.length > 1 ? 60 : 20,
      top: 35,
      bottom: 60
    },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      confine: true,
      formatter: params => {
        const items = Array.isArray(params) ? params : [params];
        const first = items[0]?.value as [number, number | null] | undefined;
        return first ? [chartTime(first[0]), ...items.map(p => {
          const value = (p.value as [number, number | null])[1];
          const unit = data.series.find(s => s.key === String(p.seriesId).replace(/^trend:/, ''))?.unit ?? '';
          return `${p.seriesName}: ${value === null ? translate("Unbekannt") : metricNumber(value, String(p.seriesId), pressure) + ' ' + unit}`;
        })].join('\n') : '';
      },
      axisPointer: {
        label: {
          formatter: p => chartTime(Number(p.value))
        }
      }
    },
    xAxis: {
      type: 'time',
      min: Date.parse(data.from),
      max: Date.parse(data.to),
      splitNumber: 3,
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
    yAxis: units.map((unit, index) => ({
      type: 'value',
      name: unit,
      position: index === 0 ? 'left' : 'right',
      ...numericScale(data.series.filter(s => s.unit === unit).flatMap(s => s.points.filter(validPoint).map(p => p.value!)), temperature, pressure),
      axisLabel: {
        formatter: (value: number) => chartNumber(value, pressure || data.series.some(s => s.unit === unit && (s.key.startsWith('ds18b20_') || ['flowTemperature', 'returnTemperature', 'temperatureSpread', 'mainTargetTemperature', 'curveYCold', 'curveYWarm'].includes(s.key))))
      },
      splitLine: {
        show: index === 0,
        lineStyle: {
          color: '#dce5f0'
        }
      }
    })),
    series
  };
}
export type StateInterval = {
  start: number;
  end: number;
  value: number;
  label: string;
};
export function stateIntervals(data: History, series: Series): StateInterval[] {
  if (series.intervals) return series.intervals.filter(i => i.quality === 'valid' && stateLabel(series.key, i.value) !== null).map(i => ({
    start: Date.parse(i.from),
    end: Date.parse(i.to),
    value: i.value,
    label: stateLabel(series.key, i.value)!
  }));
  const result: StateInterval[] = [];
  for (const p of series.points) {
    if (!validPoint(p)) continue;
    const label = stateLabel(series.key, p.value!);
    if (!label) continue;
    const start = Math.max(Date.parse(data.from), Date.parse(p.time));
    const end = Math.min(Date.parse(data.to), Date.parse(p.time) + data.bucketSeconds * 1000);
    if (end <= start) continue;
    const last = result.at(-1);
    if (last && last.value === p.value && last.end === start) last.end = end;else result.push({
      start,
      end,
      value: p.value!,
      label
    });
  }
  return result;
}
export function stateOptions(data: History, series: Series): EChartsOption {
  const intervals = stateIntervals(data, series);
  const bars: CustomSeriesOption = {
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    clip: true,
    data: intervals.map(i => [i.start, i.end, i.value]),
    encode: {
      x: [0, 1]
    },
    renderItem: (_params, api) => {
      const start = api.coord([api.value(0), 0]);
      const end = api.coord([api.value(1), 0]);
      const width = Math.max(0, end[0] - start[0] - 1);
      const value = Number(api.value(2));
      const label = stateLabel(series.key, value) ?? '';
      const suffix = ` (${value})`;
      const font = '13px "Segoe UI", sans-serif';
      const text = width >= 55 ? format.truncateText(label.slice(0, -suffix.length), Math.max(0, width - 12 - format.getTextRect(suffix, font).width), font, '…') + suffix : suffix.trim();
      return {
        type: 'group',
        children: [{
          type: 'rect',
          shape: {
            x: start[0],
            y: start[1] - 19,
            width,
            height: 38
          },
          style: {
            fill: stateColor(Number(api.value(2)))
          }
        }, ...(width > 18 ? [{
          type: 'text' as const,
          style: {
            x: start[0] + width / 2,
            y: start[1],
            text,
            fill: '#fff',
            font,
            align: 'center' as const,
            verticalAlign: 'middle' as const,
            width: Math.max(0, width - 12),
            overflow: 'truncate' as const
          }
        }] : [])]
      };
    }
  };
  return {
    animation: false,
    textStyle: {
      fontFamily: 'Segoe UI, sans-serif'
    },
    grid: {
      left: 20,
      right: 20,
      top: 5,
      bottom: 50
    },
    xAxis: {
      type: 'time',
      min: Date.parse(data.from),
      max: Date.parse(data.to),
      splitNumber: 3,
      axisLabel: {
        formatter: axisTime,
        hideOverlap: true
      },
      axisPointer: {
        show: true,
        label: {
          formatter: p => chartTime(Number(p.value))
        }
      }
    },
    yAxis: {
      type: 'value',
      min: -1,
      max: 1,
      show: false
    },
    tooltip: {
      trigger: 'item',
      renderMode: 'richText',
      confine: true,
      formatter: params => {
        const p = Array.isArray(params) ? params[0] : params;
        const i = intervals[p.dataIndex];
        return translate("{0}\n{1} – {2}\nDauer: {3} s\nAktuell · {4} · Raster {5} s", [localizeText(i.label), localizeText(chartTime(i.start)), localizeText(chartTime(i.end)), localizeText(chartNumber((i.end - i.start) / 1000)), localizeText(series.source === 'simulator' ? translate("Simulation") : 'MQTT'), localizeText(data.bucketSeconds)]);
      }
    },
    series: [bars]
  };
}
