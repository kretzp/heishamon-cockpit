const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const context = { window: {} };
  vm.createContext(context);
  for (const file of ['aquarea-models.js', 'housings.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  }
  return context.window.AquareaHousings;
}

test('every backend signature and legacy ID resolves to its matching name', () => {
  const api = load();
  const source = fs.readFileSync(path.join(__dirname, '../../src/Cockpit.Domain/HeatPumpModels.cs'), 'utf8');
  const entries = [...source.matchAll(/new\((\d+|null), "([^"]+)", "([^"]+)"\)/g)];
  assert.equal(api.models.length, entries.length);
  for (const [, id, signature, name] of entries) {
    assert.equal(api.resolve(signature).name, name);
    assert.equal(api.resolve(signature.toLowerCase().replaceAll(' ', '  ')).name, name);
    if (id !== 'null') assert.equal(api.resolve(id).name, name);
  }
  assert.equal(api.resolve(0).id, 0);
});

test('family selection respects outdoor model and phase rather than power alone', () => {
  const api = load();
  for (const [id, family, fans] of [[10, 'mono-low', 1], [23, 'mono-tall', 2], [7, 'split-small', 1], [17, 'split-small', 1], [8, 'split-medium', 1], [3, 'split-tall', 2], [14, 'quiet-wide', 2], [37, 'k-medium', 1], [69, 'k-tall', 2], [84, 'k-tall', 2], [52, 'l', 1], [55, 'm', 2]]) {
    const profile = api.resolve(id);
    assert.equal(profile.family, family);
    assert.equal(api.families[family].fans, fans);
  }
});

test('unknown and malformed models use neutral fallback without guessing', () => {
  const api = load();
  for (const input of [undefined, null, '', 999, 'WH-FAKE', {}, '<img onerror=alert(1)>']) {
    const model = api.resolve(input);
    assert.equal(model.known, false);
    assert.equal(model.family, 'generic');
    assert.ok(!api.draw(model).includes('<img'));
  }
});

test('all profiles produce bounded artwork with individual animated fan groups', () => {
  const api = load();
  for (const model of api.models) {
    const profile = api.resolve(model.signature);
    const svg = api.draw(profile);
    assert.ok(!/NaN|undefined/.test(svg));
    assert.equal((svg.match(/class="fan"/g) || []).length, api.families[model.family].fans);
    assert.equal(svg.includes('class="housing-indoor"'), profile.type !== 'none');
  }
});

test('outdoor and indoor units keep physical aspect ratios and a shared scale', () => {
  const api = load();
  for (const model of api.models) {
    const geometry = api.layout(model);
    const { outdoor, indoor, scale, pump } = geometry;
    assert.ok(outdoor.x >= 40 && outdoor.x + outdoor.width <= 285);
    assert.ok(outdoor.y >= 130 && outdoor.y + outdoor.height <= 356);
    assert.ok(Math.abs(outdoor.width / outdoor.height - outdoor.mmWidth / outdoor.mmHeight) < 1e-9);
    if (indoor) {
      assert.ok(indoor.x > outdoor.x + outdoor.width);
      assert.ok(indoor.x + indoor.width <= 285 && indoor.y >= 130);
      assert.ok(Math.abs(indoor.width / indoor.height - indoor.mmWidth / indoor.mmHeight) < 1e-9);
      assert.ok(Math.abs(indoor.width / indoor.mmWidth - scale) < 1e-9);
    }
    const owner = indoor || outdoor;
    assert.ok(pump.x - pump.radius > owner.x && pump.x + pump.radius < owner.x + owner.width);
    assert.ok(pump.y - pump.radius > owner.y && pump.y + pump.radius < owner.y + owner.height);
    const artwork = api.draw(api.resolve(model.signature));
    assert.ok(artwork.includes(`data-pump-location="${indoor ? 'indoor' : 'outdoor'}"`));
    assert.ok(artwork.includes('class="flow hot housing-water"'));
    assert.ok(artwork.includes('class="flow cold housing-water"'));
    const exchangerX = Number(artwork.match(/<rect x="([^"]+)"[^>]+class="housing-exchanger"/)[1]);
    const exchangerOwner = ['l', 'm'].includes(model.family) ? outdoor : owner;
    assert.ok(exchangerX >= exchangerOwner.x && exchangerX + 10 <= exchangerOwner.x + exchangerOwner.width);
    assert.equal(artwork.includes('class="housing-refrigerant"'), Boolean(indoor && !['l', 'm'].includes(model.family)));
  }
  assert.equal(api.layout(api.resolve(68)).indoor.mmHeight, 2036);
  assert.equal(api.layout(api.resolve(55)).indoor.mmHeight, 1642);
  assert.equal(api.layout(api.resolve(12)).indoor.mmHeight, 1800);
});

test('prototype switches housing from simulated telemetry and preserves scenario controls', () => {
  class Element {
    constructor() { this.value = ''; this.checked = true; this.children = []; this.listeners = {}; this.attributes = {}; this.style = { setProperty() {} }; this.dataset = {}; this.textContent = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    setAttribute(key, value) { this.attributes[key] = value; }
    querySelector() { return new Element(); }
  }
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const nodes = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
  for (const [id, value] of Object.entries({ scenario: 'heating', speed: '1', zones: '1', topology: 'direct' })) nodes[id].value = value;
  const context = { window: {}, setInterval() {}, document: { getElementById: id => nodes[id], createElement: () => new Element(), querySelectorAll: () => [], querySelector: () => new Element(), body: new Element(), documentElement: new Element(), hidden: false } };
  vm.createContext(context);
  for (const file of ['aquarea-models.js', 'housings.js', 'catalog.js', 'model.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  assert.equal(nodes['model-demo'].children.length, context.window.AquareaHousings.models.length + 1);
  for (const model of context.window.AquareaHousings.models) {
    nodes['model-identifier'].value = model.id === null ? model.signature : String(model.id);
    nodes['model-identifier'].listeners.input();
    assert.equal(nodes['model-name'].textContent, model.name);
    assert.ok(nodes['housing-art'].innerHTML.includes(`data-family="${model.family}"`));
    assert.equal(nodes['model-demo'].value, model.signature);
  }
  nodes['model-identifier'].value = '<script>bad</script>';
  nodes['model-identifier'].listeners.input();
  assert.ok(nodes['housing-art'].innerHTML.includes('data-family="generic"'));
  assert.ok(!nodes['housing-art'].innerHTML.includes('<script>'));
  for (const scenario of ['dhw', 'cooling', 'defrost', 'idle', 'stale']) {
    nodes.scenario.listeners.change({ target: { value: scenario } });
    assert.ok(context.document.body.className.includes(scenario));
    if (['defrost', 'idle', 'stale'].includes(scenario)) assert.equal(nodes.cop.textContent, '—');
  }
  nodes.pause.listeners.click();
  assert.equal(nodes.pause.attributes['aria-pressed'], 'true');
  nodes['model-demo'].value = context.window.AquareaHousings.models[0].signature;
  nodes['model-demo'].listeners.change();
  assert.equal(nodes['model-name'].textContent, context.window.AquareaHousings.models[0].name);
  assert.ok(context.document.body.className.includes('paused'));
  nodes['zone1-emitter'].value = 'radiator';
  nodes['zone1-emitter'].listeners.input();
  assert.equal(nodes['zone1-label'].textContent, 'Heizkreis 1 · Heizkörper');
  assert.ok(nodes['zone1-surface'].innerHTML.includes('data-emitter="radiator"'));
  nodes.zones.value = '2';
  nodes['zone2-emitter'].value = 'floor';
  nodes['zone2-emitter'].listeners.input();
  assert.equal(nodes.zone2.style.display, 'block');
  assert.equal(nodes['zone2-label'].textContent, 'Heizkreis 2 · Fußbodenheizung');
  assert.ok(nodes['zone2-surface'].innerHTML.includes('data-emitter="floor"'));
  nodes.zones.value = '1'; nodes.zones.listeners.input();
  assert.equal(nodes['zone2-emitter'].disabled, true);
});

test('refrigerant split links include separately animated supply and return paths', () => {
  const api = load();
  for (const id of [7, 12, 37, 69]) {
    const svg = api.draw(api.resolve(id));
    assert.equal((svg.match(/class="flow housing-refrigerant-flow"/g) || []).length, 2);
  }
  for (const id of [0, 52, 55]) assert.ok(!api.draw(api.resolve(id)).includes('housing-refrigerant-flow'));
});
