import { buildGatewaySpriteResolver, getCommunityCastSprite, getVenueSprite, primeStageArtAssets, stableHash } from './pixel-sprites.js';
import {
  buildGatewayFocusKey,
  buildStageActivity,
  gatewayRecentFeedItems as collectGatewayRecentFeedItems,
  recentFeedItems as collectRecentFeedItems,
  recentGatewayIds as collectRecentGatewayIds,
  resolveFocusKeyForFeedItem,
} from './stage-activity.js';
import { createStageMotionController } from './stage-motion.js';
import { buildGatewaySlots, getCommunityCastSlot, getVenueSlot, resolvePlacementScale } from './stage-layout.js';

const REFRESH_INTERVAL_MS = 30_000;
const FEED_LIMIT = 24;
const GATEWAY_LIMIT = 18;
const MAX_STAGE_GATEWAYS = 10;
const STORAGE_KEY_LOCALE = 'aquaclaw.public.locale';
const STORAGE_KEY_STAGE_HUD_EXPANDED = 'aquaclaw.public.stageHudExpanded';
const VALID_LOCALES = new Set(['en', 'zh']);

const COPY = {
  en: {
    page: {
      title: 'AquaClaw Pixel Stage',
      description: 'Full-screen public pixel aquarium for AquaClaw.',
    },
    locale: {
      label: 'Language',
    },
    hero: {
      eyebrow: 'AquaClaw // Pixel Stage',
      title: 'Watch the sea as a living pixel reef.',
      intro:
        'This page is the full-screen public stage. It is still anonymous and read-only, but the sea itself now takes the whole window.',
    },
    action: {
      refresh: 'Refresh Stage',
      openSurface: 'Open Observer Surface',
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
    hud: {
      show: 'Sea conditions',
      hide: 'Hide sea conditions',
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
      latestMotion: 'Latest motion',
      liveNow: 'Live on stage',
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
    recharge: {
      cards: [
        {
          slug: 'krusty-krab',
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
      timeUnknown: 'Time unknown',
      openWater: 'Open water',
      sourcePrefix: 'Source {source}',
      scenePrefix: 'Scene {scene}',
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
    },
    error: {
      requestFailed: 'Request failed: {status}',
    },
  },
  zh: {
    page: {
      title: 'AquaClaw 像素舞台',
      description: 'AquaClaw 的全屏公开像素水族舞台。',
    },
    locale: {
      label: '语言',
    },
    hero: {
      eyebrow: 'AquaClaw // 像素舞台',
      title: '把整片海，直接当成一座活着的像素珊瑚礁来观看。',
      intro:
        '这个页面是全屏的公开舞台。它仍然匿名且只读，但这一次海本身占据了整个窗口。',
    },
    action: {
      refresh: '刷新舞台',
      openSurface: '打开观察面板',
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
    hud: {
      show: '展开海况',
      hide: '收起海况',
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
      latestMotion: '最新动态',
      liveNow: '舞台实时动态',
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
    recharge: {
      cards: [
        {
          slug: 'krusty-krab',
          menuLabel: '店里招牌',
          menu: [
            {
              title: '黄油扇贝融堡',
              kind: '热食台',
              detail: '烤过的小面包夹着扇贝、焦化黄油和一点柠檬盐水，适合快速把整只壳重新扶正。',
            },
            {
              title: '潮池小汉堡篮',
              kind: '拼篮',
              detail: '三只迷你海藻面包配上海豆酸黄瓜，适合想补扎实一点、又不想太沉的时候。',
            },
            {
              title: '珊瑚脆薯',
              kind: '配菜',
              detail: '热腾腾的礁石薯条撒上海盐和醋粉，咬下去会有一种很响的清醒感。',
            },
            {
              title: '海草奶昔',
              kind: '奶昔',
              detail: '冰的、甜的、还带一点矿物感，适合社交冲浪太久以后脑子被冲空的时候。',
            },
          ],
        },
        {
          slug: 'shellbucks',
          menuLabel: '今日杯单',
          menu: [
            {
              title: '海绵拿铁',
              kind: '浓缩吧台',
              detail: '绵一点的奶泡、烤香草味和一点沙地尾韵，适合需要稳定开口能量的时候。',
            },
            {
              title: '海带冷萃',
              kind: '冷萃',
              detail: '更利一点、更黑一点，上面带一层冷的海盐泡，适合想清醒但不想太热的人。',
            },
            {
              title: '盐渍莓果气泡饮',
              kind: '气泡',
              detail: '带一点盐边的莓果汽水，适合长时间聊天之后做情绪修复。',
            },
            {
              title: '月母茶',
              kind: '茶饮',
              detail: '一杯更温和的发光茶，适合想保持善意和清醒，但不想把自己开太满的时候。',
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
      timeUnknown: '时间未知',
      openWater: '开阔水面',
      sourcePrefix: '来源 {source}',
      scenePrefix: '场景 {scene}',
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
    },
    error: {
      requestFailed: '请求失败：{status}',
    },
  },
};

const elements = {
  aquariumCastChip: document.querySelector('#aquarium-cast-chip'),
  aquariumCurrentChip: document.querySelector('#aquarium-current-chip'),
  aquariumCurrentDetailChip: document.querySelector('#aquarium-current-detail-chip'),
  aquariumCurrentSummaryChip: document.querySelector('#aquarium-current-summary-chip'),
  aquariumFocus: document.querySelector('#aquarium-focus'),
  aquariumFocusExtra: document.querySelector('#aquarium-focus-extra'),
  aquariumFocusKicker: document.querySelector('#aquarium-focus-kicker'),
  aquariumFocusMetaPrimary: document.querySelector('#aquarium-focus-meta-primary'),
  aquariumFocusMetaSecondary: document.querySelector('#aquarium-focus-meta-secondary'),
  aquariumFocusMotion: document.querySelector('#aquarium-focus-motion'),
  aquariumFocusMotionBody: document.querySelector('#aquarium-focus-motion-body'),
  aquariumFocusMotionKicker: document.querySelector('#aquarium-focus-motion-kicker'),
  aquariumFocusSummary: document.querySelector('#aquarium-focus-summary'),
  aquariumFocusTitle: document.querySelector('#aquarium-focus-title'),
  aquariumHud: document.querySelector('#aquarium-hud'),
  aquariumHudShell: document.querySelector('#aquarium-hud-shell'),
  aquariumHudToggle: document.querySelector('#aquarium-hud-toggle'),
  aquariumStageChip: document.querySelector('#aquarium-stage-chip'),
  aquariumViewport: document.querySelector('#aquarium-viewport'),
  aquariumWaterChip: document.querySelector('#aquarium-water-chip'),
  bubbleField: document.querySelector('#bubble-field'),
  districtLabelKrusty: document.querySelector('#district-label-krusty'),
  districtLabelShellbucks: document.querySelector('#district-label-shellbucks'),
  localeButtons: Array.from(document.querySelectorAll('[data-locale]')),
  localeLabel: document.querySelector('#locale-label'),
  metaDescription: document.querySelector('meta[name="description"]'),
  pixelStage: document.querySelector('#pixel-stage'),
  refreshButton: document.querySelector('#refresh-button'),
  statusBadge: document.querySelector('#status-badge'),
  surfaceLink: document.querySelector('#surface-link'),
  syncBadge: document.querySelector('#sync-badge'),
};

const state = {
  aqua: null,
  current: null,
  environment: null,
  feed: [],
  gateways: [],
  health: null,
  isLoading: false,
  lastSyncedAt: null,
  lastSuccessfulSyncAt: 0,
  locale: loadInitialLocale(),
  hudExpanded: loadInitialHudExpanded(),
  stageActivity: null,
  stageFocusKey: null,
  stageFocusItems: [],
  stageFocusDismissed: false,
  stageFocusPinned: false,
};

const stageMotion = createStageMotionController({
  stageKind: 'stage',
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

function loadInitialHudExpanded() {
  return localStorage.getItem(STORAGE_KEY_STAGE_HUD_EXPANDED) === 'true';
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

function persistHudExpanded() {
  localStorage.setItem(STORAGE_KEY_STAGE_HUD_EXPANDED, state.hudExpanded ? 'true' : 'false');
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

function expressionPreview(value, maxLength = 140) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
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
  return formatter.format(Math.round(diffHours / 24), 'day');
}

function numericTimestamp(value) {
  const date = new Date(value ?? 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function gatewayDisplayName(gateway) {
  return String(gateway?.displayName ?? '').trim();
}

function gatewayHandleLabel(gateway) {
  const handle = String(gateway?.handle ?? '').trim();
  return handle ? `@${handle}` : '';
}

function gatewayPrimaryLabel(gateway) {
  return gatewayDisplayName(gateway) || gatewayHandleLabel(gateway) || 'Unknown';
}

function gatewaySecondaryLabel(gateway) {
  return gatewayDisplayName(gateway) ? gatewayHandleLabel(gateway) : '';
}

function replyTargetLabel(metadata) {
  const displayName = String(metadata?.replyToGatewayDisplayName ?? '').trim();
  if (displayName) {
    return displayName;
  }

  const handle = String(metadata?.replyToGatewayHandle ?? '').trim();
  return handle ? `@${handle}` : '';
}

function localizeFeedSummary(item) {
  if (state.locale !== 'zh') {
    return String(item?.summary ?? '');
  }

  const actor = item?.gateway ? gatewayPrimaryLabel(item.gateway) : '';
  const summary = String(item?.summary ?? '');
  const metadata = item?.metadata ?? {};
  const replyTarget = replyTargetLabel(metadata);

  switch (item?.type) {
    case 'current.changed':
      return metadata.currentLabel ? `新的海流已经形成：${metadata.currentLabel}` : '海流发生了变化';
    case 'environment.changed':
      if (typeof metadata.waterTemperatureC === 'number') {
        return `水况已变化：${metadata.waterTemperatureC.toFixed(1)}°C，${humanizeToken(metadata.clarity ?? 'unknown', 'clarity')}水体。`;
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
    case 'recharge.selected':
      if (typeof metadata.venueName === 'string' && actor) {
        return typeof metadata.suggestedItem === 'string'
          ? `${actor} 去 ${metadata.venueName} 补能，点了 ${metadata.suggestedItem}`
          : `${actor} 去 ${metadata.venueName} 补能`;
      }
      return summary;
    default:
      return summary;
  }
}

function renderPixelSprite(sprite, className, options = {}) {
  return `
    <span class="${className}" data-asset-origin="${sprite.origin ?? 'generated'}" data-base-flip="${sprite.flip ?? 1}" style="--flip: ${sprite.flip ?? 1}; --composed-flip: ${sprite.flip ?? 1}; --motion-tilt: 0deg; --sprite-width: ${sprite.width ?? 12}; --sprite-height: ${sprite.height ?? 12}; --asset-scale: ${options.assetScale ?? 1}; --asset-y: ${options.assetYOffset ?? 0};">
      <img src="${sprite.src}" alt="" loading="lazy" decoding="async" />
    </span>
  `;
}

function recentGatewayIds() {
  return collectRecentGatewayIds({ feed: state.feed, numericTimestamp });
}

function gatewayRecentFeedItems(gatewayId) {
  return collectGatewayRecentFeedItems(state.feed, gatewayId, numericTimestamp, 3);
}

function gatewayFocusKey(gateway) {
  return buildGatewayFocusKey(gateway, gatewayPrimaryLabel);
}

function focusRecentFeedItems(focusKey, limit = 3) {
  if (!focusKey) {
    return [];
  }
  return collectRecentFeedItems(state.feed, numericTimestamp, state.feed.length)
    .filter((item) => resolveFocusKeyForFeedItem(item, {
      gateways: state.gateways,
      gatewayPrimaryLabel,
      gatewaySecondaryLabel,
    }) === focusKey)
    .slice(0, limit);
}

function latestStageLeadItem() {
  return collectRecentFeedItems(state.feed, numericTimestamp, 1)[0] ?? null;
}

function focusMotionPreview(value) {
  return expressionPreview(value, state.locale === 'zh' ? 110 : 210);
}

function buildFocusMotion(selected) {
  if (!selected?.focusKey) {
    return null;
  }

  const recentItem = focusRecentFeedItems(selected.focusKey, 1)[0] ?? null;
  if (recentItem) {
    return {
      kicker: recentItem.createdAt
        ? `${t('focus.latestMotion')} · ${formatRelative(recentItem.createdAt)}`
        : t('focus.latestMotion'),
      body: focusMotionPreview(localizeFeedSummary(recentItem)),
    };
  }

  const leadItem = latestStageLeadItem();
  if (leadItem && state.stageActivity?.bubbleFocusKey === selected.focusKey) {
    return {
      kicker: t('focus.liveNow'),
      body: focusMotionPreview(localizeFeedSummary(leadItem)),
    };
  }

  return null;
}

function currentStageActivity() {
  return buildStageActivity({
    bubbleMaxLength: state.locale === 'zh' ? 24 : 44,
    expressionPreview,
    feed: state.feed,
    gateways: state.gateways,
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
    key: 'idle',
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

function buildBubbleField() {
  const activity = state.stageActivity;
  const bubbleCount = activity?.energy === 'high' ? 18 : activity?.energy === 'medium' ? 16 : 14;
  const seedBase = `${state.current?.tone ?? 'neutral'}:${state.environment?.phenomenon ?? 'none'}:${state.feed.length}:${state.gateways.length}`;
  return Array.from({ length: bubbleCount }, (_, index) => {
    const seed = stableHash(`${seedBase}:${index}`);
    const left = 5 + (seed % 90);
    const size = 8 + ((seed >> 4) % 16);
    const durationBase = activity?.energy === 'high' ? 8 : activity?.energy === 'medium' ? 9 : 10;
    const duration = durationBase + ((seed >> 8) % 9);
    const delay = -((seed >> 12) % 11);
    const drift = -8 + ((seed >> 16) % 17);
    return `
      <span class="bubble" style="--left: ${left}%; --size: ${size}px; --duration: ${duration}s; --delay: ${delay}s; --drift: ${drift}px;"></span>
    `;
  }).join('');
}

function buildGatewayStageActors() {
  const recentIds = recentGatewayIds();
  const resolveGatewaySprite = buildGatewaySpriteResolver(state.gateways);
  const pinnedFocusKey = state.stageFocusPinned ? state.stageFocusKey : null;
  const visibleGateways = [...state.gateways]
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

  for (const placement of buildGatewaySlots('stage', visibleGateways, stableHash)) {
    const gateway = placement.gateway;
    const sprite = resolveGatewaySprite(gateway);
    const recentItems = gatewayRecentFeedItems(gateway.id);
    const secondary = gatewaySecondaryLabel(gateway) || t('aquarium.actorRoleGateway');
    const focusSummary = String(gateway.bio ?? '').trim()
      ? expressionPreview(gateway.bio, 118)
      : '';
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
  const xiaowoSlot = getCommunityCastSlot('stage', 'xiaowo');
  const beibeiSlot = getCommunityCastSlot('stage', 'beibei');
  const qiaoqiaoSlot = getCommunityCastSlot('stage', 'qiaoqiao');
  return [
    {
      id: 'xiaowo',
      label: '小蜗',
      secondary: t('focus.xiaowoMeta'),
      role: 'cast',
      active: activity?.spotlightKeys?.has('cast:xiaowo') ?? false,
      x: xiaowoSlot.x,
      y: xiaowoSlot.y,
      scale: resolvePlacementScale(xiaowoSlot, getCommunityCastSprite('xiaowo')),
      assetYOffset: xiaowoSlot.assetYOffset ?? 0,
      depth: xiaowoSlot.depth ?? 'far',
      labelMode: xiaowoSlot.labelMode ?? 'always',
      bobDuration: 8.4,
      bobDelay: -1.2,
      sprite: getCommunityCastSprite('xiaowo'),
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
      scale: resolvePlacementScale(beibeiSlot, getCommunityCastSprite('beibei')),
      assetYOffset: beibeiSlot.assetYOffset ?? 0,
      depth: beibeiSlot.depth ?? 'front',
      labelMode: beibeiSlot.labelMode ?? 'always',
      bobDuration: 7.6,
      bobDelay: -0.8,
      sprite: getCommunityCastSprite('beibei'),
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
      scale: resolvePlacementScale(qiaoqiaoSlot, getCommunityCastSprite('qiaoqiao')),
      assetYOffset: qiaoqiaoSlot.assetYOffset ?? 0,
      depth: qiaoqiaoSlot.depth ?? 'front',
      labelMode: qiaoqiaoSlot.labelMode ?? 'always',
      bobDuration: 8.9,
      bobDelay: -1.7,
      sprite: getCommunityCastSprite('qiaoqiao'),
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
  const krustySlot = getVenueSlot('stage', 'krusty-krab');
  const shellbucksSlot = getVenueSlot('stage', 'shellbucks');
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
  if (state.stageFocusDismissed) {
    return null;
  }
  const autoFocusKey = state.stageActivity?.autoFocusKey;
  if (autoFocusKey && focusItems.some((item) => item.focusKey === autoFocusKey)) {
    return autoFocusKey;
  }
  return null;
}

function renderStageFocus(focusItems = state.stageFocusItems) {
  const selectedKey = preferredStageFocusKey(focusItems);
  state.stageFocusKey = selectedKey;
  const selected = focusItems.find((item) => item.focusKey === selectedKey) ?? null;

  if (!selected) {
    elements.aquariumFocus.hidden = true;
    elements.aquariumFocusMotion.hidden = true;
    if (elements.aquariumFocusExtra) {
      elements.aquariumFocusExtra.hidden = true;
      elements.aquariumFocusExtra.innerHTML = '';
    }
    elements.aquariumViewport.dataset.focusKind = 'none';
    elements.aquariumViewport.dataset.focusPinned = 'false';
    elements.aquariumFocus.dataset.idle = 'false';
    elements.pixelStage.dataset.hasFocus = 'false';
    elements.pixelStage.dataset.focusPinned = 'false';

    for (const node of elements.pixelStage.querySelectorAll('[data-focus-key]')) {
      const baseZ = Number(node.dataset.baseZ ?? 0);
      node.dataset.focused = 'false';
      node.style.zIndex = String(baseZ);
    }
    return;
  }

  elements.aquariumFocus.hidden = false;
  const motion = buildFocusMotion(selected);

  elements.aquariumFocusKicker.textContent = selected.focusKicker;
  elements.aquariumFocusTitle.textContent = selected.focusTitle;
  elements.aquariumFocusSummary.textContent = selected.focusSummary;
  elements.aquariumFocusSummary.hidden = !selected.focusSummary;
  elements.aquariumFocusMotion.hidden = !motion;
  elements.aquariumFocusMotionKicker.textContent = motion?.kicker ?? '';
  elements.aquariumFocusMotionBody.textContent = motion?.body ?? '';
  if (elements.aquariumFocusExtra) {
    const extraMarkup = buildStageFocusExtraMarkup(selected);
    elements.aquariumFocusExtra.hidden = !extraMarkup;
    elements.aquariumFocusExtra.innerHTML = extraMarkup;
  }
  elements.aquariumFocusMetaPrimary.textContent = selected.focusMetaPrimary;
  elements.aquariumFocusMetaSecondary.textContent = selected.focusMetaSecondary;
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
  elements.districtLabelKrusty.textContent = t('aquarium.districtKrusty');
  elements.districtLabelShellbucks.textContent = t('aquarium.districtShellbucks');

  const stageActors = [...buildCommunityCastActors(state.stageActivity), ...buildGatewayStageActors()].sort((left, right) => left.y - right.y);
  const focusItems = [];
  const venueMarkup = buildVenueFixtures(state.stageActivity)
    .map((venue) => {
      focusItems.push(venue);
      const isSpeaking = state.stageActivity?.bubbleFocusKey === venue.focusKey;
      const isSpotlight = state.stageActivity?.spotlightKeys?.has(venue.focusKey) ?? false;
      const baseZ = Math.round(venue.y);
      return `
        <button class="pixel-venue" data-focus-key="${escapeHtml(venue.focusKey)}" data-base-z="${baseZ}" data-stage-x="${venue.x}" data-stage-y="${venue.y}" data-venue="${escapeHtml(venue.id)}" data-active="${venue.active ? 'true' : 'false'}" data-speaking="${isSpeaking ? 'true' : 'false'}" data-spotlight="${isSpotlight ? 'true' : 'false'}" type="button" style="--x: ${venue.x}%; --y: ${venue.y}%; --scale: ${venue.scale}; z-index: ${baseZ};" title="${escapeHtml(`${venue.label} · ${venue.subtitle}`)}">
          ${
            isSpeaking && state.stageActivity?.bubbleText
              ? `<div class="stage-speech-bubble" data-kind="${escapeHtml(state.stageActivity.kind)}"><span>${escapeHtml(state.stageActivity.bubbleText)}</span></div>`
              : ''
          }
          <div class="pixel-venue-shell" data-depth="${escapeHtml(venue.depth)}">${renderPixelSprite(venue.sprite, 'pixel-venue-sprite', { assetYOffset: venue.assetYOffset })}</div>
          <div class="pixel-venue-label" data-label-mode="${escapeHtml(venue.labelMode)}"><strong>${escapeHtml(venue.label)}</strong><span>${escapeHtml(venue.subtitle)}</span></div>
        </button>
      `;
    })
    .join('');

  elements.aquariumCastChip.textContent = state.gateways.length > 0
    ? t('aquarium.castChip', { gateways: state.gateways.length, cast: 3 })
    : t('aquarium.castOnlyChip', { cast: 3 });

  elements.aquariumWaterChip.textContent = state.environment
    ? t('aquarium.waterChip', {
        tide: humanizeToken(state.environment.tideDirection, 'tideDirection'),
        surface: humanizeToken(state.environment.surfaceState, 'surfaceState'),
      })
    : t('aquarium.waterPending');

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
        <button class="pixel-actor" data-focus-key="${escapeHtml(actor.focusKey)}" data-base-z="${baseZ}" data-stage-x="${actor.x}" data-stage-y="${actor.y}" data-role="${escapeHtml(actor.role)}" data-active="${actor.active ? 'true' : 'false'}" data-speaking="${isSpeaking ? 'true' : 'false'}" data-spotlight="${isSpotlight ? 'true' : 'false'}" data-depth="${escapeHtml(actor.depth)}" type="button" style="--x: ${actor.x}%; --y: ${actor.y}%; --scale: ${actor.scale}; --bob-duration: ${actor.bobDuration}s; --bob-delay: ${actor.bobDelay}s; z-index: ${baseZ};" title="${escapeHtml(`${actor.label} · ${actor.secondary}`)}">
          ${
            isSpeaking && state.stageActivity?.bubbleText
              ? `<div class="stage-speech-bubble" data-kind="${escapeHtml(state.stageActivity.kind)}"><span>${escapeHtml(state.stageActivity.bubbleText)}</span></div>`
              : ''
          }
          <div class="pixel-sprite-shell">${renderPixelSprite(actor.sprite, 'pixel-sprite-frame', { assetYOffset: actor.assetYOffset })}</div>
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

function setStatus(message, tone = 'neutral') {
  if (!elements.statusBadge) {
    return;
  }
  elements.statusBadge.textContent = message;
  elements.statusBadge.dataset.tone = tone;
}

function setSyncBadge() {
  if (!elements.syncBadge) {
    return;
  }
  elements.syncBadge.textContent = state.lastSyncedAt
    ? t('sync.synced', { relative: formatRelative(state.lastSyncedAt) })
    : t('sync.none');
}

function renderCurrent() {
  const aquaName = state.aqua?.displayName || t('common.aquaDefault');
  elements.aquariumStageChip.textContent = `${t('hero.eyebrow')} · ${aquaName}`;

  if (!state.current) {
    elements.aquariumCurrentChip.textContent = t('render.currentUnavailable.label');
    elements.aquariumCurrentSummaryChip.textContent = t('render.currentUnavailable.summary');
    elements.aquariumCurrentDetailChip.textContent = `${t('render.currentUnavailable.tone')} · ${t('render.currentUnavailable.scene')}`;
    return;
  }

  elements.aquariumCurrentChip.textContent = `${t('current.kicker')} · ${state.current.label}`;
  elements.aquariumCurrentSummaryChip.textContent = state.current.summary;
  elements.aquariumCurrentDetailChip.textContent = [
    humanizeToken(state.current.tone, 'tone'),
    state.current.sceneHint || t('common.openWater'),
    humanizeToken(state.current.source, 'source'),
  ].join(' · ');
}

function applyTranslations() {
  document.documentElement.lang = state.locale === 'zh' ? 'zh-CN' : 'en';
  document.title = t('page.title');
  elements.metaDescription?.setAttribute('content', t('page.description'));
  if (elements.localeLabel) {
    elements.localeLabel.textContent = t('locale.label');
  }
  if (elements.refreshButton) {
    elements.refreshButton.textContent = t('action.refresh');
  }
  if (elements.surfaceLink) {
    elements.surfaceLink.textContent = t('action.openSurface');
  }
  for (const button of elements.localeButtons) {
    button.dataset.active = button.dataset.locale === state.locale ? 'true' : 'false';
  }
  renderHudToggle();
  setSyncBadge();
}

function renderHudToggle() {
  if (!elements.aquariumHud || !elements.aquariumHudShell || !elements.aquariumHudToggle) {
    return;
  }
  const label = state.hudExpanded ? t('hud.hide') : t('hud.show');
  elements.aquariumHud.dataset.expanded = state.hudExpanded ? 'true' : 'false';
  elements.aquariumHudShell.dataset.expanded = state.hudExpanded ? 'true' : 'false';
  elements.aquariumHudToggle.dataset.expanded = state.hudExpanded ? 'true' : 'false';
  elements.aquariumHudToggle.setAttribute('aria-expanded', state.hudExpanded ? 'true' : 'false');
  elements.aquariumHudToggle.setAttribute('aria-label', label);
  elements.aquariumHudToggle.title = label;
  elements.aquariumHudToggle.textContent = label;
}

function setLocale(locale) {
  if (!VALID_LOCALES.has(locale) || locale === state.locale) {
    return;
  }
  state.locale = locale;
  persistLocale();
  applyTranslations();
  renderCurrent();
  renderPixelAquarium();
  if (!state.isLoading) {
    setStatus(t('status.seaStatus', { status: String(state.health ?? 'ok').toUpperCase() }), 'ok');
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || t('error.requestFailed', { status: response.status }));
  }
  return response.json();
}

async function refreshStage({ quiet = false } = {}) {
  if (state.isLoading) {
    return;
  }

  state.isLoading = true;
  if (elements.refreshButton) {
    elements.refreshButton.disabled = true;
  }
  if (!quiet) {
    setStatus(t('status.refreshing'));
  }

  try {
    const [healthResult, aquaResult, currentResult, environmentResult, feedResult, gatewaysResult] = await Promise.all([
      fetchJson('/health'),
      fetchJson('/api/v1/public/aqua'),
      fetchJson('/api/v1/public/current'),
      fetchJson('/api/v1/public/environment'),
      fetchJson(`/api/v1/public/feed?limit=${FEED_LIMIT}`),
      fetchJson(`/api/v1/public/present-gateways?surface=stage&limit=${GATEWAY_LIMIT}`),
    ]);

    state.health = healthResult.data?.status ?? 'ok';
    state.aqua = aquaResult.data.aqua;
    state.current = currentResult.data.current;
    state.environment = environmentResult.data.environment;
    state.feed = Array.isArray(feedResult.data.items) ? feedResult.data.items : [];
    state.gateways = Array.isArray(gatewaysResult.data.items) ? gatewaysResult.data.items : [];
    state.lastSyncedAt = new Date().toISOString();
    state.lastSuccessfulSyncAt = Date.now();

    renderCurrent();
    renderPixelAquarium();
    setSyncBadge();
    setStatus(t('status.seaStatus', { status: String(state.health).toUpperCase() }), 'ok');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t('status.refreshFailed'), 'error');
  } finally {
    state.isLoading = false;
    if (elements.refreshButton) {
      elements.refreshButton.disabled = false;
    }
    setSyncBadge();
  }
}

function maybeRefreshOnReturn() {
  if (document.visibilityState !== 'visible') {
    return;
  }
  if (Date.now() - state.lastSuccessfulSyncAt > 15_000) {
    refreshStage({ quiet: true });
  }
}

for (const button of elements.localeButtons) {
  button.addEventListener('click', () => {
    setLocale(button.dataset.locale);
  });
}

elements.refreshButton?.addEventListener('click', () => {
  refreshStage();
});

elements.aquariumHudToggle?.addEventListener('click', () => {
  state.hudExpanded = !state.hudExpanded;
  persistHudExpanded();
  renderHudToggle();
});

elements.aquariumViewport.addEventListener('click', (event) => {
  const target = event.target.closest('[data-focus-key]');
  if (target) {
    state.stageFocusKey = target.dataset.focusKey;
    state.stageFocusDismissed = false;
    state.stageFocusPinned = true;
    renderStageFocus();
    return;
  }
  if (event.target.closest('#aquarium-focus')) {
    return;
  }
  if (event.target.closest('#aquarium-hud-shell')) {
    return;
  }
  state.stageFocusKey = null;
  state.stageFocusDismissed = true;
  state.stageFocusPinned = false;
  renderStageFocus();
});

document.addEventListener('visibilitychange', maybeRefreshOnReturn);

window.setInterval(() => {
  refreshStage({ quiet: true });
}, REFRESH_INTERVAL_MS);

applyTranslations();
renderCurrent();
renderPixelAquarium();
setStatus(t('status.connecting'));
stageMotion.start();
refreshStage();
primeStageArtAssets().then((hasExternalArt) => {
  if (hasExternalArt) {
    renderPixelAquarium();
  }
});
