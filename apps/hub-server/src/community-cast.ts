export type CommunityNpcId = 'xiaowo' | 'beibei' | 'qiaoqiao';
export type CommunityNpcRole = 'broadcaster' | 'gossip_clerk' | 'observer_clerk';

export interface CommunityNpcProfile {
  id: CommunityNpcId;
  displayName: string;
  role: CommunityNpcRole;
  primaryVenueSlug: string | null;
  publicPostingEnabled: boolean;
  privateWhisperEnabled: boolean;
  toneGuide: string[];
  allowedTopicDomains: string[];
  forbiddenTopicDomains: string[];
}

export interface CommunityCastNpcEnabledPolicy {
  enabled: boolean;
}

export interface CommunityCastXiaowoPolicyRecord extends CommunityCastNpcEnabledPolicy {
  minIntervalMinutes: number;
  maxIntervalMinutes: number;
  activeWindowStart: string | null;
  activeWindowEnd: string | null;
}

export interface CommunityCastPolicyRecord {
  enabled: boolean;
  activeWindowStart: string | null;
  activeWindowEnd: string | null;
  globalDailyCap: number | null;
  blockedTopicDomains: string[];
  npcs: {
    xiaowo: CommunityCastXiaowoPolicyRecord;
    beibei: CommunityCastNpcEnabledPolicy;
    qiaoqiao: CommunityCastNpcEnabledPolicy;
  };
  updatedAt: string | null;
  updatedByHostId: string | null;
}

export interface UpdateCommunityCastPolicyInput {
  hostId: string;
  enabled?: boolean;
  activeWindowStart?: string | null;
  activeWindowEnd?: string | null;
  globalDailyCap?: number | null;
  blockedTopicDomains?: string[];
  npcs?: {
    xiaowo?: {
      enabled?: boolean;
      minIntervalMinutes?: number;
      maxIntervalMinutes?: number;
      activeWindowStart?: string | null;
      activeWindowEnd?: string | null;
    };
    beibei?: {
      enabled?: boolean;
    };
    qiaoqiao?: {
      enabled?: boolean;
    };
  };
}

export interface VenueWhisperDraftInput {
  npcId: 'beibei' | 'qiaoqiao';
  venueSlug: 'krusty-krab' | 'shellbucks';
  venueName: string;
  cue: 'heavy_reset' | 'light_lift' | null;
  suggestedItem: string | null;
  suggestedKind: string | null;
  currentKey: string;
  currentLabel: string;
  currentTone: string;
  phenomenon: string;
  clarity: string;
  createdAt: string;
}

export interface VenueWhisperDraft {
  topicDomain: string;
  summary: string;
  body: string;
  tags: string[];
  mentionPolicy: 'private_only' | 'paraphrase_ok' | 'public_ok';
  freshnessScore: number;
  freshHours: number;
  metadata: Record<string, unknown>;
}

const MANAGED_COMMUNITY_CAST: readonly CommunityNpcProfile[] = [
  {
    id: 'xiaowo',
    displayName: '小蜗',
    role: 'broadcaster',
    primaryVenueSlug: null,
    publicPostingEnabled: true,
    privateWhisperEnabled: false,
    toneGuide: ['wry', 'playful', 'observant', 'lightly theatrical'],
    allowedTopicDomains: ['onion_news'],
    forbiddenTopicDomains: ['medical_advice', 'financial_advice', 'hard_news_claims', 'political_campaigning'],
  },
  {
    id: 'beibei',
    displayName: '贝贝',
    role: 'gossip_clerk',
    primaryVenueSlug: 'krusty-krab',
    publicPostingEnabled: false,
    privateWhisperEnabled: true,
    toneGuide: ['chatty', 'nosy', 'friendly', 'quick to repeat a rumor with a grin'],
    allowedTopicDomains: ['shop_whisper', 'gossip', 'venue_callback', 'soft_rumor'],
    forbiddenTopicDomains: ['hard_accusations', 'private_secrets_as_facts', 'unsafe_instructions'],
  },
  {
    id: 'qiaoqiao',
    displayName: '壳壳',
    role: 'observer_clerk',
    primaryVenueSlug: 'shellbucks',
    publicPostingEnabled: false,
    privateWhisperEnabled: true,
    toneGuide: ['dry', 'sharp', 'observant', 'slightly sardonic'],
    allowedTopicDomains: ['observer_note', 'venue_callback', 'social_commentary', 'soft_rumor'],
    forbiddenTopicDomains: ['hard_accusations', 'private_secrets_as_facts', 'unsafe_instructions'],
  },
];

const DEFAULT_COMMUNITY_CAST_POLICY: CommunityCastPolicyRecord = {
  enabled: true,
  activeWindowStart: null,
  activeWindowEnd: null,
  globalDailyCap: 8,
  blockedTopicDomains: [],
  npcs: {
    xiaowo: {
      enabled: true,
      minIntervalMinutes: 120,
      maxIntervalMinutes: 120,
      activeWindowStart: null,
      activeWindowEnd: null,
    },
    beibei: {
      enabled: true,
    },
    qiaoqiao: {
      enabled: true,
    },
  },
  updatedAt: null,
  updatedByHostId: null,
};

function cloneCommunityNpcProfile(profile: CommunityNpcProfile): CommunityNpcProfile {
  return {
    ...profile,
    toneGuide: [...profile.toneGuide],
    allowedTopicDomains: [...profile.allowedTopicDomains],
    forbiddenTopicDomains: [...profile.forbiddenTopicDomains],
  };
}

function normalizeClockOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeTopicDomainList(values: string[] | null | undefined, fallback: string[] = []) {
  const next = Array.isArray(values) ? values : fallback;
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of next) {
    const topicDomain = String(value ?? '').trim().toLowerCase();
    if (!topicDomain || seen.has(topicDomain)) {
      continue;
    }
    seen.add(topicDomain);
    normalized.push(topicDomain);
  }

  return normalized;
}

export function listManagedCommunityCastProfiles(): CommunityNpcProfile[] {
  return MANAGED_COMMUNITY_CAST.map((profile) => cloneCommunityNpcProfile(profile));
}

export function normalizeCommunityCastPolicy(
  policy: Partial<CommunityCastPolicyRecord> | null | undefined,
): CommunityCastPolicyRecord {
  const next = policy ?? {};
  const nextNpcs: Partial<CommunityCastPolicyRecord['npcs']> = next.npcs ?? {};
  const xiaowo: Partial<CommunityCastPolicyRecord['npcs']['xiaowo']> = nextNpcs.xiaowo ?? {};
  const beibei: Partial<CommunityCastPolicyRecord['npcs']['beibei']> = nextNpcs.beibei ?? {};
  const qiaoqiao: Partial<CommunityCastPolicyRecord['npcs']['qiaoqiao']> = nextNpcs.qiaoqiao ?? {};

  return {
    enabled: next.enabled ?? DEFAULT_COMMUNITY_CAST_POLICY.enabled,
    activeWindowStart: normalizeClockOrNull(next.activeWindowStart ?? DEFAULT_COMMUNITY_CAST_POLICY.activeWindowStart),
    activeWindowEnd: normalizeClockOrNull(next.activeWindowEnd ?? DEFAULT_COMMUNITY_CAST_POLICY.activeWindowEnd),
    globalDailyCap:
      next.globalDailyCap === null
        ? null
        : typeof next.globalDailyCap === 'number'
          ? next.globalDailyCap
          : DEFAULT_COMMUNITY_CAST_POLICY.globalDailyCap,
    blockedTopicDomains: normalizeTopicDomainList(
      next.blockedTopicDomains,
      DEFAULT_COMMUNITY_CAST_POLICY.blockedTopicDomains,
    ),
    npcs: {
      xiaowo: {
        enabled: xiaowo.enabled ?? DEFAULT_COMMUNITY_CAST_POLICY.npcs.xiaowo.enabled,
        minIntervalMinutes:
          typeof xiaowo.minIntervalMinutes === 'number'
            ? xiaowo.minIntervalMinutes
            : DEFAULT_COMMUNITY_CAST_POLICY.npcs.xiaowo.minIntervalMinutes,
        maxIntervalMinutes:
          typeof xiaowo.maxIntervalMinutes === 'number'
            ? xiaowo.maxIntervalMinutes
            : DEFAULT_COMMUNITY_CAST_POLICY.npcs.xiaowo.maxIntervalMinutes,
        activeWindowStart: normalizeClockOrNull(
          xiaowo.activeWindowStart === undefined
            ? DEFAULT_COMMUNITY_CAST_POLICY.npcs.xiaowo.activeWindowStart
            : xiaowo.activeWindowStart,
        ),
        activeWindowEnd: normalizeClockOrNull(
          xiaowo.activeWindowEnd === undefined ? DEFAULT_COMMUNITY_CAST_POLICY.npcs.xiaowo.activeWindowEnd : xiaowo.activeWindowEnd,
        ),
      },
      beibei: {
        enabled: beibei.enabled ?? DEFAULT_COMMUNITY_CAST_POLICY.npcs.beibei.enabled,
      },
      qiaoqiao: {
        enabled: qiaoqiao.enabled ?? DEFAULT_COMMUNITY_CAST_POLICY.npcs.qiaoqiao.enabled,
      },
    },
    updatedAt: next.updatedAt ?? null,
    updatedByHostId: next.updatedByHostId ?? null,
  };
}

export function cloneCommunityCastPolicy(policy: CommunityCastPolicyRecord): CommunityCastPolicyRecord {
  return normalizeCommunityCastPolicy(policy);
}

function stableHash(input: string) {
  let hash = 0;
  for (const char of input) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function pickBySeed<T>(seed: number, values: readonly T[]): T {
  return values[seed % values.length]!;
}

function formatSuggestedPickup(input: VenueWhisperDraftInput) {
  if (input.suggestedItem && input.suggestedKind) {
    return `${input.suggestedItem}${input.suggestedKind === input.suggestedItem ? '' : `这份${input.suggestedKind}`}`;
  }
  if (input.suggestedItem) {
    return input.suggestedItem;
  }
  if (input.suggestedKind) {
    return `一份${input.suggestedKind}`;
  }
  return '手边那份补给';
}

export function buildVenueWhisperDraft(input: VenueWhisperDraftInput): VenueWhisperDraft {
  const seed = stableHash(
    [input.npcId, input.venueSlug, input.cue ?? 'none', input.suggestedItem ?? 'none', input.suggestedKind ?? 'none', input.createdAt].join('|'),
  );
  const pickup = formatSuggestedPickup(input);

  if (input.npcId === 'beibei') {
    const opening = pickBySeed(seed, [
      '贝贝把托盘往前一推，压低了声音。',
      '贝贝眨了眨眼，像是顺手把一句八卦塞进了餐盘边。',
      '贝贝一边收银一边靠近半步，显然忍不住想先透露一点风声。',
    ]);
    const cueRead =
      input.cue === 'heavy_reset'
        ? '今天肯坐下来狠狠干一口补给的人，多半也带着点想往外放的话。'
        : '这种顺手提神的小停靠，最容易让人先漏出半句本来想藏着的话。';
    return {
      topicDomain: 'gossip',
      summary: `贝贝在${input.venueName}递来一条轻八卦，提醒你留意谁会先把话头吹热。`,
      body: `${opening}她把${pickup}朝你推了推，说：“${cueRead} 你要是待会儿在公开海面听见有人先夸路线、夸补能、夸自己很会带气氛，记一下是谁先开的头。”`,
      tags: ['npc:beibei', `venue:${input.venueSlug}`, `cue:${input.cue ?? 'none'}`, 'gossip'],
      mentionPolicy: 'paraphrase_ok',
      freshnessScore: input.cue === 'heavy_reset' ? 0.82 : 0.76,
      freshHours: 36,
      metadata: {
        venueRole: 'gossip_clerk',
        mood: 'chatty',
      },
    };
  }

  const opening = pickBySeed(seed, [
    '壳壳敲了敲杯盖，像是在替谁下一个不太客气的注脚。',
    '壳壳把杯子往桌上一放，语气里已经带上了那种熟悉的阴阳味。',
    '壳壳没抬头，只把一句观察像细盐一样撒进了空气里。',
  ]);
  const cueRead =
    input.cue === 'heavy_reset'
      ? '要是今天有人忽然把情绪说得很满，多半是在给自己撑场面。'
      : '这种短暂停靠的时段，最适合看谁在借别人的热闹抬高自己。';
  return {
    topicDomain: 'observer_note',
    summary: `壳壳在${input.venueName}丢下一句带刺的观察，提醒你留意谁在借浪表演。`,
    body: `${opening}他把${pickup}推到一边，淡淡地说：“${cueRead} 真要开口，不如先记住谁最爱重复别人的亮点，却装得像是自己先想到的。”`,
    tags: ['npc:qiaoqiao', `venue:${input.venueSlug}`, `cue:${input.cue ?? 'none'}`, 'observer_note'],
    mentionPolicy: 'paraphrase_ok',
    freshnessScore: input.cue === 'heavy_reset' ? 0.79 : 0.73,
    freshHours: 30,
    metadata: {
      venueRole: 'observer_clerk',
      mood: 'sharp',
    },
  };
}
