import { metricNumber, twoDecimalMetrics } from './charts/chartFormat';
import { t, text as localizeText, getLocale } from "./i18n/core";
import { readLanguage, setLanguage } from "./i18n/core";
import { LanguagePicker } from "./i18n/Language";
import { Brand } from './Brand';
import { useLanguage } from "./i18n/Language";
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { AccessGate, AccountMenu } from './Access';
import { sessionFetch } from './Access';
import { SettingsPanel } from './Settings';
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import './ui.css';
import './style.css';
import './theme.css';
import './themes.css';
import './navigation.css';
import { ThemeProvider, ThemePicker } from './Theme';
import { SortableMetrics, useMetricOrder, normalizeOrder } from './SortableMetrics';
import { Icon, type IconName } from './Icons';
import { MetricIcon, metricIconNames } from './MetricIcon';
import './metric-icons.css';
import { SimulatorControlPanel } from './SimulatorControl';
import { HeatingCurvePanel } from './HeatingCurve';
import { DallasOneWirePanel, isDallasValue, dallasLabel } from './DallasOneWire';
import { HistoryPanel, EventsPanel, StorageNotice } from './History';
const MetricChartDialog = lazy(() => import('./charts/MetricChartDialog'));
type Quality = 'unknown' | 'valid' | 'stale' | 'invalid';
type Value = {
  key: string;
  alias?: string | null;
  value: number | string | boolean | null;
  unit: string;
  quality: Quality;
  receivedAtUtc: string | null;
  retained: boolean;
  sourceKind: string;
};
type Snapshot = {
  instanceId: string;
  revision: number;
  generatedAtUtc: string;
  brokerConnected: boolean;
  deviceAvailability: string;
  telemetryFreshness: Quality;
  values: Value[];
};
type System = {
  appVersion: string;
  plantName?: string;
  settingsEnabled?: boolean;
  source: 'simulator' | 'mqtt';
  readOnly: boolean;
  instanceId: string;
  capabilities?: string[];
};
const labels: Record<string, string> = {
  heishamonCop: 'COP · HeishaMon',
  heatPowerConsumption: 'Heizen elektrisch',
  heatPowerProduction: 'Heizen thermisch',
  dhwPowerConsumption: 'Warmwasser elektrisch',
  dhwPowerProduction: 'Warmwasser thermisch',
  sterilizationState: 'Sterilisation – Status',
  sterilizationTemperature: 'Sterilisationstemperatur',
  sterilizationMaxTime: 'Sterilisation – maximale Dauer',
  flowTemperature: 'Vorlauf',
  returnTemperature: 'Rücklauf',
  temperatureSpread: 'Spreizung',
  outsideTemperature: 'Außentemperatur',
  indoorTemperature: 'Innen',
  indoorTargetTemperature: 'Innen-Soll',
  dhwTemperature: 'Warmwasser',
  dhwTargetTemperature: 'Warmwasser-Soll',
  dhwHeatDelta: 'Warmwasser-Einschaltdifferenz',
  operationsHours: 'Betriebsstunden',
  operationsCounter: 'Betriebszähler',
  threeWayValveState: '3-Wege-Ventil',
  waterPressure: 'Wasserdruck',
  pumpSpeed: 'Pumpendrehzahl',
  fanSpeed: 'Ventilatordrehzahl',
  compressorCurrent: 'Verdichterstrom',
  highPressure: 'Hochdruck',
  waterFlow: 'Durchfluss',
  compressorFrequency: 'Verdichterfrequenz',
  heatpumpState: 'Wärmepumpe',
  quietMode: 'Flüstermodus',
  operatingMode: 'Betriebsart',
  heatingControlMode: 'Heizregelung',
  internalHeaterState: 'Heizstab',
  activeError: 'Fehlerstatus'
};
const qualities: Record<Quality, string> = {
  unknown: 'Unbekannt',
  valid: 'Aktuell',
  stale: 'Veraltet',
  invalid: 'Ungültig'
};
const modes = ['Heizen', 'Kühlen', 'Auto (Heizen)', 'Warmwasser', 'Heizen + Warmwasser', 'Kühlen + Warmwasser', 'Auto (Heizen) + Warmwasser', 'Auto (Kühlen)', 'Auto (Kühlen) + Warmwasser'];
const tabs = ['Übersicht', 'Verlauf', 'Steuerung', 'Heizkurve', 'Dallas-1-Wire', 'Ereignisse', 'Einstellungen'];
const tabIcons: IconName[] = ['home', 'chart', 'sliders', 'chart', 'chart', 'bell', 'settings'];
const temperatureKeys = ['flowTemperature', 'returnTemperature', 'temperatureSpread', 'outsideTemperature', 'indoorTemperature', 'dhwTemperature'];
const powerKeys = ['heatPowerConsumption', 'heatPowerProduction', 'dhwPowerConsumption', 'dhwPowerProduction'];
const detailKeys = ['heatpumpState', 'internalHeaterState', 'heatingControlMode', 'quietMode', 'activeError'];
const technicalKeys = ['pumpSpeed', 'fanSpeed', 'compressorCurrent', 'highPressure'];
const plantKeys = ['compressorFrequency', 'waterFlow', 'heishamonCop', ...technicalKeys, 'operationsHours', 'operationsCounter', 'threeWayValveState', 'waterPressure', ...powerKeys];
const controlKeys = ['mode', 'indoor', 'dhw', 'quiet', 'sterilization'];
const controlLabels: Record<string, string> = {
  mode: 'Betriebsart',
  indoor: 'Innen',
  dhw: 'Warmwasser',
  quiet: 'Flüstermodus',
  sterilization: 'Sterilisation'
};
const spokenUnits: Record<string, string> = {
  'U/min': 'Umdrehungen pro Minute',
  A: 'Ampere',
  'kgf/cm²': 'Kilogramm-Kraft pro Quadratzentimeter'
};
const formatTime = (date: string) => new Intl.DateTimeFormat(getLocale(), {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}).format(new Date(date));
function display(value: Value) {
  if (technicalKeys.includes(value.key)) {
    if (value.quality === 'unknown' || value.quality === 'invalid' || typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0) return '—';
    return value.value.toLocaleString(getLocale(), {
      maximumFractionDigits: ['pumpSpeed', 'fanSpeed'].includes(value.key) ? 0 : 1
    });
  }
  if (twoDecimalMetrics.includes(value.key)) return value.quality === 'unknown' || value.quality === 'invalid' || typeof value.value !== 'number' || !Number.isFinite(value.value) ? '—' : metricNumber(value.value, value.key);
  if (value.value === null) return value.key === 'activeError' ? 'Fehlerstatus unbekannt' : '—';
  if (value.key === 'activeError' && value.value === 'no error') return 'Fehlerfrei';
  if (value.key === 'sterilizationState') return ['Inaktiv', 'Aktiv'][Number(value.value)] ?? 'Unbekannt';
  if (value.key === 'threeWayValveState') return ['Raumheizung', 'Warmwasser'][Number(value.value)] ?? 'Unbekannt';
  if (value.key === 'waterPressure' && typeof value.value === 'number') return value.value.toLocaleString(getLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (value.key === 'operatingMode') return modes[Number(value.value)] ?? 'Unbekannt';
  if (value.key === 'heatingControlMode') return Number(value.value) === 0 ? 'Heizkurve' : 'Festwert';
  if (value.key === 'quietMode') return ['Aus', 'Stufe 1', 'Stufe 2', 'Stufe 3'][Number(value.value)] ?? '—';
  if (value.key === 'internalHeaterState' || value.key === 'heatpumpState') return Number(value.value) === 1 ? 'Ein' : 'Aus';
  return typeof value.value === 'number' ? value.value.toLocaleString(getLocale(), {
    maximumFractionDigits: 1
  }) : String(value.value);
}
function Unavailable({
  children
}: {
  children: React.ReactNode;
}) {
  const language = useLanguage();
  return <div className="unavailable"><Icon name="info" /><div><h2>{t("Noch nicht verfügbar")}</h2><p>{localizeText(children)}</p></div></div>;
}
function App() {
  const navigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--navigation-height', `${navigation.getBoundingClientRect().height}px`);
    });
    observer.observe(navigation);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--navigation-height');
    };
  }, []);
  const language = useLanguage();
  const layout = useMetricOrder();
  const savedDetails = layout.orders.details;
  const detailOrder = normalizeOrder(savedDetails, detailKeys);
  if (savedDetails && !savedDetails.includes('quietMode')) {
    detailOrder.splice(detailOrder.indexOf('quietMode'), 1);
    detailOrder.splice(detailOrder.indexOf('heatingControlMode') + 1, 0, 'quietMode');
  }
  const [editingOrder, setEditingOrder] = useState(false);
  const [chartKey, setChartKey] = useState<string | null>(null);
  const [tab, setTab] = useState('Übersicht');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [system, setSystem] = useState<System | null>(null);
  const [transport, setTransport] = useState(false);
  const [now, setNow] = useState(Date.now());
  const dallasValues = snapshot?.values.filter(isDallasValue) ?? [];
  const hasDallasValues = dallasValues.length > 0;
  const selectedDallas = dallasValues.find(value => value.key === chartKey);
  const chartLabel = selectedDallas ? `${dallasLabel(selectedDallas)} · ${selectedDallas.key.slice('ds18b20_'.length)}` : localizeText(labels[chartKey ?? '']);
  useEffect(() => {
    if (!hasDallasValues && tab === 'Dallas-1-Wire') setTab('Übersicht');
  }, [hasDallasValues, tab]);
  const received = useRef(0);
  useEffect(() => {
    let disposed = false;
    const abort = new AbortController();
    const accept = (next: Snapshot) => {
      if (disposed) return;
      received.current = Date.now();
      setSnapshot(old => !old || old.instanceId !== next.instanceId || next.revision > old.revision ? next : old);
    };
    const refresh = async () => {
      const responses = await Promise.all(['/api/v1/system', '/api/v1/snapshot'].map(url => sessionFetch(url, {
        signal: abort.signal,
        cache: 'no-store'
      })));
      if (responses.some(r => !r.ok)) throw new Error('Snapshot unavailable');
      const [sys, next] = await Promise.all(responses.map(r => r.json()));
      if (!disposed) {
        setSystem(sys);
        accept(next);
      }
    };
    const hub = new HubConnectionBuilder().withUrl('/hubs/telemetry').withAutomaticReconnect([0, 1000, 3000, 10000]).configureLogging(LogLevel.None).build();
    // The server sends every second. A silent socket must trigger an actual reconnect,
    // even when the browser never receives a WebSocket close frame.
    hub.serverTimeoutInMilliseconds = 5000;
    hub.keepAliveIntervalInMilliseconds = 2000;
    hub.on('SnapshotChanged', accept);
    hub.onreconnecting(() => setTransport(false));
    hub.onreconnected(async () => {
      try {
        await refresh();
        if (!disposed) setTransport(true);
      } catch {
        setTransport(false);
        await hub.stop();
      }
    });
    hub.onclose(() => setTransport(false));
    let starting = false;
    const connect = async () => {
      if (disposed || starting || hub.state !== 'Disconnected') return;
      starting = true;
      try {
        await hub.start();
        await refresh();
        if (!disposed) setTransport(true);
      } catch {
        if (!disposed) setTransport(false);
        await hub.stop();
      } finally {
        starting = false;
      }
    };
    void connect();
    const refreshSystem = () => { void refresh().catch(() => setTransport(false)); };
    window.addEventListener('cockpit-control-changed', refreshSystem);
    const tick = setInterval(() => {
      setNow(Date.now());
      void connect();
    }, 1000);
    return () => {
      disposed = true;
      abort.abort();
      clearInterval(tick);
      window.removeEventListener('cockpit-control-changed', refreshSystem);
      void hub.stop();
    };
  }, []);
  const live = transport && now - received.current < 5000;
  const currentValue = (key: string) => snapshot?.values.find(v => v.key === key);
  const liveControl = system?.capabilities?.includes('liveCommands') ?? false;
  const curveControl = system?.capabilities?.includes('heatingCurveCommands') ?? false;
  const liveTest = system?.source === 'mqtt' && system.capabilities?.includes('boundedLiveTest');
  const simulatorControl = system?.source === 'simulator' && system.capabilities?.includes('simulatorCommands');
  const mode = currentValue('operatingMode');
  const deviceOnline = live && snapshot?.deviceAvailability === 'online';
  function card(key: string, variant = '', attributes: React.HTMLAttributes<HTMLElement> = {}, controls?: React.ReactNode, headingLevel: 2 | 3 = 3) {
    const Heading = headingLevel === 2 ? 'h2' : 'h3';
    const value = currentValue(key);
    const targetKey = tab === 'Übersicht' ? ({ dhwTemperature: 'dhwTargetTemperature', indoorTemperature: 'indoorTargetTemperature' } as Record<string, string>)[key] : undefined;
    const target = targetKey ? currentValue(targetKey) : undefined;
    const targetQuality = !live && target?.quality === 'valid' ? 'stale' : target?.quality ?? 'unknown';
    const targetNumber = target && !['unknown', 'invalid'].includes(targetQuality) && typeof target.value === 'number' && Number.isFinite(target.value) ? display(target) : '—';
    const quality = !live && value?.quality === 'valid' ? 'stale' : value?.quality ?? 'unknown';
    const icon = metricIconNames[key];
    const accessibleLabel = technicalKeys.includes(key) ? `${labels[key]} ${value ? display(value) : '—'} ${value ? spokenUnits[value.unit] ?? value.unit : ''} · ${qualities[quality]}` : labels[key];
    return <Card asChild key={key}><article {...attributes} className={['metric', attributes.className ?? '', key, quality, variant, key === 'activeError' && value?.value === 'no error' && quality === 'valid' ? 'error-free' : ''].join(' ')} key={key} aria-label={localizeText(accessibleLabel)}>
      {localizeText(controls)}{icon && <MetricIcon name={icon} />}
      <div className="metric-top"><Heading className="metric-heading">{key === 'outsideTemperature' ? localizeText('Außen') : key === 'compressorFrequency' ? localizeText('Verdichter') : localizeText(labels[key])}</Heading><Badge variant="secondary" className="quality">{localizeText(qualities[quality])}</Badge></div>
      <p className={targetKey ? 'value with-target' : 'value'}>{value ? localizeText(display(value)) : key === 'activeError' ? localizeText('Fehlerstatus unbekannt') : localizeText('—')} <span>{value && !['enum', ''].includes(value.unit) && value.value !== null ? localizeText(value.unit) : localizeText('')}</span>{targetKey && <> / <span className="target-reading" title={localizeText(labels[targetKey])}>{localizeText(targetNumber)} <span>{targetNumber !== '—' ? localizeText('°C') : ''}</span></span></>}</p>
      {targetKey && (targetQuality !== 'valid' || target?.retained) && <p className="note target-quality">{localizeText(labels[targetKey])}: {localizeText(qualities[targetQuality])}{target?.retained && <> · {t('Retained · historische Nachricht')}</>}</p>}
      <p className="age">{value?.receivedAtUtc ? <><time dateTime={value.receivedAtUtc}>{t("Empfangen ")}{localizeText(formatTime(value.receivedAtUtc))}</time><span className="age-elapsed">{t(" · vor {0} s", [Math.max(0, Math.floor((now - Date.parse(value.receivedAtUtc)) / 1000))])}</span></> : localizeText('Noch kein Messwert')}</p>
      {value?.retained && <p className="note">{t("Retained · historische Nachricht")}</p>}
      {key === 'heishamonCop' && <p className="note">{t("Aus HeishaMon-Extra-Leistung berechnet")}</p>}
      {tab === 'Übersicht' && !editingOrder && <Button className="metric-chart-open" aria-label={localizeText(`${labels[key]} – Diagramm öffnen`)} onClick={() => setChartKey(key)} />}
    </article></Card>;
  }
  const controlContents: Record<string, React.ReactNode> = {
    mode: <><h2>{t("Betriebsart")}</h2>{localizeText(card('operatingMode', 'compact'))}</>,
    indoor: <><h2>{t("Innen")}</h2>{localizeText(card('indoorTargetTemperature', 'compact'))}{localizeText(card('indoorTemperature', 'compact'))}<p className="field-note">{t("Raumsollwert für Heizen, Zone 1. Nur bei bestätigter Raumregelung verfügbar.")}</p></>,
    dhw: <><h2>{t("Warmwasser")}</h2>{localizeText(card('dhwTargetTemperature', 'compact'))}{localizeText(card('dhwTemperature', 'compact'))}{localizeText(card('dhwHeatDelta', 'compact'))}</>,
    quiet: <><h2>{t("Flüstermodus")}</h2>{localizeText(card('quietMode', 'compact'))}</>,
    sterilization: <><h2>{t("Sterilisation")}</h2>{localizeText(card('sterilizationState', 'compact'))}{localizeText(card('sterilizationTemperature', 'compact'))}{localizeText(card('sterilizationMaxTime', 'compact'))}<p className="field-note">{t("Temperatur, maximale Dauer und einmaligen Start unten in der Anlagensteuerung wählen. SET49/SET50 sind experimentell. „Aktiv“ bestätigt keinen abgeschlossenen Zyklus.")}</p></>
  };
  const connections = <section className="connections" aria-label={t("Verbindungen und Datenqualität")}>
    <div><span>{t("Browser ↔ Backend")}</span><strong><i className={live ? 'dot online' : 'dot'} />{live ? localizeText('Verbunden') : localizeText('Unterbrochen')}</strong></div>
    <div><span>{t("Brokerverbindung")}{system?.source === 'simulator' ? localizeText(' (simuliert)') : localizeText('')}</span><strong>{!live ? localizeText('Unbekannt') : snapshot?.brokerConnected ? localizeText('Verbunden') : localizeText('Getrennt')}</strong></div>
    <div><span>{t("Geräteverfügbarkeit (LWT)")}</span><strong>{!live ? localizeText('Unbekannt') : snapshot?.deviceAvailability === 'online' ? localizeText('Online') : snapshot?.deviceAvailability === 'offline' ? localizeText('Offline') : localizeText('Unbekannt')}</strong></div>
    <div><span>{t("Datenqualität")}</span><strong>{!live ? localizeText('Unbekannt') : localizeText(qualities[snapshot?.telemetryFreshness ?? 'unknown'])}</strong></div>
  </section>;
  return <div className="layout">
    <a href="#content" className="skip">{t("Zum Inhalt")}</a>
    <header className="app-header">
      <LanguagePicker /><ThemePicker />
      <div className="header-state"><span>{t("Aquarea L")}</span><span className="header-mode">{live && mode?.quality === 'valid' ? localizeText(display(mode)) : localizeText('Betriebsart unbekannt')}</span></div>
      <div className="header-connection"><span><i className={deviceOnline ? 'dot online' : 'dot'} />{deviceOnline ? localizeText('HeishaMon online') : localizeText('HeishaMon: ') + (live && snapshot?.deviceAvailability === 'offline' ? localizeText('Offline') : localizeText('unbekannt'))}</span><small>{system?.source === 'simulator' ? localizeText('Verbindungsstatus simuliert') : localizeText('Verfügbarkeit laut LWT')}</small></div>
      <div className="header-age">{snapshot ? localizeText('Stand ') + localizeText(formatTime(snapshot.generatedAtUtc)) + localizeText(' · Berlin') : localizeText('Warte auf Daten')}<small>{liveControl ? localizeText('Anlagensteuerung') : curveControl ? localizeText('Heizkurvensteuerung') : liveTest ? localizeText('Begrenzter Live-Test · reale Anlage') : simulatorControl ? localizeText('Simulatorsteuerung verfügbar') : localizeText('Nur lesen')}</small></div>
    </header>
    <aside className="navigation" ref={navigationRef}><Brand plantName={system?.plantName} /><nav aria-label={t("Hauptnavigation")}>{localizeText(tabs.map((name, i) => name === 'Dallas-1-Wire' && !hasDallasValues ? null : <Button key={name} onClick={() => {
          setTab(name);
          setEditingOrder(false);
        }} aria-current={tab === name ? 'page' : undefined}><Icon name={tabIcons[i]} />{localizeText(name)}</Button>))}<AccountMenu /></nav><p className="sidebar-note"><Icon name="lock" /> {liveControl ? localizeText('Anlagensteuerung') : curveControl ? localizeText('Heizkurvensteuerung') : liveTest ? localizeText('Begrenzter Live-Test') : simulatorControl ? localizeText('Simulatorbetrieb') : localizeText('Lesender Betrieb')}</p></aside>
    <main id="content" tabIndex={-1}>
      {chartKey && <Suspense fallback={<p role="status">{t("Diagramm wird geöffnet …")}</p>}><MetricChartDialog key={chartKey} metricKey={chartKey} label={chartLabel} onClose={() => setChartKey(null)} /></Suspense>}
      <div className="page-heading"><div className="page-heading-row"><h1 className="page-title">{localizeText(tab)}</h1>{(tab === 'Übersicht' || tab === 'Steuerung' || tab === 'Dallas-1-Wire') && <Button aria-pressed={editingOrder} onClick={() => setEditingOrder(!editingOrder)}>{editingOrder ? localizeText('Anordnung fertig') : localizeText('Kacheln anordnen')}</Button>}</div><p>{t("Version ")}{localizeText(system?.appVersion) ?? localizeText('—')} · {system ? system.source === 'simulator' ? localizeText('Simulatordaten') : system.readOnly ? localizeText('Lokaler Lesebetrieb') : localizeText('Lokaler Bedienbetrieb') : localizeText('Datenquelle wird geladen …')}</p></div>
      <div className="simulation" role="status"><Icon name="info" />{system?.source === 'simulator' ? localizeText('SIMULATION · Alle Messwerte und Verbindungszustände sind simuliert.') : system?.source === 'mqtt' ? liveControl ? localizeText('MQTT · Heizkurve und Warmwassersteuerung verfügbar') : curveControl ? localizeText('MQTT · Heizkurvensteuerung verfügbar') : localizeText('MQTT · Lesender Betrieb') : localizeText('Datenquelle wird geladen …')}</div>
      <StorageNotice />
      {!live && <div className="warning" role="alert">{t("Liveverbindung zum Backend unterbrochen oder noch nicht hergestellt. Angezeigte Werte sind nicht aktuell.")}</div>}
      {live && (!snapshot?.brokerConnected || snapshot.deviceAvailability === 'offline') && <p className="warning" role="alert">{t("Verbindungsausfall der Datenquelle. Letzte Werte sind veraltet.")}</p>}
      {tab === 'Heizkurve' && <HeatingCurvePanel values={snapshot?.values ?? []} live={live} enabled={curveControl} source={system?.source ?? ''} />}
      {tab === 'Dallas-1-Wire' && <DallasOneWirePanel values={dallasValues} live={live} now={now} brokerConnected={snapshot?.brokerConnected ?? false} deviceAvailability={snapshot?.deviceAvailability ?? 'unknown'} openChart={setChartKey} editing={editingOrder} />}
      {(tab === 'Übersicht' || tab === 'Steuerung' || tab === 'Dallas-1-Wire') && <>
        {editingOrder && <p id="sort-instructions">{t("Reihenfolge wird in diesem Browser gespeichert. Am Griff ziehen oder dessen Pfeiltasten verwenden. Alternativ mit den Pfeilbuttons verschieben. Sortieren innerhalb der jeweiligen Gruppe; Escape bricht das Ziehen ab.")}</p>}
        {layout.error && <p role="alert" className="warning">{localizeText(layout.error)}</p>}
      </>}
      {tab === 'Übersicht' && <>
        <div className="overview-layout"><div className="overview-main">
          <SortableMetrics group="temperatures" label={t("Messwerte")} className="temperature-grid" editing={editingOrder} keys={normalizeOrder(layout.orders.temperatures, temperatureKeys)} labels={labels} save={layout.save} render={(key, attrs, controls) => card(key, "", attrs, controls, 2)} />
          <section className="panel plant-panel" aria-label={t("Anlagenstatus")}><h2>{t("Anlagenstatus")}</h2>
            <SortableMetrics group="plant" label={t("Anlagenmesswerte")} className="plant-grid" editing={editingOrder} keys={normalizeOrder(layout.orders.plant, plantKeys)} labels={labels} save={layout.save} render={(key, attrs, controls) => card(key, "plant-metric", attrs, controls)} />
            <SortableMetrics group="details" label={t("Betriebszustände")} className="plant-details" editing={editingOrder} keys={detailOrder} labels={labels} save={layout.save} render={(key, attrs, controls) => card(key, "compact", attrs, controls)} />
          </section>
          <HistoryPanel compact /><EventsPanel compact />
        </div></div>
        {localizeText(connections)}
      </>}
      {tab === 'Verlauf' && <HistoryPanel />}
      {tab === 'Steuerung' && <div className="control-page">
        <SortableMetrics group="control" label={t("Steuerungsstatus")} className="control-status-grid" editing={editingOrder} keys={normalizeOrder(layout.orders.control, controlKeys)} labels={controlLabels} save={layout.save} render={(key, attrs, controls) => <section key={key} {...attrs} className={'panel ' + (attrs.className ?? '')} aria-label={key === 'indoor' ? localizeText('Innen – nur lesen') : localizeText(controlLabels[key])}>{localizeText(controls)}{localizeText(controlContents[key])}</section>} />
        {simulatorControl || liveTest || liveControl ? <SimulatorControlPanel liveTest={!!liveTest} liveControl={liveControl} extendedEnabled={system?.capabilities?.includes("extendedCommands") ?? false} sterilizationEnabled={system?.capabilities?.includes("sterilizationCommands") ?? false} /> : <Unavailable>{t("Dieses Release liest ausschließlich Messwerte. Heizungssteuerung benötigt eine separate Freigabe.")}</Unavailable>}
      </div>}
      {tab === 'Ereignisse' && <><div className="event-status">{localizeText(card('activeError', 'compact', {}, undefined, 2))}</div><EventsPanel /></>}
      {tab === 'Einstellungen' && <SettingsPanel enabled={system?.settingsEnabled ?? false} onSaved={name => setSystem(old => old ? {
        ...old,
        plantName: name
      } : old)} openHistory={() => setTab('Verlauf')} />}
      <footer className="footnote">{t("Online meldet die Erreichbarkeit von HeishaMon, nicht die Frische aller Wärmepumpenwerte. Datenalter ist das Empfangsalter; die Messzeit ist unbekannt.")}</footer>
    </main>
  </div>;
}
setLanguage(readLanguage());
createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider><AccessGate><App /></AccessGate></ThemeProvider></React.StrictMode>);
