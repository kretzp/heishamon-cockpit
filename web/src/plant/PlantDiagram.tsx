import { useMemo } from 'react';
import { t } from '../i18n/core';
import { draw, type ResolvedProfile } from './plantHousing';
import type { PlantConfiguration, derivePlantState } from './plantModelState';
function HeatingSurface({ type, y }: { type: 'floor' | 'radiator'; y: number }) {
  let path = `M822 ${y} H918 V${y+14} H822 V${y+28} H918 V${y+42} H822 V${y+56} H918`;
  if (type === 'radiator') { path = `M822 ${y+5} H918 M822 ${y+51} H918`; for (let n=0;n<7;n++) path += ` M${827+n*86/6} ${y} V${y+56}`; }
  return <path d={path} fill="none" stroke="var(--orange)" strokeWidth="3" strokeLinejoin="round" />;
}
export function PlantDiagram({ profile, config, plant, reading }: { profile: ResolvedProfile; config: PlantConfiguration; plant: ReturnType<typeof derivePlantState>; reading: (key: string) => string }) {
  const housingMarkup = useMemo(() => ({ __html: draw(profile) }), [profile.signature, profile.family]);
  const homeOffsetX = 37;
  const homeOffsetY = 59;
  const homeTransform = `translate(${homeOffsetX} ${homeOffsetY})`;
  const homeLeft = 784 + homeOffsetX;
  const heatingSupply = `M300 205 H${homeLeft}`;
  const heatingReturn = `M${homeLeft} 325 H300`;
  const zone2Supply = `M740 205 V${349 + homeOffsetY} H${810 + homeOffsetX}`;
  const zone2Return = `M${810 + homeOffsetX} ${399 + homeOffsetY} H760 V325`;
  return (<svg className="plant-diagram" viewBox="0 0 1000 560" role="img" aria-label={t("Hydraulik & Energiefluss")}><defs><pattern id="plant-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="var(--border)"/></pattern><linearGradient id="plant-tank-fill" x2="0" y2="1"><stop stopColor="#ed985f" stopOpacity=".22"/><stop offset="1" stopColor="#5293c9" stopOpacity=".16"/></linearGradient></defs><rect width="1000" height="560" fill="url(#plant-dots)"/>
<text x="40" y="40" className="section-label">{t("AUSSEN- / INNENGERÄT")}</text><text x="440" y="40" className="section-label">{t("HYDRAULIK")}</text><text x={869 + homeOffsetX} y="40" textAnchor="middle" className="section-label">{t("DEIN ZUHAUSE")}</text>
<path className="pipe hot" d={heatingSupply}/><path className="flow hot heating-path" d={heatingSupply}/>
<path className="flow hot dhw-path" d="M300 205 H430"/><path className="flow cold dhw-path" d="M615 325 H300"/>
<path className="pipe cold" d={heatingReturn}/><path className="flow cold heating-path reverse" d={heatingReturn}/>
{config.tank && <g id="plant-dhw-pipes"><path className="pipe hot" d="M430 205 V435 H490"/><path className="flow hot dhw-path" d="M430 205 V435 H490"/><path className="pipe cold" d="M565 470 H615 V325"/><path className="flow cold dhw-path" d="M565 470 H615 V325"/></g>}
<g id="plant-outdoor"><g dangerouslySetInnerHTML={housingMarkup} /><text id="housing-title" x="40" y="122" className="component-title">{t(profile.type === "aio" ? "All-in-One" : profile.type === "wall" ? "Split-System" : profile.known ? "Monoblock" : "Modell unbekannt")}</text><text x="70" y="391" className="muted-svg">{t("Außenluft")}</text><text id="outdoor-value" x="70" y="420" className="reading">{reading("outsideTemperature")}</text><text x="200" y="391" className="muted-svg">{t("Verdichter")}</text><text id="frequency-value" x="200" y="420" className="reading">{reading("compressorFrequency")}</text></g>
{config.sensors && <g className="sensor-labels"><text x="307" y="165" className="muted-svg">{t("VORLAUF")}</text><text id="flow-value" x="307" y="190" className="reading hot-text">{reading("flowTemperature")}</text><text x="310" y="357" className="muted-svg">{t("RÜCKLAUF")}</text><text id="return-value" x="310" y="383" className="reading cold-text">{reading("returnTemperature")}</text></g>}
<text id="flow-rate" x="345" y="280" className="muted-svg">{reading("waterFlow")}</text>
<circle className="equipment" cx="430" cy="205" r="13"/><path id="valve-arrow" d={plant.valve === 1 ? "M430 197 V213" : "M422 205 H438"} stroke="var(--orange)" strokeWidth="4"/><text x="454" y="249" className="tiny">{t("3-WEGE-VENTIL")}</text>
{config.buffer && <g id="plant-buffer"><rect className="equipment" x="545" y="170" width="66" height="71" rx="15"/><path d="M552 190 H605 M552 220 H605" stroke="var(--border)"/><text x="536" y="153" className="tiny">{t("REIHENPUFFER")}</text></g>}
{config.tank && <g id="plant-tank"><rect x="490" y="380" width="75" height="118" rx="22" fill="url(#plant-tank-fill)" stroke="var(--input-border)" strokeWidth="2"/><path d="M505 408 H550 L505 426 H550 L505 445 H550 L505 464 H550" fill="none" stroke="var(--orange)" strokeWidth="3"/><text x="490" y="365" className="tiny">{t("WARMWASSER")}</text><text id="tank-value" x="590" y="520" className="reading">{reading("dhwTemperature")}</text><text x="590" y="542" className="muted-svg">{t("Warmwasser-Soll")}: {reading("dhwTargetTemperature")}</text></g>}
<g id="plant-zone1" transform={homeTransform}><path className="equipment" d="M784 143 L869 80 L954 143 V267 H784 Z"/><path d="M810 166 H929 V239 H810 Z" fill="var(--surface)"/><HeatingSurface type={config.zone1} y={179} /><text id="zone1-label" x="784" y="289" className="component-title"><tspan>{t("Heizkreis 1")}</tspan><tspan x="784" dy="18">{t(config.zone1 === "floor" ? "Fußbodenheizung" : "Heizkörper")}</tspan></text><text id="room-value" x="869" y="158" textAnchor="middle" className="reading">{reading("indoorTemperature")}</text></g>
{config.zones === 2 && <g id="plant-zone2"><path className="pipe hot" d={zone2Supply}/><path className="pipe cold" d={zone2Return}/><path className="flow hot heating-path" d={zone2Supply}/><path className="flow cold heating-path reverse" d={zone2Return}/><g transform={homeTransform}><rect className="equipment" x="810" y="330" width="120" height="85" rx="10"/><HeatingSurface type={config.zone2} y={343} /><text id="zone2-label" x="784" y="443" className="component-title"><tspan>{t("Heizkreis 2")}</tspan><tspan x="784" dy="18">{t(config.zone2 === "floor" ? "Fußbodenheizung" : "Heizkörper")}</tspan></text></g></g>}
</svg>);
}
