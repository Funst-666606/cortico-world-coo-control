/**
 * The mod itself. It changes only two files of the installed `cortico-world-desktop-pet`
 * package and writes one generated JSON policy next to them:
 *
 * - `web/kit/body.js`: inserts a small policy engine and replaces the hard-coded click,
 *   petting, idle and heart lines with policy lookups. The stock behaviour is the default.
 * - `web/pet-app.js`: fetches `/web/kit/coo-control.json` every 1.5 s and posts it into the
 *   body frame with `body.set({ cooControl })`; the body applies it without a reload.
 * - `web/kit/coo-control.json`: the generated policy; not a source file, removed on restore.
 *
 * The page runs the body in a sandboxed frame, so the body cannot fetch the policy itself
 * (opaque origin). The parent page has the same origin as the static files and does the fetch.
 *
 * Every edit is preceded by a content-addressed backup and followed by a re-classification.
 * Unknown code is refused, not guessed at: an app update that rewrites these lines must wait
 * for a plugin update, which is the version-compatibility story in README.md.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { PRESETS } from './policy.js';

export const HOST_PACKAGE = 'cortico-world-desktop-pet';
export const BODY_REL = 'web/kit/body.js';
export const PAGE_REL = 'web/pet-app.js';
export const POLICY_REL = 'web/kit/coo-control.json';
export const BODY_MARKER = '__COO_CONTROL_POLICY';
export const PAGE_MARKER = '__COO_CONTROL_LOADER';

const BODY_ANCHOR = /export function createBody\(host, opts\) \{/;
const DECIDE_RE = /  function decide\(\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  \/\* particles \*\//;
const POKE_RE = /const r = \['happy', 'wink', 'surprised', 'love', 'angry'\]\[Math\.floor\(Math\.random\(\) \* 5\)\];\r?\n        setExpr\(r\);/;
const HOP_RE = /if \(Math\.random\(\) < \.5 && pet\.mode === 'idle'\)/;
const PET_RE = /else setExpr\(Math\.random\(\) < \.5 \? 'love' : 'shy'\);/;
const HEART_RE = /if \(n === 'love'\) for \(let i = 0; i < 4; i\+\+\) emitHeart\(\);/;
const SET_POLICY_RE = /if \(s\.theme\) doc\.documentElement\.dataset\.theme = s\.theme;/;
const PAGE_BODY_RE = /let body = null, words = new Map\(\), T = 0;/;
const PAGE_SET_RE = /next\.set\(\{ roam: prefs\.roam, \.\.\.bodyState \}\);/;

const POKE_NEW = "        setExpr(__cooPickFace('poke', words));";
const HOP_NEW = 'if (Math.random() < __cooPolicy.touch.poke.hopChance && pet.mode === \'idle\')';
const PET_NEW = "else setExpr(__cooPickFace('pet', words));";
const HEART_NEW = "if (n === 'love' && __cooPolicy.hearts) for (let i = 0; i < 4; i++) emitHeart();";
const SET_POLICY_NEW = "if (s.theme) doc.documentElement.dataset.theme = s.theme;\n      if (s.cooControl) __cooApplyPolicy(s.cooControl);";

const DECIDE_NEW = `  function decide() {
    const calm = roam === 'calm';
    const opts2 = __cooIdleActions(calm, pet.lastAct);
    let r = Math.random() * opts2.reduce((a, o) => a + o[1], 0), pick = 'wait';
    for (const o of opts2) { if ((r -= o[1]) < 0) { pick = o[0]; break; } }
    if (pick === 'look') { setMode('look'); pet.lastAct = 'look'; }
    else if (pick === 'expr') { setExpr(__cooPickFace('idle', words)); pet.lastAct = 'expr'; }
    // a sit she chose decides up front whether it ends in sleep, so she only gets drowsy when she will fall asleep
    else if (pick === 'sit') { setMode('sit', { dur: rnd(6, 9), willSleep: Math.random() < __cooPolicy.idle.sitSleepChance }); pet.lastAct = 'sit'; }
    else if (pick !== 'wait') act(pick);
    if (pet.mode === 'idle' && T >= pet.nextAt) pet.nextAt = T + rnd(2, 4);
  }`;

const PRELUDE = `/* ${BODY_MARKER} */
const __COO_DEFAULT_POLICY = ${JSON.stringify(PRESETS.expressive)};
let __cooPolicy = __COO_DEFAULT_POLICY;
function __cooNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
function __cooChance(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}
function __cooWeights(fallback, raw) {
  const source = raw && typeof raw === 'object' && Object.keys(raw).length ? raw : fallback;
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    const n = __cooNumber(value, 0);
    if (n > 0) out[key] = n;
  }
  return out;
}
function __cooApplyPolicy(raw) {
  if (!raw || typeof raw !== 'object') return;
  const p = raw.policy && typeof raw.policy === 'object' ? raw.policy : raw;
  const d = __COO_DEFAULT_POLICY;
  __cooPolicy = {
    idle: {
      weights: __cooWeights(d.idle.weights, p.idle && p.idle.weights),
      calmWeights: __cooWeights(d.idle.calmWeights, p.idle && p.idle.calmWeights),
      expressions: __cooWeights(d.idle.expressions, p.idle && p.idle.expressions),
      sitSleepChance: __cooChance(p.idle && p.idle.sitSleepChance, d.idle.sitSleepChance),
    },
    touch: {
      poke: {
        expressions: __cooWeights(d.touch.poke.expressions, p.touch && p.touch.poke && p.touch.poke.expressions),
        hopChance: __cooChance(p.touch && p.touch.poke && p.touch.poke.hopChance, d.touch.poke.hopChance),
      },
      pet: {
        expressions: __cooWeights(d.touch.pet.expressions, p.touch && p.touch.pet && p.touch.pet.expressions),
      },
    },
    hearts: p.hearts !== false,
  };
}
function __cooPickWeighted(map, fallback, allowed) {
  const entries = Object.entries(map || {}).filter(([key, value]) => Number(value) > 0 && (!allowed || allowed.has(key)));
  if (!entries.length) return fallback;
  let total = 0;
  for (const [, value] of entries) total += Number(value);
  let r = Math.random() * total;
  for (const [key, value] of entries) {
    if ((r -= Number(value)) < 0) return key;
  }
  return entries[entries.length - 1][0];
}
function __cooPickFace(kind, words) {
  const map = kind === 'idle' ? __cooPolicy.idle.expressions : __cooPolicy.touch[kind] && __cooPolicy.touch[kind].expressions;
  const allowed = new Set(KIT_EXPRESSIONS);
  for (const [word, spec] of Object.entries(words || {})) {
    if (spec && spec.expression) allowed.add(word);
  }
  return __cooPickWeighted(map, 'neutral', allowed);
}
function __cooIdleActions(calm, last) {
  const weights = calm ? __cooPolicy.idle.calmWeights : __cooPolicy.idle.weights;
  const entries = Object.entries(weights || {}).filter(([key, value]) => Number(value) > 0 && (key !== last || key === 'wait'));
  return entries.length ? entries : [['wait', 1]];
}
`;

const PAGE_LOADER = `/* ${PAGE_MARKER} */
let __cooPolicy = null;
async function __cooLoadPolicy() {
  try {
    const res = await fetch(new URL('./kit/coo-control.json?t=' + Date.now(), import.meta.url), { cache: 'no-store' });
    if (!res.ok) return;
    __cooPolicy = await res.json();
    body?.set({ cooControl: __cooPolicy });
  } catch {
    // no policy yet, or a read failed: the body keeps its stock defaults
  }
}
setInterval(__cooLoadPolicy, 1500);
__cooLoadPolicy();`;

const PAGE_SET_NEW = 'next.set({ roam: prefs.roam, ...bodyState, ...(__cooPolicy ? { cooControl: __cooPolicy } : {}) });';

const BODY_CHECKS = [
  { id: 'createBody', re: BODY_ANCHOR },
  { id: 'decide', re: DECIDE_RE },
  { id: 'poke', re: POKE_RE },
  { id: 'hop', re: HOP_RE },
  { id: 'pet', re: PET_RE },
  { id: 'hearts', re: HEART_RE },
  { id: 'setPolicy', re: SET_POLICY_RE },
];

const PAGE_CHECKS = [
  { id: 'body', re: PAGE_BODY_RE },
  { id: 'set', re: PAGE_SET_RE },
];

const count = (text, re) => {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  return [...text.matchAll(new RegExp(re.source, flags))].length;
};

function hash(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function writeAtomic(file, text) {
  const tmp = `${file}.coo-control-${process.pid}-${Date.now()}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  try {
    renameSync(tmp, file);
  } catch (renameError) {
    // Windows can hold the old file open while the pet host reads it. A direct write is still
    // one complete UTF-8 string; fall back to it and remove the temp file.
    try {
      writeFileSync(file, text, 'utf8');
    } catch {
      try { unlinkSync(tmp); } catch { /* best effort */ }
      throw renameError;
    }
    try { unlinkSync(tmp); } catch { /* best effort */ }
  }
}

function writeJsonAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

function isAppRoot(root) {
  let dir;
  try {
    dir = realpathSync(root);
  } catch {
    return false;
  }
  const pkg = readJson(join(dir, 'package.json'));
  if (pkg?.name !== 'coopanion' && pkg?.productName !== 'Coopanion') return false;
  try {
    return statSync(join(dir, 'node_modules', HOST_PACKAGE, BODY_REL)).isFile();
  } catch {
    return false;
  }
}

/**
 * Locate the installed Coopanion app directory. The Core's cwd is the app directory when the
 * app spawns it; the executable's resources path covers a Core started elsewhere.
 */
export function locateAppRoot({ appRoot, cwd = process.cwd(), execPath = process.execPath, platform = process.platform } = {}) {
  const candidates = appRoot
    ? [appRoot]
    : [
      cwd,
      process.env.CORTICO_APP_ROOT,
      join(dirname(execPath), 'resources', 'app'),
      platform === 'darwin' ? join(dirname(execPath), '..', 'Resources', 'app') : null,
    ].filter(Boolean);
  const tried = [];
  for (const candidate of candidates) {
    const root = resolve(candidate);
    tried.push(root);
    if (isAppRoot(root)) return { root: realpathSync(root), source: candidate };
  }
  return { error: `Coopanion app directory not found (tried: ${tried.join(', ')})`, tried };
}

function pathsOf(appRoot) {
  const pkg = join(appRoot, 'node_modules', HOST_PACKAGE);
  return {
    body: join(pkg, BODY_REL),
    page: join(pkg, PAGE_REL),
    policy: join(pkg, POLICY_REL),
  };
}

function versionsOf(appRoot) {
  const app = readJson(join(appRoot, 'package.json'));
  const host = readJson(join(appRoot, 'node_modules', HOST_PACKAGE, 'package.json'));
  return {
    appVersion: typeof app?.version === 'string' ? app.version : null,
    hostVersion: typeof host?.version === 'string' ? host.version : null,
  };
}

/** How one patched file looks now. */
export function classifyBody(text) {
  if (text.includes(BODY_MARKER) && text.includes('__cooPickFace') && text.includes('__cooApplyPolicy')) return { state: 'patched' };
  const missing = BODY_CHECKS.filter((check) => count(text, check.re) !== 1).map((check) => check.id);
  if (!missing.length) return { state: 'original' };
  return { state: 'unsupported', reason: `expected exactly one of: ${missing.join(', ')}` };
}

export function classifyPage(text) {
  if (text.includes(PAGE_MARKER) && text.includes('__cooLoadPolicy')) return { state: 'patched' };
  const missing = PAGE_CHECKS.filter((check) => count(text, check.re) !== 1).map((check) => check.id);
  if (!missing.length) return { state: 'original' };
  return { state: 'unsupported', reason: `expected exactly one of: ${missing.join(', ')}` };
}

function patchBody(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const prelude = PRELUDE.replace(/\n/g, eol).trimEnd();
  let next = text.replace(BODY_ANCHOR, (match) => `${prelude}${eol}${match}`);
  next = next.replace(DECIDE_RE, () => `${DECIDE_NEW.replace(/\n/g, eol)}${eol}${eol}  /* particles */`);
  next = next.replace(POKE_RE, POKE_NEW);
  next = next.replace(HOP_RE, HOP_NEW);
  next = next.replace(PET_RE, PET_NEW);
  next = next.replace(HEART_RE, HEART_NEW);
  next = next.replace(SET_POLICY_RE, SET_POLICY_NEW.replace(/\n/g, eol));
  return next;
}

function patchPage(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const loader = PAGE_LOADER.replace(/\n/g, eol).trimEnd();
  let next = text.replace(PAGE_BODY_RE, (match) => `${match}${eol}${loader}`);
  next = next.replace(PAGE_SET_RE, PAGE_SET_NEW);
  return next;
}

function statePathOf(dataDir) {
  return join(dataDir, 'coo-control', 'state.json');
}

function backupRootOf(dataDir) {
  return join(dataDir, 'coo-control', 'backups');
}

function policyDataPathOf(dataDir) {
  return join(dataDir, 'coo-control', 'policy.json');
}

function writeBackup(root, name, text) {
  const h = hash(text);
  const dir = join(root, h);
  const file = join(dir, name);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(file)) writeFileSync(file, text, 'utf8');
  return file;
}

/** Inspect without writing. */
export function inspect({ appRoot, dataDir } = {}) {
  const located = locateAppRoot({ appRoot });
  if (located.error) return { ok: false, error: located.error, tried: located.tried };
  const root = located.root;
  const data = dataDir ?? join(root, 'data');
  const paths = pathsOf(root);
  const bodyText = readText(paths.body);
  const pageText = readText(paths.page);
  const body = typeof bodyText === 'string'
    ? { path: paths.body, ...classifyBody(bodyText) }
    : { path: paths.body, state: 'missing', error: bodyText.error };
  const page = typeof pageText === 'string'
    ? { path: paths.page, ...classifyPage(pageText) }
    : { path: paths.page, state: 'missing', error: pageText.error };
  const policy = readJson(paths.policy) ?? readJson(policyDataPathOf(data));
  const state = readJson(statePathOf(data)) ?? {};
  const supported = body.state !== 'unsupported' && body.state !== 'missing'
    && page.state !== 'unsupported' && page.state !== 'missing';
  return {
    ok: true,
    appRoot: root,
    source: located.source,
    ...versionsOf(root),
    dataDir: data,
    paths,
    statePath: statePathOf(data),
    body,
    page,
    policy,
    state,
    supported,
    patched: body.state === 'patched' && page.state === 'patched',
    error: null,
  };
}

/**
 * Write the policy JSON the page fetches. The data directory copy is canonical; the app copy
 * is what the running page reads. Both are tiny and replaced atomically.
 */
export function writePolicy({ appRoot, dataDir, policy = PRESETS.expressive } = {}) {
  const located = appRoot ? { root: appRoot } : locateAppRoot({});
  if (located.error) return { ok: false, error: located.error, hash: null };
  const root = located.root;
  const data = dataDir ?? join(root, 'data');
  const doc = { schema: 1, ...policy, updatedAt: new Date().toISOString() };
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  const dataPath = policyDataPathOf(data);
  const appPath = pathsOf(root).policy;
  let error = null;
  try {
    mkdirSync(dirname(dataPath), { recursive: true });
    writeAtomic(dataPath, text);
  } catch (e) {
    error = `data policy not written: ${e instanceof Error ? e.message : String(e)}`;
  }
  try {
    writeAtomic(appPath, text);
  } catch (e) {
    error = `app policy not written: ${e instanceof Error ? e.message : String(e)}`;
  }
  return { ok: !error, error, appPath, dataPath, hash: hash(text) };
}

/**
 * Keep `state.json`'s policy hash in step with a hot-reloaded policy, so restore can still
 * recognise (and remove) the generated file after preset/weight changes.
 */
export function recordPolicy({ appRoot, dataDir, policy, policyHash, error = null } = {}) {
  const located = appRoot ? { root: appRoot } : locateAppRoot({});
  if (located.error) return { ok: false, error: located.error };
  const root = located.root;
  const data = dataDir ?? join(root, 'data');
  const statePath = statePathOf(data);
  const state = readJson(statePath) ?? {};
  try {
    writeJsonAtomic(statePath, {
      ...state,
      appRoot: root,
      ...versionsOf(root),
      preset: policy?.preset ?? 'custom',
      policyPath: pathsOf(root).policy,
      policyHash: policyHash ?? state.policyHash ?? null,
      updatedAt: new Date().toISOString(),
      error,
    });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Apply the patch. Backups are written before the first byte changes and are never overwritten.
 * Both files must be either original or already patched; a file that looks different is refused
 * as a whole, so an app update never gets a half patch.
 */
export function apply({ appRoot, dataDir, policy = PRESETS.expressive, logger = null } = {}) {
  const before = inspect({ appRoot, dataDir });
  if (!before.ok) return { ...before, changed: false };
  if (!before.supported) {
    return { ...before, ok: false, changed: false, error: `unsupported files: ${before.body.state} ${before.body.reason ?? ''}; ${before.page.state} ${before.page.reason ?? ''}`.trim() };
  }
  const root = before.appRoot;
  const data = before.dataDir;
  const paths = before.paths;
  const state = before.state ?? {};
  const files = { ...(state.files ?? {}) };
  let changed = false;

  const bodyRead = readText(paths.body);
  const pageRead = readText(paths.page);
  const bodyText = typeof bodyRead === 'string' ? bodyRead : null;
  const pageText = typeof pageRead === 'string' ? pageRead : null;
  if (bodyText === null || pageText === null) {
    return { ...before, ok: false, changed: false, error: 'body.js or pet-app.js disappeared while reading' };
  }

  const bodyState = classifyBody(bodyText).state;
  const pageState = classifyPage(pageText).state;
  if ((bodyState !== 'original' && bodyState !== 'patched') || (pageState !== 'original' && pageState !== 'patched')) {
    return { ...before, ok: false, changed: false, error: `refusing to patch: body=${bodyState}, page=${pageState}` };
  }

  const writes = [];
  if (bodyState === 'original') writes.push({ name: 'body.js', path: paths.body, original: bodyText, next: patchBody(bodyText) });
  if (pageState === 'original') writes.push({ name: 'pet-app.js', path: paths.page, original: pageText, next: patchPage(pageText) });

  // Verify every replacement in memory before touching the first file.
  for (const write of writes) {
    const check = write.name === 'body.js' ? classifyBody(write.next) : classifyPage(write.next);
    if (check.state !== 'patched') {
      return { ...before, ok: false, changed: false, error: `${write.name}: patch result is ${check.state} ${check.reason ?? ''}`.trim() };
    }
  }

  try {
    mkdirSync(join(data, 'coo-control'), { recursive: true });
    const probe = join(data, 'coo-control', `.write-test-${process.pid}`);
    writeFileSync(probe, '');
    unlinkSync(probe);
  } catch (e) {
    return { ...before, ok: false, changed: false, error: `Coopanion data directory is not writable (${join(data, 'coo-control')}): ${e instanceof Error ? e.message : String(e)}` };
  }

  for (const write of writes) {
    try {
      const backupPath = writeBackup(backupRootOf(data), write.name, write.original);
      writeAtomic(write.path, write.next);
      changed = true;
      files[write.name] = {
        ...(files[write.name] ?? {}),
        backupPath,
        originalHash: hash(write.original),
        patchedHash: hash(write.next),
        patchedAt: new Date().toISOString(),
      };
      logger?.info?.(`已写入行为补丁 ${write.name}`);
    } catch (e) {
      const error = `${write.name}: ${e instanceof Error ? e.message : String(e)}`;
      try {
        writeJsonAtomic(statePathOf(data), {
          ...state,
          appRoot: root,
          ...versionsOf(root),
          files,
          updatedAt: new Date().toISOString(),
          error,
        });
      } catch { /* the report below is enough */ }
      return { ...before, ok: false, changed, error };
    }
  }

  const written = writePolicy({ appRoot: root, dataDir: data, policy });
  if (!written.ok) {
    const error = written.error ?? 'policy file not written';
    try {
      writeJsonAtomic(statePathOf(data), {
        ...state,
        appRoot: root,
        ...versionsOf(root),
        files,
        updatedAt: new Date().toISOString(),
        error,
      });
    } catch { /* report below */ }
    return { ...inspect({ appRoot: root, dataDir: data }), ok: false, changed, error };
  }

  const nextState = {
    ...state,
    appRoot: root,
    ...versionsOf(root),
    preset: policy.preset ?? 'custom',
    policyPath: written.appPath,
    policyHash: written.hash,
    files,
    updatedAt: new Date().toISOString(),
    error: null,
  };
  try {
    writeJsonAtomic(statePathOf(data), nextState);
  } catch (e) {
    return { ...inspect({ appRoot: root, dataDir: data }), ok: false, changed, error: `state not written: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ...inspect({ appRoot: root, dataDir: data }), ok: true, changed, error: null };
}

/**
 * Restore the exact bytes from this extension's backups. Refuses if a file is neither original
 * nor the exact patched file this extension wrote, so an app update or a manual edit is never
 * overwritten silently.
 */
export function restore({ appRoot, dataDir, logger = null } = {}) {
  const now = inspect({ appRoot, dataDir });
  if (!now.ok) return { ...now, restored: [], error: now.error };
  const state = now.state ?? {};
  const files = state.files ?? {};
  const restored = [];
  let ok = true;
  let error = null;

  for (const [name, path] of [['body.js', now.paths.body], ['pet-app.js', now.paths.page]]) {
    const text = readText(path);
    if (typeof text !== 'string') {
      ok = false;
      error ??= `${name}: ${text.error}`;
      continue;
    }
    const current = name === 'body.js' ? classifyBody(text) : classifyPage(text);
    if (current.state === 'original') {
      restored.push(name);
      continue;
    }
    if (current.state !== 'patched') {
      ok = false;
      error ??= `${name}: current file is ${current.state}; refusing to overwrite`;
      continue;
    }
    const record = files[name] ?? {};
    if (!record.patchedHash || hash(text) !== record.patchedHash) {
      ok = false;
      error ??= `${name}: current file is not the patched file this extension wrote (update or manual edit); refused`;
      continue;
    }
    if (!record.backupPath || !existsSync(record.backupPath)) {
      ok = false;
      error ??= `${name}: no backup recorded`;
      continue;
    }
    const backup = readText(record.backupPath);
    if (typeof backup !== 'string' || (record.originalHash && hash(backup) !== record.originalHash)) {
      ok = false;
      error ??= `${name}: backup is missing or does not match the recorded original`;
      continue;
    }
    try {
      writeAtomic(path, backup);
      restored.push(name);
      logger?.info?.(`已还原 ${name}`);
    } catch (e) {
      ok = false;
      error ??= `${name}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const policyPath = now.paths.policy;
  const policyText = readText(policyPath);
  if (typeof policyText === 'string') {
    if (state.policyHash && hash(policyText) === state.policyHash) {
      try {
        unlinkSync(policyPath);
      } catch (e) {
        ok = false;
        error ??= `policy file not removed: ${e instanceof Error ? e.message : String(e)}`;
      }
    } else if (policyText.trim()) {
      ok = false;
      error ??= 'policy file was edited outside this extension; left in place';
    }
  }

  try {
    writeJsonAtomic(now.statePath, {
      ...state,
      appRoot: now.appRoot,
      ...versionsOf(now.appRoot),
      files,
      restoredAt: new Date().toISOString(),
      error,
    });
  } catch (e) {
    ok = false;
    error ??= `state not written: ${e instanceof Error ? e.message : String(e)}`;
  }
  return { ...inspect({ appRoot: now.appRoot, dataDir: now.dataDir }), ok, error, restored };
}
