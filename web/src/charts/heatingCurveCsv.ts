import { curveMarker, curveValue, type CurveValues } from '../heatingCurveMath.ts';
import { csvDocument } from './csvExport.ts';

export function heatingCurveCsv(c: CurveValues, outside: number | null): string {
  const marker = curveMarker(outside);
  const min = Math.floor(Math.min(-20, marker ?? 0) / 5) * 5;
  const max = Math.ceil(Math.max(25, c.heatingOffTemperature + 5, marker ?? 0) / 5) * 5;
  const xs = [...new Set([min, c.xCold, c.xWarm, c.heatingOffTemperature, max])].sort((a, b) => a - b);
  return csvDocument(['outsideTemperatureC', 'calculatedFlowTargetC', 'heatingOffTemperatureC', 'heatDeltaK'],
    xs.map(x => [x, curveValue(c, x), c.heatingOffTemperature, c.heatDelta]));
}
