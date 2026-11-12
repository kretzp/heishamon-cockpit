import { AlternativePowerFields, type AlternativePowerOptions } from './AlternativePowerFields';
import { settingsText as st } from './i18n/settings';
import { t, text as localizeText, getLocale } from "./i18n/core";
import { useLanguage } from "./i18n/Language";
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { sessionFetch } from './Access';
import { useEffect, useState } from 'react';
import { StorageNotice } from './History';
import { Icon, type IconName } from './Icons';
import { SettingsToggle, SettingsHeader, SettingsFooter } from './SettingsUi';
import { MqttEditor, ControlEditor, UserEditor } from './SettingsEditors';
import './settings.css';
type Area = 'general' | 'relays' | 'power';

type Values = {
  plantName: string;
  retentionDays: number;
  revision: number;
  alternativePower: AlternativePowerOptions;
  enableRelaySwitching: boolean;
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
  const [section, setSection] = useState('general');
  const [areaBases, setAreaBases] = useState<Record<Area, Values> | null>(null);
  const [pendingConfirmed, setPendingConfirmed] = useState({ relays: false, power: false });
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
    setAreaBases({ general: c.values, relays: c.values, power: c.values });
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
  const emptyPower: AlternativePowerOptions = { enabled: false, heatpump: null, heater: null };
  const dirty = {
    general: !!draft && !!config && (draft.plantName !== config.values.plantName || Number(days) !== config.values.retentionDays),
    relays: !!draft && !!config && !!draft.enableRelaySwitching !== !!config.values.enableRelaySwitching,
    power: !!draft && !!config && JSON.stringify(draft.alternativePower ?? emptyPower) !== JSON.stringify(config.values.alternativePower ?? emptyPower)
  };
  const pendingReduction = !!config && config.values.retentionDays < config.activeRetentionDays;
  function fingerprint(area: Area, values: Values) {
    return JSON.stringify(area === 'general' ? [values.plantName, values.retentionDays] : area === 'relays' ? !!values.enableRelaySwitching : values.alternativePower ?? emptyPower);
  }
  function retentionConfirmation(area: 'relays' | 'power') {
    return pendingReduction && <div className="settings-callout settings-retention"><p>{t('Gespeicherte Aufbewahrung: {0} Tage. Die Verkürzung gilt nach dem Neustart.', [config!.values.retentionDays])}</p><label className="settings-confirm"><Input type="checkbox" required disabled={!operator || busy} checked={pendingConfirmed[area]} onChange={e => setPendingConfirmed(old => ({ ...old, [area]: e.target.checked }))} /><span>{t(' Ich bestätige: Nach dem Neustart werden Messwerte und Ereignisse außerhalb der verkürzten Aufbewahrung gelöscht.')}</span></label></div>;
  }
  function applyArea(area: Area, values: Values) {
    setAreaBases(old => old ? { ...old, [area]: values } : { general: values, relays: values, power: values });
    setPendingConfirmed({ relays: false, power: false });
    setDraft(old => old ? { ...old, ...(area === 'general' ? { plantName: values.plantName, retentionDays: values.retentionDays }
      : area === 'relays' ? { enableRelaySwitching: values.enableRelaySwitching }
      : { alternativePower: values.alternativePower }), revision: values.revision } : values);
    if (area === 'general') { setDays(String(values.retentionDays)); setConfirmed(false); }
  }
  async function discard(area: Area) {
    const next: Config = await json('settings');
    setConfig(next); applyArea(area, next.values);
  }
  async function save(area: Area) {
    if (!config || !draft || !operator || !areaBases) return;
    if (fingerprint(area, areaBases[area]) !== fingerprint(area, config.values)) throw Error(errors.settings_conflict);
    const values = { ...config.values, ...(area === 'general' ? { plantName: draft.plantName, retentionDays: Number(days) }
      : area === 'relays' ? { enableRelaySwitching: draft.enableRelaySwitching ?? false }
      : { alternativePower: draft.alternativePower ?? emptyPower }) };
    const saved: Values = await json('settings', { ...values, confirmReduction: area === 'general' ? confirmed : pendingConfirmed[area] });
    setConfig({ ...config, values: saved, restartRequired: saved.retentionDays !== config.activeRetentionDays });
    applyArea(area, saved); onSaved(saved.plantName);
    window.dispatchEvent(new Event('cockpit-power-changed'));
    setMessage('Einstellungen gespeichert. Eine geänderte Aufbewahrung gilt nach dem nächsten Cockpit-Neustart.');
  }
  const sections: { id: string; label: string; icon: IconName }[] = [
    { id: 'general', label: 'Anlage & Daten', icon: 'sliders' },
    ...(session?.role === 'admin' ? [{ id: 'mqtt', label: 'MQTT-Verbindung', icon: 'cloud' as IconName }] : []),
    { id: 'control', label: 'Steuerung & Relais', icon: 'valve' },
    { id: 'power', label: 'Leistungsdaten', icon: 'flow' },
    ...(session?.role === 'admin' || enabled && !session?.loginRequired ? [{ id: 'users', label: 'Benutzer & Zugriff', icon: 'lock' as IconName }] : [])
  ];
  const activeSection = sections.some(item => item.id === section) ? section : 'general';
  return <div className="settings-content settings-redesign">
    <p className="settings-intro">{t('Anlage, Verbindungen und Zugriffsrechte übersichtlich verwalten.')}</p>
    <div className="settings-layout">
      <div className="settings-tabs" role="tablist" aria-label={t('Einstellungsbereiche')}>
        {sections.map((item, index) => <Button type="button" variant="ghost" role="tab" key={item.id} id={'settings-tab-' + item.id} aria-controls={'settings-' + item.id} aria-selected={activeSection === item.id} onClick={() => { setSection(item.id); setError(''); setMessage(''); }} onKeyDown={event => {
          let next: number | undefined;
          if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (index + 1) % sections.length;
          else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (index + sections.length - 1) % sections.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = sections.length - 1;
          if (next !== undefined) { event.preventDefault(); setSection(sections[next].id); document.getElementById('settings-tab-' + sections[next].id)?.focus(); }
        }}><Icon name={item.icon} />{t(item.label)}</Button>)}
      </div>
      <div className="settings-main">
        {error && <p role="alert" className="warning">{localizeText(st(error))}</p>}
        {message && <p role="status" className="settings-feedback">{localizeText(st(message))}</p>}
        {!enabled && <p className="settings-help">{t('Einstellungen sind lesend. Die lokale Administration kann den Einstellungszugang separat aktivieren.')}</p>}
        <section id="settings-general" role="tabpanel" aria-labelledby="settings-tab-general" hidden={activeSection !== 'general'}>
          {draft && config && <form className="panel settings-panel" onSubmit={e => { e.preventDefault(); void act(() => save('general')); }}>
            <SettingsHeader title={t('Anlage & Datenspeicherung')} description={t('Die Grundlagen deiner Installation und ihrer Aufzeichnung.')} />
            <div className="settings-panel-body">
              <label className="settings-field"><span>{t('Anlagenname')}</span><Input aria-label={t('Anlagenname')} value={draft.plantName} maxLength={80} required disabled={!operator || busy} onChange={e => setDraft({ ...draft, plantName: e.target.value })} /><small>{t('Wird in der Navigation angezeigt.')}</small></label>
              <hr />
              <div className="settings-field-grid">
                <label className="settings-field"><span>{t('Aufbewahrung in Tagen')}</span><Input aria-label={t('Aufbewahrung in Tagen')} type="number" min={1} max={700} step={1} required value={days} disabled={!operator || busy} onChange={e => { setDays(e.target.value); setConfirmed(false); }} /><small>{t('Eine Änderung gilt nach dem nächsten Neustart.')}</small></label>
                <label className="settings-field"><span>{t('Aufzeichnungsintervall in Sekunden')}</span><Input aria-label={t('Aufzeichnungsintervall in Sekunden')} value={config.sampleSeconds} disabled /><small>{t('Für diese Datenbank festgelegt.')}</small></label>
              </div>
              <p className="settings-help">{t('Aktiv: ')}{config.activeRetentionDays}{t(' Tage · Messraster: ')}{config.sampleSeconds}{t(' Sekunden. Ein anderes Messraster benötigt eine neue Datenbank.')}</p>
              {config.restartRequired && <p role="status" className="settings-callout">{t('Geänderte Aufbewahrung gespeichert – Cockpit-Neustart ausstehend.')}</p>}
              {reducing && <label className="settings-confirm settings-callout"><Input type="checkbox" checked={confirmed} disabled={!operator || busy} required onChange={e => setConfirmed(e.target.checked)} /><span>{t(' Ich bestätige: Nach dem Neustart werden Messwerte und Ereignisse außerhalb der verkürzten Aufbewahrung gelöscht.')}</span></label>}
            </div>
            <SettingsFooter dirty={dirty.general} busy={busy} disabled={!operator || reducing && !confirmed} onDiscard={() => void act(() => discard('general'))} discardLabel={t('Neu laden / Verwerfen')} saveLabel={t('Einstellungen speichern')} />
          </form>}
          <section className="panel settings-storage"><h2>{t('Daten & Sicherung')}</h2><StorageNotice /><Button onClick={openHistory}>{t('Verlauf / CSV-Export öffnen')}</Button></section>
        </section>
        {session?.role === 'admin' && <section id="settings-mqtt" role="tabpanel" aria-labelledby="settings-tab-mqtt" hidden={activeSection !== 'mqtt'}><MqttEditor csrfToken={session.csrfToken} /></section>}
        <section id="settings-control" role="tabpanel" aria-labelledby="settings-tab-control" hidden={activeSection !== 'control'}>
          {session?.role === 'admin' && <ControlEditor csrfToken={session.csrfToken} />}
          {draft && config && <form className="panel settings-panel" onSubmit={e => { e.preventDefault(); void act(() => save('relays')); }}>
            <SettingsHeader title={t('Relais')} description={t('Zusätzliche Schalter in der Anlagenübersicht.')} />
            <div className="settings-panel-body"><SettingsToggle label={t('Relaisschaltung aktivieren')} description={t('Zeigt Relais 1 und 2 mit Toggle und Ein/Aus-Verlauf.')} checked={draft.enableRelaySwitching ?? false} disabled={!operator || busy} onChange={e => setDraft({ ...draft, enableRelaySwitching: e.target.checked })} /><p className="settings-help">{t('Zum Schalten sind eine aktive Steuerungsfreigabe und Schreibrechte nötig. Speichern verändert keinen Relaiszustand.')}</p>{retentionConfirmation('relays')}</div>
            <SettingsFooter dirty={dirty.relays} busy={busy} disabled={!operator || pendingReduction && !pendingConfirmed.relays} onDiscard={() => void act(() => discard('relays'))} saveLabel={t('Relais-Einstellung speichern')} />
          </form>}
        </section>
        <section id="settings-power" role="tabpanel" aria-labelledby="settings-tab-power" hidden={activeSection !== 'power'}>
          {draft && config && <form className="panel settings-panel" onSubmit={e => { e.preventDefault(); void act(() => save('power')); }}>
            <SettingsHeader title={t('Alternative Leistungsdaten')} description={t('Externe Strommessung für COP-Verlauf und Tagesverbrauch.')} />
            <div className="settings-panel-body"><AlternativePowerFields value={draft.alternativePower ?? emptyPower} disabled={!operator || busy} onChange={alternativePower => setDraft({ ...draft, alternativePower })} />{retentionConfirmation('power')}</div>
            <SettingsFooter dirty={dirty.power} busy={busy} disabled={!operator || pendingReduction && !pendingConfirmed.power} onDiscard={() => void act(() => discard('power'))} saveLabel={t('Leistungsdaten speichern')} />
          </form>}
        </section>
        <section id="settings-users" role="tabpanel" aria-labelledby="settings-tab-users" hidden={activeSection !== 'users'}>
          {session?.role === 'admin' && <section className="panel settings-panel">
            <SettingsHeader title={st('User administration')} description={st('Saving an account signs out its active sessions. Saving your own account signs you out.')} />
            <div className="settings-panel-body">
              <div><Button type="button" disabled={busy} onClick={() => void act(async () => setUsers(await json('users')))}>{st('Reload users')}</Button></div>
              {users.map(user => <UserEditor key={`${user.username}:${user.version}`} user={user} busy={busy} save={(account, role, disabled, password) => void act(async () => {
                await json('users/' + encodeURIComponent(account.username), { role, disabled, password: password || null, expectedVersion: account.version });
                if (account.username === session.username) { window.dispatchEvent(new Event('cockpit-session-changed')); return; }
                setUsers(await json('users')); setMessage('User updated.');
              })} />)}
              <details className="settings-new-user"><summary>{st('Create user')}</summary><form onSubmit={e => { e.preventDefault(); void act(async () => {
                await json('users', { username: newUsername, password: newPassword, role: newRole });
                setNewUsername(''); setNewPassword(''); setNewRole('reader'); setUsers(await json('users')); setMessage('User created.');
              }); }}>
                <div className="settings-field-grid"><label className="settings-field">{st('Username')}<Input autoComplete="off" maxLength={64} value={newUsername} onChange={e => setNewUsername(e.target.value)} required /></label><label className="settings-field">{st('Role')}<select value={newRole} onChange={e => setNewRole(e.target.value)}><option value="reader">{st('Reader')}</option><option value="writer">{st('Reader + Writer')}</option><option value="admin">Admin</option></select></label></div>
                <label className="settings-field">{st('Password')}<Input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)} required /><small>{t('12 bis 128 Zeichen.')}</small></label><Button className="primary" disabled={busy}>{st('Create user')}</Button>
              </form></details>
            </div>
          </section>}
          {enabled && !session?.loginRequired && <section className="panel settings-panel"><SettingsHeader title={t('Zugang')} /><div className="settings-panel-body">{session?.authenticated ? <p>{t('Angemeldet: ')}{session.username} · {localizeText(session.role)} <Button disabled={busy} onClick={() => void act(async () => { await json('auth/logout', {}); await load(); })}>{t('Abmelden')}</Button></p> : <form onSubmit={e => { e.preventDefault(); void act(async () => { await json('auth/login', { username, password }); setPassword(''); await load(); }); }}><div className="settings-field-grid"><label className="settings-field">{t('Benutzername')}<Input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required /></label><label className="settings-field">{t('Passwort')}<Input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label></div><Button disabled={busy || !session}>{t('Anmelden')}</Button></form>}</div></section>}
          <section className="panel settings-storage"><h2>{t('Zugriff & Sicherheit')}</h2><p className="settings-help">{t('Bediener-Anmeldung mit 30 Minuten Sitzungsdauer. Änderungen an Einstellungen benötigen Bedienerrechte.')}</p></section>
        </section>
      </div>
    </div>
  </div>;
}
