export type CurveValues = { xCold: number; yCold: number; xWarm: number; yWarm: number; heatDelta: number; heatingOffTemperature: number };
export function curveValue(c: CurveValues, outside: number) {
  if (!Object.values(c).every(Number.isFinite) || !Number.isFinite(outside) || c.xCold >= c.xWarm) return null;
  return outside <= c.xCold ? c.yCold : outside >= c.xWarm ? c.yWarm : c.yCold + (outside - c.xCold) * curveSlope(c);
}
export function curveSlope(c: CurveValues) { return (c.yWarm - c.yCold) / (c.xWarm - c.xCold); }
export function temperatureTicks(min: number, max: number) {
  const start = Math.ceil(min / 5) * 5;
  return Array.from({ length: Math.max(0, Math.floor((max - start) / 5) + 1) }, (_, i) => start + i * 5);
}

// Plot bounds prevent extreme telemetry from creating millions of SVG ticks.
export function curveMarker(outside: number | null) {
  return outside !== null && Number.isFinite(outside) && outside >= -40 && outside <= 50 ? outside : null;
}
