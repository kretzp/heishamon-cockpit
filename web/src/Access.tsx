import { LanguagePicker } from './i18n/Language';
import { Brand } from './Brand';
import { t, text as localizeText, getLocale } from "./i18n/core";
import { useLanguage } from "./i18n/Language";
import { ThemePicker } from './Theme';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Icon } from './Icons';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import './access.css';
type Session = {
  loginRequired: boolean;
  authenticated: boolean;
  username?: string;
  role?: string;
  csrfToken?: string;
};
const sessionChanged = 'cockpit-session-changed';
const sessionInvalidated = 'cockpit-session-invalidated';
const sessionUnavailableMessage = 'Anmeldedienst nicht erreichbar. Bitte erneut versuchen.';
let sessionAvailable = false;
const AccountMenuContext = createContext<ReactNode>(null);
export function AccountMenu() {
  return useContext(AccountMenuContext);
}
export async function sessionFetch(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (!sessionAvailable && !['GET', 'HEAD', 'OPTIONS'].includes(method)) throw Error(sessionUnavailableMessage);
  const response = await fetch(input, init);
  const url = input instanceof Request ? input.url : String(input);
  if (response.status === 401 || url.endsWith('/auth/logout') && response.ok) {
    sessionAvailable = false;
    window.dispatchEvent(new Event(sessionInvalidated));
  }
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
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const latestSessionCheck = useRef(0);
  async function refresh() {
    const check = ++latestSessionCheck.current;
    try {
      const response = await fetch('/api/v1/auth/session', { cache: 'no-store' });
      if (!response.ok && response.status !== 401) throw Error(sessionUnavailableMessage);
      const next: Session = response.status === 401
        ? { loginRequired: true, authenticated: false }
        : await response.json();
      if (check === latestSessionCheck.current) {
        sessionAvailable = !next.loginRequired || next.authenticated;
        setSession(next);
        setSessionUnavailable(false);
        setError(previous => previous === sessionUnavailableMessage ? '' : previous);
      }
      return next;
    } catch (error) {
      if (check === latestSessionCheck.current) {
        sessionAvailable = false;
        setSessionUnavailable(true);
        setError(sessionUnavailableMessage);
      }
      throw error;
    }
  }
  useEffect(() => {
    const check = () => refresh().catch(() => {});
    const invalidated = () => {
      sessionAvailable = false;
      ++latestSessionCheck.current;
      setSession(previous => previous && !previous.loginRequired
        ? { loginRequired: false, authenticated: false }
        : null);
      setSessionUnavailable(true);
      void check();
    };
    void check();
    const timer = window.setInterval(() => void check(), 10000);
    const changed = () => void check();
    window.addEventListener(sessionChanged, changed);
    window.addEventListener(sessionInvalidated, invalidated);
    window.addEventListener('focus', changed);
    return () => {
      ++latestSessionCheck.current;
      sessionAvailable = false;
      clearInterval(timer);
      window.removeEventListener(sessionChanged, changed);
      window.removeEventListener(sessionInvalidated, invalidated);
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
      if (!login) {
        sessionAvailable = false;
        ++latestSessionCheck.current;
        setSession(null);
      }
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
    {error && !sessionUnavailable && <p className="account-menu-error" role="alert">{localizeText(error)}</p>}
  </> : null;
  return <AccountMenuContext.Provider value={accountMenu}>
    {sessionUnavailable && <div className="session-status warning" role="alert">
      <span>{localizeText(sessionUnavailableMessage)}</span>
      <Button disabled={busy} onClick={() => void refresh().catch(() => {})}>{t("Erneut versuchen")}</Button>
    </div>}
    <div className="session-content" inert={sessionUnavailable}>{localizeText(children)}</div>
  </AccountMenuContext.Provider>;
}
