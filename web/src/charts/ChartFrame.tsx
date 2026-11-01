import { t, text as localizeText, getLocale } from "../i18n/core";
import { useLanguage } from "../i18n/Language";
import { useTheme } from '../Theme';
import { themeChart } from './chartTheme';
import { chartLocales } from './chartLocale';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import * as echarts from 'echarts/core';
import { LineChart, ScatterChart, CustomChart, HeatmapChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, AriaComponent, DataZoomComponent, CalendarComponent, VisualMapComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { boundedRange, type TimeRange } from './historyRange';
echarts.use([LineChart, ScatterChart, CustomChart, HeatmapChart, CalendarComponent, VisualMapComponent, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, AriaComponent, DataZoomComponent, SVGRenderer]);
const style = {
  width: '100%',
  height: '100%'
};
export type ChartSync = {
  group: string;
  domain: TimeRange;
  range: TimeRange;
  onZoom: (range: TimeRange) => void;
};
const groups = new Map<string, number>();
export function ChartFrame({
  option,
  title,
  className = 'history-chart',
  height = 320,
  sync,
  onDateClick
}: {
  option: EChartsOption;
  title: string;
  className?: string;
  height?: number;
  sync?: ChartSync;
  onDateClick?: (date: string) => void;
}) {
  const language = useLanguage();
  const opts = useMemo(() => ({ renderer: 'svg' as const, locale: chartLocales[language] }), [language]);
  const {
    theme
  } = useTheme();
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 650px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 650px)');
    const changed = () => setCompact(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const latest = useRef(sync);
  latest.current = sync;
  const ready = useCallback((chart: echarts.EChartsType) => {
    if (latest.current) {
      chart.group = latest.current.group;
      echarts.connect(chart.group);
    }
  }, []);
  useEffect(() => {
    if (!sync) return;
    const group = sync.group;
    groups.set(group, (groups.get(group) ?? 0) + 1);
    return () => {
      const count = (groups.get(group) ?? 1) - 1;
      if (count === 0) {
        groups.delete(group);
        echarts.disconnect(group);
      } else groups.set(group, count);
    };
  }, [sync?.group]);
  const events = useMemo(() => ({
    click: (event: {
      value?: unknown;
    }) => {
      if (Array.isArray(event.value) && typeof event.value[0] === 'string') onDateClick?.(event.value[0]);
    },
    datazoom: (event: {
      start?: number;
      end?: number;
      batch?: {
        start?: number;
        end?: number;
      }[];
    }) => {
      const s = latest.current;
      const e = event.batch?.[0] ?? event;
      if (!s || e.start === undefined || e.end === undefined) return;
      const width = s.domain.to - s.domain.from;
      const range = boundedRange(Math.round(s.domain.from + width * e.start / 100), Math.round(s.domain.from + width * e.end / 100));
      if (range && range.to - range.from >= 1000) s.onZoom(range);
    }
  }), [onDateClick, language]);
  const configured = useMemo<EChartsOption>(() => !sync ? option : {
    ...option,
    grid: {
      ...option.grid,
      left: compact ? 45 : 65,
      right: compact ? 40 : 60,
      bottom: 90
    },
    xAxis: {
      ...option.xAxis,
      min: sync.domain.from,
      max: sync.domain.to
    },
    dataZoom: [{
      type: 'slider',
      xAxisIndex: 0,
      filterMode: 'none',
      minValueSpan: Math.min(1000, sync.domain.to - sync.domain.from),
      startValue: sync.range.from,
      endValue: sync.range.to,
      realtime: false,
      bottom: 5,
      height: 23,
      showDetail: false,
      showDataShadow: false,
      brushSelect: false
    }, {
      type: 'inside',
      xAxisIndex: 0,
      filterMode: 'none',
      minValueSpan: Math.min(1000, sync.domain.to - sync.domain.from),
      startValue: sync.range.from,
      endValue: sync.range.to,
      zoomOnMouseWheel: 'ctrl',
      moveOnMouseMove: false,
      moveOnMouseWheel: false,
      preventDefaultMouseMove: false,
      throttle: 200
    }]
  }, [option, sync, compact, language]);
  const themed = useMemo(() => themeChart(configured, theme), [configured, theme, language]);
  return <div className={className} role="img" aria-label={localizeText(title)} style={{
    height
  }}>
    <ReactEChartsCore echarts={echarts} option={themed} opts={opts} style={style} onChartReady={ready} onEvents={events} notMerge autoResize />
  </div>;
}
