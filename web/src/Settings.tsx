import { AlternativePowerFields, type AlternativePowerOptions } from './AlternativePowerFields';
import { settingsText as st } from './i18n/settings';
import { t, text as localizeText, getLocale } from "./i18n/core";
import { useLanguage } from "./i18n/Language";
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { sessionFetch } from './Access';
import { useEffect, useState } from 'react';
import { StorageNotice } from './History';
type Values = {
  plantName: string;
  retentionDays: number;
  revision: number;
  alternativePower: AlternativePowerOptions;
};
type Config = {
  values: Values;
  enabled: boolean;
  source: string;
  sampleSeconds: number;
  activeRetentionDays: number;
  restartRequired: boolean;
};
type Session = {
  loginRequired?: boolean;
  authenticated: boolean;
  role: string | null;
  username: string | null;
  csrfToken: string;
};
type UserAccount = { username: string; role: string; disabled: boolean; version: number };
type MqttConfig = { host: string; port: number; prefix: string; useTls: boolean | null; credentialsConfigured: boolean; revision: number };

function MqttEditor({ csrfToken }: { csrfToken: string }) {
  const [config, setConfig] = useState<MqttConfig | null>(null);
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
    setConfig(await response.json());
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
  return <section className="panel"><h2>{st("MQTT broker")}</h2>
    <p>{st("Changes reconnect the read connection. Broker settings cannot be changed while real-device control is enabled.")}</p>
    {locked && <p role="status">{st(lockMessage)}</p>}
    {status && <p role="status">{st(status)}</p>}
    {config && <form onSubmit={e => { e.preventDefault(); if (locked || busy) return; setBusy(true); setStatus(''); void (async () => {
      try {
        const response = await sessionFetch('/api/v1/settings/mqtt', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
          body: JSON.stringify({ ...config, useTls: config.useTls === true, credentialAction: action, username: action === 'replace' ? username : null, password: action === 'replace' ? password : null }) });
        if (!response.ok) { const error = await response.json().catch(() => ({})); if (error.errorCode === 'mqtt_control_active') await loadControl(); throw new Error(error.errorCode === 'mqtt_control_active' ? 'Disable real-device control and restart before changing the broker.' : error.errorCode === 'mqtt_conflict' ? 'The broker settings changed. Reload before saving.' : 'Unable to save MQTT settings. Check the values.'); }
        setConfig(await response.json()); setUsername(''); setPassword(''); setAction('keep'); setStatus('MQTT settings saved.');
      } catch (error) { setStatus((error as Error).message); } finally { setBusy(false); }
    })(); }}>
      <fieldset className="mqtt-fields" disabled={busy || locked}>
      <label>{st("Broker host")}<Input required maxLength={253} value={config.host} onChange={e => setConfig({ ...config, host: e.target.value })} /></label>
      <label>{st("Broker port")}<Input required type="number" min={1} max={65535} value={config.port} onChange={e => setConfig({ ...config, port: Number(e.target.value) })} /></label>
      <label>{st("HeishaMon topic base")}<Input required maxLength={128} value={config.prefix} onChange={e => setConfig({ ...config, prefix: e.target.value })} /></label>
      <label><Input type="checkbox" checked={config.useTls === true} onChange={e => setConfig({ ...config, useTls: e.target.checked })} /> {st("Use TLS")}</label>
      <label>{st("Broker credentials")}<select value={action} onChange={e => { setAction(e.target.value); setUsername(''); setPassword(''); }}>
        <option value="keep">{st(config.credentialsConfigured ? 'Keep existing credentials' : 'No credentials')}</option><option value="replace">{st("Set new credentials")}</option><option value="clear">{st("Remove credentials")}</option>
      </select></label>
      {action === 'replace' && <><label>{st("Broker username")}<Input autoComplete="off" maxLength={256} required value={username} onChange={e => setUsername(e.target.value)} /></label>
        <label>{st("Broker password")}<Input type="password" autoComplete="new-password" maxLength={1024} required value={password} onChange={e => setPassword(e.target.value)} /></label></>}
      <Button>{st("Save broker settings")}</Button>
      </fieldset>
    </form>}
    <Button type="button" disabled={busy} onClick={() => void load().catch(e => setStatus(e.message))}>{st("Reload broker settings")}</Button>
  </section>;
}

type ControlConfig = { enabled: boolean; profile: string | null; revision: number; active: boolean; restartRequired: boolean; externalMode: boolean; brokerMatches: boolean; source: string; brokerHost: string | null; brokerPort: number | null; topicBase: string | null; credentialsConfigured: boolean };
function ControlEditor({ csrfToken }: { csrfToken: string }) {
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
  return <section className="panel"><h2>{st("Heat-pump control")}</h2>
    {config && <><p>{st('Current mode')}: {st(config.active ? 'control enabled' : 'read only')} · {st('source')}: {st(config.source)}</p>
      {config.source === 'mqtt' && <p>{st('Broker host')}: {config.brokerHost}:{config.brokerPort} · {st('HeishaMon topic base')}: {config.topicBase}</p>}
      {config.restartRequired && <p role="status">{st("The saved change takes effect only after the application is restarted. Until then the current mode remains active.")}</p>}
      {!config.brokerMatches && <p role="alert">{st("The broker configuration no longer matches the saved confirmation. Control remains disabled; review and confirm it again.")}</p>}
      {config.externalMode ? <p>{st("This control mode is managed by startup configuration and cannot be changed here.")}</p> : <form onSubmit={event => {
        event.preventDefault(); setBusy(true); setStatus(''); void (async () => {
          try {
            const response = await sessionFetch('/api/v1/settings/control', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken }, body: JSON.stringify({ enabled, profile: enabled ? profile : null, confirmProfile, confirmSharedCredentials: confirmCredentials, confirmNoOtherWriters: confirmWriters, revision: config.revision }) });
            if (!response.ok) { const data = await response.json().catch(() => ({})); throw Error(data.errorCode === 'control_conflict' ? 'Settings changed. Reload before saving.' : data.errorCode === 'control_command_pending' ? 'Wait until the previous command has finished before enabling control again.' : data.errorCode === 'control_confirmation_required' ? 'Select the supported profile and complete all required confirmations.' : 'Unable to save control settings.'); }
            const next: ControlConfig = await response.json(); setConfig(next); setEnabled(next.enabled); setProfile(next.profile ?? ''); setConfirmProfile(false); setConfirmCredentials(false); setConfirmWriters(false);
            setStatus('Control settings saved.'); window.dispatchEvent(new Event('cockpit-control-changed'));
          } catch (error) { setStatus((error as Error).message); } finally { setBusy(false); }
        })();
      }}>
        <label>{st("Control mode")}<select value={enabled ? 'enabled' : 'disabled'} onChange={event => { setEnabled(event.target.value === 'enabled'); setConfirmProfile(false); setConfirmCredentials(false); setConfirmWriters(false); }}><option value="disabled">{st("Read only")}</option><option value="enabled">{st("Enable control")}</option></select></label>
        {enabled && <><label>{st("Device profile")}<select value={profile} required onChange={event => setProfile(event.target.value)}><option value="">{st("Select a profile")}</option><option value="aquarea-l-wh-wdg">Panasonic WH-SDC0509L3E5 / WH-WDG05LE5</option></select></label>
          <label><Input type="checkbox" checked={confirmProfile} onChange={event => setConfirmProfile(event.target.checked)} required /> {st("I verified that the heat pump and installation match this profile.")}</label>
          <label><Input type="checkbox" checked={confirmWriters} onChange={event => setConfirmWriters(event.target.checked)} required /> {st("I checked other controllers and will avoid conflicting changes.")}</label>
          {config.source === 'mqtt' && <><p>{st('Control uses the configured broker credentials.')} {st(config.credentialsConfigured ? 'Credentials are configured.' : 'Configure broker credentials before enabling control.')}</p><label><Input type="checkbox" checked={confirmCredentials} onChange={event => setConfirmCredentials(event.target.checked)} required /> {st("I authorize using the configured broker account for control.")}</label></>}
          <p>{st("The profile is based on the specified indoor and outdoor units. Verify the installed HeishaMon firmware and each command before use. Sterilization settings are experimental; room targets below 20 °C need separate verification.")}</p>
          <p>{st("Activating this mode does not send a command. Each device change still requires a separate explicit confirmation.")}</p></>}
        <Button disabled={busy || enabled && config.source === 'mqtt' && !config.credentialsConfigured}>{st("Save control settings")}</Button>
        <Button type="button" disabled={busy} onClick={() => void load().catch(error => setStatus(error.message))}>{st("Reload control settings")}</Button>
      </form>}
    </>}{status && <p role="status">{st(status)}</p>}
  </section>;
}

function UserEditor({ user, busy, save }: { user: UserAccount; busy: boolean; save: (user: UserAccount, role: string, disabled: boolean, password: string) => void }) {
  const [role, setRole] = useState(user.role);
  const [disabled, setDisabled] = useState(user.disabled);
  const [password, setPassword] = useState('');
  return <form onSubmit={e => { e.preventDefault(); save(user, role, disabled, password); }}>
    <fieldset disabled={busy}><legend>{user.username}</legend>
      <label>{st('Role for')} {user.username}<select value={role} onChange={e => setRole(e.target.value)}><option value="reader">{st("Reader")}</option><option value="writer">{st("Reader + Writer")}</option><option value="admin">Admin</option></select></label>
      <label><Input type="checkbox" checked={disabled} onChange={e => setDisabled(e.target.checked)} /> {st('Disable')} {user.username}</label>
      <label>{st('New password for')} {user.username} {st('(leave empty to keep current password)')}<Input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <Button>{st('Save')} {user.username}</Button>
    </fieldset>
  </form>;
}
const errors: Record<string, string> = {
  settings_conflict: 'Einstellungen wurden inzwischen geändert. Bitte neu laden.',
  invalid_settings: 'Name: 1–80 Zeichen. Aufbewahrung: 1–700 ganze Tage.',
  retention_confirmation_required: 'Bitte das spätere Löschen älterer Daten ausdrücklich bestätigen.',
  settings_unavailable: 'Speichern fehlgeschlagen. Bisherige Einstellungen bleiben erhalten.',
  csrf_invalid: 'Sitzung abgelaufen. Bitte neu anmelden.',
  last_admin: 'The last active administrator cannot be disabled or demoted.',
  user_conflict: 'This account changed. Reload the user list before saving.',
  invalid_user: 'Use a valid role, username and password (12–128 characters).',
  user_exists: 'This username already exists.'
};
export function SettingsPanel({
  enabled,
  onSaved,
  openHistory
}: {
  enabled: boolean;
  onSaved: (name: string) => void;
  openHistory: () => void;
}) {
  const language = useLanguage();
  const [config, setConfig] = useState<Config | null>(null);
  const [draft, setDraft] = useState<Values | null>(null);
  const [days, setDays] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('reader');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function json(url: string, body?: unknown) {
    const response = await sessionFetch('/api/v1/' + url, body === undefined ? {
      cache: 'no-store'
    } : {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': session?.csrfToken ?? ''
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const p = await response.json().catch(() => ({}));
      throw Error(({ invalid_power_topic: t("Ungültiges MQTT-Topic. Ein exaktes Topic ohne Platzhalter ist erforderlich."), invalid_power_path: t("Ungültiger Payload-Pfad. Erlaubt sind JSON-Objektfelder und Arrayindizes."), invalid_power_settings: t("Ungültige alternative Leistungsdaten.") } as Record<string, string>)[p.errorCode] ?? errors[p.errorCode] ?? (response.status === 401 ? 'Anmeldung erforderlich oder Zugangsdaten ungültig.' : response.status === 403 ? 'Bedienerrechte erforderlich.' : 'Anfrage fehlgeschlagen.'));
    }
    return response.status === 204 ? null : response.json();
  }
  async function load() {
    const c: Config = await json('settings');
    setConfig(c);
    setDraft(c.values);
    setDays(String(c.values.retentionDays));
    setConfirmed(false);
    const current: Session = await json('auth/session');
    setSession(current);
    if (current.role === 'admin') setUsers(await json('users'));
  }
  useEffect(() => {
    void load().catch(e => setError(e.message));
  }, [enabled]);
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const operator = enabled && session?.role === 'admin';
  const reducing = !!config && Number(days) < Math.max(config.values.retentionDays, config.activeRetentionDays);
  return <div className="settings-content">
    {error && <p role="alert" className="warning">{localizeText(st(error))}</p>}{message && <p role="status">{localizeText(st(message))}</p>}
    {session?.role === 'admin' && <section className="panel"><h2>{st("User administration")}</h2>
      <p>{st("Saving an account signs out its active sessions. Saving your own account signs you out.")}</p>
      <Button type="button" disabled={busy} onClick={() => void act(load)}>{st("Reload users")}</Button>
      {users.map(user => <UserEditor key={`${user.username}:${user.version}`} user={user} busy={busy} save={(account, role, disabled, password) => void act(async () => {
        await json('users/' + encodeURIComponent(account.username), { role, disabled, password: password || null, expectedVersion: account.version });
        if (account.username === session.username) { window.dispatchEvent(new Event('cockpit-session-changed')); return; }
        await load(); setMessage('User updated.');
      })} />)}
      <form onSubmit={e => { e.preventDefault(); void act(async () => {
        await json('users', { username: newUsername, password: newPassword, role: newRole });
        setNewUsername(''); setNewPassword(''); setNewRole('reader'); await load(); setMessage('User created.');
      }); }}>
        <label>{st("Username")}<Input autoComplete="off" maxLength={64} value={newUsername} onChange={e => setNewUsername(e.target.value)} required /></label>
        <label>{st("Password")}<Input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></label>
        <label>{st("Role")}<select value={newRole} onChange={e => setNewRole(e.target.value)}><option value="reader">{st("Reader")}</option><option value="writer">{st("Reader + Writer")}</option><option value="admin">Admin</option></select></label>
        <Button disabled={busy}>{st("Create user")}</Button>
      </form>
    </section>}
    {session?.role === 'admin' && <MqttEditor csrfToken={session.csrfToken} />}
    {session?.role === 'admin' && <ControlEditor csrfToken={session.csrfToken} />}
    {enabled && !session?.loginRequired && <section className="panel"><h2>{t("Zugang")}</h2>{session?.authenticated ? <p>{t("Angemeldet: ")}{session.username} · {localizeText(session.role)} <Button disabled={busy} onClick={() => void act(async () => {
          await json('auth/logout', {});
          await load();
        })}>{t("Abmelden")}</Button></p> : <form onSubmit={e => {
        e.preventDefault();
        void act(async () => {
          await json('auth/login', {
            username,
            password
          });
          setPassword('');
          await load();
        });
      }}><div className="field-row"><label>{t("Benutzername")}<Input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required /></label><label>{t("Passwort")}<Input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label></div><Button disabled={busy || !session}>{t("Anmelden")}</Button></form>}</section>}
    {!enabled && <p>{t("Einstellungen sind lesend. Die lokale Administration kann den Einstellungszugang separat aktivieren.")}</p>}
    {draft && config && <form className="panel" onSubmit={e => {
      e.preventDefault();
      void act(async () => {
        const saved: Values = await json('settings', {
          ...draft,
          retentionDays: Number(days),
          confirmReduction: confirmed
        });
        onSaved(saved.plantName);
        window.dispatchEvent(new Event('cockpit-power-changed'));
        await load();
        setMessage('Einstellungen gespeichert. Eine geänderte Aufbewahrung gilt nach dem nächsten Cockpit-Neustart.');
      });
    }}><h2>{t("Anlage & Datenspeicherung")}</h2>
      <label>{t("Anlagenname")}<Input value={draft.plantName} maxLength={80} required disabled={!operator || busy} onChange={e => setDraft({
          ...draft,
          plantName: e.target.value
        })} /></label>
      <label>{t("Aufbewahrung in Tagen")}<Input type="number" min={1} max={700} step={1} required value={days} disabled={!operator || busy} onChange={e => {
          setDays(e.target.value);
          setConfirmed(false);
        }} /></label>
      <p>{t("Aktiv: ")}{localizeText(config.activeRetentionDays)}{t(" Tage · Messraster: ")}{localizeText(config.sampleSeconds)}{t(" Sekunden. Ein anderes Messraster benötigt eine neue Datenbank.")}</p>
      {config.restartRequired && <p role="status">{t("Geänderte Aufbewahrung gespeichert – Cockpit-Neustart ausstehend.")}</p>}
      {reducing && <label><Input type="checkbox" checked={confirmed} disabled={!operator || busy} onChange={e => setConfirmed(e.target.checked)} />{t(" Ich bestätige: Nach dem Neustart werden Messwerte und Ereignisse außerhalb der verkürzten Aufbewahrung gelöscht.")}</label>}
      <AlternativePowerFields value={draft.alternativePower ?? { enabled: false, heatpump: null, heater: null }} disabled={!operator || busy} onChange={alternativePower => setDraft({ ...draft, alternativePower })} />
      <div className="button-row"><Button type="button" disabled={busy} onClick={() => void act(load)}>{t("Neu laden / Verwerfen")}</Button><Button className="primary" disabled={!operator || busy || reducing && !confirmed}>{t("Einstellungen speichern")}</Button></div>
    </form>}
    <div className="two-column settings-grid">
      <section className="panel"><h2>{t("Verbindung")}</h2><p>{t("Datenquelle: ")}{config?.source === 'mqtt' ? localizeText('MQTT') : config?.source === 'simulator' ? localizeText('Simulator') : localizeText('Unbekannt')}</p></section>
      <section className="panel"><h2>{t("Daten & Sicherung")}</h2><StorageNotice /><Button onClick={openHistory}>{t("Verlauf / CSV-Export öffnen")}</Button></section>
      <section className="panel"><h2>{t("Zugriff & Sicherheit")}</h2><p>{t("Bediener-Anmeldung mit 30 Minuten Sitzungsdauer. Änderungen an Einstellungen benötigen Bedienerrechte.")}</p></section>
    </div>
  </div>;
}
