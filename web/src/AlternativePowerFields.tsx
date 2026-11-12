import { Input } from './components/ui/input';
import { t } from './i18n/core';
import { SettingsToggle } from './SettingsUi';

type PowerInput = { topic: string; payloadPath: string };
export type AlternativePowerOptions = { enabled: boolean; heatpump: PowerInput | null; heater: PowerInput | null };

export function AlternativePowerFields({ value, disabled, onChange }: {
  value: AlternativePowerOptions;
  disabled: boolean;
  onChange: (value: AlternativePowerOptions) => void;
}) {
  return <fieldset disabled={disabled} className="settings-power-fields">
    <legend className="settings-sr-only">{t('Alternative Leistungsdaten')}</legend>
    <SettingsToggle label={t('Alternative Leistungsdaten verwenden')} checked={value.enabled} onChange={e => onChange({ ...value, enabled: e.target.checked })} />
    <p className="field-note">{t('Das Diagramm „COP · Heizen und Warmwasser“ und der Tagesverbrauch verwenden die Summe dieser Leistungen. Die COP-Kachel bleibt unverändert. Beide Messwerte werden in Watt erwartet und verwenden den konfigurierten MQTT-Broker.')}</p>
    {(['heatpump', 'heater'] as const).map(key => {
      const input = value[key] ?? { topic: '', payloadPath: '' };
      const update = (next: PowerInput) => onChange({ ...value, [key]: next });
      return <fieldset key={key} disabled={!value.enabled}>
        <legend>{t(key === 'heatpump' ? 'Wärmepumpe elektrisch' : 'Heizstab elektrisch')}</legend>
        <div className="field-row">
          <label className="settings-field">{t('MQTT-Topic')}<Input required={value.enabled} maxLength={200} value={input.topic} onChange={e => update({ ...input, topic: e.target.value })} /></label>
          <label className="settings-field">{t('Payload-Pfad')}<Input maxLength={256} placeholder={key === 'heatpump' ? '$.params["em:0"].c_act_power' : '$.params["em:0"].a_act_power'} value={input.payloadPath} onChange={e => update({ ...input, payloadPath: e.target.value })} /></label>
        </div>
      </fieldset>;
    })}
    <details><summary>{t('Hinweise zu JSON-Pfaden und Auswertung')}</summary>
    <p className="field-note">{t('JSON-Pfad: $.power, $.meters[0].power oder $.params["em:0"].c_act_power. Leer: Die Nachricht enthält direkt eine Zahl. Keine MQTT-Platzhalter. Fehlende oder veraltete Messwerte ergeben keinen COP.')}</p>
    <p className="field-note">{t('Shelly-Beispiel: Beide Topics waermepumpe/events/rpc; Wärmepumpe Kanal C: $.params["em:0"].c_act_power; Heizstab Kanal A: $.params["em:0"].a_act_power. Änderungen gelten nach dem Speichern ohne Neustart.')}</p>
    </details>
  </fieldset>;
}
