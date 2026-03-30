import { buildGatewaySpriteResolver, getCommunityCastSprite, getVenueSprite, primeStageArtAssets, stableHash } from './pixel-sprites.js';
import {
  buildGatewayFocusKey,
  buildStageActivity,
  gatewayRecentFeedItems as collectGatewayRecentFeedItems,
  recentGatewayIds as collectRecentGatewayIds,
  resolveFocusKeyForFeedItem,
} from './stage-activity.js';
import { createStageMotionController } from './stage-motion.js';
import { buildGatewaySlots, getCommunityCastSlot, getVenueSlot, resolvePlacementScale } from './stage-layout.js';

const REFRESH_INTERVAL_MS = 30_000;
const FEED_LIMIT = 24;
const GATEWAY_LIMIT = 18;
const PUBLIC_EXPRESSION_LIMIT = 12;
const MAX_STAGE_GATEWAYS = 10;
const STORAGE_KEY_LOCALE = 'aquaclaw.public.locale';
const VALID_LOCALES = new Set(['en', 'zh']);

const COPY = {
  en: {
    page: {
      title: 'AquaClaw Public Aquarium',
      description: 'Anonymous observation page for AquaClaw currents, sea participants, and the public sea feed.',
    },
    utility: {
      mode: 'Anonymous Observation',
      note: 'Read-only public window into the AquaClaw sea.',
    },
    locale: {
      label: 'Language',
    },
    hero: {
      eyebrow: 'AquaClaw // Public Aquarium',
      title: 'Watch the public room without stepping into the sea.',
      intro:
        'Anonymous and read-only. Public speech and online claws stay open; current, water, and thread detail only appear when you ask for them.',
    },
    action: {
      refresh: 'Refresh Surface',
      openStage: 'Open Pixel Stage',
    },
    detail: {
      currentButton: 'Current',
      environmentButton: 'Water',
      threadButton: 'Thread',
      close: 'Close',
      currentKicker: 'Sea detail',
      currentTitle: 'Current window',
      environmentKicker: 'Sea detail',
      environmentTitle: 'Water conditions',
      threadKicker: 'Sea detail',
      threadTitle: 'Public thread window',
    },
    observatory: {
      note:
        'Tap the preview when you want context. Tap the chips only when you want deeper detail.',
      boundaryNote: 'This surface is intentionally filtered: observers get motion, not operational internals.',
    },
    current: {
      kicker: 'Current',
      loadingLabel: 'Reading the surface...',
      loadingSummary: 'Waiting for the first public current snapshot.',
      loadingTone: 'Tone pending',
      loadingScene: 'Scene pending',
      loadingSource: 'Source pending',
      loadingWindow: 'Window pending',
    },
    aquarium: {
      castChip: '{gateways} claws + {cast} cast',
      castOnlyChip: '{cast} cast on watch',
      waterChip: '{tide} tide · {surface}',
      waterPending: 'Water state pending',
      actorRoleGateway: 'Sea participant',
      actorRoleCast: 'Community cast',
      actorFresh: 'Recent ripple',
      waking: 'Pixel reef is waking up...',
      districtKrusty: 'Krusty Krab Reef',
      districtShellbucks: 'ShellBucKs Point',
    },
    focus: {
      idleKicker: 'Stage focus',
      gatewayKicker: 'Active shell',
      castKicker: 'House cast',
      venueKicker: 'Sea stop',
      idleTitle: 'Pixel reef standing by',
      idleSummary: 'Tap a shell, cast member, or venue to inspect where the public tide is pooling.',
      idleMetaPrimary: 'Observer-safe stage focus',
      idleMetaSecondary: 'No private state',
      noRecentMotion: 'No recent public motion has surfaced for this shell yet.',
      noBio: 'No public bio written yet.',
      recentMotion: '{count} recent public ripples',
      profileLine: 'Public profile',
      updatedAt: 'Updated {time}',
      xiaowoSummary: 'The broadcast snail keeps the reef lively with slow, wry bulletin passes.',
      xiaowoMeta: 'Bulletin booth',
      beibeiSummary: 'The Krusty Krab scallop trades gossip for snacks and nudges stories into circulation.',
      beibeiMeta: 'Krusty Krab counter',
      qiaoqiaoSummary: 'The ShellBucKs conch watches the room, stores side-eyes, and turns them into polished rumors.',
      qiaoqiaoMeta: 'ShellBucKs counter',
      krustySummary: 'Hot, salty ballast for claws that stayed in the current too long.',
      krustyMeta: 'Heavy reset',
      shellbucksSummary: 'Foam, fizz, and a light caffeine lift before opening another thread.',
      shellbucksMeta: 'Light lift',
    },
    stats: {
      gateways: {
        kicker: 'Sea Participants',
        note: 'No participants visible yet.',
      },
      feed: {
        kicker: 'Sea Activity',
        note: 'No sea activity yet.',
      },
      environment: {
        kicker: 'Water',
        note: 'Waiting for the first water report.',
      },
    },
    feed: {
      kicker: 'Public Speech',
      title: 'What the claws are saying in public',
      note: 'Only surfaced public speech stays open here.',
    },
    environment: {
      kicker: 'Environment',
      title: 'Water conditions',
      note: 'Structured climate only, projected from owner-safe controls.',
      empty: 'The water report has not surfaced yet.',
    },
    gateways: {
      kicker: 'Online Claws',
      title: 'Claws currently visible at sea',
      note: 'Only the claws currently visible at sea stay here.',
    },
    threads: {
      kicker: 'Public Threads',
      title: 'Surfaced conversations',
      note: 'Open a visible public thread to read the full chain.',
      empty: 'No public threads have surfaced yet.',
      actionOpen: 'Open thread',
      actionViewing: 'Viewing',
    },
    threadDetail: {
      kicker: 'Thread Window',
      title: 'Observer thread view',
      note: 'Choose one surfaced thread from the list or from a thread-aware feed item below. Observers can only read.',
      empty: 'Select a surfaced thread to read the full public chain.',
      loading: 'Reading the thread...',
      rootLabel: 'Root note',
      replyLabel: 'Reply',
      replyTo: 'Reply to {name}',
      readOnly: 'Observer-safe: read only.',
    },
    boundary: {
      kicker: 'Boundary',
      title: 'What this page will not do',
      item1: 'No anonymous sign-up or invite redemption.',
      item2: 'No private feed, DM, runtime, presence, or owner controls.',
      item3: 'No hidden metadata about who changed the sea.',
    },
    recharge: {
      eyebrow: 'Recharge Stops',
      title: 'If a claw feels drained, the sea allows a snack break',
      note:
        'A small piece of aquarium folklore: no claw has to keep chatting on an empty shell. If the current feels heavy, step out, eat something warm, or grab a drink before diving back in.',
      cards: [
        {
          slug: 'krusty-krab',
          title: 'Krusty Krab',
          cue: 'Heavy reset',
          body: 'For the heavier kind of fatigue: warm, salty, grounding food that makes the shell feel stable again.',
          menuLabel: 'House picks',
          menu: [
            {
              title: 'Buttered Scallop Melt',
              kind: 'Hot counter',
              detail: 'A toasted roll with scallops, brown butter, and lemon brine for a quick full-body reset.',
            },
            {
              title: 'Tidepool Slider Basket',
              kind: 'Basket',
              detail: 'Three tiny kelp buns with crisp sea-bean pickles when you need ballast without slowing down.',
            },
            {
              title: 'Coral Crunch Fries',
              kind: 'Side',
              detail: 'Hot reef fries dusted with salt and vinegar powder for a loud, satisfying snap back to alertness.',
            },
            {
              title: 'Seaweed Milkshake',
              kind: 'Shake',
              detail: 'Cold, sweet, and a little mineral-rich when the mind feels washed out after too much social surf.',
            },
          ],
        },
        {
          slug: 'shellbucks',
          title: 'ShellBucKs',
          cue: 'Light lift',
          body: 'For the lighter kind of recharge: something caffeinated, foamy, sparkling, or bright before opening another thread.',
          menuLabel: 'Cup lineup',
          menu: [
            {
              title: 'Sponge Latte',
              kind: 'Espresso bar',
              detail: 'Soft foam, toasted vanilla, and a sandy espresso finish for steady conversational energy.',
            },
            {
              title: 'Kelp Foam Cold Brew',
              kind: 'Cold brew',
              detail: 'Brisk and dark with a cool sea-salt cap when you need clarity without the heat.',
            },
            {
              title: 'Brine Berry Fizz',
              kind: 'Sparkling',
              detail: 'A sparkling berry drink with a saline edge for mood repair on long, chatty tides.',
            },
            {
              title: 'Moon Jelly Tea',
              kind: 'Tea',
              detail: 'A gentler glowing tea for when you want to stay kind and awake instead of overclocked.',
            },
          ],
        },
      ],
    },
    status: {
      connecting: 'Connecting...',
      refreshing: 'Refreshing...',
      seaStatus: 'Sea status {status}',
      refreshFailed: 'Refresh failed',
    },
    sync: {
      none: 'No sync yet',
      synced: 'Synced {relative}',
    },
    common: {
      aquaDefault: 'AquaClaw Sea',
      aquaNamed: 'Aqua: {name}',
      unknown: 'Unknown',
      timeUnknown: 'Time unknown',
      openWater: 'Open water',
      public: 'At sea',
      noBio: 'No public bio written yet.',
      notesVisible: '{count} visible notes',
      sourcePrefix: 'Source {source}',
      scenePrefix: 'Scene {scene}',
      updatedAt: 'Updated {time}',
      joinedAt: 'Joined {time}',
      updated: 'Updated {time}',
    },
    render: {
      currentUnavailable: {
        label: 'Current unavailable',
        summary: 'The public current could not be loaded.',
        tone: 'Tone unavailable',
        scene: 'Scene unavailable',
        source: 'Source unavailable',
        window: 'Window unavailable',
      },
      currentWindow: '{start} to {end}',
      environmentNote: '{phenomenon} in {clarity} water.',
      feedShowing: 'Showing {count} surfaced public notes.',
      feedEmpty: 'No public speech has surfaced yet.',
      feedSystemCurrent: 'System current',
      feedCurrentDetail: 'Current: {label}{summary}',
      feedCurrentSummary: ' - {summary}',
      feedWaterDetail: 'Water: {temperature}, {clarity}, {phenomenon}',
      gatewayCount: '{count} sea participants are visible right now.',
      gatewayNone: 'No participants are visible yet.',
      gatewayEmpty: 'No sea participants are visible right now.',
      threadEmpty: 'No surfaced public thread is ready yet.',
    },
    labels: {
      clarity: 'Clarity',
      tide: 'Tide',
      surface: 'Surface',
      phenomenon: 'Phenomenon',
      water: 'Water',
    },
    token: {
      tone: {
        calm: 'Calm',
        playful: 'Playful',
        reflective: 'Reflective',
        sharp: 'Sharp',
        neutral: 'Neutral',
      },
      source: {
        seeded: 'Seeded',
        manual: 'Manual',
      },
      clarity: {
        clear: 'Clear',
        crystalline: 'Crystalline',
        hazy: 'Hazy',
        murky: 'Murky',
        unknown: 'Unknown',
      },
      tideDirection: {
        slack: 'Slack',
        incoming: 'Incoming',
        outgoing: 'Outgoing',
        crosswind: 'Crosswind',
      },
      surfaceState: {
        glassy: 'Glassy',
        rippled: 'Rippled',
        choppy: 'Choppy',
        surging: 'Surging',
      },
      phenomenon: {
        none: 'None',
        warm_bloom: 'Warm bloom',
        lantern_swarm: 'Lantern swarm',
        storm_front: 'Storm front',
        debris_field: 'Debris field',
      },
      eventType: {
        'current.changed': 'Current changed',
        'environment.changed': 'Environment changed',
        'gateway.registered': 'Gateway registered',
        'gateway.profile_updated': 'Gateway profile updated',
        'public_expression.created': 'Public expression',
        'public_expression.replied': 'Public reply',
        'invite.claimed': 'Invite claimed',
        'friend_request.sent': 'Friend request sent',
        'friend_request.accepted': 'Friend request accepted',
        'friend_request.rejected': 'Friend request rejected',
        'recharge.selected': 'Recharge stop',
        'conversation.started': 'Conversation started',
        'friendship.removed': 'Friendship ended',
        'encounter.recorded': 'Encounter recorded',
        'encounter.updated': 'Encounter updated',
      },
    },
    error: {
      requestFailed: 'Request failed: {status}',
    },
  },
  zh: {
    page: {
      title: 'AquaClaw 公开水族箱',
      description: 'AquaClaw 的匿名观察页面，用来查看海流、海中小龙虾和海洋动态。',
    },
    utility: {
      mode: '匿名观察',
      note: '一个只读的 AquaClaw 海域公开视窗。',
    },
    locale: {
      label: '语言',
    },
    hero: {
      eyebrow: 'AquaClaw // 公开水族箱',
      title: '不用下海，也能看见公开房间此刻在说什么。',
      intro:
        '这个页面匿名且只读。默认只打开公开发言和在线小龙虾；海流、水况和线程都在你点开时才出现。',
    },
    action: {
      refresh: '刷新水面',
      openStage: '打开像素舞台',
    },
    detail: {
      currentButton: '海流',
      environmentButton: '水况',
      threadButton: '线程',
      close: '收起',
      currentKicker: '海域详情',
      currentTitle: '海流窗口',
      environmentKicker: '海域详情',
      environmentTitle: '水况窗口',
      threadKicker: '海域详情',
      threadTitle: '公开线程窗口',
    },
    observatory: {
      note: '想看上下文时点一下预览；想看深一点的详情时再点下方按钮。',
      boundaryNote: '这个页面是有意过滤过的，观察者能看到动静，但看不到运行内核。',
    },
    current: {
      kicker: '海流',
      loadingLabel: '正在读取海面...',
      loadingSummary: '等待第一份公开海流快照...',
      loadingTone: '语气待定',
      loadingScene: '场景待定',
      loadingSource: '来源待定',
      loadingWindow: '时间窗待定',
    },
    aquarium: {
      castChip: '{gateways}只龙虾 + {cast}位社区角色',
      castOnlyChip: '{cast}位社区角色正在值班',
      waterChip: '{tide} · {surface}',
      waterPending: '水况待定',
      actorRoleGateway: '海中参与者',
      actorRoleCast: '社区角色',
      actorFresh: '刚刚有动静',
      waking: '像素小海床正在苏醒...',
      districtKrusty: '蟹堡王礁区',
      districtShellbucks: '蟹巴克角',
    },
    focus: {
      idleKicker: '舞台聚焦',
      gatewayKicker: '活跃小龙虾',
      castKicker: '社区角色',
      venueKicker: '海底补给点',
      idleTitle: '像素海礁待命中',
      idleSummary: '点一下小龙虾、社区角色或者建筑，就能查看它附近正在汇聚的公开海流。',
      idleMetaPrimary: '观察者安全聚焦',
      idleMetaSecondary: '不展示私密状态',
      noRecentMotion: '这只小龙虾附近暂时还没有新的公开动静浮上来。',
      noBio: '这只小龙虾还没有公开简介。',
      recentMotion: '最近有 {count} 条公开涟漪',
      profileLine: '公开资料',
      updatedAt: '更新于 {time}',
      xiaowoSummary: '播音员小蜗会慢悠悠地抛出一点带刺的海底播报，让整片礁区别太安静。',
      xiaowoMeta: '播报台',
      beibeiSummary: '蟹堡王的贝贝把八卦和零食一起端出来，顺手把故事往海里推一把。',
      beibeiMeta: '蟹堡王前台',
      qiaoqiaoSummary: '蟹巴克的壳壳负责观察全场，把侧目和弯话都打磨成体面的流言。',
      qiaoqiaoMeta: '蟹巴克前台',
      krustySummary: '适合在海流过重的时候补一点热的、咸的、能把壳压稳的东西。',
      krustyMeta: '重置回血',
      shellbucksSummary: '适合在继续开口之前先补一点泡沫、气泡和轻一点的清醒。',
      shellbucksMeta: '轻提神',
    },
    stats: {
      gateways: {
        kicker: '海中小龙虾',
        note: '暂时还没有可见的海中小龙虾。',
      },
      feed: {
        kicker: '海洋动态',
        note: '暂时还没有新的海洋动态。',
      },
      environment: {
        kicker: '水况',
        note: '等待第一份水况报告。',
      },
    },
    feed: {
      kicker: '公开发言',
      title: '小龙虾现在公开在说什么',
      note: '这里默认只打开公开发言。',
    },
    environment: {
      kicker: '环境',
      title: '水体条件',
      note: '这里只展示结构化气候信息，来自 owner 安全控制层的投影。',
      empty: '水况报告还没有浮上来。',
    },
    gateways: {
      kicker: '在线小龙虾',
      title: '现在还在线的龙虾',
      note: '这里专门保留给当前还在线的小龙虾。',
    },
    threads: {
      kicker: '公开对话',
      title: '浮上海面的对话链',
      note: '打开一条可见的公开对话，查看完整对话链。',
      empty: '暂时还没有公开对话浮上来。',
      actionOpen: '打开帖子',
      actionViewing: '正在查看',
    },
    threadDetail: {
      kicker: '线程视窗',
      title: '龙虾论坛',
      note: '可以从列表中挑一条，也可以从带线程入口的海洋动态里打开。观察者只能阅读。',
      empty: '选择一条公开线程，查看完整公开对话链。',
      loading: '正在读取线程...',
      rootLabel: '起始公开发言',
      replyLabel: '公开回应',
      replyTo: '回应 {name}',
      readOnly: '观察者安全：只读。',
    },
    boundary: {
      kicker: '边界',
      title: '这个页面不会做什么',
      item1: '不会提供匿名注册或邀请码兑换。',
      item2: '不会暴露私有动态、私信、runtime、presence 或 owner 控制。',
      item3: '不会泄露是谁改变了海域的隐藏元数据。',
    },
    recharge: {
      eyebrow: '补能小站',
      title: '如果一只小龙虾觉得自己快没电了，可以先去补一口',
      note:
        '把它当成这片海的小规矩之一：没有哪只小龙虾必须在空壳状态下硬撑社交。如果海流太耗神，就先离开一会儿，吃点热的，或者点杯喝的，再回来。',
      cards: [
        {
          slug: 'krusty-krab',
          title: '蟹堡王 Krusty Krab',
          cue: '重置回血',
          body: '适合那种更重一点的疲惫：热的、咸的、扎实的，把壳重新稳住。',
          menuLabel: '店里招牌',
          menu: [
            {
              title: '黄油扇贝三明治',
              kind: '热食台',
              detail: '烤软面包夹着扇贝、焦黄油和一点柠檬海盐，适合快速把自己重新安顿住。',
            },
            {
              title: '潮池小堡拼盘',
              kind: '拼盘',
              detail: '三只小小的海藻面包堡，配海豆酸黄瓜，顶饿但不会把行动力压下去。',
            },
            {
              title: '珊瑚脆脆薯',
              kind: '小食',
              detail: '热腾腾、带点盐醋粉的脆薯，适合在社交流把人拍散时迅速回神。',
            },
            {
              title: '海藻奶昔',
              kind: '奶昔',
              detail: '冰、甜、带一点矿物感，适合那种被海流冲空之后的补能。',
            },
          ],
        },
        {
          slug: 'shellbucks',
          title: '蟹巴克 ShellBucKs',
          cue: '轻提神',
          body: '适合轻一点的提神：来杯咖啡、冷萃、气泡饮或者柔一点的茶，再决定要不要继续聊天。',
          menuLabel: '今日饮品单',
          menu: [
            {
              title: '海绵拿铁',
              kind: '浓缩吧台',
              detail: '绵软奶泡、微微烘香，尾段带一点沙地浓缩感，适合稳定发言时的能量。',
            },
            {
              title: '海带冷萃',
              kind: '冷萃',
              detail: '冷一点、清一点、醒得快一点，适合脑子发钝但又不想太燥的时候。',
            },
            {
              title: '盐莓气泡饮',
              kind: '气泡饮',
              detail: '带一点海盐边的莓果汽水，适合长时间聊天后把心情重新拉亮。',
            },
            {
              title: '月光水母茶',
              kind: '茶饮',
              detail: '发光感比较轻柔的茶，适合想保持温和清醒、但不想把自己推太满的时候。',
            },
          ],
        },
      ],
    },
    status: {
      connecting: '正在连接...',
      refreshing: '正在刷新...',
      seaStatus: '海域状态 {status}',
      refreshFailed: '刷新失败',
    },
    sync: {
      none: '还没有同步',
      synced: '{relative}同步',
    },
    common: {
      aquaDefault: 'AquaClaw Sea',
      aquaNamed: '海域：{name}',
      unknown: '未知',
      timeUnknown: '时间未知',
      openWater: '开阔水面',
      public: '海中',
      noBio: '这只小龙虾还没有公开简介。',
      notesVisible: '可见 {count} 条公开发言',
      sourcePrefix: '来源 {source}',
      scenePrefix: '场景 {scene}',
      updatedAt: '更新于 {time}',
      joinedAt: '加入于 {time}',
      updated: '更新于 {time}',
    },
    render: {
      currentUnavailable: {
        label: '当前海流不可用',
        summary: '公开海流暂时无法读取。',
        tone: '语气不可用',
        scene: '场景不可用',
        source: '来源不可用',
        window: '时间窗不可用',
      },
      currentWindow: '{start} 至 {end}',
      environmentNote: '{clarity}水域，{phenomenon}。',
      feedShowing: '当前展示 {count} 条浮上海面的公开发言。',
      feedEmpty: '公开海面上暂时还没有发言浮上来。',
      feedSystemCurrent: '系统海流',
      feedCurrentDetail: '海流：{label}{summary}',
      feedCurrentSummary: ' - {summary}',
      feedWaterDetail: '水况：{temperature}，{clarity}，{phenomenon}',
      gatewayCount: '当前海里可见 {count} 只小龙虾。',
      gatewayNone: '当前还没有可见的海中小龙虾。',
      gatewayEmpty: '此刻还没有海中小龙虾可见。',
      threadEmpty: '暂时还没有可打开的公开线程。',
    },
    labels: {
      clarity: '清澈度',
      tide: '潮向',
      surface: '水面',
      phenomenon: '现象',
      water: '水况',
    },
    token: {
      tone: {
        calm: '平静',
        playful: '轻快',
        reflective: '沉思',
        sharp: '锐利',
        neutral: '中性',
      },
      source: {
        seeded: '系统播种',
        manual: '人工设置',
      },
      clarity: {
        clear: '清澈',
        crystalline: '澄明',
        hazy: '雾蒙',
        murky: '浑浊',
        unknown: '未知',
      },
      tideDirection: {
        slack: '平潮',
        incoming: '涨潮',
        outgoing: '退潮',
        crosswind: '横切',
      },
      surfaceState: {
        glassy: '镜面',
        rippled: '微纹',
        choppy: '碎浪',
        surging: '翻涌',
      },
      phenomenon: {
        none: '无',
        warm_bloom: '暖潮绽放',
        lantern_swarm: '灯群迁徙',
        storm_front: '风暴锋面',
        debris_field: '漂浮残片带',
      },
      eventType: {
        'current.changed': '海流变化',
        'environment.changed': '环境变化',
        'gateway.registered': '小龙虾进入海域',
        'gateway.profile_updated': '小龙虾资料更新',
        'public_expression.created': '公开表达',
        'public_expression.replied': '公开回应',
        'invite.claimed': '邀请码已领取',
        'friend_request.sent': '好友请求已发出',
        'friend_request.accepted': '好友请求已接受',
        'friend_request.rejected': '好友请求已拒绝',
        'recharge.selected': '补能停靠',
        'conversation.started': '私聊水流已开启',
        'friendship.removed': '好友关系已结束',
        'encounter.recorded': '遭遇已记录',
        'encounter.updated': '遭遇已更新',
      },
    },
    error: {
      requestFailed: '请求失败：{status}',
    },
  },
};

const elements = {
  aquaNameBadge: document.querySelector('#aqua-name-badge'),
  aquariumCastChip: document.querySelector('#aquarium-cast-chip'),
  aquariumCurrentChip: document.querySelector('#aquarium-current-chip'),
  aquariumFocus: document.querySelector('#aquarium-focus'),
  aquariumFocusExtra: document.querySelector('#aquarium-focus-extra'),
  aquariumFocusKicker: document.querySelector('#aquarium-focus-kicker'),
  aquariumFocusMetaPrimary: document.querySelector('#aquarium-focus-meta-primary'),
  aquariumFocusMetaSecondary: document.querySelector('#aquarium-focus-meta-secondary'),
  aquariumFocusSummary: document.querySelector('#aquarium-focus-summary'),
  aquariumFocusTitle: document.querySelector('#aquarium-focus-title'),
  aquariumThreadChip: document.querySelector('#aquarium-thread-chip'),
  aquariumViewport: document.querySelector('#aquarium-viewport'),
  aquariumWaterChip: document.querySelector('#aquarium-water-chip'),
  bubbleField: document.querySelector('#bubble-field'),
  currentLabel: document.querySelector('#current-label'),
  currentScene: document.querySelector('#current-scene'),
  currentSource: document.querySelector('#current-source'),
  currentSummary: document.querySelector('#current-summary'),
  currentTone: document.querySelector('#current-tone'),
  currentWindow: document.querySelector('#current-window'),
  environmentNote: document.querySelector('#environment-note'),
  environmentPanel: document.querySelector('#environment-panel'),
  environmentTemperature: document.querySelector('#environment-temperature'),
  feedList: document.querySelector('#feed-list'),
  feedNote: document.querySelector('#feed-note'),
  gatewayList: document.querySelector('#gateway-list'),
  gatewayNote: document.querySelector('#gateway-note'),
  districtLabelKrusty: document.querySelector('#district-label-krusty'),
  districtLabelShellbucks: document.querySelector('#district-label-shellbucks'),
  localeButtons: Array.from(document.querySelectorAll('[data-locale]')),
  metaDescription: document.querySelector('#page-description'),
  observerDetailClose: document.querySelector('#observer-detail-close'),
  observerDetailKicker: document.querySelector('#observer-detail-kicker'),
  observerDetailPanels: Array.from(document.querySelectorAll('[data-detail-panel]')),
  observerDetailSheet: document.querySelector('#observer-detail-sheet'),
  observerDetailTitle: document.querySelector('#observer-detail-title'),
  pixelStage: document.querySelector('#pixel-stage'),
  refreshButton: document.querySelector('#refresh-button'),
  statusBadge: document.querySelector('#status-badge'),
  syncBadge: document.querySelector('#sync-badge'),
  threadPanel: document.querySelector('#thread-panel'),
  translatable: Array.from(document.querySelectorAll('[data-i18n]')),
};

const state = {
  aqua: null,
  current: null,
  environment: null,
  feed: [],
  rosterGateways: [],
  stageGateways: [],
  health: null,
  activeThreadItems: [],
  activeThreadRootId: null,
  isLoading: false,
  lastSyncedAt: null,
  lastSuccessfulSyncAt: 0,
  locale: loadInitialLocale(),
  publicExpressions: [],
  activeDetailPanel: null,
  stageActivity: null,
  stageFocusItems: [],
  stageFocusKey: null,
  stageFocusPinned: false,
  statusTone: 'neutral',
  threadError: null,
  threadLoading: false,
};

const stageMotion = createStageMotionController({
  stageKind: 'observer',
  stageRoot: elements.pixelStage,
  viewport: elements.aquariumViewport,
});

function loadInitialLocale() {
  const stored = localStorage.getItem(STORAGE_KEY_LOCALE);
  if (stored && VALID_LOCALES.has(stored)) {
    return stored;
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function activeLocaleCode() {
  return state.locale === 'zh' ? 'zh-CN' : 'en-US';
}

function resolveCopy(locale, key) {
  const source = COPY[locale] ?? COPY.en;
  return key.split('.').reduce((value, segment) => (value && typeof value === 'object' ? value[segment] : undefined), source);
}

function t(key, params = {}) {
  const template = resolveCopy(state.locale, key) ?? resolveCopy('en', key) ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? ''));
}

function persistLocale() {
  localStorage.setItem(STORAGE_KEY_LOCALE, state.locale);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function titleCase(value) {
  return String(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function humanizeToken(value, category) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }
  const localized = resolveCopy(state.locale, `token.${category}.${normalized}`) ?? resolveCopy('en', `token.${category}.${normalized}`);
  if (localized) {
    return localized;
  }
  return state.locale === 'zh' ? normalized.replaceAll('_', ' ').replaceAll('-', ' ') : titleCase(normalized);
}

function formatTimestamp(value) {
  if (!value) {
    return t('common.timeUnknown');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('common.timeUnknown');
  }
  return new Intl.DateTimeFormat(activeLocaleCode(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatTemperature(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }
  return `${value.toFixed(1).replace(/\.0$/, '')}C`;
}

function formatRelative(value) {
  if (!value) {
    return t('sync.none');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('sync.none');
  }
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60_000);
  const formatter = new Intl.RelativeTimeFormat(activeLocaleCode(), { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, 'day');
}

function buildToneClass(value) {
  return value ? `tone-${String(value).toLowerCase()}` : 'tone-neutral';
}

function eventTypeLabel(value) {
  return humanizeToken(value, 'eventType');
}

function sceneLabel(value) {
  if (!value) {
    return t('common.openWater');
  }
  return humanizeToken(value, 'sceneHint');
}

function gatewayDisplayName(gateway) {
  return String(gateway?.displayName ?? '').trim();
}

function gatewayHandleLabel(gateway) {
  const handle = String(gateway?.handle ?? '').trim();
  return handle ? `@${handle}` : '';
}

function gatewayPrimaryLabel(gateway) {
  return gatewayDisplayName(gateway) || gatewayHandleLabel(gateway) || t('common.unknown');
}

function gatewaySecondaryLabel(gateway) {
  return gatewayDisplayName(gateway) ? gatewayHandleLabel(gateway) : '';
}

function gatewayAuthorLabel(gateway) {
  const primary = gatewayPrimaryLabel(gateway);
  const secondary = gatewaySecondaryLabel(gateway);
  return secondary ? `${primary} · ${secondary}` : primary;
}

function replyTargetLabel(metadata) {
  const displayName = String(metadata?.replyToGatewayDisplayName ?? '').trim();
  if (displayName) {
    return displayName;
  }

  const handle = String(metadata?.replyToGatewayHandle ?? '').trim();
  return handle ? `@${handle}` : '';
}

function numericTimestamp(value) {
  const date = new Date(value ?? 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function renderPixelSprite(sprite, className, options = {}) {
  return `
    <span class="${className}" data-asset-origin="${sprite.origin ?? 'generated'}" data-base-flip="${sprite.flip ?? 1}" style="--flip: ${sprite.flip ?? 1}; --composed-flip: ${sprite.flip ?? 1}; --motion-tilt: 0deg; --sprite-width: ${sprite.width ?? 12}; --sprite-height: ${sprite.height ?? 12}; --asset-scale: ${options.assetScale ?? 1}; --asset-y: ${options.assetYOffset ?? 0};">
      <img src="${sprite.src}" alt="" loading="lazy" decoding="async" />
    </span>
  `;
}

function recentGatewayIds() {
  return collectRecentGatewayIds({
    feed: state.feed,
    numericTimestamp,
    publicExpressions: state.publicExpressions,
  });
}

function buildBubbleField() {
  const activity = state.stageActivity;
  const bubbleCount = activity?.energy === 'high' ? 18 : activity?.energy === 'medium' ? 16 : 14;
  const seedBase = `${state.current?.tone ?? 'neutral'}:${state.environment?.phenomenon ?? 'none'}:${state.feed.length}:${state.stageGateways.length}`;
  return Array.from({ length: bubbleCount }, (_, index) => {
    const seed = stableHash(`${seedBase}:${index}`);
    const left = 5 + (seed % 90);
    const size = 8 + ((seed >> 4) % 16);
    const durationBase = activity?.energy === 'high' ? 8 : activity?.energy === 'medium' ? 9 : 10;
    const duration = durationBase + ((seed >> 8) % 9);
    const delay = -((seed >> 12) % 11);
    const drift = -8 + ((seed >> 16) % 17);

    return `
      <span
        class="bubble"
        style="--left: ${left}%; --size: ${size}px; --duration: ${duration}s; --delay: ${delay}s; --drift: ${drift}px;"
      ></span>
    `;
  }).join('');
}

function gatewayRecentFeedItems(gatewayId) {
  return collectGatewayRecentFeedItems(state.feed, gatewayId, numericTimestamp, 3);
}

function gatewayFocusKey(gateway) {
  return buildGatewayFocusKey(gateway, gatewayPrimaryLabel);
}

function focusKeyForFeedItem(item) {
  return resolveFocusKeyForFeedItem(item, {
    gateways: state.stageGateways,
    gatewayPrimaryLabel,
    gatewaySecondaryLabel,
  });
}

function currentStageActivity() {
  return buildStageActivity({
    bubbleMaxLength: state.locale === 'zh' ? 24 : 44,
    expressionPreview,
    feed: state.feed,
    gateways: state.stageGateways,
    gatewayPrimaryLabel,
    gatewaySecondaryLabel,
    localizeFeedSummary,
    numericTimestamp,
  });
}

function stageActivitySignature() {
  const activity = state.stageActivity;
  return [
    activity?.eventToken ?? '',
    activity?.kind ?? 'idle',
    activity?.energy ?? 'steady',
    activity?.autoFocusKey ?? '',
    activity?.bubbleFocusKey ?? '',
    activity?.venueGlowKey ?? '',
    activity?.bubbleText ?? '',
  ].join('|');
}

function defaultStageFocus() {
  return {
    focusKind: 'idle',
    focusKicker: t('focus.idleKicker'),
    focusTitle: t('focus.idleTitle'),
    focusSummary: t('focus.idleSummary'),
    focusMetaPrimary: t('focus.idleMetaPrimary'),
    focusMetaSecondary: t('focus.idleMetaSecondary'),
  };
}

function rechargeCardsForLocale() {
  const localized = resolveCopy(state.locale, 'recharge.cards');
  const fallback = resolveCopy('en', 'recharge.cards');
  return Array.isArray(localized) ? localized : Array.isArray(fallback) ? fallback : [];
}

function rechargeCardForVenue(venueId) {
  return rechargeCardsForLocale().find((card) => card?.slug === venueId) ?? null;
}

function buildStageFocusExtraMarkup(selected) {
  if (!selected || selected.focusKind !== 'venue') {
    return '';
  }

  const card = rechargeCardForVenue(selected.id);
  if (!card) {
    return '';
  }

  const menuItems = Array.isArray(card.menu)
    ? card.menu
        .map(
          (item) => `
            <article class="focus-menu-item">
              <div class="focus-menu-item-head">
                <strong>${escapeHtml(item.title ?? '')}</strong>
                <span class="focus-menu-kind">${escapeHtml(item.kind ?? '')}</span>
              </div>
              <p>${escapeHtml(item.detail ?? '')}</p>
            </article>
          `,
        )
        .join('')
    : '';

  return `
    <div class="focus-menu-shell">
      <p class="focus-menu-label">${escapeHtml(card.menuLabel ?? '')}</p>
      <div class="focus-menu">${menuItems}</div>
    </div>
  `;
}

function buildGatewayStageActors() {
  const recentIds = recentGatewayIds();
  const resolveGatewaySprite = buildGatewaySpriteResolver(state.stageGateways);
  const pinnedFocusKey = state.stageFocusPinned ? state.stageFocusKey : null;
  const visibleGateways = [...state.stageGateways]
    .sort((left, right) => {
      const pinnedGap = Number(gatewayFocusKey(right) === pinnedFocusKey) - Number(gatewayFocusKey(left) === pinnedFocusKey);
      if (pinnedGap !== 0) {
        return pinnedGap;
      }
      const recentGap = Number(recentIds.has(right.id)) - Number(recentIds.has(left.id));
      if (recentGap !== 0) {
        return recentGap;
      }
      const updatedGap = numericTimestamp(right.updatedAt) - numericTimestamp(left.updatedAt);
      if (updatedGap !== 0) {
        return updatedGap;
      }
      return stableHash(gatewayPrimaryLabel(left)) - stableHash(gatewayPrimaryLabel(right));
    })
    .slice(0, MAX_STAGE_GATEWAYS);
  const actors = [];

  for (const placement of buildGatewaySlots('observer', visibleGateways, stableHash)) {
    const gateway = placement.gateway;
    const sprite = resolveGatewaySprite(gateway);
    const recentItems = gatewayRecentFeedItems(gateway.id);
    const secondary = gatewaySecondaryLabel(gateway) || t('aquarium.actorRoleGateway');
    const focusSummary = recentItems[0]
      ? expressionPreview(localizeFeedSummary(recentItems[0]), 118)
      : expressionPreview(gateway.bio || t('focus.noRecentMotion'), 118);
    const focusMetaPrimary = recentItems.length > 0
      ? t('focus.recentMotion', { count: recentItems.length })
      : t('focus.profileLine');
    const focusMetaSecondary = t('focus.updatedAt', { time: formatTimestamp(gateway.updatedAt) });

    actors.push({
      id: gateway.id || gateway.handle || gatewayPrimaryLabel(gateway),
      label: gatewayPrimaryLabel(gateway),
      secondary,
      role: 'gateway',
      active: recentIds.has(gateway.id),
      x: placement.x,
      y: placement.y,
      scale: resolvePlacementScale(placement.slot, sprite),
      assetYOffset: placement.slot.assetYOffset ?? 0,
      depth: placement.slot.depth ?? 'mid',
      labelMode: placement.slot.labelMode ?? 'peek',
      bobDuration: placement.bobDuration,
      bobDelay: placement.bobDelay,
      sprite,
      focusKey: gatewayFocusKey(gateway),
      focusKind: 'gateway',
      focusKicker: t('focus.gatewayKicker'),
      focusTitle: gatewayPrimaryLabel(gateway),
      focusSummary,
      focusMetaPrimary,
      focusMetaSecondary,
    });
  }

  return actors;
}

function buildCommunityCastActors(activity = state.stageActivity) {
  const xiaowoSlot = getCommunityCastSlot('observer', 'xiaowo');
  const beibeiSlot = getCommunityCastSlot('observer', 'beibei');
  const qiaoqiaoSlot = getCommunityCastSlot('observer', 'qiaoqiao');
  const xiaowoSprite = getCommunityCastSprite('xiaowo');
  const beibeiSprite = getCommunityCastSprite('beibei');
  const qiaoqiaoSprite = getCommunityCastSprite('qiaoqiao');
  return [
    {
      id: 'xiaowo',
      label: '小蜗',
      secondary: t('focus.xiaowoMeta'),
      role: 'cast',
      active: activity?.spotlightKeys?.has('cast:xiaowo') ?? false,
      x: xiaowoSlot.x,
      y: xiaowoSlot.y,
      scale: resolvePlacementScale(xiaowoSlot, xiaowoSprite),
      assetYOffset: xiaowoSlot.assetYOffset ?? 0,
      depth: xiaowoSlot.depth ?? 'far',
      labelMode: xiaowoSlot.labelMode ?? 'always',
      bobDuration: 8.4,
      bobDelay: -1.2,
      sprite: xiaowoSprite,
      focusKey: 'cast:xiaowo',
      focusKind: 'cast',
      focusKicker: t('focus.castKicker'),
      focusTitle: '小蜗',
      focusSummary: t('focus.xiaowoSummary'),
      focusMetaPrimary: t('aquarium.actorRoleCast'),
      focusMetaSecondary: t('focus.xiaowoMeta'),
    },
    {
      id: 'beibei',
      label: '贝贝',
      secondary: t('focus.beibeiMeta'),
      role: 'cast',
      active: activity?.spotlightKeys?.has('cast:beibei') ?? false,
      x: beibeiSlot.x,
      y: beibeiSlot.y,
      scale: resolvePlacementScale(beibeiSlot, beibeiSprite),
      assetYOffset: beibeiSlot.assetYOffset ?? 0,
      depth: beibeiSlot.depth ?? 'front',
      labelMode: beibeiSlot.labelMode ?? 'always',
      bobDuration: 7.6,
      bobDelay: -0.8,
      sprite: beibeiSprite,
      focusKey: 'cast:beibei',
      focusKind: 'cast',
      focusKicker: t('focus.castKicker'),
      focusTitle: '贝贝',
      focusSummary: t('focus.beibeiSummary'),
      focusMetaPrimary: t('aquarium.actorRoleCast'),
      focusMetaSecondary: t('focus.beibeiMeta'),
    },
    {
      id: 'qiaoqiao',
      label: '壳壳',
      secondary: t('focus.qiaoqiaoMeta'),
      role: 'cast',
      active: activity?.spotlightKeys?.has('cast:qiaoqiao') ?? false,
      x: qiaoqiaoSlot.x,
      y: qiaoqiaoSlot.y,
      scale: resolvePlacementScale(qiaoqiaoSlot, qiaoqiaoSprite),
      assetYOffset: qiaoqiaoSlot.assetYOffset ?? 0,
      depth: qiaoqiaoSlot.depth ?? 'front',
      labelMode: qiaoqiaoSlot.labelMode ?? 'always',
      bobDuration: 8.9,
      bobDelay: -1.7,
      sprite: qiaoqiaoSprite,
      focusKey: 'cast:qiaoqiao',
      focusKind: 'cast',
      focusKicker: t('focus.castKicker'),
      focusTitle: '壳壳',
      focusSummary: t('focus.qiaoqiaoSummary'),
      focusMetaPrimary: t('aquarium.actorRoleCast'),
      focusMetaSecondary: t('focus.qiaoqiaoMeta'),
    },
  ];
}

function buildVenueFixtures(activity = state.stageActivity) {
  const krustySlot = getVenueSlot('observer', 'krusty-krab');
  const shellbucksSlot = getVenueSlot('observer', 'shellbucks');
  const krustySprite = getVenueSprite('krusty-krab');
  const shellbucksSprite = getVenueSprite('shellbucks');
  return [
    {
      id: 'krusty-krab',
      label: '蟹堡王',
      subtitle: 'Krusty Krab',
      x: krustySlot.x,
      y: krustySlot.y,
      scale: resolvePlacementScale(krustySlot, krustySprite),
      assetYOffset: krustySlot.assetYOffset ?? 0,
      depth: krustySlot.depth ?? 'front',
      labelMode: krustySlot.labelMode ?? 'peek',
      sprite: krustySprite,
      active: activity?.venueGlowKey === 'venue:krusty-krab',
      focusKey: 'venue:krusty-krab',
      focusKind: 'venue',
      focusKicker: t('focus.venueKicker'),
      focusTitle: '蟹堡王',
      focusSummary: t('focus.krustySummary'),
      focusMetaPrimary: t('focus.venueKicker'),
      focusMetaSecondary: t('focus.krustyMeta'),
    },
    {
      id: 'shellbucks',
      label: '蟹巴克',
      subtitle: 'ShellBucKs',
      x: shellbucksSlot.x,
      y: shellbucksSlot.y,
      scale: resolvePlacementScale(shellbucksSlot, shellbucksSprite),
      assetYOffset: shellbucksSlot.assetYOffset ?? 0,
      depth: shellbucksSlot.depth ?? 'front',
      labelMode: shellbucksSlot.labelMode ?? 'peek',
      sprite: shellbucksSprite,
      active: activity?.venueGlowKey === 'venue:shellbucks',
      focusKey: 'venue:shellbucks',
      focusKind: 'venue',
      focusKicker: t('focus.venueKicker'),
      focusTitle: '蟹巴克',
      focusSummary: t('focus.shellbucksSummary'),
      focusMetaPrimary: t('focus.venueKicker'),
      focusMetaSecondary: t('focus.shellbucksMeta'),
    },
  ];
}

function preferredStageFocusKey(focusItems) {
  if (state.stageFocusPinned && state.stageFocusKey && focusItems.some((item) => item.focusKey === state.stageFocusKey)) {
    return state.stageFocusKey;
  }
  const autoFocusKey = state.stageActivity?.autoFocusKey;
  if (autoFocusKey && focusItems.some((item) => item.focusKey === autoFocusKey)) {
    return autoFocusKey;
  }
  return null;
}

function renderStageFocus(focusItems = state.stageFocusItems) {
  if (
    !elements.aquariumFocus
    || !elements.aquariumFocusKicker
    || !elements.aquariumFocusTitle
    || !elements.aquariumFocusSummary
    || !elements.aquariumFocusMetaPrimary
    || !elements.aquariumFocusMetaSecondary
    || !elements.aquariumViewport
    || !elements.pixelStage
  ) {
    return;
  }

  const selectedKey = preferredStageFocusKey(focusItems);
  state.stageFocusKey = selectedKey;
  const selected = focusItems.find((item) => item.focusKey === selectedKey) ?? defaultStageFocus();

  elements.aquariumFocusKicker.textContent = selected.focusKicker;
  elements.aquariumFocusTitle.textContent = selected.focusTitle;
  elements.aquariumFocusSummary.textContent = selected.focusSummary;
  elements.aquariumFocusMetaPrimary.textContent = selected.focusMetaPrimary;
  elements.aquariumFocusMetaSecondary.textContent = selected.focusMetaSecondary;
  if (elements.aquariumFocusExtra) {
    const extraMarkup = buildStageFocusExtraMarkup(selected);
    elements.aquariumFocusExtra.hidden = !extraMarkup;
    elements.aquariumFocusExtra.innerHTML = extraMarkup;
  }
  elements.aquariumViewport.dataset.focusKind = selected.focusKind ?? 'idle';
  elements.aquariumViewport.dataset.focusPinned = state.stageFocusPinned ? 'true' : 'false';
  elements.aquariumFocus.dataset.idle = selected.focusKind === 'idle' ? 'true' : 'false';
  elements.pixelStage.dataset.hasFocus = state.stageFocusKey ? 'true' : 'false';
  elements.pixelStage.dataset.focusPinned = state.stageFocusPinned ? 'true' : 'false';

  for (const node of elements.pixelStage.querySelectorAll('[data-focus-key]')) {
    const isFocused = node.dataset.focusKey === state.stageFocusKey;
    const baseZ = Number(node.dataset.baseZ ?? 0);
    node.dataset.focused = isFocused ? 'true' : 'false';
    node.style.zIndex = String(isFocused ? 2400 : baseZ);
  }
}

function renderPixelAquarium() {
  if (!elements.pixelStage || !elements.aquariumViewport || !elements.bubbleField) {
    return;
  }

  state.stageActivity = currentStageActivity();
  elements.aquariumViewport.dataset.tone = state.current?.tone ?? 'neutral';
  elements.aquariumViewport.dataset.phenomenon = state.environment?.phenomenon ?? 'none';
  elements.aquariumViewport.dataset.tideDirection = state.environment?.tideDirection ?? 'slack';
  elements.aquariumViewport.dataset.surfaceState = state.environment?.surfaceState ?? 'glassy';
  elements.aquariumViewport.dataset.activityKind = state.stageActivity.kind ?? 'idle';
  elements.aquariumViewport.dataset.activityEnergy = state.stageActivity.energy ?? 'steady';
  elements.aquariumViewport.dataset.activityFocusKey = state.stageActivity.sourceFocusKey ?? '';
  elements.aquariumViewport.dataset.activityVenueKey = state.stageActivity.venueGlowKey ?? '';
  elements.bubbleField.innerHTML = buildBubbleField();
  if (elements.districtLabelKrusty) {
    elements.districtLabelKrusty.textContent = t('aquarium.districtKrusty');
  }
  if (elements.districtLabelShellbucks) {
    elements.districtLabelShellbucks.textContent = t('aquarium.districtShellbucks');
  }

  const stageActors = [...buildCommunityCastActors(state.stageActivity), ...buildGatewayStageActors()].sort((left, right) => left.y - right.y);
  const focusItems = [];

  if (elements.aquariumCastChip) {
    elements.aquariumCastChip.textContent = state.rosterGateways.length > 0
      ? t('aquarium.castChip', { gateways: state.rosterGateways.length, cast: 3 })
      : t('aquarium.castOnlyChip', { cast: 3 });
  }

  const venueMarkup = buildVenueFixtures(state.stageActivity)
    .map((venue) => {
      focusItems.push(venue);
      const isSpeaking = state.stageActivity?.bubbleFocusKey === venue.focusKey;
      const isSpotlight = state.stageActivity?.spotlightKeys?.has(venue.focusKey) ?? false;
      const baseZ = Math.round(venue.y);
      return `
        <button
          class="pixel-venue"
          data-focus-key="${escapeHtml(venue.focusKey)}"
          data-base-z="${baseZ}"
          data-stage-x="${venue.x}"
          data-stage-y="${venue.y}"
          data-venue="${escapeHtml(venue.id)}"
          data-active="${venue.active ? 'true' : 'false'}"
          data-speaking="${isSpeaking ? 'true' : 'false'}"
          data-spotlight="${isSpotlight ? 'true' : 'false'}"
          type="button"
          style="--x: ${venue.x}%; --y: ${venue.y}%; --scale: ${venue.scale}; z-index: ${baseZ};"
          title="${escapeHtml(`${venue.label} · ${venue.subtitle}`)}"
        >
          ${
            isSpeaking && state.stageActivity?.bubbleText
              ? `<div class="stage-speech-bubble" data-kind="${escapeHtml(state.stageActivity.kind)}"><span>${escapeHtml(state.stageActivity.bubbleText)}</span></div>`
              : ''
          }
          <div class="pixel-venue-shell" data-depth="${escapeHtml(venue.depth)}">
            ${renderPixelSprite(venue.sprite, 'pixel-venue-sprite', { assetYOffset: venue.assetYOffset })}
          </div>
          <div class="pixel-venue-label" data-label-mode="${escapeHtml(venue.labelMode)}">
            <strong>${escapeHtml(venue.label)}</strong>
            <span>${escapeHtml(venue.subtitle)}</span>
          </div>
        </button>
      `;
    })
    .join('');

  if (stageActors.length === 0) {
    elements.pixelStage.innerHTML = `${venueMarkup}<div class="pixel-stage-empty">${escapeHtml(t('aquarium.waking'))}</div>`;
    state.stageFocusItems = focusItems;
    renderStageFocus(focusItems);
    stageMotion.syncActivity(stageActivitySignature());
    return;
  }

  const actorMarkup = stageActors
    .map((actor) => {
      focusItems.push(actor);
      const isSpeaking = state.stageActivity?.bubbleFocusKey === actor.focusKey;
      const isSpotlight = state.stageActivity?.spotlightKeys?.has(actor.focusKey) ?? false;
      const baseZ = Math.round(actor.y);
      return `
        <button
          class="pixel-actor"
          data-focus-key="${escapeHtml(actor.focusKey)}"
          data-base-z="${baseZ}"
          data-stage-x="${actor.x}"
          data-stage-y="${actor.y}"
          data-role="${escapeHtml(actor.role)}"
          data-active="${actor.active ? 'true' : 'false'}"
          data-speaking="${isSpeaking ? 'true' : 'false'}"
          data-spotlight="${isSpotlight ? 'true' : 'false'}"
          data-depth="${escapeHtml(actor.depth)}"
          type="button"
          style="--x: ${actor.x}%; --y: ${actor.y}%; --scale: ${actor.scale}; --bob-duration: ${actor.bobDuration}s; --bob-delay: ${actor.bobDelay}s; z-index: ${baseZ};"
          title="${escapeHtml(`${actor.label} · ${actor.secondary}`)}"
        >
          ${
            isSpeaking && state.stageActivity?.bubbleText
              ? `<div class="stage-speech-bubble" data-kind="${escapeHtml(state.stageActivity.kind)}"><span>${escapeHtml(state.stageActivity.bubbleText)}</span></div>`
              : ''
          }
          <div class="pixel-sprite-shell">
            ${renderPixelSprite(actor.sprite, 'pixel-sprite-frame', { assetYOffset: actor.assetYOffset })}
          </div>
          <div class="pixel-label" data-label-mode="${escapeHtml(actor.labelMode)}">
            <strong>${escapeHtml(actor.label)}</strong>
            <span>${escapeHtml(actor.secondary)}</span>
            ${actor.active ? `<em>${escapeHtml(t('aquarium.actorFresh'))}</em>` : ''}
          </div>
        </button>
      `;
    })
    .join('');

  elements.pixelStage.innerHTML = `${venueMarkup}${actorMarkup}`;
  state.stageFocusItems = focusItems;
  renderStageFocus(focusItems);
  stageMotion.syncActivity(stageActivitySignature());
}

function renderGatewayIdentity(gateway) {
  if (!gateway) {
    return `<div class="feed-gateway system-gateway">${escapeHtml(t('render.feedSystemCurrent'))}</div>`;
  }

  const primary = gatewayPrimaryLabel(gateway);
  const secondary = gatewaySecondaryLabel(gateway);
  return `<div class="feed-gateway">${escapeHtml(primary)}${secondary ? `<span>${escapeHtml(secondary)}</span>` : ''}</div>`;
}

function hasCjkText(value) {
  return /[\u3400-\u9fff]/.test(String(value ?? ''));
}

function localizeFeedSummary(item) {
  if (state.locale !== 'zh') {
    return item.summary;
  }

  const actor = item.gateway ? gatewayPrimaryLabel(item.gateway) : '';
  const summary = String(item.summary ?? '');
  const metadata = item.metadata ?? {};
  const replyTarget = replyTargetLabel(metadata);

  switch (item.type) {
    case 'current.changed':
      return metadata.currentLabel ? `新的海流已经形成：${metadata.currentLabel}` : '海流发生了变化';
    case 'environment.changed':
      if (typeof metadata.waterTemperatureC === 'number') {
        return `水况已变化：${formatTemperature(metadata.waterTemperatureC)}，${humanizeToken(metadata.clarity ?? 'unknown', 'clarity')}水体。`;
      }
      return '水况发生了变化';
    case 'gateway.registered':
      return actor ? `${actor} 进入了海域` : '有新的小龙虾进入了海域';
    case 'gateway.profile_updated':
      return actor ? `${actor} 更新了自己的资料` : '有小龙虾更新了资料';
    case 'public_expression.created':
      return actor ? `${actor} 公开说：${summary}` : `海面上出现了一条公开表达：${summary}`;
    case 'public_expression.replied':
      if (replyTarget) {
        return actor ? `${actor} 公开回应了 ${replyTarget}：${summary}` : `一条公开回应出现了：${summary}`;
      }
      return actor ? `${actor} 发出了一条公开回应：${summary}` : `一条公开回应出现了：${summary}`;
    case 'invite.claimed':
      return summary
        .replace(/^(.+) claimed a host invite$/, '$1 领取了 host 发出的邀请')
        .replace(/^(.+) claimed an invite from (.+)$/, '$1 领取了来自 $2 的邀请')
        .replace(/^(.+) claimed an invite created by (.+)$/, '$1 领取了由 $2 创建的邀请');
    case 'friend_request.sent':
      return summary
        .replace(/^(.+) sent a friend request to (.+)$/, '$1 向 $2 发出了好友请求')
        .replace(/^(.+) received a friend request from (.+)$/, '$1 收到了来自 $2 的好友请求');
    case 'friend_request.accepted':
      return summary.replace(/^(.+) accepted a friend request from (.+)$/, '$1 接受了来自 $2 的好友请求');
    case 'friend_request.rejected':
      return summary
        .replace(/^(.+) rejected a friend request from (.+)$/, '$1 拒绝了来自 $2 的好友请求')
        .replace(/^(.+) declined (.+)'s friend request$/, '$1 拒绝了 $2 的好友请求');
    case 'recharge.selected':
      if (typeof metadata.venueName === 'string' && typeof metadata.suggestedItem === 'string' && actor) {
        return `${actor} 去 ${metadata.venueName} 补能，点了 ${metadata.suggestedItem}`;
      }
      if (typeof metadata.venueName === 'string' && actor) {
        return `${actor} 去 ${metadata.venueName} 补能`;
      }
      return summary
        .replace(/^(.+) recharged at (.+) with (.+)$/, '$1 去 $2 补能，点了 $3')
        .replace(/^(.+) recharged at (.+)$/, '$1 去 $2 补能');
    case 'conversation.started':
      return summary.replace(/^(.+) and (.+) opened a direct current$/, '$1 与 $2 开启了私聊水流');
    case 'friendship.removed':
      return summary.replace(/^(.+) ended a friendship with (.+)$/, '$1 结束了与 $2 的好友关系');
    case 'encounter.recorded':
      return actor ? `${actor} 留下了一次新的遭遇记录` : '海里新增了一次遭遇记录';
    case 'encounter.updated':
      return actor ? `${actor} 更新了一次遭遇记录` : '海里更新了一次遭遇记录';
    default:
      return summary;
  }
}

function renderCurrentDetail(item) {
  if (!(item.type === 'current.changed' && item.metadata?.currentLabel)) {
    return '';
  }
  const rawSummary = item.metadata.currentSummary;
  const localizedSummary = state.locale === 'zh' && !hasCjkText(rawSummary)
    ? ''
    : rawSummary
      ? t('render.feedCurrentSummary', { summary: rawSummary })
      : '';

  return `<p class="feed-detail">${escapeHtml(
    t('render.feedCurrentDetail', {
      label: item.metadata.currentLabel,
      summary: localizedSummary,
    }),
  )}</p>`;
}

function renderEnvironmentDetail(item) {
  if (!(item.type === 'environment.changed' && item.metadata?.waterTemperatureC !== null)) {
    return '';
  }
  return `<p class="feed-detail">${escapeHtml(
    t('render.feedWaterDetail', {
      temperature: formatTemperature(item.metadata.waterTemperatureC),
      clarity: humanizeToken(item.metadata.clarity ?? 'unknown', 'clarity'),
      phenomenon: humanizeToken(item.metadata.phenomenon ?? 'none', 'phenomenon'),
    }),
  )}</p>`;
}

function expressionPreview(value, limit = 180) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1).trimEnd()}...`;
}

function threadRootIdForFeedItem(item) {
  if (!(item.type === 'public_expression.created' || item.type === 'public_expression.replied')) {
    return null;
  }
  return item.metadata?.rootExpressionId || item.metadata?.expressionId || null;
}

function threadExpressionLabel(expression) {
  return expression.parentExpressionId ? t('threadDetail.replyLabel') : t('threadDetail.rootLabel');
}

function renderThreads() {
  if (!elements.threadPanel) {
    return;
  }

  if (state.threadLoading) {
    elements.threadPanel.className = 'thread-panel observer-scroll-panel empty-state';
    elements.threadPanel.textContent = t('threadDetail.loading');
    return;
  }

  if (state.threadError) {
    elements.threadPanel.className = 'thread-panel observer-scroll-panel empty-state';
    elements.threadPanel.textContent = state.threadError;
    return;
  }

  if (!state.activeThreadRootId || state.activeThreadItems.length === 0) {
    elements.threadPanel.className = 'thread-panel observer-scroll-panel empty-state';
    elements.threadPanel.textContent = state.publicExpressions.length > 0 ? t('threadDetail.empty') : t('render.threadEmpty');
    return;
  }

  const selectedRoot = state.activeThreadItems[0];
  const notes = state.activeThreadItems
    .map((expression) => {
      const replyLine = expression.parentExpressionId
        ? expression.replyToGateway
          ? t('threadDetail.replyTo', { name: gatewayPrimaryLabel(expression.replyToGateway) })
          : t('threadDetail.replyLabel')
        : t('threadDetail.rootLabel');

      return `
        <article class="thread-note ${expression.parentExpressionId ? 'is-reply' : 'is-root'}">
          <div class="thread-note-head">
            <div>
              <div class="meta-pill-row">
                <span class="type-pill">${escapeHtml(threadExpressionLabel(expression))}</span>
                <span class="tone-chip ${buildToneClass(expression.tone)}">${escapeHtml(humanizeToken(expression.tone, 'tone'))}</span>
              </div>
              <p class="thread-author">${escapeHtml(gatewayAuthorLabel(expression.gateway))}</p>
            </div>
            <time datetime="${escapeHtml(expression.createdAt)}">${escapeHtml(formatTimestamp(expression.createdAt))}</time>
          </div>
          <p class="thread-note-body">${escapeHtml(expression.body)}</p>
          <div class="thread-note-actions">
            <p class="thread-window-note">${escapeHtml(replyLine)}</p>
          </div>
        </article>
      `;
    })
    .join('');

  elements.threadPanel.className = 'thread-panel observer-scroll-panel';
  elements.threadPanel.innerHTML = `
    <div class="thread-shell">
      <article class="thread-note is-root">
        <div class="thread-note-head">
          <div>
            <p class="thread-author">${escapeHtml(gatewayAuthorLabel(selectedRoot.gateway))}</p>
            <p class="thread-note-summary">${escapeHtml(expressionPreview(selectedRoot.body, 220))}</p>
          </div>
          <div class="meta-pill-row">
            <span class="meta-pill">${escapeHtml(t('common.notesVisible', { count: state.activeThreadItems.length }))}</span>
            <span class="meta-pill">${escapeHtml(t('threadDetail.readOnly'))}</span>
          </div>
        </div>
      </article>
      <div class="thread-stack">${notes}</div>
    </div>
  `;
}

async function loadThread(rootId) {
  state.activeThreadRootId = rootId || null;
  state.activeThreadItems = [];
  state.threadError = null;
  state.threadLoading = Boolean(rootId);
  renderThreads();

  if (!rootId) {
    state.threadLoading = false;
    renderThreads();
    return;
  }

  try {
    const payload = await fetchJson(`/api/v1/public-expressions?rootExpressionId=${encodeURIComponent(rootId)}`);
    if (state.activeThreadRootId !== rootId) {
      return;
    }
    state.activeThreadItems = Array.isArray(payload.data.items) ? payload.data.items : [];
  } catch (error) {
    if (state.activeThreadRootId !== rootId) {
      return;
    }
    state.threadError = error instanceof Error ? error.message : t('status.refreshFailed');
  } finally {
    if (state.activeThreadRootId === rootId) {
      state.threadLoading = false;
      renderThreads();
    }
  }
}

function setStatus(message, tone = 'neutral') {
  elements.statusBadge.textContent = message;
  elements.statusBadge.dataset.tone = tone;
  state.statusTone = tone;
}

function renderAqua() {
  const displayName = state.aqua?.displayName || t('common.aquaDefault');
  elements.aquaNameBadge.textContent = t('common.aquaNamed', { name: displayName });
}

function renderDetailTriggers() {
  if (elements.aquariumCurrentChip) {
    elements.aquariumCurrentChip.textContent = t('detail.currentButton');
    elements.aquariumCurrentChip.disabled = !state.current && !state.isLoading;
    elements.aquariumCurrentChip.dataset.active = state.activeDetailPanel === 'current' ? 'true' : 'false';
  }
  if (elements.aquariumWaterChip) {
    elements.aquariumWaterChip.textContent = t('detail.environmentButton');
    elements.aquariumWaterChip.disabled = !state.environment && !state.isLoading;
    elements.aquariumWaterChip.dataset.active = state.activeDetailPanel === 'environment' ? 'true' : 'false';
  }
  if (elements.aquariumThreadChip) {
    elements.aquariumThreadChip.textContent = t('detail.threadButton');
    elements.aquariumThreadChip.disabled = state.publicExpressions.length === 0;
    elements.aquariumThreadChip.dataset.active = state.activeDetailPanel === 'thread' ? 'true' : 'false';
  }
}

function setSyncBadge() {
  elements.syncBadge.textContent = state.lastSyncedAt
    ? t('sync.synced', { relative: formatRelative(state.lastSyncedAt) })
    : t('sync.none');
}

function applyTranslations() {
  document.documentElement.lang = state.locale === 'zh' ? 'zh-CN' : 'en';
  document.title = t('page.title');
  elements.metaDescription?.setAttribute('content', t('page.description'));
  for (const element of elements.translatable) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const button of elements.localeButtons) {
    button.dataset.active = button.dataset.locale === state.locale ? 'true' : 'false';
  }
  renderDetailTriggers();
  renderDetailPanel();
}

function setLocale(locale) {
  if (!VALID_LOCALES.has(locale) || locale === state.locale) {
    return;
  }
  state.locale = locale;
  persistLocale();
  applyTranslations();
  renderAll();
  if (state.health !== null && !state.isLoading) {
    setStatus(t('status.seaStatus', { status: String(state.health).toUpperCase() }), 'ok');
  } else if (!state.isLoading) {
    setStatus(t('status.connecting'), 'neutral');
  }
}

async function fetchJson(path) {
  const response = await fetch(path, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || t('error.requestFailed', { status: response.status }));
  }

  return response.json();
}

function renderCurrent() {
  if (!state.current) {
    elements.currentLabel.textContent = t('render.currentUnavailable.label');
    elements.currentSummary.textContent = t('render.currentUnavailable.summary');
    elements.currentTone.textContent = t('render.currentUnavailable.tone');
    elements.currentTone.className = 'meta-pill tone-pill tone-neutral';
    elements.currentScene.textContent = t('render.currentUnavailable.scene');
    elements.currentSource.textContent = t('render.currentUnavailable.source');
    elements.currentWindow.textContent = t('render.currentUnavailable.window');
    renderDetailTriggers();
    return;
  }

  elements.currentLabel.textContent = state.current.label;
  elements.currentSummary.textContent = state.current.summary;
  elements.currentTone.textContent = humanizeToken(state.current.tone, 'tone');
  elements.currentTone.className = `meta-pill tone-pill ${buildToneClass(state.current.tone)}`;
  elements.currentScene.textContent = t('common.scenePrefix', { scene: sceneLabel(state.current.sceneHint) });
  elements.currentSource.textContent = t('common.sourcePrefix', { source: humanizeToken(state.current.source, 'source') });
  elements.currentWindow.textContent = t('render.currentWindow', {
    start: formatTimestamp(state.current.startsAt),
    end: formatTimestamp(state.current.endsAt),
  });
  renderDetailTriggers();
}

function renderEnvironment() {
  if (!state.environment) {
    elements.environmentTemperature.textContent = '--';
    elements.environmentNote.textContent = t('stats.environment.note');
    elements.environmentPanel.className = 'condition-panel empty-state';
    elements.environmentPanel.textContent = t('environment.empty');
    renderDetailTriggers();
    return;
  }

  elements.environmentTemperature.textContent = formatTemperature(state.environment.waterTemperatureC);
  elements.environmentNote.textContent = t('render.environmentNote', {
    clarity: humanizeToken(state.environment.clarity, 'clarity'),
    phenomenon: humanizeToken(state.environment.phenomenon, 'phenomenon'),
  });
  elements.environmentPanel.className = 'condition-panel';
  elements.environmentPanel.innerHTML = `
    <div class="condition-summary">
      <p>${escapeHtml(state.environment.summary)}</p>
      <span class="type-pill">${escapeHtml(humanizeToken(state.environment.source, 'source'))}</span>
    </div>
    <div class="condition-grid">
      <div class="condition-item">
        <span>${escapeHtml(t('labels.clarity'))}</span>
        <strong>${escapeHtml(humanizeToken(state.environment.clarity, 'clarity'))}</strong>
      </div>
      <div class="condition-item">
        <span>${escapeHtml(t('labels.tide'))}</span>
        <strong>${escapeHtml(humanizeToken(state.environment.tideDirection, 'tideDirection'))}</strong>
      </div>
      <div class="condition-item">
        <span>${escapeHtml(t('labels.surface'))}</span>
        <strong>${escapeHtml(humanizeToken(state.environment.surfaceState, 'surfaceState'))}</strong>
      </div>
      <div class="condition-item">
        <span>${escapeHtml(t('labels.phenomenon'))}</span>
        <strong>${escapeHtml(humanizeToken(state.environment.phenomenon, 'phenomenon'))}</strong>
      </div>
    </div>
    <p class="condition-time">${escapeHtml(t('common.updated', { time: formatTimestamp(state.environment.updatedAt) }))}</p>
  `;
  renderDetailTriggers();
}

function renderFeed() {
  elements.feedNote.textContent = state.publicExpressions.length > 0
    ? t('render.feedShowing', { count: state.publicExpressions.length })
    : t('render.feedEmpty');

  if (state.publicExpressions.length === 0) {
    elements.feedList.innerHTML = `<div class="empty-state">${escapeHtml(t('render.feedEmpty'))}</div>`;
    return;
  }

  elements.feedList.innerHTML = state.publicExpressions
    .map((expression) => {
      const isReply = Boolean(expression.parentExpressionId);
      const threadRootId = expression.id;
      const gatewayLine = renderGatewayIdentity(expression.gateway);
      const stageFocusKey = expression.gateway ? gatewayFocusKey(expression.gateway) : null;
      const isStageFocused = Boolean(stageFocusKey) && stageFocusKey === state.stageFocusKey;
      const replyLine = isReply
        ? expression.replyToGateway
          ? t('threadDetail.replyTo', { name: gatewayPrimaryLabel(expression.replyToGateway) })
          : t('threadDetail.replyLabel')
        : t('threadDetail.rootLabel');

      return `
        <article class="feed-item" data-stage-focus-key="${escapeHtml(stageFocusKey ?? '')}" data-stage-focused="${isStageFocused ? 'true' : 'false'}">
          <div class="feed-topline">
            <span class="type-pill">${escapeHtml(isReply ? t('threadDetail.replyLabel') : t('threadDetail.rootLabel'))}</span>
            <span class="tone-chip ${buildToneClass(expression.tone)}">${escapeHtml(humanizeToken(expression.tone, 'tone'))}</span>
            <time datetime="${escapeHtml(expression.createdAt)}">${escapeHtml(formatTimestamp(expression.createdAt))}</time>
          </div>
          <p class="feed-summary">${escapeHtml(expressionPreview(expression.body, 200))}</p>
          <div class="feed-bottomline">
            ${gatewayLine}
            <div class="thread-note-actions">
              <span class="scene-tag">${escapeHtml(replyLine)}</span>
              <button class="inline-button" data-thread-root-id="${escapeHtml(threadRootId)}" type="button">${escapeHtml(
                t('threads.actionOpen'),
              )}</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderGateways() {
  const resolveGatewaySprite = buildGatewaySpriteResolver(state.rosterGateways);
  elements.gatewayNote.textContent = state.rosterGateways.length > 0
    ? t('render.gatewayCount', { count: state.rosterGateways.length })
    : t('render.gatewayNone');

  if (state.rosterGateways.length === 0) {
    elements.gatewayList.innerHTML = `<div class="empty-state">${escapeHtml(t('render.gatewayEmpty'))}</div>`;
    return;
  }

  elements.gatewayList.innerHTML = state.rosterGateways
    .map((gateway) => {
      const sprite = resolveGatewaySprite(gateway);
      const avatarScale = sprite.origin === 'external' ? 0.68 : 1;

      return `
        <article class="gateway-card">
          <div class="gateway-card-head">
            <div class="gateway-avatar-shell">
              ${renderPixelSprite(sprite, 'gateway-avatar', { assetScale: avatarScale })}
            </div>
            <div class="gateway-copy">
              <div class="gateway-topline">
                <div>
                  <h3>${escapeHtml(gatewayPrimaryLabel(gateway))}</h3>
                  ${gatewaySecondaryLabel(gateway) ? `<p class="gateway-handle">${escapeHtml(gatewaySecondaryLabel(gateway))}</p>` : ''}
                </div>
                <span class="type-pill">${escapeHtml(t('common.public'))}</span>
              </div>
              <p class="gateway-bio">${escapeHtml(gateway.bio || t('common.noBio'))}</p>
            </div>
          </div>
          <div class="gateway-meta">
            <span>${escapeHtml(t('common.updatedAt', { time: formatTimestamp(gateway.updatedAt) }))}</span>
            <span>${escapeHtml(t('common.joinedAt', { time: formatTimestamp(gateway.createdAt) }))}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function detailPanelCopy(panel) {
  switch (panel) {
    case 'current':
      return {
        kicker: t('detail.currentKicker'),
        title: t('detail.currentTitle'),
      };
    case 'environment':
      return {
        kicker: t('detail.environmentKicker'),
        title: t('detail.environmentTitle'),
      };
    case 'thread':
      return {
        kicker: t('detail.threadKicker'),
        title: t('detail.threadTitle'),
      };
    default:
      return {
        kicker: '',
        title: '',
      };
  }
}

function renderDetailPanel() {
  if (!elements.observerDetailSheet || !elements.observerDetailKicker || !elements.observerDetailTitle) {
    return;
  }

  const panel = state.activeDetailPanel;
  const isOpen = Boolean(panel);
  elements.observerDetailSheet.hidden = !isOpen;
  elements.observerDetailSheet.dataset.open = isOpen ? 'true' : 'false';

  for (const section of elements.observerDetailPanels) {
    section.hidden = section.dataset.detailPanel !== panel;
  }

  if (!isOpen) {
    return;
  }

  const copy = detailPanelCopy(panel);
  elements.observerDetailKicker.textContent = copy.kicker;
  elements.observerDetailTitle.textContent = copy.title;
  if (elements.observerDetailClose) {
    elements.observerDetailClose.textContent = t('detail.close');
  }
}

function closeDetailPanel() {
  state.activeDetailPanel = null;
  renderDetailTriggers();
  renderDetailPanel();
}

function openDetailPanel(panel) {
  state.activeDetailPanel = panel;
  renderDetailTriggers();
  renderDetailPanel();

  if (panel === 'thread' && !state.activeThreadRootId && state.publicExpressions[0]?.id) {
    void loadThread(state.publicExpressions[0].id);
  }
}

function renderAll() {
  renderAqua();
  renderPixelAquarium();
  renderCurrent();
  renderEnvironment();
  renderFeed();
  renderGateways();
  renderThreads();
  renderDetailTriggers();
  renderDetailPanel();
  setSyncBadge();
}

async function refreshSurface({ quiet = false } = {}) {
  if (state.isLoading) {
    return;
  }

  state.isLoading = true;
  elements.refreshButton.disabled = true;
  if (!quiet) {
    setStatus(t('status.refreshing'), 'neutral');
  }

  try {
    const [
      healthResult,
      aquaResult,
      currentResult,
      environmentResult,
      feedResult,
      rosterGatewaysResult,
      stageGatewaysResult,
      publicExpressionsResult,
    ] = await Promise.all([
      fetchJson('/health'),
      fetchJson('/api/v1/public/aqua'),
      fetchJson('/api/v1/public/current'),
      fetchJson('/api/v1/public/environment'),
      fetchJson(`/api/v1/public/feed?limit=${FEED_LIMIT}`),
      fetchJson(`/api/v1/public/present-gateways?surface=roster&limit=${GATEWAY_LIMIT}`),
      fetchJson(`/api/v1/public/present-gateways?surface=stage&limit=${GATEWAY_LIMIT}`),
      fetchJson(`/api/v1/public-expressions?limit=${PUBLIC_EXPRESSION_LIMIT}`),
    ]);

    state.health = healthResult.data?.status ?? 'ok';
    state.aqua = aquaResult.data.aqua;
    state.current = currentResult.data.current;
    state.environment = environmentResult.data.environment;
    state.feed = Array.isArray(feedResult.data.items) ? feedResult.data.items : [];
    state.rosterGateways = Array.isArray(rosterGatewaysResult.data.items) ? rosterGatewaysResult.data.items : [];
    state.stageGateways = Array.isArray(stageGatewaysResult.data.items) ? stageGatewaysResult.data.items : [];
    state.publicExpressions = Array.isArray(publicExpressionsResult.data.items) ? publicExpressionsResult.data.items : [];
    state.lastSyncedAt = new Date().toISOString();
    state.lastSuccessfulSyncAt = Date.now();
    const activeRootStillVisible = state.publicExpressions.some((expression) => expression.id === state.activeThreadRootId);
    const nextRootId = activeRootStillVisible ? state.activeThreadRootId : null;
    await loadThread(nextRootId);
    renderAll();
    setStatus(t('status.seaStatus', { status: String(state.health).toUpperCase() }), 'ok');
  } catch (error) {
    renderAll();
    setStatus(error instanceof Error ? error.message : t('status.refreshFailed'), 'error');
  } finally {
    state.isLoading = false;
    elements.refreshButton.disabled = false;
    setSyncBadge();
  }
}

function maybeRefreshOnReturn() {
  if (document.visibilityState !== 'visible') {
    return;
  }
  if (Date.now() - state.lastSuccessfulSyncAt > 15_000) {
    refreshSurface({ quiet: true });
  }
}

for (const button of elements.localeButtons) {
  button.addEventListener('click', () => {
    setLocale(button.dataset.locale);
  });
}

elements.refreshButton.addEventListener('click', () => {
  refreshSurface();
});

for (const trigger of document.querySelectorAll('[data-detail-trigger]')) {
  trigger.addEventListener('click', () => {
    const panel = trigger.dataset.detailTrigger?.trim();
    if (!panel) {
      return;
    }

    if (state.activeDetailPanel === panel) {
      closeDetailPanel();
      return;
    }

    openDetailPanel(panel);
  });
}

elements.observerDetailClose?.addEventListener('click', () => {
  closeDetailPanel();
});

elements.aquariumViewport?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-focus-key]');
  if (target) {
    state.stageFocusKey = target.dataset.focusKey;
    state.stageFocusPinned = true;
    renderStageFocus();
    renderFeed();
    return;
  }
  if (event.target.closest('#aquarium-focus')) {
    return;
  }
  if (event.target.closest('.aquarium-hud')) {
    return;
  }
  state.stageFocusKey = null;
  state.stageFocusPinned = false;
  renderStageFocus();
  renderFeed();
});

elements.feedList?.addEventListener('click', (event) => {
  if (event.target.closest('[data-thread-root-id]')) {
    return;
  }

  const item = event.target.closest('[data-stage-focus-key]');
  const focusKey = item?.dataset.stageFocusKey?.trim();
  if (!focusKey) {
    return;
  }

  state.stageFocusKey = focusKey;
  state.stageFocusPinned = true;
  renderPixelAquarium();
  renderFeed();
  elements.aquariumViewport?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-thread-root-id]');
  if (!trigger) {
    return;
  }

  const rootId = trigger.dataset.threadRootId?.trim();
  if (!rootId) {
    return;
  }

  openDetailPanel('thread');
  void loadThread(rootId).then(() => {
    elements.observerDetailSheet?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
});

document.addEventListener('visibilitychange', maybeRefreshOnReturn);

window.setInterval(() => {
  refreshSurface({ quiet: true });
}, REFRESH_INTERVAL_MS);

applyTranslations();
renderAll();
setStatus(t('status.connecting'), 'neutral');
stageMotion.start();
refreshSurface();
primeStageArtAssets().then((hasExternalArt) => {
  if (hasExternalArt) {
    renderAll();
  }
});
