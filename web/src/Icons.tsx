import type { ReactNode } from 'react';

export type IconName = 'home' | 'chart' | 'sliders' | 'bell' | 'settings' | 'lock' | 'thermometer' | 'delta' | 'cloud' | 'pump' | 'flow' | 'tank' | 'info' | 'download' | 'clock' | 'counter' | 'valve' | 'gauge';

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10" /></>,
  chart: <><path d="M4 3v17h17M7 15l4-5 4 3 5-8M17 5h3v3" /></>,
  sliders: <><path d="M3 6h5m4 0h9M3 12h11m4 0h3M3 18h3m4 0h11" /><circle cx="10" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9ZM10 21h4M12 1v2" /></>,
  settings: <><path d="m9 3 1-2h4l1 2 3 2 2 1-1 3v5l1 3-3 2-2 1-1 3h-4l-1-3-3-2-2-1 1-3V9L4 6l3-2Z" /><circle cx="12" cy="12" r="4" /></>,
  lock: <><rect x="5" y="10" width="14" height="12" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3" /></>,
  thermometer: <><path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM12 6v11" /></>,
  delta: <path d="m12 3 10 18H2Z" />,
  cloud: <path d="M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11Z" />,
  pump: <><rect x="2" y="4" width="20" height="16" rx="1" /><circle cx="9" cy="12" r="5" /><path d="M9 7v10m-5-5h10m-8.5-3.5 7 7m0-7-7 7M17 8h3m-3 4h3m-3 4h3M5 20v2m14-2v2" /></>,
  flow: <><path d="M3 21 6 10h13a2 2 0 0 1 0 4H9a2 2 0 0 0 0 4h9a2 2 0 0 1 0 4H9" /><path className="heat-lines" d="M9 7c3-2-3-3 0-6m5 6c3-2-3-3 0-6m5 6c3-2-3-3 0-6" /></>,
  tank: <><ellipse cx="12" cy="4" rx="7" ry="3" /><path d="M5 4v16c0 4 14 4 14 0V4M12 9c-4 5-4 7 0 7s4-2 0-7Z" /><path className="heat-lines" d="M10 20h4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-11v1" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2M12 3v1m9 8h-1M3 12h1m8 8v1" /></>,
  counter: <><rect x="2" y="6" width="20" height="13" rx="3" /><path d="M8 6v13m8-13v13M5 10v5m6-5h2v5h-2v-5m8 0v5M8 3h8" /></>,
  valve: <><circle cx="12" cy="12" r="4" /><path d="M2 10h6m-6 4h6m8-4h6m-6 4h6M10 16v6m4-6v6M1 8v8m22-8v8M8 23h8M12 8V3M8 3h8M10 12h2v2" /></>,
  gauge: <><circle cx="12" cy="11" r="9" /><path d="M9 20v3h6v-3M12 5v2M6 7l1.5 1.5M18 7l-1.5 1.5M5 12h2m10 0h2M12 11l3-3" /><circle cx="12" cy="11" r="1" /></>,
  download: <><path d="M12 2v13m-5-5 5 5 5-5M4 15v6h16v-6" /></>
};

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
