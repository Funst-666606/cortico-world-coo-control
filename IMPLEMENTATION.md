# 代码详细步骤与思路

作者：funst（QQ 2674459204）  
协议：MIT  
适用：Coopanion 0.2.11 / `cortico-world-desktop-pet` 0.2.0（并已对 main `41c4095` 做过 apply/restore 验证）  
版本：0.1.0

## 1. 问题链路

桌宠的默认行为分两层：

1. **身体层**（`web/kit/body.js`，跑在 sandbox frame 里）直接处理指针：
   - 点击：五张脸等概率 + 50% 跳；抽到 `love` 固定冒 4 颗爱心。
   - 摸头：`love / shy` 各 50%。
   - 待机：`decide()` 用写死权重和六张脸。
2. **AI 层**只在 `onEvent('touch')` 之后收到事件；`world.ts` 还会把同种触摸合并 2.5 秒。模型这时只能 `pet_act` 补演，不能撤销已经播完的反射。

所以修复点不在提示词，而在身体层：把写死的常量换成可读的策略。

## 2. 为什么是两个文件

`web/pet-app.js` 把身体加载进 `/figure-frame` 的 `sandbox="allow-scripts"` iframe。这个 iframe 是 opaque origin，身体自己 `fetch('/web/kit/coo-control.json')` 会被 CORS 拦；父页面 `pet-app.js` 与静态文件同源，能读。

因此：

- `pet-app.js` 每 1.5 s 读一次 `/web/kit/coo-control.json`（`cache: 'no-store'`，带时间戳），把 JSON 通过已有的 `body.set({ cooControl })` 送进 frame。
- `body.js` 的 `set(s)` 里加一行 `if (s.cooControl) __cooApplyPolicy(s.cooControl);`；策略在页面内热更新，不需要重载。
- 身体创建时 `next.set({ roam, ...bodyState, ...(cooPolicy ? { cooControl } : {}) })` 把已缓存的策略一起送进去，避免开头 1.5 秒用旧默认。

## 3. body.js 的补丁内容

### 3.1 注入 policy engine

在 `export function createBody(host, opts) {` 前插入 `__COO_CONTROL_POLICY` 块：

- `__COO_DEFAULT_POLICY`：原版 `expressive` 的完整策略。
- `__cooApplyPolicy(raw)`：只读已知字段，构造一份新的 `__cooPolicy`；数组/对象不直接信任。
- `__cooWeights(fallback, raw)`：**raw 存在就以 raw 为准**，缺的键视为 0；只有整个 map 缺失时才用 fallback。这样 `cold` 不会因为“缺少 love 键”又继承默认的 love。
- `__cooPickWeighted` / `__cooPickFace` / `__cooIdleActions`：按权重抽；只允许 `KIT_EXPRESSIONS` 与当前 pack 的 `expression` 词，未知词不会送到 `setExpr`。
- `__cooChance`：把 0–1 夹紧。

### 3.2 替换写死的行

| 位置 | 原代码 | 补丁后 |
|---|---|---|
| `decide()` 整个函数 | 写死 `opts2` / 六张脸 / `.6` | `__cooIdleActions(calm, lastAct)` / `__cooPickFace('idle', words)` / `__cooPolicy.idle.sitSleepChance` |
| 点击表情 | `const r = [...][Math.floor(Math.random() * 5)]; setExpr(r);` | `setExpr(__cooPickFace('poke', words));` |
| 点击跳 | `Math.random() < .5` | `Math.random() < __cooPolicy.touch.poke.hopChance` |
| 摸头 | `Math.random() < .5 ? 'love' : 'shy'` | `__cooPickFace('pet', words)` |
| 爱心 | `if (n === 'love') for (...)` | `if (n === 'love' && __cooPolicy.hearts) for (...)` |
| `set(s)` | 只处理 theme 等 | 追加 `if (s.cooControl) __cooApplyPolicy(s.cooControl);` |

`decide()` 用整块正则匹配（包含后面的 `/* particles */` 锚点）；其它是窄行匹配。任何一处不是恰好一次，`classifyBody` 返回 `unsupported`，整个 apply 在写第一个字节前拒绝。

### 3.3 保持原版默认

`__COO_DEFAULT_POLICY` 就是原版数值：点击五张脸各 1、hop .5；摸头 love/shy 各 1；待机 28/12/14/8/16/12/10、六张脸各 1、sitSleep .6；hearts true。只要策略文件缺失或读取失败，身体保持原版行为。

## 4. pet-app.js 的补丁内容

在 `let body = null, words = new Map(), T = 0;` 后插入 `__COO_CONTROL_LOADER`：

```js
let __cooPolicy = null;
async function __cooLoadPolicy() {
  try {
    const res = await fetch(new URL('./kit/coo-control.json?t=' + Date.now(), import.meta.url), { cache: 'no-store' });
    if (!res.ok) return;
    __cooPolicy = await res.json();
    body?.set({ cooControl: __cooPolicy });
  } catch {}
}
setInterval(__cooLoadPolicy, 1500);
__cooLoadPolicy();
```

并把 `next.set({ roam: prefs.roam, ...bodyState });` 换成：

```js
next.set({ roam: prefs.roam, ...bodyState, ...(__cooPolicy ? { cooControl: __cooPolicy } : {}) });
```

`import.meta.url` 让 URL 相对于 `/web/pet-app.js`，不依赖站点根路径。页面每 1.5 秒读一次；策略更新约 2 秒内到达身体。

## 5. 策略文件

`writePolicy()` 同时写两份：

- `<app>/node_modules/cortico-world-desktop-pet/web/kit/coo-control.json`：运行中的页面读的。
- `<Coopanion data>/coo-control/policy.json`：本扩展的规范副本。

内容：

```jsonc
{
  "schema": 1,
  "preset": "cold",
  "idle": { "weights": {...}, "calmWeights": {...}, "expressions": {...}, "sitSleepChance": 0.6 },
  "touch": { "poke": { "expressions": {...}, "hopChance": 0.1 }, "pet": { "expressions": {...} } },
  "hearts": false,
  "updatedAt": "..."
}
```

写 JSON 用临时文件 + rename；Windows 上 rename 可能被正在读的宿主占用，失败时退回整串直接写并清理临时文件。

## 6. 备份、状态与还原

`apply()`：

1. `inspect()` 找安装目录，读两个文件，分类为 `original / patched / unsupported / missing`。
2. 两个文件都必须是 `original` 或 `patched`，否则整体拒绝。
3. 对 `original` 文件：先把原文写入内容哈希备份，再在内存里打补丁并重新分类；只有分类为 `patched` 才写盘。
4. 两个文件都成功后写策略与 `state.json`。

`restore()`：

- 只还原当前字节的 sha256 **等于记录的 `patchedHash`** 的文件；如果应用更新或用户手改过，拒绝覆盖。
- 备份的 sha256 必须等于 `originalHash`。
- 策略文件只在 sha256 等于 `policyHash` 时删除；被手改过就留下并报告。
- 还原后 `state.json` 记录 `restoredAt`。

## 7. 更新兼容性

这是“魔改”，但把兼容性做成可操作路径：

- 补丁目标是很窄的代码块；Coopanion 一旦重写这些块，`classify` 返回 `unsupported`，**不写任何文件**。
- 状态里记录 app / host 版本和两个文件的 original/patched 哈希；升级 Coopanion 后，`create()` 在桌宠页面启动前重新 apply。新版本如果仍匹配，自动恢复；不匹配则明确报错。
- 新版本 Coopanion 需要发布新版本插件，更新 `TARGETS` / 校验标记；旧插件不会半打补丁。
- 插件本身通过 npm / 扩展市场更新；用户配置和 `data/coo-control/` 保留。

## 8. 为什么不用纯 World / Bot 扩展

- 第三方 World 只能定义自己的事件和工具，不能拿到内置 desktop-pet World 的页面或 `pointerUp`。
- 继承 Cormini 的 Bot 扩展能持有 mood/emotion，但内置 body 不读 Bot 状态；需要 World 侧先有接口。
- 直接 fork 整个 `cortico-world-desktop-pet` 可以做到，但会成为另一个 World，和应用内置的桌宠脱节，更新也更难合并。

本扩展选择“World + 安装目录窄补丁”：它是一个可安装的插件，行为策略、工具、配置、日志都在 World 里；文件补丁有备份、哈希、拒绝未知、还原和更新路径。官方如果以后在 desktop-pet World 里加 behavior 配置/工具，这个插件可以退化成纯配置迁移。

## 9. 测试

```bash
node test/policy.test.mjs   # 预设、custom、override、clamp
node test/patch.test.mjs    # fixture + 可选真实 0.2.11 文件 apply/restore/幂等
node test/engine.test.mjs   # 把注入的 engine 放进 vm，验证 cold 不会抽到 love/shy
node test/world.test.mjs    # World API / describe / config groups
```

发布前：

```powershell
$env:COOPANION_APP_ROOT='F:\coo\Coopanion\resources\app'
node test/patch.test.mjs
```

会复制真实文件到临时目录再打补丁，不会改安装目录。
