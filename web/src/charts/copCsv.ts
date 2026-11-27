import { copDisplayPoints, type CopResult } from './efficiencyOptions.ts';
import { csvDocument } from './csvExport.ts';

export function copCsv(result: CopResult): string {
  return csvDocument(['timeUtc', 'mode', 'cop', 'average', 'validSeconds', 'expectedSeconds',
    'source', 'electricalSource', 'bucketSeconds', 'windowMinutes'], copDisplayPoints(result).map(p => [
    p.time, p.mode, p.cop, p.average, p.validSeconds, p.expectedSeconds,
    result.source, result.electricalSource, result.bucketSeconds, result.windowMinutes
  ]));
}
