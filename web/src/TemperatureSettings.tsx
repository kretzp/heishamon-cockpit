import { useEffect, useState } from 'react';
import { sessionFetch } from './Access';
import { Input } from './components/ui/input';
import { SettingsFooter, SettingsHeader } from './SettingsUi';
import { t } from './i18n/core';
import { readConfiguration, type HouseTemperatureOptions, type PlantConfiguration } from './plant/plantModelState';

type Saved = { configuration: PlantConfiguration; revision: number; editable: boolean };
export function TemperatureSettings({ enabled, csrfToken }: { enabled: boolean; csrfToken: string }) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [draft, setDraft] = useState<HouseTemperatureOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load() {
    const response = await sessionFetch('/api/v1/settings/plant-model', { cache: 'no-store' });
    if (!response.ok) throw Error(t('Anlagenmodell-Konfiguration konnte nicht geladen werden.'));
    const data: Saved = await response.json();
    data.configuration = readConfiguration(JSON.stringify(data.configuration));
    setSaved(data); setDraft(data.configuration.houseTemperature);
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
        body: JSON.stringify({ configuration: { ...saved.configuration, houseTemperature: draft }, revision: saved.revision })
      });
      if (!response.ok) throw Error(t(response.status === 409 ? 'Einstellungen wurden inzwischen geändert. Bitte neu laden.' : 'Speichern fehlgeschlagen. Bisherige Einstellungen bleiben erhalten.'));
      const next: Saved = await response.json();
      next.configuration = readConfiguration(JSON.stringify(next.configuration));
      setSaved(next); setDraft(next.configuration.houseTemperature);
      setMessage(t('Einstellungen gespeichert.'));
      window.dispatchEvent(new Event('cockpit-temperature-changed'));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="panel settings-panel" onSubmit={e => { e.preventDefault(); void act(true); }}>
    <SettingsHeader title={t('Temperaturdaten')} description={t('Haustemperatur per MQTT')} />
    <div className="settings-panel-body">
      {error && <p role="alert" className="warning">{error}</p>}
      {message && <p role="status">{message}</p>}
      {draft && <>
        <label className="settings-confirm"><Input type="checkbox" checked={draft.enabled} disabled={!editable || busy} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} /><span>{t('MQTT-Haustemperatur verwenden')}</span></label>
        <label className="settings-field"><span>{t('MQTT-Topic')}</span><Input disabled={!editable || !draft.enabled || busy} required={draft.enabled} maxLength={200} value={draft.input.topic} onChange={e => setDraft({ ...draft, input: { ...draft.input, topic: e.target.value } })} /></label>
        <label className="settings-field"><span>{t('Payload-Pfad')}</span><Input disabled={!editable || !draft.enabled || busy} maxLength={256} placeholder="$.temperature" value={draft.input.payloadPath} onChange={e => setDraft({ ...draft, input: { ...draft.input, payloadPath: e.target.value } })} /></label>
        <p className="settings-help">{t('Temperatur in °C über den konfigurierten MQTT-Broker. Payload-Pfad leer: direkte Zahl, sonst z. B. $.temperature. Keine MQTT-Platzhalter.')}</p>
        <p className="settings-help">{t('Ersetzt nach dem Speichern die Innentemperatur im Anlagenmodell, im Temperaturverlauf und auf der Übersicht. Fehlende MQTT-Werte werden als - angezeigt. Veraltete Temperaturen bleiben sichtbar.')}</p>
      </>}
    </div>
    <SettingsFooter dirty={!!saved && !!draft && JSON.stringify(saved.configuration.houseTemperature) !== JSON.stringify(draft)} busy={busy} disabled={!editable || !draft} onDiscard={() => void act(false)} saveLabel={t('Einstellungen speichern')} />
  </form>;
}
