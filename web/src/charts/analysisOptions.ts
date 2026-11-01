import { getLocale, text as localizeText, t as translate } from "../i18n/core.ts";
import type { CustomSeriesOption, EChartsOption, LineSeriesOption } from 'echarts';
import type { History, PairPoint, PairResult } from './historyOptions.ts';
import { metricNumber, chartNumber, chartTime } from './chartFormat.ts';
const valid = (p: PairPoint) => p.quality === 'valid' && p.flow !== null && p.return !== null && p.spread !== null && [p.flow, p.return, p.spread].every(Number.isFinite);
export function bandSegments(pairs: PairResult) {
  return pairs.points.flatMap((p, index) => {
    const next = pairs.points[index + 1];
    if (!next || !valid(p) || !valid(next) || Date.parse(next.time) - Date.parse(p.time) !== pairs.bucketSeconds * 1000) return [];
    return [[Date.parse(p.time), Date.parse(next.time), p.flow!, p.return!, next.flow!, next.return!]];
  });
}
export function addAnalysis(option: EChartsOption, data: History, pairs?: PairResult | null, states?: History | null): EChartsOption {
  const series = [...(Array.isArray(option.series) ? option.series : [])];
  if (pairs && data.series.some(s => s.key === 'flowTemperature') && data.series.some(s => s.key === 'returnTemperature')) {
    const degrees = [...new Set(data.series.map(s => s.unit))].indexOf('°C');
    const band: CustomSeriesOption = {
      type: 'custom',
      name: translate("Zeitlich geprüftes Spreizungsband"),
      yAxisIndex: degrees,
      z: 0,
      silent: true,
      clip: true,
      data: bandSegments(pairs),
      encode: {
        x: [0, 1],
        y: [2, 3, 4, 5]
      },
      renderItem: (_params, api) => {
        const a = api.coord([api.value(0), api.value(2)]);
        const b = api.coord([api.value(0), api.value(3)]);
        const c = api.coord([api.value(1), api.value(4)]);
        const d = api.coord([api.value(1), api.value(5)]);
        // Split crossings so a negative spread remains a real signed value, not a self-intersecting fill.
        const first = Number(api.value(2)) - Number(api.value(3));
        const last = Number(api.value(4)) - Number(api.value(5));
        const cross = first * last < 0;
        const ratio = cross ? first / (first - last) : 0;
        const center = [a[0] + (c[0] - a[0]) * ratio, a[1] + (c[1] - a[1]) * ratio];
        return {
          type: 'group',
          children: (cross ? [[a, b, center], [center, c, d]] : [[a, c, d, b]]).map(points => ({
            type: 'polygon',
            shape: {
              points
            },
            style: {
              fill: '#177b83',
              opacity: .18
            }
          }))
        };
      }
    };
    series.push(band);
    // Pair values in their own line series make the actual paired means available in the shared tooltip.
    for (const [key, name] of [['flow', translate("Gepaarter Vorlauf")], ['return', translate("Gepaarter Rücklauf")]] as const) {
      series.push({
        type: 'line',
        name,
        id: key === 'flow' ? 'pair:flowTemperature' : 'pair:returnTemperature',
        yAxisIndex: degrees,
        z: 1,
        showSymbol: false,
        connectNulls: false,
        data: pairs.points.map(p => [Date.parse(p.time), valid(p) ? p[key] : null]),
        lineStyle: {
          width: 1,
          color: '#177b83',
          type: 'dotted'
        },
        itemStyle: {
          color: '#177b83'
        }
      });
    }
  }
  const active = states?.series.find(s => s.key === 'sterilizationState')?.intervals?.filter(i => i.quality === 'valid' && i.value === 1) ?? [];
  if (active.length && series.length) {
    const first = {
      ...series[0]
    } as LineSeriesOption;
    first.markArea = {
      silent: true,
      itemStyle: {
        color: 'rgba(160,85,12,.10)'
      },
      data: active.map(i => [{
        xAxis: Date.parse(i.from)
      }, {
        xAxis: Date.parse(i.to)
      }])
    };
    first.markLine = {
      symbol: 'none',
      silent: true,
      label: {
        show: false
      },
      lineStyle: {
        color: '#a0550c',
        type: 'dashed'
      },
      data: active.flatMap(i => [...(i.startObserved ? [{
        name: translate("Sterilisation aktiv beobachtet"),
        xAxis: Date.parse(i.from)
      }] : []), ...(i.endObserved ? [{
        name: translate("Sterilisation inaktiv beobachtet"),
        xAxis: Date.parse(i.to)
      }] : [])])
    };
    series[0] = first;
  }
  return {
    ...option,
    series,
    tooltip: {
      ...option.tooltip,
      trigger: 'axis',
      renderMode: 'richText',
      confine: true,
      formatter: params => {
        const items = Array.isArray(params) ? params : [params];
        const t = (items[0]?.value as number[] | undefined)?.[0];
        if (t === undefined) return '';
        const pair = pairs?.points.find(p => Date.parse(p.time) === t);
        return [chartTime(t), ...items.filter(p => p.seriesType === 'line').map(p => {
          const value = (p.value as (number | null)[])[1];
          const unit = data.series.find(s => s.key === String(p.seriesId).replace(/^trend:/, ''))?.unit ?? '°C';
          return `${p.seriesName}: ${value === null ? translate("Unbekannt") : metricNumber(value, String(p.seriesId)) + ' ' + unit}`;
        }), ...(pair ? [translate("Gepaarte Spreizung: {0} · {1}/{2} Paare", [localizeText(valid(pair) ? metricNumber(pair.spread!, 'temperatureSpread') + ' K' : translate("Unbekannt")), localizeText(pair.validPairs), localizeText(pair.expectedPairs)])] : [])].join('\n');
      }
    }
  };
}
