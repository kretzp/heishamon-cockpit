import { t, text as localizeText } from "../i18n/core";
import { useLanguage } from "../i18n/Language";
import { Button } from '../components/ui/button';
import { useEffect, useMemo, useState } from 'react';
import { sessionFetch } from '../Access';
import { ChartFrame, type ChartSync } from './ChartFrame';
import { chartNumber, chartTime } from './chartFormat';
import { copOptions, copDisplayPoints, type CopResult } from './efficiencyOptions';
import { TrendToggle } from './TrendToggle';
import { useTrendPreference } from './useChartPreferences';
import { copCsv } from './copCsv';
import { downloadCsv } from './csvExport';
async function get<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await sessionFetch(url, {
    signal,
    cache: 'no-store'
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).title ?? 'Auswertung nicht verfügbar.');
  return response.json();
}
export function EfficiencyPanel({
  sync,
  sampleSeconds,
  refresh
}: {
  sync: ChartSync;
  sampleSeconds: number;
  refresh: number;
}) {
  const language = useLanguage();
  const [window, setWindow] = useState(15);
  const [height, setHeight] = useState(640);
  const [trend, setTrend, trendNotice] = useTrendPreference('efficiency');
  const [cop, setCop] = useState<CopResult | null>(null);
  const [copError, setCopError] = useState('');
  const [copLoading, setCopLoading] = useState(false);
  const {
    from,
    to
  } = sync.range;
  useEffect(() => {
    const controller = new AbortController();
    setCop(null);
    setCopError('');
    if (to - from > 31 * 86400000) {
      setCopError('Für COP bitte auf höchstens 31 Tage zoomen.');
      setCopLoading(false);
      return;
    }
    setCopLoading(true);
    const bucket = Math.max(sampleSeconds, Math.ceil((to - from) / 800000 / sampleSeconds) * sampleSeconds);
    const query = new URLSearchParams({
      keys: 'heatPowerConsumption',
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      bucketSeconds: String(bucket),
      windowMinutes: String(window)
    });
    void get<CopResult>('/api/v1/history/cop?' + query, controller.signal).then(value => {
      if (!controller.signal.aborted) setCop(value);
    }).catch(e => {
      if (!controller.signal.aborted) setCopError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setCopLoading(false);
    });
    return () => controller.abort();
  }, [from, to, window, sampleSeconds, refresh]);
  const copOption = useMemo(() => cop ? copOptions(cop, trend) : {}, [cop, language, trend]);
  return <section aria-label={t("COP · Heizen und Warmwasser")}>
    <h2 className="history-subheading">{t("COP · Heizen und Warmwasser")}</h2>
    <label className="chart-height-control">{t("Diagrammhöhe")}<select value={height} onChange={e => setHeight(Number(e.target.value))}>{[320, 480, 640, 960].map(n => <option key={n} value={n}>{n} px</option>)}</select></label>
    <label>{t("Gleitender Mittelwert")}<select value={window} onChange={e => setWindow(Number(e.target.value))}>{localizeText([5, 15, 30].map(n => <option key={n} value={n}>{localizeText(n)}{t(" Minuten")}</option>))}</select></label>
    <p className="field-note">{t("COP = thermische Extra-Leistung / ")}{localizeText(cop?.electricalSource === 'alternative-mqtt' ? 'alternative elektrische Gesamtleistung' : cop?.electricalSource === 'mixed' ? 'elektrische Leistung der jeweils aufgezeichneten Quelle' : 'elektrische Extra-Leistung')}{t(". Blau: Heizen; Violett: Warmwasser. Gestrichelt: Rastermittel des COP; durchgezogen: nachlaufender zeitgewichteter Mittelwert. Lücken, Abtauung, Heizstab und Betriebswechsel unterbrechen die Glättung. Kühlen ist kein Heiz-COP.")}</p>
    <Button disabled={!cop || copLoading || !!copError} onClick={() => { if (cop) downloadCsv(t('COP-Verlauf'), copCsv(cop)); }}>{t('CSV exportieren')}</Button>
    {copLoading && <p role="status">{t("COP wird geladen …")}</p>}{copError && <p className="warning" role="alert">{localizeText(copError)}</p>}
    {cop && <>
      <p>{cop.source === 'simulator' ? localizeText('Simulation · synthetische Messgrenze') : localizeText('MQTT')}{t(" · Quelle: ")}{t(cop.electricalSource === 'alternative-mqtt' ? 'Alternative Leistungsdaten' : cop.electricalSource === 'mixed' ? 'Gemischte Quellen im Zeitraum' : 'HeishaMon-Extra')}{t(" · Mindestleistung ")}{localizeText(cop.minimumElectricalWatts)}{t(" W · Empfangsabstand ≤ ")}{localizeText(cop.maxPairSeconds)}{t(" s")}</p>
        <TrendToggle checked={trend} onChange={setTrend} />
        {trendNotice && <p role="status">{localizeText(trendNotice)}</p>}
        <ChartFrame sync={sync} option={copOption} height={height} title={t("COP und gleitender Mittelwert; Heizen blau, Warmwasser violett. Werte auch in Tabelle.")} />
        {!copDisplayPoints(cop).some(p => p.cop !== null) && <p>{t("Keine ausreichend gültigen Leistungsintervalle für COP.")}</p>}
      <p className="field-note">{t("Gültige Dauer: ")}{localizeText(chartNumber(cop.validSeconds / 3600))} / {localizeText(chartNumber(cop.expectedSeconds / 3600))}{t(" h. Energieverhältnis dieser Intervalle: ")}{cop.energyRatio === null ? localizeText('unbekannt') : localizeText(chartNumber(cop.energyRatio))}{t(". Kein Mittelwert der COP-Linie und keine Jahresarbeitszahl.")}</p>
      <details><summary>{t("COP-Wertetabelle (letzte 20 Intervalle)")}</summary><div className="history-table-wrap"><table><thead><tr><th>{t("Zeit · Berlin")}</th><th>{t("Bereich")}</th><th>{t("COP")}</th><th>{t("Mittelwert")}</th><th>{t("Gültig / erwartet")}</th></tr></thead><tbody>{localizeText(copDisplayPoints(cop).slice(-20).map(p => <tr key={p.time + p.mode}><td>{localizeText(chartTime(p.time))}</td><td>{p.mode === 'heat' ? localizeText('Heizen') : p.mode === 'dhw' ? localizeText('Warmwasser') : localizeText('Unbekannt')}</td><td>{p.cop === null ? localizeText('—') : localizeText(chartNumber(p.cop))}</td><td>{p.average === null ? localizeText('—') : localizeText(chartNumber(p.average))}</td><td>{localizeText(chartNumber(p.validSeconds))} / {localizeText(chartNumber(p.expectedSeconds))}{t(" s")}</td></tr>))}</tbody></table></div></details>
    </>}
  </section>;
}
