import { LanguagePicker } from './i18n/Language';
import { Brand } from './Brand';
import { t, text as localizeText, getLocale } from "./i18n/core";
import { useLanguage } from "./i18n/Language";
import { ThemePicker } from './Theme';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Icon } from './Icons';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import './access.css';
type Session = {
  loginRequired: boolean;
  authenticated: boolean;
  username?: string;
  role?: string;
  csrfToken?: string;
};
const sessionChanged = 'cockpit-session-changed';
const AccountMenuContext = createContext<ReactNode>(null);
export function AccountMenu() {
  return useContext(AccountMenuContext);
}
export async function sessionFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  if (response.status === 401 || String(input).endsWith('/auth/logout') && response.ok) window.dispatchEvent(new Event(sessionChanged));
  return response;
}
export function AccessGate({
  children
}: {
  children: ReactNode;
}) {
  const language = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const response = await fetch('/api/v1/auth/session', {
      cache: 'no-store'
    });
    if (!response.ok) throw Error('Anmeldedienst nicht erreichbar. Bitte erneut versuchen.');
    const next: Session = await response.json();
    setSession(next);
    return next;
  }
  useEffect(() => {
    let disposed = false;
    const check = async () => {
      try {
        const response = await fetch('/api/v1/auth/session', {
          cache: 'no-store'
        });
        if (!response.ok) throw Error();
        const next: Session = await response.json();
        if (!disposed) setSession(next);
      } catch {
        if (!disposed) {
          setSession(null);
          setError('Anmeldedienst nicht erreichbar. Bitte erneut versuchen.');
        }
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 10000);
    const changed = () => void check();
    window.addEventListener(sessionChanged, changed);
    window.addEventListener('focus', changed);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener(sessionChanged, changed);
      window.removeEventListener('focus', changed);
    };
  }, []);
  async function submit(login: boolean) {
    setBusy(true);
    setError('');
    try {
      const current = await refresh();
      const response = await fetch('/api/v1/auth/' + (login ? 'login' : 'logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': current.csrfToken ?? ''
        },
        body: JSON.stringify(login ? {
          username,
          password
        } : {})
      });
      if (!response.ok) throw Error(response.status === 401 ? 'Benutzername oder Passwort ist falsch.' : response.status === 429 ? 'Zu viele Anmeldeversuche. Bitte eine Minute warten.' : 'Anmeldung konnte nicht verarbeitet werden. Bitte erneut versuchen.');
      await refresh();
      window.dispatchEvent(new Event(sessionChanged));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPassword('');
      setBusy(false);
    }
  }
  if (!session || session.loginRequired && !session.authenticated) return <main className="access-page">
    <section className="panel access-card" aria-labelledby="access-title">
      <div className="appearance-controls"><LanguagePicker /><ThemePicker /></div>
      <Brand />
      <h1 id="access-title">{t("Anmelden")}</h1>
      <p>{t("Melde dich an, um deine Anlage zu sehen und zu bedienen.")}</p>
      {error && <p role="alert" className="warning">{localizeText(error)}</p>}
      {session ? <form onSubmit={e => {
        e.preventDefault();
        void submit(true);
      }}>
        <label>{t("Benutzername")}<Input autoFocus autoComplete="username" required maxLength={64} value={username} onChange={e => setUsername(e.target.value)} /></label>
        <label>{t("Passwort")}<Input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <Button className="primary" disabled={busy}>{busy ? localizeText('Anmeldung läuft …') : localizeText('Anmelden')}</Button>
      </form> : <><p role="status">{t("Zugang wird geprüft.")}</p><Button disabled={busy} onClick={() => {
          setError('');
          void refresh().catch(e => setError(e.message));
        }}>{t("Erneut versuchen")}</Button></>}
    </section>
  </main>;
  const accountMenu = session.loginRequired ? <>
    <Button className="account-menu-button" aria-label={t("Abmelden")} disabled={busy} onClick={() => void submit(false)}>
      <Icon name="lock" /><span>{t("Abmelden")}<small>{session.username} · {session.role}</small></span>
    </Button>
    {error && <p className="account-menu-error" role="alert">{localizeText(error)}</p>}
  </> : null;
  return <AccountMenuContext.Provider value={accountMenu}>{localizeText(children)}</AccountMenuContext.Provider>;
}
