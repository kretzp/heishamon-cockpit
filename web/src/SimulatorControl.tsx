import { t, text as localizeText, getLocale } from "./i18n/core";
import { useLanguage } from "./i18n/Language";
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { sessionFetch } from './Access';
import { useEffect, useRef, useState } from 'react';
import './simulator-control.css';
type Session = {
  loginRequired?: boolean;
  authenticated: boolean;
  username: string | null;
  role: string | null;
  csrfToken: string;
};
type Context = {
  expectedStateRevision: string;
  currentValue: number | null;
  available: boolean;
  minimum: number;
  maximum: number;
  step: number;
  unit: string;
  timeoutSeconds: number;
  expiresUtc: string | null;
  remainingSends: number | null;
};
type Command = {
  id: string;
  user: string;
  commandType: string;
  oldValue: number;
  desiredValue: number;
  observedValue: number | null;
  state: string;
  reason: string;
  updatedUtc: string;
};
const parameters = [{
  type: 'setDhwTemperature',
  label: 'Warmwasser-Soll',
  unit: '°C'
}, {
  type: 'setDhwHeatDelta',
  label: 'Warmwasser-Einschaltdifferenz',
  unit: 'K'
}];
const sterilization = {
  type: 'startSterilization',
  label: 'Sterilisation einmalig starten',
  unit: ''
};
const extended = [{
  type: 'setIndoorTemperature',
  label: 'Innen-Soll (Heizen, Zone 1)',
  unit: '°C'
}, {
  type: 'setQuietMode',
  label: 'Flüstermodus',
  unit: ''
}, {
  type: 'setOperatingMode',
  label: 'Betriebsart',
  unit: ''
}];
const sterilizationSettings = [
  { type: 'setSterilizationTemperature', label: 'Sterilisationstemperatur', unit: '°C' },
  { type: 'setSterilizationMaxTime', label: 'Sterilisation – maximale Dauer', unit: 'min' }
];
const allParameters = [...parameters, sterilization, ...sterilizationSettings, ...extended];
const enums: Record<string, string[]> = {
  setQuietMode: ['Aus', 'Stufe 1', 'Stufe 2', 'Stufe 3'],
  setOperatingMode: ['Heizen', 'Kühlen', 'Auto', 'Warmwasser', 'Heizen + Warmwasser', 'Kühlen + Warmwasser', 'Auto + Warmwasser']
};
const display = (type: string, value: number | null | undefined) => value == null ? '—' : type === 'setOperatingMode' && value === 7 ? 'Auto (Kühlen)' : type === 'setOperatingMode' && value === 8 ? 'Auto (Kühlen) + Warmwasser' : enums[type]?.[value] ?? value;
const states: Record<string, string> = {
  draft: 'Entwurf',
  validated: 'Geprüft – Bestätigung erforderlich',
  sent: 'Simuliert gesendet – Rücklesen läuft',
  observedMatchingState: 'Übereinstimmender Zustand beobachtet',
  timedOut: 'Zeitüberschreitung – kein passender Rücklesewert',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen'
};
const errors: Record<string, string> = {
  live_parameter_blocked: 'Dieser Parameter ist für den Live-Test gesperrt.',
  test_window_closed: 'Das Testfenster ist abgelaufen.',
  test_sequence_blocked: 'Testfolge oder Sendebudget sperrt die Änderung.',
  invalid_command: 'Wert außerhalb des erlaubten Bereichs.',
  invalid_step: 'Sterilisation – maximale Dauer nur in 5-Minuten-Schritten.',
  state_unavailable: 'Aktuelle, gültige Anlagenwerte und eine passende Sensorkonfiguration/Betriebsart sowie Fehlerfrei-Status erforderlich.',
  state_conflict: 'Der Zustand hat sich geändert. Bitte erneut prüfen.',
  command_pending: 'Es ist bereits ein Befehl offen.',
  unchanged_value: 'Dieser Wert ist bereits eingestellt.',
  change_interval: 'Zwischen zwei Änderungen müssen mindestens 30 Sekunden liegen.',
  draft_expired: 'Entwurf abgelaufen. Bitte erneut prüfen.',
  csrf_invalid: 'Sitzungsschutz abgelaufen. Bitte die Seite neu laden.',
  audit_unavailable: 'Befehlsprotokoll nicht verfügbar. Änderungen gesperrt.',
  confirmation_required: 'Bitte die Änderung ausdrücklich bestätigen.',
  not_owner: 'Nur der Ersteller darf diesen Entwurf bestätigen.',
  idempotency_conflict: 'Diese Anfragekennung wurde bereits anders verwendet.'
};
const reasons: Record<string, string> = {
  mqtt_send_attempt: 'MQTT-Sendeversuch protokolliert; keine Gerätebestätigung.',
  delivery_unknown: 'Übertragung fehlgeschlagen oder ungewiss. Keine Wiederholung; Zustand am Bedienteil prüfen.',
  restart: 'Nach Neustart abgebrochen; keine Wiederholung.',
  connection_or_state_changed: 'Verbindung oder relevanter Zustand geändert.',
  draft_expired_or_changed: 'Entwurf abgelaufen oder Zustand geändert.',
  user_cancelled: 'Entwurf verworfen.',
  simulator_failed: 'Simulierter Übertragungsfehler.',
  no_matching_state: 'Kein passender Rücklesewert innerhalb der Rücklesefrist.',
  sterilization_active_observed: 'Sterilisation aktiv nach dem Senden beobachtet; der Zyklus ist damit nicht als abgeschlossen bestätigt.',
  matching_state_observed: 'Passender Wert nach dem Senden empfangen.',
  simulator_sent: 'An den internen Simulator übergeben.',
  validated: 'Serverprüfung bestanden.',
  state_conflict: 'Zustand vor Bestätigung geändert.'
};
export function SimulatorControlPanel({
  liveTest = false,
  liveControl = false,
  sterilizationEnabled = false,
  extendedEnabled = false
}: {
  liveTest?: boolean;
  liveControl?: boolean;
  sterilizationEnabled?: boolean;
  extendedEnabled?: boolean;
}) {
  const language = useLanguage();
  const real = liveTest || liveControl;
  const title = liveControl ? 'Anlagensteuerung' : liveTest ? 'Begrenzter Live-Test' : 'Simulatorsteuerung';
  const choices = liveTest ? parameters.slice(0, 1) : [...parameters, ...(sterilizationEnabled ? [sterilization, ...sterilizationSettings] : []), ...(extendedEnabled ? extended : [])];
  const stateLabel = (state: string) => real && state === 'sent' ? 'Sendeversuch protokolliert – Rücklesen läuft' : states[state];
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [type, setType] = useState(parameters[0].type);
  const [context, setContext] = useState<Context | null>(null);
  const selectedType = useRef(type);
  selectedType.current = type;
  const [desired, setDesired] = useState('');
  const [commands, setCommands] = useState<Command[]>([]);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = commands.find(c => ['draft', 'validated', 'sent'].includes(c.state));
  const operator = session?.role === 'writer' || session?.role === 'admin';
  async function request(path: string, body?: unknown) {
    const response = await sessionFetch('/api/v1/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      headers: body === undefined ? {} : {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': session?.csrfToken ?? ''
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      if (response.status === 401) {
        setCommands([]);
        setContext(null);
        const fresh = await sessionFetch('/api/v1/auth/session', {
          cache: 'no-store'
        });
        if (fresh.ok) setSession(await fresh.json());
      }
      const detail = await response.json().catch(() => ({}));
      throw new Error(errors[detail.errorCode] ?? (response.status === 401 ? 'Anmeldung erforderlich oder Zugangsdaten falsch.' : response.status === 403 ? 'Keine Berechtigung für diese Aktion.' : response.status === 429 ? 'Zu viele Anfragen. Bitte kurz warten.' : 'Anfrage fehlgeschlagen. Bitte erneut laden.'));
    }
    return response.status === 204 ? null : response.json();
  }
  async function refreshSession() {
    const result = await request('auth/session');
    setSession(result);
    return result as Session;
  }
  async function refresh() {
    const [nextContext, nextCommands] = await Promise.all([request('commands/context?commandType=' + type), request('commands')]);
    if (selectedType.current === type) {
      setContext(nextContext);
      setCommands(nextCommands);
    }
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refreshSession().catch(e => setError(e.message));
  }, []);
  useEffect(() => {
    if (!session?.authenticated) return;
    let stopped = false;
    const poll = async () => {
      if (!stopped) try {
        await refresh();
      } catch (e) {
        if (!stopped) setError((e as Error).message);
      }
    };
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [session?.authenticated, type]);
  const parameter = allParameters.find(p => p.type === type)!;
  return <section className="panel simulator-control" aria-label={localizeText(title)}>
    <h2>{localizeText(title)}</h2><p className={real ? "warning" : "simulation"}>{liveControl ? localizeText("REALE ANLAGE · Anlagensteuerung und einmaliger Sterilisationsstart. Änderungen werden erst nach Prüfung und ausdrücklicher Bestätigung gesendet.") : liveTest ? localizeText("REALE ANLAGE · Warmwasser-Soll 52 → 51 → 52 °C. Jede Änderung kann den Warmwasserbetrieb beeinflussen. TOP22 bleibt −8 K.") : localizeText("SIMULATION · Änderungen betreffen ausschließlich simulierte Werte.")}</p>
    {liveTest && context && <p>{t("Verbleibende Sendeversuche: ")}{localizeText(context.remainingSends)}{t(". Testende: ")}{context.expiresUtc ? localizeText(new Date(context.expiresUtc).toLocaleString(getLocale(), {
        timeZone: "Europe/Berlin"
      })) + localizeText(" (Berlin)") : localizeText("—")}{t(". Keine automatische Rücksetzung.")}</p>}
    {error && <p role="alert" className="warning">{localizeText(error)}</p>}
    {!session?.authenticated ? <form onSubmit={e => {
      e.preventDefault();
      void action(async () => {
        if (!session) {
          await refreshSession();
          throw new Error('Sitzung erneuert. Bitte erneut anmelden.');
        }
        try {
          await request('auth/login', {
            username,
            password
          });
          await refreshSession();
        } finally {
          setPassword('');
        }
      });
    }}>
      <label>{t("Benutzername")}<Input autoComplete="username" required maxLength={64} value={username} onChange={e => setUsername(e.target.value)} /></label>
      <label>{t("Passwort")}<Input type="password" autoComplete="current-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <Button className="primary" disabled={busy || !session}>{t("Anmelden")}</Button>
    </form> : <>
      <div className="button-row"><p>{t("Angemeldet: ")}<strong>{session.username}</strong> · {operator ? localizeText('Bediener') : localizeText('Betrachter (nur lesen)')}</p>{!session.loginRequired && <Button disabled={busy} onClick={() => void action(async () => {
          await request('auth/logout', {});
          setCommands([]);
          setContext(null);
          setChecked(false);
          await refreshSession();
        })}>{t("Abmelden")}</Button>}</div>
      <form onSubmit={e => {
        e.preventDefault();
        void action(async () => {
          if (!context || desired.trim() === '') return;
          await request('commands', {
            idempotencyKey: crypto.randomUUID(),
            commandType: type,
            desiredValue: Number(desired),
            expectedStateRevision: context.expectedStateRevision
          });
          setChecked(false);
          await refresh();
        });
      }}>
        <label htmlFor="simulator-parameter">{t("Parameter")}</label><select id="simulator-parameter" value={type} disabled={busy || !!active} onChange={e => {
          setType(e.target.value);
          setDesired(e.target.value === 'startSterilization' ? '1' : '');
          setContext(null);
        }}>{localizeText(choices.map(p => <option key={p.type} value={p.type}>{localizeText(p.label)}</option>))}</select>
        <p>{t("Aktuell: ")}<strong>{type === 'startSterilization' ? context?.currentValue === 1 ? localizeText('Aktiv') : context?.currentValue === 0 ? localizeText('Inaktiv') : localizeText('—') : localizeText(display(type, context?.currentValue))} {context?.unit ?? localizeText(parameter.unit)}</strong></p>
        {sterilizationSettings.some(p => p.type === type) && <p className="warning">{t("Experimentell: Schreibannahme der L-Serie am Bedienteil prüfen.")}</p>}
        {type === 'setSterilizationMaxTime' && <p>{t("Haltezeit nach Erreichen der Zieltemperatur: 5–60 Minuten in 5-Minuten-Schritten.")}</p>}
        {type === 'setDhwHeatDelta' && <p>{t("Negative Einschaltdifferenz zum Warmwasser-Sollwert; von −12 bis −2 K.")}</p>}
        {type !== 'startSterilization' && !enums[type] && <label>{t("Gewünschter Wert (")}{context?.unit ?? localizeText(parameter.unit)})<Input type="number" required step={context?.step ?? 1} min={context?.minimum} max={context?.maximum} value={desired} disabled={!operator || busy || !!active || !context?.available} onChange={e => setDesired(e.target.value)} /></label>}
        {enums[type] && <label>{t("Gewünschter Wert")}<select required value={desired} disabled={!operator || busy || !!active || !context?.available} onChange={e => setDesired(e.target.value)}><option value="">{t("Bitte wählen")}</option>{localizeText(enums[type].map((label, value) => <option key={value} value={value}>{localizeText(label)}</option>))}</select></label>}
        {type === 'setIndoorTemperature' && <p>{t("Raumsollwert für Heizen, Zone 1: 16–28 °C. Nur bei aktueller, bestätigter Raumregelung und aktiver Zone 1 im Heizbetrieb verfügbar.")}</p>}
        {type === 'setQuietMode' && <p>{t("Aus oder Stufe 1–3; höhere Stufen begrenzen die Leistung stärker.")}</p>}
        {type === 'setOperatingMode' && <p>{t("Kühlen und Auto benötigen die Freischaltung am Bedienteil. HeishaMon 4.2.0 bietet dafür keinen eigenen Freischaltbefehl. Auto kann zwischen Heizen und Kühlen wechseln.")}</p>}
        <p>{type === "startSterilization" ? localizeText("Einmaliger Start mit den aktuell eingestellten Werten. Dabei wird das Warmwasser stark erhitzt. Keine automatische Wiederholung; Aktivstatus ist kein Nachweis eines abgeschlossenen Zyklus.") : <>{liveControl ? localizeText("Einstellbereich") : liveTest ? localizeText("Testbereich") : localizeText("Simulatorbereich")}: {localizeText(context?.minimum) ?? localizeText('—')}{t(" bis ")}{localizeText(context?.maximum) ?? localizeText('—')} {context?.unit ?? localizeText(parameter.unit)}.</>} {real ? localizeText("Am Bedienteil abgleichen; während einer Änderung keine parallelen Änderungen über Cloud oder Bedienteil.") : localizeText("Keine Freigabe für eine reale Anlage.")}</p>
        {!context?.available && <p role="status">{t("Änderungen gesperrt: erforderliche aktuelle Werte oder Befehlsprotokoll nicht verfügbar.")}</p>}
        <Button className="primary" disabled={!operator || busy || !!active || !context?.available || desired.trim() === ''}>{t("Änderung prüfen")}</Button>
      </form>
      {active && <section className="command-confirm" aria-label={t("Änderung bestätigen")}><h3>{localizeText(stateLabel(active.state))}</h3>
        <p>{localizeText(allParameters.find(p => p.type === active.commandType)?.label)}: <strong>{active.commandType === "startSterilization" ? localizeText("Inaktiv → Start anfordern") : <>{localizeText(display(active.commandType, active.oldValue))} → {localizeText(display(active.commandType, active.desiredValue))} {localizeText(allParameters.find(p => p.type === active.commandType)?.unit)}</>}</strong>{t(" · erstellt von ")}{localizeText(active.user)}</p>
        {active.state === 'validated' && active.user === session.username && operator && <>
          <label className="confirmation-check"><Input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />{real ? localizeText("Ich bestätige diese Änderung an der realen Wärmepumpe.") : localizeText("Ich bestätige diese Änderung im Simulator.")}</label>
          <div className="button-row"><Button className="primary" disabled={!checked || busy || !context?.available} onClick={() => void action(async () => {
              await request('commands/' + active.id + '/confirm', {
                confirmed: checked
              });
              setChecked(false);
              await refresh();
            })}>{real ? localizeText("Jetzt an Wärmepumpe senden") : localizeText("Jetzt im Simulator bestätigen")}</Button>
          <Button disabled={busy} onClick={() => void action(async () => {
              await request('commands/' + active.id + '/cancel', {});
              setChecked(false);
              await refresh();
            })}>{t("Verwerfen")}</Button></div>
        </>}
        {active.state === 'sent' && <p role="status">{t("Rücklesen frühestens nach 10 Sekunden; Timeout nach ")}{localizeText(context?.timeoutSeconds) ?? (real ? localizeText(360) : localizeText(20))}{t(" Sekunden. Keine automatische Wiederholung.")}</p>}
      </section>}
      <h3>{t("Befehlsprotokoll (")}{real ? localizeText("MQTT · reale Anlage") : localizeText("Simulator")})</h3><p>{t("Ein übereinstimmender Rücklesewert ist keine kausale Gerätebestätigung.")}</p>
      <ol className="command-log">{commands.map(c => <li key={c.id}><strong>{localizeText(stateLabel(c.state))}</strong><p>{localizeText(allParameters.find(p => p.type === c.commandType)?.label)}: {localizeText(display(c.commandType, c.oldValue))} → {localizeText(display(c.commandType, c.desiredValue))} {localizeText(allParameters.find(p => p.type === c.commandType)?.unit)}{t(" · Rücklesewert: ")}{localizeText(display(c.commandType, c.observedValue))}</p><p>{localizeText(reasons[c.reason]) ?? localizeText(c.reason)}</p><small>{c.user} · {localizeText(new Date(c.updatedUtc).toLocaleString(getLocale(), {
              timeZone: 'Europe/Berlin'
            }))} · {c.id}</small></li>)}</ol>
      {!commands.length && <p>{real ? t("Noch keine Live-Befehle.") : t("Noch keine Simulatorbefehle.")}</p>}
    </>}
  </section>;
}
