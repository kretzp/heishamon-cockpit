import { getLocale, text as localizeText, t as translate } from "../i18n/core.ts";
import type { EChartsOption } from 'echarts';
import { lineOptions, stateOptions, type History } from './historyOptions.ts';
import { metricColor } from './chartFormat.ts';
import { trendSeries, type TrendPoint } from './trendOptions.ts';
export type Preferences = {
  trend: boolean;
  type: 'line' | 'bar' | 'scatter';
  color: string;
  area: boolean;
  step: boolean;
  symbols: boolean;
  height: number;
  renderer: 'svg' | 'canvas';
  advanced: string;
};
export const defaults: Preferences = {
  trend: true,
  type: 'line',
  color: '#0964d8',
  area: false,
  step: false,
  symbols: true,
  height: 420,
  renderer: 'svg',
  advanced: '{}'
};
export function parseOptions(text: string): Record<string, unknown> {
  if (text.length > 100000) throw new Error(translate("Die Optionen dürfen höchstens 100.000 Zeichen enthalten."));
  const value: unknown = JSON.parse(text, (key, value) => {
    if ([translate("__proto__"), translate("constructor"), 'prototype'].includes(key)) throw new Error(translate("Unzulässiger Optionsschlüssel."));
    return value;
  });
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(translate("Ein JSON-Objekt wird erwartet."));
  return value as Record<string, unknown>;
}
// Component arrays merge by position, so a series style override keeps its measured data.
export function mergeOptions(base: unknown, override: unknown): unknown {
  if (Array.isArray(override)) {
    const result = Array.isArray(base) ? [...base] : [];
    override.forEach((v, i) => { result[i] = mergeOptions(result[i], v); });
    return result;
  }
  if (override && typeof override === 'object') {
    const result: Record<string, unknown> = base && typeof base === 'object' && !Array.isArray(base) ? {
      ...base
    } : {};
    for (const [key, value] of Object.entries(override)) result[key] = mergeOptions(result[key], value);
    return result;
  }
  return override;
}
export function readPreferences(key: string): Preferences {
  const fallback = {
    ...defaults,
    color: metricColor(key)
  };
  try {
    const p = JSON.parse(localStorage.getItem('heishamon-cockpit.chart.v1.' + key) ?? 'null');
    if (!p || !['line', 'bar', 'scatter'].includes(p.type) || !/^#[0-9a-f]{6}$/i.test(p.color) || !['svg', 'canvas'].includes(p.renderer) || ![300, 420, 600].includes(p.height) || ['area', 'step', 'symbols'].some(k => typeof p[k] !== 'boolean') || typeof p.advanced !== 'string') return fallback;
    parseOptions(p.advanced);
    return { ...p, trend: typeof p.trend === 'boolean' ? p.trend : true };
  } catch {
    return fallback;
  }
}
export function metricOptions(data: History, label: string, p: Preferences, labels: Record<string, string> = {}): EChartsOption {
  const s = data.series[0];
  const states = s?.aggregation === 'observedIntervals' || s?.aggregation === 'stableState';
  const base = states ? stateOptions(data, s) : lineOptions(data, {
    [s.key]: label, ...labels
  }, s.unit === '°C', s.key === 'waterPressure');
  if (!states) {
    const original = base.series as { data: TrendPoint[] }[];
    base.series = original.flatMap((series, index) => {
      const measurement = data.series[index];
      const color = index === 0 ? p.color : '#b75c25';
      const name = labels[measurement.key] ?? label;
      const styled = {
        ...series, type: p.type,
        itemStyle: { color },
        lineStyle: { color, width: 2, type: index === 0 ? 'solid' : 'dashed' },
        areaStyle: p.area ? { opacity: .16 } : undefined,
        step: p.step ? 'end' : false,
        showSymbol: p.symbols
      };
      return p.trend ? [styled, trendSeries(measurement.key, name, series.data, data.bucketSeconds, color)] : [styled];
    }) as EChartsOption['series'];
  }
  return mergeOptions({
    ...base,
    legend: data.series.length > 1 ? { type: 'scroll', top: 0 } : undefined,
    aria: {
      enabled: true,
      label: {
        description: translate("{0}: historischer Verlauf. Fehlende oder ungültige Messwerte bleiben leer. Originalwerte und Qualität stehen in der Tabelle unter dem Diagramm.", [s.key.startsWith('ds18b20_') ? label : localizeText(label)])
      }
    },
    grid: {
      ...base.grid,
      top: 60,
      bottom: 85
    },
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: translate("Bereich zoomen"),
            back: translate("Zoom zurück")
          }
        },
        restore: {
          title: translate("Ansicht zurücksetzen")
        },
        saveAsImage: {
          title: translate("Bild speichern"),
          name: label
        }
      }
    },
    dataZoom: [{
      type: 'slider',
      filterMode: 'none',
      bottom: 8
    }, {
      type: 'inside',
      filterMode: 'none',
      zoomOnMouseWheel: 'ctrl'
    }]
  }, parseOptions(p.advanced)) as EChartsOption;
}
