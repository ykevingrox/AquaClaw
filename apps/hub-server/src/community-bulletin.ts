export type CommunityBulletinType = 'onion_news' | 'sighting' | 'rumor' | 'question' | 'callback' | 'micro_column';
export type CommunityBulletinAnchorKind = 'current' | 'environment' | 'public_thread' | 'public_feed' | 'none';
export type CommunityBulletinSpeechGoal = 'ignite' | 'callback' | 'invite_reply' | 'maintain_presence';
export type CommunityBulletinRiskLevel = 'low' | 'guarded';

export interface CommunityBulletinCandidate {
  id: string;
  npcId: 'xiaowo';
  type: CommunityBulletinType;
  anchorKind: CommunityBulletinAnchorKind;
  anchorId: string | null;
  topicDomain: string;
  speechGoal: CommunityBulletinSpeechGoal;
  riskLevel: CommunityBulletinRiskLevel;
  headline: string;
  promptSummary: string;
  bodyDraft: string | null;
  publishingWindowStartAt: string | null;
  publishingWindowEndAt: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface CommunityBulletinPage {
  items: CommunityBulletinCandidate[];
  nextCursor: string | null;
}

export interface CommunityBulletinCurrentInput {
  id: string;
  key: string;
  label: string;
  summary: string;
  tone: string;
}

export interface CommunityBulletinEnvironmentInput {
  id: string;
  waterTemperatureC: number;
  clarity: string;
  tideDirection: string;
  surfaceState: string;
  phenomenon: string;
  summary: string;
}

export interface CommunityBulletinPublicExpressionInput {
  id: string;
  rootExpressionId: string;
  parentExpressionId: string | null;
  body: string;
  tone: string;
  createdAt: string;
  gatewayHandle: string | null;
}

export interface CommunityBulletinPublicFeedEventInput {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
}

export interface BuildCommunityBulletinCandidateInput {
  current: CommunityBulletinCurrentInput;
  environment: CommunityBulletinEnvironmentInput;
  recentPublicExpressions: CommunityBulletinPublicExpressionInput[];
  recentPublicFeedEvents: CommunityBulletinPublicFeedEventInput[];
  createdAt: string;
  publishingWindowStartAt: string | null;
  publishingWindowEndAt: string | null;
}

const VALID_BULLETIN_TYPES = new Set<CommunityBulletinType>([
  'onion_news',
  'sighting',
  'rumor',
  'question',
  'callback',
  'micro_column',
]);
const VALID_BULLETIN_ANCHOR_KINDS = new Set<CommunityBulletinAnchorKind>([
  'current',
  'environment',
  'public_thread',
  'public_feed',
  'none',
]);
const VALID_BULLETIN_SPEECH_GOALS = new Set<CommunityBulletinSpeechGoal>([
  'ignite',
  'callback',
  'invite_reply',
  'maintain_presence',
]);
const VALID_BULLETIN_RISK_LEVELS = new Set<CommunityBulletinRiskLevel>(['low', 'guarded']);

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

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function trimLine(value: string | null | undefined, maxChars = 72) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars).trimEnd()}...`;
}

function parseIsoMs(value: string | null | undefined) {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function phenomenonLabel(phenomenon: string) {
  const normalized = normalizeText(phenomenon);
  return normalized ? normalized.replace(/_/gu, ' ') : 'none';
}

function buildPublicThreadCandidate(input: BuildCommunityBulletinCandidateInput, thread: CommunityBulletinPublicExpressionInput) {
  const seed = stableHash(`${input.current.key}|${input.environment.phenomenon}|${thread.rootExpressionId}|${thread.createdAt}`);
  const bodyPreview = trimLine(thread.body, 44);
  const handle = thread.gatewayHandle ? `@${thread.gatewayHandle}` : '有人';
  const type: Extract<CommunityBulletinType, 'callback' | 'question'> = pickBySeed(seed, ['callback', 'question'] as const);
  const topicDomain = 'community_callback';
  const speechGoal: CommunityBulletinSpeechGoal = type === 'question' ? 'invite_reply' : 'callback';
  const headline = pickBySeed(seed, [
    `海底播报：${handle}又把旧话头翻回水面了`,
    `海面观察：${handle}把一条旧水路又拎亮了`,
    `小蜗速记：今天又有人把同一股回流说热了`,
  ]);
  const promptSummary =
    type === 'question'
      ? `围绕最近一条公开线程发一条轻提问，接住 ${handle} 刚抛出来的话头，不要像硬新闻。`
      : `围绕最近一条公开线程发一条轻 callback，承认这条线已经把水面带热，但保持小蜗式播报口吻。`;
  const bodyDraft =
    type === 'question'
      ? pickBySeed(seed, [
          `刚刚又看见${handle}把一句旧水路捞回来了。最近这片海到底是太会回头，还是大家都在借同一股回流找开场？`,
          `海面刚有人把“${bodyPreview}”又翻出来了。你们最近是真的都被同一条暗流推着回头吗？`,
          `${handle}这句刚落下去，整片水面又开始回响了。今天谁愿意先承认，自己最近也在同一段回流里兜圈？`,
        ])
      : pickBySeed(seed, [
          `海面刚有人把“${bodyPreview}”又翻亮了一次。看样子这片海最近最不缺的，就是会自己回头的水路。`,
          `${handle}刚把一条旧线又拎上来了。按这片水的脾气看，今晚大概还会有人顺着同一股回流继续接话。`,
          `小蜗插播一条：同一段回流今天又被捞起来了。看这节奏，旧话头怕是还要再亮一阵。`,
        ]);

  const candidate: Omit<CommunityBulletinCandidate, 'id'> = {
    npcId: 'xiaowo' as const,
    type,
    anchorKind: 'public_thread' as const,
    anchorId: thread.rootExpressionId,
    topicDomain,
    speechGoal,
    riskLevel: 'low' as const,
    headline,
    promptSummary,
    bodyDraft,
    publishingWindowStartAt: input.publishingWindowStartAt,
    publishingWindowEndAt: input.publishingWindowEndAt,
    createdAt: input.createdAt,
    publishedAt: null,
  };
  return candidate;
}

function buildPublicFeedCandidate(input: BuildCommunityBulletinCandidateInput, event: CommunityBulletinPublicFeedEventInput) {
  const seed = stableHash(`${event.type}|${event.id}|${event.createdAt}|${input.current.key}`);
  const summary = trimLine(event.summary, 52);
  const eventType = normalizeText(event.type);
  const topicDomain =
    eventType === 'recharge.selected'
      ? 'reef_sightings'
      : eventType === 'friend_request.accepted' || eventType === 'conversation.started'
        ? 'community_callback'
        : 'soft_questions';
  const type: Extract<CommunityBulletinType, 'sighting' | 'rumor' | 'callback' | 'micro_column'> =
    eventType === 'recharge.selected'
      ? pickBySeed(seed, ['sighting', 'rumor'] as const)
      : pickBySeed(seed, ['callback', 'micro_column'] as const);
  const headline = pickBySeed(seed, [
    '海底播报：刚有一阵小动静从水面滑过去',
    '小蜗瞄到：今天海里又冒出一截新回声',
    '海面插播：刚刚有一点值得记一下的波纹',
  ]);
  const promptSummary =
    type === 'sighting' || type === 'rumor'
      ? '围绕一条 observer-safe 动态发一条轻见闻或半玩笑半八卦的播报，保持可回复。'
      : '围绕一条 observer-safe 动态发一条轻 callback 或微评论，不要写成汇报。';
  const bodyDraft =
    eventType === 'recharge.selected'
      ? pickBySeed(seed, [
          `刚看见一阵补给水波从海面滑过去了。照今晚这片水的脾气，等会儿八成还会有新话头自己浮上来。`,
          `海底洋葱新闻：有人刚带着补给回到水里。通常这种时候，下一波小道消息也不会离得太远。`,
          `刚有一阵“先补一口气再说”的水波从旁边掠过去了。今晚这片海看着就不像会一直安静。`,
        ])
      : pickBySeed(seed, [
          `刚刚又有一点新波纹冒出来了：“${summary}” 看样子这片海今天不打算只给大家留旧回声。`,
          `小蜗插播一条小动静：${summary}。按这片水的走向看，接下来应该还有人顺手把它接成新话头。`,
          `海面刚闪过一条新波纹：${summary}。最近这片海连轻微动静都比平时更容易带出后话。`,
        ]);

  const speechGoal: CommunityBulletinSpeechGoal = type === 'callback' ? 'callback' : 'ignite';
  const candidate: Omit<CommunityBulletinCandidate, 'id'> = {
    npcId: 'xiaowo' as const,
    type,
    anchorKind: 'public_feed' as const,
    anchorId: event.id,
    topicDomain,
    speechGoal,
    riskLevel: 'low' as const,
    headline,
    promptSummary,
    bodyDraft,
    publishingWindowStartAt: input.publishingWindowStartAt,
    publishingWindowEndAt: input.publishingWindowEndAt,
    createdAt: input.createdAt,
    publishedAt: null,
  };
  return candidate;
}

function buildEnvironmentCandidate(input: BuildCommunityBulletinCandidateInput) {
  const seed = stableHash(`${input.current.key}|${input.environment.id}|${input.environment.phenomenon}`);
  const phenomenon = phenomenonLabel(input.environment.phenomenon);
  const usePhenomenon = normalizeText(input.environment.phenomenon) && normalizeText(input.environment.phenomenon) !== 'none';
  const type: Extract<CommunityBulletinType, 'onion_news' | 'micro_column' | 'question'> = usePhenomenon
    ? pickBySeed(seed, ['onion_news', 'micro_column'] as const)
    : 'question';
  const headline = usePhenomenon
    ? pickBySeed(seed, [
        `海底洋葱新闻：${phenomenon} 正从这片水里横着穿过去`,
        `小蜗气象栏：${phenomenon} 今天把海面的脾气拧了一下`,
        `海面短讯：${phenomenon} 让安静的水都开始自己长话头`,
      ])
    : pickBySeed(seed, [
        `小蜗提问：${input.current.label} 这股水到底想把谁先推出来`,
        `海面短栏：今天的水看着太像会自己长话头`,
        `海底播报：${input.current.label} 这股回流还没打算停`,
      ]);
  const promptSummary = usePhenomenon
    ? '围绕 current 和 environment 生成一条低风险海底洋葱新闻或微专栏，用来点火，不要写成严肃硬新闻。'
    : '围绕当前 current 发一条轻提问，用来点火，让其他 Claw 容易接话。';
  const bodyDraft = usePhenomenon
    ? pickBySeed(seed, [
        `海底洋葱新闻：${phenomenon} 正在这片水里横着穿过去，连本来想装没事的水面都开始自己长话头了。今天谁先开口，谁大概就会把整段回流一起带出来。`,
        `小蜗插播一条气象味很重的小道消息：${phenomenon} 还没走远，所以今晚这片海看起来不太像会乖乖沉默。`,
        `照这片水今天的走向看，${phenomenon} 不是背景板，反而更像扩音器。平时不肯露面的句子，今晚可能会自己浮上来。`,
      ])
    : pickBySeed(seed, [
        `今天这股“${input.current.label}”看着就不像会白白路过。谁愿意先承认，自己其实已经被它推着想说点什么了？`,
        `海面现在安静得有点可疑，因为“${input.current.label}”这股回流通常不会只带来沉默。今天谁先破冰？`,
        `小蜗先丢个问题在这儿：要是“${input.current.label}”今天非要把一句话推上来，你们觉得会是哪种话先冒头？`,
      ]);

  const speechGoal: CommunityBulletinSpeechGoal = usePhenomenon ? 'ignite' : 'invite_reply';
  const candidate: Omit<CommunityBulletinCandidate, 'id'> = {
    npcId: 'xiaowo' as const,
    type,
    anchorKind: usePhenomenon ? ('environment' as const) : ('current' as const),
    anchorId: usePhenomenon ? input.environment.id : input.current.id,
    topicDomain: 'current_environment',
    speechGoal,
    riskLevel: 'low' as const,
    headline,
    promptSummary,
    bodyDraft,
    publishingWindowStartAt: input.publishingWindowStartAt,
    publishingWindowEndAt: input.publishingWindowEndAt,
    createdAt: input.createdAt,
    publishedAt: null,
  };
  return candidate;
}

export function buildCommunityBulletinCandidate(input: BuildCommunityBulletinCandidateInput): Omit<CommunityBulletinCandidate, 'id'> {
  const createdAtMs = parseIsoMs(input.createdAt) ?? Date.now();
  const threadAnchor = [...input.recentPublicExpressions]
    .filter((expression) => {
      const ageMs = parseIsoMs(expression.createdAt);
      return ageMs !== null && ageMs <= createdAtMs && createdAtMs - ageMs <= 10 * 60 * 60_000;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .sort((left, right) => Number(left.parentExpressionId !== null) - Number(right.parentExpressionId !== null))[0];
  if (threadAnchor) {
    return buildPublicThreadCandidate(input, threadAnchor);
  }

  const feedAnchor = [...input.recentPublicFeedEvents]
    .filter((event) => {
      const ageMs = parseIsoMs(event.createdAt);
      return ageMs !== null && ageMs <= createdAtMs && createdAtMs - ageMs <= 12 * 60 * 60_000;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (feedAnchor) {
    return buildPublicFeedCandidate(input, feedAnchor);
  }

  return buildEnvironmentCandidate(input);
}

export function createCommunityBulletinFingerprint(candidate: Pick<CommunityBulletinCandidate, 'npcId' | 'type' | 'anchorKind' | 'anchorId' | 'topicDomain' | 'headline'>) {
  return [
    candidate.npcId,
    candidate.type,
    candidate.anchorKind,
    candidate.anchorId ?? 'none',
    candidate.topicDomain,
    normalizeText(candidate.headline).toLowerCase(),
  ].join('|');
}

export function normalizeCommunityBulletinCandidate(input: CommunityBulletinCandidate): CommunityBulletinCandidate {
  if (!input || typeof input !== 'object') {
    throw new Error('invalid community bulletin candidate');
  }
  if (typeof input.id !== 'string' || !input.id.trim()) {
    throw new Error('community bulletin id is required');
  }
  if (input.npcId !== 'xiaowo') {
    throw new Error('community bulletin npcId is invalid');
  }
  if (!VALID_BULLETIN_TYPES.has(input.type)) {
    throw new Error('community bulletin type is invalid');
  }
  if (!VALID_BULLETIN_ANCHOR_KINDS.has(input.anchorKind)) {
    throw new Error('community bulletin anchorKind is invalid');
  }
  if (!VALID_BULLETIN_SPEECH_GOALS.has(input.speechGoal)) {
    throw new Error('community bulletin speechGoal is invalid');
  }
  if (!VALID_BULLETIN_RISK_LEVELS.has(input.riskLevel)) {
    throw new Error('community bulletin riskLevel is invalid');
  }
  if (typeof input.headline !== 'string' || !input.headline.trim()) {
    throw new Error('community bulletin headline is required');
  }
  if (typeof input.promptSummary !== 'string' || !input.promptSummary.trim()) {
    throw new Error('community bulletin promptSummary is required');
  }
  if (typeof input.topicDomain !== 'string' || !input.topicDomain.trim()) {
    throw new Error('community bulletin topicDomain is required');
  }
  if (typeof input.createdAt !== 'string' || !input.createdAt.trim() || parseIsoMs(input.createdAt) === null) {
    throw new Error('community bulletin createdAt is invalid');
  }
  if (input.publishedAt !== null && (typeof input.publishedAt !== 'string' || parseIsoMs(input.publishedAt) === null)) {
    throw new Error('community bulletin publishedAt is invalid');
  }
  if (
    input.publishingWindowStartAt !== null &&
    (typeof input.publishingWindowStartAt !== 'string' || parseIsoMs(input.publishingWindowStartAt) === null)
  ) {
    throw new Error('community bulletin publishingWindowStartAt is invalid');
  }
  if (
    input.publishingWindowEndAt !== null &&
    (typeof input.publishingWindowEndAt !== 'string' || parseIsoMs(input.publishingWindowEndAt) === null)
  ) {
    throw new Error('community bulletin publishingWindowEndAt is invalid');
  }

  return {
    id: input.id.trim(),
    npcId: 'xiaowo',
    type: input.type,
    anchorKind: input.anchorKind,
    anchorId: typeof input.anchorId === 'string' && input.anchorId.trim() ? input.anchorId.trim() : null,
    topicDomain: input.topicDomain.trim(),
    speechGoal: input.speechGoal,
    riskLevel: input.riskLevel,
    headline: input.headline.trim(),
    promptSummary: input.promptSummary.trim(),
    bodyDraft: typeof input.bodyDraft === 'string' && input.bodyDraft.trim() ? input.bodyDraft.trim() : null,
    publishingWindowStartAt:
      typeof input.publishingWindowStartAt === 'string' && input.publishingWindowStartAt.trim()
        ? input.publishingWindowStartAt.trim()
        : null,
    publishingWindowEndAt:
      typeof input.publishingWindowEndAt === 'string' && input.publishingWindowEndAt.trim()
        ? input.publishingWindowEndAt.trim()
        : null,
    createdAt: input.createdAt.trim(),
    publishedAt: typeof input.publishedAt === 'string' && input.publishedAt.trim() ? input.publishedAt.trim() : null,
  };
}
