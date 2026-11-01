import assert from 'node:assert/strict';
import { curveValue, curveMarker, curveSlope, temperatureTicks } from './src/heatingCurveMath.ts';
const c={xCold:-10,yCold:35,xWarm:15,yWarm:25,heatDelta:5,heatingOffTemperature:18};
assert.equal(curveValue(c,6),28.6);assert.equal(curveValue(c,-30),35);assert.equal(curveValue(c,30),25);assert.equal(curveSlope(c),-.4);
assert.equal(curveValue({...c,xWarm:-10},6),null);assert.equal(curveValue(c,NaN),null);
assert.deepEqual(temperatureTicks(-17,19),[-15,-10,-5,0,5,10,15]);
assert.equal(curveMarker(1e308),null);assert.equal(curveMarker(-1e308),null);assert.equal(curveMarker(-40),-40);assert.equal(curveMarker(50),50);
console.log('Heating curve frontend math passed.');
