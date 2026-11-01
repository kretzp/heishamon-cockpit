import { useId } from 'react';
import { t } from '../i18n/core';

export function TrendToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const help = useId();
  return <div className="trend-control">
    <label><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-describedby={help} /> {t('Geglättete Trendkurve (Fit)')}</label>
    <p id={help} className="field-note">{t('Gepunktet: berechneter Trend aus bis zu 11 benachbarten Werten. Mindestens 3 zusammenhängende gültige Werte; Datenlücken bleiben leer. Messwerte, Tabellen und CSV bleiben unverändert.')}</p>
  </div>;
}
