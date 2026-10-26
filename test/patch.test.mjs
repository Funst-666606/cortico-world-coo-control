/**
 * Patch/rollback/idempotence tests. The fixtures contain the exact lines this patch targets.
 * Set COOPANION_APP_ROOT to a real resources/app to also qualify this plugin against the
 * installed 0.2.11 files (the test copies them; it never touches the install).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { apply, classifyBody, classifyPage, inspect, locateAppRoot, restore, writePolicy } from '../src/patch.js';
import { PRESETS } from '../src/policy.js';

const BODY = `/** fixture body with the stock behaviour lines */
export const KIT_EXPRESSIONS = ['neutral', 'happy', 'wink', 'love', 'shy', 'surprised', 'angry', 'sleepy'];
export function createBody(host, opts) {
  const words = opts.words || {};
  let roam = 'free';
  const pet = { lastAct: null, mode: 'idle', nextAt: 0, expr: null, exprUntil: 0 };
  const T = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const setMode = () => {};
  const act = () => {};
  const onEvent = () => {};
  const play = () => {};
  function setExpr(n) {
    if (n === 'love') for (let i = 0; i < 4; i++) emitHeart();
  }
  function emitHeart() {}
  function decide() {
    const calm = roam === 'calm';
    const opts2 = [['walk', calm ? 10 : 28], ['run', calm ? 0 : 12], ['look', 14], ['jump', calm ? 2 : 8], ['sit', 16], ['expr', 12], ['wait', calm ? 30 : 10]]
      .filter(o => o[1] > 0 && (o[0] !== pet.lastAct || o[0] === 'wait'));
    let r = Math.random() * opts2.reduce((a, o) => a + o[1], 0), pick = 'wait';
    for (const o of opts2) { if ((r -= o[1]) < 0) { pick = o[0]; break; } }
    if (pick === 'look') { setMode('look'); pet.lastAct = 'look'; }
    else if (pick === 'expr') { setExpr(['happy', 'wink', 'love', 'sleepy', 'surprised', 'shy'][Math.floor(Math.random() * 6)]); pet.lastAct = 'expr'; }
    // a sit she chose decides up front whether it ends in sleep, so she only gets drowsy when she will fall asleep
    else if (pick === 'sit') { setMode('sit', { dur: rnd(6, 9), willSleep: Math.random() < .6 }); pet.lastAct = 'sit'; }
    else if (pick !== 'wait') act(pick);
    if (pet.mode === 'idle' && T >= pet.nextAt) pet.nextAt = T + rnd(2, 4);
  }

  /* particles */
  function pointerUp(p) {
    if (pet.mode === 'drag') return;
    else if (Math.random() < 400) {
      if (pet.mode === 'sleep' || pet.mode === 'sit') {
        setMode('wake', { startle: true });
      } else if (pet.mode !== 'dizzy') {
        play('poke', 'touch');
        const r = ['happy', 'wink', 'surprised', 'love', 'angry'][Math.floor(Math.random() * 5)];
        setExpr(r);
        if (Math.random() < .5 && pet.mode === 'idle') setMode('crouch', { jumpV: 480, jumpVx: 0 });
        onEvent('touch', { kind: 'poke' });
      }
    }
  }
  function pointerMove(p) {
    const over = true;
    if (over) {
      if (pet.mode === 'sleep') emitHeart();
      else setExpr(Math.random() < .5 ? 'love' : 'shy');
      onEvent('touch', { kind: 'pet', asleep: pet.mode === 'sleep' });
    }
  }
  return {
    do: (w) => w,
    set(s) {
      if (s.theme) doc.documentElement.dataset.theme = s.theme;
    },
  };
}
`;

const PAGE = `/** fixture page with the stock body setup */
const prefs = { roam: 'free' };
const bodyState = { listening: false };
let body = null, words = new Map(), T = 0;
async function showFigure() {
  const next = { set() {}, dispose() {} };
  next.set({ roam: prefs.roam, ...bodyState });
  body = next;
}
`;

function makeApp({ body = BODY, page = PAGE } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'coocontrol-'));
  const app = join(root, 'resources', 'app');
  const pkg = join(app, 'node_modules', 'cortico-world-desktop-pet');
  mkdirSync(join(pkg, 'web', 'kit'), { recursive: true });
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'coopanion', version: '0.2.11' }));
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'cortico-world-desktop-pet', version: '0.2.0' }));
  writeFileSync(join(pkg, 'web', 'kit', 'body.js'), body);
  writeFileSync(join(pkg, 'web', 'pet-app.js'), page);
  return { root, app, pkg, data: join(root, 'data'), body: join(pkg, 'web', 'kit', 'body.js'), page: join(pkg, 'web', 'pet-app.js') };
}

function read(file) {
  return readFileSync(file, 'utf8');
}

function syntaxCheck(file) {
  const target = join(dirname(file), `check-${Date.now()}.mjs`);
  writeFileSync(target, read(file));
  const result = spawnSync(process.execPath, ['--check', target], { stdio: 'inherit' });
  rmSync(target, { force: true });
  assert.equal(result.status, 0, `syntax error in ${file}: ${result.error?.message ?? 'node --check failed'}`);
}

// --- location and classification -------------------------------------------
const app = makeApp();
assert.equal(locateAppRoot({ appRoot: app.app }).root, app.app);
assert.equal(classifyBody(BODY).state, 'original');
assert.equal(classifyPage(PAGE).state, 'original');
assert.equal(classifyBody(BODY.replace('function decide()', 'function decideRenamed()')).state, 'unsupported');
assert.equal(classifyPage(PAGE.replace('next.set(', 'next.assign(')).state, 'unsupported');

// --- apply / idempotence / restore ----------------------------------------
const first = apply({ appRoot: app.app, dataDir: app.data, policy: PRESETS.cold });
assert.equal(first.ok, true, first.error);
assert.equal(first.patched, true);
assert.equal(first.changed, true);
assert.equal(first.body.state, 'patched');
assert.equal(first.page.state, 'patched');
assert.match(read(app.body), /__COO_CONTROL_POLICY/);
assert.match(read(app.body), /__cooPickFace\('poke', words\)/);
assert.match(read(app.body), /__cooPolicy\.touch\.poke\.hopChance/);
assert.match(read(app.body), /__cooPolicy\.idle\.sitSleepChance/);
assert.match(read(app.page), /__COO_CONTROL_LOADER/);
assert.match(read(app.page), /cooControl: __cooPolicy/);
assert.equal(existsSync(join(app.pkg, 'web', 'kit', 'coo-control.json')), true);
const policyFile = JSON.parse(read(join(app.pkg, 'web', 'kit', 'coo-control.json')));
assert.equal(policyFile.schema, 1);
assert.equal(policyFile.preset, 'cold');
assert.equal(policyFile.hearts, false);
syntaxCheck(app.body);
syntaxCheck(app.page);

const second = apply({ appRoot: app.app, dataDir: app.data, policy: PRESETS.cold });
assert.equal(second.ok, true);
assert.equal(second.changed, false);
assert.equal(second.patched, true);
assert.equal(inspect({ appRoot: app.app, dataDir: app.data }).patched, true);

const restored = restore({ appRoot: app.app, dataDir: app.data });
assert.equal(restored.ok, true, restored.error);
assert.deepEqual(restored.restored.sort(), ['body.js', 'pet-app.js']);
assert.equal(read(app.body), BODY);
assert.equal(read(app.page), PAGE);
assert.equal(existsSync(join(app.pkg, 'web', 'kit', 'coo-control.json')), false);
assert.equal(inspect({ appRoot: app.app, dataDir: app.data }).patched, false);

// --- policy file alone -----------------------------------------------------
const written = writePolicy({ appRoot: app.app, dataDir: app.data, policy: PRESETS.reserved });
assert.equal(written.ok, true);
const standalone = JSON.parse(read(join(app.pkg, 'web', 'kit', 'coo-control.json')));
assert.equal(standalone.preset, 'reserved');
assert.equal(standalone.hearts, false);

// --- real 0.2.11 files, copied out of the install --------------------------
const realRoot = process.env.COOPANION_APP_ROOT;
if (realRoot) {
  const realBody = read(join(realRoot, 'node_modules', 'cortico-world-desktop-pet', 'web', 'kit', 'body.js'));
  const realPage = read(join(realRoot, 'node_modules', 'cortico-world-desktop-pet', 'web', 'pet-app.js'));
  const real = makeApp({ body: realBody, page: realPage });
  const result = apply({ appRoot: real.app, dataDir: real.data, policy: PRESETS.expressive });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.patched, true);
  syntaxCheck(real.body);
  syntaxCheck(real.page);
  const back = restore({ appRoot: real.app, dataDir: real.data });
  assert.equal(back.ok, true, back.error);
  assert.equal(read(real.body), realBody);
  assert.equal(read(real.page), realPage);
  console.log('real Coopanion files: apply/restore passed');
}

rmSync(app.root, { recursive: true, force: true });
console.log('patch tests passed');
