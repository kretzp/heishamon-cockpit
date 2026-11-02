import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { getLocale, t } from './i18n/core';
import { useLanguage } from './i18n/Language';
import { metricNumber } from './charts/chartFormat';
import { SortableMetrics, normalizeOrder, useMetricOrder } from './SortableMetrics';
import './dallas-one-wire.css';

export type DallasValue = {
  key: string;
  alias?: string | null;
  value: number | string | boolean | null;
  quality: 'unknown' | 'valid' | 'stale' | 'invalid';
  receivedAtUtc: string | null;
  retained: boolean;
  sourceKind: string;
};

export const isDallasValue = (value: DallasValue): boolean => /^ds18b20_[0-9a-f]{16}$/.test(value.key) && ['mqtt', 'simulator'].includes(value.sourceKind);
export const dallasLabel = (value: DallasValue): string => value.alias || t('Dallas-Sensor');

type Props = {
  values: DallasValue[];
  live: boolean;
  now: number;
  brokerConnected: boolean;
  deviceAvailability: string;
  openChart: (key: string) => void;
  editing: boolean;
};

export function DallasOneWirePanel({ values, live, now, brokerConnected, deviceAvailability, openChart, editing }: Props) {
  useLanguage();
  const layout = useMetricOrder();
  const ordered = normalizeOrder(layout.orders.dallas, values.map(value => value.key));
  const hidden = layout.orders['dallas-hidden'] ?? [];
  const visible = ordered.filter(key => !hidden.includes(key));
  const labels = Object.fromEntries(values.map(value => [value.key, `${dallasLabel(value)} · ${value.key.slice('ds18b20_'.length)}`]));
  function saveOrder(group: string, keys: string[]) {
    let index = 0;
    layout.save(group, ordered.map(key => hidden.includes(key) ? key : keys[index++]));
  }
  return <>
    {layout.error && <p role="alert" className="warning">{t(layout.error)}</p>}
    {editing && <fieldset className="panel dallas-visibility"><legend>{t('Sichtbare Sensoren')}</legend>
      {ordered.map(key => <label key={key}><input type="checkbox" checked={!hidden.includes(key)} onChange={event =>
        layout.save('dallas-hidden', event.target.checked ? hidden.filter(item => item !== key) : [...hidden, key])} />{labels[key]}</label>)}
    </fieldset>}
    <SortableMetrics group="dallas" label="Dallas-1-Wire" className="temperature-grid dallas-grid" editing={editing}
      keys={visible} labels={labels} save={saveOrder} render={(key, attrs, controls) => {
      const value = values.find(value => value.key === key)!;
      const offline = !live || !brokerConnected || deviceAvailability === 'offline';
      const status = offline ? t('Offline') : {
        valid: 'OK', stale: t('Veraltet'), invalid: t('Ungültig'), unknown: t('Unbekannt')
      }[value.quality];
      const ok = !offline && value.quality === 'valid';
      const address = value.key.slice('ds18b20_'.length);
      const label = dallasLabel(value);
      const number = value.quality !== 'invalid' && value.quality !== 'unknown' && typeof value.value === 'number' && Number.isFinite(value.value)
        ? metricNumber(value.value, value.key) : '—';
      return <Card asChild key={value.key}><article {...attrs} className={'metric dallas-metric ' + attrs.className} aria-label={`${label} · ${address}`}>
        {controls}
        <div className="metric-top"><h2 className="metric-heading">{label}</h2><Badge variant="secondary" className={'quality dallas-status' + (ok ? '' : ' dallas-status-error')}>{status}</Badge></div>
        <p className="dallas-address">{t('Sensoradresse')}: <code>{address}</code></p>
        <p className="value">{number} <span>{number !== '—' ? '°C' : ''}</span></p>
        <p className="age">{value.receivedAtUtc ? <><time dateTime={value.receivedAtUtc}>{t('Empfangen ')}{new Intl.DateTimeFormat(getLocale(), {
          timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date(value.receivedAtUtc))}</time><span className="age-elapsed">{t(' · vor {0} s', [Math.max(0, Math.floor((now - Date.parse(value.receivedAtUtc)) / 1000))])}</span></> : t('Noch kein Messwert')}</p>
        {value.retained && <p className="note">{t('Retained · historische Nachricht')}</p>}
        {!editing && <Button className="metric-chart-open" aria-label={`${label} · ${address}${t(' – Diagramm öffnen')}`} onClick={() => openChart(value.key)} />}
      </article></Card>;
    }} />
  </>;
}
