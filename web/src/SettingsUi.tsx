import { type ChangeEventHandler, type ReactNode } from 'react';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { t } from './i18n/core';

export function SettingsToggle({ label, description, checked, disabled, onChange }: {
  label: string; description?: string; checked: boolean; disabled?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  return <label className="settings-option">
    <span className="settings-option-copy"><strong>{label}</strong>{description && <span className="settings-help">{description}</span>}</span>
    <span className="settings-toggle"><Input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={onChange} /><span className="settings-toggle-track" aria-hidden="true" /></span>
  </label>;
}
export function SettingsHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <header className="settings-panel-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</header>;
}
export function SettingsFooter({ dirty, busy, disabled, onDiscard, saveLabel, discardLabel }: {
  dirty: boolean; busy: boolean; disabled?: boolean; onDiscard: () => void;
  saveLabel: string; discardLabel?: string;
}) {
  return <footer className="settings-panel-footer"><span className={'settings-save-state' + (dirty ? ' unsaved' : '')} aria-live="polite">{t(dirty ? 'Nicht gespeicherte Änderungen' : 'Keine offenen Änderungen')}</span><div className="settings-actions"><Button type="button" disabled={busy} onClick={onDiscard}>{discardLabel ?? t('Verwerfen')}</Button><Button type="submit" className="primary" disabled={busy || disabled}>{saveLabel}</Button></div></footer>;
}
