/**
 * The settings page: config groups for the preset and the custom weights. Labels are in the
 * console's language; the keys are full `worlds.coo-control.*` paths, as ConfigGroup requires.
 */
import { ID, PRESET_NAMES, PRESET_LABELS, PRESET_DESCRIPTIONS } from './policy.js';

const zh = {
  label: '控制权回交',
  behavior: '策略',
  behaviorDesc: '决定点击、摸头与待机时身体如何反应。预设只改策略，不改形象或声音。',
  preset: '行为预设',
  presetDesc: '先选一个接近人设的预设；要逐项微调时选「自定义」。',
  model: '允许 AI 修改',
  modelDesc: '关闭后，模型只能读策略，不能改；设置页仍可改。',
  autoApply: '启动时自动打补丁',
  autoApplyDesc: '关闭后需调用 coo_control_apply 或重启后手动应用。',
  idle: '待机',
  idleDesc: '没有外部指令时，身体自己做什么。',
  idleWeights: '动作权重',
  idleWeightsDesc: '相对权重，0 表示不做；总和不必是 100。',
  walk: '走动',
  run: '跑动',
  look: '张望',
  jump: '跳',
  sit: '坐下',
  expr: '做表情',
  wait: '站着',
  idleFaces: '待机表情权重',
  idleFacesDesc: '抽到「做表情」时用哪张脸；0 表示不出现。',
  happy: '开心',
  wink: '眨眼',
  love: '喜欢（会冒爱心）',
  sleepy: '犯困',
  surprised: '惊讶',
  shy: '害羞',
  neutral: '平静',
  angry: '生气',
  sitSleep: '坐下后睡着的概率',
  poke: '点击',
  pokeDesc: '单击（短按）时的当场反射。',
  pokeFaces: '点击表情权重',
  pokeFacesDesc: '抽到哪张脸；0 表示不出现。',
  pokeHop: '点击后跳一下的概率',
  pet: '摸头',
  petDesc: '在身体上来回摸时的当场反射。',
  petFaces: '摸头表情权重',
  petFacesDesc: '抽到哪张脸；0 表示不出现。',
  effects: '效果',
  effectsDesc: '表情之外的附加效果。',
  hearts: '允许爱心粒子',
  heartsDesc: '关闭后，即使策略选中「喜欢」也不冒爱心；「喜欢」的脸仍在。',
  customOnly: '仅「自定义」预设生效。',
  percent: '%',
};

const en = {
  label: 'Coo Control',
  behavior: 'Policy',
  behaviorDesc: 'How the body reacts to clicks, petting and idle time. Presets change only the policy, not the look or sounds.',
  preset: 'Behaviour preset',
  presetDesc: 'Pick the closest persona preset; choose Custom to tune each weight.',
  model: 'Allow the AI to change it',
  modelDesc: 'When off, the model can read but not change the policy; the settings page still can.',
  autoApply: 'Patch on startup',
  autoApplyDesc: 'When off, call coo_control_apply or apply it manually after a restart.',
  idle: 'Idle',
  idleDesc: 'What the body does when nothing else is asked of it.',
  idleWeights: 'Action weights',
  idleWeightsDesc: 'Relative weights; 0 disables. They need not add up to 100.',
  walk: 'Walk',
  run: 'Run',
  look: 'Look around',
  jump: 'Jump',
  sit: 'Sit',
  expr: 'Make a face',
  wait: 'Stand',
  idleFaces: 'Idle face weights',
  idleFacesDesc: 'Which face an idle "make a face" picks; 0 disables it.',
  happy: 'Happy',
  wink: 'Wink',
  love: 'Love (shows hearts)',
  sleepy: 'Sleepy',
  surprised: 'Surprised',
  shy: 'Shy',
  neutral: 'Neutral',
  angry: 'Angry',
  sitSleep: 'Chance a chosen sit ends in sleep',
  poke: 'Click',
  pokeDesc: 'The reflex played on a short click.',
  pokeFaces: 'Click face weights',
  pokeFacesDesc: 'Which face the click picks; 0 disables it.',
  pokeHop: 'Chance a click also hops',
  pet: 'Petting',
  petDesc: 'The reflex played while the body is stroked.',
  petFaces: 'Petting face weights',
  petFacesDesc: 'Which face petting picks; 0 disables it.',
  effects: 'Effects',
  effectsDesc: 'Extras beyond the face itself.',
  hearts: 'Allow heart particles',
  heartsDesc: 'When off, even a selected "love" face shows no hearts; the face itself remains.',
  customOnly: 'Only applies with the Custom preset.',
  percent: '%',
};

const TEXT = { zh, en };
const label = (language) => TEXT[language === 'en' ? 'en' : 'zh'];

const path = (key) => `worlds.${ID}.${key}`;

function number(key, title, description, extra = {}) {
  return [path(key), {
    type: 'number',
    title,
    description,
    minimum: 0,
    maximum: 100,
    'x-hot': true,
    ...extra,
  }];
}

function booleans(key, title, description, extra = {}) {
  return [path(key), {
    type: 'boolean',
    title,
    description,
    'x-hot': true,
    ...extra,
  }];
}

/** The ConfigGroups shown on this World's page. */
export function configGroups(language = 'zh') {
  const t = label(language);
  const presetOptions = PRESET_NAMES.map((name) => name);
  const presets = Object.fromEntries(PRESET_NAMES.map((name) => [name, PRESET_LABELS[language === 'en' ? 'en' : 'zh'][name]]));
  const presetDescription = [
    t.presetDesc,
    ...PRESET_NAMES.map((name) => `${presets[name]}: ${PRESET_DESCRIPTIONS[language === 'en' ? 'en' : 'zh'][name]}`),
  ].join(' ');

  return [
    {
      id: `world:${ID}.policy`,
      owner: `world:${ID}`,
      schema: {
        type: 'object',
        title: t.behavior,
        description: t.behaviorDesc,
        properties: Object.fromEntries([
          [path('preset'), {
            type: 'string',
            title: t.preset,
            description: presetDescription,
            enum: presetOptions,
            'x-hot': true,
          }],
          booleans('modelCanEdit', t.model, t.modelDesc),
          booleans('autoApply', t.autoApply, t.autoApplyDesc, { 'x-hot': false }),
        ]),
      },
    },
    {
      id: `world:${ID}.idle`,
      owner: `world:${ID}`,
      schema: {
        type: 'object',
        title: t.idle,
        description: `${t.idleDesc} ${t.customOnly}`,
        properties: Object.fromEntries([
          number('idleWalk', t.walk, t.idleWeightsDesc),
          number('idleRun', t.run, t.idleWeightsDesc),
          number('idleLook', t.look, t.idleWeightsDesc),
          number('idleJump', t.jump, t.idleWeightsDesc),
          number('idleSit', t.sit, t.idleWeightsDesc),
          number('idleExpr', t.expr, t.idleWeightsDesc),
          number('idleWait', t.wait, t.idleWeightsDesc),
          number('idleHappy', t.happy, t.idleFacesDesc),
          number('idleWink', t.wink, t.idleFacesDesc),
          number('idleLove', t.love, t.idleFacesDesc),
          number('idleSleepy', t.sleepy, t.idleFacesDesc),
          number('idleSurprised', t.surprised, t.idleFacesDesc),
          number('idleShy', t.shy, t.idleFacesDesc),
          number('idleNeutral', t.neutral, t.idleFacesDesc),
          number('idleAngry', t.angry, t.idleFacesDesc),
          number('sitSleep', t.sitSleep, t.customOnly, { 'x-suffix': t.percent }),
        ]),
      },
    },
    {
      id: `world:${ID}.poke`,
      owner: `world:${ID}`,
      schema: {
        type: 'object',
        title: t.poke,
        description: `${t.pokeDesc} ${t.customOnly}`,
        properties: Object.fromEntries([
          number('pokeHappy', t.happy, t.pokeFacesDesc),
          number('pokeWink', t.wink, t.pokeFacesDesc),
          number('pokeSurprised', t.surprised, t.pokeFacesDesc),
          number('pokeLove', t.love, t.pokeFacesDesc),
          number('pokeAngry', t.angry, t.pokeFacesDesc),
          number('pokeNeutral', t.neutral, t.pokeFacesDesc),
          number('pokeShy', t.shy, t.pokeFacesDesc),
          number('pokeHop', t.pokeHop, t.customOnly, { 'x-suffix': t.percent }),
        ]),
      },
    },
    {
      id: `world:${ID}.pet`,
      owner: `world:${ID}`,
      schema: {
        type: 'object',
        title: t.pet,
        description: `${t.petDesc} ${t.customOnly}`,
        properties: Object.fromEntries([
          number('petLove', t.love, t.petFacesDesc),
          number('petShy', t.shy, t.petFacesDesc),
          number('petNeutral', t.neutral, t.petFacesDesc),
          number('petSurprised', t.surprised, t.petFacesDesc),
          number('petAngry', t.angry, t.petFacesDesc),
        ]),
      },
    },
    {
      id: `world:${ID}.effects`,
      owner: `world:${ID}`,
      schema: {
        type: 'object',
        title: t.effects,
        description: t.effectsDesc,
        properties: Object.fromEntries([
          booleans('hearts', t.hearts, t.heartsDesc),
        ]),
      },
    },
  ];
}
