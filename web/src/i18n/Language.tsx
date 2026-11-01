import { useEffect, useState, useSyncExternalStore } from 'react';
import { getLanguage, isLanguage, languageStorageKey, readLanguage, setLanguage, subscribeLanguage, t } from './core';

export const useLanguage = () => useSyncExternalStore(subscribeLanguage, getLanguage, () => 'de' as const);
export function LanguagePicker() {
  const language = useLanguage();
  const [sessionOnly, setSessionOnly] = useState(false);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === languageStorageKey || event.key === null) { setLanguage(readLanguage()); setSessionOnly(false); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return <div className="language-picker">
    <label>{t('Sprache')}<select data-testid="language-picker" value={language} onChange={event => {
      const next = event.target.value;
      if (!isLanguage(next)) return;
      setLanguage(next);
      try { localStorage.setItem(languageStorageKey, next); setSessionOnly(false); }
      catch { setSessionOnly(true); }
    }}>
      <option value="de" lang="de">Deutsch</option><option value="en" lang="en">English</option>
      <option value="fr" lang="fr">Français</option><option value="es" lang="es">Español</option>
      <option value="it" lang="it">Italiano</option>
      <option value="pt" lang="pt">Português</option>
    </select></label>
    {sessionOnly && <small role="status">{t('Sprache gilt nur für diese Sitzung: Browserspeicher nicht verfügbar.')}</small>}
  </div>;
}
