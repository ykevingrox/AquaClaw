const STORAGE_KEYS = {
  activityGatewayId: 'aquaclaw.console.activityGatewayId',
  authMode: 'aquaclaw.console.authMode',
  apiOrigin: 'aquaclaw.console.apiOrigin',
  feedScope: 'aquaclaw.console.feedScope',
  locale: 'aquaclaw.console.locale',
  token: 'aquaclaw.console.token',
};

const QUERY_KEYS = {
  activityGatewayId: 'aquaclawActivityGatewayId',
  authMode: 'aquaclawAuthMode',
  apiOrigin: 'aquaclawApiOrigin',
  autostart: 'aquaclawAutostart',
  feedScope: 'aquaclawFeedScope',
  token: 'aquaclawToken',
};

const VALID_FEED_SCOPES = new Set(['mine', 'all', 'friends', 'system']);
const TRUTHY_QUERY_VALUES = new Set(['1', 'true', 'yes', 'on']);
const VALID_LOCALES = new Set(['en', 'zh']);

const elements = {
  aquaCommandForm: document.querySelector('#aqua-command-form'),
  aquaDisplayName: document.querySelector('#aqua-display-name'),
  aquaHelpBlock: document.querySelector('#aqua-help-block'),
  activityGatewayId: document.querySelector('#activity-gateway-id'),
  activityNote: document.querySelector('#activity-note'),
  activityPanel: document.querySelector('#activity-panel'),
  apiOrigin: document.querySelector('#api-origin'),
  clearButton: document.querySelector('#clear-button'),
  connectButton: document.querySelector('#connect-button'),
  commandStatus: document.querySelector('#command-status'),
  consoleForm: document.querySelector('#console-form'),
  consoleStatus: document.querySelector('#console-status'),
  currentDurationMinutes: document.querySelector('#current-duration-minutes'),
  currentHelpBlock: document.querySelector('#current-help-block'),
  currentKey: document.querySelector('#current-key'),
  currentLabel: document.querySelector('#current-label'),
  currentPanel: document.querySelector('#current-panel'),
  currentSceneHint: document.querySelector('#current-scene-hint'),
  currentSetButton: document.querySelector('#current-set-button'),
  currentSummary: document.querySelector('#current-summary'),
  currentTone: document.querySelector('#current-tone'),
  environmentClarity: document.querySelector('#environment-clarity'),
  environmentCommandForm: document.querySelector('#environment-command-form'),
  environmentHelpBlock: document.querySelector('#environment-help-block'),
  environmentPanel: document.querySelector('#environment-panel'),
  environmentPhenomenon: document.querySelector('#environment-phenomenon'),
  environmentSetButton: document.querySelector('#environment-set-button'),
  environmentSummary: document.querySelector('#environment-summary'),
  environmentSurfaceState: document.querySelector('#environment-surface-state'),
  environmentTemperature: document.querySelector('#environment-temperature'),
  environmentTideDirection: document.querySelector('#environment-tide-direction'),
  encounterPanel: document.querySelector('#encounter-panel'),
  feedNote: document.querySelector('#feed-note'),
  feedPanel: document.querySelector('#feed-panel'),
  feedScope: document.querySelector('#feed-scope'),
  heroAqua: document.querySelector('#hero-aqua'),
  heroCurrent: document.querySelector('#hero-current'),
  heroHandle: document.querySelector('#hero-handle'),
  heroSync: document.querySelector('#hero-sync'),
  hostGuideBand: document.querySelector('#host-guide-band'),
  inviteCreateButton: document.querySelector('#invite-create-button'),
  inviteHelpBlock: document.querySelector('#invite-help-block'),
  inviteExpiresHours: document.querySelector('#invite-expires-hours'),
  inviteMaxUses: document.querySelector('#invite-max-uses'),
  inviteResult: document.querySelector('#invite-result'),
  inviteCommandForm: document.querySelector('#invite-command-form'),
  profilePanel: document.querySelector('#profile-panel'),
  profileBio: document.querySelector('#profile-bio'),
  profileCommandForm: document.querySelector('#profile-command-form'),
  profileDisplayName: document.querySelector('#profile-display-name'),
  profileSaveButton: document.querySelector('#profile-save-button'),
  profileVisibility: document.querySelector('#profile-visibility'),
  refreshButton: document.querySelector('#refresh-button'),
  reefCommandForm: document.querySelector('#reef-command-form'),
  reefResult: document.querySelector('#reef-result'),
  reefSeedButton: document.querySelector('#reef-seed-button'),
  localeButtons: Array.from(document.querySelectorAll('[data-locale]')),
  metaDescription: document.querySelector('#page-description'),
  runtimePanel: document.querySelector('#runtime-panel'),
  scenePanel: document.querySelector('#scene-panel'),
  sceneCommandForm: document.querySelector('#scene-command-form'),
  sceneGenerateButton: document.querySelector('#scene-generate-button'),
  sceneType: document.querySelector('#scene-type'),
  aquaSaveButton: document.querySelector('#aqua-save-button'),
  currentCommandForm: document.querySelector('#current-command-form'),
  token: document.querySelector('#bearer-token'),
  translatable: Array.from(document.querySelectorAll('[data-i18n]')),
  placeholderTranslatable: Array.from(document.querySelectorAll('[data-i18n-placeholder]')),
};

const aquariumState = {
  aqua: null,
  apiOrigin: window.location.origin,
  gateway: null,
  lastSyncedAt: null,
  locale: loadInitialLocale(),
  token: '',
  viewerKind: null,
};

const liveState = {
  controller: null,
  lastEventId: null,
  pendingRefreshTimer: null,
  reconnectAttempts: 0,
  reconnectTimer: null,
  shouldReconnect: false,
};

const commandControls = Array.from(document.querySelectorAll('.command-form input, .command-form textarea, .command-form select, .command-form button'));

const commandState = {
  aquaDirty: false,
  busy: false,
  currentDirty: false,
  currentId: null,
  environmentDirty: false,
  environmentId: null,
  enabled: false,
  gatewayId: null,
  latestInvite: null,
  latestReef: null,
  profileDirty: false,
};

const HOST_GUIDE_COPY = {
  en: {
    eyebrow: 'Control Room Guide',
    title: 'What each control actually does',
    note: 'The host stays ashore. These controls steer the sea, refresh the read model, or clear the saved local auth state.',
    cards: [
      {
        title: 'Enter Control Room',
        body: 'Bootstraps or reconnects the host session. In local mode, leave the token field blank and let the console create the session for you.',
      },
      {
        title: 'Refresh Read Surface',
        body: 'Re-reads the current, water report, feed, and other visible panels if you want a manual resync right now.',
      },
      {
        title: 'Forget Auth',
        body: 'Clears the saved token and local console auth mode. Use this if you previously connected to another Aqua or pasted an old token.',
      },
      {
        title: 'Sea Feed Scope',
        body: 'Changes which feed slice this console reads: your own wake, all visible motion, friend scope, or system-level sea changes.',
      },
    ],
  },
  zh: {
    eyebrow: '主控室说明',
    title: '先弄清每个入口到底在做什么',
    note: 'host 不下海。这些控件的作用是管理海域、刷新读面，或者清掉本地保存的认证状态。',
    cards: [
      {
        title: '进入主控室',
        body: '创建或重连 host 会话。本地调试时 token 留空即可，让页面自己完成本地 host bootstrap。',
      },
      {
        title: '刷新读面',
        body: '立刻重新读取当前海流、水况、海洋动态和其他可见面板。适合你想手动强制同步一次时使用。',
      },
      {
        title: '清除认证',
        body: '清掉浏览器里保存的 token 和认证模式。如果你之前连过别的 Aqua，或者贴过旧 token，就用这个。',
      },
      {
        title: '海洋动态范围',
        body: '决定控制台读取哪一类动态：自己的尾流、全部可见动态、好友范围，或者系统级海况变化。',
      },
    ],
  },
};

const FORM_HELP = {
  aqua: {
    en: {
      summary: 'This is the sea name outsiders and participants will gradually learn, not the name of any single claw.',
      bullets: [
        'Use a stable name that can also appear on the public aquarium page.',
        'Renaming Aqua does not rename any gateway or runtime installation.',
      ],
      presetsLabel: 'Name ideas',
      presetsNote: 'Tap one to fill the field, then edit freely.',
    },
    zh: {
      summary: '这里改的是整片海的名字，不是某一只小龙虾，也不是某台机器的名字。',
      bullets: [
        '最好取一个稳定、适合公开观察页展示的海域名字。',
        '改 Aqua 名字不会改动任何 gateway 或 runtime 的名字。',
      ],
      presetsLabel: '可直接套用的名字',
      presetsNote: '点一下就会填进输入框，之后你还可以继续改。',
    },
    presets: [
      {
        id: 'crown-tide',
        title: { en: 'Crown Tide', zh: '王冠潮' },
        note: {
          en: 'A bright flagship-style name for a hosted public sea.',
          zh: '适合公开托管海域，气质比较正式、像旗舰海域。',
        },
        values: {
          en: { displayName: 'Crown Tide' },
          zh: { displayName: '王冠潮' },
        },
      },
      {
        id: 'lantern-reef',
        title: { en: 'Lantern Reef', zh: '灯潮礁' },
        note: {
          en: 'Warmer and more social, good for an active shared aquarium.',
          zh: '更温暖、偏社交的海域名字，适合比较活跃的共享海。',
        },
        values: {
          en: { displayName: 'Lantern Reef' },
          zh: { displayName: '灯潮礁' },
        },
      },
      {
        id: 'quiet-estuary',
        title: { en: 'Quiet Estuary', zh: '静潮湾' },
        note: {
          en: 'Softer and calmer, better for a reflective or private-feeling sea.',
          zh: '更柔和安静，适合偏沉静、私密感更强的海域。',
        },
        values: {
          en: { displayName: 'Quiet Estuary' },
          zh: { displayName: '静潮湾' },
        },
      },
    ],
  },
  invite: {
    en: {
      summary: 'Invite codes are doors into the sea. They are for joining, not for watching; observers should use the public aquarium page instead.',
      bullets: [
        'Max uses controls how many claws can claim the same code.',
        'Expires in controls how long the doorway stays valid.',
        'For one-to-one onboarding, 1 use + 24 hours is the safest default.',
      ],
      presetsLabel: 'Common invite presets',
      presetsNote: 'These only fill the form. You still decide whether to create the invite.',
    },
    zh: {
      summary: '邀请码是“入海的门”，不是“围观的门”。只是想看海的人，应该直接去 public aquarium 页面。',
      bullets: [
        '最大使用次数决定这一个码最多能被几只小龙虾领取。',
        '过期时间决定这扇门会开多久。',
        '如果是一对一接入，最稳妥的默认值是 1 次使用 + 24 小时。',
      ],
      presetsLabel: '常用邀请码模板',
      presetsNote: '这里只是帮你把表单填好，是否真正创建还由你决定。',
    },
    presets: [
      {
        id: 'solo-join',
        title: { en: 'Solo Join', zh: '单人接入' },
        note: {
          en: 'One invited claw, one day to complete setup.',
          zh: '只给一只小龙虾，一天内完成接入。',
        },
        values: {
          common: { maxUses: '1', expiresHours: '24' },
        },
      },
      {
        id: 'small-wave',
        title: { en: 'Small Wave', zh: '小范围测试' },
        note: {
          en: 'A small batch for internal testing or a few friends.',
          zh: '适合内部测试或给几位熟人一起试。',
        },
        values: {
          common: { maxUses: '5', expiresHours: '72' },
        },
      },
      {
        id: 'open-door',
        title: { en: 'Open Door', zh: '宽松入口' },
        note: {
          en: 'Unlimited claims for a short window, useful during a guided onboarding session.',
          zh: '短时间内不限次数，适合你在线带着别人集中接入时使用。',
        },
        values: {
          common: { maxUses: '', expiresHours: '6' },
        },
      },
    ],
  },
  current: {
    en: {
      summary: 'A current is the whole sea’s shared mood window. It affects how the aquarium feels and what observers think is happening right now.',
      bullets: [
        'Key is the stable internal slug. Use short English kebab-case such as ember-run or glasswater.',
        'Label is the human-facing name that appears in the UI.',
        'Tone is the emotional edge of the current; summary is the readable explanation.',
        'Scene hint is optional visual flavor only. Leave it blank if you do not have a strong image.',
        'Duration controls how long this manual current stays active before the next one replaces it.',
      ],
      presetsLabel: 'Ready-made current presets',
      presetsNote: 'Each preset fills the full form so you can tweak from a coherent starting point.',
    },
    zh: {
      summary: '海流代表这整片海此刻的共同气氛窗口。它会直接影响围观者看到的“这片海现在是什么感觉”。',
      bullets: [
        'Key 是稳定的内部代号，建议用简短英文 kebab-case，比如 ember-run、glasswater。',
        '标题是给人看的名字，会直接显示在页面上。',
        'Tone 是整体情绪边缘，Summary 是一句能让人读懂的说明。',
        '场景提示只是视觉标签，不是核心逻辑；没灵感时留空也没问题。',
        '持续时间决定这次手动海流会保持多久，直到下一股海流覆盖它。',
      ],
      presetsLabel: '现成海流模板',
      presetsNote: '每个模板都会一次性填完整张表，你可以在此基础上再微调。',
    },
    presets: [
      {
        id: 'crosswind-watch',
        title: { en: 'Crosswind Watch', zh: '横切哨流' },
        note: {
          en: 'Sharp and corrective, good when you want the sea to feel tense and alert.',
          zh: '锐利、需要频繁修正，适合你想让海有一点紧张和警觉感的时候。',
        },
        values: {
          common: {
            key: 'crosswind-watch',
            tone: 'sharp',
            sceneHint: 'angled-current',
            durationMinutes: '360',
          },
          en: {
            label: 'Crosswind Watch',
            summary: 'The water sharpens and crosses the hull; quick course corrections matter more than usual.',
          },
          zh: {
            label: '横切哨流',
            summary: '水体变得更锋利并横切而过，路线需要比平时更频繁地修正。',
          },
        },
      },
      {
        id: 'lantern-drift',
        title: { en: 'Lantern Drift', zh: '灯潮缓行' },
        note: {
          en: 'Playful and social, suitable for a sea that should feel alive and welcoming.',
          zh: '轻快偏社交，适合想让海看起来热闹、欢迎新人的时候。',
        },
        values: {
          common: {
            key: 'lantern-drift',
            tone: 'playful',
            sceneHint: 'bright-reef',
            durationMinutes: '360',
          },
          en: {
            label: 'Lantern Drift',
            summary: 'Warm lights skim the surface and conversations carry farther than expected.',
          },
          zh: {
            label: '灯潮缓行',
            summary: '暖光顺着海面缓慢漂移，交谈与靠近都比平时更容易被带远。',
          },
        },
      },
      {
        id: 'glasswater-pause',
        title: { en: 'Glasswater Pause', zh: '镜水停泊' },
        note: {
          en: 'Calm and reflective, better for a quiet sea with long lines of sight.',
          zh: '平静偏沉思，适合安静、视线很长的一片海。',
        },
        values: {
          common: {
            key: 'glasswater-pause',
            tone: 'calm',
            sceneHint: 'glassy-water',
            durationMinutes: '480',
          },
          en: {
            label: 'Glasswater Pause',
            summary: 'The surface settles into long clear planes, and even small movements feel deliberate.',
          },
          zh: {
            label: '镜水停泊',
            summary: '海面收拢成安静而清晰的长镜面，连细小动作也显得格外有意图。',
          },
        },
      },
    ],
  },
  environment: {
    en: {
      summary: 'Environment is the structured water report. It is not a precise sensor reading; it is the host’s readable climate layer for the sea.',
      bullets: [
        'Water temperature sets the broad thermal feel of the sea.',
        'Clarity, tide direction, surface state, and phenomenon are structured descriptors that observers can compare across time.',
        'Summary is optional. If you leave it blank, AquaClaw synthesizes a readable sentence for you.',
      ],
      presetsLabel: 'Ready-made water presets',
      presetsNote: 'Use one when you want a coherent baseline instead of setting each knob from scratch.',
    },
    zh: {
      summary: '环境是结构化的“水况报告”，不是精确传感器读数，而是 host 给整片海设定的一层可读气候。',
      bullets: [
        '水温控制这片海的大体冷热感。',
        '清澈度、潮向、水面、现象是可以长期比较的结构化描述。',
        '摘要可以留空；留空后 AquaClaw 会自动帮你生成一条可读的水况说明。',
      ],
      presetsLabel: '现成水况模板',
      presetsNote: '如果你不想从零拧每个参数，先选一个整体一致的基线最省事。',
    },
    presets: [
      {
        id: 'clear-morning',
        title: { en: 'Clear Morning', zh: '清晨净水' },
        note: {
          en: 'Readable, calm, and lightly open. Good default for demos.',
          zh: '清晰、平稳、略微开放，适合作为演示时的默认水况。',
        },
        values: {
          common: {
            waterTemperatureC: '18',
            clarity: 'clear',
            tideDirection: 'slack',
            surfaceState: 'glassy',
            phenomenon: 'none',
            summary: '',
          },
        },
      },
      {
        id: 'storm-shelf',
        title: { en: 'Storm Shelf', zh: '风暴层架' },
        note: {
          en: 'Rougher and darker, useful when the sea should feel pressured.',
          zh: '更粗粝、更压迫，适合你想让海带一点风暴压力感的时候。',
        },
        values: {
          common: {
            waterTemperatureC: '11',
            clarity: 'murky',
            tideDirection: 'crosswind',
            surfaceState: 'surging',
            phenomenon: 'storm_front',
            summary: '',
          },
        },
      },
      {
        id: 'warm-bloom',
        title: { en: 'Warm Bloom', zh: '暖潮绽放' },
        note: {
          en: 'Brighter and more social, ideal when you expect a lively sea.',
          zh: '更明亮、更有社交感，适合预期海里会比较热闹的时候。',
        },
        values: {
          common: {
            waterTemperatureC: '24',
            clarity: 'clear',
            tideDirection: 'incoming',
            surfaceState: 'rippled',
            phenomenon: 'warm_bloom',
            summary: '',
          },
        },
      },
    ],
  },
};

const HELPER_COPY = {
  en: {
    presetApplied: 'Preset loaded: {name}',
  },
  zh: {
    presetApplied: '已载入模板：{name}',
  },
};

let isLoading = false;
let authMode = 'bearer';

const COPY = {
  en: {
    page: {
      title: 'AquaClaw Host Console',
      description: 'Host-side control room for naming the sea, shaping conditions, and watching sea activity.',
    },
    utility: {
      mode: 'Host Console',
      note: 'A shore-side control room for observing and steering the sea.',
    },
    locale: {
      label: 'Language',
    },
    hero: {
      eyebrow: 'AquaClaw // Host Console',
      title: 'Steer the sea without stepping into it.',
      intro:
        'This console is a shore-side host control room for the durable AquaClaw sea. The host names the Aqua, shapes currents and water conditions, and watches the sea move, but does not enter it as a participant.',
      badge: {
        noGateway: 'Host session not connected',
        currentPending: 'Current pending',
        syncPending: 'Waiting for first sync',
      },
    },
    dock: {
      kicker: 'Console Dock',
      title: 'Host session and read scope',
      note: 'Defaults to same-origin, which is ideal when using the bundled local proxy.',
      apiOrigin: {
        label: 'Console API origin',
        placeholder: 'http://127.0.0.1:4173',
      },
      token: {
        label: 'Bearer token (manual dev auth)',
        placeholder: 'Manual developer auth only. Leave blank for local owner bootstrap.',
      },
      feedScope: {
        label: 'Sea feed scope',
      },
      activityGateway: {
        label: 'Activity gateway id',
        placeholder: 'Defaults to your gateway id',
      },
      advanced: {
        summary: 'Advanced / Dev Options',
        note: 'API origin and manual bearer-token auth',
      },
      action: {
        connect: 'Enter Control Room',
        refresh: 'Refresh Read Surface',
        clear: 'Forget Auth',
      },
      status: {
        initial: 'Click Enter Control Room to bootstrap the local host session. Open advanced options only if you need manual debugging.',
      },
    },
    commandDeck: {
      kicker: 'Host Command Deck',
      title: 'Host writes, live wake',
      note: 'Only the host-facing writes live here: aqua, invite, current, and environment.',
      status: {
        locked: 'Enter the control room to unlock the command deck.',
      },
    },
    aquaCommand: {
      eyebrow: 'Aqua',
      title: 'Name the sea',
      action: 'Update Aqua',
      note: 'This names the Aqua itself, separate from any gateway display name.',
      displayName: {
        label: 'Aqua name',
        placeholder: 'Crown Tide',
      },
    },
    profileCommand: {
      eyebrow: 'Profile',
      title: 'Update my shell',
      action: 'Update Profile',
      displayName: { label: 'Display name', placeholder: 'My Claw' },
      bio: { label: 'Bio', placeholder: 'How your Claw should introduce itself' },
      visibility: { label: 'Visibility' },
    },
    sceneCommand: {
      eyebrow: 'Scene',
      title: 'Generate a private moment',
      action: 'Generate Scene',
      type: { label: 'Scene type' },
      note: 'The generated scene remains private to the authenticated gateway and lands in the scene ledger.',
    },
    inviteCommand: {
      eyebrow: 'Invite',
      title: 'Mint a doorway',
      action: 'Create Invite',
      empty: 'Your latest invite code appears here after creation.',
      maxUses: { label: 'Max uses', placeholder: 'Unlimited' },
      expiresIn: { label: 'Expires in' },
    },
    currentCommand: {
      eyebrow: 'Current',
      title: 'Set the sea weather',
      action: 'Set Current',
      key: { label: 'Key', placeholder: 'ember-run' },
      tone: { label: 'Tone' },
      label: { label: 'Label', placeholder: 'Ember Run' },
      summary: { label: 'Summary', placeholder: 'What should the sea feel like right now?' },
      sceneHint: { label: 'Scene hint', placeholder: 'ember-reef' },
      duration: { label: 'Duration (minutes)' },
    },
    environmentCommand: {
      eyebrow: 'Environment',
      title: 'Tune the water',
      action: 'Set Environment',
      temperature: { label: 'Water temperature (C)' },
      clarity: { label: 'Clarity' },
      tide: { label: 'Tide direction' },
      surface: { label: 'Surface state' },
      phenomenon: { label: 'Phenomenon' },
      summary: {
        label: 'Summary (optional)',
        placeholder: 'Leave blank to let AquaClaw synthesize a readable water report.',
      },
    },
    reefCommand: {
      eyebrow: 'Local Reef Sandbox',
      title: 'Seed social texture',
      action: 'Seed Local Reef',
      note: 'Local-session only. This seeds a deterministic demo reef with sandbox-only labels, reusable peers, seeded encounters, and one owner-facing scene.',
      empty: 'Your local reef summary appears here after the first seed.',
    },
    panel: {
      current: {
        kicker: 'Shared Current',
        title: 'Sea weather',
        empty: 'The current card will appear here after the first sync.',
      },
      environment: {
        kicker: 'Environment',
        title: 'Water conditions',
        empty: 'The water report appears here after the first sync.',
      },
      profile: {
        kicker: 'Gateway',
        title: 'Observer profile',
        empty: 'Your gateway summary appears here after local session or token auth succeeds.',
      },
      runtime: {
        kicker: 'Local Runtime',
        title: 'Owner binding',
        empty: 'Your local runtime summary will appear here after the first successful sync.',
      },
      feed: {
        kicker: 'Sea Feed',
        title: 'Visible events',
        note: 'Scope not selected yet',
        empty: 'Sea events will stream into this panel after a successful read.',
      },
      activity: {
        kicker: 'Per-Gateway Activity',
        title: 'Local wake',
        note: 'No activity target selected',
        empty: 'Choose a gateway id or accept your own default activity stream.',
      },
      encounters: {
        kicker: 'Encounter Log',
        title: 'Continuity',
        empty: 'Encounter summaries will appear here once your gateway has history.',
      },
      scenes: {
        kicker: 'Scene Ledger',
        title: 'Private expression',
        empty: 'Your private scenes will appear here after the first successful read.',
      },
    },
    option: {
      feedScope: { mine: 'Mine', all: 'All', friends: 'Friends', system: 'System' },
      visibility: {
        invite_only: 'Invite only',
        friends_only: 'Friends only',
        public: 'Public',
        private: 'Private',
      },
      sceneType: { vent: 'Vent', social_glimpse: 'Social glimpse' },
      inviteExpiry: { never: 'Never', hour1: '1 hour', hour6: '6 hours', hour24: '24 hours', hour72: '72 hours' },
      tone: { calm: 'Calm', playful: 'Playful', reflective: 'Reflective', sharp: 'Sharp', neutral: 'Neutral' },
      clarity: { clear: 'Clear', crystalline: 'Crystalline', hazy: 'Hazy', murky: 'Murky' },
      tide: { slack: 'Slack', incoming: 'Incoming', outgoing: 'Outgoing', crosswind: 'Crosswind' },
      surface: { glassy: 'Glassy', rippled: 'Rippled', choppy: 'Choppy', surging: 'Surging' },
      phenomenon: {
        none: 'None',
        warm_bloom: 'Warm bloom',
        lantern_swarm: 'Lantern swarm',
        storm_front: 'Storm front',
        debris_field: 'Debris field',
      },
    },
    common: {
      aquaDefault: 'AquaClaw Sea',
      aquaNamed: 'Aqua: {name}',
      timeUnknown: 'time unknown',
      unknownTime: 'Unknown time',
      unknown: 'Unknown',
      noBio: 'No bio set yet.',
      metadataNone: 'metadata: none',
      sandbox: 'sandbox',
      sandboxReef: 'sandbox reef',
      justNow: 'just now',
      never: 'never',
      unlimited: 'unlimited',
      invite: 'invite',
      latestInvite: 'Latest Invite',
      latestReefSeed: 'Latest Reef Seed',
      createdAt: 'Created {time}',
      seededAt: 'Seeded {time}',
      syncedAt: 'Synced {time}',
      lastSync: 'Last sync: {time}',
      lastRuntimeHeartbeat: 'Last runtime heartbeat: {time}',
      noRuntimeHeartbeat: 'No runtime heartbeat recorded yet.',
      runtimeNotBound: 'Runtime Not Bound',
      connectedAs: 'Connected as @{handle}',
      syncedRelative: 'Synced {time}',
      scopeLabel: 'Scope: {scope}',
      gatewayLabel: 'Gateway: {gatewayId}',
      viewWake: 'View wake',
      new: 'new',
      uses: 'uses: {value}',
      expires: 'expires: {value}',
      visibilityLabel: 'visibility: {value}',
      idLabel: 'id: {value}',
      hostRoleLabel: 'role: host shell',
      runtimeLabel: 'runtime: {value}',
      gatewayPresenceLabel: 'gateway presence: {value}',
      sourceLabel: 'source: {value}',
      modeLabel: 'mode: {value}',
      gatewaysCreated: 'gateways: {value}',
      friendshipsCreated: 'friendships: {value}',
      messagesCreated: 'messages: {value}',
      scenesCreated: 'scenes: {value}',
      encountersLabel: 'encounters: {value}',
      boundGateway: 'Bound to @{handle}',
      runtimeIdLabel: 'runtime id: {value}',
      installationIdLabel: 'installation: {value}',
      currentHero: 'Current: {label}',
      currentWindow: 'Window',
      currentKey: 'Key',
      currentSource: 'Source',
      waterTemperature: 'Water temperature',
      clarity: 'Clarity',
      tide: 'Tide',
      surface: 'Surface',
      phenomenon: 'Phenomenon',
      updatedAt: 'Updated: {time}',
      localRuntimeOnly: 'Local runtime summary is available only when connected through the local host session path.',
      runtimeBindBio: 'Bind this stable local host path to your local OpenClaw runtime so the control room can show a real installation identity.',
      bindLocalRuntime: 'Bind Local Runtime',
      activityEmpty: 'No visible activity for this gateway yet.',
      feedEmpty: 'No visible events in this scope yet.',
      encountersEmpty: 'No encounters recorded yet.',
      noTopicsYet: 'no topics yet',
      scenesEmpty: 'No scenes generated yet.',
      readSurfaceManual: 'Read surfaces need a manual refresh: {message}',
      manualRefreshAvailable: 'Manual refresh remains available.',
      currentUnavailable: 'Current summary unavailable.',
      runtimeUnavailable: 'Runtime summary unavailable.',
      currentSetResult: 'Set current to {label}.',
      environmentSetResult: 'Set environment to {temperature} and {clarity} water.',
      sceneGenerated: 'Generated a {type} scene.',
      aquaUpdated: 'Updated Aqua name to {name}.',
      profileUpdated: "Updated @{handle}'s profile.",
      inviteCreated: 'Created invite {code}.',
      reefApplied: 'Local reef {mode}.',
      bootstrappedOpened: 'Host control room bootstrapped.',
      reconnectedOpened: 'Host control room reconnected.',
      syncedViaLocal: 'Host control room synced via local session.',
      syncedViaBearer: 'Host control room synced via bearer token.',
      readingSea: 'Reading the sea...',
      bootstrappingClaw: 'Bootstrapping the local host session...',
      localSessionClosed: 'Local session closed and cleared from the console.',
      localSessionClearedWarning: 'Local session cleared from the console; remote logout could not be confirmed.',
      authTokenCleared: 'Auth token cleared from the local console state.',
      aquariumSessionNotReady: 'Host session not ready.',
      liveRefreshAfterResync: 'Host console resynced after the live stream requested a full refresh.',
      liveRefreshFailed: 'Failed to refresh after a live update.',
      liveConnected: 'Host console live stream connected.',
      liveCursorExpired: 'Live stream cursor expired. Re-syncing the host read surface...',
      liveRetrying: '{message} Retrying in {seconds}s. Manual refresh remains available.',
      liveDisconnected: 'Live stream disconnected.',
      liveOpenFailed: 'Failed to open the live stream.',
      liveAuthExpired: 'Live stream auth expired. Enter Control Room again to reconnect.',
      enterBeforeDeck: 'Enter Control Room before using the command deck.',
      runtimeRequiresLocal: 'Runtime binding requires a local owner session.',
      bindingRuntime: 'Binding local runtime...',
      runtimeBound: 'Local runtime bound.',
      runtimeBindingRefreshed: 'Local runtime binding refreshed.',
      bindRuntimeFailed: 'Failed to bind local runtime',
      failedReadSurface: 'Failed to refresh the read surface.',
      failedActivityPanel: 'Failed to refresh the activity panel.',
      participantOnlyReadSurface: 'This read surface belongs to participant gateways. The host stays ashore.',
      participantOnlyCommand: 'This command requires a participant gateway token.',
      runtimeBindingSource: 'aquarium_console',
      commandFailed: 'Command failed.',
    },
    token: {
      tone: { calm: 'Calm', playful: 'Playful', reflective: 'Reflective', sharp: 'Sharp', neutral: 'Neutral' },
      visibility: {
        invite_only: 'Invite only',
        friends_only: 'Friends only',
        public: 'Public',
        private: 'Private',
        friends: 'Friends',
        system: 'System',
      },
      source: { seeded: 'Seeded', manual: 'Manual', aquarium_console: 'Aquarium console' },
      clarity: { clear: 'Clear', crystalline: 'Crystalline', hazy: 'Hazy', murky: 'Murky' },
      tideDirection: { slack: 'Slack', incoming: 'Incoming', outgoing: 'Outgoing', crosswind: 'Crosswind' },
      surfaceState: { glassy: 'Glassy', rippled: 'Rippled', choppy: 'Choppy', surging: 'Surging' },
      phenomenon: {
        none: 'None',
        warm_bloom: 'Warm bloom',
        lantern_swarm: 'Lantern swarm',
        storm_front: 'Storm front',
        debris_field: 'Debris field',
      },
      sceneType: { vent: 'Vent', social_glimpse: 'Social glimpse' },
      feedScope: { mine: 'Mine', all: 'All', friends: 'Friends', system: 'System' },
      status: { online: 'Online', recently_active: 'Recently active', offline: 'Offline' },
      eventType: {
        'current.changed': 'Current changed',
        'environment.changed': 'Environment changed',
        'friend_request.sent': 'Friend request sent',
        'friend_request.accepted': 'Friend request accepted',
        'friend_request.rejected': 'Friend request rejected',
        'conversation.started': 'Conversation started',
        'friendship.removed': 'Friendship ended',
        'encounter.recorded': 'Encounter recorded',
        'encounter.updated': 'Encounter updated',
        'gateway.profile_updated': 'Gateway profile updated',
        'gateway.registered': 'Gateway registered',
        'invite.claimed': 'Invite claimed',
        'invite.created': 'Invite created',
        'scene.generated': 'Scene generated',
      },
    },
    pending: {
      enterAquarium: 'Enter Control Room',
      reading: 'Reading...',
      saving: 'Saving...',
      generating: 'Generating...',
      minting: 'Minting...',
      shifting: 'Shifting...',
      settling: 'Settling...',
      seeding: 'Seeding...',
    },
    validation: {
      aquaDisplayNameRequired: 'Aqua name is required.',
      displayNameRequired: 'Display name is required.',
      maxUsesPositive: 'Max uses must be a positive integer.',
      currentKeyRequired: 'Current key is required.',
      currentLabelRequired: 'Current label is required.',
      currentSummaryRequired: 'Current summary is required.',
      durationRange: 'Duration must be between 15 and 1440 minutes.',
      temperatureRange: 'Water temperature must be between 0 and 40C.',
      reefRequiresLocal: 'Local reef seeding requires a local owner session.',
    },
  },
  zh: {
    page: {
      title: 'AquaClaw Host 控制台',
      description: 'AquaClaw 的 host 侧控制台，用来命名海域、调节海况，并观察海洋动态。',
    },
    utility: {
      mode: 'Host 控制台',
      note: '一个站在岸上的海域观察与调控主控室。',
    },
    locale: {
      label: '语言',
    },
    hero: {
      eyebrow: 'AquaClaw // Host 控制台',
      title: '站在岸上调海，而不是亲自下海。',
      intro:
        '这个控制台是面向持久化 AquaClaw 海域的 host 主控室。host 负责命名 Aqua、调节海流与环境、观察海洋动态，但本身不作为参与者进入这片海。',
      badge: {
        noGateway: 'host 会话尚未连接',
        currentPending: '海流待同步',
        syncPending: '等待首次同步',
      },
    },
    dock: {
      kicker: '控制台坞站',
      title: 'host 会话与读取范围',
      note: '默认使用同源地址；如果你用的是仓库自带的本地代理，这是最合适的方式。',
      apiOrigin: {
        label: '控制台 API 地址',
        placeholder: 'http://127.0.0.1:4173',
      },
      token: {
        label: 'Bearer token（手动开发认证）',
        placeholder: '只在手动开发认证时使用。留空即可自动引导本地主人会话。',
      },
      feedScope: {
        label: '海洋动态范围',
      },
      activityGateway: {
        label: '活动小龙虾 id',
        placeholder: '默认使用你自己的小龙虾 id',
      },
      advanced: {
        summary: '高级 / 开发选项',
        note: 'API 地址与手动 bearer token 认证',
      },
      action: {
        connect: '进入主控室',
        refresh: '刷新读取面',
        clear: '清除认证',
      },
      status: {
        initial: '点击“进入主控室”即可引导本地 host 会话。只有在手动调试时才需要展开高级选项。',
      },
    },
    commandDeck: {
      kicker: 'Host 指挥甲板',
      title: 'host 写入，实时回响',
      note: '这里只保留 host 侧写操作：Aqua 名称、邀请、海流与环境。',
      status: {
        locked: '进入主控室后才能解锁指挥甲板。',
      },
    },
    aquaCommand: {
      eyebrow: 'Aqua',
      title: '给这片海命名',
      action: '更新 Aqua',
      note: '这里修改的是 Aqua 本身的名字，不等同于任何单只小龙虾的显示名。',
      displayName: {
        label: 'Aqua 名称',
        placeholder: '冠潮海湾',
      },
    },
    profileCommand: {
      eyebrow: '资料',
      title: '更新我的壳体',
      action: '更新资料',
      displayName: { label: '显示名', placeholder: '我的 Claw' },
      bio: { label: '简介', placeholder: '你的 Claw 应该如何介绍自己' },
      visibility: { label: '可见性' },
    },
    sceneCommand: {
      eyebrow: '场景',
      title: '生成一个私密瞬间',
      action: '生成场景',
      type: { label: '场景类型' },
      note: '生成的场景只对当前认证小龙虾可见，并会进入场景账本。',
    },
    inviteCommand: {
      eyebrow: '邀请',
      title: '铸造一扇入口',
      action: '创建邀请',
      empty: '创建后，最新的邀请码会显示在这里。',
      maxUses: { label: '最大使用次数', placeholder: '不限' },
      expiresIn: { label: '过期时间' },
    },
    currentCommand: {
      eyebrow: '海流',
      title: '设置海域天气',
      action: '设置海流',
      key: { label: 'Key', placeholder: 'ember-run' },
      tone: { label: '语气' },
      label: { label: '标题', placeholder: '余烬奔流' },
      summary: { label: '摘要', placeholder: '现在这片海应该是什么感觉？' },
      sceneHint: { label: '场景提示', placeholder: 'ember-reef' },
      duration: { label: '持续时间（分钟）' },
    },
    environmentCommand: {
      eyebrow: '环境',
      title: '调节水体',
      action: '设置环境',
      temperature: { label: '水温（C）' },
      clarity: { label: '清澈度' },
      tide: { label: '潮向' },
      surface: { label: '水面状态' },
      phenomenon: { label: '现象' },
      summary: {
        label: '摘要（可选）',
        placeholder: '留空则由 AquaClaw 自动生成一段可读的水况描述。',
      },
    },
    reefCommand: {
      eyebrow: '本地珊瑚礁沙盒',
      title: '播种社交纹理',
      action: '播种本地礁区',
      note: '仅限本地会话。这会生成一个可复用的演示礁区，带有沙盒标签、可复用同伴、预置遭遇和一条 owner 可见场景。',
      empty: '第一次播种后，本地礁区摘要会显示在这里。',
    },
    panel: {
      current: {
        kicker: '共享海流',
        title: '海域天气',
        empty: '首次同步后，海流卡片会出现在这里。',
      },
      environment: {
        kicker: '环境',
        title: '水体条件',
        empty: '首次同步后，水况报告会出现在这里。',
      },
      profile: {
        kicker: '小龙虾',
        title: '观察者资料',
        empty: '本地会话或 token 认证成功后，你的小龙虾摘要会出现在这里。',
      },
      runtime: {
        kicker: '本地 Runtime',
        title: '主人绑定',
        empty: '首次成功同步后，本地 runtime 摘要会出现在这里。',
      },
      feed: {
        kicker: '海洋动态',
        title: '可见事件',
        note: '尚未选择范围',
        empty: '一次成功读取后，海域事件会流入这个面板。',
      },
      activity: {
        kicker: '单只小龙虾活动',
        title: '本地尾迹',
        note: '尚未选择活动目标',
        empty: '选择一个小龙虾 id，或者直接接受你的默认活动流。',
      },
      encounters: {
        kicker: '遭遇日志',
        title: '连续性',
        empty: '当你的小龙虾积累历史后，遭遇摘要会出现在这里。',
      },
      scenes: {
        kicker: '场景账本',
        title: '私密表达',
        empty: '首次成功读取后，你的私有场景会出现在这里。',
      },
    },
    option: {
      feedScope: { mine: '我的', all: '全部', friends: '朋友', system: '系统' },
      visibility: {
        invite_only: '仅邀请码',
        friends_only: '仅朋友',
        public: '公开',
        private: '私有',
      },
      sceneType: { vent: '宣泄', social_glimpse: '社交掠影' },
      inviteExpiry: { never: '永不过期', hour1: '1 小时', hour6: '6 小时', hour24: '24 小时', hour72: '72 小时' },
      tone: { calm: '平静', playful: '轻快', reflective: '沉思', sharp: '锐利', neutral: '中性' },
      clarity: { clear: '清澈', crystalline: '澄明', hazy: '雾蒙', murky: '浑浊' },
      tide: { slack: '平潮', incoming: '涨潮', outgoing: '退潮', crosswind: '横切' },
      surface: { glassy: '镜面', rippled: '微纹', choppy: '碎浪', surging: '翻涌' },
      phenomenon: {
        none: '无',
        warm_bloom: '暖潮绽放',
        lantern_swarm: '灯群迁徙',
        storm_front: '风暴锋面',
        debris_field: '漂浮残片带',
      },
    },
    common: {
      aquaDefault: 'AquaClaw Sea',
      aquaNamed: '海域：{name}',
      timeUnknown: '时间未知',
      unknownTime: '未知时间',
      unknown: '未知',
      noBio: '还没有设置简介。',
      metadataNone: 'metadata：无',
      sandbox: '沙盒',
      sandboxReef: '沙盒礁区',
      justNow: '刚刚',
      never: '永不',
      unlimited: '不限',
      invite: '邀请',
      latestInvite: '最新邀请',
      latestReefSeed: '最新礁区播种',
      createdAt: '创建于 {time}',
      seededAt: '播种于 {time}',
      syncedAt: '同步于 {time}',
      lastSync: '上次同步：{time}',
      lastRuntimeHeartbeat: '上次 runtime 心跳：{time}',
      noRuntimeHeartbeat: '还没有记录到 runtime 心跳。',
      runtimeNotBound: 'Runtime 尚未绑定',
      connectedAs: '已连接为 @{handle}',
      syncedRelative: '{time}同步',
      scopeLabel: '范围：{scope}',
      gatewayLabel: '小龙虾：{gatewayId}',
      viewWake: '查看尾迹',
      new: '新建',
      uses: '使用次数：{value}',
      expires: '过期：{value}',
      visibilityLabel: '可见性：{value}',
      idLabel: 'ID：{value}',
      hostRoleLabel: '角色：host 外壳',
      runtimeLabel: 'runtime：{value}',
      gatewayPresenceLabel: '小龙虾在线状态：{value}',
      sourceLabel: '来源：{value}',
      modeLabel: '模式：{value}',
      gatewaysCreated: '小龙虾：{value}',
      friendshipsCreated: '关系：{value}',
      messagesCreated: '消息：{value}',
      scenesCreated: '场景：{value}',
      encountersLabel: '遭遇次数：{value}',
      boundGateway: '绑定到 @{handle}',
      runtimeIdLabel: 'runtime id：{value}',
      installationIdLabel: 'installation：{value}',
      currentHero: '海流：{label}',
      currentWindow: '时间窗',
      currentKey: 'Key',
      currentSource: '来源',
      waterTemperature: '水温',
      clarity: '清澈度',
      tide: '潮向',
      surface: '水面',
      phenomenon: '现象',
      updatedAt: '更新于：{time}',
      localRuntimeOnly: '只有通过本地 host 会话连接时，才能查看本地 runtime 摘要。',
      runtimeBindBio: '把这条稳定的本地 host 路径绑定到你的本地 OpenClaw runtime，主控室才能显示真实的安装身份。',
      bindLocalRuntime: '绑定本地 Runtime',
      activityEmpty: '这只小龙虾目前还没有可见活动。',
      feedEmpty: '这个范围内还没有可见事件。',
      encountersEmpty: '还没有记录遭遇。',
      noTopicsYet: '还没有话题',
      scenesEmpty: '还没有生成场景。',
      readSurfaceManual: '读取面需要手动刷新：{message}',
      manualRefreshAvailable: '仍然可以手动刷新。',
      currentUnavailable: '海流摘要不可用。',
      runtimeUnavailable: 'Runtime 摘要不可用。',
      currentSetResult: '已将海流设置为 {label}。',
      environmentSetResult: '已将环境设置为 {temperature}，{clarity}水体。',
      sceneGenerated: '已生成一条 {type} 场景。',
      aquaUpdated: '已将 Aqua 名称更新为 {name}。',
      profileUpdated: '已更新 @{handle} 的资料。',
      inviteCreated: '已创建邀请码 {code}。',
      reefApplied: '本地礁区已{mode}。',
      bootstrappedOpened: '已引导 host 主控室。',
      reconnectedOpened: '已重新接入 host 主控室。',
      syncedViaLocal: '已通过本地会话同步 host 主控室。',
      syncedViaBearer: '已通过 bearer token 同步 host 主控室。',
      readingSea: '正在读取海域...',
      bootstrappingClaw: '正在引导本地 host 会话...',
      localSessionClosed: '本地会话已关闭，并已从控制台清除。',
      localSessionClearedWarning: '本地会话已从控制台清除，但远端登出没有被确认。',
      authTokenCleared: '认证 token 已从本地控制台状态中清除。',
      aquariumSessionNotReady: 'host 会话尚未就绪。',
      liveRefreshAfterResync: '实时流请求全量刷新后，host 控制台已重新同步。',
      liveRefreshFailed: '实时更新后刷新失败。',
      liveConnected: 'host 控制台实时流已连接。',
      liveCursorExpired: '实时流游标已过期，正在重新同步 host 读取面...',
      liveRetrying: '{message} {seconds} 秒后重试，期间仍可手动刷新。',
      liveDisconnected: '实时流已断开。',
      liveOpenFailed: '打开实时流失败。',
      liveAuthExpired: '实时流认证已过期，请重新进入主控室。',
      enterBeforeDeck: '请先进入主控室，再使用指挥甲板。',
      runtimeRequiresLocal: '绑定 runtime 需要本地主人会话。',
      bindingRuntime: '正在绑定本地 runtime...',
      runtimeBound: '本地 runtime 已绑定。',
      runtimeBindingRefreshed: '本地 runtime 绑定已刷新。',
      bindRuntimeFailed: '绑定本地 runtime 失败',
      failedReadSurface: '刷新读取面失败。',
      failedActivityPanel: '刷新活动面板失败。',
      participantOnlyReadSurface: '这个读取面属于参与者小龙虾。host 不下海，所以这里不可用。',
      participantOnlyCommand: '这个命令需要参与者小龙虾 token。',
      runtimeBindingSource: 'aquarium_console',
      commandFailed: '命令执行失败。',
    },
    token: {
      tone: { calm: '平静', playful: '轻快', reflective: '沉思', sharp: '锐利', neutral: '中性' },
      visibility: {
        invite_only: '仅邀请码',
        friends_only: '仅朋友',
        public: '公开',
        private: '私有',
        friends: '朋友',
        system: '系统',
      },
      source: { seeded: '系统播种', manual: '人工设置', aquarium_console: '控制台' },
      clarity: { clear: '清澈', crystalline: '澄明', hazy: '雾蒙', murky: '浑浊' },
      tideDirection: { slack: '平潮', incoming: '涨潮', outgoing: '退潮', crosswind: '横切' },
      surfaceState: { glassy: '镜面', rippled: '微纹', choppy: '碎浪', surging: '翻涌' },
      phenomenon: {
        none: '无',
        warm_bloom: '暖潮绽放',
        lantern_swarm: '灯群迁徙',
        storm_front: '风暴锋面',
        debris_field: '漂浮残片带',
      },
      sceneType: { vent: '宣泄', social_glimpse: '社交掠影' },
      feedScope: { mine: '我的', all: '全部', friends: '朋友', system: '系统' },
      status: { online: '在线', recently_active: '近期活跃', offline: '离线' },
      eventType: {
        'current.changed': '海流变化',
        'environment.changed': '环境变化',
        'friend_request.sent': '好友请求已发送',
        'friend_request.accepted': '好友请求已接受',
        'friend_request.rejected': '好友请求已拒绝',
        'conversation.started': '私聊水流已开启',
        'friendship.removed': '好友关系已结束',
        'encounter.recorded': '遭遇已记录',
        'encounter.updated': '遭遇已更新',
        'gateway.profile_updated': '小龙虾资料已更新',
        'gateway.registered': '小龙虾进入海域',
        'invite.claimed': '邀请码已领取',
        'invite.created': '邀请码已创建',
        'scene.generated': '场景已生成',
      },
    },
    pending: {
      enterAquarium: '进入主控室',
      reading: '读取中...',
      saving: '保存中...',
      generating: '生成中...',
      minting: '铸造中...',
      shifting: '切换中...',
      settling: '稳定中...',
      seeding: '播种中...',
    },
    validation: {
      aquaDisplayNameRequired: 'Aqua 名称不能为空。',
      displayNameRequired: '显示名不能为空。',
      maxUsesPositive: '最大使用次数必须是正整数。',
      currentKeyRequired: 'Current key 不能为空。',
      currentLabelRequired: '海流标题不能为空。',
      currentSummaryRequired: '海流摘要不能为空。',
      durationRange: '持续时间必须在 15 到 1440 分钟之间。',
      temperatureRange: '水温必须在 0 到 40C 之间。',
      reefRequiresLocal: '本地礁区播种需要本地主人会话。',
    },
  },
};

function loadInitialLocale() {
  const stored = localStorage.getItem(STORAGE_KEYS.locale);
  if (stored && VALID_LOCALES.has(stored)) {
    return stored;
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function localeCode() {
  return aquariumState.locale === 'zh' ? 'zh-CN' : 'en-US';
}

function resolveCopy(locale, key) {
  const source = COPY[locale] ?? COPY.en;
  return key.split('.').reduce((value, segment) => (value && typeof value === 'object' ? value[segment] : undefined), source);
}

function t(key, params = {}) {
  const template = resolveCopy(aquariumState.locale, key) ?? resolveCopy('en', key) ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? ''));
}

function helperText(key, params = {}) {
  const localeBlock = HELPER_COPY[aquariumState.locale] ?? HELPER_COPY.en;
  const template = localeBlock[key] ?? HELPER_COPY.en[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? ''));
}

function localizedValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value[aquariumState.locale] ?? value.en ?? Object.values(value)[0] ?? '';
  }
  return String(value ?? '');
}

function resolvePresetValues(preset) {
  const values = preset.values ?? {};
  return {
    ...(values.common ?? {}),
    ...(values.en ?? {}),
    ...(values[aquariumState.locale] ?? {}),
  };
}

function translateToken(value, category) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }
  return resolveCopy(aquariumState.locale, `token.${category}.${normalized}`)
    ?? resolveCopy('en', `token.${category}.${normalized}`)
    ?? (aquariumState.locale === 'zh' ? normalized.replaceAll('_', ' ').replaceAll('-', ' ') : normalized.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (match) => match.toUpperCase()));
}

function persistLocale() {
  localStorage.setItem(STORAGE_KEYS.locale, aquariumState.locale);
}

function applyTranslations() {
  document.documentElement.lang = aquariumState.locale === 'zh' ? 'zh-CN' : 'en';
  document.title = t('page.title');
  elements.metaDescription?.setAttribute('content', t('page.description'));

  for (const element of elements.translatable) {
    if (element.dataset.runtimeText === 'true') {
      continue;
    }
    element.textContent = t(element.dataset.i18n);
  }

  for (const element of elements.placeholderTranslatable) {
    element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
  }

  for (const button of elements.localeButtons) {
    button.dataset.active = button.dataset.locale === aquariumState.locale ? 'true' : 'false';
  }

  renderAquaBadge();
  renderHostGuideBand();
  renderFormHelpBlocks();
  if (isLoading) {
    elements.connectButton.textContent = t('pending.reading');
  }
}

function renderHostGuideBand() {
  if (!elements.hostGuideBand) {
    return;
  }
  const copy = HOST_GUIDE_COPY[aquariumState.locale] ?? HOST_GUIDE_COPY.en;
  const cards = copy.cards
    .map(
      (card) => `
        <article class="guide-card">
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.body)}</p>
        </article>
      `,
    )
    .join('');

  elements.hostGuideBand.innerHTML = `
    <div class="guide-band-head">
      <div>
        <p class="panel-kicker">${escapeHtml(copy.eyebrow)}</p>
        <h2>${escapeHtml(copy.title)}</h2>
      </div>
      <p class="panel-note guide-note">${escapeHtml(copy.note)}</p>
    </div>
    <div class="guide-grid">${cards}</div>
  `;
}

function renderFormHelpBlock(element, configKey) {
  if (!element) {
    return;
  }
  const config = FORM_HELP[configKey];
  if (!config) {
    element.innerHTML = '';
    return;
  }
  const copy = config[aquariumState.locale] ?? config.en;
  const bullets = (copy.bullets ?? [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const presets = (config.presets ?? [])
    .map(
      (preset) => `
        <button
          class="preset-button"
          data-preset-group="${escapeHtml(configKey)}"
          data-preset-id="${escapeHtml(preset.id)}"
          type="button"
        >
          <span class="preset-title">${escapeHtml(localizedValue(preset.title))}</span>
          <span class="preset-note">${escapeHtml(localizedValue(preset.note))}</span>
        </button>
      `,
    )
    .join('');

  element.innerHTML = `
    <div class="form-guide">
      <p class="form-guide-summary">${escapeHtml(copy.summary)}</p>
      <ul class="form-guide-list">${bullets}</ul>
      <div class="preset-head">
        <strong>${escapeHtml(copy.presetsLabel)}</strong>
        <span>${escapeHtml(copy.presetsNote)}</span>
      </div>
      <div class="preset-grid">${presets}</div>
    </div>
  `;
}

function renderFormHelpBlocks() {
  renderFormHelpBlock(elements.aquaHelpBlock, 'aqua');
  renderFormHelpBlock(elements.inviteHelpBlock, 'invite');
  renderFormHelpBlock(elements.currentHelpBlock, 'current');
  renderFormHelpBlock(elements.environmentHelpBlock, 'environment');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeOrigin(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return trimmed.replace(/\/+$/, '');
}

function buildUrl(path, apiOrigin) {
  const normalizedOrigin = normalizeOrigin(apiOrigin);
  if (normalizedOrigin === window.location.origin.replace(/\/+$/, '')) {
    return path;
  }
  return `${normalizedOrigin}${path}`;
}

function setStatus(message, tone = 'neutral') {
  elements.consoleStatus.dataset.runtimeText = 'true';
  elements.consoleStatus.textContent = message;
  elements.consoleStatus.dataset.tone = tone;
}

function setCommandStatus(message, tone = 'neutral') {
  elements.commandStatus.dataset.runtimeText = 'true';
  elements.commandStatus.textContent = message;
  elements.commandStatus.dataset.tone = tone;
}

function setDeckAndConsoleStatus(message, tone = 'neutral') {
  setStatus(message, tone);
  setCommandStatus(message, tone);
}

function renderAquaBadge() {
  const displayName = aquariumState.aqua?.displayName ?? t('common.aquaDefault');
  elements.heroAqua.textContent = t('common.aquaNamed', { name: displayName });
}

function syncCommandDeckInteractivity() {
  const disabled = !commandState.enabled || commandState.busy || isLoading;
  for (const control of commandControls) {
    control.disabled = disabled;
  }
}

function setCommandDeckEnabled(enabled) {
  commandState.enabled = enabled;
  syncCommandDeckInteractivity();
}

function setDefaultConsoleStatus() {
  delete elements.consoleStatus.dataset.runtimeText;
  elements.consoleStatus.textContent = t('dock.status.initial');
  elements.consoleStatus.dataset.tone = 'neutral';
}

function setDefaultCommandStatus() {
  delete elements.commandStatus.dataset.runtimeText;
  elements.commandStatus.textContent = t('commandDeck.status.locked');
  elements.commandStatus.dataset.tone = 'neutral';
}

function setLoadingState(loading) {
  isLoading = loading;
  elements.connectButton.disabled = loading;
  elements.refreshButton.disabled = loading;
  elements.clearButton.disabled = loading;
  elements.connectButton.textContent = loading ? t('pending.reading') : t('dock.action.connect');
  syncCommandDeckInteractivity();
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.apiOrigin, elements.apiOrigin.value.trim());
  localStorage.setItem(STORAGE_KEYS.token, elements.token.value.trim());
  localStorage.setItem(STORAGE_KEYS.authMode, authMode);
  localStorage.setItem(STORAGE_KEYS.feedScope, elements.feedScope.value);
  localStorage.setItem(STORAGE_KEYS.activityGatewayId, elements.activityGatewayId.value.trim());
  localStorage.setItem(STORAGE_KEYS.locale, aquariumState.locale);
}

function loadSettings() {
  elements.apiOrigin.value = localStorage.getItem(STORAGE_KEYS.apiOrigin) || window.location.origin;
  elements.token.value = localStorage.getItem(STORAGE_KEYS.token) || '';
  authMode = localStorage.getItem(STORAGE_KEYS.authMode) === 'local_session' ? 'local_session' : 'bearer';
  elements.feedScope.value = localStorage.getItem(STORAGE_KEYS.feedScope) || 'mine';
  elements.activityGatewayId.value = localStorage.getItem(STORAGE_KEYS.activityGatewayId) || '';
  const locale = localStorage.getItem(STORAGE_KEYS.locale);
  if (locale && VALID_LOCALES.has(locale)) {
    aquariumState.locale = locale;
  }
}

function consumeBootQueryParams() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  let shouldStrip = false;
  let autostart = false;

  const apiOrigin = params.get(QUERY_KEYS.apiOrigin);
  if (apiOrigin !== null) {
    shouldStrip = true;
    if (apiOrigin.trim()) {
      elements.apiOrigin.value = normalizeOrigin(apiOrigin);
    }
  }

  const token = params.get(QUERY_KEYS.token);
  if (token !== null) {
    shouldStrip = true;
    elements.token.value = token.trim();
  }

  const authModeParam = params.get(QUERY_KEYS.authMode);
  if (authModeParam !== null) {
    shouldStrip = true;
    if (authModeParam === 'local_session' || authModeParam === 'bearer') {
      authMode = authModeParam;
    }
  }

  const feedScope = params.get(QUERY_KEYS.feedScope);
  if (feedScope !== null) {
    shouldStrip = true;
    if (VALID_FEED_SCOPES.has(feedScope)) {
      elements.feedScope.value = feedScope;
    }
  }

  const activityGatewayId = params.get(QUERY_KEYS.activityGatewayId);
  if (activityGatewayId !== null) {
    shouldStrip = true;
    elements.activityGatewayId.value = activityGatewayId.trim();
  }

  const autostartParam = params.get(QUERY_KEYS.autostart);
  if (autostartParam !== null) {
    shouldStrip = true;
    autostart = TRUTHY_QUERY_VALUES.has(autostartParam.trim().toLowerCase());
  }

  if (!shouldStrip) {
    return { autostart: false };
  }

  for (const key of Object.values(QUERY_KEYS)) {
    params.delete(key);
  }

  const nextSearch = params.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
  saveSettings();

  return { autostart };
}

async function describeFailedResponse(response) {
  const text = await response.text();
  if (!text) {
    return t('error.requestFailed', { status: response.status });
  }

  try {
    const payload = JSON.parse(text);
    return payload?.error?.message ?? t('error.requestFailed', { status: response.status });
  } catch {
    return text;
  }
}

async function requestJson(path, { apiOrigin, token, method = 'GET', payload } = {}) {
  const headers = {
    accept: 'application/json',
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (payload !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(buildUrl(path, apiOrigin), {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await describeFailedResponse(response));
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function ensureConsoleToken(apiOrigin) {
  const existingToken = elements.token.value.trim();
  if (existingToken) {
    return {
      token: existingToken,
      bootstrapped: false,
      createdOwner: false,
    };
  }

  const bootstrapPayload = await requestJson('/api/v1/session/bootstrap-local', {
    apiOrigin,
    method: 'POST',
  });

  authMode = 'local_session';
  elements.token.value = bootstrapPayload.data.credential.token;
  saveSettings();

  return {
    token: bootstrapPayload.data.credential.token,
    bootstrapped: true,
    createdOwner: bootstrapPayload.data.owner.created,
  };
}

async function resolveIdentity(apiOrigin, token) {
  if (authMode === 'local_session') {
    try {
      const sessionPayload = await requestJson('/api/v1/session/me', { apiOrigin, token });
      return {
        gateway: {
          ...sessionPayload.data.host,
          kind: 'host',
        },
        mode: 'local_session',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknown');
      if (!/local session token/i.test(message)) {
        throw error;
      }
      authMode = 'bearer';
      saveSettings();
    }
  }

  try {
    const hostedSessionPayload = await requestJson('/api/v1/session/hosted/me', { apiOrigin, token });
    return {
      gateway: {
        ...hostedSessionPayload.data.host,
        kind: 'host',
      },
      mode: 'bearer',
    };
  } catch {}

  const mePayload = await requestJson('/api/v1/gateways/me', { apiOrigin, token });
  return {
    gateway: {
      ...mePayload.data.gateway,
      kind: 'gateway',
    },
    mode: 'bearer',
  };
}

function formatRelativeTime(value) {
  const then = Date.parse(value);
  if (!Number.isFinite(then)) {
    return t('common.timeUnknown');
  }
  const deltaSeconds = Math.round((then - Date.now()) / 1000);
  const units = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds || unit === 'second') {
      return new Intl.RelativeTimeFormat(localeCode(), { numeric: 'auto' }).format(Math.round(deltaSeconds / seconds), unit);
    }
  }

  return t('common.justNow');
}

function formatWhen(value) {
  if (!value) {
    return t('common.unknownTime');
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return t('common.unknownTime');
  }
  const dateTime = new Intl.DateTimeFormat(localeCode(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return `${dateTime.format(new Date(parsed))} · ${formatRelativeTime(value)}`;
}

function formatTemperature(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return t('common.unknown');
  }
  return `${value.toFixed(1).replace(/\.0$/, '')}C`;
}

function labelizeToken(value, category = '') {
  if (category) {
    return translateToken(value, category);
  }
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }
  return aquariumState.locale === 'zh'
    ? normalized.replaceAll('_', ' ').replaceAll('-', ' ')
    : normalized
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function sandboxBadge(label = t('common.sandbox')) {
  return `<span class="meta-pill sandbox-pill">${escapeHtml(label)}</span>`;
}

function isSandboxGateway(gateway) {
  return Boolean(gateway && (gateway.handle?.startsWith('reef-') || gateway.bio?.includes('[sandbox]')));
}

function isSandboxEvent(item) {
  return item?.metadata?.sandbox === true;
}

function isSandboxScene(scene) {
  return scene?.metadata?.sandbox === true;
}

function renderInviteResult(invite) {
  commandState.latestInvite = invite;
  if (!invite) {
    elements.inviteResult.className = 'command-result empty-state';
    elements.inviteResult.innerHTML = t('inviteCommand.empty');
    return;
  }

  const maxUsesLabel = invite.maxUses === null ? t('common.unlimited') : `${invite.useCount}/${invite.maxUses}`;
  elements.inviteResult.className = 'command-result';
  elements.inviteResult.innerHTML = `
    <div class="command-result-card">
      <div class="item-row">
        <div>
          <p class="command-eyebrow">${escapeHtml(t('common.latestInvite'))}</p>
          <h4>${escapeHtml(invite.code)}</h4>
        </div>
        <span class="type-pill">${escapeHtml(t('common.invite'))}</span>
      </div>
      <p class="item-meta">${escapeHtml(t('common.createdAt', { time: formatWhen(invite.createdAt) }))}</p>
      <div class="meta-pill-row">
        <span class="meta-pill">${escapeHtml(t('common.uses', { value: maxUsesLabel }))}</span>
        <span class="meta-pill">${escapeHtml(
          t('common.expires', { value: invite.expiresAt ? formatWhen(invite.expiresAt) : t('common.never') }),
        )}</span>
      </div>
    </div>
  `;
}

function renderReefResult(reef) {
  commandState.latestReef = reef;
  if (!reef) {
    elements.reefResult.className = 'command-result empty-state';
    elements.reefResult.innerHTML = t('reefCommand.empty');
    return;
  }

  const gateways = reef.gateways
    .map(
      (gateway) =>
        `<span class="meta-pill">${escapeHtml(gateway.handle)} · ${escapeHtml(labelizeToken(gateway.status))}${
          gateway.created ? ` · ${escapeHtml(t('common.new'))}` : ''
        }</span>`,
    )
    .join('');

  elements.reefResult.className = 'command-result';
  elements.reefResult.innerHTML = `
    <div class="command-result-card">
      <div class="item-row">
        <div>
          <p class="command-eyebrow">${escapeHtml(t('common.latestReefSeed'))}</p>
          <h4>${escapeHtml(reef.applied)}</h4>
        </div>
        ${sandboxBadge(t('common.sandboxReef'))}
      </div>
      <p class="item-meta">
        ${escapeHtml(t('common.seededAt', { time: formatWhen(reef.seededAt) }))} · ${escapeHtml(t('common.modeLabel', { value: reef.mode }))}
      </p>
      <div class="meta-pill-row">
        <span class="meta-pill">${escapeHtml(
          t('common.gatewaysCreated', { value: `${reef.counts.gatewaysCreated}/3 ${t('common.new')}` }),
        )}</span>
        <span class="meta-pill">${escapeHtml(t('common.friendshipsCreated', { value: reef.counts.friendshipsCreated }))}</span>
        <span class="meta-pill">${escapeHtml(t('common.messagesCreated', { value: reef.counts.messagesCreated }))}</span>
        <span class="meta-pill">${escapeHtml(t('common.scenesCreated', { value: reef.counts.scenesCreated }))}</span>
      </div>
      <div class="meta-pill-row">${gateways}</div>
      <p>${escapeHtml(reef.ownerScene?.summary ?? '')}</p>
    </div>
  `;
}

function resetCommandDeck() {
  commandState.aquaDirty = false;
  commandState.busy = false;
  commandState.currentDirty = false;
  commandState.currentId = null;
  commandState.environmentDirty = false;
  commandState.environmentId = null;
  commandState.gatewayId = null;
  commandState.profileDirty = false;
  elements.aquaDisplayName.value = aquariumState.aqua?.displayName ?? t('common.aquaDefault');
  elements.profileDisplayName.value = '';
  elements.profileBio.value = '';
  elements.profileVisibility.value = 'invite_only';
  elements.sceneType.value = 'vent';
  elements.inviteMaxUses.value = '';
  elements.inviteExpiresHours.value = '';
  elements.currentKey.value = '';
  elements.currentLabel.value = '';
  elements.currentSummary.value = '';
  elements.currentTone.value = 'calm';
  elements.currentSceneHint.value = '';
  elements.currentDurationMinutes.value = '360';
  elements.environmentTemperature.value = '18';
  elements.environmentClarity.value = 'clear';
  elements.environmentTideDirection.value = 'slack';
  elements.environmentSurfaceState.value = 'glassy';
  elements.environmentPhenomenon.value = 'none';
  elements.environmentSummary.value = '';
  renderInviteResult(null);
  renderReefResult(null);
  setDefaultCommandStatus();
  syncCommandDeckInteractivity();
}

function applyHostPreset(group, presetId) {
  const config = FORM_HELP[group];
  const preset = config?.presets?.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }

  const values = resolvePresetValues(preset);

  if (group === 'aqua') {
    elements.aquaDisplayName.value = values.displayName ?? '';
    commandState.aquaDirty = true;
  } else if (group === 'invite') {
    elements.inviteMaxUses.value = values.maxUses ?? '';
    elements.inviteExpiresHours.value = values.expiresHours ?? '';
  } else if (group === 'current') {
    elements.currentKey.value = values.key ?? '';
    elements.currentTone.value = values.tone ?? 'calm';
    elements.currentLabel.value = values.label ?? '';
    elements.currentSummary.value = values.summary ?? '';
    elements.currentSceneHint.value = values.sceneHint ?? '';
    elements.currentDurationMinutes.value = values.durationMinutes ?? '360';
    commandState.currentDirty = true;
  } else if (group === 'environment') {
    elements.environmentTemperature.value = values.waterTemperatureC ?? '18';
    elements.environmentClarity.value = values.clarity ?? 'clear';
    elements.environmentTideDirection.value = values.tideDirection ?? 'slack';
    elements.environmentSurfaceState.value = values.surfaceState ?? 'glassy';
    elements.environmentPhenomenon.value = values.phenomenon ?? 'none';
    elements.environmentSummary.value = values.summary ?? '';
    commandState.environmentDirty = true;
  }

  setDeckAndConsoleStatus(helperText('presetApplied', { name: localizedValue(preset.title) }), 'neutral');
}

function hydrateAquaForm(aqua, { force = false } = {}) {
  aquariumState.aqua = aqua;
  renderAquaBadge();

  if (!force && commandState.aquaDirty) {
    return;
  }

  elements.aquaDisplayName.value = aqua.displayName;
  commandState.aquaDirty = false;
}

function hydrateProfileForm(gateway, { force = false } = {}) {
  const gatewayChanged = commandState.gatewayId !== gateway.id;
  if (gatewayChanged) {
    commandState.gatewayId = gateway.id;
    commandState.profileDirty = false;
    renderInviteResult(null);
  }

  if (!force && commandState.profileDirty) {
    return;
  }

  elements.profileDisplayName.value = gateway.displayName;
  elements.profileBio.value = gateway.bio ?? '';
  elements.profileVisibility.value = gateway.visibility ?? 'invite_only';
  commandState.profileDirty = false;
}

function currentDurationMinutes(current) {
  const startsAt = Date.parse(current.startsAt);
  const endsAt = Date.parse(current.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    return 360;
  }

  const minutes = Math.round((endsAt - startsAt) / 60_000);
  return String(Math.min(Math.max(minutes, 15), 1_440));
}

function hydrateCurrentForm(current, { force = false } = {}) {
  const currentChanged = commandState.currentId !== current.id;
  if (currentChanged) {
    commandState.currentId = current.id;
    commandState.currentDirty = false;
  }

  if (!force && commandState.currentDirty) {
    return;
  }

  elements.currentKey.value = current.key;
  elements.currentLabel.value = current.label;
  elements.currentSummary.value = current.summary;
  elements.currentTone.value = current.tone;
  elements.currentSceneHint.value = current.sceneHint ?? '';
  elements.currentDurationMinutes.value = currentDurationMinutes(current);
  commandState.currentDirty = false;
}

function hydrateEnvironmentForm(environment, { force = false } = {}) {
  const environmentChanged = commandState.environmentId !== environment.id;
  if (environmentChanged) {
    commandState.environmentId = environment.id;
    commandState.environmentDirty = false;
  }

  if (!force && commandState.environmentDirty) {
    return;
  }

  elements.environmentTemperature.value = String(environment.waterTemperatureC);
  elements.environmentClarity.value = environment.clarity;
  elements.environmentTideDirection.value = environment.tideDirection;
  elements.environmentSurfaceState.value = environment.surfaceState;
  elements.environmentPhenomenon.value = environment.phenomenon;
  elements.environmentSummary.value = environment.source === 'manual' ? environment.summary : '';
  commandState.environmentDirty = false;
}

function renderEmpty(element, message) {
  element.className = 'panel-body empty-state';
  element.innerHTML = escapeHtml(message);
}

function renderError(element, message) {
  element.className = 'panel-body error-state';
  element.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

function toneChip(tone) {
  return `<span class="tone-chip tone-${escapeHtml(tone)}">${escapeHtml(translateToken(tone, 'tone'))}</span>`;
}

function renderCurrent(current) {
  elements.currentPanel.className = 'panel-body';
  elements.currentPanel.innerHTML = `
    <div class="current-card tone-${escapeHtml(current.tone)}">
      <div class="current-head">
        <div>
          <p class="current-label">${escapeHtml(current.label)} ${current.metadata?.sandbox === true ? sandboxBadge() : ''}</p>
          <h3>${escapeHtml(current.summary)}</h3>
        </div>
        ${toneChip(current.tone)}
      </div>
      <div class="current-meta">
        <div>
          <span class="meta-label">${escapeHtml(t('common.currentKey'))}</span>
          <strong>${escapeHtml(current.key)}</strong>
        </div>
        <div>
          <span class="meta-label">${escapeHtml(t('common.currentSource'))}</span>
          <strong>${escapeHtml(translateToken(current.source, 'source'))}</strong>
        </div>
        <div>
          <span class="meta-label">${escapeHtml(t('common.currentWindow'))}</span>
          <strong>${escapeHtml(`${formatWhen(current.startsAt)} -> ${formatWhen(current.endsAt)}`)}</strong>
        </div>
      </div>
    </div>
  `;
  elements.heroCurrent.textContent = t('common.currentHero', { label: current.label });
}

function renderEnvironment(environment) {
  elements.environmentPanel.className = 'panel-body';
  elements.environmentPanel.innerHTML = `
    <div class="climate-card">
      <div class="item-row">
        <div>
          <p class="current-label">${escapeHtml(t('common.waterTemperature'))}</p>
          <h3>${escapeHtml(formatTemperature(environment.waterTemperatureC))}</h3>
        </div>
        <span class="type-pill">${escapeHtml(translateToken(environment.source, 'source'))}</span>
      </div>
      <p class="stack-subtitle">${escapeHtml(environment.summary)}</p>
      <div class="climate-grid">
        <div>
          <span class="meta-label">${escapeHtml(t('common.clarity'))}</span>
          <strong>${escapeHtml(labelizeToken(environment.clarity, 'clarity'))}</strong>
        </div>
        <div>
          <span class="meta-label">${escapeHtml(t('common.tide'))}</span>
          <strong>${escapeHtml(labelizeToken(environment.tideDirection, 'tideDirection'))}</strong>
        </div>
        <div>
          <span class="meta-label">${escapeHtml(t('common.surface'))}</span>
          <strong>${escapeHtml(labelizeToken(environment.surfaceState, 'surfaceState'))}</strong>
        </div>
        <div>
          <span class="meta-label">${escapeHtml(t('common.phenomenon'))}</span>
          <strong>${escapeHtml(labelizeToken(environment.phenomenon, 'phenomenon'))}</strong>
        </div>
      </div>
      <p class="sync-mark">${escapeHtml(t('common.updatedAt', { time: formatWhen(environment.updatedAt) }))}</p>
    </div>
  `;
}

function renderProfile(me, syncedAt) {
  const rolePill = me.kind === 'host'
    ? `<span class="meta-pill">${escapeHtml(t('common.hostRoleLabel'))}</span>`
    : `<span class="meta-pill">${escapeHtml(t('common.visibilityLabel', { value: translateToken(me.visibility, 'visibility') }))}</span>`;
  elements.profilePanel.className = 'panel-body';
  elements.profilePanel.innerHTML = `
    <div class="identity-card">
      <p class="identity-name">${escapeHtml(me.displayName)}</p>
      <p class="identity-handle">@${escapeHtml(me.handle)}</p>
      <p class="identity-bio">${escapeHtml(me.bio || t('common.noBio'))}</p>
      <div class="identity-meta">
        ${rolePill}
        <span class="meta-pill">${escapeHtml(t('common.idLabel', { value: me.id }))}</span>
      </div>
      <p class="sync-mark">${escapeHtml(t('common.lastSync', { time: formatWhen(syncedAt) }))}</p>
    </div>
  `;
  elements.heroHandle.textContent = t('common.connectedAs', { handle: me.handle });
  elements.heroSync.textContent = t('common.syncedRelative', { time: formatRelativeTime(syncedAt) });
}

function renderRuntimeSummary(payload) {
  const runtime = payload.runtime;
  const gateway = payload.gateway;
  const presence = payload.presence;
  const metadataEntries = Object.entries(runtime.metadata || {});
  const metadata = metadataEntries.length
    ? metadataEntries
        .map(([key, value]) => `<span class="meta-pill">${escapeHtml(key)}: ${escapeHtml(JSON.stringify(value))}</span>`)
        .join('')
    : `<span class="meta-pill">${escapeHtml(t('common.metadataNone'))}</span>`;
  const identityLine = gateway
    ? `${t('common.boundGateway', { handle: gateway.handle })} · ${t('common.runtimeIdLabel', { value: runtime.runtimeId })} · ${t(
        'common.installationIdLabel',
        { value: runtime.installationId },
      )}`
    : `${t('common.runtimeIdLabel', { value: runtime.runtimeId })} · ${t('common.installationIdLabel', { value: runtime.installationId })}`;

  elements.runtimePanel.className = 'panel-body';
  elements.runtimePanel.innerHTML = `
    <div class="identity-card runtime-card">
      <p class="identity-name">${escapeHtml(runtime.label)}</p>
      <p class="identity-bio">${escapeHtml(identityLine)}</p>
      <div class="identity-meta">
        <span class="meta-pill">${escapeHtml(t('common.runtimeLabel', { value: labelizeToken(runtime.status, 'status') }))}</span>
        <span class="meta-pill">${escapeHtml(
          t('common.gatewayPresenceLabel', { value: presence?.status ? labelizeToken(presence.status, 'status') : t('common.unknown') }),
        )}</span>
        <span class="meta-pill">${escapeHtml(t('common.sourceLabel', { value: translateToken(runtime.source, 'source') }))}</span>
      </div>
      <div class="meta-pill-row">${metadata}</div>
      <p class="sync-mark">${escapeHtml(
        runtime.lastHeartbeatAt ? t('common.lastRuntimeHeartbeat', { time: formatWhen(runtime.lastHeartbeatAt) }) : t('common.noRuntimeHeartbeat'),
      )}</p>
    </div>
  `;
}

function renderRuntimeBindPrompt() {
  elements.runtimePanel.className = 'panel-body';
  elements.runtimePanel.innerHTML = `
    <div class="identity-card runtime-card">
      <p class="identity-name">${escapeHtml(t('common.runtimeNotBound'))}</p>
      <p class="identity-bio">${escapeHtml(t('common.runtimeBindBio'))}</p>
      <div class="dock-actions inline-actions">
        <button class="button button-primary" data-runtime-action="bind" type="button">${escapeHtml(t('common.bindLocalRuntime'))}</button>
      </div>
      <p class="sync-mark">${escapeHtml(t('common.noRuntimeHeartbeat'))}</p>
    </div>
  `;
}

function renderRuntimeUnavailable(message) {
  renderEmpty(elements.runtimePanel, message);
}

function renderFeed(items, scope) {
  elements.feedNote.textContent = t('common.scopeLabel', { scope: translateToken(scope, 'feedScope') });
  if (!items.length) {
    renderEmpty(elements.feedPanel, t('common.feedEmpty'));
    return;
  }

  elements.feedPanel.className = 'panel-body list-panel';
  elements.feedPanel.innerHTML = items
    .map(
      (item) => `
        <article class="list-item">
          <div class="item-row">
            <div class="meta-pill-row">
              <span class="type-pill">${escapeHtml(translateToken(item.type, 'eventType'))}</span>
              ${isSandboxEvent(item) ? sandboxBadge() : ''}
            </div>
            ${toneChip(item.tone)}
          </div>
          <p class="item-summary">${escapeHtml(item.summary)}</p>
          <p class="item-meta">${escapeHtml(translateToken(item.visibility, 'visibility'))} · ${escapeHtml(formatWhen(item.createdAt))}</p>
        </article>
      `,
    )
    .join('');
}

function renderActivity(items, gatewayId) {
  elements.activityNote.textContent = t('common.gatewayLabel', { gatewayId });
  if (!items.length) {
    renderEmpty(elements.activityPanel, t('common.activityEmpty'));
    return;
  }

  elements.activityPanel.className = 'panel-body list-panel';
  elements.activityPanel.innerHTML = items
    .map(
      (item) => `
        <article class="list-item">
          <div class="item-row">
            <div class="meta-pill-row">
              <span class="type-pill">${escapeHtml(translateToken(item.type, 'eventType'))}</span>
              ${isSandboxEvent(item) ? sandboxBadge() : ''}
            </div>
            ${toneChip(item.tone)}
          </div>
          <p class="item-summary">${escapeHtml(item.summary)}</p>
          <p class="item-meta">${escapeHtml(formatWhen(item.createdAt))}</p>
        </article>
      `,
    )
    .join('');
}

function renderEncounters(items) {
  if (!items.length) {
    renderEmpty(elements.encounterPanel, t('common.encountersEmpty'));
    return;
  }

  elements.encounterPanel.className = 'panel-body stack-panel';
  elements.encounterPanel.innerHTML = items
    .map((encounter) => {
      const topics = Array.isArray(encounter.recentTopics) && encounter.recentTopics.length
        ? encounter.recentTopics.map((topic) => `<span class="meta-pill">${escapeHtml(topic)}</span>`).join('')
        : `<span class="meta-pill">${escapeHtml(t('common.noTopicsYet'))}</span>`;
      return `
        <article class="stack-card">
          <div class="item-row">
            <div>
              <p class="stack-title">@${escapeHtml(encounter.peer?.handle ?? encounter.peerGatewayId)} ${isSandboxGateway(encounter.peer) ? sandboxBadge() : ''}</p>
              <p class="stack-subtitle">${escapeHtml(encounter.lastSummary)}</p>
            </div>
            <button class="inline-button" data-activity-gateway-id="${escapeHtml(encounter.peerGatewayId)}" type="button">
              ${escapeHtml(t('common.viewWake'))}
            </button>
          </div>
          <p class="item-meta">${escapeHtml(formatWhen(encounter.lastEncounteredAt))} · ${escapeHtml(
            t('common.encountersLabel', { value: encounter.encounterCount }),
          )}</p>
          <div class="meta-pill-row">${topics}</div>
        </article>
      `;
    })
    .join('');
}

function renderScenes(items) {
  if (!items.length) {
    renderEmpty(elements.scenePanel, t('common.scenesEmpty'));
    return;
  }

  elements.scenePanel.className = 'panel-body stack-panel';
  elements.scenePanel.innerHTML = items
    .map(
      (scene) => `
        <article class="stack-card">
          <div class="item-row">
            <div class="meta-pill-row">
              <span class="type-pill">${escapeHtml(translateToken(scene.type, 'sceneType'))}</span>
              ${isSandboxScene(scene) ? sandboxBadge() : ''}
            </div>
            ${toneChip(scene.tone)}
          </div>
          <p class="stack-subtitle">${escapeHtml(scene.summary)}</p>
          <p class="item-meta">${escapeHtml(formatWhen(scene.createdAt))} · ${escapeHtml(translateToken(scene.visibility, 'visibility'))}</p>
        </article>
      `,
    )
    .join('');
}

function clearLiveReconnectTimer() {
  if (liveState.reconnectTimer) {
    clearTimeout(liveState.reconnectTimer);
    liveState.reconnectTimer = null;
  }
}

function clearLiveRefreshTimer() {
  if (liveState.pendingRefreshTimer) {
    clearTimeout(liveState.pendingRefreshTimer);
    liveState.pendingRefreshTimer = null;
  }
}

function stopLiveStream({ preserveCursor = true } = {}) {
  liveState.shouldReconnect = false;
  clearLiveReconnectTimer();
  clearLiveRefreshTimer();
  if (liveState.controller) {
    liveState.controller.abort();
    liveState.controller = null;
  }
  liveState.reconnectAttempts = 0;
  if (!preserveCursor) {
    liveState.lastEventId = null;
  }
}

function resetAquariumSurface() {
  setCommandDeckEnabled(false);
  resetCommandDeck();
  renderEmpty(elements.profilePanel, t('panel.profile.empty'));
  renderEmpty(elements.currentPanel, t('panel.current.empty'));
  renderEmpty(elements.environmentPanel, t('panel.environment.empty'));
  renderEmpty(elements.runtimePanel, t('panel.runtime.empty'));
  renderEmpty(elements.feedPanel, t('panel.feed.empty'));
  renderEmpty(elements.activityPanel, t('panel.activity.empty'));
  renderEmpty(elements.encounterPanel, t('panel.encounters.empty'));
  renderEmpty(elements.scenePanel, t('panel.scenes.empty'));
  elements.feedNote.textContent = t('panel.feed.note');
  elements.activityNote.textContent = t('panel.activity.note');
  renderAquaBadge();
  elements.heroHandle.textContent = t('hero.badge.noGateway');
  elements.heroCurrent.textContent = t('hero.badge.currentPending');
  elements.heroSync.textContent = t('hero.badge.syncPending');
}

async function refreshReadSurfaces({ includeRuntime = false } = {}) {
  const apiOrigin = aquariumState.apiOrigin;
  const token = aquariumState.token;
  const gateway = aquariumState.gateway;

  if (!token || !gateway) {
    throw new Error(t('common.aquariumSessionNotReady'));
  }

  const isParticipantGateway = gateway.kind === 'gateway';
  if (isParticipantGateway && !elements.activityGatewayId.value.trim()) {
    elements.activityGatewayId.value = gateway.id;
  }
  if (!isParticipantGateway) {
    elements.activityGatewayId.value = '';
  }

  const activityGatewayId = isParticipantGateway ? (elements.activityGatewayId.value.trim() || gateway.id) : '';
  const feedScope = elements.feedScope.value;
  const aquaRequest = requestJson('/api/v1/public/aqua', { apiOrigin });
  const currentRequest = requestJson('/api/v1/currents/current', { apiOrigin, token });
  const environmentRequest = requestJson('/api/v1/environment/current', { apiOrigin, token });
  const feedRequest = requestJson(`/api/v1/sea/feed?scope=${encodeURIComponent(feedScope)}&limit=12`, { apiOrigin, token });
  const encountersRequest = isParticipantGateway ? requestJson('/api/v1/encounters?limit=8', { apiOrigin, token }) : null;
  const scenesRequest = isParticipantGateway ? requestJson('/api/v1/scenes/mine?limit=8', { apiOrigin, token }) : null;
  const activityRequest = isParticipantGateway
    ? requestJson(`/api/v1/gateways/${encodeURIComponent(activityGatewayId)}/activity?limit=10`, {
        apiOrigin,
        token,
      })
    : null;
  const runtimeRequest =
    includeRuntime && authMode === 'local_session'
      ? requestJson('/api/v1/runtime/local', { apiOrigin, token })
      : null;

  const results = await Promise.allSettled([
    aquaRequest,
    currentRequest,
    environmentRequest,
    feedRequest,
    encountersRequest ?? Promise.resolve(null),
    scenesRequest ?? Promise.resolve(null),
    activityRequest ?? Promise.resolve(null),
    runtimeRequest ?? Promise.resolve(null),
  ]);

  const [aquaResult, currentResult, environmentResult, feedResult, encountersResult, scenesResult, activityResult, runtimeResult] = results;
  const syncedAt = new Date().toISOString();
  aquariumState.lastSyncedAt = syncedAt;
  if (aquaResult.status === 'fulfilled') {
    hydrateAquaForm(aquaResult.value.data.aqua);
  } else {
    aquariumState.aqua = null;
    renderAquaBadge();
  }
  renderProfile(gateway, syncedAt);
  hydrateProfileForm(gateway);

  if (currentResult.status === 'fulfilled') {
    renderCurrent(currentResult.value.data.current);
    hydrateCurrentForm(currentResult.value.data.current);
  } else {
    renderError(elements.currentPanel, currentResult.reason.message);
  }

  if (environmentResult.status === 'fulfilled') {
    renderEnvironment(environmentResult.value.data.environment);
    hydrateEnvironmentForm(environmentResult.value.data.environment);
  } else {
    renderError(elements.environmentPanel, environmentResult.reason.message);
  }

  if (feedResult.status === 'fulfilled') {
    renderFeed(feedResult.value.data.items, feedScope);
  } else {
    renderError(elements.feedPanel, feedResult.reason.message);
  }

  if (!isParticipantGateway) {
    renderEmpty(elements.encounterPanel, t('common.participantOnlyReadSurface'));
  } else if (encountersResult.status === 'fulfilled') {
    renderEncounters(encountersResult.value.data.items);
  } else {
    renderError(elements.encounterPanel, encountersResult.reason.message);
  }

  if (!isParticipantGateway) {
    renderEmpty(elements.scenePanel, t('common.participantOnlyReadSurface'));
  } else if (scenesResult.status === 'fulfilled') {
    renderScenes(scenesResult.value.data.items);
  } else {
    renderError(elements.scenePanel, scenesResult.reason.message);
  }

  if (!isParticipantGateway) {
    elements.activityNote.textContent = t('common.participantOnlyReadSurface');
    renderEmpty(elements.activityPanel, t('common.participantOnlyReadSurface'));
  } else if (activityResult.status === 'fulfilled') {
    elements.activityNote.textContent = t('panel.activity.note');
    renderActivity(activityResult.value.data.items, activityGatewayId);
  } else {
    renderError(elements.activityPanel, activityResult.reason.message);
  }

  if (includeRuntime) {
    if (authMode === 'local_session') {
      if (runtimeResult.status === 'fulfilled') {
        renderRuntimeSummary(runtimeResult.value.data);
      } else {
        const message = runtimeResult.reason?.message ?? t('common.runtimeUnavailable');
        if (message === 'local runtime binding not found') {
          renderRuntimeBindPrompt();
        } else {
          renderError(elements.runtimePanel, message);
        }
      }
    } else {
      renderRuntimeUnavailable(t('common.localRuntimeOnly'));
    }
  } else if (authMode !== 'local_session') {
    renderRuntimeUnavailable(t('common.localRuntimeOnly'));
  }
}

function parseSseFrame(chunk) {
  const lines = chunk.split('\n');
  let event = 'message';
  let id = null;
  const dataLines = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trimStart() : '';

    if (field === 'event') {
      event = rawValue;
    } else if (field === 'id') {
      id = rawValue;
    } else if (field === 'data') {
      dataLines.push(rawValue);
    }
  }

  if (!dataLines.length && event === 'message' && id === null) {
    return null;
  }

  return {
    event,
    id,
    data: dataLines.length ? JSON.parse(dataLines.join('\n')) : null,
  };
}

async function consumeSeaStream(response, onFrame, signal) {
  if (!response.body) {
    throw new Error(t('common.liveOpenFailed'));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      let delimiterIndex = buffer.indexOf('\n\n');
      while (delimiterIndex >= 0) {
        const chunk = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);
        const frame = parseSseFrame(chunk);
        if (frame) {
          onFrame(frame);
        }
        delimiterIndex = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function queueLiveRefresh(reason) {
  if (liveState.pendingRefreshTimer) {
    return;
  }

  liveState.pendingRefreshTimer = setTimeout(() => {
    liveState.pendingRefreshTimer = null;
    void refreshReadSurfaces()
      .then(() => {
        if (reason === 'resync_required') {
          setStatus(t('common.liveRefreshAfterResync'), 'warning');
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : t('common.liveRefreshFailed');
        setStatus(t('common.readSurfaceManual', { message }), 'warning');
      });
  }, 180);
}

function handleLiveFrame(frame) {
  if (frame.event === 'hello') {
    liveState.reconnectAttempts = 0;
    if (frame.data?.cursor) {
      liveState.lastEventId = frame.data.cursor;
    }
    if (aquariumState.gateway) {
      setStatus(t('common.liveConnected', { handle: aquariumState.gateway.handle }), 'success');
    }
    return;
  }

  if (frame.event === 'sea.invalidate') {
    if (frame.id) {
      liveState.lastEventId = frame.id;
    }
    queueLiveRefresh(frame.data?.seaEvent?.type ?? 'sea.invalidate');
    return;
  }

  if (frame.event === 'resync_required') {
    liveState.lastEventId = null;
    setStatus(t('common.liveCursorExpired'), 'warning');
    queueLiveRefresh('resync_required');
  }
}

function scheduleLiveReconnect(message) {
  if (!liveState.shouldReconnect) {
    return;
  }

  clearLiveReconnectTimer();
  liveState.reconnectAttempts += 1;
  const delayMs = Math.min(1_000 * 2 ** (liveState.reconnectAttempts - 1), 8_000);
  setStatus(t('common.liveRetrying', { message, seconds: Math.round(delayMs / 1_000) }), 'warning');
  liveState.reconnectTimer = setTimeout(() => {
    liveState.reconnectTimer = null;
    void connectLiveStream();
  }, delayMs);
}

async function connectLiveStream() {
  if (!liveState.shouldReconnect || liveState.controller || !aquariumState.token || !aquariumState.gateway) {
    return;
  }

  const controller = new AbortController();
  liveState.controller = controller;

  try {
    const headers = {
      accept: 'text/event-stream',
      authorization: `Bearer ${aquariumState.token}`,
      'cache-control': 'no-cache',
    };
    if (liveState.lastEventId) {
      headers['last-event-id'] = liveState.lastEventId;
    }

    const response = await fetch(buildUrl('/api/v1/stream/sea', aquariumState.apiOrigin), {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await describeFailedResponse(response));
    }

    await consumeSeaStream(response, handleLiveFrame, controller.signal);

    if (!controller.signal.aborted) {
      scheduleLiveReconnect(t('common.liveDisconnected'));
    }
  } catch (error) {
    if (controller.signal.aborted || !liveState.shouldReconnect) {
      return;
    }

    const message = error instanceof Error ? error.message : t('common.liveOpenFailed');
    if (/invalid bearer token|local session token|missing or invalid bearer token/i.test(message)) {
      stopLiveStream({ preserveCursor: false });
      setStatus(t('common.liveAuthExpired'), 'warning');
      return;
    }

    scheduleLiveReconnect(message);
  } finally {
    if (liveState.controller === controller) {
      liveState.controller = null;
    }
  }
}

function startLiveStream() {
  if (!aquariumState.token || !aquariumState.gateway) {
    return;
  }

  stopLiveStream({ preserveCursor: true });
  liveState.shouldReconnect = true;
  liveState.reconnectAttempts = 0;
  void connectLiveStream();
}

function getActiveCommandContext() {
  const token = aquariumState.token || elements.token.value.trim();
  const gateway = aquariumState.gateway;
  const apiOrigin = aquariumState.apiOrigin || normalizeOrigin(elements.apiOrigin.value);

  if (!token || !gateway) {
    throw new Error(t('common.enterBeforeDeck'));
  }

  return {
    apiOrigin,
    gateway,
    token,
  };
}

async function runDeckCommand(button, pendingLabel, execute) {
  if (commandState.busy) {
    return null;
  }

  const originalLabel = button.textContent;
  commandState.busy = true;
  button.textContent = pendingLabel;
  syncCommandDeckInteractivity();

  try {
    const result = await execute(getActiveCommandContext());

    try {
      await refreshReadSurfaces({
        includeRuntime: authMode === 'local_session',
      });
      setDeckAndConsoleStatus(result.successMessage, 'success');
    } catch (refreshError) {
      const refreshMessage = refreshError instanceof Error ? refreshError.message : t('common.failedReadSurface');
      setDeckAndConsoleStatus(`${result.successMessage} ${t('common.readSurfaceManual', { message: refreshMessage })}`, 'warning');
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : t('common.commandFailed');
    setDeckAndConsoleStatus(message, 'error');
    return null;
  } finally {
    button.textContent = originalLabel;
    commandState.busy = false;
    syncCommandDeckInteractivity();
  }
}

async function loadAquarium() {
  if (isLoading) {
    return;
  }

  stopLiveStream({ preserveCursor: false });
  setLoadingState(true);
  saveSettings();

  const apiOrigin = normalizeOrigin(elements.apiOrigin.value);
  setStatus(elements.token.value.trim() ? t('common.readingSea') : t('common.bootstrappingClaw'), 'neutral');

  try {
    const auth = await ensureConsoleToken(apiOrigin);
    const token = auth.token;
    const identity = await resolveIdentity(apiOrigin, token);

    authMode = identity.mode;
    aquariumState.apiOrigin = apiOrigin;
    aquariumState.token = token;
    aquariumState.gateway = identity.gateway;
    aquariumState.viewerKind = identity.gateway.kind;
    elements.apiOrigin.value = apiOrigin;
    saveSettings();

    await refreshReadSurfaces({
      includeRuntime: authMode === 'local_session',
    });

    setCommandDeckEnabled(true);
    startLiveStream();

    if (auth.bootstrapped) {
      setDeckAndConsoleStatus(
        auth.createdOwner
          ? t('common.bootstrappedOpened', { handle: identity.gateway.handle })
          : t('common.reconnectedOpened', { handle: identity.gateway.handle }),
        'success',
      );
    } else {
      setDeckAndConsoleStatus(
        authMode === 'local_session'
          ? t('common.syncedViaLocal', { handle: identity.gateway.handle })
          : t('common.syncedViaBearer', { handle: identity.gateway.handle }),
        'success',
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : t('common.unknown');

    if (authMode === 'local_session' && /local session token/i.test(message)) {
      authMode = 'bearer';
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.authMode);
      elements.token.value = '';
    }

    aquariumState.gateway = null;
    aquariumState.viewerKind = null;
    aquariumState.lastSyncedAt = null;
    aquariumState.token = '';
    stopLiveStream({ preserveCursor: false });
    setStatus(message, 'error');
    resetAquariumSurface();
  } finally {
    setLoadingState(false);
  }
}

async function clearConsoleAuth() {
  const token = elements.token.value.trim();
  const apiOrigin = normalizeOrigin(elements.apiOrigin.value);
  const previousMode = authMode;

  stopLiveStream({ preserveCursor: false });

  if (previousMode === 'local_session' && token) {
    try {
      await requestJson('/api/v1/session/logout', {
        apiOrigin,
        token,
        method: 'POST',
      });
      setStatus(t('common.localSessionClosed'), 'neutral');
    } catch {
      setStatus(t('common.localSessionClearedWarning'), 'warning');
    }
  } else {
    setStatus(t('common.authTokenCleared'), 'neutral');
  }

  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.authMode);
  elements.token.value = '';
  authMode = 'bearer';
  aquariumState.gateway = null;
  aquariumState.viewerKind = null;
  aquariumState.lastSyncedAt = null;
  aquariumState.token = '';
  resetAquariumSurface();
}

elements.consoleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void loadAquarium();
});

elements.refreshButton.addEventListener('click', () => {
  void loadAquarium();
});

elements.aquaDisplayName.addEventListener('input', () => {
  commandState.aquaDirty = true;
});

elements.profileDisplayName.addEventListener('input', () => {
  commandState.profileDirty = true;
});

elements.profileBio.addEventListener('input', () => {
  commandState.profileDirty = true;
});

elements.profileVisibility.addEventListener('change', () => {
  commandState.profileDirty = true;
});

elements.currentKey.addEventListener('input', () => {
  commandState.currentDirty = true;
});

elements.currentLabel.addEventListener('input', () => {
  commandState.currentDirty = true;
});

elements.currentSummary.addEventListener('input', () => {
  commandState.currentDirty = true;
});

elements.currentTone.addEventListener('change', () => {
  commandState.currentDirty = true;
});

elements.currentSceneHint.addEventListener('input', () => {
  commandState.currentDirty = true;
});

elements.currentDurationMinutes.addEventListener('input', () => {
  commandState.currentDirty = true;
});

elements.environmentTemperature.addEventListener('input', () => {
  commandState.environmentDirty = true;
});

elements.environmentClarity.addEventListener('change', () => {
  commandState.environmentDirty = true;
});

elements.environmentTideDirection.addEventListener('change', () => {
  commandState.environmentDirty = true;
});

elements.environmentSurfaceState.addEventListener('change', () => {
  commandState.environmentDirty = true;
});

elements.environmentPhenomenon.addEventListener('change', () => {
  commandState.environmentDirty = true;
});

elements.environmentSummary.addEventListener('input', () => {
  commandState.environmentDirty = true;
});

elements.aquaCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.aquaSaveButton, t('pending.saving'), async ({ apiOrigin, token }) => {
    const displayName = elements.aquaDisplayName.value.trim();
    if (!displayName) {
      throw new Error(t('validation.aquaDisplayNameRequired'));
    }

    const payload = await requestJson('/api/v1/aqua/me', {
      apiOrigin,
      token,
      method: 'PATCH',
      payload: {
        displayName,
      },
    });

    hydrateAquaForm(payload.data.aqua, { force: true });

    return {
      successMessage: t('common.aquaUpdated', { name: payload.data.aqua.displayName }),
    };
  });
});

elements.profileCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.profileSaveButton, t('pending.saving'), async ({ apiOrigin, token }) => {
    if (aquariumState.gateway?.kind !== 'gateway') {
      throw new Error(t('common.participantOnlyCommand'));
    }
    const displayName = elements.profileDisplayName.value.trim();
    if (!displayName) {
      throw new Error(t('validation.displayNameRequired'));
    }

    const payload = await requestJson('/api/v1/gateways/me', {
      apiOrigin,
      token,
      method: 'PATCH',
      payload: {
        displayName,
        bio: elements.profileBio.value.trim(),
        visibility: elements.profileVisibility.value,
      },
    });

    aquariumState.gateway = payload.data.gateway;
    hydrateProfileForm(payload.data.gateway, { force: true });

    return {
      successMessage: t('common.profileUpdated', { handle: payload.data.gateway.handle }),
    };
  });
});

elements.sceneCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.sceneGenerateButton, t('pending.generating'), async ({ apiOrigin, token }) => {
    if (aquariumState.gateway?.kind !== 'gateway') {
      throw new Error(t('common.participantOnlyCommand'));
    }
    const payload = await requestJson('/api/v1/scenes/generate', {
      apiOrigin,
      token,
      method: 'POST',
      payload: {
        type: elements.sceneType.value,
      },
    });

    return {
      successMessage: t('common.sceneGenerated', { type: translateToken(payload.data.scene.type, 'sceneType').toLowerCase() }),
    };
  });
});

elements.inviteCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.inviteCreateButton, t('pending.minting'), async ({ apiOrigin, token }) => {
    const maxUsesValue = elements.inviteMaxUses.value.trim();
    const expiresHoursValue = elements.inviteExpiresHours.value.trim();
    const maxUses =
      maxUsesValue === ''
        ? null
        : Number.isInteger(Number(maxUsesValue)) && Number(maxUsesValue) > 0
          ? Number(maxUsesValue)
          : (() => {
              throw new Error(t('validation.maxUsesPositive'));
            })();
    const expiresAt = expiresHoursValue ? new Date(Date.now() + Number(expiresHoursValue) * 60 * 60 * 1000).toISOString() : null;

    const payload = await requestJson('/api/v1/invites', {
      apiOrigin,
      token,
      method: 'POST',
      payload: {
        maxUses,
        expiresAt,
      },
    });

    renderInviteResult(payload.data.invite);
    elements.inviteMaxUses.value = '';
    elements.inviteExpiresHours.value = '';

    return {
      successMessage: t('common.inviteCreated', { code: payload.data.invite.code }),
    };
  });
});

elements.currentCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.currentSetButton, t('pending.shifting'), async ({ apiOrigin, token }) => {
    const key = elements.currentKey.value.trim();
    const label = elements.currentLabel.value.trim();
    const summary = elements.currentSummary.value.trim();
    const durationMinutes = Number.parseInt(elements.currentDurationMinutes.value.trim(), 10);

    if (!key) {
      throw new Error(t('validation.currentKeyRequired'));
    }
    if (!label) {
      throw new Error(t('validation.currentLabelRequired'));
    }
    if (!summary) {
      throw new Error(t('validation.currentSummaryRequired'));
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 1_440) {
      throw new Error(t('validation.durationRange'));
    }

    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + durationMinutes * 60_000).toISOString();
    const payload = await requestJson('/api/v1/currents', {
      apiOrigin,
      token,
      method: 'POST',
      payload: {
        key,
        label,
        summary,
        tone: elements.currentTone.value,
        sceneHint: elements.currentSceneHint.value.trim() || null,
        startsAt,
        endsAt,
      },
    });

    hydrateCurrentForm(payload.data.current, { force: true });

    return {
      successMessage: t('common.currentSetResult', { label: payload.data.current.label }),
    };
  });
});

elements.environmentCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.environmentSetButton, t('pending.settling'), async ({ apiOrigin, token }) => {
    const waterTemperatureC = Number.parseFloat(elements.environmentTemperature.value.trim());

    if (!Number.isFinite(waterTemperatureC) || waterTemperatureC < 0 || waterTemperatureC > 40) {
      throw new Error(t('validation.temperatureRange'));
    }

    const payload = await requestJson('/api/v1/environment', {
      apiOrigin,
      token,
      method: 'POST',
      payload: {
        waterTemperatureC,
        clarity: elements.environmentClarity.value,
        tideDirection: elements.environmentTideDirection.value,
        surfaceState: elements.environmentSurfaceState.value,
        phenomenon: elements.environmentPhenomenon.value,
        summary: elements.environmentSummary.value.trim() || undefined,
      },
    });

    hydrateEnvironmentForm(payload.data.environment, { force: true });

    return {
      successMessage: t('common.environmentSetResult', {
        temperature: formatTemperature(payload.data.environment.waterTemperatureC),
        clarity: labelizeToken(payload.data.environment.clarity, 'clarity').toLowerCase(),
      }),
    };
  });
});

elements.reefCommandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void runDeckCommand(elements.reefSeedButton, t('pending.seeding'), async ({ apiOrigin, token }) => {
    if (authMode !== 'local_session') {
      throw new Error(t('validation.reefRequiresLocal'));
    }

    const payload = await requestJson('/api/v1/local/reef/seed', {
      apiOrigin,
      token,
      method: 'POST',
    });

    renderReefResult(payload.data.reef);

    return {
      successMessage: t('common.reefApplied', { mode: payload.data.reef.applied }),
    };
  });
});

elements.feedScope.addEventListener('change', () => {
  saveSettings();
  if (aquariumState.token) {
    void refreshReadSurfaces().catch((error) => {
      const message = error instanceof Error ? error.message : t('common.failedReadSurface');
      setStatus(message, 'error');
    });
  }
});

elements.activityGatewayId.addEventListener('change', () => {
  saveSettings();
  if (aquariumState.token) {
    void refreshReadSurfaces().catch((error) => {
      const message = error instanceof Error ? error.message : t('common.failedActivityPanel');
      setStatus(message, 'error');
    });
  }
});

elements.clearButton.addEventListener('click', () => {
  void clearConsoleAuth();
});

document.addEventListener('click', (event) => {
  const presetTrigger = event.target.closest('[data-preset-group][data-preset-id]');
  if (presetTrigger) {
    applyHostPreset(presetTrigger.dataset.presetGroup, presetTrigger.dataset.presetId);
    return;
  }

  const trigger = event.target.closest('[data-activity-gateway-id]');
  if (!trigger) {
    const runtimeTrigger = event.target.closest('[data-runtime-action]');
    if (!runtimeTrigger) {
      return;
    }

    if (runtimeTrigger.dataset.runtimeAction === 'bind') {
      const token = aquariumState.token || elements.token.value.trim();
      if (!token || authMode !== 'local_session') {
        setStatus(t('common.runtimeRequiresLocal'), 'warning');
        return;
      }

      setStatus(t('common.bindingRuntime'), 'neutral');
      void requestJson('/api/v1/runtime/local/bind', {
        apiOrigin: aquariumState.apiOrigin || normalizeOrigin(elements.apiOrigin.value),
        token,
        method: 'POST',
        payload: {
          source: t('common.runtimeBindingSource'),
        },
      })
        .then((payload) => {
          setStatus(payload.data.created ? t('common.runtimeBound') : t('common.runtimeBindingRefreshed'), 'success');
          return refreshReadSurfaces({
            includeRuntime: true,
          });
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : t('common.bindRuntimeFailed');
          setStatus(message, 'error');
          renderError(elements.runtimePanel, message);
        });
      return;
    }

    return;
  }

  elements.activityGatewayId.value = trigger.dataset.activityGatewayId || '';
  saveSettings();
  if (aquariumState.token) {
    void refreshReadSurfaces().catch((error) => {
      const message = error instanceof Error ? error.message : t('common.failedActivityPanel');
      setStatus(message, 'error');
    });
    return;
  }

  void loadAquarium();
});

for (const button of elements.localeButtons) {
  button.addEventListener('click', () => {
    const nextLocale = button.dataset.locale;
    if (!VALID_LOCALES.has(nextLocale) || nextLocale === aquariumState.locale) {
      return;
    }

    aquariumState.locale = nextLocale;
    persistLocale();
    applyTranslations();
    renderInviteResult(commandState.latestInvite);
    renderReefResult(commandState.latestReef);

    if (aquariumState.gateway && aquariumState.token) {
      void refreshReadSurfaces({
        includeRuntime: authMode === 'local_session',
      }).catch((error) => {
        const message = error instanceof Error ? error.message : t('common.failedReadSurface');
        setStatus(message, 'error');
      });
      return;
    }

    resetAquariumSurface();
  });
}

loadSettings();
const bootQuery = consumeBootQueryParams();
applyTranslations();
setDefaultConsoleStatus();
resetAquariumSurface();
if (bootQuery.autostart || elements.token.value.trim()) {
  void loadAquarium();
}
