import { useEffect, useState } from 'react';
import { sessionFetch } from '../Access';
import type { History, PairResult } from './historyOptions';
import type { TimeRange } from './historyRange';
async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await sessionFetch(path, { signal, cache: 'no-store' });
  if (!response.ok) { const p = await response.json().catch(() => ({})); throw new Error(p.title ?? 'Verlauf nicht verfügbar.'); }
  return response.json();
}
type Bundle = { data: History | null; phases: History | null; pairs: PairResult | null; sampleSeconds: number; analysisWarning: string };
export function useHistoryData(range: TimeRange, keys: string, compact: boolean, refresh: number, kind = 'temperature') {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout>;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const storage = await get<{ sampleSeconds: number }>('/api/v1/storage', controller.signal);
        const step = storage.sampleSeconds;
        const bucket = Math.max(step, Math.ceil((range.to - range.from) / 1000 / 800 / step) * step);
        const fetch = <T,>(path: string, selected: string) => get<T>(path + '?' + new URLSearchParams({ keys: selected,
          from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString(), bucketSeconds: String(bucket) }), controller.signal);
        const warnings: string[] = [];
        const intervals = (selected: string) => fetch<History>('/api/v1/history/intervals', selected).catch(async () => {
          warnings.push('Feine Zustandsintervalle nicht verfügbar; Anzeige aus verdichteter Historie.');
          return { ...await fetch<History>('/api/v1/history', selected), resolution: 'bucketed' as const };
        });
        const [data, phases, pairs] = await Promise.all([
          kind === 'efficiency' ? Promise.resolve(null) : kind === 'state' ? intervals(keys) : fetch<History>('/api/v1/history', keys),
          kind === 'temperature' && !compact ? intervals('sterilizationState') : null,
          kind === 'temperature' ? fetch<PairResult>('/api/v1/history/pairs', 'flowTemperature,returnTemperature').catch(() => {
            warnings.push('Paaranalyse nicht verfügbar; Spreizungsband bleibt leer.'); return null;
          }) : null
        ]);
        if (!controller.signal.aborted) setBundle({ data, phases, pairs, sampleSeconds: step, analysisWarning: warnings.join(' ') });
      } catch (e) {
        if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Verlauf nicht verfügbar.'); retry = setTimeout(() => void load(), 5000); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => { controller.abort(); clearTimeout(retry); };
  }, [range.from, range.to, keys, compact, refresh, kind]);
  return { bundle, loading, error };
}
