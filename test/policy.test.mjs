/** Policy/preset/config tests; no Coopanion install needed. */
import assert from 'node:assert/strict';
import {
  CUSTOM_DEFAULTS,
  DEFAULTS,
  PRESETS,
  flatFromPolicy,
  normaliseOverrides,
  policyFromConfig,
  policyFromFlat,
  policySummary,
  policyWithOverrides,
} from '../src/policy.js';

assert.equal(DEFAULTS.enabled, false);
assert.equal(DEFAULTS.preset, 'expressive');
assert.equal(DEFAULTS.modelCanEdit, true);

const expressive = policyFromConfig({ preset: 'expressive' });
assert.deepEqual(expressive, PRESETS.expressive);
assert.equal(expressive.touch.poke.expressions.love, 1);
assert.equal(expressive.hearts, true);

const cold = policyFromConfig({ preset: 'cold' });
assert.deepEqual(cold, PRESETS.cold);
assert.equal(cold.touch.poke.expressions.love, undefined);
assert.equal(cold.touch.pet.expressions.love, undefined);
assert.equal(cold.idle.expressions.love, undefined);
assert.equal(cold.hearts, false);

const custom = policyFromConfig({
  preset: 'custom',
  ...CUSTOM_DEFAULTS,
  pokeLove: 0,
  petShy: 100,
  idleLove: 0,
  pokeHop: 25,
  hearts: false,
});
assert.equal(custom.preset, 'custom');
assert.equal(custom.touch.poke.expressions.love, 0);
assert.equal(custom.touch.pet.expressions.shy, 100);
assert.equal(custom.touch.pet.expressions.love, 100);
assert.equal(custom.idle.expressions.love, 0);
assert.equal(custom.touch.poke.hopChance, 0.25);
assert.equal(custom.hearts, false);

const roundtrip = flatFromPolicy(policyFromFlat({
  ...CUSTOM_DEFAULTS,
  idleWalk: 0,
  idleRun: 33,
  sitSleep: 12,
  pokeHop: 0,
  hearts: false,
}));
assert.equal(roundtrip.idleWalk, 0);
assert.equal(roundtrip.idleRun, 33);
assert.equal(roundtrip.sitSleep, 12);
assert.equal(roundtrip.pokeHop, 0);
assert.equal(roundtrip.hearts, false);

const checked = normaliseOverrides({ pokeLove: 0, petShy: 100, nope: 1, pokeHop: 200, hearts: true });
assert.deepEqual(checked.overrides, { pokeLove: 0, petShy: 100, hearts: true });
assert.deepEqual(checked.bad.sort(), ['nope', 'pokeHop (0–100)']);

const base = policyFromConfig({ preset: 'cold' });
const coldFlat = flatFromPolicy(base);
assert.equal(coldFlat.petNeutral, 3, 'cold petting keeps its neutral face');
assert.equal(coldFlat.petLove, 0, 'cold petting has love disabled');
assert.equal(coldFlat.idleNeutral, 3, 'cold idle keeps its neutral face');
const withOverride = policyWithOverrides(base, { pokeHop: 75, hearts: true });
assert.equal(withOverride.preset, 'custom');
assert.equal(withOverride.touch.poke.hopChance, 0.75);
assert.equal(withOverride.hearts, true);
assert.equal(withOverride.touch.poke.expressions.love, 0, 'cold base keeps love at 0');
assert.equal(withOverride.touch.pet.expressions.neutral, 3, 'cold base keeps the neutral petting face');
assert.equal(withOverride.idle.expressions.neutral, 3, 'cold base keeps the neutral idle face');

assert.match(policySummary(expressive), /preset=expressive/);
assert.match(policySummary(expressive), /hearts=true/);
assert.match(policySummary(cold), /hearts=false/);

console.log('policy tests passed');
