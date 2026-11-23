export type PlantValue = {
  key: string; value: number | string | boolean | null; unit: string;
  quality: 'unknown' | 'valid' | 'stale' | 'invalid'; retained: boolean;
  receivedAtUtc: string | null; sourceTopic?: string | null; alias?: string | null;
};
export type PlantSnapshot = { brokerConnected: boolean; deviceAvailability: string; values: PlantValue[] };
export type HouseTemperatureOptions = { enabled: boolean; input: { topic: string; payloadPath: string } };
export type PlantConfiguration = { houseTemperature: HouseTemperatureOptions; houseTargetTemperature: HouseTemperatureOptions; zones: 1 | 2; zone1: 'floor' | 'radiator'; zone2: 'floor' | 'radiator'; tank: boolean; buffer: boolean; sensors: boolean; motion: boolean; speed: number };
const defaults: PlantConfiguration = { houseTargetTemperature: { enabled: false, input: { topic: '', payloadPath: '' } }, houseTemperature: { enabled: false, input: { topic: '', payloadPath: '' } }, zones: 1, zone1: 'floor', zone2: 'radiator', tank: true, buffer: false, sensors: true, motion: true, speed: 1 };
export function readConfiguration(raw: string | null): PlantConfiguration {
  try {
    const v = JSON.parse(raw ?? '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...defaults };
    return { houseTargetTemperature: { enabled: v.houseTargetTemperature?.enabled === true, input: { topic: typeof v.houseTargetTemperature?.input?.topic === 'string' ? v.houseTargetTemperature.input.topic : '', payloadPath: typeof v.houseTargetTemperature?.input?.payloadPath === 'string' ? v.houseTargetTemperature.input.payloadPath : '' } }, houseTemperature: { enabled: v.houseTemperature?.enabled === true, input: { topic: typeof v.houseTemperature?.input?.topic === 'string' ? v.houseTemperature.input.topic : '', payloadPath: typeof v.houseTemperature?.input?.payloadPath === 'string' ? v.houseTemperature.input.payloadPath : '' } }, zones: v.zones === 2 ? 2 : 1, zone1: v.zone1 === 'radiator' ? 'radiator' : 'floor', zone2: v.zone2 === 'floor' ? 'floor' : 'radiator',
      tank: typeof v.tank === 'boolean' ? v.tank : true, buffer: v.buffer === true, sensors: v.sensors !== false, motion: v.motion !== false,
      speed: typeof v.speed === 'number' && Number.isFinite(v.speed) && v.speed >= .5 && v.speed <= 2 ? v.speed : 1 };
  } catch { return { ...defaults }; }
}
export function readNumber(values: readonly PlantValue[], key: string, connected: boolean): number | null {
  const v = values.find(value => value.key === key);
  return connected && v?.quality === 'valid' && !v.retained && v.receivedAtUtc !== null && Number.isFinite(Date.parse(v.receivedAtUtc)) && typeof v.value === 'number' && Number.isFinite(v.value) && !(v.unit === '°C' && v.value <= -78) ? v.value : null;
}
export function derivePlantState(snapshot: PlantSnapshot | null, live: boolean) {
  const connected = live && snapshot?.brokerConnected === true && snapshot.deviceAvailability === 'online';
  const number = (key: string) => readNumber(snapshot?.values ?? [], key, connected);
  const frequency = number('compressorFrequency'), flow = number('waterFlow'), fan = number('fanSpeed');
  const defrost = number('defrostState'), valve = number('threeWayValveState'), mode = number('operatingMode');
  const on = number('heatpumpState');
  const rawPumpSpeed = number('pumpSpeed');
  const pumpSpeed = rawPumpSpeed !== null && rawPumpSpeed >= 0 ? rawPumpSpeed : null;
  const running = connected && on === 1 && frequency !== null && frequency > 0;
  let activity: 'unknown' | 'off' | 'idle' | 'circulate' | 'heating' | 'dhw' | 'cooling' | 'defrost' | 'sterilization' = 'unknown';
  if (connected && defrost === 1) activity = 'defrost';
  else if (connected && on === 0) activity = 'off';
  else if (number('sterilizationState') === 1) activity = 'sterilization';
  else if (connected && frequency === 0) activity = pumpSpeed === null ? 'unknown' : pumpSpeed > 0 ? 'circulate' : 'idle';
  else if (running && defrost === 0 && valve === 1 && mode !== null && [3, 4, 5, 6, 8].includes(mode)) activity = 'dhw';
  else if (running && defrost === 0 && valve === 0 && mode !== null && [1, 5, 7, 8].includes(mode)) activity = 'cooling';
  else if (running && defrost === 0 && valve === 0 && mode !== null && [0, 2, 4, 6].includes(mode)) activity = 'heating';
  return { activity, connected, frequency, flow, pumpSpeed, fan, valve,
    pumpRunning: connected && pumpSpeed !== null && pumpSpeed > 0,
    fanRunning: connected && fan !== null && fan > 0 && defrost === 0,
    refrigerantRunning: running && activity !== 'unknown' };
}
