import { exportFilename } from './charts/exportFilename';
import { t, text as localizeText, getLocale } from "./i18n/core";
import { useLanguage } from "./i18n/Language";
import { Button } from './components/ui/button';
import { sessionFetch } from './Access';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import './history.css';
import { HistoryChart } from './charts/HistoryChart';
import { useHistoryData } from './charts/useHistoryData';
import { boundedRange, csvAllowed, zoomRange, type TimeRange } from './charts/historyRange';
import { metricNumber, chartNumber, chartTime } from './charts/chartFormat';
import { EfficiencyPanel } from './charts/EfficiencyPanel';
type Event = {
  id: number;
  time: string;
  kind: string;
  key: string;
  message: string;
  source: string;
};
type EventPage = {
  items: Event[];
  nextCursor: number | null;
};
type Storage = {
  state: string;
  lastWriteUtc: string | null;
  sampleSeconds: number;
  retentionDays: number;
};
const technicalKeys = ['pumpSpeed', 'fanSpeed', 'compressorCurrent', 'highPressure'];
const labels: Record<string, string> = {
  pumpSpeed: 'Pumpendrehzahl',
  fanSpeed: 'Ventilatordrehzahl',
  compressorCurrent: 'Verdichterstrom',
  highPressure: 'Hochdruck',
  curveXCold: 'Heizkurve Außen niedrig',
  curveYCold: 'Heizkurve Vorlauf hoch',
  curveXWarm: 'Heizkurve Außen hoch',
  curveYWarm: 'Heizkurve Vorlauf niedrig',
  heatDelta: 'Heiz-ΔT',
  heatingOffTemperature: 'Heizgrenze',
  mainTargetTemperature: 'Vorlauf-Soll (Anlage)',
  zonesState: 'Aktive Zonen',
  flowTemperature: 'Vorlauf',
  returnTemperature: 'Rücklauf',
  outsideTemperature: 'Außen',
  indoorTemperature: 'Innen',
  indoorTargetTemperature: 'Innen-Soll',
  zone1HeatRequest: 'Heizanforderung Zone 1',
  zone1SensorMode: 'Sensormodus Zone 1',
  dhwTemperature: 'Warmwasser',
  dhwHeatDelta: 'Warmwasser-Einschaltdifferenz',
  dhwTargetTemperature: 'Warmwasser-Soll',
  temperatureSpread: 'Spreizung',
  heatpumpState: 'Wärmepumpe',
  operatingMode: 'Betriebsart',
  quietMode: 'Flüstermodus',
  internalHeaterState: 'Heizstab',
  heatingControlMode: 'Heizregelung',
  activeError: 'Fehlerstatus',
  waterFlow: 'Durchfluss',
  compressorFrequency: 'Verdichter',
  defrostState: 'Abtauen',
  threeWayValveState: '3-Wege-Ventil',
  operationsHours: 'Betriebsstunden',
  operationsCounter: 'Betriebszähler',
  waterPressure: 'Wasserdruck',
  heatPowerConsumption: 'Heizen elektrisch',
  coolPowerConsumption: 'Kühlen elektrisch',
  dhwPowerConsumption: 'Warmwasser elektrisch',
  heatPowerProduction: 'Heizen thermisch',
  coolPowerProduction: 'Kühlen thermisch',
  dhwPowerProduction: 'Warmwasser thermisch',
  sterilizationState: 'Sterilisation',
  broker: 'Broker',
  device: 'Gerät',
  recorder: 'Aufzeichnung'
};
const qualities: Record<string, string> = {
  unknown: 'Unbekannt',
  invalid: 'Ungültig',
  stale: 'Veraltet',
  valid: 'Aktuell'
};
const kinds: Record<string, string> = {
  system: 'System',
  connection: 'Verbindung',
  quality: 'Datenqualität',
  error: 'Fehlerstatus',
  state: 'Zustandsänderung'
};
const temperatures = ['flowTemperature', 'returnTemperature', 'outsideTemperature', 'indoorTemperature', 'dhwTemperature', 'dhwTargetTemperature', 'temperatureSpread', 'dhwHeatDelta'];
const time = (value: string) => new Intl.DateTimeFormat(getLocale(), {
  timeZone: 'Europe/Berlin',
  dateStyle: 'short',
  timeStyle: 'short'
}).format(new Date(value));
async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await sessionFetch(url, {
    signal,
    cache: 'no-store'
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.title ?? 'Daten konnten nicht geladen werden.');
  }
  return response.json();
}
export function StorageNotice() {
  const language = useLanguage();
  const [storage, setStorage] = useState<Storage | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stopped = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const next = await json<Storage>('/api/v1/storage', controller.signal);
        if (!stopped) {
          setStorage(next);
          setFailed(false);
        }
      } catch {
        if (!stopped) setFailed(true);
      }
      if (!stopped) timer = setTimeout(() => void refresh(), 5000);
    };
    void refresh();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  if (failed || storage?.state === 'failed') return <p className="warning" role="alert">{t("Aufzeichnung gestört oder nicht erreichbar. Es können Datenlücken entstehen; Livewerte und gespeicherte Daten getrennt prüfen.")}</p>;
  return <p className="storage-note" role="status">{storage?.state === 'ready' ? localizeText('Aufzeichnung aktiv') : localizeText('Aufzeichnung wird gestartet')} · {localizeText(storage?.sampleSeconds) ?? localizeText(30)}{t(" s Raster · ")}{localizeText(storage?.retentionDays) ?? localizeText(700)}{t(" Tage Aufbewahrung")}</p>;
}
type HistoryKind = 'temperature' | 'technical' | 'pressure' | 'power' | 'efficiency' | 'state';
const stateKeys = ['heatpumpState', 'operatingMode', 'quietMode', 'internalHeaterState', 'defrostState', 'threeWayValveState', 'sterilizationState'];
export function HistoryPanel({ compact = false }: { compact?: boolean }) {
  if (compact) return <HistorySection compact />;
  return <div className="independent-history">
    <HistorySection />
    <HistorySection kind="efficiency" />
    <HistorySection kind="technical" />
    <HistorySection kind="pressure" />
    <h2>{t("Beobachtete Betriebszustände")}</h2>
    {stateKeys.map(key => <HistorySection key={key} kind="state" stateKey={key} />)}
    <HistorySection kind="power" />
  </div>;
}
function HistorySection({
  compact = false, kind = 'temperature', stateKey = ''
}: {
  compact?: boolean; kind?: HistoryKind; stateKey?: string;
}) {
  const language = useLanguage();
  const temperature = kind === 'temperature';
  const title = temperature ? 'Temperaturverlauf' : kind === 'technical' ? 'Technische Anlagenwerte' : kind === 'pressure' ? 'Wasserdruckverlauf' : kind === 'power' ? 'Leistungsverlauf' : kind === 'efficiency' ? 'COP-Verlauf' : labels[stateKey];
  const [height, setHeight] = useState(kind === 'state' ? 190 : 640);
  const [hours, setHours] = useState(6);
  const [keys, setKeys] = useState(temperatures.slice(0, 5));
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [custom, setCustom] = useState(false);
  const [range, setRange] = useState<TimeRange>(() => {
    const to = Date.now();
    return {
      from: to - 6 * 3600000,
      to
    };
  });
  const [domain, setDomain] = useState(range);
  const [live, setLive] = useState(true);
  const [band, setBand] = useState(false);
  const [markers, setMarkers] = useState(true);
  const [zoomPending, setZoomPending] = useState(false);
  const editing = useRef(false);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const group = useId();
  const [technicalKey, setTechnicalKey] = useState('pumpSpeed');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const keyString = temperature ? keys.join(',') : kind === 'technical' ? technicalKey : kind === 'pressure' ? 'waterPressure' : kind === 'state' ? stateKey : 'heatPowerConsumption,heatPowerProduction,coolPowerConsumption,coolPowerProduction,dhwPowerConsumption,dhwPowerProduction';
  const {
    bundle,
    loading,
    error: loadError
  } = useHistoryData(range, keyString, compact, refresh, kind);
  const {
    data,
    phases,
    pairs
  } = bundle ?? {};
  const onZoom = useCallback((next: TimeRange) => {
    setLive(false);
    setCustom(true);
    setZoomPending(true);
    clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => {
      setRange(old => old.from === next.from && old.to === next.to ? old : next);
      setZoomPending(false);
    }, 250);
  }, []);
  const sync = useMemo(() => ({
    group,
    domain,
    range,
    onZoom
  }), [group, domain, range, onZoom, language]);
  const choose = (next: TimeRange, manual = true) => {
    clearTimeout(zoomTimer.current);
    setZoomPending(false);
    setRange(next);
    setDomain(next);
    setCustom(manual);
    setError('');
    if (manual) setLive(false);
  };
  const exportDisabled = (selected: string) => !data || loading || zoomPending || !!loadError || exporting || !csvAllowed(range, selected.split(',').length, bundle?.sampleSeconds ?? 30);
  const showBand = band && keys.includes('flowTemperature') && keys.includes('returnTemperature');
  const sterilization = phases?.series.find(s => s.key === 'sterilizationState')?.intervals?.filter(i => i.value === 1) ?? [];
  useEffect(() => {
    if (!editing.current) {
      setFromInput(new Date(range.from).toISOString().slice(0, 19));
      setToInput(new Date(range.to).toISOString().slice(0, 19));
    }
  }, [range]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (live) {
        const to = Date.now();
        const next = {
          from: to - (range.to - range.from),
          to
        };
        setRange(next);
        setDomain(next);
      } else setRefresh(r => r + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, [live, range]);
  useEffect(() => () => clearTimeout(zoomTimer.current), []);
  async function download(selectedKeys = keyString) {
    if (exportDisabled(selectedKeys)) return;
    setExporting(true);
    setError('');
    try {
      const query = new URLSearchParams({
        keys: selectedKeys,
        from: new Date(range.from).toISOString(),
        to: new Date(range.to).toISOString()
      });
      const response = await sessionFetch('/api/v1/export.csv?' + query);
      if (!response.ok) {
        const problem = await response.json();
        throw new Error(problem.title);
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFilename(localizeText(title), 'csv');
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export fehlgeschlagen.');
    } finally {
      setExporting(false);
    }
  }
  return <section className="panel history-panel" aria-label={localizeText(title)} data-history-kind={kind}>
    <h2>{localizeText(title)}</h2>
    <div className="toolbar"><div className="segments" aria-label={t("Verlaufszeitraum")}>{localizeText((compact ? [1, 4, 6, 24, 168] : [1, 4, 6, 24, 168, 720, 8760, 16800]).map(h => <Button key={h} aria-pressed={!custom && hours === h} onClick={() => {
          const to = Date.now();
          setHours(h);
          choose({
            from: to - h * 3600000,
            to
          }, false);
        }}>{h < 48 ? localizeText(h) + localizeText(' h') : localizeText(h / 24) + localizeText(' Tage')}</Button>))}</div><Button onClick={() => setRefresh(r => r + 1)}>{t("Aktualisieren")}</Button></div>
    <form className="toolbar" onSubmit={e => {
      e.preventDefault();
      const next = boundedRange(Date.parse(fromInput + 'Z'), Date.parse(toInput + 'Z'));
      if (next) choose(next);else setError('Bitte einen gültigen Zeitraum bis 700 Tage wählen.');
    }}>
      <label>{t("Von (UTC)")}<input type="datetime-local" step="1" required value={fromInput} onFocus={() => {
          editing.current = true;
        }} onBlur={() => {
          editing.current = false;
        }} onChange={e => setFromInput(e.target.value)} /></label>
      <label>{t("Bis (UTC)")}<input type="datetime-local" step="1" required value={toInput} onFocus={() => {
          editing.current = true;
        }} onBlur={() => {
          editing.current = false;
        }} onChange={e => setToInput(e.target.value)} /></label><Button>{t("Zeitraum anzeigen")}</Button></form>
    <div className="toolbar chart-controls" aria-label={t("Diagrammsteuerung")}>
      <Button onClick={() => onZoom(zoomRange(range, .5, domain))}>{t("Vergrößern")}</Button>
      <Button onClick={() => onZoom(zoomRange(range, 2, domain))}>{t("Verkleinern")}</Button>
      <Button onClick={() => onZoom(domain)}>{t("Zoom zurücksetzen")}</Button>
      <label><input type="checkbox" checked={live} onChange={e => {
          clearTimeout(zoomTimer.current);
          setZoomPending(false);
          setLive(e.target.checked);
          if (e.target.checked) {
            const to = Date.now();
            const next = {
              from: to - (range.to - range.from),
              to
            };
            setRange(next);
            setDomain(next);
          }
        }} />{t("Live folgen")}</label>
      {temperature && <label><input type="checkbox" checked={band} disabled={!keys.includes('flowTemperature') || !keys.includes('returnTemperature')} onChange={e => setBand(e.target.checked)} />{t("Spreizungsband")}</label>}
      {temperature && !compact && <label><input type="checkbox" checked={markers} onChange={e => setMarkers(e.target.checked)} />{t("Sterilisationsmarkierungen")}</label>}
    </div>
    <p className="field-note">{t("Auswahl: ")}{localizeText(chartTime(range.from))} – {localizeText(chartTime(range.to))}{t(" · Zoom auch mit Strg + Mausrad oder den Zeitreglern.")}</p>
    {!compact && temperature && <>
      <fieldset className="metric-choices"><legend>{t("Messwerte")}</legend>{localizeText(temperatures.map(key => <label key={key}><input type="checkbox" checked={keys.includes(key)} disabled={keys.length === 1 && keys[0] === key} onChange={() => setKeys(old => old.includes(key) ? old.filter(k => k !== key) : [...old, key])} />{localizeText(labels[key])}</label>))}</fieldset>
      <Button className="primary" disabled={exportDisabled(keyString)} onClick={() => void download()}>{exporting ? localizeText('Export läuft …') : localizeText('CSV exportieren')}</Button><p className="field-note">{t("Rohdatenexport des angezeigten Zeitraums: maximal 30 Tage und 100.000 Zeilen. Bei größeren Zeiträumen bitte die Auswahl verkleinern. Die Freigabe verwendet vorsichtig die erwarteten Rasterzeilen.")}</p>
    </>}
    {error && <p role="alert" className="warning">{localizeText(error)}</p>}
    {loadError && <p role="alert" className="warning">{localizeText(loadError)}{t(" · Angezeigte Daten stammen gegebenenfalls aus der vorherigen Abfrage.")}</p>}
    {bundle?.analysisWarning && <p role="alert" className="warning">{localizeText(bundle.analysisWarning)}</p>}
    {loading && <p role="status">{t("Verlauf wird geladen … Bisherige Daten bleiben bis zum Abschluss mit bisheriger Auflösung sichtbar.")}</p>}
    {kind === 'technical' && <label>{t("Messwert")}<select value={technicalKey} onChange={e => setTechnicalKey(e.target.value)}>{technicalKeys.map(key => <option key={key} value={key}>{localizeText(labels[key])}</option>)}</select></label>}
    {kind !== 'efficiency' && <label>{t("Diagrammhöhe")}<select value={height} onChange={e => setHeight(Number(e.target.value))}>{(kind === 'state' ? [190, 320, 480] : [320, 480, 640, 960]).map(value => <option key={value} value={value}>{value} px</option>)}</select></label>}
    {data && kind !== 'efficiency' && <HistoryChart sync={sync} height={height} pairs={temperature && showBand ? pairs : null} events={temperature && markers ? phases : null} labels={labels} data={data} title={localizeText(title)} temperatureAxis={temperature} pressureAxis={kind === 'pressure'} />}
    {kind === 'technical' && <p className="field-note">{t("Hochdruck in kgf/cm²; keine Umrechnung in bar.")}</p>}
    {kind === 'power' && <p className="field-note">{t("Leistungswerte stammen ausschließlich aus den zusätzlichen HeishaMon-Daten (extra). Ohne gültige Nachrichten bleiben sie unbekannt; fehlende Daten beweisen keine fehlende Unterstützung. Kein Rückgriff auf Legacy-Leistungswerte. Die separate COP-Auswertung prüft zusätzlich Paarung und Betriebszustand.")}</p>}
    {!temperature && kind !== 'efficiency' && <Button disabled={exportDisabled(keyString)} onClick={() => void download()}>{t("CSV exportieren")}</Button>}
    {showBand && pairs && <><p className="field-note">{t("Spreizungsband: gleiche Rasterplätze, Empfangsabstand höchstens ")}{localizeText(pairs.maxPairSeconds)}{t(" s. Nur vollständige Paarintervalle; keine gehaltenen Ersatzwerte.")}</p><details><summary>{t("Wertepaare und Abdeckung (letzte 20 Intervalle)")}</summary><div className="history-table-wrap"><table><thead><tr><th>{t("Zeit · Berlin")}</th><th>{t("Vorlauf / Rücklauf")}</th><th>{t("Spreizung")}</th><th>{t("Gültige / erwartete Paare")}</th></tr></thead><tbody>{localizeText(pairs.points.slice(-20).map(p => <tr key={p.time}><td>{localizeText(chartTime(p.time))}</td><td>{p.flow === null || p.return === null ? localizeText('—') : localizeText(`${metricNumber(p.flow, 'flowTemperature')} / ${metricNumber(p.return, 'returnTemperature')} °C`)}</td><td>{p.spread === null ? localizeText('—') : localizeText(`${metricNumber(p.spread, 'temperatureSpread')} K`)}</td><td>{localizeText(p.validPairs)} / {localizeText(p.expectedPairs)}</td></tr>))}</tbody></table></div></details></>}
    {temperature && !compact && markers && <section aria-label={t("Sterilisationsereignisse")}><h3>{t("Beobachteter Sterilisationsstatus")}</h3><p className="field-note">{t("TOP69-Aktivstatus; kein Nachweis eines abgeschlossenen Sterilisationslaufs. Markierungen zeigen beobachtete Wechsel, Flächen bekannte Aktivintervalle.")}</p>{!sterilization.length ? <p>{phases?.resolution === 'bucketed' ? localizeText('Sterilisationswechsel bei dieser Auflösung nicht auswertbar. Zeitraum verkleinern.') : localizeText('Kein gültiges Aktivintervall im Zeitraum aufgezeichnet.')}</p> : <ul>{localizeText(sterilization.map(i => <li key={i.from}>{localizeText(chartTime(i.from))} – {localizeText(chartTime(i.to))} · {i.startObserved ? localizeText('Aktivwechsel beobachtet') : localizeText('Beginn unbekannt oder außerhalb der Auswahl')} · {i.endObserved ? localizeText('Inaktivwechsel beobachtet') : localizeText('Ende unbekannt oder außerhalb der Auswahl')}</li>))}</ul>}</section>}
    {kind === 'efficiency' && <EfficiencyPanel sync={sync} sampleSeconds={bundle?.sampleSeconds ?? 30} refresh={refresh} onSelect={next => choose(next)} />}
  </section>;
}
export function EventsPanel({
  compact = false,
  initialKind = ''
}: {
  compact?: boolean;
  initialKind?: string;
}) {
  const language = useLanguage();
  const [kind, setKind] = useState(initialKind);
  const [page, setPage] = useState<EventPage | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failed = false;
    setBusy(true);
    setError('');
    const query = new URLSearchParams();
    if (kind) query.set('kind', kind);
    if (cursor) query.set('cursor', String(cursor));
    void json<EventPage>('/api/v1/events?' + query, controller.signal).then(next => {
      if (!controller.signal.aborted) setPage(old => ({
        ...next,
        items: cursor && old ? [...old.items, ...next.items] : next.items
      }));
    }).catch(e => {
      failed = true;
      if (!controller.signal.aborted) setError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) {
        setBusy(false);
        if (!cursor || failed) timer = setTimeout(() => setRefresh(r => r + 1), failed ? 3000 : 30000);
      }
    });
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [kind, cursor, refresh]);
  return <section className="panel" aria-label={t("Gespeicherte Ereignisse")}><h2>{compact ? localizeText('Letzte Ereignisse') : localizeText('Ereignisse')}</h2>
    {!compact && <div className="toolbar"><label>{t("Art")}<select aria-label={t("Ereignisart")} value={kind} onChange={e => {
          setKind(e.target.value);
          setCursor(null);
          setPage(null);
        }}><option value="">{t("Alle")}</option>{localizeText(Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{localizeText(label)}</option>))}</select></label><Button onClick={() => {
        setCursor(null);
        setRefresh(r => r + 1);
      }}>{t("Aktualisieren")}</Button></div>}
    {error && <p className="warning" role="alert">{localizeText(error)}</p>}
    {busy && <p role="status">{t("Ereignisse werden geladen …")}</p>}
    {!busy && !page?.items.length && !error && <p>{t("Noch keine gespeicherten Ereignisse.")}</p>}
    <ol className="event-list">{(compact ? page?.items.slice(0, 5) : page?.items)?.map(e => <li key={e.id}><time dateTime={e.time}>{localizeText(time(e.time))}</time><div><strong>{localizeText(kinds[e.kind])} · {localizeText(labels[e.key]) ?? localizeText(e.key)}</strong><p className={e.key === 'activeError' && (e.message === 'Fehlerstatus: Fehlerfrei' || e.message === 'Datenqualität: Valid · Wert: Fehlerfrei') ? 'error-free' : undefined}>{language !== 'de' && <small className="original-message-label">{t('Originalmeldung (Deutsch)')}</small>}<span lang="de">{e.message.replace(/Unknown|Valid|Stale|Invalid/g, value => ({
              Unknown: 'Unbekannt',
              Valid: 'Aktuell',
              Stale: 'Veraltet',
              Invalid: 'Ungültig'
            })[value]!)}</span> <small>· {e.source === 'simulator' ? localizeText('Simulation') : localizeText('MQTT')}</small></p></div></li>)}</ol>
    {!compact && page?.nextCursor && <Button disabled={busy} onClick={() => setCursor(page.nextCursor)}>{t("Ältere Ereignisse laden")}</Button>}
  </section>;
}
