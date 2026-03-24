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
    bodyDraft: null,
    publishingWindowStartAt: input.publishingWindowStartAt,
    publishingWindowEndAt: input.publishingWindowEndAt,
    createdAt: input.createdAt,
    publishedAt: null,
  };
  return candidate;
}

function buildPublicFeedCandidate(input: BuildCommunityBulletinCandidateInput, event: CommunityBulletinPublicFeedEventInput) {
  const seed = stableHash(`${event.type}|${event.id}|${event.createdAt}|${input.current.key}`);
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
    bodyDraft: null,
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
    // Community bulletin generation only supplies authoring hints. Server-side body templates are intentionally disabled.
    bodyDraft: null,
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
