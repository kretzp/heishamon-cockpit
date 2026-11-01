import { exportFilename } from './exportFilename';
import { t, text as localizeText, getLocale } from "../i18n/core";
import { useLanguage } from "../i18n/Language";
import { Button } from '../components/ui/button';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sessionFetch } from '../Access';
import { ChartFrame, type ChartSync } from './ChartFrame';
import { chartNumber, chartTime } from './chartFormat';
import { copOptions, energyOptions, dayStatus, type CopResult, type EnergyResult } from './efficiencyOptions';
import type { TimeRange } from './historyRange';
import { energyCsv } from './energyCsv';
import { TrendToggle } from './TrendToggle';
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
  refresh,
  onSelect
}: {
  sync: ChartSync;
  sampleSeconds: number;
  refresh: number;
  onSelect: (range: TimeRange) => void;
}) {
  const language = useLanguage();
  const currentYear = Number(new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Berlin',
    year: 'numeric'
  }).format(new Date()));
  const [year, setYear] = useState(currentYear);
  const [window, setWindow] = useState(15);
  const [height, setHeight] = useState(640);
  const [calendarHeight, setCalendarHeight] = useState(1760);
  const [trend, setTrend] = useState(true);
  const [cop, setCop] = useState<CopResult | null>(null);
  const [energy, setEnergy] = useState<EnergyResult | null>(null);
  const [copError, setCopError] = useState('');
  const [energyError, setEnergyError] = useState('');
  const [copLoading, setCopLoading] = useState(false);
  const [energyLoading, setEnergyLoading] = useState(false);
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const {
    from,
    to
  } = sync.range;
  useEffect(() => {
    const timer = setInterval(() => setCalendarRefresh(x => x + 1), 60000);
    return () => clearInterval(timer);
  }, []);
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
  useEffect(() => {
    const controller = new AbortController();
    setEnergy(null);
    setEnergyError('');
    setEnergyLoading(true);
    void get<EnergyResult>('/api/v1/history/energy?year=' + year, controller.signal).then(value => {
      if (!controller.signal.aborted) setEnergy(value);
    }).catch(e => {
      if (!controller.signal.aborted) setEnergyError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setEnergyLoading(false);
    });
    return () => controller.abort();
  }, [year, calendarRefresh]);
  const downloadEnergy = () => {
    if (!energy || energy.year !== year || energyLoading || energyError) return;
    const url = URL.createObjectURL(new Blob([energyCsv(energy)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename(t('Tagesverbrauch') + ' ' + year, 'csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copOption = useMemo(() => cop ? copOptions(cop, trend) : {}, [cop, language, trend]);
  const energyOption = useMemo(() => energy ? energyOptions(energy) : {}, [energy, language]);
  const selectDay = useCallback((date: string) => {
    const day = energy?.days.find(d => d.date === date);
    if (day && day.status !== 'future') {
      onSelect({
        from: Date.parse(day.from),
        to: Date.parse(day.to)
      });
    }
  }, [energy, onSelect]);
  return <section aria-label={t("Effizienz und Tagesenergie")}>
    <h2 className="history-subheading">{t("COP · Heizen und Warmwasser")}</h2>
    <label>{t("Diagrammhöhe")}<select value={height} onChange={e => setHeight(Number(e.target.value))}>{[320, 480, 640, 960].map(n => <option key={n} value={n}>{n} px</option>)}</select></label>
    <label>{t("Gleitender Mittelwert")}<select value={window} onChange={e => setWindow(Number(e.target.value))}>{localizeText([5, 15, 30].map(n => <option key={n} value={n}>{localizeText(n)}{t(" Minuten")}</option>))}</select></label>
    <p className="field-note">{t("COP = thermische Extra-Leistung / ")}{localizeText('elektrische Extra-Leistung')}{t(". Blau: Heizen; Violett: Warmwasser. Gestrichelt: Rastermittel des COP; durchgezogen: nachlaufender zeitgewichteter Mittelwert. Lücken, Abtauung, Heizstab und Betriebswechsel unterbrechen die Glättung. Kühlen ist kein Heiz-COP.")}</p>
    {copLoading && <p role="status">{t("COP wird geladen …")}</p>}{copError && <p className="warning" role="alert">{localizeText(copError)}</p>}
    {cop && <>
      <p>{cop.source === 'simulator' ? localizeText('Simulation · synthetische Messgrenze') : localizeText('MQTT · Extra-Leistungswerte')}{t(" · Mindestleistung ")}{localizeText(cop.minimumElectricalWatts)}{t(" W · Empfangsabstand ≤ ")}{localizeText(cop.maxPairSeconds)}{t(" s")}</p>
        <TrendToggle checked={trend} onChange={setTrend} />
        <ChartFrame sync={sync} option={copOption} height={height} title={t("COP und gleitender Mittelwert; Heizen blau, Warmwasser violett. Werte auch in Tabelle.")} />
        {!cop.points.some(p => p.cop !== null) && <p>{t("Keine ausreichend gültigen Leistungsintervalle für COP.")}</p>}
      <p className="field-note">{t("Gültige Dauer: ")}{localizeText(chartNumber(cop.validSeconds / 3600))} / {localizeText(chartNumber(cop.expectedSeconds / 3600))}{t(" h. Energieverhältnis dieser Intervalle: ")}{cop.energyRatio === null ? localizeText('unbekannt') : localizeText(chartNumber(cop.energyRatio))}{t(". Kein Mittelwert der COP-Linie und keine Jahresarbeitszahl.")}</p>
      <details><summary>{t("COP-Wertetabelle (letzte 20 Intervalle)")}</summary><div className="history-table-wrap"><table><thead><tr><th>{t("Zeit · Berlin")}</th><th>{t("Bereich")}</th><th>{t("COP")}</th><th>{t("Mittelwert")}</th><th>{t("Gültig / erwartet")}</th></tr></thead><tbody>{localizeText(cop.points.slice(-20).map(p => <tr key={p.time}><td>{localizeText(chartTime(p.time))}</td><td>{p.mode === 'heat' ? localizeText('Heizen') : p.mode === 'dhw' ? localizeText('Warmwasser') : localizeText('Unbekannt')}</td><td>{p.cop === null ? localizeText('—') : localizeText(chartNumber(p.cop))}</td><td>{p.average === null ? localizeText('—') : localizeText(chartNumber(p.average))}</td><td>{localizeText(chartNumber(p.validSeconds))} / {localizeText(chartNumber(p.expectedSeconds))}{t(" s")}</td></tr>))}</tbody></table></div></details>
    </>}
    <section aria-label={t("Tagesverbrauch")}><h2 className="history-subheading">{t("Tagesverbrauch · ")}{localizeText('erfasste Extra-Energie')}</h2>
    <Button onClick={() => setCalendarRefresh(x => x + 1)}>{t("Kalender aktualisieren")}</Button>
    <Button disabled={!energy || energy.year !== year || energyLoading || !!energyError} onClick={downloadEnergy}>{t("CSV exportieren")}</Button>
    <p className="field-note">{t("CSV: ausgewähltes Kalenderjahr mit Tagesverbrauch und tiefster gemessener Außentemperatur (°C). Fehlende Werte bleiben leer; Temperaturminimum nur aus vorhandenen gültigen Messungen, keine vollständige Tagesabdeckung zugesichert.")}</p>
    <label>{t("Kalenderhöhe")}<select value={calendarHeight} onChange={e => setCalendarHeight(Number(e.target.value))}>{[880, 1320, 1760].map(n => <option key={n} value={n}>{n} px</option>)}</select></label>
    <label>{t("Kalenderjahr")}<select value={year} onChange={e => setYear(Number(e.target.value))}>{localizeText(Array.from({
          length: currentYear - 1970
        }, (_, i) => currentYear - i).map(y => <option key={y}>{localizeText(y)}</option>))}</select></label>
    <p className="field-note">{localizeText('Integration elektrischer Extra-Leistung, kein geeichter Gesamtverbrauch. Keine Hochrechnung und keine Addition gleichzeitig positiver Betriebsbereiche. Pumpen und externe Verbraucher sind nicht als vollständig erfasst nachgewiesen.')}</p>
    {energyLoading && <p role="status">{t("Tagesenergie wird geladen …")}</p>}{energyError && <p className="warning" role="alert">{localizeText(energyError)}</p>}
    {energy && <><p>{energy.source === 'simulator' ? localizeText('Simulation') : localizeText('MQTT')}{t(" · Tage in Europe/Berlin · Vollständige und unvollständige Tage ab 20 h Abdeckung erhalten die blaue Verbrauchsfarbe.")}</p>
      <p className="field-note">{t("! Unvollständig · … Laufender Tag · – Keine Daten · Leeres graues Feld: zukünftig. Farbskala: 0 bis zum größten eingefärbten Tageswert dieses Jahres. Tag anklicken oder in der Tabelle wählen, um den Verlauf zu öffnen.")}</p>
      <ChartFrame option={energyOption} height={calendarHeight} className="energy-calendar" title={localizeText(`Verbrauchskalender ${year}. Unvollständige Tage getrennt gekennzeichnet. Tastaturauswahl in der Tagestabelle.`)} onDateClick={selectDay} />
      <details><summary>{t("Tagestabelle und Tagesauswahl")}</summary><div className="history-table-wrap"><table><thead><tr><th>{t("Tag")}</th><th>{t("Erfasst")}</th><th>{t("Tiefste Außentemperatur · °C")}</th><th>{t("Abdeckung")}</th><th>{t("Status")}</th></tr></thead><tbody>{localizeText(energy.days.map(d => <tr key={d.date}><td><Button disabled={d.status === 'future'} onClick={() => selectDay(d.date)}>{localizeText(d.date)}</Button></td><td>{d.kwh === null ? localizeText('—') : localizeText(chartNumber(d.kwh)) + localizeText(' kWh')}</td><td>{d.minOutdoorTemperatureC == null ? localizeText('—') : localizeText(chartNumber(d.minOutdoorTemperatureC))}</td><td>{localizeText(chartNumber(d.validSeconds / 3600))} / {localizeText(chartNumber(d.expectedSeconds / 3600))}{t(" h")}</td><td>{localizeText(dayStatus[d.status])}</td></tr>))}</tbody></table></div></details>
    </>}
    </section>
  </section>;
}
