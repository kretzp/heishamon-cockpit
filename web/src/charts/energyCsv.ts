import type { EnergyResult } from './efficiencyOptions';

export function energyCsv(result: EnergyResult): string {
  const cell = (value: string | number | null | undefined) => {
    if (value == null) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
    return '"' + (/^[=+\-@\t\r\n]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"';
  };
  const rows = result.days.filter(d => d.status !== 'future').map(d => [
    d.date, d.kwh, d.minOutdoorTemperatureC, d.outdoorTemperatureSamples,
    d.validSeconds, d.expectedSeconds, d.status, result.timeZone, result.source, result.electricalSource,
    d.heatpumpKwh, d.heaterKwh, d.heatpumpValidSeconds, d.heaterValidSeconds
  ].map(cell).join(';'));
  return '\uFEFFdate;consumptionKwh;minOutdoorTemperatureC;outdoorTemperatureSamples;validSeconds;expectedSeconds;status;timeZone;source;electricalSource;heatpumpKwh;heaterKwh;heatpumpValidSeconds;heaterValidSeconds\r\n' + rows.join('\r\n') + '\r\n';
}
