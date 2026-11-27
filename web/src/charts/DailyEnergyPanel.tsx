import { downloadCsv } from './csvExport';
import { t, text as localizeText } from "../i18n/core";
import { useLanguage } from "../i18n/Language";
import { Button } from '../components/ui/button';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sessionFetch } from '../Access';
import { ChartFrame } from './ChartFrame';
import { chartNumber } from './chartFormat';
import { energyOptions, energySourceLabel, dayStatus, type EnergyResult } from './efficiencyOptions';
import type { TimeRange } from './historyRange';
import { energyCsv } from './energyCsv';
import type { EnergyCalendarMode } from './energyCalendarModes';
async function get<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await sessionFetch(url, {
    signal,
    cache: 'no-store'
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).title ?? 'Auswertung nicht verfügbar.');
  return response.json();
}
export function DailyEnergyPanel({ onSelect }: { onSelect: (range: TimeRange) => void }) {
  const language = useLanguage();
  const currentYear = Number(new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Berlin',
    year: 'numeric'
  }).format(new Date()));
  const [year, setYear] = useState(currentYear);
  const [calendarHeight, setCalendarHeight] = useState(1760);
  const [calendarMode, setCalendarMode] = useState<EnergyCalendarMode>('consumption');
  const [energy, setEnergy] = useState<EnergyResult | null>(null);
  const [energyError, setEnergyError] = useState('');
  const [energyLoading, setEnergyLoading] = useState(false);
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  useEffect(() => {
    const refreshCalendar = () => setCalendarRefresh(x => x + 1);
    const timer = setInterval(refreshCalendar, 60000);
    globalThis.addEventListener('cockpit-power-changed', refreshCalendar);
    return () => { clearInterval(timer); globalThis.removeEventListener('cockpit-power-changed', refreshCalendar); };
  }, []);
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
    downloadCsv(t('Tagesverbrauch') + ' ' + year, energyCsv(energy));
  };
  const energyOption = useMemo(() => energy ? energyOptions(energy, calendarMode) : {}, [energy, language, calendarMode]);
  const selectDay = useCallback((date: string) => {
    const day = energy?.days.find(d => d.date === date);
    if (day && day.status !== 'future') {
      onSelect({
        from: Date.parse(day.from),
        to: Date.parse(day.to)
      });
    }
  }, [energy, onSelect]);
  return <section className="panel history-panel" aria-label={t("Tagesverbrauch")}><h2 className="history-subheading">{t("Tagesverbrauch · ")}{t('erfasste elektrische Energie')}</h2>
    <Button onClick={() => setCalendarRefresh(x => x + 1)}>{t("Kalender aktualisieren")}</Button>
    <Button disabled={!energy || energy.year !== year || energyLoading || !!energyError} onClick={downloadEnergy}>{t("CSV exportieren")}</Button>
    <p className="field-note">{t("CSV: ausgewähltes Kalenderjahr mit Tagesverbrauch und tiefster gemessener Außentemperatur (°C). Fehlende Werte bleiben leer; Temperaturminimum nur aus vorhandenen gültigen Messungen, keine vollständige Tagesabdeckung zugesichert.")}</p>
    <label>{t("Kalenderhöhe")}<select value={calendarHeight} onChange={e => setCalendarHeight(Number(e.target.value))}>{[880, 1320, 1760].map(n => <option key={n} value={n}>{n} px</option>)}</select></label>
    <label>{t("Kalenderjahr")}<select value={year} onChange={e => setYear(Number(e.target.value))}>{localizeText(Array.from({
          length: currentYear - 1970
        }, (_, i) => currentYear - i).map(y => <option key={y}>{localizeText(y)}</option>))}</select></label>
    <p className="field-note">{energy?.electricalSource === 'shelly-ac'
      ? t('Aus Leistung berechnete Energie: C = Wärmepumpe mit Innengerät und Umwälzpumpe, A = Heizstab, B bleibt unberücksichtigt. Auch Verbrauch unter 50 W wird erfasst. Messlücken über 20 s werden nicht überbrückt; keine Hochrechnung und kein Energiezählerstand.')
      : energy?.electricalSource && energy.electricalSource !== 'heishamon-extra'
        ? t('Integration der aufgezeichneten elektrischen Quelle. Alternative Leistungsdaten summieren Wärmepumpe und Heizstab. Messlücken und Quellenwechsel werden nicht überbrückt; keine Hochrechnung und kein Energiezählerstand.')
        : t('Integration elektrischer Extra-Leistung, kein geeichter Gesamtverbrauch. Keine Hochrechnung und keine Addition gleichzeitig positiver Betriebsbereiche. Pumpen und externe Verbraucher sind nicht als vollständig erfasst nachgewiesen.')}</p>
    {energyLoading && <p role="status">{t("Tagesenergie wird geladen …")}</p>}{energyError && <p className="warning" role="alert">{localizeText(energyError)}</p>}
    {energy && <><p>{energy.source === 'simulator' ? localizeText('Simulation') : localizeText('MQTT')}{t(' · Quelle: ')}{energySourceLabel(energy.electricalSource)}{t(" · Tage in Europe/Berlin · Abgeschlossene Tage ab {0} h Abdeckung gelten als vollständig.", [energy.dailyCompletenessHours ?? 20])}</p>
      <p className="field-note">{t("! Unvollständig · … Laufender Tag · – Keine Daten · Leeres graues Feld: zukünftig. Farbskala: 0 bis zum größten eingefärbten Tageswert dieses Jahres. Tag anklicken oder in der Tabelle wählen, um den Verlauf zu öffnen.")}</p>
      <label>{t('Kachelfarben')}<select value={calendarMode} onChange={e => setCalendarMode(e.target.value as EnergyCalendarMode)}>
        <option value="consumption">{t('Verbrauch')}</option>
        <option value="temperature">{t('Durchschnittstemperatur')}</option>
        <option value="split">{t('Beides · oben Verbrauch, unten Temperatur')}</option>
      </select></label>
      <p className="field-note">{t('Tagesmittel aus gültigen aufgezeichneten Außentemperaturen. Fehlende Messungen werden nicht ergänzt.')}</p>
      <div className="energy-calendar-scroll" tabIndex={0} role="region" aria-label={t('Verbrauchskalender')}>
        <ChartFrame option={energyOption} height={calendarHeight} className="energy-calendar" title={localizeText(`Verbrauchskalender ${year}. Unvollständige Tage getrennt gekennzeichnet. Tastaturauswahl in der Tagestabelle.`)} onDateClick={selectDay} />
      </div>
      <details><summary>{t("Tagestabelle und Tagesauswahl")}</summary><div className="history-table-wrap"><table><thead><tr><th>{t("Tag")}</th><th>{t("Erfasst")}</th><th>{t("Tiefste Außentemperatur · °C")}</th><th>Ø {t("Außentemperatur")} · °C</th><th>{t("Abdeckung")}</th><th>{t("Status")}</th></tr></thead><tbody>{localizeText(energy.days.map(d => <tr key={d.date}><td><Button disabled={d.status === 'future'} onClick={() => selectDay(d.date)}>{localizeText(d.date)}</Button></td><td>{d.kwh === null ? localizeText('—') : localizeText(chartNumber(d.kwh)) + localizeText(' kWh')}</td><td>{d.minOutdoorTemperatureC == null ? localizeText('—') : localizeText(chartNumber(d.minOutdoorTemperatureC))}</td><td>{d.averageOutdoorTemperatureC == null ? localizeText("—") : localizeText(chartNumber(d.averageOutdoorTemperatureC))}</td><td>{localizeText(chartNumber(d.validSeconds / 3600))} / {localizeText(chartNumber(d.expectedSeconds / 3600))}{t(" h")}</td><td>{localizeText(dayStatus[d.status])}</td></tr>))}</tbody></table></div></details>
    </>}
    </section>;
}
