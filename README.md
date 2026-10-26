# 控制权回交 · Coo Control

A **Cortico World** for [Coopanion](https://github.com/Pal-AI-Lab/Coopanion) that gives the desktop pet's default behaviour back to the person (and, with consent, the model): what a click, a stroke and an idle moment do, with weights and presets instead of hard-coded random picks.

一个给 Coopanion 用的 **Cortico World**：把桌宠的点击、摸头、待机默认行为交还给用户与 AI——用预设和概率权重，而不是写死的随机数。

> **Status:** experimental, Windows, and it **modifies the installed Coopanion desktop-pet files** (`body.js`, `pet-app.js`) with backups, restore and a safe update path. It is not an official Pal AI Lab extension.
>
> 状态：实验性、仅 Windows，并且会**修改已安装的 Coopanion 桌宠文件**（`body.js`、`pet-app.js`），带备份、还原和更新兼容路径。这不是 Pal AI Lab 官方扩展。

**作者 / Author:** funst（QQ **2674459204**） · **License:** MIT · **源码 / Source:** [Funst-666606/cortico-world-coo-control](https://github.com/Funst-666606/cortico-world-coo-control) · **npm:** `cortico-world-coo-control`

**标签 / Tags:** `experimental`、`apps`、`companion`

**激活必须重启两次 / Two restarts:** 安装后重启 Coopanion（加载新 World）；在 Worlds 启用「控制权回交」后**再重启一次**（在桌宠页面启动前打补丁）。只做一步不会生效。详见 [IMPLEMENTATION.md](IMPLEMENTATION.md)。

## The problem

在未打补丁的 Coopanion 0.2.11 / `cortico-world-desktop-pet` 0.2.0 里：

- 单击：`happy / wink / surprised / love / angry` 五选一，50% 再跳一下；抽到 `love` 固定冒 4 颗爱心。
- 摸头：`love / shy` 各 50%。
- 待机：每 2–4 秒按写死的权重选走动/跑/张望/跳/坐下/做表情/站着；表情池固定六张脸，包含 `love / shy`。

这些都不读人设、不读用户设置；AI 只能在 `[touch]` 事件到达后补演，不能预选或取消。一个高冷人设点一下仍可能冒爱心。

完整诊断见 Coopanion issue **[#440](https://github.com/Pal-AI-Lab/Coopanion/issues/440)**。

## What this World does

它给内置桌宠 World 打一个窄补丁，并写一份热更新的策略文件：

| File | Before | After |
|---|---|---|
| `web/kit/body.js` | `decide()`、点击/摸头、`love` 爱心、`set()` 写死 | 从 `__cooPolicy` 取权重；`love` 只有策略选中且允许爱心时才冒 |
| `web/pet-app.js` | 只把页面状态 `set` 给身体 | 每 1.5 s 读 `/web/kit/coo-control.json`，用 `body.set({ cooControl })` 送进身体 |
| `web/kit/coo-control.json` | 不存在 | 本扩展生成的策略；还原时删除 |

页面里的身体跑在 sandbox frame 中（opaque origin），自己 fetch 会被 CORS 拦；所以由同源的父页面 `pet-app.js` 读取，再 postMessage 给身体。策略更新约 1.5–2 秒生效，**不用重启**。

打补丁前按内容哈希备份，写后重新分类校验；不认识的代码**拒绝而不是猜**。备份和状态在：

```
<Coopanion data>/coo-control/
  state.json
  policy.json
  backups/<sha256>/body.js
  backups/<sha256>/pet-app.js
```

## Presets

| Preset | 点击 | 摸头 | 待机 | 爱心 |
|---|---|---|---|---|
| `expressive`（默认） | 原版五选一 + 50% 跳 | love / shy 各 50% | 原版权重，六张脸 | 允许 |
| `reserved` | happy / wink / surprised / angry，25% 跳 | 只 shy | 更少跑跳，更多张望/坐着 | 禁止 |
| `cold` | 平静 / 惊讶 / 生气，10% 跳 | 平静 / 惊讶 | 很少表演，更多张望/坐着 | 禁止 |
| `custom` | 用设置页的自定义权重 | 同左 | 同左 | 可单独开关 |

`expressive` 与未安装本扩展时完全一致，方便随时退回。

## Configuration

设置页「Worlds → 控制权回交」有五组：

1. **策略**：`preset`（expressive / reserved / cold / custom）、`modelCanEdit`（AI 是否可改）、`autoApply`（启动时自动打补丁）。
2. **待机**：7 个动作权重；6 + 2 张脸权重；坐下后睡着概率。
3. **点击**：5 + 2 张脸权重；跳一下概率。
4. **摸头**：5 张脸权重。
5. **效果**：是否允许爱心粒子。

每个数字 0–100：相对权重，0 表示禁用；概率项按百分比。自定义权重**只在 preset=custom 时生效**（选中预设时用预设自带的表）。设置保存后约 2 秒写入运行中的桌宠，无需重启。

## Tools

| Tool | What it does |
|---|---|
| `coo_control_status` | 只读：补丁是否生效、Coopanion/桌宠版本、两个文件状态、备份/状态路径、当前预设、上次错误。 |
| `coo_control_get` | 只读：当前策略 JSON 与可用的 `overrides` 键。 |
| `coo_control_set` | 改预设，或按 0–100 覆盖权重；约 2 秒生效。仅在 `modelCanEdit` 开着时可用；涉及亲密表达时模型应先 `pet_ask`。 |
| `coo_control_reset` | 恢复 `expressive` 并清空自定义权重。 |
| `coo_control_apply` | Coopanion 更新后重打补丁；幂等，先备份，不认识的代码拒绝。 |
| `coo_control_restore` | 用备份还原两个文件并删掉策略；当前文件对不上时拒绝；之后重启。 |

## Install

### From npm / the extension market

Search for **控制权回交 / Coo Control** (package `cortico-world-coo-control`) in Coopanion's extension page, or:

```bash
pnpm add cortico-world-coo-control
```

Then:

1. Restart Coopanion so the new World is loaded.
2. Open **Worlds** and enable **控制权回交 / Coo Control**.
3. Restart Coopanion once more. The patch is applied before the pet page starts.
4. Set a preset or weights; the running pet follows within about two seconds.

If the app is installed under `Program Files`, writing the patched files may fail; a per-user install or the portable build is easier.

### Local development install

```powershell
cd F:\coo\Coopanion\data\extensions
pnpm add file:C:\path\to\cortico-world-coo-control
```

## After a Coopanion update

The updater replaces `resources/app`, so the patch is gone. On the next start, with the World still enabled, `create()` sees the original files and re-applies the patch before the pet page loads. The policy in your config is kept.

If the new Coopanion rewrites the targeted blocks, this plugin **refuses to guess**: `coo_control_status` says `unsupported`, and the files stay original. Update this plugin to a version that supports the new lines. That is the intended version-compatibility path: **app updates, plugin updates, patch re-applies**. State and backups are content-addressed, so an old original never silently replaces a new one.

## Restore and uninstall

Ask Coo to call `coo_control_restore` (or use the World page), then restart Coopanion. Disable the World and remove the package if you no longer want it. Removing the extension does **not** automatically restore the files; restore first.

If another mod also patches `body.js` / `pet-app.js` (for example **Mouse Polling Fix**), both can coexist because they touch different blocks, but each stores an exact patched hash. Restore the mod that was applied **last** first; otherwise the hash guard refuses. Do not force it.

## Risks

- **It edits the installed application.** Only the two files and one generated JSON above, with backups, but an app update or a virus scanner may notice.
- **It is version-sensitive.** It targets Coopanion 0.2.11 / `cortico-world-desktop-pet` 0.2.0 and also matches the current `main` (`41c4095`). Unknown code is refused; update the plugin after an app change.
- **Windows only for now.** `package.json` declares `"os": ["win32"]`. The body code is cross-platform, but the app bundle on macOS is signed/read-only.
- **Not official.** This is a community mod, not a Pal AI Lab extension. Do not report its bugs as Coopanion bugs; use this package's issue tracker.
- **No telemetry/network.** The World reads/writes only the app files, its own state, and the policy file.
- **Figure packs with their own expression words**: presets use the kit's stock faces. A pack's custom words can appear in a hand-written policy, but the settings fields only cover the stock kit faces; `coo_control_get`/`coo_control_set` cover the listed keys.

## Why a mod, not a pure World or Bot extension

按 Cortico 的边界：

- 外部 IO 的扩展 → 做 `cortico-world-*`（World）。
- 内部状态（情绪/记忆）→ 继承 Cormini，做 `cortico-bot-*`（Bot/Persona）扩展。

但这个 issue 动的是**内置 desktop-pet World 的渲染层**：`web/kit/body.js` 的 `pointerUp` / `decide()`。第三方 World 只能定义自己的事件和工具，拦不到内置 World 的页面；Bot 扩展能持有 mood/emotion，却没有接口把策略写进内置 body。要改只能 fork 整个 World，或者像本扩展这样在安装目录上做**可备份、可还原、可更新**的窄补丁。

这也是为什么它不是纯扩展：官方要彻底解决，需要在 desktop-pet World 里加 behavior 配置/工具，或在 Cortico 层加 Bot/Persona → World 的行为策略契约。本扩展是在那之前的可用方案，并把版本兼容做成“拒绝未知 + 更新插件”的路径。

## Development

```bash
node test/policy.test.mjs
node test/patch.test.mjs
node test/engine.test.mjs
node test/world.test.mjs
node scripts/write-describe.mjs
```

`patch.test.mjs` 默认用内置 fixture；把 `COOPANION_APP_ROOT` 指向真实的 `resources/app`，它会复制真实文件再 apply/restore，用来在新 Coopanion 版本上做发布前验证。

### Release

```bash
node scripts/publish.mjs --dry-run
node scripts/publish.mjs --otp 123456
# or, from the terminal where npm can prompt:
npm run release
```

The release script refuses an already-published version, regenerates `describe.json`, runs the tests, prompts for the npm OTP (or takes `--otp` / `NPM_OTP`), publishes with `--access public`, and prints the npm page plus a ready-made market-sync issue URL.

## License

MIT. Copyright (c) 2026 funst（QQ 2674459204）. See [LICENSE](LICENSE).
