import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { getLocale, t } from './i18n/core';
import { useLanguage } from './i18n/Language';
import { metricNumber } from './charts/chartFormat';
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
};

export function DallasOneWirePanel({ values, live, now, brokerConnected, deviceAvailability, openChart }: Props) {
  useLanguage();
  return <section className="temperature-grid dallas-grid" aria-label="Dallas-1-Wire">
    {values.map(value => {
      const offline = !live || !brokerConnected || deviceAvailability === 'offline';
      const status = offline ? t('Offline') : {
        valid: 'OK', stale: t('Veraltet'), invalid: t('Ungültig'), unknown: t('Unbekannt')
      }[value.quality];
      const ok = !offline && value.quality === 'valid';
      const address = value.key.slice('ds18b20_'.length);
      const label = dallasLabel(value);
      const number = value.quality !== 'invalid' && value.quality !== 'unknown' && typeof value.value === 'number' && Number.isFinite(value.value)
        ? metricNumber(value.value, value.key) : '—';
      return <Card asChild key={value.key}><article className="metric dallas-metric" aria-label={`${label} · ${address}`}>
        <div className="metric-top"><h2 className="metric-heading">{label}</h2><Badge variant="secondary" className={'quality dallas-status' + (ok ? '' : ' dallas-status-error')}>{status}</Badge></div>
        <p className="dallas-address">{t('Sensoradresse')}: <code>{address}</code></p>
        <p className="value">{number} <span>{number !== '—' ? '°C' : ''}</span></p>
        <p className="age">{value.receivedAtUtc ? <><time dateTime={value.receivedAtUtc}>{t('Empfangen ')}{new Intl.DateTimeFormat(getLocale(), {
          timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date(value.receivedAtUtc))}</time><span className="age-elapsed">{t(' · vor {0} s', [Math.max(0, Math.floor((now - Date.parse(value.receivedAtUtc)) / 1000))])}</span></> : t('Noch kein Messwert')}</p>
        {value.retained && <p className="note">{t('Retained · historische Nachricht')}</p>}
        <Button className="metric-chart-open" aria-label={`${label} · ${address}${t(' – Diagramm öffnen')}`} onClick={() => openChart(value.key)} />
      </article></Card>;
    })}
  </section>;
}
