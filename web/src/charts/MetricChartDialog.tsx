import { exportFilename } from './exportFilename';
import { LanguagePicker } from '../i18n/Language';
import { chartLocales } from './chartLocale';
import { t, text as localizeText, getLocale } from "../i18n/core";
import { useLanguage } from "../i18n/Language";
import { useTheme } from '../Theme';
import { themeChart, chartBackground } from './chartTheme';
import { Button } from '../components/ui/button';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { sessionFetch } from '../Access';
import { EventsPanel } from '../History';
import { metricNumber, chartNumber, chartTime } from './chartFormat';
import { validPoint, type History } from './historyOptions';
import { boundedRange, csvAllowed } from './historyRange';
import { defaults, metricOptions, mergeOptions, parseOptions, readPreferences, type Preferences } from './metricChartOptions';
import './metric-chart.css';
import { TrendToggle } from './TrendToggle';
function ConfigurableChart({
  option,
  preferences
}: {
  option: EChartsOption;
  preferences: Preferences;
}) {
  const language = useLanguage();
  const {
    theme
  } = useTheme();
  const element = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.EChartsType | null>(null);
  const zoom = useRef({
    start: 0,
    end: 100
  });
  const [error, setError] = useState('');
  useEffect(() => {
    const instance = echarts.init(element.current!, undefined, {
      renderer: preferences.renderer,
      locale: chartLocales[language]
    });
    chart.current = instance;
    instance.on('datazoom', () => {
      const options = instance.getOption().dataZoom as {
        start?: number;
        end?: number;
      }[] | undefined;
      zoom.current = {
        start: options?.[0]?.start ?? 0,
        end: options?.[0]?.end ?? 100
      };
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element.current!);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, [preferences.renderer, language]);
  useEffect(() => {
    try {
      chart.current!.setOption(mergeOptions(themeChart(option, theme), parseOptions(preferences.advanced)) as EChartsOption, {
        notMerge: true
      });
      zoom.current = {
        start: 0,
        end: 100
      };
      setError('');
    } catch {
      chart.current!.clear();
      setError('Diese Optionskombination kann nicht dargestellt werden. Optionen korrigieren oder Einstellungen zurücksetzen.');
    }
  }, [option, preferences.renderer, theme, language]);
  function changeZoom(factor: number) {
    const current = zoom.current,
      width = Math.min(100, Math.max(.1, (current.end - current.start) * factor));
    const start = Math.max(0, Math.min(100 - width, (current.start + current.end - width) / 2));
    zoom.current = {
      start,
      end: start + width
    };
    chart.current?.dispatchAction({
      type: 'dataZoom',
      ...zoom.current
    });
  }
  return <>{error && <p role="alert" className="warning">{localizeText(error)}</p>}<div ref={element} className="metric-detail-chart" role="img" aria-label={t("Messwertdiagramm; Werte auch in der Tabelle")} style={{
      height: preferences.height
    }} />
    <div className="toolbar" aria-label={t("Diagrammwerkzeuge")}><Button onClick={() => changeZoom(.5)}>{t("Vergrößern")}</Button><Button onClick={() => changeZoom(2)}>{t("Verkleinern")}</Button><Button onClick={() => {
        zoom.current = {
          start: 0,
          end: 100
        };
        chart.current?.dispatchAction({
          type: 'dataZoom',
          ...zoom.current
        });
      }}>{t("Gesamter Zeitraum")}</Button>
    <Button disabled={!!error} onClick={() => {
        try {
          const a = document.createElement('a');
          a.href = chart.current!.getDataURL({
            type: preferences.renderer === 'svg' ? 'svg' : 'png',
            pixelRatio: 2,
            backgroundColor: chartBackground(theme)
          });
          a.download = 'messwertdiagramm.' + (preferences.renderer === 'svg' ? 'svg' : 'png');
          a.click();
        } catch {
          setError('Bildexport fehlgeschlagen. Externe Bildressourcen können den Export verhindern.');
        }
      }}>{t("Diagrammbild speichern")}</Button></div></>;
}
export default function MetricChartDialog({
  metricKey,
  label,
  onClose
}: {
  metricKey: string;
  label: string;
  onClose: () => void;
}) {
  const language = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const isDallas = metricKey.startsWith('ds18b20_');
  const displayLabel = isDallas ? label : localizeText(label);
  const [preferences, setPreferences] = useState(() => readPreferences(metricKey));
  const [draft, setDraft] = useState(preferences.advanced);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(30);
  const [range, setRange] = useState(() => {
    const to = Date.now();
    return {
      from: to - 6 * 3600000,
      to
    };
  });
  const [from, setFrom] = useState(new Date(range.from).toISOString().slice(0, 16));
  const [to, setTo] = useState(new Date(range.to).toISOString().slice(0, 16));
  const [refresh, setRefresh] = useState(0);
  const isError = metricKey === 'activeError';
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current!.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (isError) return;
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError('');
    const get = async (path: string) => {
      const response = await sessionFetch(path, {
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Verlauf konnte nicht geladen werden. Bitte erneut versuchen.');
      return response.json();
    };
    void (async () => {
      try {
        const storage = await get('/api/v1/storage');
        const bucket = Math.max(storage.sampleSeconds, Math.ceil((range.to - range.from) / 1000 / 800 / storage.sampleSeconds) * storage.sampleSeconds);
        const intervals = ['heatpumpState', 'internalHeaterState', 'threeWayValveState'].includes(metricKey);
        const result = await get('/api/v1/history' + (intervals ? '/intervals' : '') + '?' + new URLSearchParams({
          keys: metricKey,
          from: new Date(range.from).toISOString(),
          to: new Date(range.to).toISOString(),
          bucketSeconds: String(bucket)
        }));
        if (!controller.signal.aborted) {
          setStep(storage.sampleSeconds);
          setData(result);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [metricKey, range, refresh, isError]);
  const option = useMemo(() => data?.series.length ? metricOptions(data, label, preferences) : null, [data, label, preferences, language]);
  function save(next: Preferences) {
    setPreferences(next);
    try {
      localStorage.setItem('heishamon-cockpit.chart.v1.' + metricKey, JSON.stringify(next));
      setNotice('Einstellungen für diesen Messwert gespeichert.');
    } catch {
      setNotice('Einstellungen gelten nur für diese Sitzung; Browserspeicher nicht verfügbar.');
    }
  }
  function choose(next: typeof range) {
    setRange(next);
    setFrom(new Date(next.from).toISOString().slice(0, 16));
    setTo(new Date(next.to).toISOString().slice(0, 16));
  }
  async function csv() {
    try {
      const response = await sessionFetch('/api/v1/export.csv?' + new URLSearchParams({
        keys: metricKey,
        from: new Date(range.from).toISOString(),
        to: new Date(range.to).toISOString()
      }));
      if (!response.ok) throw new Error('CSV-Export fehlgeschlagen.');
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename(displayLabel + t(' – Diagramm'), 'csv');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('CSV-Export fehlgeschlagen.');
    }
  }
  const states = data?.series[0]?.aggregation !== 'mean';
  return <dialog ref={dialog} className="metric-dialog" aria-labelledby="metric-dialog-title" onCancel={onClose}>
    <header><LanguagePicker /><div><p className="field-note">{t(isDallas ? 'Dallas-1-Wire · Messwertdetails' : 'Übersicht · Messwertdetails')}</p><h2 id="metric-dialog-title">{displayLabel}{t(" – Diagramm")}</h2></div><Button autoFocus onClick={onClose} aria-label={t("Diagramm schließen")}>{t("Schließen ✕")}</Button></header>
    {isError ? <><p>{t("Fehlercodes sind Textwerte und werden als gespeicherte Ereignisse angezeigt, nicht als erfundene Zahlenkurve.")}</p><EventsPanel initialKind="error" /></> : <>
      <div className="toolbar"><label>{t("Zeitraum")}<select defaultValue="6" onChange={e => {
            const end = Date.now();
            choose({
              from: end - Number(e.target.value) * 3600000,
              to: end
            });
          }}><option value="1">{t("Letzte Stunde")}</option><option value="6">{t("Letzte 6 Stunden")}</option><option value="24">{t("Letzte 24 Stunden")}</option><option value="168">{t("Letzte 7 Tage")}</option><option value="720">{t("Letzte 30 Tage")}</option></select></label>
        <label>{t("Von (UTC)")}<input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} /></label><label>{t("Bis (UTC)")}<input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} /></label>
        <Button onClick={() => {
          const next = boundedRange(Date.parse(from + 'Z'), Date.parse(to + 'Z'));
          if (next && next.to <= Date.now()) {
            setError('');
            choose(next);
          } else setError('Gültigen Zeitraum bis jetzt wählen (höchstens 700 Tage).');
        }}>{t("Zeitraum anwenden")}</Button>
        <Button onClick={() => setRefresh(n => n + 1)}>{t("Neu laden")}</Button>
        <Button disabled={!data || loading || !csvAllowed(range, 1, step)} onClick={() => void csv()}>{t("Messwerte als CSV")}</Button>
      </div>
      {error && <p className="warning" role="alert">{localizeText(error)}</p>}{loading && <p role="status">{t("Messwertverlauf wird geladen …")}</p>}
      {data && <p className="field-note">{data.series[0]?.source === 'simulator' ? localizeText('SIMULATION · Simulierte Messwerte') : localizeText('MQTT · Aufgezeichnete Messwerte')} · {localizeText(chartTime(data.from))} – {localizeText(chartTime(data.to))}{t(" · Raster ")}{localizeText(data.bucketSeconds)}{t(" s · Einheit ")}{data.series[0]?.unit || localizeText('ohne Einheit')}</p>}
      {data && !data.series.some(s => localizeText(s.points.some(validPoint)) || s.intervals?.length) && <p>{t("Keine gültigen Messwerte im ausgewählten Zeitraum. Datenlücken bleiben leer.")}</p>}
      {data && !states && <TrendToggle checked={preferences.trend} onChange={trend => save({ ...preferences, trend })} />}
      {option && <ConfigurableChart option={option} preferences={preferences} />}
      <p className="field-note">{t("Zoom mit dem Schieberegler oder Strg + Mausrad. Die Tabelle zeigt bis zu 100 verdichtete Intervalle; CSV enthält die Rohwerte des gewählten Zeitraums (höchstens 30 Tage und 100.000 Werte). Erweiterte Optionen verändern nur die Darstellung.")}</p>
      <details><summary>{t("Diagramm anpassen")}</summary><div className="toolbar">
        <label>{t("Darstellung")}<select disabled={states} value={preferences.type} onChange={e => save({
              ...preferences,
              type: e.target.value as Preferences['type']
            })}><option value="line">{t("Linie")}</option><option value="bar">{t("Balken")}</option><option value="scatter">{t("Punkte")}</option></select></label>
        <label>{t("Farbe")}<input disabled={states} type="color" value={preferences.color} onChange={e => save({
              ...preferences,
              color: e.target.value
            })} /></label>
        <label><input type="checkbox" disabled={states} checked={preferences.area} onChange={e => save({
              ...preferences,
              area: e.target.checked
            })} />{t("Fläche")}</label>
        <label><input type="checkbox" disabled={states} checked={preferences.step} onChange={e => save({
              ...preferences,
              step: e.target.checked
            })} />{t("Stufenlinie")}</label>
        <label><input type="checkbox" disabled={states} checked={preferences.symbols} onChange={e => save({
              ...preferences,
              symbols: e.target.checked
            })} />{t("Messpunkte")}</label>
        <label>{t("Höhe")}<select value={preferences.height} onChange={e => save({
              ...preferences,
              height: Number(e.target.value)
            })}>{localizeText([300, 420, 600].map(n => <option key={n} value={n}>{localizeText(n)}{t(" px")}</option>))}</select></label>
        <label>{t("Renderer")}<select value={preferences.renderer} onChange={e => save({
              ...preferences,
              renderer: e.target.value as Preferences['renderer']
            })}><option value="svg">{t("SVG")}</option><option value="canvas">{t("Canvas")}</option></select></label>
      </div><label className="chart-options-label">{t("Erweiterte ECharts-Optionen (JSON)")}<textarea spellCheck={false} value={draft} onChange={e => setDraft(e.target.value)} /></label>
      <p>{t("Alle ECharts-Kernmodule sind geladen. JSON-Optionen werden über die Grundeinstellungen gelegt; Komponentenlisten werden positionsweise ergänzt. Beispiel: ")}<code>{'{"series":[{"markLine":{"data":[{"yAxis":40}]}}]}'}</code>{t(". Daten können mit eigenen Optionen überschrieben werden. JavaScript-Callbacks, externe Erweiterungen (z. B. ECharts GL) und zusätzliche Kartendaten sind hier nicht enthalten. ")}<a href="https://echarts.apache.org/en/option.html" target="_blank" rel="noreferrer">{t("ECharts-Optionsreferenz")}</a></p>
      <Button onClick={() => {
          try {
            parseOptions(draft);
            save({
              ...preferences,
              advanced: draft
            });
            setError('');
          } catch {
            setError('Ungültige Optionen: Ein gültiges JSON-Objekt mit höchstens 100.000 Zeichen wird erwartet.');
          }
        }}>{t("Optionen anwenden")}</Button>{localizeText(' ')}
      <Button onClick={() => {
          const next = {
            ...defaults
          };
          setDraft('{}');
          save(next);
          setError('');
        }}>{t("Einstellungen zurücksetzen")}</Button>
      {notice && <p role="status">{localizeText(notice)}</p>}</details>
      {preferences.advanced.trim() !== '{}' && <p className="warning">{t("Benutzerdefinierte ECharts-Optionen aktiv. Maßgeblich bleiben die Originalwerte in Tabelle und CSV.")}</p>}
      {data && <details><summary>{t("Originalwerte und Qualität (letzte 100 Einträge)")}</summary><div className="history-table-wrap"><table><thead><tr><th>{t("Zeit · Berlin")}</th><th>{t("Wert")}</th><th>{t("Qualität")}</th></tr></thead><tbody>{localizeText(data.series.flatMap(s => s.intervals ? s.intervals.slice(-100).map(p => <tr key={p.from}><td>{localizeText(chartTime(p.from))} – {localizeText(chartTime(p.to))}</td><td>{localizeText(p.value)}</td><td>{p.quality === 'valid' ? localizeText('Gültig') : localizeText('Unbekannt')}</td></tr>) : s.points.slice(-100).map(p => <tr key={p.time}><td>{localizeText(chartTime(p.time))}</td><td>{validPoint(p) ? localizeText(metricNumber(p.value!, s.key)) + localizeText(' ') + localizeText(s.unit) : localizeText('—')}</td><td>{localizeText({
                    valid: 'Gültig',
                    unknown: 'Unbekannt',
                    invalid: 'Ungültig',
                    stale: 'Veraltet'
                  }[p.quality]) ?? localizeText('Unbekannt')}</td></tr>)))}</tbody></table></div></details>}
    </>}
  </dialog>;
}
