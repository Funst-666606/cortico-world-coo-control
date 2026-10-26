/**
 * The behaviour policy: what the patched body reads, the three stock presets, and the
 * flat config fields the settings page edits. Pure data and functions; no I/O.
 *
 * Weights are relative (0 disables an entry; they are normalised by the body). Chances are
 * 0..1 in a policy and 0..100 in the config fields the person edits.
 */

export const ID = 'coo-control';
export const PRESET_NAMES = ['expressive', 'reserved', 'cold', 'custom'];

export const PRESET_LABELS = {
  zh: { expressive: '活泼（原默认）', reserved: '内敛', cold: '高冷', custom: '自定义' },
  en: { expressive: 'Expressive (stock)', reserved: 'Reserved', cold: 'Cold', custom: 'Custom' },
};

export const PRESET_DESCRIPTIONS = {
  zh: {
    expressive: '与未安装本扩展时完全一致：会笑、会眨眼、会害羞，也会冒爱心。',
    reserved: '很少主动凑近，点击不冒爱心，摸头只害羞；待机更安静。',
    cold: '表情以平静、惊讶、生气为主；点击/摸头不冒爱心，待机几乎不主动表演。',
    custom: '使用下面的「自定义权重」；每一项 0–100，0 表示禁用。',
  },
  en: {
    expressive: 'Exactly the stock behaviour: smiles, winks, gets shy and can show hearts.',
    reserved: 'Seldom approaches; no hearts on a poke, only shy when petted; quieter idle.',
    cold: 'Mostly neutral, surprised or angry; no hearts on touch; little idle performing.',
    custom: 'Uses the custom weights below; each is 0–100, 0 disables it.',
  },
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const idleWeights = { walk: 28, run: 12, look: 14, jump: 8, sit: 16, expr: 12, wait: 10 };
const calmWeights = { walk: 10, run: 0, look: 14, jump: 2, sit: 16, expr: 12, wait: 30 };
const idleFaces = { happy: 1, wink: 1, love: 1, sleepy: 1, surprised: 1, shy: 1 };
const pokeFaces = { happy: 1, wink: 1, surprised: 1, love: 1, angry: 1 };
const petFaces = { love: 1, shy: 1 };

/** The three stock presets. `expressive` is byte-for-byte the behaviour of the stock body. */
export const PRESETS = {
  expressive: {
    preset: 'expressive',
    idle: {
      weights: { ...idleWeights },
      calmWeights: { ...calmWeights },
      expressions: { ...idleFaces },
      sitSleepChance: 0.6,
    },
    touch: {
      poke: { expressions: { ...pokeFaces }, hopChance: 0.5 },
      pet: { expressions: { ...petFaces } },
    },
    hearts: true,
  },
  reserved: {
    preset: 'reserved',
    idle: {
      weights: { walk: 18, run: 4, look: 18, jump: 3, sit: 20, expr: 10, wait: 27 },
      calmWeights: { walk: 6, run: 0, look: 18, jump: 1, sit: 20, expr: 8, wait: 47 },
      expressions: { happy: 1, wink: 1, shy: 2, sleepy: 1, surprised: 1 },
      sitSleepChance: 0.6,
    },
    touch: {
      poke: { expressions: { happy: 1, wink: 1, surprised: 1, angry: 1 }, hopChance: 0.25 },
      pet: { expressions: { shy: 1 } },
    },
    hearts: false,
  },
  cold: {
    preset: 'cold',
    idle: {
      weights: { walk: 12, run: 0, look: 22, jump: 0, sit: 22, expr: 6, wait: 38 },
      calmWeights: { walk: 3, run: 0, look: 22, jump: 0, sit: 22, expr: 4, wait: 49 },
      expressions: { neutral: 3, surprised: 1, angry: 1 },
      sitSleepChance: 0.6,
    },
    touch: {
      poke: { expressions: { neutral: 3, surprised: 1, angry: 1 }, hopChance: 0.1 },
      pet: { expressions: { neutral: 3, surprised: 1 } },
    },
    hearts: false,
  },
};

/**
 * Flat config fields for the custom preset. The numbers are the stock weights, with
 * expressions at 100 (relative weights; 100 is not a percentage) and chances at 50/60.
 */
export const CUSTOM_DEFAULTS = {
  idleWalk: 28, idleRun: 12, idleLook: 14, idleJump: 8, idleSit: 16, idleExpr: 12, idleWait: 10,
  idleHappy: 100, idleWink: 100, idleLove: 100, idleSleepy: 100, idleSurprised: 100, idleShy: 100,
  idleNeutral: 0, idleAngry: 0,
  sitSleep: 60,
  pokeHappy: 100, pokeWink: 100, pokeSurprised: 100, pokeLove: 100, pokeAngry: 100, pokeHop: 50,
  pokeNeutral: 0, pokeShy: 0,
  petLove: 100, petShy: 100,
  petNeutral: 0, petSurprised: 0, petAngry: 0,
  hearts: true,
};

/** The World's defaults; `enabled:false` means the package is installed but not mounted. */
export const DEFAULTS = {
  enabled: false,
  autoApply: true,
  preset: 'expressive',
  modelCanEdit: true,
  ...CUSTOM_DEFAULTS,
};

/**
 * Every flat field and where it lands in a policy. `scale` 100 means the config value is a
 * percentage and the policy stores 0..1.
 */
export const FLAT_FIELDS = [
  { key: 'idleWalk', path: ['idle', 'weights', 'walk'] },
  { key: 'idleRun', path: ['idle', 'weights', 'run'] },
  { key: 'idleLook', path: ['idle', 'weights', 'look'] },
  { key: 'idleJump', path: ['idle', 'weights', 'jump'] },
  { key: 'idleSit', path: ['idle', 'weights', 'sit'] },
  { key: 'idleExpr', path: ['idle', 'weights', 'expr'] },
  { key: 'idleWait', path: ['idle', 'weights', 'wait'] },
  { key: 'idleHappy', path: ['idle', 'expressions', 'happy'] },
  { key: 'idleWink', path: ['idle', 'expressions', 'wink'] },
  { key: 'idleLove', path: ['idle', 'expressions', 'love'] },
  { key: 'idleSleepy', path: ['idle', 'expressions', 'sleepy'] },
  { key: 'idleSurprised', path: ['idle', 'expressions', 'surprised'] },
  { key: 'idleShy', path: ['idle', 'expressions', 'shy'] },
  { key: 'idleNeutral', path: ['idle', 'expressions', 'neutral'] },
  { key: 'idleAngry', path: ['idle', 'expressions', 'angry'] },
  { key: 'sitSleep', path: ['idle', 'sitSleepChance'], scale: 100 },
  { key: 'pokeHappy', path: ['touch', 'poke', 'expressions', 'happy'] },
  { key: 'pokeWink', path: ['touch', 'poke', 'expressions', 'wink'] },
  { key: 'pokeSurprised', path: ['touch', 'poke', 'expressions', 'surprised'] },
  { key: 'pokeLove', path: ['touch', 'poke', 'expressions', 'love'] },
  { key: 'pokeAngry', path: ['touch', 'poke', 'expressions', 'angry'] },
  { key: 'pokeNeutral', path: ['touch', 'poke', 'expressions', 'neutral'] },
  { key: 'pokeShy', path: ['touch', 'poke', 'expressions', 'shy'] },
  { key: 'pokeHop', path: ['touch', 'poke', 'hopChance'], scale: 100 },
  { key: 'petLove', path: ['touch', 'pet', 'expressions', 'love'] },
  { key: 'petShy', path: ['touch', 'pet', 'expressions', 'shy'] },
  { key: 'petNeutral', path: ['touch', 'pet', 'expressions', 'neutral'] },
  { key: 'petSurprised', path: ['touch', 'pet', 'expressions', 'surprised'] },
  { key: 'petAngry', path: ['touch', 'pet', 'expressions', 'angry'] },
];

const FIELD_BY_KEY = new Map(FLAT_FIELDS.map((field) => [field.key, field]));
export const CUSTOM_KEYS = [...FLAT_FIELDS.map((field) => field.key), 'hearts'];

const number = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getPath(object, path) {
  let at = object;
  for (const key of path) at = at?.[key];
  return at;
}

function setPath(object, path, value) {
  let at = object;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!at[key] || typeof at[key] !== 'object') at[key] = {};
    at = at[key];
  }
  at[path[path.length - 1]] = value;
}

/** A preset by name (unknown names fall back to expressive). */
export function preset(name) {
  const clean = PRESET_NAMES.includes(name) && name !== 'custom' ? name : 'expressive';
  return clone(PRESETS[clean]);
}

/** The policy a config section asks for. Always a complete, defensive copy. */
export function policyFromConfig(cfg = {}) {
  const presetName = PRESET_NAMES.includes(cfg.preset) ? cfg.preset : 'expressive';
  if (presetName !== 'custom') return preset(presetName);
  return policyFromFlat(cfg);
}

/** Build a custom policy from flat config fields (missing/NaN values keep the stock defaults). */
export function policyFromFlat(flat = {}) {
  const policy = clone(PRESETS.expressive);
  policy.preset = 'custom';
  for (const field of FLAT_FIELDS) {
    const raw = number(flat[field.key], CUSTOM_DEFAULTS[field.key]);
    setPath(policy, field.path, raw / (field.scale ?? 1));
  }
  policy.hearts = flat.hearts !== false;
  return policy;
}

/** The flat config fields for a policy, for persisting an AI override or showing the editor. */
export function flatFromPolicy(policy) {
  const flat = {};
  for (const field of FLAT_FIELDS) {
    // A preset that leaves a face out means "disabled": the flat value is 0, not the stock 100.
    // Chances keep their stock fallback so an old/partial policy still has a sane chance.
    const fallback = field.scale ? CUSTOM_DEFAULTS[field.key] / field.scale : 0;
    const value = number(getPath(policy, field.path), fallback);
    flat[field.key] = Math.round(value * (field.scale ?? 1) * 100) / 100;
  }
  flat.hearts = policy.hearts !== false;
  return flat;
}

/**
 * Validate the AI's `overrides` object. Returns the clean values plus the keys it had to
 * reject, so the tool can tell the model exactly what was wrong instead of silently clamping.
 */
export function normaliseOverrides(input) {
  const clean = {};
  const bad = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { overrides: clean, bad: ['overrides must be an object'] };
  }
  for (const [key, value] of Object.entries(input)) {
    if (key === 'hearts') {
      if (typeof value === 'boolean') clean.hearts = value;
      else bad.push('hearts (true/false)');
      continue;
    }
    const field = FIELD_BY_KEY.get(key);
    if (!field) {
      bad.push(key);
      continue;
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      bad.push(`${key} (0–100)`);
      continue;
    }
    clean[key] = Math.round(n * 100) / 100;
  }
  return { overrides: clean, bad };
}

/**
 * A preset plus overrides, as a custom policy. `overrides` are flat config keys (see
 * `coo_control_get`); the result is complete and can be written to the body.
 */
export function policyWithOverrides(base, overrides) {
  const flat = flatFromPolicy(base);
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (key === 'hearts') {
      if (typeof value === 'boolean') flat.hearts = value;
    } else if (FIELD_BY_KEY.has(key) && Number.isFinite(Number(value))) {
      flat[key] = clamp(Number(value), 0, 100);
    }
  }
  return policyFromFlat(flat);
}

/** A short human-readable summary for receipts and the status tool. */
export function policySummary(policy) {
  const weight = (path) => number(getPath(policy, path), 0);
  return [
    `preset=${policy.preset ?? 'custom'}`,
    `poke love=${weight(['touch', 'poke', 'expressions', 'love'])} shy=${weight(['touch', 'poke', 'expressions', 'shy'])} hop=${weight(['touch', 'poke', 'hopChance'])}`,
    `pet love=${weight(['touch', 'pet', 'expressions', 'love'])} shy=${weight(['touch', 'pet', 'expressions', 'shy'])}`,
    `idle love=${weight(['idle', 'expressions', 'love'])} shy=${weight(['idle', 'expressions', 'shy'])}`,
    `hearts=${policy.hearts !== false}`,
  ].join('; ');
}

/** A deep, JSON-safe copy for state files and tool receipts. */
export function copyPolicy(policy) {
  return clone(policy);
}
