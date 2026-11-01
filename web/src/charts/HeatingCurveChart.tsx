import { t, text as localizeText, getLocale } from "../i18n/core";
import { useLanguage } from "../i18n/Language";
import { useEffect, useMemo, useState } from 'react';
import type { EChartsOption, LineSeriesOption } from 'echarts';
import { curveMarker, curveValue, type CurveValues } from '../heatingCurveMath';
import { chartNumber } from './chartFormat';
import { ChartFrame } from './ChartFrame';
export function HeatingCurveChart({
  c,
  outside
}: {
  c: CurveValues;
  outside: number | null;
}) {
  const language = useLanguage();
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 650px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 650px)');
    const changed = () => setCompact(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  const option = useMemo<EChartsOption>(() => {
    const marker = curveMarker(outside);
    const minX = Math.floor(Math.min(-20, marker ?? 0) / 5) * 5;
    const maxX = Math.ceil(Math.max(25, c.heatingOffTemperature + 5, marker ?? 0) / 5) * 5;
    const minY = Math.floor(Math.min(20, c.yWarm - 5) / 5) * 5;
    const maxY = Math.ceil(Math.max(40, c.yCold + 5) / 5) * 5;
    const xs = [...new Set([minX, c.xCold, c.xWarm, c.heatingOffTemperature, maxX])].sort((a, b) => a - b);
    const line = (active: boolean): LineSeriesOption => ({
      type: 'line',
      name: active ? t("Heizkurve") : t("Heizbetrieb aus"),
      data: xs.filter(x => active ? x <= c.heatingOffTemperature : x >= c.heatingOffTemperature).map(x => [x, curveValue(c, x)]),
      showSymbol: false,
      lineStyle: {
        color: active ? '#008581' : '#9b6b45',
        width: 3,
        type: active ? 'solid' : 'dashed'
      }
    });
    return {
      animation: false,
      textStyle: {
        fontFamily: 'Segoe UI, sans-serif',
        color: '#374d66'
      },
      grid: {
        left: 48,
        right: 24,
        top: 70,
        bottom: 60
      },
      tooltip: {
        trigger: 'item',
        renderMode: 'richText',
        confine: true,
        formatter: params => {
          const p = Array.isArray(params) ? params[0] : params;
          const v = p.value as number[];
          return t("{0}\nAußen: {1} °C\nVorlauf-Soll: {2} °C", [localizeText(p.name || p.seriesName), localizeText(chartNumber(v[0])), localizeText(chartNumber(v[1], true))]);
        }
      },
      xAxis: {
        type: 'value',
        min: minX,
        max: maxX,
        interval: compact ? 10 : 5,
        name: t("Außentemperatur (°C)"),
        nameLocation: 'middle',
        nameGap: 35,
        axisLabel: {
          formatter: (v: number) => chartNumber(v),
          hideOverlap: true
        },
        splitLine: {
          lineStyle: {
            color: '#e6edf5'
          }
        }
      },
      yAxis: {
        type: 'value',
        min: minY,
        max: maxY,
        interval: 5,
        name: t("Vorlauf-Solltemperatur (°C)"),
        nameLocation: 'end',
        nameTextStyle: {
          align: 'left'
        },
        axisLabel: {
          formatter: (v: number) => chartNumber(v, true)
        },
        splitLine: {
          lineStyle: {
            color: '#dce5ef'
          }
        }
      },
      series: [{
        ...line(true),
        markArea: {
          silent: true,
          itemStyle: {
            color: '#fff0e2'
          },
          data: [[{
            xAxis: c.heatingOffTemperature
          }, {
            xAxis: maxX
          }]]
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: {
            color: '#b55208',
            type: 'dashed'
          },
          label: {
            formatter: t("Aus ab {0} °C", [localizeText(chartNumber(c.heatingOffTemperature))]),
            position: 'insideEndTop'
          },
          data: [{
            xAxis: c.heatingOffTemperature
          }]
        }
      }, line(false), {
        type: 'scatter',
        symbolSize: 11,
        itemStyle: {
          color: '#008581'
        },
        data: [{
          name: t("Kaltpunkt"),
          value: [c.xCold, c.yCold],
          label: {
            align: compact ? 'left' : 'center'
          }
        }, {
          name: t("Warmpunkt"),
          value: [c.xWarm, c.yWarm],
          label: {
            align: compact ? 'right' : 'center'
          }
        }],
        label: {
          show: true,
          position: 'top',
          formatter: p => {
            const v = p.value as number[];
            return `${chartNumber(v[0])} / ${chartNumber(v[1], true)} °C`;
          }
        }
      }, ...(marker === null ? [] : [{
        type: 'scatter' as const,
        name: t("Berechneter Kurvenwert"),
        symbolSize: 11,
        data: [[marker, curveValue(c, marker)]],
        itemStyle: {
          color: '#1268ba'
        },
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            show: false
          },
          lineStyle: {
            color: '#1268ba',
            type: 'dotted' as const
          },
          data: [{
            xAxis: marker
          }]
        }
      }])]
    };
  }, [c, outside, compact, language]);
  return <ChartFrame className="curve-chart" option={option} height={400} title={localizeText(t("Heizkurve von {0} °C außen mit {1} °C Vorlauf bis {2} °C außen mit {3} °C Vorlauf. Heizgrenze {4} °C.", [localizeText(chartNumber(c.xCold)), localizeText(chartNumber(c.yCold, true)), localizeText(chartNumber(c.xWarm)), localizeText(chartNumber(c.yWarm, true)), localizeText(chartNumber(c.heatingOffTemperature))]))} />;
}
