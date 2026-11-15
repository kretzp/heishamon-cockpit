/* Presentation-only demo. No network requests and no device controls. */
const $ = id => document.getElementById(id);
const state = { scenario: 'heating', paused: false, tick: 0, group: 'Alle', component: 'pump' };
let deviceProfile = window.AquareaHousings.resolve('52');
const scenarios = {
  heating: { label: 'Heizbetrieb', flow: 34.5, back: 30.5, power: 1.24, heat: 5.82, hz: 34, fan: 420, rate: 20.8 },
  dhw: { label: 'Warmwasserbereitung', flow: 53, back: 48, power: 1.85, heat: 5.1, hz: 48, fan: 510, rate: 14.6 },
  cooling: { label: 'Kühlbetrieb', flow: 18, back: 22, power: 1.1, heat: 4.7, hz: 30, fan: 390, rate: 16.8 },
  defrost: { label: 'Abtauung', flow: 25, back: 28, power: 1.4, heat: 0, hz: 45, fan: 0, rate: 22 },
  idle: { label: 'Bereitschaft', flow: 25, back: 25, power: .018, heat: 0, hz: 0, fan: 0, rate: 0 },
  stale: { label: 'Daten veraltet', flow: 34.5, back: 30.5, power: 1.24, heat: 5.82, hz: 34, fan: 420, rate: 20.8 }
};
const groups = ['Alle', 'Hydraulik', 'Außeneinheit', 'Warmwasser', 'Heizkreise', 'Energie', 'Betrieb', 'Kältekreis', 'Erweiterung'];
const descriptions = {
  pump: ['Aquarea Außeneinheit', 'Lüfter und Verdichter machen aus Außenluft nutzbare Wärme. Die Animation folgt im späteren Betrieb den tatsächlichen Zuständen.'],
  water: ['Hydraulik', 'Die Primärpumpe bewegt Heizwasser durch den aktiven Pfad. Das 3-Wege-Ventil verteilt zwischen Heizung und Speicherladung.'],
  tank: ['Warmwasserspeicher', 'Die Speicherladung hat einen eigenen Flusspfad. Ein ausgeblendeter Speicher ist in der Demo auch als Szenario nicht auswählbar.'],
  zones: ['Heizkreise', 'Aquarea unterstützt bis zu zwei Zonen. Raum- und Wassertemperatur müssen abhängig von der Sensor-Konfiguration unterschieden werden.'],
  refrigerant: ['Kältekreis', 'Eine spätere Detailansicht ergänzt Druck, Heißgas und Expansionsventil. Zusätzliche Sensoren benötigen zunächst eine Katalog-Erweiterung.']
};
let current;
let metrics = [];
const format = (n, digits = 1) => n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const emitterLabel = id => $(id).value === 'radiator' ? 'Heizkörper' : 'Fußbodenheizung';
function renderHeatingSurfaces() {
  for (const zone of [1, 2]) {
    const radiator = $(`zone${zone}-emitter`).value === 'radiator';
    const x = 822, y = zone === 1 ? 179 : 343, width = 96, height = 56;
    let path = '';
    if (radiator) {
      path = `M${x} ${y + 5} H${x + width} M${x} ${y + height - 5} H${x + width}`;
      for (let n = 0; n < 7; n++) path += ` M${x + 5 + n * (width - 10) / 6} ${y} V${y + height}`;
    } else {
      path = `M${x} ${y} H${x + width} V${y + 14} H${x} V${y + 28} H${x + width} V${y + 42} H${x} V${y + height} H${x + width}`;
    }
    $(`zone${zone}-surface`).innerHTML = `<path data-emitter="${radiator ? 'radiator' : 'floor'}" d="${path}" fill="none" stroke="var(--orange)" stroke-width="3" stroke-linejoin="round"/>`;
    $(`zone${zone}-label`).textContent = `Heizkreis ${zone} · ${emitterLabel(`zone${zone}-emitter`)}`;
  }
  $('zone2-emitter').disabled = $('zones').value !== '2';
}
function values() {
  const base = scenarios[state.scenario];
  const change = ['heating', 'dhw', 'cooling'].includes(state.scenario) ? Math.sin(state.tick / 4) * .12 : 0;
  return { ...base, flow: base.flow + change, back: base.back + change / 2, power: base.power + change / 5, heat: base.heat + change * .5 };
}
function renderDetails() {
  const v = current;
  const unknown = state.scenario === 'stale';
  $('detail-title').textContent = descriptions[state.component][0];
  $('detail-description').textContent = descriptions[state.component][1];
  const rows = {
    pump: [['Gehäuse', window.AquareaHousings.families[deviceProfile.family].label], ['Verdichter', `${v.hz} Hz`], ['Lüfter 1', `${v.fan} U/min`], ['Stromaufnahme', v.hz ? '5,4 A' : '0,0 A'], ['Betriebsstunden', '8.462 h'], ['Verdichterstarts', '3.218'], ['Fehlerstatus', 'Kein Fehler']],
    water: [['Vorlauf', `${format(v.flow)} °C`], ['Rücklauf', `${format(v.back)} °C`], ['Durchfluss', `${format(v.rate)} l/min`], ['Wasserdruck', '1,6 bar'], ['Primärpumpe', v.rate ? 'Aktiv' : 'Aus'], ['Pumpenposition', !deviceProfile.known ? 'Unbekannt' : deviceProfile.type === 'none' ? 'Außengerät' : 'Innengerät'], ['Ventilpfad', state.scenario === 'dhw' ? 'Speicher' : 'Heizkreise']],
    tank: [['Speichertemperatur', '47,5 °C'], ['Zieltemperatur', '50,0 °C'], ['Ladung', state.scenario === 'dhw' ? 'Aktiv' : 'Inaktiv'], ['Heizstab', 'Nicht aktiv'], ['Sterilisation', 'Inaktiv']],
    zones: [['Zone 1 · Heizfläche', emitterLabel('zone1-emitter')], ['Zone 1 · Raum', '21,5 °C'], ['Zone 1 · VL-Soll', '35,0 °C'], ['Regelung', 'Heizkurve'], ['Kurvenverschiebung', '+1 K'], ['Zone 2', $('zones').value === '2' ? emitterLabel('zone2-emitter') : 'Nicht konfiguriert']],
    refrigerant: [['Hochdruck', v.hz ? '19,2 kgf/cm²' : '—'], ['Heißgas', 'Geplant'], ['Niederdruck', 'Modellabhängig'], ['Expansionsventil', 'Geplant'], ['Überhitzung', 'Nicht berechnet']]
  }[state.component];
  $('detail-values').replaceChildren(...rows.map(([name, value]) => {
    const row = document.createElement('div'); row.className = 'detail-row';
    const label = document.createElement('span'); label.textContent = name;
    const strong = document.createElement('strong'); strong.textContent = unknown ? '— · veraltet' : value;
    row.append(label, strong); return row;
  }));
}
function demoValue(metric) {
  if (state.scenario === 'stale') return '— · veraltet';
  const v = current;
  const fixed = { flowTemperature: format(v.flow), returnTemperature: format(v.back), outsideTemperature: '7,0', dhwTemperature: '47,5', dhwTargetTemperature: '50,0', waterFlow: format(v.rate), compressorFrequency: v.hz, fanSpeed: v.fan, pumpSpeed: v.rate ? 2900 : 0, waterPressure: '1,6', compressorCurrent: v.hz ? '5,4' : '0,0', highPressure: v.hz ? '19,2' : '—', indoorTemperature: '21,5', operationsHours: 8462, operationsCounter: 3218, activeError: 'Kein Fehler', heatPumpModel: deviceProfile.name, mainTargetTemperature: state.scenario === 'dhw' ? '50,0' : '35,0', zone1HeatRequest: '+1', zone1SensorMode: 'Raumfühler', defrostState: state.scenario === 'defrost' ? 'Aktiv' : 'Aus', threeWayValveState: state.scenario === 'dhw' ? 'Speicher' : 'Heizung', operatingMode: 'Heizen + WW (gewählt)', heatpumpState: v.hz ? 'Ein' : 'Aus', internalHeaterState: 'Aus', heatingControlMode: 'Heizkurve', quietMode: 'Aus', zonesState: $('zones').value, dhwHeatDelta: '−5', sterilizationState: 'Aus', sterilizationTemperature: '65', sterilizationMaxTime: '10' };
  if (metric.key in fixed) return `${fixed[metric.key]} ${metric.unit === 'enum' ? '' : metric.unit}`.trim();
  if (/Power(Consumption|Production)/.test(metric.key)) {
    const mode = metric.key.startsWith('heat') ? 'heating' : metric.key.startsWith('dhw') ? 'dhw' : 'cooling';
    const watts = state.scenario === mode ? Math.round((metric.key.includes('Consumption') ? v.power : v.heat) * 1000) : 0;
    return `${watts} W`;
  }
  return metric.planned ? '— · optional' : '— · kein Demo-Wert';
}
function renderCatalog() {
  const query = $('search').value.toLocaleLowerCase('de');
  const selected = metrics.filter(m => (state.group === 'Alle' || m.group === state.group) && `${m.label} ${m.key} ${m.topic}`.toLocaleLowerCase('de').includes(query));
  $('count').textContent = `${selected.length} / ${metrics.length}`;
  $('empty').hidden = selected.length > 0;
  $('metrics').replaceChildren(...selected.map(m => {
    const row = document.createElement('tr');
    const title = document.createElement('td'); title.textContent = m.label;
    const topic = document.createElement('small'); topic.textContent = m.topic; title.append(topic);
    const group = document.createElement('td'); group.textContent = m.group;
    const value = document.createElement('td'); value.textContent = demoValue(m);
    const status = document.createElement('td'); const badge = document.createElement('span'); badge.className = 'pill'; badge.textContent = m.planned ? 'Geplante Erweiterung' : 'Katalog vorhanden'; status.append(badge);
    row.append(title, group, value, status); return row;
  }));
}
function render() {
  current = values(); const v = current;
  const stale = state.scenario === 'stale';
  const idle = state.scenario === 'idle';
  document.body.className = [state.scenario, state.paused ? 'paused' : '', !$('motion').checked ? 'no-motion' : '', stale || idle ? 'inactive' : ''].join(' ');
  $('ratio-label').textContent = state.scenario === 'cooling' ? 'Kälte / Strom' : 'Momentaner COP';
  $('thermal-label').textContent = state.scenario === 'cooling' ? 'Kälteleistung' : 'Thermische Leistung';
  $('thermal-note').textContent = state.scenario === 'cooling' ? 'Wärmeentzug aus dem Heizwasser' : 'Abgabe an das Heizwasser';
  $('heat').textContent = stale || state.scenario === 'defrost' ? '—' : `${format(v.heat, 2)} kW`;
  $('power').textContent = stale ? '—' : `${format(v.power, 2)} kW`;
  $('cop').textContent = stale || !v.hz || state.scenario === 'defrost' ? '—' : format(v.heat / v.power, 2);
  $('cop-note').textContent = state.scenario === 'cooling' ? 'Kälte / Strom · Demo-Verhältnis' : 'Wärme / Strom · Demo-Verhältnis';
  $('delta').textContent = stale ? '—' : `${format(v.flow - v.back)} K`;
  $('activity').textContent = `● ${v.label}`;
  $('freshness').textContent = stale ? 'Keine aktuellen Daten · Animation gestoppt' : state.paused ? 'Beispielwerte · pausiert' : 'Beispielwerte · jetzt';
  $('flow-value').textContent = stale ? '—' : `${format(v.flow)} °C`;
  $('return-value').textContent = stale ? '—' : `${format(v.back)} °C`;
  $('frequency-value').textContent = stale ? '—' : `${v.hz} Hz`;
  $('flow-rate').textContent = stale ? '—' : `${format(v.rate)} l/min`;
  $('outdoor-value').textContent = stale ? '—' : '7,0 °C';
  $('room-value').textContent = stale ? '—' : '21,5 °C';
  $('tank-value').textContent = stale ? '—' : '47,5 °C';
  $('valve-arrow').setAttribute('d', state.scenario === 'dhw' ? 'M430 197 V213' : 'M422 205 H438');
  const speed = Number($('speed').value);
  document.documentElement.style.setProperty('--flow-duration', `${(29 / Math.max(v.rate, 1)) / speed}s`);
  document.documentElement.style.setProperty('--fan-duration', `${(1050 / Math.max(v.fan, 1)) / speed}s`);
  document.documentElement.style.setProperty('--pump-duration', `${(24 / Math.max(v.rate, 1)) / speed}s`);
  renderDetails(); renderCatalog();
}
$('theme').addEventListener('change', e => { document.documentElement.dataset.theme = e.target.value; });
$('scenario').addEventListener('change', e => { state.scenario = e.target.value; render(); });
$('pause').addEventListener('click', () => { state.paused = !state.paused; $('pause').textContent = state.paused ? '▶ Fortsetzen' : 'Ⅱ Pause'; $('pause').setAttribute('aria-pressed', String(state.paused)); render(); });
$('configure').addEventListener('click', () => $('settings').showModal());
document.querySelectorAll('[data-component]').forEach(button => button.addEventListener('click', () => { state.component = button.dataset.component; document.querySelectorAll('[data-component]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); renderDetails(); }));
groups.forEach(group => { const button = document.createElement('button'); button.textContent = group; button.setAttribute('aria-pressed', String(group === state.group)); button.addEventListener('click', () => { state.group = group; [...$('filters').children].forEach(b => b.setAttribute('aria-pressed', String(b === button))); renderCatalog(); }); $('filters').append(button); });
$('search').addEventListener('input', renderCatalog);
function applyDetectedModel(identifier) {
  deviceProfile = window.AquareaHousings.resolve(identifier);
  const family = window.AquareaHousings.families[deviceProfile.family];
  $('housing-art').innerHTML = window.AquareaHousings.draw(deviceProfile);
  $('housing-art').setAttribute('aria-label', family.label);
  $('housing-title').textContent = !deviceProfile.known ? 'Aquarea · Ersatzbild' : deviceProfile.type === 'aio' ? 'Aquarea · All-in-One' : deviceProfile.type === 'wall' ? 'Aquarea · Split-System' : 'Aquarea · Monoblock';
  $('model-name').textContent = deviceProfile.name;
  const indoor = deviceProfile.type === 'aio' ? 'All-in-One · Speicher integriert' : deviceProfile.type === 'wall' ? 'Wand-Hydromodul' : deviceProfile.family === 'm' ? 'Innenmodul nicht aus Kennung bestimmbar' : deviceProfile.known ? 'Monoblock' : 'Bauform unbekannt';
  $('model-family').textContent = `${family.label} · ${indoor}`;
  $('model-state').textContent = deviceProfile.known ? 'Demo · Modell erkannt' : 'Demo · Modell unbekannt';
  $('unit').value = indoor;
  $('unit').textContent = indoor;
  $('model-demo').value = deviceProfile.known ? deviceProfile.signature : 'unknown';
  $('topology-note').textContent = deviceProfile.known ? 'Gemeinsamer Gerätemaßstab · Leitungsführung als Funktionsschema · Pumpe im Hydromodul bzw. Monoblock' : 'Unbekannte Kennung · neutrale Darstellung ohne Modellannahme';
  render();
}
function initializeModels() {
  for (const model of window.AquareaHousings.models) {
    const option = document.createElement('option');
    option.value = model.signature;
    option.textContent = `${model.id === null ? 'Lokal' : `ID ${model.id}`} · ${model.name.replace('Panasonic ', '')}`;
    $('model-demo').append(option);
  }
  const unknown = document.createElement('option');
  unknown.value = 'unknown'; unknown.textContent = 'Unbekanntes Modell · Fallback prüfen';
  $('model-demo').append(unknown);
  $('model-demo').addEventListener('change', () => {
    $('model-identifier').value = $('model-demo').value === 'unknown' ? 'UNBEKANNT' : $('model-demo').value;
    applyDetectedModel($('model-identifier').value);
  });
  $('model-identifier').addEventListener('input', () => applyDetectedModel($('model-identifier').value));
  $('model-identifier').value = deviceProfile.signature;
  applyDetectedModel(deviceProfile.signature);
}
function configure() {
  renderHeatingSurfaces();
  $('zone2').style.display = $('zones').value === '2' ? 'block' : 'none';
  $('buffer').style.display = $('topology').value === 'series' ? 'block' : 'none';
  $('tank').style.display = $('dhw-pipes').style.display = $('show-tank').checked ? 'block' : 'none';
  document.querySelector('.sensor-labels').style.display = $('show-sensors').checked ? 'block' : 'none';
  $('scenario').querySelector('[value="dhw"]').disabled = !$('show-tank').checked;
  if (!$('show-tank').checked && state.scenario === 'dhw') { state.scenario = 'heating'; $('scenario').value = 'heating'; }
  render();
}
['topology', 'zones', 'zone1-emitter', 'zone2-emitter', 'show-tank', 'show-sensors', 'motion', 'speed'].forEach(id => $(id).addEventListener('input', configure));
$('export').addEventListener('click', () => {
  const config = { schema: 'aquarea-model-draft/v3', modelIdentifier: $('model-identifier').value, housingFamily: deviceProfile.family, unit: $('unit').value, topology: $('topology').value, zones: Number($('zones').value), emitters: { zone1: $('zone1-emitter').value, zone2: $('zones').value === '2' ? $('zone2-emitter').value : null }, tank: $('show-tank').checked, sensors: $('show-sensors').checked, animation: $('motion').checked, animationSpeed: Number($('speed').value), theme: $('theme').value };
  const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'aquarea-modell-entwurf.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('export-status').textContent = 'Darstellung als JSON exportiert. Import ist für die spätere Integration vorgesehen.';
});
metrics = window.aquareaCatalog || [];
initializeModels();
configure();
setInterval(() => { if (!state.paused && !document.hidden && state.scenario !== 'stale') { state.tick += 1; render(); } }, 2200);
