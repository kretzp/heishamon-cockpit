import { settingsText as st } from './i18n/settings';
import { t } from './i18n/core';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { sessionFetch } from './Access';
import { useEffect, useState } from 'react';
import { SettingsToggle, SettingsHeader, SettingsFooter } from './SettingsUi';
export type UserAccount = { username: string; role: string; disabled: boolean; version: number };
type MqttConfig = { host: string; port: number; prefix: string; useTls: boolean | null; credentialsConfigured: boolean; revision: number };

export function MqttEditor({ csrfToken }: { csrfToken: string }) {
  const [config, setConfig] = useState<MqttConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<MqttConfig | null>(null);
  const [action, setAction] = useState('keep');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [control, setControl] = useState<ControlConfig | null>(null);
  async function loadControl() {
    try {
      const response = await sessionFetch('/api/v1/settings/control', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load control settings.');
      setControl(await response.json());
    } catch (error) { setControl(null); throw error; }
  }
  async function load() {
    await loadControl();
    const response = await sessionFetch('/api/v1/settings/mqtt', { cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load MQTT settings.');
    const next: MqttConfig = await response.json();
    setConfig(next); setSavedConfig(next); setAction('keep'); setUsername(''); setPassword('');
  }
  useEffect(() => {
    void load().catch(e => setStatus(e.message));
    const refreshControl = () => { void loadControl().catch(e => setStatus(e.message)); };
    window.addEventListener('cockpit-control-changed', refreshControl);
    window.addEventListener('focus', refreshControl);
    return () => {
      window.removeEventListener('cockpit-control-changed', refreshControl);
      window.removeEventListener('focus', refreshControl);
    };
  }, []);
  const locked = control === null || control.source === 'mqtt' && (control.enabled || control.externalMode);
  const lockMessage = control === null
    ? 'MQTT changes are unavailable until control settings can be loaded. Reload broker settings to try again.'
    : control.externalMode
      ? 'MQTT changes are locked by startup configuration. Disable device control in the startup configuration, restart the application, then reload broker settings.'
      : 'MQTT changes are locked while heat-pump control is enabled. Select Read only under Heat-pump control and save control settings. Then you can edit the broker and credentials.';
  const dirty = config !== null && (JSON.stringify(config) !== JSON.stringify(savedConfig) || action !== 'keep');
  return <section className="panel settings-panel">
    <SettingsHeader title={st('MQTT broker')} description={st('Changes reconnect the read connection. Broker settings cannot be changed while real-device control is enabled.')} />
    {locked && <p role="status" className="settings-callout settings-panel-notice">{st(lockMessage)}</p>}
    {status && <p role="status" className="settings-feedback settings-panel-notice">{st(status)}</p>}
    {!config && <div className="settings-panel-body"><Button type="button" onClick={() => void load().catch(e => setStatus(e.message))}>{st('Reload broker settings')}</Button></div>}
    {config && <form onSubmit={e => { e.preventDefault(); if (locked || busy) return; setBusy(true); setStatus(''); void (async () => {
      try {
        const response = await sessionFetch('/api/v1/settings/mqtt', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
          body: JSON.stringify({ ...config, useTls: config.useTls === true, credentialAction: action, username: action === 'replace' ? username : null, password: action === 'replace' ? password : null }) });
        if (!response.ok) { const error = await response.json().catch(() => ({})); if (error.errorCode === 'mqtt_control_active') await loadControl(); throw new Error(error.errorCode === 'mqtt_control_active' ? 'Disable real-device control and restart before changing the broker.' : error.errorCode === 'mqtt_conflict' ? 'The broker settings changed. Reload before saving.' : 'Unable to save MQTT settings. Check the values.'); }
        const next: MqttConfig = await response.json();
        setConfig(next); setSavedConfig(next); setAction('keep'); setUsername(''); setPassword(''); setStatus('MQTT settings saved.');
      } catch (error) { setStatus((error as Error).message); } finally { setBusy(false); }
    })(); }}>

      <fieldset className="mqtt-fields settings-panel-body" disabled={busy || locked}>
        <div className="settings-field-grid settings-broker-address"><label className="settings-field">{st('Broker host')}<Input aria-label={st('Broker host')} required maxLength={253} value={config.host} onChange={e => setConfig({ ...config, host: e.target.value })} /><small>{t('Hostname oder IP, ohne http://.')}</small></label>
          <label className="settings-field">{st('Broker port')}<Input required type="number" min={1} max={65535} value={config.port} onChange={e => setConfig({ ...config, port: Number(e.target.value) })} /></label></div>
        <label className="settings-field">{st('HeishaMon topic base')}<Input aria-label={st('HeishaMon topic base')} required maxLength={128} value={config.prefix} onChange={e => setConfig({ ...config, prefix: e.target.value })} /><small>{t('Gemeinsamer Beginn der HeishaMon-Topics.')}</small></label>
        <SettingsToggle label={st('Use TLS')} description={t('Nur aktivieren, wenn dein Broker TLS unterstützt.')} checked={config.useTls === true} onChange={e => setConfig({ ...config, useTls: e.target.checked })} />
        <hr />
        <label className="settings-field">{st('Broker credentials')}<select aria-label={st('Broker credentials')} value={action} onChange={e => { setAction(e.target.value); setUsername(''); setPassword(''); }}>
          <option value="keep">{st(config.credentialsConfigured ? 'Keep existing credentials' : 'No credentials')}</option><option value="replace">{st('Set new credentials')}</option><option value="clear">{st('Remove credentials')}</option>
        </select><small>{t('Gespeicherte Passwörter werden nicht angezeigt.')}</small></label>
        {action === 'replace' && <div className="settings-field-grid"><label className="settings-field">{st('Broker username')}<Input autoComplete="off" maxLength={256} required value={username} onChange={e => setUsername(e.target.value)} /></label><label className="settings-field">{st('Broker password')}<Input type="password" autoComplete="new-password" maxLength={1024} required value={password} onChange={e => setPassword(e.target.value)} /></label></div>}
      </fieldset>
      <SettingsFooter dirty={dirty} busy={busy} disabled={locked} onDiscard={() => void load().catch(e => setStatus(e.message))} discardLabel={st('Reload broker settings')} saveLabel={st('Save broker settings')} />
    </form>}
  </section>;
}

type ControlConfig = { enabled: boolean; profile: string | null; revision: number; active: boolean; restartRequired: boolean; externalMode: boolean; brokerMatches: boolean; source: string; brokerHost: string | null; brokerPort: number | null; topicBase: string | null; credentialsConfigured: boolean };
export function ControlEditor({ csrfToken }: { csrfToken: string }) {
  const [config, setConfig] = useState<ControlConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [profile, setProfile] = useState('');
  const [confirmProfile, setConfirmProfile] = useState(false);
  const [confirmCredentials, setConfirmCredentials] = useState(false);
  const [confirmWriters, setConfirmWriters] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  async function load() {
    const response = await sessionFetch('/api/v1/settings/control', { cache: 'no-store' });
    if (!response.ok) throw Error('Unable to load control settings.');
    const next: ControlConfig = await response.json(); setConfig(next); setEnabled(next.enabled); setProfile(next.profile ?? '');
    setConfirmProfile(false); setConfirmCredentials(false); setConfirmWriters(false);
  }
  useEffect(() => { void load().catch(error => setStatus(error.message)); }, []);
  const dirty = config !== null && (enabled !== config.enabled || enabled && profile !== (config.profile ?? '') || confirmProfile || confirmCredentials || confirmWriters);
  function selectMode(next: boolean) { setEnabled(next); setConfirmProfile(false); setConfirmCredentials(false); setConfirmWriters(false); }
  return <section className="panel settings-panel">
    <SettingsHeader title={st('Heat-pump control')} description={t('Lege fest, ob Cockpit die Anlage nur liest oder auch steuern darf.')} />
    {config && <>
      <div className="settings-panel-notice settings-help">{st('Current mode')}: <strong>{st(config.active ? 'control enabled' : 'read only')}</strong> · {st('source')}: {st(config.source)}{config.source === 'mqtt' && <p>{st('Broker host')}: {config.brokerHost}:{config.brokerPort} · {st('HeishaMon topic base')}: {config.topicBase}</p>}</div>
      {config.restartRequired && <p role="status" className="settings-callout settings-panel-notice">{st('The saved change takes effect only after the application is restarted. Until then the current mode remains active.')}</p>}
      {!config.brokerMatches && <p role="alert" className="settings-callout settings-panel-notice">{st('The broker configuration no longer matches the saved confirmation. Control remains disabled; review and confirm it again.')}</p>}
      {config.externalMode ? <p className="settings-callout settings-panel-notice">{st('This control mode is managed by startup configuration and cannot be changed here.')}</p> : <form onSubmit={event => {
        event.preventDefault(); if (busy) return; setBusy(true); setStatus(''); void (async () => {
          try {
            const response = await sessionFetch('/api/v1/settings/control', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken }, body: JSON.stringify({ enabled, profile: enabled ? profile : null, confirmProfile, confirmSharedCredentials: confirmCredentials, confirmNoOtherWriters: confirmWriters, revision: config.revision }) });
            if (!response.ok) { const data = await response.json().catch(() => ({})); throw Error(data.errorCode === 'control_conflict' ? 'Settings changed. Reload before saving.' : data.errorCode === 'control_command_pending' ? 'Wait until the previous command has finished before enabling control again.' : data.errorCode === 'control_confirmation_required' ? 'Select the supported profile and complete all required confirmations.' : 'Unable to save control settings.'); }
            const next: ControlConfig = await response.json(); setConfig(next); setEnabled(next.enabled); setProfile(next.profile ?? ''); setConfirmProfile(false); setConfirmCredentials(false); setConfirmWriters(false);
            setStatus('Control settings saved.'); window.dispatchEvent(new Event('cockpit-control-changed'));
          } catch (error) { setStatus((error as Error).message); } finally { setBusy(false); }
        })();
      }}>

        <fieldset className="settings-panel-body" disabled={busy}>
          <fieldset className="settings-mode"><legend>{st('Control mode')}</legend><div className="settings-mode-options">
            <label><Input type="radio" name="settings-control-mode" checked={!enabled} onChange={() => selectMode(false)} /><span><strong>{st('Read only')}</strong><small>{t('Messwerte und Historie ansehen.')}</small></span></label>
            <label><Input type="radio" name="settings-control-mode" checked={enabled} onChange={() => selectMode(true)} /><span><strong>{st('Enable control')}</strong><small>{t('Befehle für berechtigte Konten.')}</small></span></label>
          </div></fieldset>
          {enabled && <>
            <label className="settings-field">{st('Device profile')}<select value={profile} required onChange={event => setProfile(event.target.value)}><option value="">{st('Select a profile')}</option><option value="aquarea-l-wh-wdg">Panasonic WH-SDC0509L3E5 / WH-WDG05LE5</option></select></label>
            <div className="settings-confirmations">
              <label className="settings-confirm"><Input type="checkbox" checked={confirmProfile} onChange={event => setConfirmProfile(event.target.checked)} required /><span>{st('I verified that the heat pump and installation match this profile.')}</span></label>
              <label className="settings-confirm"><Input type="checkbox" checked={confirmWriters} onChange={event => setConfirmWriters(event.target.checked)} required /><span>{st('I checked other controllers and will avoid conflicting changes.')}</span></label>
              {config.source === 'mqtt' && <><p className="settings-help">{st('Control uses the configured broker credentials.')} {st(config.credentialsConfigured ? 'Credentials are configured.' : 'Configure broker credentials before enabling control.')}</p><label className="settings-confirm"><Input type="checkbox" checked={confirmCredentials} onChange={event => setConfirmCredentials(event.target.checked)} required /><span>{st('I authorize using the configured broker account for control.')}</span></label></>}
            </div>
            <details><summary>{t('Hinweise zum Geräteprofil')}</summary><p className="settings-help">{st('The profile is based on the specified indoor and outdoor units. Verify the installed HeishaMon firmware and each command before use. Sterilization settings are experimental; room targets below 20 °C need separate verification.')}</p></details>
            <p className="settings-help">{t('Die Freigabe allein sendet keinen Anlagenbefehl. Relais-Toggles senden direkt; Wärmepumpenbefehle benötigen eine zusätzliche Bestätigung.')}</p>
          </>}
        </fieldset>
        <SettingsFooter dirty={dirty} busy={busy} disabled={enabled && config.source === 'mqtt' && !config.credentialsConfigured} onDiscard={() => void load().catch(error => setStatus(error.message))} discardLabel={st('Reload control settings')} saveLabel={st('Save control settings')} />
      </form>}
    </>}
    {status && <p role="status" className="settings-feedback settings-panel-notice">{st(status)}</p>}
  </section>;
}

export function UserEditor({ user, busy, save }: { user: UserAccount; busy: boolean; save: (user: UserAccount, role: string, disabled: boolean, password: string) => void }) {
  const [role, setRole] = useState(user.role);
  const [disabled, setDisabled] = useState(user.disabled);
  const [password, setPassword] = useState('');
  return <details className="settings-user"><summary><span className="settings-avatar" aria-hidden="true">{user.username.slice(0, 2).toUpperCase()}</span><span><strong>{user.username}</strong><small>{st(user.role === 'reader' ? 'Reader' : user.role === 'writer' ? 'Reader + Writer' : 'Administrator')} · {t(user.disabled ? 'Deaktiviert' : 'Aktiv')}</small></span><span className="settings-edit-label">{t('Bearbeiten')}</span></summary><form onSubmit={e => { e.preventDefault(); save(user, role, disabled, password); }}>
    <fieldset disabled={busy}><legend>{user.username}</legend>
      <label>{st('Role for')} {user.username}<select value={role} onChange={e => setRole(e.target.value)}><option value="reader">{st("Reader")}</option><option value="writer">{st("Reader + Writer")}</option><option value="admin">Admin</option></select></label>
      <SettingsToggle label={t('Konto aktiv')} description={t('Deaktivierte Konten können sich nicht anmelden.')} checked={!disabled} onChange={e => setDisabled(!e.target.checked)} />
      <label>{st('New password for')} {user.username} {st('(leave empty to keep current password)')}<Input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <Button>{st('Save')} {user.username}</Button>
    </fieldset>
  </form></details>;
}
