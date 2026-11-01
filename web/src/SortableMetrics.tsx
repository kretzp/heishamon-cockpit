import { t, text as localizeText, getLocale } from "./i18n/core";
import { useLanguage } from "./i18n/Language";
import { Button } from './components/ui/button';
import { useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import './sortable-metrics.css';
const storageKey = 'heishamon-cockpit.overview-order.v1';
type Orders = Record<string, string[]>;
function readOrders(): Orders {
  const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => Array.isArray(v) && v.every(k => typeof k === 'string')));
}
export function normalizeOrder(saved: string[] | undefined, defaults: readonly string[]) {
  return [...new Set([...(saved ?? []).filter(key => defaults.includes(key)), ...defaults])];
}
export function useMetricOrder() {
  const [orders, setOrders] = useState<Orders>(() => {
    try {
      return readOrders();
    } catch {
      return {};
    }
  });
  const [error, setError] = useState('');
  function save(group: string, keys: string[]) {
    const next = {
      ...orders,
      [group]: keys
    };
    setOrders(next);
    try {
      // Preserve other groups when another tab has recently saved them.
      let stored: Orders = {};
      try {
        stored = readOrders();
      } catch {/* Replace malformed stored data. */}
      localStorage.setItem(storageKey, JSON.stringify({
        ...stored,
        [group]: keys
      }));
      setError('');
    } catch {
      setError('Reihenfolge nur für diese Sitzung geändert: Der Browser konnte sie nicht dauerhaft speichern.');
    }
  }
  return {
    orders,
    save,
    error
  };
}
type CardAttributes = HTMLAttributes<HTMLElement> & {
  'data-sort-key': string;
};
type Props = {
  group: string;
  label: string;
  className: string;
  editing: boolean;
  keys: string[];
  labels: Record<string, string>;
  save: (group: string, keys: string[]) => void;
  render: (key: string, attributes: CardAttributes, controls: ReactNode) => ReactNode;
};
export function SortableMetrics({
  group,
  label,
  className,
  editing,
  keys,
  labels,
  save,
  render
}: Props) {
  const language = useLanguage();
  const root = useRef<HTMLElement>(null);
  const drag = useRef<{
    key: string;
    pointer: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<{ key: string; position: number; total: number } | null>(null);
  function move(key: string, index: number) {
    const from = keys.indexOf(key);
    if (from < 0 || index < 0 || index >= keys.length || index === from) return;
    const next = [...keys];
    next.splice(from, 1);
    next.splice(index, 0, key);
    save(group, next);
    setAnnouncement({ key, position: index + 1, total: next.length });
  }
  function hit(x: number, y: number) {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-sort-key]');
    return element && element.closest('[data-sort-group]') === root.current ? element.dataset.sortKey ?? null : null;
  }
  function cancel() {
    drag.current = null;
    setDragKey(null);
    setTarget(null);
  }
  return <section ref={root} className={className + (editing ? ' sorting-enabled' : '')} aria-label={localizeText(label)} data-sort-group={group}>
    {localizeText(keys.map((key, index) => render(key, {
      'data-sort-key': key,
      className: [dragKey === key ? 'sort-source' : '', target === key && dragKey !== key ? 'sort-target' : ''].join(' ')
    }, editing && <div className="sort-controls">
      <Button type="button" className="sort-handle" aria-label={t('{0} verschieben', [t(labels[key])])} aria-describedby="sort-instructions" onKeyDown={e => {
        if (e.key === 'Escape') {
          cancel();
          return;
        }
        const offset = ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : 0;
        if (offset) {
          e.preventDefault();
          move(key, index + offset);
        }
      }} onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          key,
          pointer: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          moved: false
        };
        setDragKey(key);
      }} onPointerMove={e => {
        const current = drag.current;
        if (!current || current.pointer !== e.pointerId) return;
        if (Math.hypot(e.clientX - current.x, e.clientY - current.y) > 5) current.moved = true;
        if (!current.moved) return;
        setTarget(hit(e.clientX, e.clientY));
        if (e.clientY < 60) window.scrollBy(0, -20);else if (e.clientY > innerHeight - 60) window.scrollBy(0, 20);
      }} onPointerUp={e => {
        const current = drag.current;
        if (!current || current.pointer !== e.pointerId) return;
        const destination = hit(e.clientX, e.clientY);
        if (current.moved && destination) move(current.key, keys.indexOf(destination));
        cancel();
      }} onPointerCancel={cancel} onLostPointerCapture={cancel}><span aria-hidden="true">⠿</span></Button>
      <Button type="button" aria-label={t('{0} nach vorne', [t(labels[key])])} disabled={index === 0} onClick={() => move(key, index - 1)}>←</Button>
      <Button type="button" aria-label={t('{0} nach hinten', [t(labels[key])])} disabled={index === keys.length - 1} onClick={() => move(key, index + 1)}>→</Button>
    </div>)))}
    <span className="sort-announcement" role="status" aria-live="polite">{announcement && t('{0} auf Position {1} von {2}', [t(labels[announcement.key]), announcement.position, announcement.total])}</span>
  </section>;
}
