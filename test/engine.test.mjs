/** Runs the injected policy engine from a patched body in a tiny VM; no DOM needed. */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { apply } from '../src/patch.js';
import { PRESETS } from '../src/policy.js';

const BODY = readFileSync(new URL('./fixtures/body.js', import.meta.url), 'utf8');
const PAGE = readFileSync(new URL('./fixtures/pet-app.js', import.meta.url), 'utf8');

const root = mkdtempSync(join(tmpdir(), 'coocontrol-engine-'));
const app = join(root, 'resources', 'app');
const pkg = join(app, 'node_modules', 'cortico-world-desktop-pet');
mkdirSync(join(pkg, 'web', 'kit'), { recursive: true });
writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'coopanion', version: '0.2.11' }));
writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'cortico-world-desktop-pet', version: '0.2.0' }));
writeFileSync(join(pkg, 'web', 'kit', 'body.js'), BODY);
writeFileSync(join(pkg, 'web', 'pet-app.js'), PAGE);

const result = apply({ appRoot: app, dataDir: join(root, 'data'), policy: PRESETS.cold });
assert.equal(result.ok, true, result.error);
const patched = readFileSync(join(pkg, 'web', 'kit', 'body.js'), 'utf8');
const start = patched.indexOf('/* __COO_CONTROL_POLICY */');
const end = patched.indexOf('export function createBody', start);
assert.ok(start >= 0 && end > start, 'policy engine was inserted');
const code = patched.slice(start, end);

const context = vm.createContext({
  KIT_EXPRESSIONS: ['neutral', 'happy', 'wink', 'love', 'shy', 'surprised', 'angry', 'sleepy'],
  Math, Object, Number, Set, JSON,
});
vm.runInContext(`${code}\nthis.__api = { apply: __cooApplyPolicy, pickFace: __cooPickFace, idle: __cooIdleActions, policy: () => __cooPolicy };`, context);
const api = context.__api;
api.apply(PRESETS.cold);

const cold = api.policy();
assert.equal(cold.hearts, false);
assert.equal(cold.touch.poke.hopChance, 0.1);
assert.equal(cold.touch.poke.expressions.love, undefined);
assert.equal(cold.touch.pet.expressions.love, undefined);

const forbidden = new Set(['love', 'shy', 'happy', 'wink', 'sleepy']);
for (let i = 0; i < 300; i++) {
  assert.equal(forbidden.has(api.pickFace('poke', {})), false, 'cold click never picks love/shy/happy/wink/sleepy');
  assert.equal(forbidden.has(api.pickFace('pet', {})), false, 'cold petting never picks love/shy/happy/wink/sleepy');
}
const idle = api.idle(false, null).map(([key]) => key);
assert.equal(idle.includes('run'), false, 'cold idle run weight 0');
assert.equal(idle.includes('jump'), false, 'cold idle jump weight 0');

api.apply(PRESETS.expressive);
assert.equal(api.policy().hearts, true);
assert.equal(api.policy().touch.poke.expressions.love, 1);
const expressiveIdle = api.idle(false, null).map(([key]) => key);
assert.equal(expressiveIdle.includes('run'), true, 'expressive idle can run');

api.apply({ ...PRESETS.expressive, touch: { ...PRESETS.expressive.touch, poke: { ...PRESETS.expressive.touch.poke, expressions: { love: 100 } } }, hearts: false });
assert.equal(api.pickFace('poke', {}), 'love', 'only love in the pool');
assert.equal(api.policy().hearts, false, 'hearts policy is read at emission time');

rmSync(root, { recursive: true, force: true });
console.log('engine tests passed');
