import { metricNumber, chartNumber } from './charts/chartFormat';
import { t, text as localizeText, getLocale } from "./i18n/core";
import { useLanguage } from "./i18n/Language";
import { Button } from './components/ui/button';
import { sessionFetch } from './Access';
import { useEffect, useState } from 'react';
import { curveValue, curveMarker, curveSlope, type CurveValues } from './heatingCurveMath';
import { Icon } from './Icons';
import './heatingCurve.css';
import { HeatingCurveChart } from './charts/HeatingCurveChart';
function CurveNumberInput({
  value,
  label,
  minimum,
  maximum,
  disabled,
  error,
  id,
  onCommit
}: {
  value: string;
  label: string;
  minimum: number;
  maximum: number;
  disabled: boolean;
  error?: string;
  id: string;
  onCommit: (text: string) => boolean;
}) {
  const language = useLanguage();
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  function commit() {
    if (!editing) return;
    if (!onCommit(text)) setText(value);
    setEditing(false);
  }
  return <input id={id} type="number" step="1" min={minimum} max={maximum} value={editing ? text : value} disabled={disabled} aria-label={localizeText(label)} aria-invalid={!!error} aria-describedby={id + '-help'} onFocus={() => {
    setText(value);
    setEditing(true);
  }} onChange={e => {
    setText(e.target.value);
    setEditing(true);
  }} onBlur={commit} onKeyDown={e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setText(value);
      setEditing(false);
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = String(Number(value) + (e.key === 'ArrowUp' ? 1 : -1));
      if (onCommit(next)) setText(next);else setText(value);
      setEditing(false);
    }
  }} />;
}
type Value = {
  key: string;
  value: number | string | boolean | null;
  unit: string;
  quality: string;
  receivedAtUtc: string | null;
  retained: boolean;
};
type Field = {
  property: keyof CurveValues;
  key: string;
  label: string;
  topic: string;
  minimum: number;
  maximum: number;
  unit: string;
  part: string;
  top: number;
};
type Context = {
  expectedStateRevision: string;
  current: CurveValues | null;
  fields: Field[];
  available: boolean;
  reason: string;
  timeoutSeconds: number;
  source: string;
};
type Part = {
  name: string;
  state: string;
  sentUtc: string | null;
  reason: string;
};
type Record = {
  id: string;
  state: string;
  reason: string;
  oldValues: CurveValues;
  desired: CurveValues;
  parts: Part[];
  observed: Value[];
  createdUtc: string;
  user: string;
};
type Session = {
  loginRequired?: boolean;
  authenticated: boolean;
  username: string | null;
  role: string | null;
  csrfToken: string;
};
type Form = {
  base: CurveValues;
  draft: { [K in keyof CurveValues]: string };
  conflict: boolean;
};
const names: {
  [key: string]: string;
} = {
  curve: 'Heizkurve',
  delta: 'Heiz-ΔT',
  cutoff: 'Heizgrenze'
};
const states: {
  [key: string]: string;
} = {
  validated: 'Bestätigung ausstehend',
  running: 'Übernahme läuft',
  observedMatchingState: 'Übereinstimmende Anlagenwerte beobachtet',
  partial: 'Teilweise übernommen',
  timedOut: 'Zeitüberschreitung',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
  pending: 'Noch nicht gesendet',
  sending: 'Sendeversuch läuft',
  waiting: 'Warte auf Rücklesen',
  skipped: 'Nicht gesendet'
};
const reasons: {
  [key: string]: string;
} = {
  read_only: 'Lesender Betrieb · Vorschau ist möglich.',
  offline: 'Verbindung zur Anlage oder zum Sender fehlt.',
  state_unavailable: 'Aktuelle, vollständige und nicht-retained Anlagenwerte erforderlich.',
  not_compensation: 'Die Anlage verwendet keine witterungsgeführte Heizregelung.',
  zone1_inactive: 'Zone 1 ist nicht aktiv.',
  not_heating: 'Die aktuelle Betriebsart enthält keinen Heizbetrieb.',
  device_error: 'Der Fehlerstatus der Anlage erlaubt keine Übernahme.',
  command_pending: 'Ein Auftrag ist noch offen.',
  state_conflict: 'Anlagenwerte wurden zwischenzeitlich geändert. Bitte neu prüfen.',
  window_closed: 'Das freigegebene Schreibfenster ist beendet.',
  audit_unavailable: 'Befehlsprotokoll nicht verfügbar. Übernahme gesperrt.',
  draft_expired: 'Der Entwurf ist abgelaufen. Bitte erneut prüfen.',
  restart: 'Nach Neustart beendet; nichts erneut gesendet.',
  delivery_unknown: 'Sendefehler: Eine Wirkung ist nicht ausgeschlossen. Anlagenwerte prüfen.',
  readback_timeout: 'Passende Rückmeldung nicht rechtzeitig vollständig empfangen.',
  unchanged: 'Es gibt keine Änderungen.',
  invalid_curve: 'Bitte korrigiere die markierten Eingaben.',
  cooldown: 'Bitte vor dem nächsten Auftrag 30 Sekunden warten.',
  not_owner: 'Nur der Ersteller darf diesen Auftrag bestätigen.',
  csrf_invalid: 'Sitzungsschutz abgelaufen. Bitte neu anmelden.',
  user_cancelled: 'Entwurf verworfen.'
};
const asDraft = (c: CurveValues) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'numbers').map(([k, v]) => [k, String(v)])) as Form['draft'];
const same = (a: CurveValues | null, b: CurveValues | null) => a && b && Object.keys(asDraft(a)).every(k => a[k as keyof CurveValues] === b[k as keyof CurveValues]);
const numberDraft = (f: Form) => Object.fromEntries(Object.entries(f.draft).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v)])) as CurveValues;
const open = (r?: Record) => r && ['validated', 'running'].includes(r.state);
export function HeatingCurvePanel({
  values,
  live,
  enabled,
  source
}: {
  values: Value[];
  live: boolean;
  enabled: boolean;
  source: string;
}) {
  const language = useLanguage();
  const [context, setContext] = useState<Context | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inputErrors, setInputErrors] = useState<{
    [key: string]: string;
  }>({});
  const [preview, setPreview] = useState(false);
  const [reachable, setReachable] = useState(false);
  const current = records.find(r => open(r));
  const draft = form ? numberDraft(form) : null;
  const dirty = !!(draft && form && !same(draft, form.base));
  useEffect(() => {
    let disposed = false;
    async function refresh() {
      try {
        const r = await sessionFetch('/api/v1/heating-curve/context', {
          cache: 'no-store'
        });
        if (!r.ok) throw Error();
        const c = (await r.json()) as Context;
        if (!disposed) {
          setContext(c);
          setReachable(true);
        }
        if (enabled) {
          const a = await sessionFetch('/api/v1/auth/session', {
            cache: 'no-store'
          });
          if (!a.ok) throw Error();
          const s = (await a.json()) as Session;
          if (!disposed) setSession(s);
          if (s.authenticated) {
            const result = await sessionFetch('/api/v1/heating-curve/commands', {
              cache: 'no-store'
            });
            if (!result.ok) throw Error();
            const rows = (await result.json()) as Record[];
            if (!disposed) setRecords(rows);
          } else if (!disposed) setRecords([]);
        }
      } catch {
        if (!disposed) setReachable(false);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 1500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [enabled]);
  useEffect(() => {
    if (!context?.current || current) return;
    setForm(old => {
      if (!old || same(numberDraft(old), old.base) || records[0]?.state === 'observedMatchingState' && same(numberDraft(old), records[0].desired) && same(context.current, records[0].desired)) return {
        base: context.current!,
        draft: asDraft(context.current!),
        conflict: false
      };
      return same(old.base, context.current) ? old : {
        ...old,
        conflict: true
      };
    });
  }, [context, current, records]);
  const errors: {
    [key: string]: string;
  } = {};
  if (draft && context) {
    for (const f of context.fields) if (!Number.isInteger(draft[f.property]) || draft[f.property] < f.minimum || draft[f.property] > f.maximum) errors[f.property] = `Ganze Zahl von ${f.minimum} bis ${f.maximum} ${f.unit}.`;
    if (draft.xCold >= draft.xWarm) errors.xWarm = 'Außen hoch muss größer als Außen niedrig sein.';
    if (draft.yCold < draft.yWarm) errors.yWarm = 'Vorlauf niedrig darf Vorlauf hoch nicht überschreiten.';
  }
  const valid = draft && Object.keys(errors).length === 0;
  const measured = (key: string) => values.find(v => v.key === key);
  const freshNumber = (key: string) => {
    const v = measured(key);
    return live && v?.quality === 'valid' && !v.retained && typeof v.value === 'number' ? v.value : null;
  };
  const outside = freshNumber('outsideTemperature');
  function metric(key: string, label: string) {
    const v = measured(key);
    const quality = !live || v?.quality === 'stale' ? 'Veraltet' : v?.quality === 'valid' ? 'Aktuell' : v?.quality === 'invalid' ? 'Ungültig' : 'Unbekannt';
    return <article className="curve-live" key={key}><span>{localizeText(label)}</span><strong>{typeof v?.value === 'number' ? localizeText(metricNumber(v.value, key)) : localizeText('—')} {v?.unit ?? localizeText('°C')}</strong><small>{localizeText(quality)}{v?.retained ? localizeText(' · Retained') : localizeText('')}{v?.receivedAtUtc ? localizeText(` · ${new Date(v.receivedAtUtc).toLocaleTimeString(getLocale(), { timeZone: 'Europe/Berlin' }) + ' · vor ' + Math.max(0, Math.floor((Date.now() - Date.parse(v.receivedAtUtc)) / 1000)) + ' s'}`) : localizeText('')}</small></article>;
  }
  function update(key: keyof CurveValues, value: string) {
    const field = context?.fields.find(f => f.property === key);
    if (!field || !form) return false;
    const number = value.trim() === '' ? NaN : Number(value);
    const candidate = {
      ...numberDraft(form),
      [key]: number
    };
    let message = '';
    if (!Number.isInteger(number) || number < field.minimum || number > field.maximum) message = 'Zulässig sind ganze Zahlen von ' + field.minimum + ' bis ' + field.maximum + ' ' + field.unit + '.';else if ((key === 'xCold' || key === 'xWarm') && candidate.xCold >= candidate.xWarm) message = 'Außen niedrig muss kleiner als Außen hoch sein.';else if ((key === 'yCold' || key === 'yWarm') && candidate.yCold < candidate.yWarm) message = 'Vorlauf hoch muss mindestens so groß wie Vorlauf niedrig sein.';
    if (message) {
      setInputErrors(old => ({
        ...old,
        [key]: 'Nicht übernommen. ' + message + ' Der bisherige Wert bleibt erhalten.'
      }));
      return false;
    }
    setInputErrors(old => {
      const next = {
        ...old
      };
      delete next[key];
      return next;
    });
    setForm(f => f ? {
      ...f,
      draft: {
        ...f.draft,
        [key]: String(number)
      }
    } : f);
    setPreview(false);
    setError('');
    return true;
  }
  function reset() {
    setInputErrors({});
    if (context?.current) setForm({
      base: context.current,
      draft: asDraft(context.current),
      conflict: false
    });
    setError('');
    setPreview(false);
  }
  async function post(path: string, body: unknown) {
    if (!session) throw Error('Anmeldung erforderlich.');
    const r = await sessionFetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': session.csrfToken
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw Error(reasons[e.errorCode] ?? (r.status === 401 ? 'Anmeldung erforderlich oder Sitzung abgelaufen.' : r.status === 403 ? 'Bedienerrechte erforderlich.' : 'Anfrage fehlgeschlagen. Bitte Anlagenwerte prüfen.'));
    }
    return r.status === 204 ? null : r.json();
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || !!current;
  function field(property: keyof CurveValues) {
    const f = context?.fields.find(f => f.property === property);
    if (!f) return null;
    const message = inputErrors[property] ?? errors[property];
    const v = measured(f.key);
    const n = draft?.[property];
    const changed = form && n !== form.base[property];
    return <div className={`curve-field ${changed ? 'dirty' : ''}`} key={property}>
      <label htmlFor={`curve-${property}`}>{localizeText(f.label)} <span>{localizeText(f.unit)}</span>{changed && <small>{t(" · geändert")}</small>}</label>
      <div className="curve-stepper"><Button disabled={disabled || !form} aria-label={localizeText(`${f.label} verringern`)} onClick={() => update(property, String((Number.isFinite(n) ? n! : f.minimum) - 1))}>−</Button><CurveNumberInput id={`curve-${property}`} label={localizeText(f.label)} minimum={f.minimum} maximum={f.maximum} value={form?.draft[property] ?? ''} disabled={disabled || !form} error={message} onCommit={value => update(property, value)} /><Button disabled={disabled || !form} aria-label={localizeText(`${f.label} erhöhen`)} onClick={() => update(property, String((Number.isFinite(n) ? n! : f.minimum) + 1))}>+</Button></div>
      <small id={`curve-${property}-help`} role={message ? 'alert' : undefined} className={message ? 'curve-error' : ''}>{localizeText(message) ?? `TOP${f.top} · ${f.topic}`}</small>
      <small className="curve-received">{t("Anlage: ")}{typeof v?.value === 'number' ? localizeText(`${metricNumber(v.value, f.key)} ${f.unit}`) : localizeText('—')} · {localizeText(!live) || v?.quality === 'stale' ? localizeText('Veraltet') : v?.quality === 'valid' ? localizeText('Aktuell') : v?.quality === 'invalid' ? localizeText('Ungültig') : localizeText('Unbekannt')}{v?.retained ? localizeText(' · Retained') : localizeText('')}{v?.receivedAtUtc ? localizeText(` · ${new Date(v.receivedAtUtc).toLocaleTimeString(getLocale(), { timeZone: 'Europe/Berlin' }) + ' · vor ' + Math.max(0, Math.floor((Date.now() - Date.parse(v.receivedAtUtc)) / 1000)) + ' s'}`) : localizeText('')}</small>
    </div>;
  }
  return <section className="heating-curve" aria-label={t("Heizkurve Zone 1")}>
    <div className="curve-heading"><div><h2>{t("Zone 1 · Witterungsgeführt")}</h2><p>{source === 'simulator' ? localizeText('Simulierte Heizkurve') : localizeText('Anlagenwerte und lokale Vorschau')}</p></div><div className="curve-live-grid">{localizeText(metric('outsideTemperature', 'Außen'))}{localizeText(metric('mainTargetTemperature', 'Soll · Anlage (TOP7)'))}{localizeText(metric('flowTemperature', 'Vorlauf'))}</div></div>
    {!context && <p role="status">{t("Heizkurvendaten werden geladen …")}</p>}
    {(localizeText(!live) || !reachable) && <p className="warning" role="alert">{t("Verbindung unterbrochen. Übernahme gesperrt.")}</p>}
    {context && !context.current && <p className="warning">{t("Kurvenwerte fehlen. Empfangene Einzelwerte stehen an den Feldern; eine vollständige Vorschau ist noch nicht möglich.")}</p>}
    {context && <p className="curve-note">{localizeText(reasons[context.reason]) ?? localizeText('Übernahme nach Prüfung und Bestätigung möglich.')}</p>}
    {measured('heatingControlMode')?.value === 1 && <p className="warning">{t("Festwertregelung aktiv: Diese Kurve bestimmt derzeit nicht den Vorlauf-Sollwert.")}</p>}
    {context && context.fields.some(f => freshNumber(f.key) === null) && <p className="warning">{t("Kurvenkonfiguration nicht vollständig aktuell. Das Diagramm zeigt gegebenenfalls die zuletzt gelesenen Werte.")}</p>}
    {form?.conflict && <div className="warning" role="alert"><p>{t("Anlagenwerte wurden extern geändert. Deine Eingaben bleiben erhalten.")}</p><Button disabled={disabled} onClick={reset}>{t("Neue Anlagenwerte laden")}</Button><Button disabled={disabled} onClick={() => setForm(f => f && context?.current ? {
        ...f,
        base: context.current,
        conflict: false
      } : f)}>{t("Eigene Eingaben beibehalten")}</Button><p>{t("Beibehalten verlangt eine neue Prüfung und Bestätigung.")}</p></div>}
    <div className="curve-layout"><section className="panel curve-diagram"><div className="curve-panel-heading"><h3>{dirty ? localizeText('Lokale Vorschau · ungespeichert') : localizeText('Gelesene Heizkurve')}</h3><Icon name="chart" /></div>
      {valid ? <HeatingCurveChart c={draft} outside={outside} /> : <p className="curve-empty">{draft ? localizeText('Bitte Eingaben korrigieren, um die Kurve darzustellen.') : localizeText('Warte auf vollständige Kurvenwerte.')}</p>}
      <div className="curve-summary"><div><span>{t("Steigung")}</span><strong>{valid ? localizeText(curveSlope(draft).toLocaleString(getLocale(), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })) : localizeText('—')}{t(" K/K")}</strong></div><div><span>{t("Berechneter Kurvenwert")}</span><strong>{valid && outside !== null ? localizeText((curveValue(draft, outside) === null ? '—' : chartNumber(curveValue(draft, outside)!, true))) : localizeText('—')}{t(" °C")}</strong></div></div>
      {outside !== null && curveMarker(outside) === null && <p className="warning">{t("Außenwert außerhalb des Diagrammbereichs (−40 bis +50 °C). Keine Außenmarkierung dargestellt.")}</p>}
      <p className="curve-note">{t("Kurvenwert und gemeldeter Anlagen-Sollwert (TOP7) können durch Betriebszustand und Verschiebungen abweichen.")}</p>
      <p className="curve-note">{valid && outside !== null ? outside > draft.heatingOffTemperature ? localizeText('Heizgrenze in der Vorschau überschritten.') : localizeText('Heizgrenze in der Vorschau nicht überschritten.') : localizeText('Grenzvergleich wegen fehlender aktueller Werte nicht verfügbar.')}{t(" Der Vergleich beschreibt keinen gemessenen Schaltzustand.")}</p>
      <p className="curve-note">{t("Anlage: ")}{outside !== null && freshNumber('heatingOffTemperature') !== null ? outside > freshNumber('heatingOffTemperature')! ? localizeText('Aktuelle Heizgrenze überschritten.') : localizeText('Aktuelle Heizgrenze nicht überschritten.') : localizeText('Heizgrenzenstatus unbekannt.')}</p>
      {valid && draft.xWarm > draft.heatingOffTemperature && <p className="warning">{t("Der Warmpunkt liegt oberhalb der Heizgrenze.")}</p>}
      {valid && draft.yCold === draft.yWarm && <p className="curve-note">{t("Die Kurve ist flach: Beide Vorlaufwerte sind gleich.")}</p>}
    </section><div className="curve-inputs"><section className="panel"><h3>{t("Eckpunkte einstellen")}</h3><p className="curve-note">{t("Direkte Eingaben mit Enter oder beim Verlassen des Feldes übernehmen. Escape verwirft die Eingabe.")}</p><div className="curve-points"><fieldset><legend>{t("Kaltpunkt")}</legend>{localizeText(field('xCold'))}{localizeText(field('yCold'))}</fieldset><fieldset><legend>{t("Warmpunkt")}</legend>{localizeText(field('xWarm'))}{localizeText(field('yWarm'))}</fieldset></div></section><section className="panel curve-cutoff"><h3><Icon name="thermometer" />{t(" Heizgrenze")}</h3>{localizeText(field('heatingOffTemperature'))}<p className="curve-note">{t("Oberhalb dieser Außentemperatur bleibt der Heizbetrieb ausgeschaltet.")}</p></section><section className="panel"><h3><Icon name="delta" />{t(" Heiz-ΔT")}</h3>{localizeText(field('heatDelta'))}<p className="curve-note">{t("Soll-Differenz zwischen Vorlauf und Rücklauf; kein Toleranzband.")}</p><div className="curve-delta"><span>{t("Vorlauf ")}{localizeText((freshNumber('flowTemperature') === null ? '—' : metricNumber(freshNumber('flowTemperature')!, 'flowTemperature')))}{t(" °C")}</span><span aria-hidden="true">→</span><span>{t("Rücklauf ")}{localizeText((freshNumber('returnTemperature') === null ? '—' : metricNumber(freshNumber('returnTemperature')!, 'returnTemperature')))}{t(" °C")}</span></div><p>{t("Gemessene Spreizung: ")}<strong>{localizeText((freshNumber('temperatureSpread') === null ? '—' : metricNumber(freshNumber('temperatureSpread')!, 'temperatureSpread')))}{t(" K")}</strong></p></section></div></div>
    <div className="panel curve-actions"><Button disabled={disabled || !form} onClick={reset}>{t("Zurücksetzen")}</Button><Button disabled={!valid || disabled} onClick={() => setPreview(true)}>{t("Vorschau")}</Button><Button className="primary" disabled={!valid || !dirty || !enabled || !context?.available || !reachable || !live || disabled || !!form?.conflict || !['writer', 'admin'].includes(session?.role ?? '')} onClick={() => void act(async () => {
        if (!same(form!.base, context!.current)) throw Error(reasons.state_conflict);
        const r = await post('/api/v1/heating-curve/commands', {
          idempotencyKey: crypto.randomUUID(),
          expectedStateRevision: context!.expectedStateRevision,
          desired: draft
        });
        setRecords(rows => [r, ...rows]);
      })}>{t("Heizkurve übernehmen")}</Button><span role="status">{preview ? localizeText('Vorschau aktualisiert. Keine Änderung gesendet.') : dirty ? localizeText('Ungespeicherte Eingaben') : localizeText('Keine lokalen Änderungen')}</span></div>
    {error && <p className="warning" role="alert">{localizeText(error)}</p>}
    {enabled && !session?.loginRequired && <section className="panel curve-account"><h3>{t("Bedienerzugang ")}{source === 'simulator' ? localizeText('· Simulation') : localizeText('· reale Anlage')}</h3>{session?.authenticated ? <><p>{t("Angemeldet: ")}{session.username} · {session.role}</p><Button disabled={busy} onClick={() => void act(async () => {
          await post('/api/v1/auth/logout', {});
          setSession(null);
          setRecords([]);
        })}>{t("Abmelden")}</Button></> : <form onSubmit={e => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        void act(async () => {
          await post('/api/v1/auth/login', {
            username: formData.get('username'),
            password: formData.get('password')
          });
          const r = await sessionFetch('/api/v1/auth/session');
          setSession(await r.json());
        });
        e.currentTarget.reset();
      }}><label>{t("Benutzername")}<input name="username" autoComplete="username" required /></label><label>{t("Passwort")}<input name="password" type="password" autoComplete="current-password" required /></label><Button disabled={busy || !session} type="submit">{t("Anmelden")}</Button></form>}</section>}
    {current?.state === 'validated' && <section className="panel curve-confirm" aria-label={t("Heizkurve bestätigen")}><h3>{t("Änderungen ausdrücklich bestätigen")}</h3><p>{t("Drei Parametergruppen sind keine atomare Änderung. Nach einem Fehler werden weitere Teile nicht gesendet. Bereits geänderte Werte bleiben bestehen.")}</p><table><thead><tr><th>{t("Parameter")}</th><th>{t("Bisher")}</th><th>{t("Gewünscht")}</th></tr></thead><tbody>{localizeText(context?.fields.filter(f => current.oldValues[f.property] !== current.desired[f.property]).map(f => <tr key={f.property}><th>{localizeText(f.label)}</th><td>{localizeText(metricNumber(current.oldValues[f.property], f.key))} {localizeText(f.unit)}</td><td>{localizeText(metricNumber(current.desired[f.property], f.key))} {localizeText(f.unit)}</td></tr>))}</tbody></table><Button disabled={busy || !live || !reachable} className="primary" onClick={() => void act(async () => {
        const r = await post(`/api/v1/heating-curve/commands/${current.id}/confirm`, {
          confirmed: true
        });
        setRecords(rows => rows.map(old => old.id === r.id ? r : old));
      })}>{t("Jetzt bestätigt senden")}</Button><Button disabled={busy} onClick={() => void act(async () => {
        const r = await post(`/api/v1/heating-curve/commands/${current.id}/cancel`, {});
        setRecords(rows => rows.map(old => old.id === r.id ? r : old));
      })}>{t("Entwurf verwerfen")}</Button></section>}
    {records.length > 0 && <section className="panel curve-audit" aria-label={t("Heizkurven-Protokoll")}><h3>{t("Übernahme und Rücklesen")}</h3><p>{t("Rücklesefrist je Teil: ")}{localizeText(context?.timeoutSeconds)}{t(" Sekunden. Eine Übereinstimmung belegt beobachtete Werte, keine eindeutige Befehlsursache. Keine automatische Wiederholung.")}</p>{records.slice(0, 8).map(r => <article key={r.id}><h4>{localizeText(states[r.state]) ?? localizeText(r.state)}</h4><small>{localizeText(new Date(r.createdUtc).toLocaleString(getLocale(), { timeZone: 'Europe/Berlin' }))} · {r.user}</small>{r.reason && r.reason !== 'matching_values_observed' && <p>{localizeText(reasons[r.reason]) ?? localizeText(r.reason)}</p>}<ul>{localizeText(r.parts.map(p => <li key={p.name}>{localizeText(names[p.name])}: <strong>{localizeText(states[p.state]) ?? localizeText(p.state)}</strong></li>))}</ul><details><summary>{t("Alt-, Soll- und Rücklesewerte")}</summary><table><thead><tr><th>{t("Parameter")}</th><th>{t("Alt")}</th><th>{t("Soll")}</th><th>{t("Beobachtet")}</th></tr></thead><tbody>{localizeText(context?.fields.map(f => {
                const v = r.observed.find(v => v.key === f.key);
                return <tr key={f.key}><th>{localizeText(f.label)}</th><td>{localizeText(metricNumber(r.oldValues[f.property], f.key))}</td><td>{localizeText(metricNumber(r.desired[f.property], f.key))}</td><td>{typeof v?.value === 'number' ? localizeText(metricNumber(v.value, f.key)) : localizeText('—')} {localizeText(f.unit)} · {localizeText(v?.quality) ?? localizeText('unknown')}</td></tr>;
              }))}</tbody></table></details></article>)}</section>}
  </section>;
}
