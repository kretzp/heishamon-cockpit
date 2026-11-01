import { t, text as localizeText, getLocale } from "./i18n/core";
import { useLanguage } from "./i18n/Language";
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button } from './components/ui/button';
export type Theme = 'light' | 'dark' | 'nordic';
const key = 'heishamon-cockpit.theme.v1';
const valid = (value: unknown): value is Theme => ['light', 'dark', 'nordic'].includes(String(value));
function readTheme(): Theme {
  try {
    const value = localStorage.getItem(key);
    return valid(value) ? value : 'light';
  } catch {
    return 'light';
  }
}
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
}
const ThemeContext = createContext<{
  theme: Theme;
  choose: (theme: Theme) => void;
  notice: string;
}>({
  theme: 'light',
  choose: () => {},
  notice: ''
});
export function ThemeProvider({
  children
}: {
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    applyTheme(theme);
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        setTheme(readTheme());
        setNotice('');
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [theme]);
  function choose(next: Theme) {
    applyTheme(next);
    setTheme(next);
    try {
      localStorage.setItem(key, next);
      setNotice('');
    } catch {
      setNotice('Design gilt nur für diese Sitzung: Browserspeicher nicht verfügbar.');
    }
  }
  return <ThemeContext.Provider value={{
    theme,
    choose,
    notice
  }}>{localizeText(children)}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
export function ThemePicker() {
  const language = useLanguage();
  const {
    theme,
    choose,
    notice
  } = useTheme();
  return <div className="theme-picker">
    <div className="theme-options" role="group" aria-label={t("Darstellung")}>
      {localizeText(([['light', 'Hell'], ['dark', 'Dunkel'], ['nordic', 'Nordisch']] as const).map(([value, label]) => <Button key={value} type="button" variant="ghost" aria-pressed={theme === value} onClick={() => choose(value)}>
          <span className={'theme-swatch swatch-' + value} aria-hidden="true" />{localizeText(label)}
        </Button>))}
    </div>
    {notice && <small role="status">{localizeText(notice)}</small>}
  </div>;
}
