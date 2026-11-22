/* Exact known-model lookup. Unrecognized identifiers never imply a device shape. */
import { aquareaModels, type AquareaProfile } from './aquareaProfiles.ts';
export type ResolvedProfile = AquareaProfile & { known: boolean };
type Family = { label: string; width: number; height: number; fans: number; dark?: boolean; grille?: boolean };
export const housingProfilesSource = 'Cockpit.Domain/HeatPumpModels.cs';
  export const families: Readonly<Record<string, Family>> = Object.freeze({
    'mono-low': { label: 'H / J · Monoblock', width: 1283, height: 865, fans: 1 },
    'mono-tall': { label: 'H / J · T-CAP Monoblock', width: 1283, height: 1410, fans: 2 },
    'split-small': { label: 'H / J · Split kompakt', width: 824, height: 622, fans: 1 },
    'split-medium': { label: 'H / J · Split Standard', width: 900, height: 795, fans: 1 },
    'split-tall': { label: 'H · Split / T-CAP', width: 900, height: 1340, fans: 2 },
    'quiet-wide': { label: 'H · Super Quiet', width: 1283, height: 1410, fans: 2 },
    'k-medium': { label: 'K · High Performance', width: 875, height: 795, fans: 1, dark: true, grille: true },
    'k-tall': { label: 'K · HP groß / T-CAP', width: 900, height: 1340, fans: 2, dark: true, grille: true },
    l: { label: 'L · Hydraulik-Split', width: 980, height: 996, fans: 1, dark: true, grille: true },
    m: { label: 'M · T-CAP', width: 1200, height: 1520, fans: 2, dark: true },
    generic: { label: 'Neutrales Ersatzbild · Modell unbekannt', width: 1000, height: 1000, fans: 1 }
  });
  export const models = aquareaModels;
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

  export function resolve(value: unknown): ResolvedProfile {
    const raw = typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isInteger(value) ? String(value) : '';
    const identifier = normalize(raw);
    const model = models.find(m => m.signature === identifier || (m.id !== null && String(m.id) === raw));
    // Exact display names are also useful when a snapshot adapter has resolved the signature already.
    const named = model || models.find(m => normalize(m.name) === identifier);
    return named ? { ...named, known: true } : { known: false, name: 'Aquarea · Modell unbekannt', family: 'generic', type: 'none', generation: '', signature: raw, id: null };
  }

  function fan(x: number, y: number, radius: number) {
    let grille = '';
    for (let n = 1; n <= 5; n++) grille += `<circle cx="${x}" cy="${y}" r="${radius * n / 5}" class="housing-grille"/>`;
    return `<circle cx="${x}" cy="${y}" r="${radius}" class="housing-face"/><g class="rotor-anchor" transform="translate(${x} ${y})"><g class="fan"><g transform="scale(${radius / 60})"><path class="housing-blade" d="M0 -4 C-40 -40 28 -48 6 -5 C48 -28 45 40 5 6 C24 48 -45 40 -6 3 C-48 24 -40 -45 0 -4"/></g></g></g>${grille}<circle cx="${x}" cy="${y}" r="${radius * .13}" class="housing-face"/>`;
  }

  export function layout(profile: AquareaProfile) {
    const f = families[profile.family] || families.generic;
    const hasIndoor = profile.type === 'aio' || profile.type === 'wall';
    const modern = ['K', 'L', 'M'].includes(profile.generation);
    const outdoorWidth = profile.family === 'split-medium' && profile.generation === 'J' ? 875 : f.width;
    // Panasonic front dimensions: wall modules 500 x 892; H/J towers 598 x 1800;
    // K/L/M 185 L towers 599 x 1642; M ...E83 is the 260 L / 2036 mm tower.
    const indoorWidth = hasIndoor ? (profile.type === 'wall' ? 500 : modern ? 599 : 598) : 0;
    const indoorHeight = hasIndoor ? (profile.type === 'wall' ? 892 : !modern ? 1800 : /M9E83$/.test((profile.name || '').split(' / ')[0]) ? 2036 : 1642) : 0;
    const gap = hasIndoor ? 28 : 0;
    const scale = Math.min((237 - gap) / (outdoorWidth + indoorWidth), 214 / Math.max(f.height, indoorHeight));
    const totalWidth = (outdoorWidth + indoorWidth) * scale + gap;
    const left = 42 + (237 - totalWidth) / 2;
    const outdoor = { x: left, y: 350 - f.height * scale, width: outdoorWidth * scale, height: f.height * scale, mmWidth: outdoorWidth, mmHeight: f.height };
    const indoor = hasIndoor ? { x: left + outdoor.width + gap, y: 350 - indoorHeight * scale, width: indoorWidth * scale, height: indoorHeight * scale, mmWidth: indoorWidth, mmHeight: indoorHeight } : null;
    const owner = indoor || outdoor;
    const pump = { x: owner.x + owner.width * .65, y: owner.y + owner.height * .67, radius: Math.min(9, owner.width * .16) };
    return { outdoor, indoor, scale, pump };
  }

  function indoor(profile: AquareaProfile, box: ReturnType<typeof layout>['indoor']) {
    if (!box) return '';
    const { x, y, width, height } = box;
    const modern = ['K', 'L', 'M'].includes(profile.generation);
    const displayWidth = modern ? width - 4 : width * .34;
    return `<g class="housing-indoor"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" class="housing-face"/><path d="M${x + 1} ${y + height * .43} H${x + width - 1}" class="housing-seam"/><rect x="${modern ? x + 2 : x + width - displayWidth - 3}" y="${y + 12}" width="${displayWidth}" height="7" rx="1" class="housing-display"/></g>`;
  }

  function waterPath(path: string, temperature: string) {
    return `<path d="${path}" class="pipe ${temperature} housing-water"/><path d="${path}" class="flow ${temperature} housing-water"/>`;
  }

  function hydraulicCircuit(profile: ResolvedProfile, geometry: ReturnType<typeof layout>) {
    const { outdoor, indoor: module, pump } = geometry;
    const owner = module || outdoor;
    const supplyY = owner.y + owner.height * .48;
    const returnY = pump.y;
    const heatX = owner.x + owner.width * .26;
    const edge = owner.x + owner.width;
    const hydraulicSplit = ['l', 'm'].includes(profile.family);
    const waterStart = module && hydraulicSplit ? outdoor.x + outdoor.width * .82 : heatX;
    const hot = `M${waterStart} ${supplyY} H${edge + 17} V205 H300`;
    const cold = `M300 325 H${edge + 20} V${returnY} H${waterStart}`;
    let svg = `<g class="housing-circuit">${waterPath(hot, 'hot')}${waterPath(cold, 'cold')}`;
    // H/J/K are refrigerant split systems: their inter-unit link is not heating water.
    if (module && !hydraulicSplit) {
      const right = outdoor.x + outdoor.width;
      const sourceY = outdoor.y + outdoor.height * .45;
      const outgoing = `M${right} ${sourceY} H${right + 10} V${supplyY} H${heatX}`;
      const incoming = `M${heatX} ${returnY} H${right + 16} V${sourceY + 12} H${right}`;
      for (const path of [outgoing, incoming]) {
        svg += `<path d="${path}" class="housing-refrigerant"/><path d="${path}" class="flow housing-refrigerant-flow"/>`;
      }
    }
    // L/M heat exchange happens outdoors; the indoor module only carries water.
    const exchangerX = module && hydraulicSplit ? waterStart : heatX;
    svg += `<rect x="${exchangerX - 5}" y="${supplyY - 6}" width="10" height="${returnY - supplyY + 12}" rx="2" class="housing-exchanger"/>`;
    if (profile.known) {
      svg += `<g data-pump-location="${module ? 'indoor' : 'outdoor'}"><circle cx="${pump.x}" cy="${pump.y}" r="${pump.radius}" class="housing-pump-face"/><g class="rotor-anchor" transform="translate(${pump.x} ${pump.y})"><g class="pump"><path d="M${-pump.radius * .55} 0 L${pump.radius * .45} ${-pump.radius * .52} V${pump.radius * .52} Z" fill="var(--primary)"/></g></g></g>`;
    }
    return svg + '</g>';
  }

  export function draw(profile: ResolvedProfile) {
    // Use only trusted catalog values for markup; never interpolate raw identifiers.
    const f = families[profile.family] || families.generic;
    const geometry = layout(profile);
    const { x, y, width, height } = geometry.outdoor;
    const radius = Math.min(width * (f.dark ? .39 : .30), height / (f.fans === 2 ? 4.8 : 2.6));
    const center = x + width * (f.dark ? .5 : .37);
    let svg = `<g class="housing-shell${f.dark ? ' housing-dark' : ''}" data-family="${families[profile.family] ? profile.family : 'generic'}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" class="housing-face"/>`;
    const centers = f.fans === 2 ? [y + height * .29, y + height * .73] : [y + height * .53];
    svg += centers.map(cy => fan(center, cy, radius)).join('');
    if (f.grille) {
      for (let line = y + 12; line < 343; line += 6) svg += `<path d="M${x + 5} ${line} H${x + width - 5}" class="housing-front-grille"/>`;
    } else if (!f.dark) {
      svg += `<path d="M${x + width * .77} ${y + 2} V348" class="housing-seam"/>`;
    }
    svg += `<path d="M${x + 10} 350 V356 H${x + 26} V350 M${x + width - 26} 350 V356 H${x + width - 10} V350" class="housing-face"/></g>`;
    svg += indoor(profile, geometry.indoor);
    svg += hydraulicCircuit(profile, geometry);
    return svg;
  }
