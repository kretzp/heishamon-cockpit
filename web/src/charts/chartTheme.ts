import type { EChartsOption } from 'echarts';
import type { Theme } from '../Theme';

const palettes = {
  light: { text: '#53647a', border: '#d5dde8', card: '#ffffff', surface: '#edf1f6', warning: '#fff3db' },
  dark: { text: '#afbed0', border: '#3b4d64', card: '#182231', surface: '#202e40', warning: '#3c2f1b' },
  nordic: { text: '#506273', border: '#bfcdd5', card: '#f8fafb', surface: '#e0e8ed', warning: '#f4e9d4' },
};
export const chartBackground = (theme: Theme) => palettes[theme].card;

/** Theme chart chrome only. Series/state colors, callbacks, data and custom JSON stay intact. */
export function themeChart(option: EChartsOption, theme: Theme): EChartsOption {
  const p = palettes[theme];
  const map = (value: unknown, transform: (item: Record<string, unknown>) => Record<string, unknown>): unknown =>
    Array.isArray(value) ? value.map(item => transform(item as Record<string, unknown>))
      : value && typeof value === 'object' ? transform(value as Record<string, unknown>) : value;
  const addColor = (value: unknown, color: string) => ({ ...(value as object ?? {}), color });
  const axis = (item: Record<string, unknown>) => ({ ...item,
    axisLabel: addColor(item.axisLabel, p.text), nameTextStyle: addColor(item.nameTextStyle, p.text),
    axisLine: { ...(item.axisLine as object), lineStyle: addColor((item.axisLine as { lineStyle?: object })?.lineStyle, p.border) },
    splitLine: { ...(item.splitLine as object), lineStyle: addColor((item.splitLine as { lineStyle?: object })?.lineStyle, p.border) },
  });
  return { ...option, backgroundColor: p.card, textStyle: { ...option.textStyle, color: p.text },
    ...(option.xAxis ? { xAxis: map(option.xAxis, axis) } : {}),
    ...(option.yAxis ? { yAxis: map(option.yAxis, axis) } : {}),
    ...(option.tooltip ? { tooltip: map(option.tooltip, item => ({ ...item, backgroundColor: p.card, borderColor: p.border, textStyle: addColor(item.textStyle, p.text) })) } : {}),
    ...(option.visualMap ? { visualMap: map(option.visualMap, item => ({ ...item, textStyle: addColor(item.textStyle, p.text) })) } : {}),
    ...(option.calendar ? { calendar: map(option.calendar, item => ({ ...item,
      dayLabel: addColor(item.dayLabel, p.text), monthLabel: addColor(item.monthLabel, p.text), yearLabel: addColor(item.yearLabel, p.text),
      itemStyle: { ...(item.itemStyle as object), color: p.surface, borderColor: p.border },
    })) } : {}),
    ...(option.dataZoom ? { dataZoom: map(option.dataZoom, item => ({ ...item, textStyle: addColor(item.textStyle, p.text), borderColor: p.border, backgroundColor: p.surface })) } : {}),
    series: map(option.series, item => ({ ...item,
      ...(item.markArea ? { markArea: { ...(item.markArea as object), itemStyle: { ...((item.markArea as { itemStyle?: object }).itemStyle), color: p.warning } } } : {}),
    })),
  } as EChartsOption;
}
