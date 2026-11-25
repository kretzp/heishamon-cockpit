import { useEffect, useState } from 'react';

export const chartPreferencesChanged = 'cockpit-chart-preferences-changed';

export function useChartPreferencesRevision() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const update = () => setRevision(value => value + 1);
    window.addEventListener(chartPreferencesChanged, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(chartPreferencesChanged, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return revision;
}

export function readTrendPreference(key: string): boolean {
  try {
    const value = JSON.parse(localStorage.getItem('heishamon-cockpit.trend.v1.' + key) ?? 'null');
    return typeof value === 'boolean' ? value : true;
  } catch { return true; }
}

export function useTrendPreference(key: string) {
  const [current, setCurrent] = useState(() => ({ key, value: readTrendPreference(key) }));
  useEffect(() => {
    const update = (event: Event) => {
      if (event instanceof StorageEvent ? event.key !== null && event.key !== 'heishamon-cockpit.trend.v1.' + key
        : (event as CustomEvent).detail !== key) return;
      setCurrent({ key, value: readTrendPreference(key) });
    };
    setCurrent({ key, value: readTrendPreference(key) });
    window.addEventListener(chartPreferencesChanged, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(chartPreferencesChanged, update);
      window.removeEventListener('storage', update);
    };
  }, [key]);
  const value = current.key === key ? current.value : readTrendPreference(key);
  const [notice, setNotice] = useState('');
  function save(next: boolean) {
    setCurrent({ key, value: next });
    try {
      localStorage.setItem('heishamon-cockpit.trend.v1.' + key, JSON.stringify(next));
      setNotice('');
      window.dispatchEvent(new CustomEvent(chartPreferencesChanged, { detail: key }));
    } catch {
      setNotice('Einstellungen gelten nur für diese Sitzung; Browserspeicher nicht verfügbar.');
    }
  }
  return [value, save, notice] as const;
}
