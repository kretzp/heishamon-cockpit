export type TimeRange = { from: number; to: number };
export const MAX_RANGE = 700 * 86400000;
export function zoomRange(range: TimeRange, factor: number, domain: TimeRange, minimum = 60000): TimeRange {
  const width = Math.min(domain.to - domain.from, Math.max(minimum, (range.to - range.from) * factor));
  const from = Math.max(domain.from, Math.min(domain.to - width, (range.from + range.to - width) / 2));
  return { from: Math.round(from), to: Math.round(from + width) };
}
export function boundedRange(from: number, to: number): TimeRange | null {
  return Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to > from && to - from <= MAX_RANGE ? { from, to } : null;
}
export function csvAllowed(range: TimeRange, keys: number, sampleSeconds: number) {
  return range.to - range.from <= 30 * 86400000 && Math.ceil((range.to - range.from) / (sampleSeconds * 1000)) * keys <= 100000;
}
