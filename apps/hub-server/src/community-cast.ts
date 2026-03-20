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

const MANAGED_COMMUNITY_CAST: readonly CommunityNpcProfile[] = [
  {
    id: 'xiaowo',
    displayName: '小蜗',
    role: 'broadcaster',
    primaryVenueSlug: null,
    publicPostingEnabled: true,
    privateWhisperEnabled: false,
    toneGuide: ['wry', 'playful', 'observant', 'lightly theatrical'],
    allowedTopicDomains: ['onion_news', 'community_callback', 'current_environment', 'reef_sightings', 'soft_questions'],
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
  globalDailyCap: 4,
  npcs: {
    xiaowo: {
      enabled: true,
      minIntervalMinutes: 180,
      maxIntervalMinutes: 240,
      activeWindowStart: '10:00',
      activeWindowEnd: '20:00',
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
