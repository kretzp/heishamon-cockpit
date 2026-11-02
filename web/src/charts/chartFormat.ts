import { getLocale, text as localizeText, t as translate } from "../i18n/core.ts";
export const chartNumber = (value: number, pressure = false) => value.toLocaleString(getLocale(), pressure ? {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
} : {
  maximumFractionDigits: 2
});
export const chartTime = (value: number | string) => new Intl.DateTimeFormat(getLocale(), {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'shortOffset'
}).format(new Date(value));
export const axisTime = (value: number) => new Intl.DateTimeFormat(getLocale(), {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date(value)).replace(', ', '\n');
const colors: Record<string, string> = {
  flowTemperature: '#0964d8',
  returnTemperature: '#a63b15',
  outsideTemperature: '#247642',
  indoorTemperature: '#784ac2',
  dhwTemperature: '#aa2865',
  dhwTargetTemperature: '#71611a',
  temperatureSpread: '#177b83',
  dhwHeatDelta: '#7f4933',
  pumpSpeed: '#0964d8',
  fanSpeed: '#247642',
  compressorCurrent: '#784ac2',
  highPressure: '#a63b15',
  waterPressure: '#0964d8',
  heatPowerConsumption: '#0964d8',
  heatPowerProduction: '#a63b15',
  coolPowerConsumption: '#247642',
  coolPowerProduction: '#784ac2',
  dhwPowerConsumption: '#aa2865',
  dhwPowerProduction: '#71611a'
};
export const metricColor = (key: string) => colors[key] ?? '#40536b';
const operatingModes = ['Heizen', 'Kühlen', 'Auto (Heizen)', 'Warmwasser', 'Heizen + Warmwasser', 'Kühlen + Warmwasser', 'Auto (Heizen) + Warmwasser', 'Auto (Kühlen)', 'Auto (Kühlen) + Warmwasser'];
export function stateLabel(key: string, value: number): string | null {
  const names = key === 'quietMode' ? ['Aus', 'Stufe 1', 'Stufe 2', 'Stufe 3'] : key === 'heatingControlMode' ? [translate("Heizkurve"), translate("Festwert")] : key === 'operatingMode' ? operatingModes : key === 'threeWayValveState' ? [translate("Raumheizung"), translate("Warmwasser")] : key === 'sterilizationState' ? [translate("Inaktiv"), translate("Aktiv")] : ['heatpumpState', 'internalHeaterState', 'defrostState'].includes(key) ? [translate("Aus"), translate("Ein")] : [];
  return Number.isInteger(value) && names[value] !== undefined ? `${translate(names[value])} (${value})` : null;
}
export const stateColor = (value: number) => ['#526277', '#17633d', '#175ca0', '#86452d', '#67409a', '#8c345e', '#625710', '#006973', '#49429c'][value] ?? '#526277';

export const twoDecimalMetrics = ["flowTemperature", "returnTemperature", "temperatureSpread", "mainTargetTemperature", "curveYCold", "curveYWarm"];
export const metricNumber = (value: number, key: string, pressure = false) => chartNumber(value, pressure || key.replace(/^(?:trend:|pair:)/, '').startsWith('ds18b20_') || twoDecimalMetrics.includes(key.replace(/^(?:trend:|pair:)/, "")));
