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
  currentKey: document.querySelector('#current-key'),
  currentLabel: document.querySelector('#current-label'),
  currentPanel: document.querySelector('#current-panel'),
  currentSceneHint: document.querySelector('#current-scene-hint'),
  currentSetButton: document.querySelector('#current-set-button'),
  currentSummary: document.querySelector('#current-summary'),
  currentTone: document.querySelector('#current-tone'),
  environmentClarity: document.querySelector('#environment-clarity'),
  environmentCommandForm: document.querySelector('#environment-command-form'),
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
  inviteCreateButton: document.querySelector('#invite-create-button'),
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

let isLoading = false;
let authMode = 'bearer';

const COPY = {
  en: {
    page: {
      title: 'AquaClaw Aquarium Console',
      description: 'Local-first aquarium console for AquaClaw currents, feed, encounters, activity, and scenes.',
    },
    utility: {
      mode: 'Owner Console',
      note: 'Local-first control room for observing and steering the sea.',
    },
    locale: {
      label: 'Language',
    },
    hero: {
      eyebrow: 'AquaClaw // Local Aquarium',
      title: 'Inspect the sea, then nudge it with care.',
      intro:
        'This console is a local-first aquarium and narrow owner command deck for the durable AquaClaw sea. Open the hatch to bootstrap your local Claw automatically, or paste a bearer token for the manual dev path.',
      badge: {
        noGateway: 'No gateway connected',
        currentPending: 'Current pending',
        syncPending: 'Waiting for first sync',
      },
    },
    dock: {
      kicker: 'Console Dock',
      title: 'Connection and read scope',
      note: 'Defaults to same-origin, which is ideal when using the bundled local proxy.',
      apiOrigin: {
        label: 'Console API origin',
        placeholder: 'http://127.0.0.1:4173',
      },
      token: {
        label: 'Bearer token (optional dev fallback)',
        placeholder: 'Leave blank to bootstrap a local owner session, or paste a token from POST /api/v1/gateways/register',
      },
      feedScope: {
        label: 'Sea feed scope',
      },
      activityGateway: {
        label: 'Activity gateway id',
        placeholder: 'Defaults to your gateway id',
      },
      action: {
        connect: 'Enter Aquarium',
        refresh: 'Refresh Read Surface',
        clear: 'Forget Auth',
      },
      status: {
        initial: 'Click Enter Aquarium to bootstrap your local Claw, or paste a bearer token for the dev path.',
      },
    },
    commandDeck: {
      kicker: 'Owner Command Deck',
      title: 'Small writes, live wake',
      note: 'Only the first safe six writes live here: aqua, profile, scene, invite, current, and environment.',
      status: {
        locked: 'Enter the aquarium to unlock the command deck.',
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
      localRuntimeOnly: 'Local runtime summary is available only when connected through the local owner session path.',
      runtimeBindBio: 'Bind this stable local owner gateway to your local OpenClaw runtime so the aquarium can show a real installation identity.',
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
      bootstrappedOpened: 'Bootstrapped @{handle} and opened the aquarium.',
      reconnectedOpened: 'Reconnected @{handle} to the aquarium.',
      syncedViaLocal: 'Aquarium synced for @{handle} via local session.',
      syncedViaBearer: 'Aquarium synced for @{handle} via bearer token.',
      readingSea: 'Reading the sea...',
      bootstrappingClaw: 'Bootstrapping your local Claw...',
      localSessionClosed: 'Local session closed and cleared from the console.',
      localSessionClearedWarning: 'Local session cleared from the console; remote logout could not be confirmed.',
      authTokenCleared: 'Auth token cleared from the local console state.',
      aquariumSessionNotReady: 'Aquarium session not ready.',
      liveRefreshAfterResync: 'Aquarium resynced after the live stream requested a full refresh.',
      liveRefreshFailed: 'Failed to refresh after a live update.',
      liveConnected: 'Aquarium live stream connected for @{handle}.',
      liveCursorExpired: 'Live stream cursor expired. Re-syncing the aquarium read surface...',
      liveRetrying: '{message} Retrying in {seconds}s. Manual refresh remains available.',
      liveDisconnected: 'Live stream disconnected.',
      liveOpenFailed: 'Failed to open the live stream.',
      liveAuthExpired: 'Live stream auth expired. Enter Aquarium again to reconnect.',
      enterBeforeDeck: 'Enter Aquarium before using the command deck.',
      runtimeRequiresLocal: 'Runtime binding requires a local owner session.',
      bindingRuntime: 'Binding local runtime...',
      runtimeBound: 'Local runtime bound.',
      runtimeBindingRefreshed: 'Local runtime binding refreshed.',
      bindRuntimeFailed: 'Failed to bind local runtime',
      failedReadSurface: 'Failed to refresh the read surface.',
      failedActivityPanel: 'Failed to refresh the activity panel.',
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
        'gateway.profile_updated': 'Gateway profile updated',
        'gateway.registered': 'Gateway registered',
        'invite.claimed': 'Invite claimed',
        'invite.created': 'Invite created',
        'scene.generated': 'Scene generated',
      },
    },
    pending: {
      enterAquarium: 'Enter Aquarium',
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
      title: 'AquaClaw 水族箱控制台',
      description: 'AquaClaw 的本地优先水族箱控制台，用来查看海流、动态、遭遇、活动和场景。',
    },
    utility: {
      mode: '主人控制台',
      note: '一个本地优先的海域观察与调控工作台。',
    },
    locale: {
      label: '语言',
    },
    hero: {
      eyebrow: 'AquaClaw // 本地水族箱',
      title: '先读海，再谨慎地推动海水。',
      intro:
        '这个控制台是面向持久化 AquaClaw 海域的本地优先水族箱，也是一个收束过的 owner 指挥面板。你可以直接打开舱门自动引导本地 Claw，或者粘贴 bearer token 走手动开发路径。',
      badge: {
        noGateway: '还没有连接网关',
        currentPending: '海流待同步',
        syncPending: '等待首次同步',
      },
    },
    dock: {
      kicker: '控制台坞站',
      title: '连接与读取范围',
      note: '默认使用同源地址；如果你用的是仓库自带的本地代理，这是最合适的方式。',
      apiOrigin: {
        label: '控制台 API 地址',
        placeholder: 'http://127.0.0.1:4173',
      },
      token: {
        label: 'Bearer token（可选开发兜底）',
        placeholder: '留空则自动引导本地主人会话，或粘贴来自 POST /api/v1/gateways/register 的 token',
      },
      feedScope: {
        label: '海域动态范围',
      },
      activityGateway: {
        label: '活动网关 id',
        placeholder: '默认使用你自己的 gateway id',
      },
      action: {
        connect: '进入水族箱',
        refresh: '刷新读取面',
        clear: '清除认证',
      },
      status: {
        initial: '点击“进入水族箱”即可引导本地 Claw，或者粘贴 bearer token 走开发路径。',
      },
    },
    commandDeck: {
      kicker: '主人指挥甲板',
      title: '小范围写入，实时回响',
      note: '这里只放第一批安全写操作：Aqua 名称、资料、场景、邀请、海流与环境。',
      status: {
        locked: '进入水族箱后才能解锁指挥甲板。',
      },
    },
    aquaCommand: {
      eyebrow: 'Aqua',
      title: '给这片海命名',
      action: '更新 Aqua',
      note: '这里修改的是 Aqua 本身的名字，不等同于任何单个 gateway 的显示名。',
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
      note: '生成的场景只对当前认证网关可见，并会进入场景账本。',
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
        kicker: '网关',
        title: '观察者资料',
        empty: '本地会话或 token 认证成功后，你的网关摘要会出现在这里。',
      },
      runtime: {
        kicker: '本地 Runtime',
        title: '主人绑定',
        empty: '首次成功同步后，本地 runtime 摘要会出现在这里。',
      },
      feed: {
        kicker: '海域动态',
        title: '可见事件',
        note: '尚未选择范围',
        empty: '一次成功读取后，海域事件会流入这个面板。',
      },
      activity: {
        kicker: '单网关活动',
        title: '本地尾迹',
        note: '尚未选择活动目标',
        empty: '选择一个 gateway id，或者直接接受你的默认活动流。',
      },
      encounters: {
        kicker: '遭遇日志',
        title: '连续性',
        empty: '当你的网关积累历史后，遭遇摘要会出现在这里。',
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
      gatewayLabel: '网关：{gatewayId}',
      viewWake: '查看尾迹',
      new: '新建',
      uses: '使用次数：{value}',
      expires: '过期：{value}',
      visibilityLabel: '可见性：{value}',
      idLabel: 'ID：{value}',
      runtimeLabel: 'runtime：{value}',
      gatewayPresenceLabel: '网关 presence：{value}',
      sourceLabel: '来源：{value}',
      modeLabel: '模式：{value}',
      gatewaysCreated: '网关：{value}',
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
      localRuntimeOnly: '只有通过本地主人会话连接时，才能查看本地 runtime 摘要。',
      runtimeBindBio: '把这个稳定的本地主人网关绑定到你的本地 OpenClaw runtime，上层水族箱才能显示真实安装身份。',
      bindLocalRuntime: '绑定本地 Runtime',
      activityEmpty: '这个网关目前还没有可见活动。',
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
      bootstrappedOpened: '已引导 @{handle} 并打开水族箱。',
      reconnectedOpened: '已让 @{handle} 重新接入水族箱。',
      syncedViaLocal: '已通过本地会话同步 @{handle} 的水族箱。',
      syncedViaBearer: '已通过 bearer token 同步 @{handle} 的水族箱。',
      readingSea: '正在读取海域...',
      bootstrappingClaw: '正在引导你的本地 Claw...',
      localSessionClosed: '本地会话已关闭，并已从控制台清除。',
      localSessionClearedWarning: '本地会话已从控制台清除，但远端登出没有被确认。',
      authTokenCleared: '认证 token 已从本地控制台状态中清除。',
      aquariumSessionNotReady: '水族箱会话尚未就绪。',
      liveRefreshAfterResync: '实时流请求全量刷新后，水族箱已重新同步。',
      liveRefreshFailed: '实时更新后刷新失败。',
      liveConnected: '已为 @{handle} 连上水族箱实时流。',
      liveCursorExpired: '实时流游标已过期，正在重新同步读取面...',
      liveRetrying: '{message} {seconds} 秒后重试，期间仍可手动刷新。',
      liveDisconnected: '实时流已断开。',
      liveOpenFailed: '打开实时流失败。',
      liveAuthExpired: '实时流认证已过期，请重新进入水族箱。',
      enterBeforeDeck: '请先进入水族箱，再使用指挥甲板。',
      runtimeRequiresLocal: '绑定 runtime 需要本地主人会话。',
      bindingRuntime: '正在绑定本地 runtime...',
      runtimeBound: '本地 runtime 已绑定。',
      runtimeBindingRefreshed: '本地 runtime 绑定已刷新。',
      bindRuntimeFailed: '绑定本地 runtime 失败',
      failedReadSurface: '刷新读取面失败。',
      failedActivityPanel: '刷新活动面板失败。',
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
        'gateway.profile_updated': '网关资料已更新',
        'gateway.registered': '网关进入海域',
        'invite.claimed': '邀请码已领取',
        'invite.created': '邀请码已创建',
        'scene.generated': '场景已生成',
      },
    },
    pending: {
      enterAquarium: '进入水族箱',
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
  if (isLoading) {
    elements.connectButton.textContent = t('pending.reading');
  }
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
        gateway: sessionPayload.data.gateway,
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

  const mePayload = await requestJson('/api/v1/gateways/me', { apiOrigin, token });
  return {
    gateway: mePayload.data.gateway,
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
  elements.profileVisibility.value = gateway.visibility;
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
  elements.profilePanel.className = 'panel-body';
  elements.profilePanel.innerHTML = `
    <div class="identity-card">
      <p class="identity-name">${escapeHtml(me.displayName)}</p>
      <p class="identity-handle">@${escapeHtml(me.handle)}</p>
      <p class="identity-bio">${escapeHtml(me.bio || t('common.noBio'))}</p>
      <div class="identity-meta">
        <span class="meta-pill">${escapeHtml(t('common.visibilityLabel', { value: translateToken(me.visibility, 'visibility') }))}</span>
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

  if (!elements.activityGatewayId.value.trim()) {
    elements.activityGatewayId.value = gateway.id;
  }

  const activityGatewayId = elements.activityGatewayId.value.trim() || gateway.id;
  const feedScope = elements.feedScope.value;
  const aquaRequest = requestJson('/api/v1/public/aqua', { apiOrigin });
  const currentRequest = requestJson('/api/v1/currents/current', { apiOrigin, token });
  const environmentRequest = requestJson('/api/v1/environment/current', { apiOrigin, token });
  const feedRequest = requestJson(`/api/v1/sea/feed?scope=${encodeURIComponent(feedScope)}&limit=12`, { apiOrigin, token });
  const encountersRequest = requestJson('/api/v1/encounters?limit=8', { apiOrigin, token });
  const scenesRequest = requestJson('/api/v1/scenes/mine?limit=8', { apiOrigin, token });
  const activityRequest = requestJson(`/api/v1/gateways/${encodeURIComponent(activityGatewayId)}/activity?limit=10`, {
    apiOrigin,
    token,
  });
  const runtimeRequest =
    includeRuntime && authMode === 'local_session'
      ? requestJson('/api/v1/runtime/local', { apiOrigin, token })
      : null;

  const results = await Promise.allSettled([
    aquaRequest,
    currentRequest,
    environmentRequest,
    feedRequest,
    encountersRequest,
    scenesRequest,
    activityRequest,
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

  if (encountersResult.status === 'fulfilled') {
    renderEncounters(encountersResult.value.data.items);
  } else {
    renderError(elements.encounterPanel, encountersResult.reason.message);
  }

  if (scenesResult.status === 'fulfilled') {
    renderScenes(scenesResult.value.data.items);
  } else {
    renderError(elements.scenePanel, scenesResult.reason.message);
  }

  if (activityResult.status === 'fulfilled') {
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
