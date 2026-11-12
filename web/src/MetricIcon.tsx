import type { ReactNode } from 'react';

// Approved style B: exact geometry from design/icon-proposals/symbols-b.svg.
const shapes = {
  "relay": <><rect x="7" y="7" width="34" height="34" rx="5" /><path d="M3 30h12 M33 30h12 M17 28l14-11 M17 7V3 M31 7V3 M17 41v4 M31 41v4" /><circle cx="17" cy="30" r="2" /><circle cx="31" cy="30" r="2" /></>,
  "flow": <><path d="M12 29V11a5 5 0 0 1 10 0v18a8 8 0 1 1-10 0Z M17 14v20"></path><circle cx="17" cy="35" r="2"></circle><path d="M28 18h14 M37 13l5 5-5 5"></path></>,
  "return": <><path d="M12 29V11a5 5 0 0 1 10 0v18a8 8 0 1 1-10 0Z M17 14v20"></path><circle cx="17" cy="35" r="2"></circle><path d="M42 18H28 M33 13l-5 5 5 5"></path></>,
  "spread": <><path d="m24 8 17 30H7Z M18 29h12 M24 23v6"></path></>,
  "outside": <><circle cx="17" cy="15" r="7"></circle><path d="M17 3v3 M5 15H2 M8 6l3 3 M27 5l-3 4 M29 15h4 M12 36a7 7 0 0 1 0-14 9 9 0 0 1 17-1 7 7 0 1 1 5 15Z"></path></>,
  "inside": <><path d="m5 22 19-16 19 16 M10 20v21h28V20 M20 33V21a4 4 0 0 1 8 0v12a6 6 0 1 1-8 0Z"></path></>,
  "water": <><ellipse cx="23" cy="10" rx="12" ry="5"></ellipse><path d="M11 10v27c0 7 24 7 24 0V10 M11 34c5 5 19 5 24 0"></path><path d="M23 16c-3 4-5 6-5 9a5 5 0 0 0 10 0c0-3-2-5-5-9Z"></path></>,
  "compressor": <><rect x="10" y="12" width="28" height="27" rx="7"></rect><path d="M17 12V7h14v5 M6 23h4 M38 30h5 M15 39v4 M33 39v4 M17 27c4-13 10 13 14 0"></path></>,
  "flowrate": <><path d="M5 14h32 M32 9l5 5-5 5 M43 34H11 M16 29l-5 5 5 5 M23 19c-2 3-4 5-4 7a4 4 0 0 0 8 0c0-2-2-4-4-7Z"></path></>,
  "pump": <><circle cx="23" cy="25" r="12"></circle><path d="M11 25H5v-9h13 M35 25h8v9H28 M23 13V7 M19 7h8 M19 21l8 4-8 4Z"></path></>,
  "fan": <><circle cx="24" cy="24" r="3"></circle><path d="M22 20c-9-8-7-15 0-15 8 0 9 9 4 15 M28 24c11-3 16 3 12 9-5 7-13 2-14-5 M22 28c-2 12-10 14-13 7-4-8 4-13 11-11"></path></>,
  "current": <><path d="m26 5-13 21h10l-2 17 14-23H25Z"></path></>,
  "highpressure": <><circle cx="24" cy="22" r="16"></circle><path d="M19 38v5h10v-5 M24 10v3 M13 17l3 2 M35 17l-3 2 M12 27h3 M36 27h-3 M24 22l7-6"></path><circle cx="24" cy="22" r="2"></circle><path d="M4 7V2 M1 5l3-3 3 3"></path></>,
  "hours": <><circle cx="24" cy="25" r="17"></circle><path d="M24 15v11l8 5 M19 3h10"></path></>,
  "counter": <><rect x="5" y="13" width="38" height="24" rx="5"></rect><path d="M17 13v24 M30 13v24 M10 20v10 M22 20h4v10h-4Z M35 20v10 M17 7h14"></path></>,
  "valve": <><circle cx="24" cy="24" r="8"></circle><path d="M3 20h13 M3 28h13 M32 20h13 M32 28h13 M20 32v13 M28 32v13 M24 16V6 M17 6h14 M3 16v16 M45 16v16 M16 45h16"></path></>,
  "pressure": <><circle cx="24" cy="22" r="16"></circle><path d="M19 38v5h10v-5 M24 10v3 M13 17l3 2 M35 17l-3 2 M12 27h3 M36 27h-3 M24 22l7-6"></path><circle cx="24" cy="22" r="2"></circle></>,
  "electricheat": <><path d="m26 5-13 21h10l-2 17 14-23H25Z"></path><path d="M4 40h6 M38 40h6"></path></>,
  "thermalheat": <><path d="M16 17c-5-5 5-5 0-10 M24 17c-5-5 5-5 0-10 M32 17c-5-5 5-5 0-10"></path><rect x="8" y="23" width="32" height="18" rx="4"></rect><path d="M16 27v10 M24 27v10 M32 27v10"></path></>,
  "electricwater": <><ellipse cx="23" cy="10" rx="12" ry="5"></ellipse><path d="M11 10v27c0 7 24 7 24 0V10 M11 34c5 5 19 5 24 0"></path><path d="m25 17-7 10h6l-2 7 8-12h-6Z"></path></>,
  "thermalwater": <><ellipse cx="23" cy="10" rx="12" ry="5"></ellipse><path d="M11 10v27c0 7 24 7 24 0V10 M11 34c5 5 19 5 24 0"></path><path d="M19 28c-4-4 4-5 0-9 M27 28c-4-4 4-5 0-9"></path></>,
  "heatpump": <><rect x="5" y="10" width="38" height="29" rx="5"></rect><circle cx="20" cy="24" r="9"></circle><path d="M20 15v18 M11 24h18 M34 18h4 M34 24h4 M34 30h4 M11 39v4 M37 39v4"></path></>,
  "heater": <><path d="M7 33h7V16a4 4 0 0 1 8 0v16a4 4 0 0 0 8 0V16a4 4 0 0 1 8 0v17h4 M7 28v10 M42 28v10"></path></>,
  "regulation": <><path d="M8 7v34h33 M14 32c8-1 10-14 22-18"></path><circle cx="15" cy="31" r="2"></circle><circle cx="36" cy="14" r="2"></circle></>,
  "error": <><path d="m24 6 19 33H5Z M24 17v11"></path><circle cx="24" cy="33" r="1"></circle></>,
} satisfies Record<string, ReactNode>;

export type MetricIconName = keyof typeof shapes;
export const metricIconNames: Record<string, MetricIconName> = {
  "relayOne": "relay",
  "relayTwo": "relay",
  "alternativeHeatpumpPower": "electricheat",
  "alternativeHeaterPower": "heater",
  "heishamonCop": "regulation",
  "flowTemperature": "flow",
  "returnTemperature": "return",
  "temperatureSpread": "spread",
  "outsideTemperature": "outside",
  "indoorTemperature": "inside",
  "indoorTargetTemperature": "inside",
  "dhwTemperature": "water",
  "dhwTargetTemperature": "water",
  "dhwHeatDelta": "spread",
  "compressorFrequency": "compressor",
  "waterFlow": "flowrate",
  "pumpSpeed": "pump",
  "fanSpeed": "fan",
  "compressorCurrent": "current",
  "highPressure": "highpressure",
  "operationsHours": "hours",
  "operationsCounter": "counter",
  "threeWayValveState": "valve",
  "waterPressure": "pressure",
  "heatPowerConsumption": "electricheat",
  "heatPowerProduction": "thermalheat",
  "dhwPowerConsumption": "electricwater",
  "dhwPowerProduction": "thermalwater",
  "heatpumpState": "heatpump",
  "internalHeaterState": "heater",
  "heatingControlMode": "regulation",
  "activeError": "error",
  "operatingMode": "heatpump",
  "quietMode": "fan",
  "sterilizationState": "water",
  "sterilizationTemperature": "water",
  "sterilizationMaxTime": "hours"
};

export function MetricIcon({ name }: { name: MetricIconName }) {
  return <svg className="icon metric-icon metric-icon-b" data-metric-icon={name} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="24" cy="25" r="19" fill="currentColor" fillOpacity=".10" stroke="none" />
    {shapes[name]}
    <path d="M18 44h12" stroke="var(--metric-icon-accent)" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
