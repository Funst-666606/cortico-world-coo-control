/** Shape checks that need no Coopanion install: describe.json, the World API and config groups. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import definition from '../src/index.js';
import { DESCRIBE } from '../src/describe.js';
import { CUSTOM_KEYS, DEFAULTS, PRESET_NAMES } from '../src/policy.js';

const describeFile = JSON.parse(readFileSync(new URL('../describe.json', import.meta.url), 'utf8'));
assert.deepEqual(describeFile, DESCRIBE, 'describe.json must match src/describe.js');
assert.equal(definition.id, 'coo-control');
assert.equal(definition.label, 'Coo Control');
assert.deepEqual(definition.defaults(), DEFAULTS);
assert.deepEqual(definition.describe, DESCRIBE);

const first = definition.defaults();
first.preset = 'cold';
assert.equal(definition.defaults().preset, 'expressive', 'defaults must be a fresh object');

const ctx = {
  id: definition.id,
  cfg: { ...definition.defaults(), enabled: false },
  timezone: 'Asia/Taipei',
  botName: 'test',
  botDir: process.cwd(),
  packageDir: process.cwd(),
  dataDir: process.cwd(),
  repoRoot: process.cwd(),
  secret: () => '',
  storeSecret() {},
  persist(patch) { Object.assign(ctx.cfg, patch); },
  restart: async () => {},
};

const world = definition.create(ctx);
assert.equal(world.id, 'coo-control');
assert.equal(typeof world.envPromptVars, 'function');
const vars = world.envPromptVars();
assert.equal(typeof vars['cooControl.preset'], 'string');
assert.match(vars['cooControl.model'], /允许/);

const tools = world.tools();
assert.equal(tools.length, 6);
assert.deepEqual(tools.map((tool) => tool.name).sort(), [
  'coo_control_apply', 'coo_control_get', 'coo_control_reset',
  'coo_control_restore', 'coo_control_set', 'coo_control_status',
]);
for (const tool of tools) {
  assert.equal(typeof tool.handler, 'function');
  assert.equal(tool.summary, undefined, 'summary is display-only and must not reach the model schema');
  assert.equal(tool.parameters.type, 'object');
}

const ui = world.webUi('zh');
assert.equal(ui.label, '控制权回交');
assert.equal(ui.config.length, 5);
assert.equal(ui.promptDocs.length, 1);
assert.equal(ui.promptDocs[0].role, 'envPrompt');
assert.equal(ui.config[0].schema.properties['worlds.coo-control.preset'].enum.join(','), PRESET_NAMES.join(','));
for (const key of CUSTOM_KEYS) {
  const found = ui.config.some((group) => group.schema.properties[`worlds.coo-control.${key}`]);
  assert.equal(found, true, `config group for ${key}`);
}
for (const group of ui.config) {
  for (const key of Object.keys(group.schema.properties)) assert.match(key, /^worlds\.coo-control\./);
  assert.equal(group.owner, 'world:coo-control');
}
assert.equal(world.webUi('en').label, 'Coo Control');

const get = JSON.parse(world.get());
assert.equal(get.preset, 'expressive');
assert.equal(get.policy.hearts, true);

const setResult = world.set({ preset: 'cold' });
assert.match(setResult, /已切到「高冷」/);
assert.equal(ctx.cfg.preset, 'cold');
assert.equal(JSON.parse(world.get()).policy.touch.poke.expressions.love, undefined);

const overrideResult = world.set({ overrides: { pokeLove: 0, petShy: 100 } });
assert.match(overrideResult, /自定义/);
assert.equal(ctx.cfg.preset, 'custom');
assert.equal(ctx.cfg.preset, 'custom');
const custom = JSON.parse(world.get()).policy;
assert.equal(custom.touch.poke.expressions.love, 0);
assert.equal(custom.touch.pet.expressions.shy, 100);

ctx.cfg.modelCanEdit = false;
assert.match(world.set({ preset: 'expressive' }), /模型修改已被用户关闭/);

await world.start({ log: { info() {}, warn() {}, debug() {} } });
assert.match(world.status(), /控制权回交/);
await world.stop();

console.log('world tests passed');
