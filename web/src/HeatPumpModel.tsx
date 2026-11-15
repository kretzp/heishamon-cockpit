import { settingsText as st } from './i18n/settings';

export type HeatPumpModel = { rawIdentifier: string | null; displayName: string | null; known: boolean };

export function DeviceProfile({ model }: { model?: HeatPumpModel }) {
  return <div className="settings-field">
    <span id="device-profile-label">{st('Device profile')}</span>
    <output aria-labelledby="device-profile-label" className="settings-model" aria-live="polite">{model?.displayName ?? st('Waiting for the heat-pump model.')}</output>
    {model?.known && <small>{model.rawIdentifier}</small>}
  </div>;
}
