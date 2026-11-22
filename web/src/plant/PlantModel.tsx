import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '../components/ui/button';
import { stateLabel } from '../charts/chartFormat';
import { plantMetricLabels } from './plantMetricLabels';
import { sessionFetch } from '../Access';
import { useLanguage } from '../i18n/Language';
import { getLocale, t } from '../i18n/core';
import type { HeatPumpModel } from '../HeatPumpModel';
import { PlantDiagram } from './PlantDiagram';
import { resolve } from './plantHousing';
import { derivePlantState, readConfiguration, readNumber, type PlantConfiguration, type PlantSnapshot, type PlantValue } from './plantModelState';
import './plant-model.css';

type Saved = { configuration: PlantConfiguration; revision: number; editable: boolean };
type Props = { snapshot: (PlantSnapshot & { heatPumpModel?: HeatPumpModel }) | null; live: boolean; now: number; labels: Record<string, string>; openChart: (key: string) => void };
const activityLabels = { unknown: 'Unbekannt', off: 'Aus', idle: 'Bereitschaft', circulate: 'Umwälzung', heating: 'Heizen', dhw: 'Warmwasser', cooling: 'Kühlen', defrost: 'Abtauung', sterilization: 'Sterilisation' };
const components = ['Außeneinheit', 'Hydraulik', 'Warmwasser', 'Heizkreise', 'Kältekreis'] as const;
const detailKeys: Record<typeof components[number], string[]> = {
  Außeneinheit: ['compressorFrequency', 'fanSpeed', 'compressorCurrent', 'operationsHours', 'operationsCounter', 'activeError'],
  Hydraulik: ['flowTemperature', 'returnTemperature', 'temperatureSpread', 'waterFlow', 'waterPressure', 'pumpSpeed', 'threeWayValveState'],
  Warmwasser: ['dhwTemperature', 'dhwTargetTemperature', 'dhwHeatDelta', 'internalHeaterState', 'sterilizationState', 'sterilizationTemperature'],
  Heizkreise: ['indoorTemperature', 'indoorTargetTemperature', 'mainTargetTemperature', 'zone1HeatRequest', 'zone1SensorMode', 'zonesState'],
  Kältekreis: ['highPressure', 'compressorCurrent']
};

export function PlantModel({ snapshot, live, now, labels, openChart }: Props) {
  useLanguage();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [draft, setDraft] = useState(readConfiguration(null));
  const [baseRevision, setBaseRevision] = useState(0);
  const [admin, setAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState('');
  const [paused, setPaused] = useState(false);
  const [component, setComponent] = useState<typeof components[number]>('Außeneinheit');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
      try {
        const [response, authResponse] = await Promise.all(['/api/v1/settings/plant-model', '/api/v1/auth/session'].map(url => sessionFetch(url, { signal: abort.signal, cache: 'no-store' })));
        if (!response.ok || !authResponse.ok) throw new Error();
        const [data, auth] = await Promise.all([response.json(), authResponse.json()]);
        if (abort.signal.aborted) return;
        setSaved(old => old && old.revision > data.revision ? old : { configuration: readConfiguration(JSON.stringify(data.configuration)), revision: data.revision, editable: data.editable === true });
        const canEdit = auth.authenticated === true && auth.role === 'admin' && data.editable === true;
        setAdmin(canEdit); if (!canEdit) setEditing(false);
      } catch { if (!abort.signal.aborted) { setAdmin(false); setEditing(false); setMessage('Anlagenmodell-Konfiguration konnte nicht geladen werden.'); } }
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    const sessionChanged = () => { setEditing(false); void load(); };
    window.addEventListener('cockpit-session-changed', sessionChanged);
    return () => { abort.abort(); clearInterval(timer); window.removeEventListener('cockpit-session-changed', sessionChanged); };
  }, [refresh]);
  const config = editing ? draft : saved?.configuration ?? readConfiguration(null);
  const plant = derivePlantState(snapshot, live);
  const values = snapshot?.values ?? [];
  const profile = resolve(snapshot?.heatPumpModel?.rawIdentifier ?? values.find(v => v.key === 'heatPumpModel')?.value);
  const number = (key: string) => readNumber(values, key, plant.connected);
  const reading = (key: string) => {
    const v = values.find(value => value.key === key);
    const temperature = v?.unit === '°C';
    const n = temperature
      ? v && ['valid', 'stale'].includes(v.quality) && typeof v.value === 'number' && Number.isFinite(v.value) && v.value > -78 ? v.value : null
      : number(key);
    if (n === null) return temperature || key === 'mqttHouseTemperature' || key.toLowerCase().includes('temperature') ? '-' : '—';
    const fixedPrecision = ['flowTemperature', 'returnTemperature', 'temperatureSpread', 'waterPressure', 'mainTargetTemperature'].includes(key) ? 2 : undefined;
    return `${n.toLocaleString(getLocale(), { minimumFractionDigits: fixedPrecision, maximumFractionDigits: fixedPrecision ?? (['fanSpeed', 'pumpSpeed', 'compressorFrequency'].includes(key) ? 0 : 1) })}${v?.unit && v.unit !== 'enum' ? ` ${v.unit}` : ''}`;
  };
  const label = (v: PlantValue) => v.alias || t(labels[v.key] ?? plantMetricLabels[v.key] ?? v.key);
  const chartButton = (key: string, name: string) => <Button type="button" className="metric-chart-open"
    aria-label={t('{0} – Diagramm öffnen', [name])} onClick={() => openChart(key)} />;
  const display = (v: PlantValue) => {
    if (v.unit === '°C') return reading(v.key);
    if (!plant.connected || v.quality !== 'valid' || v.retained) return '—';
    if (v.unit === 'enum' && typeof v.value === 'number') return stateLabel(v.key, v.value) ?? String(v.value);
    if (typeof v.value === 'number') return reading(v.key);
    return v.value === 'no error' ? t('Fehlerfrei') : v.value === null ? '—' : String(v.value);
  };
  const prefix = plant.activity === 'heating' ? 'heat' : (plant.activity === 'dhw' || plant.activity === 'sterilization') ? 'dhw' : plant.activity === 'cooling' ? 'cool' : null;
  const power = (kind: string) => {
    const watts = prefix ? number(`${prefix}Power${kind}`) : null;
    return watts !== null && watts >= 0 ? `${(watts / 1000).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW` : '—';
  };
  async function save() {
    if (!admin || saving) return;
    setSaving(true); setMessage('');
    try {
      const session = await sessionFetch('/api/v1/auth/session', { cache: 'no-store' });
      if (!session.ok) throw new Error();
      const auth = await session.json();
      if (!auth.authenticated || auth.role !== 'admin') { setAdmin(false); setEditing(false); throw new Error(); }
      const response = await sessionFetch('/api/v1/settings/plant-model', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': auth.csrfToken }, body: JSON.stringify({ configuration: draft, revision: baseRevision }) });
      if (!response.ok) { setMessage(response.status === 409 ? 'Einstellungen wurden inzwischen geändert. Bitte neu laden.' : 'Speichern fehlgeschlagen. Bisherige Einstellungen bleiben erhalten.'); return; }
      const next = await response.json();
      setSaved({ ...next, configuration: readConfiguration(JSON.stringify(next.configuration)) }); setEditing(false); setMessage('Anlagenmodell-Konfiguration gespeichert.');
    } catch { setMessage('Speichern fehlgeschlagen. Bisherige Einstellungen bleiben erhalten.'); }
    finally { setSaving(false); }
  }
  const update = <K extends keyof PlantConfiguration>(key: K, value: PlantConfiguration[K]) => setDraft(old => ({ ...old, [key]: value }));
  const style = { '--refrigerant-duration': `${48 / Math.max(plant.frequency ?? 0, 1) / config.speed}s`, '--flow-duration': `${2900 / Math.max(plant.pumpSpeed ?? 0, 1) / config.speed}s`, '--pump-duration': `${2400 / Math.max(plant.pumpSpeed ?? 0, 1) / config.speed}s`, '--fan-duration': `${1050 / Math.max(plant.fan ?? 0, 1) / config.speed}s` } as CSSProperties;
  const className = ['plant-model', `mode-${plant.activity}`, plant.valve === 1 ? 'valve-tank' : '', plant.pumpRunning ? 'water-active' : '', plant.fanRunning ? 'fan-active' : '', plant.refrigerantRunning ? 'refrigerant-active' : '', paused || !config.motion ? 'motion-off' : ''].join(' ');
  const selected = detailKeys[component].flatMap(key => { const value = values.find(v => v.key === key); return value ? [value] : []; });
  const filtered = values.filter(v => `${label(v)} ${v.key} ${v.sourceTopic ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className={className} style={style}>
    <div className="plant-actions"><div><strong>{profile.known ? profile.name : snapshot?.heatPumpModel?.displayName ?? t('Modell unbekannt')}</strong><p>{t('Automatische Modellerkennung')} · {t(activityLabels[plant.activity])}</p></div><div>
      <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{t(paused ? 'Animation fortsetzen' : 'Animation pausieren')}</button>
      {admin && saved && <button type="button" aria-expanded={editing} onClick={() => { setDraft(saved.configuration); setBaseRevision(saved.revision); setEditing(!editing); }}>{t('Modell konfigurieren')}</button>}
    </div></div>
    {!admin && <p className="plant-note">{t('Die Anlagenmodell-Konfiguration wird pro Installation gespeichert. Nur Administratoren können sie bearbeiten.')}</p>}
    {message && <p role="status" className="plant-note">{t(message)} <button type="button" onClick={() => { setMessage(''); setEditing(false); setRefresh(n => n + 1); }}>{t('Neu laden')}</button></p>}
    {editing && <section className="panel plant-config" aria-label={t('Modell konfigurieren')}>
      <p>{t('Diese Einstellungen ändern nur die Darstellung, keine Gerätesollwerte.')}</p>
      <label>{t('Heizkreise')}<select aria-label={t("Heizkreise")} value={draft.zones} onChange={e => update('zones', e.target.value === '2' ? 2 : 1)}><option value="1">1</option><option value="2">2</option></select></label>
      {([1, 2] as const).map(zone => <label key={zone}>{t(zone === 1 ? 'Heizkreis 1' : 'Heizkreis 2')}<select aria-label={t(zone === 1 ? "Heizkreis 1" : "Heizkreis 2")} disabled={zone === 2 && draft.zones === 1} value={draft[zone === 1 ? 'zone1' : 'zone2']} onChange={e => update(zone === 1 ? 'zone1' : 'zone2', e.target.value === 'radiator' ? 'radiator' : 'floor')}><option value="floor">{t('Fußbodenheizung')}</option><option value="radiator">{t('Heizkörper')}</option></select></label>)}
      {(['tank', 'buffer', 'sensors', 'motion'] as const).map((key, i) => <label className="plant-check" key={key}><input type="checkbox" checked={draft[key]} onChange={e => update(key, e.target.checked)} />{t(['Warmwasserspeicher anzeigen', 'Reihenpuffer anzeigen', 'Temperaturen an den Leitungen', 'Animation anzeigen'][i])}</label>)}
      <fieldset className="plant-house-temperature">
        <legend>{t('Haustemperatur per MQTT')}</legend>
        <label className="plant-check"><input type="checkbox" checked={draft.houseTemperature.enabled} onChange={e => update('houseTemperature', { ...draft.houseTemperature, enabled: e.target.checked })} />{t('MQTT-Haustemperatur verwenden')}</label>
        <label>{t('MQTT-Topic')}<input disabled={!draft.houseTemperature.enabled || saving} required={draft.houseTemperature.enabled} maxLength={200} value={draft.houseTemperature.input.topic} onChange={e => update('houseTemperature', { ...draft.houseTemperature, input: { ...draft.houseTemperature.input, topic: e.target.value } })} /></label>
        <label>{t('Payload-Pfad')}<input disabled={!draft.houseTemperature.enabled || saving} maxLength={256} placeholder="$.temperature" value={draft.houseTemperature.input.payloadPath} onChange={e => update('houseTemperature', { ...draft.houseTemperature, input: { ...draft.houseTemperature.input, payloadPath: e.target.value } })} /></label>
        <p className="plant-note">{t('Temperatur in °C über den konfigurierten MQTT-Broker. Payload-Pfad leer: direkte Zahl, sonst z. B. $.temperature. Keine MQTT-Platzhalter.')}</p>
        <p className="plant-note">{t('Ersetzt nach dem Speichern die Haustemperatur im Hausbild. Fehlende MQTT-Werte werden als - angezeigt. Veraltete Temperaturen bleiben sichtbar.')}</p>
      </fieldset>
      <label>{t('Animationstempo')}<input type="range" min="0.5" max="2" step="0.25" value={draft.speed} onChange={e => update('speed', Number(e.target.value))} /></label>
      <div className="plant-config-actions"><button type="button" disabled={saving} onClick={() => void save()}>{t(saving ? 'Wird gespeichert …' : 'Speichern')}</button><button type="button" disabled={saving} onClick={() => setEditing(false)}>{t('Abbrechen')}</button></div>
    </section>}
    <section className="plant-kpis" aria-label={t('Leistungsübersicht')}>
      {[
        [`${prefix ?? 'heat'}PowerProduction`, plant.activity === 'cooling' ? 'Kälteleistung' : 'Thermische Leistung', power('Production')],
        [`${prefix ?? 'heat'}PowerConsumption`, 'Elektrische Leistung', power('Consumption')],
        ['heishamonCop', 'COP · HeishaMon', reading('heishamonCop')],
        ['temperatureSpread', 'Spreizung', reading('temperatureSpread')]
      ].map(([key, name, value]) => <article className="panel" key={key}>
        <span>{t(name)}</span><strong>{value}</strong>{chartButton(key, t(name))}
      </article>)}
    </section>
    <div className="plant-workbench"><section className="panel plant-canvas"><div className="plant-section-heading"><h2>{t('Hydraulik & Energiefluss')}</h2><span>{t(activityLabels[plant.activity])}</span></div>
      <div className="plant-diagram-scroll" role="region" aria-label={t("Hydraulik & Energiefluss")} tabIndex={0}><PlantDiagram profile={profile} config={config} plant={plant} reading={key => reading(key === 'indoorTemperature' && saved?.configuration.houseTemperature.enabled ? 'mqttHouseTemperature' : key)} /></div>
      <div className="plant-components">{components.map(name => <button type="button" key={name} aria-pressed={component === name} onClick={() => setComponent(name)}>{t(name)}</button>)}</div>
      <p className="plant-note">{t('Gemeinsamer Gerätemaßstab. Leitungsführung und Bauteilpositionen sind schematisch.')} {t('Gestrichelte Verbindung: Kältemittel (H/J/K).')}</p>
    </section>
    <aside className="panel plant-inspector" aria-label={t("Anlagenstatus")}><h2>{t("Anlagenstatus")}</h2>
<div className="plant-component-readings"><h3>{t(component)}</h3><div>{selected.map(v => <div className="plant-detail" key={v.key}><span>{label(v)}</span><strong>{display(v)}</strong>{chartButton(v.key, label(v))}</div>)}</div></div><p className="plant-note">{t('Es werden nur verfügbare Messwerte angezeigt.')} {t('Ungültige, veraltete oder historische Werte treiben keine Animation an.')}</p></aside></div>
    <section className="panel plant-explorer"><div className="plant-section-heading"><h2>{t('Messwert-Explorer')} · {filtered.length}</h2><label>{t('Messwerte suchen')}<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      <div className="plant-table-scroll"><table><thead><tr><th>{t('Messwert')}</th><th>{t('Wert')}</th><th>{t('Datenqualität')}</th><th>{t('Empfangen')}</th></tr></thead><tbody>{filtered.map(v => <tr key={v.key}><td><span>{label(v)}</span><small>{v.sourceTopic ?? v.key}</small>{chartButton(v.key, label(v))}</td><td>{display(v)}</td><td>{t(!plant.connected || v.retained ? 'Veraltet' : ({ valid: 'Aktuell', stale: 'Veraltet', invalid: 'Ungültig', unknown: 'Unbekannt' }[v.quality]))}</td><td>{v.receivedAtUtc ? t('vor {0} s', [Math.max(0, Math.floor((now - Date.parse(v.receivedAtUtc)) / 1000))]) : '-'}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
