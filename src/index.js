/**
 * Coo Control: a Cortico World that hands the desktop pet's default behaviour back to the
 * person and (with consent) the model.
 *
 * The World itself owns no window. It patches the installed desktop-pet body/page once, then
 * writes a small JSON policy that the page polls. The model sees ordinary tools; the person
 * sees ordinary config groups. No network, no other extension files.
 */
import { fileURLToPath } from 'node:url';
import { DESCRIBE } from './describe.js';
import {
  CUSTOM_DEFAULTS,
  DEFAULTS,
  PRESET_LABELS,
  PRESET_NAMES,
  flatFromPolicy,
  normaliseOverrides,
  policyFromConfig,
  policySummary,
  policyWithOverrides,
  preset,
} from './policy.js';
import { configGroups } from './config.js';
import { apply, inspect, locateAppRoot, recordPolicy, restore, writePolicy } from './patch.js';

const ID = 'coo-control';
const ENV_PROMPT = fileURLToPath(new URL('./ENV_PROMPT.md', import.meta.url));

/** The app sets these for the Core child; absent in tests, dry mounts and a plain Cortico. */
const IN_COOPANION = !!process.env.COOPANION_VERSION && process.env.CORTICO_SUPERVISED === '1';

const presetText = (language, name) => PRESET_LABELS[language === 'en' ? 'en' : 'zh'][name] ?? name;

const text = {
  zh: {
    label: '控制权回交',
    lamp: '行为补丁',
    patched: '已生效',
    waiting: '待应用',
    unsupported: '代码不匹配',
    preset: '预设',
    model: 'AI 修改',
    on: '允许',
    off: '不允许',
    notRunning: '控制权回交：当前不在 Coopanion 里运行，未修改任何文件。',
    disabled: '控制权回交：模型修改已被用户关闭，只有用户能在设置页调整。',
    noChange: '控制权回交：没有给出 preset / overrides / hearts，什么都没改。',
    badPreset: (value) => `控制权回交：preset 应为 ${PRESET_NAMES.join('、')} 之一，收到 ${value}。`,
    badOverrides: (keys) => `控制权回交：这些键无效或超出 0–100：${keys.join('、')}。`,
    badHearts: '控制权回交：hearts 应为 true 或 false。',
    saved: (label, policy, state) => `控制权回交：已切到「${label}」。${policySummary(policy)}。${state}`,
    reset: (state) => `控制权回交：已恢复「活泼（原默认）」并清空自定义权重。${state}`,
    applied: (result) => result.ok
      ? `控制权回交：补丁已应用${result.changed ? '' : '（原本就是）'}；Coopanion ${result.appVersion ?? '?'} / 桌宠 ${result.hostVersion ?? '?'}。如果桌宠窗口已在运行，重启 Coopanion 后页面才会用上新 body。`
      : `控制权回交：补丁未完成：${result.error ?? 'unknown error'}`,
    restored: (result) => result.ok
      ? `控制权回交：已还原 ${result.restored.length ? result.restored.join('、') : '（本来就是原版）'}；重启 Coopanion。请同时停用「控制权回交」，否则下次启动会重新打补丁。`
      : `控制权回交：还原未完成：${result.error ?? 'unknown error'}`,
    statePatched: '补丁已生效，页面会在约 2 秒内读新策略。',
    stateWaiting: '补丁尚未应用；调用 coo_control_apply，或重启 Coopanion，或检查扩展是否启用。',
    stateUnsupported: '当前 Coopanion 的 body.js / pet-app.js 与这个版本不匹配；请更新控制权回交。',
  },
  en: {
    label: 'Coo Control',
    lamp: 'Behaviour patch',
    patched: 'in effect',
    waiting: 'waiting',
    unsupported: 'code mismatch',
    preset: 'Preset',
    model: 'AI edits',
    on: 'allowed',
    off: 'not allowed',
    notRunning: 'Coo Control: not running inside Coopanion; nothing was changed.',
    disabled: 'Coo Control: the person turned model edits off; only the settings page can change the policy.',
    noChange: 'Coo Control: no preset / overrides / hearts were given; nothing changed.',
    badPreset: (value) => `Coo Control: preset must be one of ${PRESET_NAMES.join(', ')}; got ${value}.`,
    badOverrides: (keys) => `Coo Control: these keys are unknown or outside 0–100: ${keys.join(', ')}.`,
    badHearts: 'Coo Control: hearts must be true or false.',
    saved: (label, policy, state) => `Coo Control: switched to "${label}". ${policySummary(policy)}. ${state}`,
    reset: (state) => `Coo Control: restored the expressive stock preset and cleared the custom weights. ${state}`,
    applied: (result) => result.ok
      ? `Coo Control: patch applied${result.changed ? '' : ' (already applied)'}; Coopanion ${result.appVersion ?? '?'} / desktop-pet ${result.hostVersion ?? '?'}. If the pet window is already running, restart Coopanion so it loads the new body.`
      : `Coo Control: patch incomplete: ${result.error ?? 'unknown error'}`,
    restored: (result) => result.ok
      ? `Coo Control: restored ${result.restored.length ? result.restored.join(', ') : '(already original)'}; restart Coopanion. Disable Coo Control too, or the next start will patch it again.`
      : `Coo Control: restore incomplete: ${result.error ?? 'unknown error'}`,
    statePatched: 'The patch is in effect; the page picks up a new policy in about 2 seconds.',
    stateWaiting: 'The patch is not applied; call coo_control_apply, restart Coopanion, or check that the extension is enabled.',
    stateUnsupported: 'This Coopanion body.js / pet-app.js does not match this plugin version; update Coo Control.',
  },
};

const lang = (language) => (language === 'en' ? 'en' : 'zh');

class CooControlWorld {
  constructor(ctx) {
    this.id = ID;
    this.ctx = ctx;
    this.log = null;
    this.timer = null;
    this.lastPolicy = null;
    this.lastError = null;
    this.initial = null;
    this.suspended = false;
  }

  envPromptVars() {
    const state = this.inspectSafe();
    return {
      'cooControl.preset': presetText('zh', this.ctx.cfg.preset ?? 'expressive'),
      'cooControl.model': this.ctx.cfg.modelCanEdit === false ? '不允许' : '允许',
      'cooControl.state': state.patched ? '已生效' : state.supported ? '待应用' : '代码不匹配',
    };
  }

  tools() {
    const handlers = {
      coo_control_status: () => this.status(),
      coo_control_get: () => this.get(),
      coo_control_set: (args) => this.set(args),
      coo_control_reset: () => this.reset(),
      coo_control_apply: () => this.applyNow(),
      coo_control_restore: () => this.restoreNow(),
    };
    return DESCRIBE.tools.map((tool) => {
      const { summary, ...schema } = tool;
      return { ...schema, handler: handlers[tool.name] };
    });
  }

  webUi(language = 'zh') {
    const t = text[lang(language)];
    const state = this.inspectSafe();
    const name = this.ctx.cfg.preset ?? 'expressive';
    return {
      label: t.label,
      lamps: [{
        label: t.lamp,
        state: state.patched ? 'online' : state.supported ? 'loading' : 'error',
        hint: state.patched ? t.patched : state.supported ? state.error ?? t.waiting : state.error ?? t.unsupported,
      }],
      badges: [
        { label: t.preset, value: presetText(language, name), tone: 'plain' },
        { label: t.model, value: this.ctx.cfg.modelCanEdit === false ? t.off : t.on, tone: this.ctx.cfg.modelCanEdit === false ? 'off' : 'on' },
      ],
      config: configGroups(language),
      promptDocs: [{
        key: `worlds.${ID}.envPrompt`,
        title: `${t.label} · 环境提示词 / Environment prompt`,
        description: '桌宠默认行为策略的常驻说明与当前预设；模型据此决定是否调用 coo_control_set。',
        path: ENV_PROMPT,
        role: 'envPrompt',
        vars: [
          { name: 'cooControl.preset', description: '当前行为预设的用户可读名称。' },
          { name: 'cooControl.model', description: '模型此刻是否被允许修改策略（允许/不允许）。' },
          { name: 'cooControl.state', description: '补丁是否已生效（已生效/待应用/代码不匹配）。' },
        ],
      }],
    };
  }

  async start(host) {
    this.log = host.log;
    if (!this.ctx.cfg.enabled) return;
    if (this.ctx.cfg.autoApply && IN_COOPANION) {
      const result = apply({ dataDir: this.ctx.dataDir, policy: policyFromConfig(this.ctx.cfg) });
      this.initial = result;
      this.lastError = result.error ?? null;
      if (!result.ok) this.log?.warn(`控制权回交：补丁未完成：${result.error ?? 'unknown error'}`);
      else if (result.changed) this.log?.info('控制权回交：补丁已写入；如果桌宠窗口已在运行，重启 Coopanion 后页面才会用上新 body');
      else this.log?.info(`控制权回交：补丁已生效（${result.appVersion ?? '?'} / ${result.hostVersion ?? '?'}）`);
    } else if (!this.ctx.cfg.autoApply) {
      this.log?.info('控制权回交：autoApply 已关闭，等 coo_control_apply 或手动应用');
    }
    this.syncPolicy(true);
    this.timer = setInterval(() => this.syncPolicy(false), 1000);
    this.timer.unref?.();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  inspectSafe() {
    try {
      const result = inspect({ dataDir: this.ctx.dataDir });
      return result.ok ? result : { ok: false, patched: false, supported: false, error: result.error };
    } catch (error) {
      return { ok: false, patched: false, supported: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  stateLine() {
    const state = this.inspectSafe();
    const t = text.zh;
    if (state.patched) return t.statePatched;
    if (state.supported) return t.stateWaiting;
    return t.stateUnsupported;
  }

  syncPolicy(force = false) {
    if (this.suspended) return;
    const policy = policyFromConfig(this.ctx.cfg);
    const json = JSON.stringify(policy);
    if (!force && json === this.lastPolicy) return;
    const located = locateAppRoot({});
    if (located.error) {
      this.lastError = located.error;
      if (force) this.log?.warn(`控制权回交：${located.error}`);
      this.lastPolicy = json;
      return;
    }
    const result = writePolicy({ appRoot: located.root, dataDir: this.ctx.dataDir, policy });
    this.lastError = result.error ?? null;
    if (!result.ok) {
      this.log?.warn(`控制权回交：策略文件未写入：${result.error}`);
      this.lastPolicy = json;
      return;
    }
    const recorded = recordPolicy({ appRoot: located.root, dataDir: this.ctx.dataDir, policy, policyHash: result.hash });
    if (!recorded.ok) {
      this.lastError = recorded.error ?? 'state not written';
      this.log?.warn(`控制权回交：状态文件未写入：${this.lastError}`);
    }
    this.lastPolicy = json;
  }

  applyNow() {
    if (!IN_COOPANION) return text.zh.notRunning;
    this.suspended = false;
    const result = apply({ dataDir: this.ctx.dataDir, policy: policyFromConfig(this.ctx.cfg) });
    this.initial = result;
    this.lastError = result.error ?? null;
    if (result.ok) this.syncPolicy(true);
    return text.zh.applied(result);
  }

  restoreNow() {
    if (!IN_COOPANION) return text.zh.notRunning;
    const result = restore({ dataDir: this.ctx.dataDir });
    this.suspended = true;
    this.lastPolicy = null;
    return text.zh.restored(result);
  }

  status() {
    if (!IN_COOPANION) return text.zh.notRunning;
    const state = this.inspectSafe();
    if (!state.ok) return `控制权回交：无法检查安装目录：${state.error}`;
    const t = text.zh;
    const lines = [
      `控制权回交：${state.patched ? t.patched : state.supported ? t.waiting : t.unsupported}`,
      `Coopanion ${state.appVersion ?? '?'} / desktop-pet ${state.hostVersion ?? '?'}`,
      `app: ${state.appRoot}`,
      `preset: ${presetText('zh', this.ctx.cfg.preset ?? 'expressive')}; model edits: ${this.ctx.cfg.modelCanEdit === false ? t.off : t.on}`,
      `body.js: ${state.body.state}${state.body.reason ? ` (${state.body.reason})` : ''}`,
      `pet-app.js: ${state.page.state}${state.page.reason ? ` (${state.page.reason})` : ''}`,
      `policy: ${state.paths.policy}`,
      `state: ${state.statePath}`,
      `policy summary: ${policySummary(policyFromConfig(this.ctx.cfg))}`,
    ];
    if (this.lastError || state.error) lines.push(`last error: ${this.lastError ?? state.error}`);
    if (state.patched) lines.push('If the pet window was already running when the patch was written, restart Coopanion.');
    return lines.join('\n');
  }

  get() {
    return JSON.stringify({
      preset: this.ctx.cfg.preset ?? 'expressive',
      modelCanEdit: this.ctx.cfg.modelCanEdit !== false,
      policy: policyFromConfig(this.ctx.cfg),
    }, null, 2);
  }

  set(args = {}) {
    if (this.ctx.cfg.modelCanEdit === false) return text.zh.disabled;
    const input = args && typeof args === 'object' ? args : {};
    const presetArg = input.preset;
    const hasPreset = presetArg !== undefined;
    const hasOverrides = input.overrides !== undefined;
    const hasHearts = input.hearts !== undefined;
    if (!hasPreset && !hasOverrides && !hasHearts) return text.zh.noChange;
    if (hasPreset && !PRESET_NAMES.includes(presetArg)) return text.zh.badPreset(presetArg);
    if (hasHearts && typeof input.hearts !== 'boolean') return text.zh.badHearts;

    let cleanOverrides = {};
    if (hasOverrides) {
      const checked = normaliseOverrides(input.overrides);
      if (checked.bad.length) return text.zh.badOverrides(checked.bad);
      cleanOverrides = checked.overrides;
    }
    if (hasHearts) cleanOverrides.hearts = input.hearts;

    const baseName = hasPreset ? presetArg : this.ctx.cfg.preset ?? 'expressive';
    const base = baseName === 'custom' ? policyFromConfig(this.ctx.cfg) : preset(baseName);
    let nextPolicy;
    let patch;
    if (hasOverrides || hasHearts) {
      nextPolicy = policyWithOverrides(base, cleanOverrides);
      patch = { preset: 'custom', ...flatFromPolicy(nextPolicy) };
    } else {
      nextPolicy = baseName === 'custom' ? policyFromConfig(this.ctx.cfg) : preset(baseName);
      patch = { preset: baseName };
    }
    try {
      this.ctx.persist(patch);
    } catch (error) {
      return `控制权回交：保存失败：${error instanceof Error ? error.message : String(error)}`;
    }
    this.suspended = false;
    this.syncPolicy(true);
    const shown = nextPolicy.preset === 'custom' ? '自定义' : presetText('zh', nextPolicy.preset);
    return text.zh.saved(shown, nextPolicy, this.stateLine());
  }

  reset() {
    if (this.ctx.cfg.modelCanEdit === false) return text.zh.disabled;
    try {
      this.ctx.persist({ preset: 'expressive', ...CUSTOM_DEFAULTS });
    } catch (error) {
      return `控制权回交：保存失败：${error instanceof Error ? error.message : String(error)}`;
    }
    this.suspended = false;
    this.syncPolicy(true);
    return text.zh.reset(this.stateLine());
  }
}

/** @type {import('cortico/world.ts').WorldDefinition<any>} */
const definition = {
  id: ID,
  label: 'Coo Control',
  defaults: () => ({ ...DEFAULTS }),
  describe: DESCRIBE,
  preflight(ctx) {
    if (!IN_COOPANION) return;
    if (process.platform !== 'win32') throw new Error('Coo Control is Windows only for now.');
    const found = locateAppRoot({});
    if (found.error) throw new Error(found.error);
  },
  create(ctx) {
    const world = new CooControlWorld(ctx);
    // create() runs for every World before any World starts, so this is before the pet host
    // spawns and before its page loads. start() verifies and is a second chance at runtime.
    if (ctx.cfg.enabled && ctx.cfg.autoApply && IN_COOPANION) {
      try {
        world.initial = apply({ dataDir: ctx.dataDir, policy: policyFromConfig(ctx.cfg) });
      } catch (error) {
        world.initial = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    return world;
  },
};

export default definition;
