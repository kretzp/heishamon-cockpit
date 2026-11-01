import { useLanguage } from './i18n/Language';
import { t } from './i18n/core';

export function Brand({ plantName }: { plantName?: string }) {
  useLanguage();
  const customName = plantName && !/^HeishaMon Cockpit$/i.test(plantName.trim());
  return <div className="brand">
    <svg className="brand-mark" viewBox="0 0 56 56" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="54" height="54" rx="15" fill="#173c4e" stroke="#6297aa" />
      <path d="M11 26 28 12l17 14M16 23v20h24V23" fill="none" stroke="#a7e2e8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 36c-4-4 4-5 0-10m6 10c-4-4 4-5 0-10m6 10c-4-4 4-5 0-10" fill="none" stroke="#ffc07b" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <span><span className="brand-title">{t('HeishaMon Cockpit')}</span>{customName && <small className="brand-plant-name">{plantName}</small>}</span>
  </div>;
}
