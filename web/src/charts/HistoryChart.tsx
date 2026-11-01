import { t, text as localizeText, getLocale } from "../i18n/core";
import { useLanguage } from "../i18n/Language";
import { useMemo, useState } from 'react';
import { TrendToggle } from './TrendToggle';
import { ChartFrame, type ChartSync } from './ChartFrame';
import { metricNumber, chartNumber, chartTime, metricColor, stateColor } from './chartFormat';
import { lineOptions, stateIntervals, stateOptions, validPoint, type History, type PairResult } from './historyOptions';
import { addAnalysis } from './analysisOptions';
const qualities: Record<string, string> = {
  unknown: 'Unbekannt',
  invalid: 'Ungültig',
  stale: 'Veraltet',
  valid: 'Aktuell'
};
export function HistoryChart({
  data,
  title,
  labels,
  temperatureAxis = false,
  pressureAxis = false,
  height = 640,
  sync,
  pairs,
  events
}: {
  data: History;
  title: string;
  labels: Record<string, string>;
  temperatureAxis?: boolean;
  pressureAxis?: boolean;
  height?: number;
  sync?: ChartSync;
  pairs?: PairResult | null;
  events?: History | null;
}) {
  const language = useLanguage();
  const [trend, setTrend] = useState(true);
  const option = useMemo(() => {
    const base = lineOptions(data, labels, temperatureAxis, pressureAxis, trend);
    return temperatureAxis ? addAnalysis(base, data, pairs, events) : base;
  }, [data, labels, temperatureAxis, pressureAxis, pairs, events, language, trend]);
  const states = data.series.length > 0 && data.series.every(s => s.aggregation === 'stableState' || s.aggregation === 'observedIntervals');
  return <>
    {!states && <TrendToggle checked={trend} onChange={setTrend} />}
    {data.resolution === 'bucketed' && <p className="warning">{t("Zustände verdichtet: Wechsel innerhalb eines Rasters bleiben unbekannt. Für mehr Details Zeitraum verkleinern.")}</p>}
    {states ? localizeText(data.series.map(s => {
      const intervals = stateIntervals(data, s);
      return <section className="state-timeline" key={s.key} aria-label={localizeText(labels[s.key])}>
        <h3>{localizeText(labels[s.key])}</h3>
        <p className="field-note">{s.source === 'simulator' ? localizeText('Simulation') : localizeText('MQTT')}{t(" · Raster ")}{localizeText(data.bucketSeconds)}{t(" s · Nur gültige Zustandsintervalle")}</p>
        {intervals.length ? <ChartFrame sync={sync} option={stateOptions(data, s)} height={sync ? height : 135} title={localizeText(`${labels[s.key]} – Zeit von links nach rechts. Datenlücken bleiben leer.`)} /> : <p>{t("Keine gültigen Zustandsintervalle")}</p>}
        <ul className="chart-legend">{localizeText([...new Set(intervals.map(i => i.value))].sort((a, b) => a - b).map(value => <li key={value}><span className="state-color" style={{
              background: stateColor(value)
            }} />{localizeText(intervals.find(i => i.value === value)!.label)}</li>))}</ul>
        <details><summary>{t("Zustandsintervalle · ")}{localizeText(labels[s.key])}</summary><div className="history-table-wrap"><table>
          <thead><tr><th>{t("Von · Berlin")}</th><th>{t("Bis · Berlin")}</th><th>{t("Zustand")}</th><th>{t("Dauer")}</th></tr></thead>
          <tbody>{localizeText(intervals.map(i => <tr key={i.start}><td>{localizeText(chartTime(i.start))}</td><td>{localizeText(chartTime(i.end))}</td><td>{localizeText(i.label)}</td><td>{localizeText(chartNumber((i.end - i.start) / 1000))}{t(" s")}</td></tr>))}</tbody>
        </table></div></details>
      </section>;
    })) : data.series.some(s => s.points.some(validPoint)) ? <ChartFrame sync={sync} option={option} height={height} title={localizeText(title) + localizeText('. Lücken werden nicht verbunden. Werte auch in der Tabelle.')} /> : <div className="empty-chart"><strong>{t("Noch keine gültigen Verlaufswerte")}</strong><p>{t("Die Aufzeichnung beginnt mit diesem Release. Datenlücken werden nicht aufgefüllt.")}</p></div>}
    <ul className="chart-legend">{localizeText(data.series.map(s => <li key={s.key}><span className="legend-color" style={{
          background: metricColor(s.key)
        }} />{localizeText(labels[s.key])} ({localizeText(s.unit)}) · {s.source === 'simulator' ? localizeText('Simulation') : localizeText('MQTT')}</li>))}</ul>
    <p className="field-note">{t("Zeiten: Europe/Berlin · Raster ")}{localizeText(data.bucketSeconds)}{t(" s · Mittelwerte nur aus vollständig gültigen Intervallen; Zustände nur bei unverändertem Wert. Lücken bleiben leer.")}</p>
    <details><summary>{t("Wertetabelle (letzte 20 Intervalle je Reihe)")}</summary><div className="history-table-wrap"><table><thead><tr><th>{t("Zeit · Berlin")}</th><th>{t("Messwert")}</th><th>{t("Wert")}</th><th>{t("Qualität")}</th></tr></thead><tbody>{localizeText(data.series.flatMap(s => s.points.slice(-20).map(p => <tr key={s.key + p.time}><td>{localizeText(chartTime(p.time))}</td><td>{localizeText(labels[s.key])}</td><td>{!validPoint(p) ? localizeText('—') : localizeText(metricNumber(p.value!, s.key, pressureAxis)) + localizeText(' ') + localizeText(s.unit)}</td><td>{localizeText(qualities[p.quality])}</td></tr>)))}</tbody></table></div></details>
  </>;
}
