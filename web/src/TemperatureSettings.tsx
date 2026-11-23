import { useEffect, useState } from 'react';
import { sessionFetch } from './Access';
import { Input } from './components/ui/input';
import { SettingsFooter, SettingsHeader } from './SettingsUi';
import { t } from './i18n/core';
import { readConfiguration, type PlantConfiguration } from './plant/plantModelState';
type Temperatures = Pick<PlantConfiguration, 'houseTemperature' | 'houseTargetTemperature'>;
type Saved = { configuration: PlantConfiguration; revision: number; editable: boolean };
export function TemperatureSettings({ enabled, csrfToken }: { enabled: boolean; csrfToken: string }) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [draft, setDraft] = useState<Temperatures | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load() {
    const response = await sessionFetch('/api/v1/settings/plant-model', { cache: 'no-store' });
    if (!response.ok) throw Error(t('Anlagenmodell-Konfiguration konnte nicht geladen werden.'));
    const data: Saved = await response.json();
    data.configuration = readConfiguration(JSON.stringify(data.configuration));
    setSaved(data); setDraft(data.configuration);
  }
  useEffect(() => { void load().catch(e => setError(e.message)); }, [enabled]);
  const editable = enabled && saved?.editable === true;
  async function act(save: boolean) {
    setBusy(true); setError(''); setMessage('');
    try {
      if (!save) { await load(); return; }
      if (!editable || !saved || !draft) return;
      const response = await sessionFetch('/api/v1/settings/plant-model', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
        body: JSON.stringify({ configuration: { ...saved.configuration, ...draft }, revision: saved.revision })
      });
      if (!response.ok) throw Error(t(response.status === 409 ? 'Einstellungen wurden inzwischen geändert. Bitte neu laden.' : 'Speichern fehlgeschlagen. Bisherige Einstellungen bleiben erhalten.'));
      const next: Saved = await response.json();
      next.configuration = readConfiguration(JSON.stringify(next.configuration));
      setSaved(next); setDraft(next.configuration);
      setMessage(t('Einstellungen gespeichert.'));
      window.dispatchEvent(new Event('cockpit-temperature-changed'));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="panel settings-panel" onSubmit={e => { e.preventDefault(); void act(true); }}>
    <SettingsHeader title={t('Temperaturdaten')} />
    <div className="settings-panel-body">
      {error && <p role="alert" className="warning">{error}</p>}
      {message && <p role="status">{message}</p>}
      {draft && (['houseTemperature', 'houseTargetTemperature'] as const).map(source => {
        const value = draft[source];
        const target = source === 'houseTargetTemperature';
        const update = (next: typeof value) => setDraft({ ...draft, [source]: next });
        return <fieldset key={source} disabled={!editable || busy}>
          <legend>{t(target ? 'Haustemperatur Soll per MQTT' : 'Haustemperatur per MQTT')}</legend>
          <label className="settings-confirm"><Input type="checkbox" checked={value.enabled} onChange={e => update({ ...value, enabled: e.target.checked })} /><span>{t(target ? 'MQTT-Haustemperatur Soll verwenden' : 'MQTT-Haustemperatur verwenden')}</span></label>
          <label className="settings-field"><span>{t('MQTT-Topic')}</span><Input disabled={!value.enabled} required={value.enabled} maxLength={200} value={value.input.topic} onChange={e => update({ ...value, input: { ...value.input, topic: e.target.value } })} /></label>
          <label className="settings-field"><span>{t('Payload-Pfad')}</span><Input disabled={!value.enabled} maxLength={256} placeholder="$.temperature" value={value.input.payloadPath} onChange={e => update({ ...value, input: { ...value.input, payloadPath: e.target.value } })} /></label>
          <p className="settings-help">{t('Temperatur in °C über den konfigurierten MQTT-Broker. Payload-Pfad leer: direkte Zahl, sonst z. B. $.temperature. Keine MQTT-Platzhalter.')}</p>
          <p className="settings-help">{t(target ? 'Ersetzt Innen-Soll auf der Übersicht. Im Hausbild wird der MQTT-Sollwert nur angezeigt, wenn ein Messwert vorhanden ist.' : 'Ersetzt nach dem Speichern die Innentemperatur im Anlagenmodell, im Temperaturverlauf und auf der Übersicht. Fehlende MQTT-Werte werden als - angezeigt. Veraltete Temperaturen bleiben sichtbar.')}</p>
        </fieldset>;
      })}
    </div>
    <SettingsFooter dirty={!!saved && !!draft && (['houseTemperature', 'houseTargetTemperature'] as const).some(source => JSON.stringify(saved.configuration[source]) !== JSON.stringify(draft[source]))} busy={busy} disabled={!editable || !draft} onDiscard={() => void act(false)} saveLabel={t('Einstellungen speichern')} />
  </form>;
}
