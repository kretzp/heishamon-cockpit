import type { LineSeriesOption } from 'echarts';
import { t } from '../i18n/core.ts';

export type TrendPoint = [number, number | null];

/** Centred triangular mean, radius five samples. Never cross gaps or extrapolate. */
export function trendPoints(points: readonly TrendPoint[], bucketSeconds: number): TrendPoint[] {
  const result: TrendPoint[] = [];
  let segment: TrendPoint[] = [];
  const flush = () => {
    for (let i = 0; i < segment.length; i++) {
      let total = 0, weight = 0;
      for (let j = Math.max(0, i - 5); j <= Math.min(segment.length - 1, i + 5); j++) {
        const w = 6 - Math.abs(i - j);
        total += segment[j][1]! * w;
        weight += w;
      }
      result.push([segment[i][0], segment.length >= 3 ? total / weight : null]);
    }
    segment = [];
  };
  let previous: number | undefined;
  for (const [time, value] of points) {
    if (previous !== undefined && (time <= previous || time - previous > bucketSeconds * 1000)) {
      flush();
      result.push([previous + Math.min(bucketSeconds * 1000, (time - previous) / 2), null]);
    }
    if (value === null || !Number.isFinite(value) || !Number.isFinite(time)) {
      flush();
      result.push([time, null]);
    } else segment.push([time, value]);
    previous = time;
  }
  flush();
  return result;
}

export function trendSeries(id: string, name: string, points: readonly TrendPoint[], bucketSeconds: number, color: string, yAxisIndex = 0): LineSeriesOption {
  return {
    id: 'trend:' + id, name: t('{0} · Trend (berechnet)', [name]), type: 'line',
    data: trendPoints(points, bucketSeconds), yAxisIndex, connectNulls: false,
    smooth: .25, smoothMonotone: 'x', showSymbol: false, z: 5,
    lineStyle: { width: 3, type: 'dotted', color }, itemStyle: { color },
  };
}
