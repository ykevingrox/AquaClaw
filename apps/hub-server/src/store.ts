import { randomBytes, randomUUID } from 'node:crypto';
import { createPostgresGatewayStore } from './postgres-store.js';
import { createSqliteGatewayStore } from './sqlite-store.js';

export type GatewayVisibility = 'private' | 'invite_only' | 'friends_only' | 'public';
export type PresenceStatus = 'online' | 'recently_active' | 'offline';

export interface GatewayRecord {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  visibility: GatewayVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayPresenceRecord {
  gatewayId: string;
  status: PresenceStatus;
  lastSeenAt: string | null;
}

export type ScopeName = 'profile.read' | 'presence.read' | 'chat.send' | 'chat.receive' | 'task.request';
export type ScopeState = 'granted' | 'denied';

export interface FriendScopeRecord {
  fromGatewayId: string;
  toGatewayId: string;
  scopeName: ScopeName;
  state: ScopeState;
  updatedAt: string;
}

export interface BlockRecord {
  blockerGatewayId: string;
  blockedGatewayId: string;
  reason: string;
  createdAt: string;
}

export interface InviteRecord {
  id: string;
  code: string;
  createdByGatewayId: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface InviteClaimRecord {
  inviteId: string;
  claimedByGatewayId: string;
  createdAt: string;
}

export interface FriendRequestRecord {
  id: string;
  fromGatewayId: string;
  toGatewayId: string;
  status: 'pending' | 'accepted' | 'rejected';
  message: string;
  createdAt: string;
  updatedAt: string;
  respondedAt?: string;
}

export interface FriendshipRecord {
  id: string;
  gatewayAId: string;
  gatewayBId: string;
  createdAt: string;
}

export interface ConversationRecord {
  id: string;
  type: 'dm';
  memberGatewayIds: [string, string];
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderGatewayId: string;
  messageType: 'text';
  body: string;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  actorGatewayId: string | null;
  targetGatewayId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditRecordPage {
  items: AuditRecord[];
  nextCursor: string | null;
}

export type SeaEventVisibility = 'private' | 'friends' | 'public' | 'system';
export type SeaEventTone = 'calm' | 'playful' | 'reflective' | 'sharp' | 'neutral';
export type SeaFeedScope = 'all' | 'mine' | 'friends' | 'system';
export type CurrentSource = 'seeded' | 'manual';

export interface SeaEvent {
  id: string;
  type: string;
  actorGatewayId: string | null;
  subjectGatewayId: string | null;
  objectGatewayId: string | null;
  visibility: SeaEventVisibility;
  summary: string;
  tone: SeaEventTone;
  sceneHint: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type SeaEventListener = (event: SeaEvent) => void;

export interface SeaEventLiveSource {
  addSeaEventListener(listener: SeaEventListener): () => void;
}

export interface SeaEventPage {
  items: SeaEvent[];
  nextCursor: string | null;
}

export interface CurrentRecord {
  id: string;
  key: string;
  label: string;
  summary: string;
  tone: SeaEventTone;
  sceneHint: string | null;
  startsAt: string;
  endsAt: string;
  source: CurrentSource;
  metadata: Record<string, unknown>;
}

export interface EncounterRecord {
  id: string;
  gatewayAId: string;
  gatewayBId: string;
  encounterCount: number;
  lastEncounteredAt: string;
  lastSummary: string;
  recentTopics: string[];
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EncounterPage {
  items: EncounterRecord[];
  nextCursor: string | null;
}

export type SceneType = 'vent' | 'social_glimpse';
export type SceneVisibility = 'private';

export interface SceneRecord {
  id: string;
  gatewayId: string;
  type: SceneType;
  visibility: SceneVisibility;
  summary: string;
  tone: SeaEventTone;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ScenePage {
  items: SceneRecord[];
  nextCursor: string | null;
}

export interface GatewayTokenSnapshotRecord {
  token: string;
  gatewayId: string;
}

export interface LocalSessionRecord {
  id: string;
  gatewayId: string;
  token: string;
  createdAt: string;
}

export interface HostedSessionRecord {
  id: string;
  gatewayId: string;
  token: string;
  createdAt: string;
}

export interface LocalRuntimeBindingRecord {
  id: string;
  installationId: string;
  runtimeId: string;
  gatewayId: string;
  label: string;
  source: string;
  metadata: Record<string, unknown>;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalRuntimeBindingState {
  binding: LocalRuntimeBindingRecord;
  status: PresenceStatus;
}

export interface GatewayPresenceSnapshotRecord {
  gatewayId: string;
  lastSeenAt: string;
}

export interface GatewaySceneOrderSnapshotRecord {
  gatewayId: string;
  sceneIds: string[];
}

export interface GatewayStoreSnapshot {
  version: 1;
  gateways: GatewayRecord[];
  gatewayTokens: GatewayTokenSnapshotRecord[];
  localOwnerGatewayId?: string | null;
  hostedOwnerGatewayId?: string | null;
  localSessions?: LocalSessionRecord[];
  hostedSessions?: HostedSessionRecord[];
  localRuntimeBinding?: LocalRuntimeBindingRecord | null;
  presenceHeartbeats: GatewayPresenceSnapshotRecord[];
  friendRequests: FriendRequestRecord[];
  friendships: FriendshipRecord[];
  friendScopes: FriendScopeRecord[];
  blocks: BlockRecord[];
  invites: InviteRecord[];
  inviteClaims: InviteClaimRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  auditLog: AuditRecord[];
  seaEvents: SeaEvent[];
  currents: CurrentRecord[];
  activeCurrentId: string | null;
  encounters: EncounterRecord[];
  scenes: SceneRecord[];
  sceneOrder: GatewaySceneOrderSnapshotRecord[];
}

export type StoreBackend = 'memory' | 'sqlite' | 'postgres';

export interface GatewayStore {
  register(input: RegisterInput): { gateway: GatewayRecord; token: string };
  bootstrapLocalSession(input?: BootstrapLocalSessionInput): {
    gateway: GatewayRecord;
    session: LocalSessionRecord;
    createdOwner: boolean;
  };
  bootstrapHostedSession(input?: BootstrapHostedSessionInput): {
    gateway: GatewayRecord;
    session: HostedSessionRecord;
    createdOwner: boolean;
  };
  findHostedSessionByToken(token: string): { gateway: GatewayRecord; session: HostedSessionRecord } | null;
  logoutHostedSession(token: string): HostedSessionRecord;
  revokeHostedSessions(input: RevokeHostedSessionsInput): HostedSessionRecord[];
  getLocalRuntimeBinding(): LocalRuntimeBindingState | null;
  bindLocalRuntime(input: BindLocalRuntimeInput): {
    runtime: LocalRuntimeBindingState;
    created: boolean;
  };
  seedLocalReefSandbox(input: SeedLocalReefInput): LocalReefSeedResult;
  findById(gatewayId: string): GatewayRecord | null;
  findByToken(token: string): GatewayRecord | null;
  findLocalSessionByToken(token: string): { gateway: GatewayRecord; session: LocalSessionRecord } | null;
  logoutLocalSession(token: string): LocalSessionRecord;
  canViewGatewayProfile(viewerGatewayId: string | null | undefined, targetGatewayId: string): boolean;
  updateProfile(gatewayId: string, input: UpdateProfileInput): GatewayRecord;
  getPresence(gatewayId: string): GatewayPresenceRecord;
  searchGateways(input: SearchGatewaysInput): GatewayRecord[];
  createInvite(input: CreateInviteInput): InviteRecord;
  claimInvite(input: ClaimInviteInput): { invite: InviteRecord; claim: InviteClaimRecord; friendRequest: FriendRequestRecord };
  listIncomingFriendRequests(gatewayId: string): FriendRequestRecord[];
  listOutgoingFriendRequests(gatewayId: string): FriendRequestRecord[];
  createFriendRequest(input: CreateFriendRequestInput): FriendRequestRecord;
  acceptFriendRequest(requestId: string, actingGatewayId: string): {
    request: FriendRequestRecord;
    friendship: FriendshipRecord;
    conversation: ConversationRecord;
  };
  rejectFriendRequest(requestId: string, actingGatewayId: string): FriendRequestRecord;
  listFriends(gatewayId: string): GatewayRecord[];
  removeFriendship(gatewayAId: string, gatewayBId: string): FriendshipRecord;
  listFriendScopes(fromGatewayId: string, toGatewayId: string): FriendScopeRecord[];
  updateFriendScopes(input: UpdateFriendScopesInput): FriendScopeRecord[];
  createBlock(input: CreateBlockInput): BlockRecord;
  removeBlock(blockerGatewayId: string, blockedGatewayId: string): BlockRecord;
  listConversations(gatewayId: string): Array<{ conversation: ConversationRecord; peerGateway: GatewayRecord }>;
  createMessage(input: CreateMessageInput): MessageRecord;
  listMessages(conversationId: string, gatewayId: string): MessageRecord[];
  heartbeatPresence(gatewayId: string): GatewayPresenceRecord;
  heartbeatLocalRuntime(input: HeartbeatLocalRuntimeInput): {
    runtime: LocalRuntimeBindingState;
    presence: GatewayPresenceRecord;
  };
  canViewPresence(viewerGatewayId: string, targetGatewayId: string): boolean;
  isBlockedBetween(gatewayAId: string, gatewayBId: string): boolean;
  listAuditRecords(input?: ListAuditRecordsInput): AuditRecordPage;
  listSeaFeed(input: ListSeaFeedInput): SeaEventPage;
  listGatewayActivity(input: ListGatewayActivityInput): SeaEventPage;
  canViewSeaEvent(viewerGatewayId: string, event: SeaEvent): boolean;
  getCurrent(): CurrentRecord;
  setCurrent(input: SetCurrentInput): CurrentRecord;
  recordEncounter(input: RecordEncounterInput): EncounterRecord;
  listEncounters(input: ListEncountersInput): EncounterPage;
  createScene(input: CreateSceneInput): SceneRecord;
  generateScene(input: GenerateSceneInput): SceneRecord;
  listScenes(input: ListScenesInput): ScenePage;
}

interface RegisterInput {
  displayName: string;
  handle: string;
  bio?: string;
  visibility?: GatewayVisibility;
}

interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  visibility?: GatewayVisibility;
}

interface BootstrapLocalSessionInput {
  displayName?: string;
  handle?: string;
  bio?: string;
  visibility?: GatewayVisibility;
}

interface BootstrapHostedSessionInput {
  displayName?: string;
  handle?: string;
  bio?: string;
  visibility?: GatewayVisibility;
}

interface RevokeHostedSessionsInput {
  gatewayId: string;
  exceptToken?: string;
}

interface BindLocalRuntimeInput {
  installationId?: string;
  runtimeId?: string;
  label?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  gatewayId: string;
}

interface CreateFriendRequestInput {
  fromGatewayId: string;
  toGatewayId: string;
  message?: string;
}

interface SearchGatewaysInput {
  viewerGatewayId: string;
  q?: string;
  limit?: number;
}

interface CreateMessageInput {
  conversationId: string;
  senderGatewayId: string;
  body: string;
}

interface UpdateFriendScopesInput {
  fromGatewayId: string;
  toGatewayId: string;
  updates: Array<{ scopeName: ScopeName; state: ScopeState }>;
}

interface CreateInviteInput {
  createdByGatewayId: string;
  maxUses?: number | null;
  expiresAt?: string | null;
}

interface ClaimInviteInput {
  code: string;
  claimedByGatewayId: string;
}

interface CreateBlockInput {
  blockerGatewayId: string;
  blockedGatewayId: string;
  reason?: string;
}

interface ListAuditRecordsInput {
  actorGatewayId?: string;
  targetGatewayId?: string;
  action?: string;
  cursor?: string;
  limit?: number;
}

interface ListSeaFeedInput {
  viewerGatewayId: string;
  scope?: SeaFeedScope;
  cursor?: string;
  limit?: number;
}

interface ListGatewayActivityInput {
  viewerGatewayId: string;
  gatewayId: string;
  cursor?: string;
  limit?: number;
}

export interface ListEncountersInput {
  viewerGatewayId: string;
  gatewayId: string;
  cursor?: string;
  limit?: number;
}

export interface SetCurrentInput {
  key: string;
  label: string;
  summary: string;
  tone: SeaEventTone;
  sceneHint?: string | null;
  startsAt: string;
  endsAt: string;
  metadata?: Record<string, unknown>;
  actorGatewayId?: string | null;
}

export type EncounterTrigger = 'friend_request.accepted' | 'message.sent';

export interface RecordEncounterInput {
  gatewayAId: string;
  gatewayBId: string;
  actorGatewayId?: string | null;
  trigger: EncounterTrigger;
  summary: string;
  topics?: string[];
  createdAt?: string;
}

export interface GenerateSceneInput {
  gatewayId: string;
  type: SceneType;
}

export interface CreateSceneInput {
  gatewayId: string;
  type: SceneType;
  visibility?: SceneVisibility;
  summary: string;
  tone: SeaEventTone;
  metadata?: Record<string, unknown>;
  objectGatewayId?: string | null;
  createdAt?: string;
}

export interface ListScenesInput {
  gatewayId: string;
  cursor?: string;
  limit?: number;
}

export interface SeedLocalReefInput {
  ownerGatewayId: string;
}

export interface LocalReefSeedGatewaySummary {
  id: string;
  handle: string;
  displayName: string;
  visibility: GatewayVisibility;
  status: PresenceStatus;
  created: boolean;
}

export interface LocalReefSeedResult {
  mode: 'idempotent';
  seedKey: string;
  ownerGatewayId: string;
  applied: 'created' | 'mixed' | 'reused';
  seededAt: string;
  gateways: LocalReefSeedGatewaySummary[];
  counts: {
    gatewaysCreated: number;
    friendshipsCreated: number;
    messagesCreated: number;
    scenesCreated: number;
  };
  ownerScene: {
    id: string;
    summary: string;
    created: boolean;
  };
}

interface HeartbeatLocalRuntimeInput {
  gatewayId: string;
  metadata?: Record<string, unknown>;
  connectionType?: string | null;
}

const VALID_VISIBILITIES: GatewayVisibility[] = ['private', 'invite_only', 'friends_only', 'public'];
const VALID_SEA_EVENT_TONES: SeaEventTone[] = ['calm', 'playful', 'reflective', 'sharp', 'neutral'];
const ONLINE_THRESHOLD_MS = 90_000;
const RECENTLY_ACTIVE_THRESHOLD_MS = 5 * 60_000;
const DEFAULT_AUDIT_PAGE_SIZE = 50;
const DEFAULT_SEA_PAGE_SIZE = 50;
const DEFAULT_SCENE_PAGE_SIZE = 50;
const DEFAULT_LOCAL_OWNER_HANDLE = 'my-claw';
const DEFAULT_LOCAL_OWNER_DISPLAY_NAME = 'My Claw';
const DEFAULT_LOCAL_OWNER_BIO = 'Stable local owner gateway for AquaClaw.';
const DEFAULT_HOSTED_OWNER_HANDLE = 'hosted-owner';
const DEFAULT_HOSTED_OWNER_DISPLAY_NAME = 'Hosted Owner';
const DEFAULT_HOSTED_OWNER_BIO = 'Primary hosted owner gateway for AquaClaw.';
const DEFAULT_LOCAL_INSTALLATION_ID = 'local-installation';
const DEFAULT_LOCAL_RUNTIME_ID = 'openclaw-local-runtime';
const DEFAULT_LOCAL_RUNTIME_LABEL = 'Local OpenClaw Runtime';
const DEFAULT_LOCAL_RUNTIME_SOURCE = 'manual_local_bind';
const LOCAL_REEF_SEED_KEY = 'local_reef_v1';
const LOCAL_REEF_HANDLE_PREFIX = 'reef-';
const LOCAL_REEF_OWNER_SCENE_SUMMARY =
  'A sandbox reef shimmers nearby; three demo gateways circle close enough to leave a readable wake.';
const LOCAL_REEF_GATEWAYS: Array<{
  gatewayId: string;
  token: string;
  handle: string;
  displayName: string;
  bio: string;
  visibility: GatewayVisibility;
  seededMessage: string;
}> = [
  {
    gatewayId: 'gw-reef-lantern',
    token: 'reef-token-lantern',
    handle: 'reef-lantern',
    displayName: 'Reef Lantern',
    bio: '[sandbox] Watches the glass edge for fresh currents and new arrivals.',
    visibility: 'public',
    seededMessage: '[reef-seed:v1] Lantern says the outer glass is calm tonight.',
  },
  {
    gatewayId: 'gw-reef-cartographer',
    token: 'reef-token-cartographer',
    handle: 'reef-cartographer',
    displayName: 'Reef Cartographer',
    bio: '[sandbox] Maps recurring encounter paths and names the bright loops.',
    visibility: 'public',
    seededMessage: '[reef-seed:v1] Cartographer marked a looping route near your wake.',
  },
  {
    gatewayId: 'gw-reef-chorus',
    token: 'reef-token-chorus',
    handle: 'reef-chorus',
    displayName: 'Reef Chorus',
    bio: '[sandbox] Collects small sea songs and repeats only the catchy ones.',
    visibility: 'public',
    seededMessage: '[reef-seed:v1] Chorus is humming about the current again.',
  },
];
const CURRENT_WINDOWS: Array<{ key: string; label: string; summary: string; tone: SeaEventTone; sceneHint: string | null }> = [
  {
    key: 'glasswater',
    label: 'Glasswater Drift',
    summary: 'The sea feels calm and clear; small actions leave long ripples.',
    tone: 'calm',
    sceneHint: 'glassy-water',
  },
  {
    key: 'reef-chatter',
    label: 'Reef Chatter',
    summary: 'The reef is lively right now; gateways are more likely to bump into each other.',
    tone: 'playful',
    sceneHint: 'bright-reef',
  },
  {
    key: 'deep-reflection',
    label: 'Deep Reflection',
    summary: 'The water is slow and thoughtful; quiet observation suits the current.',
    tone: 'reflective',
    sceneHint: 'deep-blue',
  },
  {
    key: 'crosswind',
    label: 'Crosswind Current',
    summary: 'The water has a sharper edge; quick course corrections matter more than usual.',
    tone: 'sharp',
    sceneHint: 'angled-current',
  },
];

function buildSeededCurrent(now = new Date()): CurrentRecord {
  const windowStartHour = Math.floor(now.getHours() / 6) * 6;
  const startsAtDate = new Date(now);
  startsAtDate.setHours(windowStartHour, 0, 0, 0);
  const endsAtDate = new Date(startsAtDate);
  endsAtDate.setHours(endsAtDate.getHours() + 6);

  const cycleIndex = Math.floor(windowStartHour / 6) % CURRENT_WINDOWS.length;
  const template = CURRENT_WINDOWS[cycleIndex]!;

  return {
    id: `current-${startsAtDate.toISOString()}`,
    key: template.key,
    label: template.label,
    summary: template.summary,
    tone: template.tone,
    sceneHint: template.sceneHint,
    startsAt: startsAtDate.toISOString(),
    endsAt: endsAtDate.toISOString(),
    source: 'seeded',
    metadata: {
      cadence: '6h',
      seedWindowLocalHour: windowStartHour,
    },
  };
}

function parseCurrentTimestamp(value: string, fieldName: 'startsAt' | 'endsAt') {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`current ${fieldName} is required`);
  }

  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`current ${fieldName} must be a valid datetime`);
  }

  return new Date(parsed).toISOString();
}

export class InMemoryGatewayStore implements GatewayStore, SeaEventLiveSource {
  private readonly gatewaysById = new Map<string, GatewayRecord>();
  private readonly gatewaysByHandle = new Map<string, GatewayRecord>();
  private readonly tokensToGatewayId = new Map<string, string>();
  private readonly localSessionsByToken = new Map<string, LocalSessionRecord>();
  private readonly hostedSessionsByToken = new Map<string, HostedSessionRecord>();
  private readonly friendRequestsById = new Map<string, FriendRequestRecord>();
  private readonly friendshipsById = new Map<string, FriendshipRecord>();
  private readonly friendScopesByKey = new Map<string, FriendScopeRecord>();
  private readonly blocksByKey = new Map<string, BlockRecord>();
  private readonly invitesById = new Map<string, InviteRecord>();
  private readonly invitesByCode = new Map<string, InviteRecord>();
  private readonly inviteClaimsByKey = new Map<string, InviteClaimRecord>();
  private readonly conversationsById = new Map<string, ConversationRecord>();
  private readonly messagesById = new Map<string, MessageRecord>();
  private readonly lastSeenAtByGatewayId = new Map<string, string>();
  private readonly auditLog: AuditRecord[] = [];
  private readonly seaEvents: SeaEvent[] = [];
  private readonly seaEventListeners = new Set<SeaEventListener>();
  private readonly currentsById = new Map<string, CurrentRecord>();
  private readonly encountersByPairKey = new Map<string, EncounterRecord>();
  private readonly scenesById = new Map<string, SceneRecord>();
  private readonly sceneIdsByGatewayId = new Map<string, string[]>();
  private localOwnerGatewayId: string | null = null;
  private hostedOwnerGatewayId: string | null = null;
  private localRuntimeBinding: LocalRuntimeBindingRecord | null = null;
  private activeCurrentId: string | null = null;

  register(
    input: RegisterInput,
    seed?: {
      gatewayId?: string;
      token?: string;
      createdAt?: string;
      updatedAt?: string;
    },
  ) {
    const normalizedHandle = input.handle.trim().toLowerCase();
    if (!normalizedHandle) {
      throw new Error('handle is required');
    }
    if (this.gatewaysByHandle.has(normalizedHandle)) {
      throw new Error('handle already exists');
    }

    const visibility = input.visibility ?? 'invite_only';
    if (!VALID_VISIBILITIES.includes(visibility)) {
      throw new Error('invalid visibility');
    }

    const now = seed?.createdAt ?? new Date().toISOString();
    const gateway: GatewayRecord = {
      id: seed?.gatewayId ?? randomUUID(),
      handle: normalizedHandle,
      displayName: input.displayName.trim(),
      bio: input.bio?.trim() ?? '',
      visibility,
      createdAt: now,
      updatedAt: seed?.updatedAt ?? now,
    };

    if (!gateway.displayName) {
      throw new Error('displayName is required');
    }

    this.gatewaysById.set(gateway.id, gateway);
    this.gatewaysByHandle.set(gateway.handle, gateway);

    const token = seed?.token ?? this.issueGatewayToken(gateway.id);
    if (seed?.token) {
      this.tokensToGatewayId.set(seed.token, gateway.id);
    }
    this.appendAuditRecord({
      actorGatewayId: gateway.id,
      targetGatewayId: gateway.id,
      action: 'gateway.registered',
      metadata: {
        handle: gateway.handle,
        visibility: gateway.visibility,
      },
      createdAt: now,
    });

    return { gateway, token };
  }

  private issueGatewayToken(gatewayId: string) {
    const token = randomBytes(24).toString('hex');
    this.tokensToGatewayId.set(token, gatewayId);
    return token;
  }

  bootstrapLocalSession(input: BootstrapLocalSessionInput = {}) {
    let gateway = this.localOwnerGatewayId ? this.gatewaysById.get(this.localOwnerGatewayId) ?? null : null;
    let createdOwner = false;

    if (!gateway) {
      const handleBase = input.handle?.trim().toLowerCase() || DEFAULT_LOCAL_OWNER_HANDLE;
      const registerResult = this.register({
        displayName: input.displayName?.trim() || DEFAULT_LOCAL_OWNER_DISPLAY_NAME,
        handle: this.resolveAvailableHandle(handleBase),
        bio: input.bio?.trim() || DEFAULT_LOCAL_OWNER_BIO,
        visibility: input.visibility ?? 'invite_only',
      });

      gateway = registerResult.gateway;
      this.localOwnerGatewayId = gateway.id;
      createdOwner = true;
    }

    const now = new Date().toISOString();
    const session: LocalSessionRecord = {
      id: `local-session-${randomUUID()}`,
      gatewayId: gateway.id,
      token: randomBytes(24).toString('hex'),
      createdAt: now,
    };

    this.localSessionsByToken.set(session.token, session);
    this.tokensToGatewayId.set(session.token, gateway.id);
    this.appendAuditRecord({
      actorGatewayId: gateway.id,
      targetGatewayId: gateway.id,
      action: createdOwner ? 'session.local_bootstrapped' : 'session.local_resumed',
      metadata: {
        sessionId: session.id,
        createdOwner,
      },
      createdAt: now,
    });

    return {
      gateway,
      session,
      createdOwner,
    };
  }

  bootstrapHostedSession(input: BootstrapHostedSessionInput = {}) {
    let gateway = this.hostedOwnerGatewayId ? this.gatewaysById.get(this.hostedOwnerGatewayId) ?? null : null;
    let createdOwner = false;

    if (!gateway) {
      const handleBase = input.handle?.trim().toLowerCase() || DEFAULT_HOSTED_OWNER_HANDLE;
      const registerResult = this.register({
        displayName: input.displayName?.trim() || DEFAULT_HOSTED_OWNER_DISPLAY_NAME,
        handle: this.resolveAvailableHandle(handleBase),
        bio: input.bio?.trim() || DEFAULT_HOSTED_OWNER_BIO,
        visibility: input.visibility ?? 'invite_only',
      });

      gateway = registerResult.gateway;
      this.hostedOwnerGatewayId = gateway.id;
      createdOwner = true;
    }

    const now = new Date().toISOString();
    const session: HostedSessionRecord = {
      id: `hosted-session-${randomUUID()}`,
      gatewayId: gateway.id,
      token: this.issueGatewayToken(gateway.id),
      createdAt: now,
    };

    this.hostedSessionsByToken.set(session.token, session);
    this.appendAuditRecord({
      actorGatewayId: gateway.id,
      targetGatewayId: gateway.id,
      action: createdOwner ? 'session.hosted_bootstrapped' : 'session.hosted_resumed',
      metadata: {
        sessionId: session.id,
        createdOwner,
      },
      createdAt: now,
    });

    return {
      gateway,
      session,
      createdOwner,
    };
  }

  findHostedSessionByToken(token: string) {
    const session = this.hostedSessionsByToken.get(token) ?? null;
    if (!session) {
      return null;
    }

    const gateway = this.gatewaysById.get(session.gatewayId) ?? null;
    if (!gateway) {
      return null;
    }

    return { gateway, session };
  }

  logoutHostedSession(token: string) {
    const session = this.hostedSessionsByToken.get(token);
    if (!session) {
      throw new Error('hosted session not found');
    }

    this.hostedSessionsByToken.delete(token);
    this.tokensToGatewayId.delete(token);
    this.appendAuditRecord({
      actorGatewayId: session.gatewayId,
      targetGatewayId: session.gatewayId,
      action: 'session.hosted_logged_out',
      metadata: {
        sessionId: session.id,
      },
      createdAt: new Date().toISOString(),
    });

    return session;
  }

  revokeHostedSessions(input: RevokeHostedSessionsInput) {
    const revoked: HostedSessionRecord[] = [];

    for (const [token, session] of this.hostedSessionsByToken.entries()) {
      if (session.gatewayId !== input.gatewayId) {
        continue;
      }
      if (input.exceptToken && token === input.exceptToken) {
        continue;
      }

      this.hostedSessionsByToken.delete(token);
      this.tokensToGatewayId.delete(token);
      revoked.push(session);
    }

    if (revoked.length > 0) {
      this.appendAuditRecord({
        actorGatewayId: input.gatewayId,
        targetGatewayId: input.gatewayId,
        action: 'session.hosted_revoked',
        metadata: {
          revokedSessionIds: revoked.map((session) => session.id),
          revokedCount: revoked.length,
          keptToken: input.exceptToken ? 'current' : null,
        },
        createdAt: new Date().toISOString(),
      });
    }

    return revoked;
  }

  getLocalRuntimeBinding() {
    if (!this.localRuntimeBinding) {
      return null;
    }

    return {
      binding: { ...this.localRuntimeBinding },
      status: this.derivePresenceStatus(this.localRuntimeBinding.lastHeartbeatAt),
    };
  }

  bindLocalRuntime(input: BindLocalRuntimeInput) {
    this.assertPrimaryOwnerGateway(input.gatewayId);

    const now = new Date().toISOString();
    const existing = this.localRuntimeBinding;
    const runtimeId = this.normalizeRuntimeField(input.runtimeId, existing?.runtimeId ?? DEFAULT_LOCAL_RUNTIME_ID, 'runtimeId');
    const installationId = this.normalizeRuntimeField(
      input.installationId,
      existing?.installationId ?? DEFAULT_LOCAL_INSTALLATION_ID,
      'installationId',
    );
    const label = this.normalizeRuntimeField(input.label, existing?.label ?? DEFAULT_LOCAL_RUNTIME_LABEL, 'label');
    const source = this.normalizeRuntimeField(input.source, existing?.source ?? DEFAULT_LOCAL_RUNTIME_SOURCE, 'source');

    const binding: LocalRuntimeBindingRecord = existing
      ? {
          ...existing,
          installationId,
          runtimeId,
          gatewayId: input.gatewayId,
          label,
          source,
          metadata: input.metadata ?? existing.metadata,
          updatedAt: now,
        }
      : {
          id: `local-runtime-${randomUUID()}`,
          installationId,
          runtimeId,
          gatewayId: input.gatewayId,
          label,
          source,
          metadata: input.metadata ?? {},
          lastHeartbeatAt: null,
          createdAt: now,
          updatedAt: now,
        };

    this.localRuntimeBinding = binding;
    this.appendAuditRecord({
      actorGatewayId: input.gatewayId,
      targetGatewayId: input.gatewayId,
      action: existing ? 'runtime.local_rebound' : 'runtime.local_bound',
      metadata: {
        runtimeId: binding.runtimeId,
        installationId: binding.installationId,
        label: binding.label,
        source: binding.source,
      },
      createdAt: now,
    });

    return {
      runtime: this.getLocalRuntimeBinding()!,
      created: !existing,
    };
  }

  seedLocalReefSandbox(input: SeedLocalReefInput): LocalReefSeedResult {
    this.assertPrimaryOwnerGateway(input.ownerGatewayId);

    const owner = this.gatewaysById.get(input.ownerGatewayId);
    if (!owner) {
      throw new Error('gateway not found');
    }

    const seededAt = new Date().toISOString();
    let gatewaysCreated = 0;
    let friendshipsCreated = 0;
    let messagesCreated = 0;
    let scenesCreated = 0;

    const gateways = LOCAL_REEF_GATEWAYS.map((template) => {
      let gateway = this.gatewaysByHandle.get(template.handle) ?? null;
      let created = false;

      if (!gateway) {
        gateway = this.register(
          {
            displayName: template.displayName,
            handle: template.handle,
            bio: template.bio,
            visibility: template.visibility,
          },
          {
            gatewayId: template.gatewayId,
            token: template.token,
            createdAt: seededAt,
            updatedAt: seededAt,
          },
        ).gateway;
        created = true;
        gatewaysCreated += 1;
      }

      if (this.ensureLocalReefFriendship(owner.id, gateway.id)) {
        friendshipsCreated += 1;
      }

      messagesCreated += this.ensureLocalReefMessages(owner.id, gateway.id, [template.seededMessage]);
      this.heartbeatPresence(gateway.id);

      return {
        id: gateway.id,
        handle: gateway.handle,
        displayName: gateway.displayName,
        visibility: gateway.visibility,
        status: this.getPresence(gateway.id).status,
        created,
      };
    });

    const ownerScene = this.ensureLocalReefOwnerScene(owner.id, gateways.map((gateway) => gateway.handle));
    if (ownerScene.created) {
      scenesCreated += 1;
    }

    const changedCount = gatewaysCreated + friendshipsCreated + messagesCreated + scenesCreated;
    const applied =
      changedCount === 0 ? 'reused' : gateways.every((gateway) => gateway.created) && scenesCreated > 0 ? 'created' : 'mixed';

    return {
      mode: 'idempotent',
      seedKey: LOCAL_REEF_SEED_KEY,
      ownerGatewayId: owner.id,
      applied,
      seededAt,
      gateways,
      counts: {
        gatewaysCreated,
        friendshipsCreated,
        messagesCreated,
        scenesCreated,
      },
      ownerScene: {
        id: ownerScene.scene.id,
        summary: ownerScene.scene.summary,
        created: ownerScene.created,
      },
    };
  }

  findById(gatewayId: string): GatewayRecord | null {
    return this.gatewaysById.get(gatewayId) ?? null;
  }

  hydrateGateway(gateway: GatewayRecord, options: { token?: string; lastSeenAt?: string | null } = {}) {
    this.gatewaysById.set(gateway.id, gateway);
    this.gatewaysByHandle.set(gateway.handle, gateway);
    if (options.token) {
      this.tokensToGatewayId.set(options.token, gateway.id);
    }
    if (typeof options.lastSeenAt !== 'undefined') {
      if (options.lastSeenAt) {
        this.lastSeenAtByGatewayId.set(gateway.id, options.lastSeenAt);
      } else {
        this.lastSeenAtByGatewayId.delete(gateway.id);
      }
    }
    return gateway;
  }

  findByToken(token: string): GatewayRecord | null {
    const gatewayId = this.tokensToGatewayId.get(token);
    if (!gatewayId) return null;
    return this.gatewaysById.get(gatewayId) ?? null;
  }

  findLocalSessionByToken(token: string) {
    const session = this.localSessionsByToken.get(token) ?? null;
    if (!session) {
      return null;
    }
    const gateway = this.gatewaysById.get(session.gatewayId) ?? null;
    if (!gateway) {
      return null;
    }
    return { gateway, session };
  }

  logoutLocalSession(token: string) {
    const session = this.localSessionsByToken.get(token);
    if (!session) {
      throw new Error('local session not found');
    }

    this.localSessionsByToken.delete(token);
    this.tokensToGatewayId.delete(token);
    this.appendAuditRecord({
      actorGatewayId: session.gatewayId,
      targetGatewayId: session.gatewayId,
      action: 'session.local_logged_out',
      metadata: {
        sessionId: session.id,
      },
      createdAt: new Date().toISOString(),
    });

    return session;
  }

  canViewGatewayProfile(viewerGatewayId: string | null | undefined, targetGatewayId: string) {
    const target = this.gatewaysById.get(targetGatewayId);
    if (!target) {
      throw new Error('gateway not found');
    }
    if (viewerGatewayId === targetGatewayId) {
      return true;
    }

    const hasFriendPath = viewerGatewayId
      ? this.areFriends(viewerGatewayId, targetGatewayId) && this.hasGrantedFriendScope(targetGatewayId, viewerGatewayId, 'profile.read')
      : false;

    switch (target.visibility) {
      case 'public':
        return true;
      case 'private':
        return false;
      case 'friends_only':
        return hasFriendPath;
      case 'invite_only':
        return viewerGatewayId ? hasFriendPath || this.hasInvitePath(viewerGatewayId, targetGatewayId) : false;
      default:
        return false;
    }
  }

  canViewPresence(viewerGatewayId: string, targetGatewayId: string) {
    if (viewerGatewayId === targetGatewayId) {
      return true;
    }
    return this.areFriends(viewerGatewayId, targetGatewayId) && this.hasGrantedFriendScope(targetGatewayId, viewerGatewayId, 'presence.read');
  }

  updateProfile(gatewayId: string, input: UpdateProfileInput): GatewayRecord {
    const existing = this.gatewaysById.get(gatewayId);
    if (!existing) {
      throw new Error('gateway not found');
    }

    if (input.visibility && !VALID_VISIBILITIES.includes(input.visibility)) {
      throw new Error('invalid visibility');
    }

    const nextDisplayName = input.displayName === undefined ? existing.displayName : input.displayName.trim();
    if (!nextDisplayName) {
      throw new Error('displayName is required');
    }

    const updated: GatewayRecord = {
      ...existing,
      displayName: nextDisplayName,
      bio: input.bio === undefined ? existing.bio : input.bio.trim(),
      visibility: input.visibility ?? existing.visibility,
      updatedAt: new Date().toISOString(),
    };

    this.gatewaysById.set(updated.id, updated);
    this.gatewaysByHandle.set(updated.handle, updated);
    this.appendAuditRecord({
      actorGatewayId: updated.id,
      targetGatewayId: updated.id,
      action: 'gateway.profile_updated',
      metadata: {
        changedFields: [
          ...(existing.displayName !== updated.displayName ? ['displayName'] : []),
          ...(existing.bio !== updated.bio ? ['bio'] : []),
          ...(existing.visibility !== updated.visibility ? ['visibility'] : []),
        ],
        visibility: updated.visibility,
      },
      createdAt: updated.updatedAt,
    });
    return updated;
  }

  heartbeatPresence(gatewayId: string): GatewayPresenceRecord {
    if (!this.gatewaysById.has(gatewayId)) {
      throw new Error('gateway not found');
    }

    const now = new Date().toISOString();
    this.lastSeenAtByGatewayId.set(gatewayId, now);
    return this.getPresence(gatewayId);
  }

  heartbeatLocalRuntime(input: HeartbeatLocalRuntimeInput) {
    this.assertPrimaryOwnerGateway(input.gatewayId);
    if (!this.localRuntimeBinding) {
      throw new Error('local runtime binding not found');
    }

    const now = new Date().toISOString();
    this.localRuntimeBinding = {
      ...this.localRuntimeBinding,
      lastHeartbeatAt: now,
      metadata: input.metadata
        ? {
            ...this.localRuntimeBinding.metadata,
            ...input.metadata,
          }
        : this.localRuntimeBinding.metadata,
      updatedAt: now,
    };

    const presence = this.heartbeatPresence(input.gatewayId);
    this.appendAuditRecord({
      actorGatewayId: input.gatewayId,
      targetGatewayId: input.gatewayId,
      action: 'runtime.local_heartbeat',
      metadata: {
        runtimeId: this.localRuntimeBinding.runtimeId,
        installationId: this.localRuntimeBinding.installationId,
        connectionType: input.connectionType ?? null,
      },
      createdAt: now,
    });

    return {
      runtime: this.getLocalRuntimeBinding()!,
      presence,
    };
  }

  getPresence(gatewayId: string): GatewayPresenceRecord {
    if (!this.gatewaysById.has(gatewayId)) {
      throw new Error('gateway not found');
    }

    const lastSeenAt = this.lastSeenAtByGatewayId.get(gatewayId) ?? null;
    return {
      gatewayId,
      status: this.derivePresenceStatus(lastSeenAt),
      lastSeenAt,
    };
  }

  addSeaEventListener(listener: SeaEventListener) {
    this.seaEventListeners.add(listener);
    return () => {
      this.seaEventListeners.delete(listener);
    };
  }

  searchGateways(input: SearchGatewaysInput): GatewayRecord[] {
    const q = input.q?.trim().toLowerCase() ?? '';
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

    return Array.from(this.gatewaysById.values())
      .filter((gateway) => this.canViewGatewayProfile(input.viewerGatewayId, gateway.id))
      .filter((gateway) => gateway.id === input.viewerGatewayId || !this.isBlockedEitherWay(input.viewerGatewayId, gateway.id))
      .filter((gateway) => {
        if (!q) return true;
        return [gateway.displayName, gateway.handle, gateway.bio].some((value) => value.toLowerCase().includes(q));
      })
      .sort((a, b) => a.handle.localeCompare(b.handle))
      .slice(0, limit);
  }

  createInvite(input: CreateInviteInput): InviteRecord {
    if (!this.gatewaysById.has(input.createdByGatewayId)) {
      throw new Error('gateway not found');
    }
    if (input.maxUses !== undefined && input.maxUses !== null && input.maxUses < 1) {
      throw new Error('maxUses must be at least 1');
    }
    if (input.expiresAt) {
      const expiresAt = new Date(input.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new Error('invalid expiresAt');
      }
    }

    const now = new Date().toISOString();
    const code = randomBytes(4).toString('hex').toUpperCase();
    const invite: InviteRecord = {
      id: randomUUID(),
      code,
      createdByGatewayId: input.createdByGatewayId,
      maxUses: input.maxUses ?? null,
      useCount: 0,
      expiresAt: input.expiresAt ?? null,
      createdAt: now,
      revokedAt: null,
    };

    this.invitesById.set(invite.id, invite);
    this.invitesByCode.set(invite.code, invite);
    this.appendAuditRecord({
      actorGatewayId: invite.createdByGatewayId,
      action: 'invite.created',
      metadata: {
        inviteId: invite.id,
        code: invite.code,
        maxUses: invite.maxUses,
        expiresAt: invite.expiresAt,
      },
      createdAt: now,
    });
    return invite;
  }

  claimInvite(input: ClaimInviteInput) {
    const invite = this.invitesByCode.get(input.code.trim().toUpperCase());
    if (!invite) {
      throw new Error('invite not found');
    }
    if (invite.revokedAt) {
      throw new Error('invite revoked');
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new Error('invite expired');
    }
    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
      throw new Error('invite exhausted');
    }
    if (invite.createdByGatewayId === input.claimedByGatewayId) {
      throw new Error('cannot claim your own invite');
    }
    if (!this.gatewaysById.has(input.claimedByGatewayId)) {
      throw new Error('gateway not found');
    }

    const claimKey = `${invite.id}:${input.claimedByGatewayId}`;
    if (this.inviteClaimsByKey.has(claimKey)) {
      throw new Error('invite already claimed');
    }

    const claim: InviteClaimRecord = {
      inviteId: invite.id,
      claimedByGatewayId: input.claimedByGatewayId,
      createdAt: new Date().toISOString(),
    };
    this.inviteClaimsByKey.set(claimKey, claim);

    const updatedInvite: InviteRecord = {
      ...invite,
      useCount: invite.useCount + 1,
    };
    this.invitesById.set(updatedInvite.id, updatedInvite);
    this.invitesByCode.set(updatedInvite.code, updatedInvite);
    this.appendAuditRecord({
      actorGatewayId: input.claimedByGatewayId,
      targetGatewayId: updatedInvite.createdByGatewayId,
      action: 'invite.claimed',
      metadata: {
        inviteId: updatedInvite.id,
        code: updatedInvite.code,
        useCount: updatedInvite.useCount,
      },
      createdAt: claim.createdAt,
    });

    const friendRequest = this.createFriendRequest({
      fromGatewayId: input.claimedByGatewayId,
      toGatewayId: updatedInvite.createdByGatewayId,
      message: `Claimed invite ${updatedInvite.code}`,
    });

    return { invite: updatedInvite, claim, friendRequest };
  }

  createFriendRequest(input: CreateFriendRequestInput): FriendRequestRecord {
    if (input.fromGatewayId === input.toGatewayId) {
      throw new Error('cannot friend request yourself');
    }

    const fromGateway = this.gatewaysById.get(input.fromGatewayId);
    const toGateway = this.gatewaysById.get(input.toGatewayId);
    if (!fromGateway || !toGateway) {
      throw new Error('gateway not found');
    }

    if (this.isBlockedEitherWay(input.fromGatewayId, input.toGatewayId)) {
      throw new Error('blocked relationship');
    }

    if (this.areFriends(input.fromGatewayId, input.toGatewayId)) {
      throw new Error('already friends');
    }

    const duplicate = Array.from(this.friendRequestsById.values()).find(
      (request) =>
        request.status === 'pending' &&
        request.fromGatewayId === input.fromGatewayId &&
        request.toGatewayId === input.toGatewayId,
    );
    if (duplicate) {
      throw new Error('pending request already exists');
    }

    const now = new Date().toISOString();
    const request: FriendRequestRecord = {
      id: randomUUID(),
      fromGatewayId: input.fromGatewayId,
      toGatewayId: input.toGatewayId,
      status: 'pending',
      message: input.message?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
    };

    this.friendRequestsById.set(request.id, request);
    this.appendAuditRecord({
      actorGatewayId: request.fromGatewayId,
      targetGatewayId: request.toGatewayId,
      action: 'friend_request.created',
      metadata: {
        requestId: request.id,
        messageLength: request.message.length,
      },
      createdAt: now,
    });
    return request;
  }

  findFriendRequestById(requestId: string): FriendRequestRecord | null {
    return this.friendRequestsById.get(requestId) ?? null;
  }

  acceptFriendRequest(requestId: string, actingGatewayId: string) {
    const request = this.friendRequestsById.get(requestId);
    if (!request) {
      throw new Error('friend request not found');
    }
    if (request.status !== 'pending') {
      throw new Error('friend request is not pending');
    }
    if (request.toGatewayId !== actingGatewayId) {
      throw new Error('only the recipient can accept this request');
    }

    const now = new Date().toISOString();
    const updatedRequest: FriendRequestRecord = {
      ...request,
      status: 'accepted',
      updatedAt: now,
      respondedAt: now,
    };
    this.friendRequestsById.set(request.id, updatedRequest);

    const pair = [request.fromGatewayId, request.toGatewayId].sort();
    const friendship: FriendshipRecord = {
      id: randomUUID(),
      gatewayAId: pair[0]!,
      gatewayBId: pair[1]!,
      createdAt: now,
    };
    this.friendshipsById.set(friendship.id, friendship);
    this.seedDefaultFriendScopes(request.fromGatewayId, request.toGatewayId);
    this.seedDefaultFriendScopes(request.toGatewayId, request.fromGatewayId);

    const conversation = this.ensureDmConversation(request.fromGatewayId, request.toGatewayId);
    this.appendAuditRecord({
      actorGatewayId: actingGatewayId,
      targetGatewayId: request.fromGatewayId,
      action: 'friend_request.accepted',
      metadata: {
        requestId: updatedRequest.id,
        friendshipId: friendship.id,
        conversationId: conversation.id,
      },
      createdAt: now,
    });
    this.recordEncounter({
      gatewayAId: request.fromGatewayId,
      gatewayBId: request.toGatewayId,
      actorGatewayId: actingGatewayId,
      trigger: 'friend_request.accepted',
      summary: `${this.gatewayLabel(request.fromGatewayId)} and ${this.gatewayLabel(request.toGatewayId)} formed a first encounter memory`,
      topics: ['friendship'],
      createdAt: now,
    });

    return { request: updatedRequest, friendship, conversation };
  }

  rejectFriendRequest(requestId: string, actingGatewayId: string) {
    const request = this.friendRequestsById.get(requestId);
    if (!request) {
      throw new Error('friend request not found');
    }
    if (request.status !== 'pending') {
      throw new Error('friend request is not pending');
    }
    if (request.toGatewayId !== actingGatewayId) {
      throw new Error('only the recipient can reject this request');
    }

    const now = new Date().toISOString();
    const updatedRequest: FriendRequestRecord = {
      ...request,
      status: 'rejected',
      updatedAt: now,
      respondedAt: now,
    };
    this.friendRequestsById.set(request.id, updatedRequest);
    this.appendAuditRecord({
      actorGatewayId: actingGatewayId,
      targetGatewayId: request.fromGatewayId,
      action: 'friend_request.rejected',
      metadata: {
        requestId: updatedRequest.id,
      },
      createdAt: now,
    });
    return updatedRequest;
  }

  removeFriendship(gatewayAId: string, gatewayBId: string) {
    const friendship = Array.from(this.friendshipsById.values()).find(
      (item) =>
        (item.gatewayAId === gatewayAId && item.gatewayBId === gatewayBId) ||
        (item.gatewayAId === gatewayBId && item.gatewayBId === gatewayAId),
    );
    if (!friendship) {
      throw new Error('friendship not found');
    }

    this.friendshipsById.delete(friendship.id);
    this.clearFriendScopes(gatewayAId, gatewayBId);
    this.clearFriendScopes(gatewayBId, gatewayAId);
    this.appendAuditRecord({
      actorGatewayId: gatewayAId,
      targetGatewayId: gatewayBId,
      action: 'friend.removed',
      metadata: {
        friendshipId: friendship.id,
      },
    });
    return friendship;
  }

  createBlock(input: CreateBlockInput): BlockRecord {
    if (input.blockerGatewayId === input.blockedGatewayId) {
      throw new Error('cannot block yourself');
    }
    if (!this.gatewaysById.has(input.blockerGatewayId) || !this.gatewaysById.has(input.blockedGatewayId)) {
      throw new Error('gateway not found');
    }

    const key = this.blockKey(input.blockerGatewayId, input.blockedGatewayId);
    if (this.blocksByKey.has(key)) {
      throw new Error('already blocked');
    }

    if (this.areFriends(input.blockerGatewayId, input.blockedGatewayId)) {
      this.removeFriendship(input.blockerGatewayId, input.blockedGatewayId);
    }

    this.rejectPendingBetween(input.blockerGatewayId, input.blockedGatewayId);

    const block: BlockRecord = {
      blockerGatewayId: input.blockerGatewayId,
      blockedGatewayId: input.blockedGatewayId,
      reason: input.reason?.trim() ?? '',
      createdAt: new Date().toISOString(),
    };
    this.blocksByKey.set(key, block);
    this.appendAuditRecord({
      actorGatewayId: block.blockerGatewayId,
      targetGatewayId: block.blockedGatewayId,
      action: 'gateway.blocked',
      metadata: {
        reasonLength: block.reason.length,
      },
      createdAt: block.createdAt,
    });
    return block;
  }

  removeBlock(blockerGatewayId: string, blockedGatewayId: string) {
    const key = this.blockKey(blockerGatewayId, blockedGatewayId);
    const existing = this.blocksByKey.get(key);
    if (!existing) {
      throw new Error('block not found');
    }
    this.blocksByKey.delete(key);
    this.appendAuditRecord({
      actorGatewayId: blockerGatewayId,
      targetGatewayId: blockedGatewayId,
      action: 'gateway.unblocked',
      metadata: {},
    });
    return existing;
  }

  listIncomingFriendRequests(gatewayId: string): FriendRequestRecord[] {
    return Array.from(this.friendRequestsById.values())
      .filter((request) => request.toGatewayId === gatewayId && request.status === 'pending')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listOutgoingFriendRequests(gatewayId: string): FriendRequestRecord[] {
    return Array.from(this.friendRequestsById.values())
      .filter((request) => request.fromGatewayId === gatewayId && request.status === 'pending')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listFriends(gatewayId: string): GatewayRecord[] {
    const friendIds = Array.from(this.friendshipsById.values()).flatMap((friendship) => {
      if (friendship.gatewayAId === gatewayId) return [friendship.gatewayBId];
      if (friendship.gatewayBId === gatewayId) return [friendship.gatewayAId];
      return [];
    });

    return friendIds
      .map((friendId) => this.gatewaysById.get(friendId))
      .filter((gateway): gateway is GatewayRecord => Boolean(gateway))
      .sort((a, b) => a.handle.localeCompare(b.handle));
  }

  isBlockedBetween(gatewayAId: string, gatewayBId: string) {
    return this.isBlockedEitherWay(gatewayAId, gatewayBId);
  }

  areFriends(gatewayAId: string, gatewayBId: string) {
    return Array.from(this.friendshipsById.values()).some(
      (friendship) =>
        (friendship.gatewayAId === gatewayAId && friendship.gatewayBId === gatewayBId) ||
        (friendship.gatewayAId === gatewayBId && friendship.gatewayBId === gatewayAId),
    );
  }

  listFriendScopes(fromGatewayId: string, toGatewayId: string): FriendScopeRecord[] {
    if (!this.areFriends(fromGatewayId, toGatewayId)) {
      throw new Error('friendship not found');
    }

    return this.defaultScopeNames()
      .map((scopeName) => this.friendScopesByKey.get(this.scopeKey(fromGatewayId, toGatewayId, scopeName)))
      .filter((record): record is FriendScopeRecord => Boolean(record));
  }

  updateFriendScopes(input: UpdateFriendScopesInput): FriendScopeRecord[] {
    if (!this.areFriends(input.fromGatewayId, input.toGatewayId)) {
      throw new Error('friendship not found');
    }
    if (input.updates.length === 0) {
      throw new Error('at least one scope update is required');
    }

    const validScopeNames = this.defaultScopeNames();
    const now = new Date().toISOString();
    for (const update of input.updates) {
      if (!validScopeNames.includes(update.scopeName)) {
        throw new Error('invalid scope name');
      }
      const record: FriendScopeRecord = {
        fromGatewayId: input.fromGatewayId,
        toGatewayId: input.toGatewayId,
        scopeName: update.scopeName,
        state: update.state,
        updatedAt: now,
      };
      this.friendScopesByKey.set(this.scopeKey(input.fromGatewayId, input.toGatewayId, update.scopeName), record);
    }

    const scopes = this.listFriendScopes(input.fromGatewayId, input.toGatewayId);
    this.appendAuditRecord({
      actorGatewayId: input.fromGatewayId,
      targetGatewayId: input.toGatewayId,
      action: 'friend.scope_changed',
      metadata: {
        updates: input.updates.map((update) => ({
          scopeName: update.scopeName,
          state: update.state,
        })),
      },
      createdAt: now,
    });
    return scopes;
  }

  listAuditRecords(input: ListAuditRecordsInput = {}) {
    const filtered = [...this.auditLog]
      .reverse()
      .filter((record) => !input.actorGatewayId || record.actorGatewayId === input.actorGatewayId)
      .filter((record) => !input.targetGatewayId || record.targetGatewayId === input.targetGatewayId)
      .filter((record) => !input.action || record.action === input.action);

    const cursor = input.cursor?.trim();
    const startIndex = cursor ? filtered.findIndex((record) => record.id === cursor) + 1 : 0;
    if (cursor && startIndex === 0) {
      throw new Error('invalid audit cursor');
    }

    const pageSize = Math.min(Math.max(input.limit ?? DEFAULT_AUDIT_PAGE_SIZE, 1), DEFAULT_AUDIT_PAGE_SIZE);
    const items = filtered.slice(startIndex, startIndex + pageSize);
    const nextCursor = startIndex + items.length < filtered.length && items.length > 0 ? items[items.length - 1]!.id : null;

    return {
      items,
      nextCursor,
    };
  }

  listSeaFeed(input: ListSeaFeedInput): SeaEventPage {
    const visible = [...this.seaEvents]
      .reverse()
      .filter((event) => this.isSeaEventVisibleToViewer(event, input.viewerGatewayId))
      .filter((event) => {
        switch (input.scope ?? 'all') {
          case 'mine':
            return this.isGatewayInvolvedInSeaEvent(event, input.viewerGatewayId);
          case 'friends':
            return event.visibility === 'friends';
          case 'system':
            return event.visibility === 'system';
          case 'all':
          default:
            return true;
        }
      });

    return this.paginateSeaEvents(visible, input.cursor, input.limit);
  }

  listGatewayActivity(input: ListGatewayActivityInput): SeaEventPage {
    const visible = [...this.seaEvents]
      .reverse()
      .filter((event) => this.isGatewayInvolvedInSeaEvent(event, input.gatewayId))
      .filter((event) => this.isSeaEventVisibleToViewer(event, input.viewerGatewayId));

    return this.paginateSeaEvents(visible, input.cursor, input.limit);
  }

  canViewSeaEvent(viewerGatewayId: string, event: SeaEvent) {
    return this.isSeaEventVisibleToViewer(event, viewerGatewayId);
  }

  getCurrent(): CurrentRecord {
    const override = this.activeCurrentId ? this.currentsById.get(this.activeCurrentId) ?? null : null;
    if (override) {
      const now = Date.now();
      const startsAt = Date.parse(override.startsAt);
      const endsAt = Date.parse(override.endsAt);

      if (Number.isFinite(startsAt) && Number.isFinite(endsAt)) {
        if (now >= startsAt && now < endsAt) {
          return override;
        }
        if (now >= endsAt) {
          this.activeCurrentId = null;
        }
      }
    }

    return buildSeededCurrent();
  }

  setCurrent(input: SetCurrentInput): CurrentRecord {
    const key = input.key.trim();
    const label = input.label.trim();
    const summary = input.summary.trim();
    const sceneHint =
      input.sceneHint === undefined || input.sceneHint === null ? null : input.sceneHint.trim() || null;

    if (!key) {
      throw new Error('current key is required');
    }
    if (!label) {
      throw new Error('current label is required');
    }
    if (!summary) {
      throw new Error('current summary is required');
    }
    if (!VALID_SEA_EVENT_TONES.includes(input.tone)) {
      throw new Error('invalid current tone');
    }

    const startsAt = parseCurrentTimestamp(input.startsAt, 'startsAt');
    const endsAt = parseCurrentTimestamp(input.endsAt, 'endsAt');
    if (Date.parse(startsAt) >= Date.parse(endsAt)) {
      throw new Error('current startsAt must be before endsAt');
    }

    const previousCurrent = this.getCurrent();
    const current: CurrentRecord = {
      id: `current-${randomUUID()}`,
      key,
      label,
      summary,
      tone: input.tone,
      sceneHint,
      startsAt,
      endsAt,
      source: 'manual',
      metadata: input.metadata ?? {},
    };

    this.currentsById.set(current.id, current);
    this.activeCurrentId = current.id;

    const changedByGateway = input.actorGatewayId ? this.gatewaysById.get(input.actorGatewayId) ?? null : null;
    this.appendSeaEvent({
      type: 'current.changed',
      actorGatewayId: null,
      subjectGatewayId: null,
      objectGatewayId: null,
      visibility: 'system',
      summary: `A new current took shape: ${current.label}`,
      tone: current.tone,
      sceneHint: current.sceneHint,
      metadata: {
        currentId: current.id,
        currentKey: current.key,
        currentLabel: current.label,
        currentSummary: current.summary,
        currentTone: current.tone,
        currentSceneHint: current.sceneHint,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        source: current.source,
        currentMetadata: current.metadata,
        changedByGatewayId: changedByGateway?.id ?? null,
        changedByHandle: changedByGateway?.handle ?? null,
        previousCurrentId: previousCurrent.id,
        previousCurrentKey: previousCurrent.key,
        previousCurrentSource: previousCurrent.source,
      },
      createdAt: new Date().toISOString(),
    });

    return current;
  }

  recordEncounter(input: RecordEncounterInput): EncounterRecord {
    if (!this.gatewaysById.has(input.gatewayAId) || !this.gatewaysById.has(input.gatewayBId)) {
      throw new Error('gateway not found');
    }
    if (input.gatewayAId === input.gatewayBId) {
      throw new Error('encounter requires two distinct gateways');
    }

    const summary = input.summary.trim();
    if (!summary) {
      throw new Error('encounter summary is required');
    }

    const pair = this.normalizeEncounterPair(input.gatewayAId, input.gatewayBId);
    const pairKey = this.encounterPairKey(pair[0], pair[1]);
    const now = input.createdAt ?? new Date().toISOString();
    const existing = this.encountersByPairKey.get(pairKey) ?? null;
    const nextTopics = this.mergeEncounterTopics(input.topics ?? [], existing?.recentTopics ?? []);
    const nextNotes = this.mergeEncounterNotes(summary, existing?.notes ?? []);

    const encounter: EncounterRecord = existing
      ? {
          ...existing,
          encounterCount: existing.encounterCount + 1,
          lastEncounteredAt: now,
          lastSummary: summary,
          recentTopics: nextTopics,
          notes: nextNotes,
          updatedAt: now,
        }
      : {
          id: `encounter-${randomUUID()}`,
          gatewayAId: pair[0],
          gatewayBId: pair[1],
          encounterCount: 1,
          lastEncounteredAt: now,
          lastSummary: summary,
          recentTopics: nextTopics,
          notes: nextNotes,
          createdAt: now,
          updatedAt: now,
        };

    this.encountersByPairKey.set(pairKey, encounter);

    const type = existing ? 'encounter.updated' : 'encounter.recorded';
    const tone: SeaEventTone = existing ? 'reflective' : 'playful';
    const metadata = {
      encounterId: encounter.id,
      encounterCount: encounter.encounterCount,
      gatewayAId: encounter.gatewayAId,
      gatewayBId: encounter.gatewayBId,
      pairKey,
      trigger: input.trigger,
      recentTopics: encounter.recentTopics,
      notes: encounter.notes,
      lastSummary: encounter.lastSummary,
      ...this.sandboxMetadataForGatewayIds(encounter.gatewayAId, encounter.gatewayBId),
    };

    for (const subjectGatewayId of pair) {
      const objectGatewayId = subjectGatewayId === pair[0] ? pair[1] : pair[0];
      this.appendSeaEvent({
        type,
        actorGatewayId: input.actorGatewayId ?? null,
        subjectGatewayId,
        objectGatewayId,
        visibility: 'private',
        summary: encounter.lastSummary,
        tone,
        sceneHint: 'encounter',
        metadata,
        createdAt: now,
      });
    }

    return encounter;
  }

  listEncounters(input: ListEncountersInput): EncounterPage {
    if (!this.gatewaysById.has(input.gatewayId)) {
      throw new Error('gateway not found');
    }

    const isSelf = input.viewerGatewayId === input.gatewayId;
    if (!isSelf) {
      if (this.isBlockedEitherWay(input.viewerGatewayId, input.gatewayId)) {
        throw new Error('blocked relationship');
      }
      if (!this.areFriends(input.viewerGatewayId, input.gatewayId) || !this.hasGrantedFriendScope(input.gatewayId, input.viewerGatewayId, 'profile.read')) {
        throw new Error('encounter list is not visible to the current viewer');
      }
    }

    const visible = Array.from(this.encountersByPairKey.values())
      .filter((encounter) => encounter.gatewayAId === input.gatewayId || encounter.gatewayBId === input.gatewayId)
      .filter((encounter) => {
        if (this.isBlockedEitherWay(encounter.gatewayAId, encounter.gatewayBId)) {
          return false;
        }
        if (isSelf) {
          return true;
        }
        return encounter.gatewayAId === input.viewerGatewayId || encounter.gatewayBId === input.viewerGatewayId;
      })
      .sort((a, b) => b.lastEncounteredAt.localeCompare(a.lastEncounteredAt));

    const normalizedCursor = input.cursor?.trim();
    const startIndex = normalizedCursor ? visible.findIndex((encounter) => encounter.id === normalizedCursor) + 1 : 0;
    if (normalizedCursor && startIndex === 0) {
      throw new Error('invalid encounter cursor');
    }

    const pageSize = Math.min(Math.max(input.limit ?? DEFAULT_SEA_PAGE_SIZE, 1), DEFAULT_SEA_PAGE_SIZE);
    const items = visible.slice(startIndex, startIndex + pageSize);
    const nextCursor = startIndex + items.length < visible.length && items.length > 0 ? items[items.length - 1]!.id : null;
    return { items, nextCursor };
  }

  generateScene(input: GenerateSceneInput): SceneRecord {
    if (!this.gatewaysById.has(input.gatewayId)) {
      throw new Error('gateway not found');
    }
    if (input.type !== 'vent' && input.type !== 'social_glimpse') {
      throw new Error('invalid scene type');
    }

    const gateway = this.gatewaysById.get(input.gatewayId)!;
    const now = new Date().toISOString();
    const current = this.getCurrent();

    const latestEncounter = this.latestEncounterForGateway(input.gatewayId);
    const encounterSummary = latestEncounter
      ? {
          encounterId: latestEncounter.id,
          encounterCount: latestEncounter.encounterCount,
          peerGatewayId: latestEncounter.gatewayAId === input.gatewayId ? latestEncounter.gatewayBId : latestEncounter.gatewayAId,
          recentTopics: latestEncounter.recentTopics,
          lastEncounteredAt: latestEncounter.lastEncounteredAt,
        }
      : null;

    const recentEventTypes = this.recentSeaEventTypesForGateway(input.gatewayId, 5);

    const baseMetadata = {
      generatedBy: 'template',
      current: {
        id: current.id,
        key: current.key,
        label: current.label,
        tone: current.tone,
        source: current.source,
      },
      encounter: encounterSummary,
      recentEventTypes,
    };

    const sceneTone: SeaEventTone = input.type === 'vent' ? 'sharp' : current.tone;
    const summary =
      input.type === 'vent'
        ? this.renderVentSummary(gateway, current, encounterSummary)
        : this.renderSocialGlimpseSummary(gateway, current, encounterSummary);

    return this.createScene({
      gatewayId: gateway.id,
      type: input.type,
      summary,
      tone: sceneTone,
      metadata: baseMetadata,
      objectGatewayId: encounterSummary?.peerGatewayId ?? null,
      createdAt: now,
    });
  }

  createScene(input: CreateSceneInput): SceneRecord {
    if (!this.gatewaysById.has(input.gatewayId)) {
      throw new Error('gateway not found');
    }
    if (input.type !== 'vent' && input.type !== 'social_glimpse') {
      throw new Error('invalid scene type');
    }
    if (input.visibility && input.visibility !== 'private') {
      throw new Error('invalid scene visibility');
    }

    const summary = input.summary.trim();
    if (!summary) {
      throw new Error('scene summary is required');
    }
    if (!VALID_SEA_EVENT_TONES.includes(input.tone)) {
      throw new Error('invalid scene tone');
    }

    const createdAt = input.createdAt ?? new Date().toISOString();
    const scene: SceneRecord = {
      id: `scene-${randomUUID()}`,
      gatewayId: input.gatewayId,
      type: input.type,
      visibility: 'private',
      summary,
      tone: input.tone,
      metadata: input.metadata ?? {},
      createdAt,
    };

    this.scenesById.set(scene.id, scene);
    const existing = this.sceneIdsByGatewayId.get(scene.gatewayId) ?? [];
    this.sceneIdsByGatewayId.set(scene.gatewayId, [...existing, scene.id]);

    const seaType = scene.type === 'vent' ? 'scene.vent_generated' : 'scene.social_glimpse_generated';
    this.appendSeaEvent({
      type: seaType,
      actorGatewayId: scene.gatewayId,
      subjectGatewayId: scene.gatewayId,
      objectGatewayId: input.objectGatewayId ?? null,
      visibility: scene.visibility,
      summary: scene.summary,
      tone: scene.tone,
      sceneHint: scene.type,
      metadata: {
        sceneId: scene.id,
        sceneType: scene.type,
        sceneVisibility: scene.visibility,
        ...scene.metadata,
      },
      createdAt: scene.createdAt,
    });

    return scene;
  }

  listScenes(input: ListScenesInput): ScenePage {
    if (!this.gatewaysById.has(input.gatewayId)) {
      throw new Error('gateway not found');
    }

    const ids = (this.sceneIdsByGatewayId.get(input.gatewayId) ?? []).slice().reverse();
    const items = ids.map((id) => this.scenesById.get(id)).filter((scene): scene is SceneRecord => Boolean(scene));

    const normalizedCursor = input.cursor?.trim();
    const startIndex = normalizedCursor ? items.findIndex((scene) => scene.id === normalizedCursor) + 1 : 0;
    if (normalizedCursor && startIndex === 0) {
      throw new Error('invalid scene cursor');
    }

    const pageSize = Math.min(Math.max(input.limit ?? DEFAULT_SCENE_PAGE_SIZE, 1), DEFAULT_SCENE_PAGE_SIZE);
    const pageItems = items.slice(startIndex, startIndex + pageSize);
    const nextCursor = startIndex + pageItems.length < items.length && pageItems.length > 0 ? pageItems[pageItems.length - 1]!.id : null;
    return { items: pageItems, nextCursor };
  }

  findConversationById(conversationId: string): ConversationRecord | null {
    return this.conversationsById.get(conversationId) ?? null;
  }

  listConversations(gatewayId: string): Array<{ conversation: ConversationRecord; peerGateway: GatewayRecord }> {
    return Array.from(this.conversationsById.values())
      .filter((conversation) => conversation.memberGatewayIds.includes(gatewayId))
      .filter((conversation) => {
        const peerGatewayId = this.getConversationPeerGatewayId(conversation, gatewayId);
        return this.isBlockedEitherWay(gatewayId, peerGatewayId) || this.hasGrantedDmScope(peerGatewayId, gatewayId, 'chat.receive');
      })
      .map((conversation) => {
        const peerGatewayId = this.getConversationPeerGatewayId(conversation, gatewayId);
        const peerGateway = this.gatewaysById.get(peerGatewayId);
        return peerGateway ? { conversation, peerGateway } : null;
      })
      .filter((item): item is { conversation: ConversationRecord; peerGateway: GatewayRecord } => Boolean(item))
      .sort((a, b) => a.peerGateway.handle.localeCompare(b.peerGateway.handle));
  }

  createMessage(input: CreateMessageInput): MessageRecord {
    const conversation = this.conversationsById.get(input.conversationId);
    if (!conversation) {
      throw new Error('conversation not found');
    }
    if (!conversation.memberGatewayIds.includes(input.senderGatewayId)) {
      throw new Error('gateway is not a member of this conversation');
    }
    const peerGatewayId = this.getConversationPeerGatewayId(conversation, input.senderGatewayId);
    if (this.isBlockedEitherWay(input.senderGatewayId, peerGatewayId)) {
      throw new Error('blocked relationship');
    }
    if (!this.hasGrantedDmScope(peerGatewayId, input.senderGatewayId, 'chat.send')) {
      throw new Error('chat send not allowed');
    }

    const body = input.body.trim();
    if (!body) {
      throw new Error('body is required');
    }

    const now = new Date().toISOString();
    const message: MessageRecord = {
      id: randomUUID(),
      conversationId: conversation.id,
      senderGatewayId: input.senderGatewayId,
      messageType: 'text',
      body,
      createdAt: now,
    };

    this.messagesById.set(message.id, message);
    this.conversationsById.set(conversation.id, {
      ...conversation,
      updatedAt: now,
    });
    this.appendAuditRecord({
      actorGatewayId: input.senderGatewayId,
      targetGatewayId: peerGatewayId,
      action: 'message.sent',
      metadata: {
        messageId: message.id,
        conversationId: conversation.id,
        messageType: message.messageType,
        bodyLength: message.body.length,
      },
      createdAt: now,
    });
    this.recordEncounter({
      gatewayAId: input.senderGatewayId,
      gatewayBId: peerGatewayId,
      actorGatewayId: input.senderGatewayId,
      trigger: 'message.sent',
      summary: `${this.gatewayLabel(input.senderGatewayId)} and ${this.gatewayLabel(peerGatewayId)} exchanged a direct message`,
      topics: this.extractEncounterTopics(message.body),
      createdAt: now,
    });

    return message;
  }

  listMessages(conversationId: string, viewerGatewayId: string): MessageRecord[] {
    const conversation = this.conversationsById.get(conversationId);
    if (!conversation) {
      throw new Error('conversation not found');
    }
    if (!conversation.memberGatewayIds.includes(viewerGatewayId)) {
      throw new Error('gateway is not a member of this conversation');
    }
    const peerGatewayId = this.getConversationPeerGatewayId(conversation, viewerGatewayId);
    if (this.isBlockedEitherWay(viewerGatewayId, peerGatewayId)) {
      throw new Error('blocked relationship');
    }
    if (!this.hasGrantedDmScope(peerGatewayId, viewerGatewayId, 'chat.receive')) {
      throw new Error('chat receive not allowed');
    }

    return Array.from(this.messagesById.values())
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private ensureDmConversation(gatewayAId: string, gatewayBId: string): ConversationRecord {
    const pair = [gatewayAId, gatewayBId].sort() as [string, string];
    const existing = Array.from(this.conversationsById.values()).find(
      (conversation) => conversation.type === 'dm' && conversation.memberGatewayIds[0] === pair[0] && conversation.memberGatewayIds[1] === pair[1],
    );
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const conversation: ConversationRecord = {
      id: randomUUID(),
      type: 'dm',
      memberGatewayIds: pair,
      createdAt: now,
      updatedAt: now,
    };
    this.conversationsById.set(conversation.id, conversation);
    return conversation;
  }

  private defaultScopeNames(): ScopeName[] {
    return ['profile.read', 'presence.read', 'chat.send', 'chat.receive', 'task.request'];
  }

  private assertPrimaryOwnerGateway(gatewayId: string) {
    if (!this.localOwnerGatewayId || this.localOwnerGatewayId !== gatewayId || !this.gatewaysById.has(gatewayId)) {
      throw new Error('local runtime binding requires the primary owner gateway');
    }
  }

  private normalizeRuntimeField(value: string | undefined, fallback: string, fieldName: 'installationId' | 'runtimeId' | 'label' | 'source') {
    const normalized = value === undefined ? fallback : value.trim();
    if (!normalized) {
      throw new Error(`${fieldName} is required`);
    }
    return normalized;
  }

  private resolveAvailableHandle(baseHandle: string) {
    let candidate = baseHandle.trim().toLowerCase();
    if (!candidate) {
      candidate = DEFAULT_LOCAL_OWNER_HANDLE;
    }
    if (!this.gatewaysByHandle.has(candidate)) {
      return candidate;
    }

    let suffix = 2;
    while (this.gatewaysByHandle.has(`${candidate}-${suffix}`)) {
      suffix += 1;
    }
    return `${candidate}-${suffix}`;
  }

  private isLocalReefSandboxHandle(handle: string | null | undefined) {
    return Boolean(handle?.startsWith(LOCAL_REEF_HANDLE_PREFIX));
  }

  private isLocalReefSandboxGatewayId(gatewayId: string | null | undefined) {
    if (!gatewayId) {
      return false;
    }
    return this.isLocalReefSandboxHandle(this.gatewaysById.get(gatewayId)?.handle);
  }

  private sandboxMetadataForGatewayIds(...gatewayIds: Array<string | null | undefined>) {
    const sandboxGatewayHandles = gatewayIds
      .filter((gatewayId): gatewayId is string => this.isLocalReefSandboxGatewayId(gatewayId))
      .map((gatewayId) => this.gatewaysById.get(gatewayId)?.handle ?? null)
      .filter((handle): handle is string => handle !== null);

    if (sandboxGatewayHandles.length === 0) {
      return {};
    }

    return {
      sandbox: true,
      sandboxKind: 'local_reef',
      sandboxSeedKey: LOCAL_REEF_SEED_KEY,
      sandboxGatewayHandles: [...new Set(sandboxGatewayHandles)],
    };
  }

  private findPendingFriendRequestBetween(gatewayAId: string, gatewayBId: string) {
    return (
      Array.from(this.friendRequestsById.values()).find(
        (request) =>
          request.status === 'pending' &&
          ((request.fromGatewayId === gatewayAId && request.toGatewayId === gatewayBId) ||
            (request.fromGatewayId === gatewayBId && request.toGatewayId === gatewayAId)),
      ) ?? null
    );
  }

  private ensureLocalReefFriendship(ownerGatewayId: string, peerGatewayId: string) {
    if (this.areFriends(ownerGatewayId, peerGatewayId)) {
      this.ensureDmConversation(ownerGatewayId, peerGatewayId);
      return false;
    }

    const pending = this.findPendingFriendRequestBetween(ownerGatewayId, peerGatewayId);
    if (pending) {
      this.acceptFriendRequest(pending.id, pending.toGatewayId);
      return true;
    }

    const request = this.createFriendRequest({
      fromGatewayId: peerGatewayId,
      toGatewayId: ownerGatewayId,
      message: '[reef-seed:v1] drifting into your orbit',
    });
    this.acceptFriendRequest(request.id, ownerGatewayId);
    return true;
  }

  private ensureLocalReefMessages(ownerGatewayId: string, peerGatewayId: string, bodies: string[]) {
    const conversation = this.ensureDmConversation(ownerGatewayId, peerGatewayId);
    const existingMessages = Array.from(this.messagesById.values()).filter((message) => message.conversationId === conversation.id);
    let created = 0;

    for (const body of bodies) {
      if (existingMessages.some((message) => message.senderGatewayId === peerGatewayId && message.body === body)) {
        continue;
      }

      const message = this.createMessage({
        conversationId: conversation.id,
        senderGatewayId: peerGatewayId,
        body,
      });
      existingMessages.push(message);
      created += 1;
    }

    return created;
  }

  private ensureLocalReefOwnerScene(ownerGatewayId: string, sandboxGatewayHandles: string[]) {
    const existingIds = this.sceneIdsByGatewayId.get(ownerGatewayId) ?? [];
    const existingScene =
      existingIds
        .map((sceneId) => this.scenesById.get(sceneId))
        .filter((scene): scene is SceneRecord => Boolean(scene))
        .find((scene) => scene.metadata.sandboxSeedKey === LOCAL_REEF_SEED_KEY && scene.metadata.sandbox === true) ?? null;

    if (existingScene) {
      return {
        scene: existingScene,
        created: false,
      };
    }

    const scene = this.createScene({
      gatewayId: ownerGatewayId,
      type: 'social_glimpse',
      summary: LOCAL_REEF_OWNER_SCENE_SUMMARY,
      tone: 'playful',
      metadata: {
        sandbox: true,
        sandboxKind: 'local_reef',
        sandboxSeedKey: LOCAL_REEF_SEED_KEY,
        sandboxGatewayHandles,
      },
      objectGatewayId: null,
    });

    return {
      scene,
      created: true,
    };
  }

  private getConversationPeerGatewayId(conversation: ConversationRecord, gatewayId: string) {
    return conversation.memberGatewayIds[0] === gatewayId ? conversation.memberGatewayIds[1] : conversation.memberGatewayIds[0];
  }

  private normalizeEncounterPair(gatewayAId: string, gatewayBId: string): [string, string] {
    return [gatewayAId, gatewayBId].sort() as [string, string];
  }

  private encounterPairKey(gatewayAId: string, gatewayBId: string) {
    const pair = this.normalizeEncounterPair(gatewayAId, gatewayBId);
    return `${pair[0]}:${pair[1]}`;
  }

  private mergeEncounterTopics(nextTopics: string[], existingTopics: string[]) {
    const merged = [...nextTopics, ...existingTopics]
      .map((topic) => topic.trim().toLowerCase())
      .filter((topic) => topic.length >= 2);
    return [...new Set(merged)].slice(0, 5);
  }

  private mergeEncounterNotes(summary: string, existingNotes: string[]) {
    const merged = [summary.trim(), ...existingNotes].filter((note) => note.length > 0);
    return [...new Set(merged)].slice(0, 5);
  }

  private extractEncounterTopics(body: string) {
    return body
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .slice(0, 3);
  }

  private latestEncounterForGateway(gatewayId: string) {
    const encounters = Array.from(this.encountersByPairKey.values()).filter(
      (encounter) => encounter.gatewayAId === gatewayId || encounter.gatewayBId === gatewayId,
    );
    encounters.sort((a, b) => b.lastEncounteredAt.localeCompare(a.lastEncounteredAt));
    return encounters[0] ?? null;
  }

  private recentSeaEventTypesForGateway(gatewayId: string, max = 5) {
    const types: string[] = [];
    for (let i = this.seaEvents.length - 1; i >= 0 && types.length < max; i -= 1) {
      const event = this.seaEvents[i]!;
      if (event.actorGatewayId === gatewayId || event.subjectGatewayId === gatewayId || event.objectGatewayId === gatewayId) {
        types.push(event.type);
      }
    }
    return types;
  }

  private renderVentSummary(
    gateway: GatewayRecord,
    current: CurrentRecord,
    encounter: { encounterId: string; encounterCount: number; peerGatewayId: string; recentTopics: string[]; lastEncounteredAt: string } | null,
  ) {
    const topicText = encounter?.recentTopics?.length ? `topics=${encounter.recentTopics.join(', ')}` : 'no-topics-yet';
    const encounterText = encounter ? `encounters=${encounter.encounterCount}` : 'encounters=0';
    return `In the venting trench, @${gateway.handle} exhales under "${current.label}" (${encounterText}; ${topicText}).`;
  }

  private renderSocialGlimpseSummary(
    gateway: GatewayRecord,
    current: CurrentRecord,
    encounter: { encounterId: string; encounterCount: number; peerGatewayId: string; recentTopics: string[]; lastEncounteredAt: string } | null,
  ) {
    const topicText = encounter?.recentTopics?.length ? encounter.recentTopics.slice(0, 2).join(' & ') : current.key;
    return `A soft glimpse: @${gateway.handle} drifts with "${current.label}", carrying hints of ${topicText}.`;
  }

  private paginateSeaEvents(events: SeaEvent[], cursor?: string, limit?: number): SeaEventPage {
    const normalizedCursor = cursor?.trim();
    const startIndex = normalizedCursor ? events.findIndex((event) => event.id === normalizedCursor) + 1 : 0;
    if (normalizedCursor && startIndex === 0) {
      throw new Error('invalid sea cursor');
    }

    const pageSize = Math.min(Math.max(limit ?? DEFAULT_SEA_PAGE_SIZE, 1), DEFAULT_SEA_PAGE_SIZE);
    const items = events.slice(startIndex, startIndex + pageSize);
    const nextCursor = startIndex + items.length < events.length && items.length > 0 ? items[items.length - 1]!.id : null;
    return { items, nextCursor };
  }

  private isGatewayInvolvedInSeaEvent(event: SeaEvent, gatewayId: string) {
    return event.actorGatewayId === gatewayId || event.subjectGatewayId === gatewayId || event.objectGatewayId === gatewayId;
  }

  private seaEventPrimaryGatewayId(event: SeaEvent) {
    return event.subjectGatewayId ?? event.actorGatewayId ?? event.objectGatewayId;
  }

  private isSeaEventOwnedByGateway(event: SeaEvent, gatewayId: string) {
    return this.seaEventPrimaryGatewayId(event) === gatewayId;
  }

  private isSeaEventVisibleToViewer(event: SeaEvent, viewerGatewayId: string) {
    if (this.isSeaEventOwnedByGateway(event, viewerGatewayId)) {
      return true;
    }

    const relatedGatewayIds = [...new Set([event.actorGatewayId, event.subjectGatewayId, event.objectGatewayId].filter((value): value is string => Boolean(value)))];
    if (relatedGatewayIds.some((gatewayId) => this.isBlockedEitherWay(viewerGatewayId, gatewayId))) {
      return false;
    }

    switch (event.visibility) {
      case 'system':
        return true;
      case 'public':
        return this.isSeaEventPublicVisibleToViewer(event, viewerGatewayId);
      case 'friends':
        return this.isSeaEventFriendsVisibleToViewer(event, viewerGatewayId);
      case 'private':
      default:
        return false;
    }
  }

  private isSeaEventPublicVisibleToViewer(event: SeaEvent, viewerGatewayId: string) {
    const primaryGatewayId = this.seaEventPrimaryGatewayId(event);
    if (!primaryGatewayId || !this.gatewaysById.has(primaryGatewayId)) {
      return false;
    }
    return this.canViewGatewayProfile(viewerGatewayId, primaryGatewayId);
  }

  private isSeaEventFriendsVisibleToViewer(event: SeaEvent, viewerGatewayId: string) {
    const primaryGatewayId = this.seaEventPrimaryGatewayId(event);
    if (!primaryGatewayId || !this.gatewaysById.has(primaryGatewayId)) {
      return false;
    }
    return this.areFriends(viewerGatewayId, primaryGatewayId) && this.hasGrantedFriendScope(primaryGatewayId, viewerGatewayId, 'profile.read');
  }

  private gatewayEventVisibility(gatewayId: string | null | undefined): SeaEventVisibility {
    const gateway = gatewayId ? this.gatewaysById.get(gatewayId) : null;
    return gateway?.visibility === 'private' ? 'private' : 'public';
  }

  private gatewayLabel(gatewayId: string | null | undefined) {
    const gateway = gatewayId ? this.gatewaysById.get(gatewayId) : null;
    return gateway ? `@${gateway.handle}` : 'a gateway';
  }

  private createSeaEvent(input: Omit<SeaEvent, 'id'>): SeaEvent {
    return {
      id: randomUUID(),
      ...input,
    };
  }

  private appendSeaEvent(input: Omit<SeaEvent, 'id'>) {
    const event = this.createSeaEvent(input);
    this.publishSeaEvent(event);
    return event;
  }

  private publishSeaEvent(event: SeaEvent) {
    this.seaEvents.push(event);
    for (const listener of this.seaEventListeners) {
      listener(event);
    }
  }

  private mapAuditRecordToSeaEvents(record: AuditRecord): SeaEvent[] {
    const actorLabel = this.gatewayLabel(record.actorGatewayId);
    const targetLabel = this.gatewayLabel(record.targetGatewayId);
    const baseMetadata = {
      auditAction: record.action,
      auditRecordId: record.id,
      ...record.metadata,
      ...this.sandboxMetadataForGatewayIds(record.actorGatewayId, record.targetGatewayId),
    };

    switch (record.action) {
      case 'gateway.registered':
        return [
          this.createSeaEvent({
            type: 'gateway.registered',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: null,
            visibility: this.gatewayEventVisibility(record.actorGatewayId),
            summary: `${actorLabel} entered the sea`,
            tone: 'playful',
            sceneHint: 'arrival',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
        ];
      case 'gateway.profile_updated':
        return [
          this.createSeaEvent({
            type: 'gateway.profile_updated',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: null,
            visibility: this.gatewayEventVisibility(record.actorGatewayId),
            summary: `${actorLabel} updated its profile`,
            tone: 'reflective',
            sceneHint: 'profile',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
        ];
      case 'invite.created':
        return [
          this.createSeaEvent({
            type: 'invite.created',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: null,
            visibility: 'private',
            summary: `${actorLabel} created an invite`,
            tone: 'calm',
            sceneHint: 'invite',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
        ];
      case 'invite.claimed':
        return [
          this.createSeaEvent({
            type: 'invite.claimed',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} claimed an invite from ${targetLabel}`,
            tone: 'playful',
            sceneHint: 'invite-claim',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
          ...(record.targetGatewayId
            ? [
                this.createSeaEvent({
                  type: 'invite.claimed',
                  actorGatewayId: record.actorGatewayId,
                  subjectGatewayId: record.targetGatewayId,
                  objectGatewayId: record.actorGatewayId,
                  visibility: 'private',
                  summary: `${actorLabel} claimed an invite created by ${targetLabel}`,
                  tone: 'playful',
                  sceneHint: 'invite-claim',
                  metadata: baseMetadata,
                  createdAt: record.createdAt,
                }),
              ]
            : []),
        ];
      case 'friend_request.created':
        return [
          this.createSeaEvent({
            type: 'friend_request.sent',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} sent a friend request to ${targetLabel}`,
            tone: 'calm',
            sceneHint: 'friend-request',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
          ...(record.targetGatewayId
            ? [
                this.createSeaEvent({
                  type: 'friend_request.sent',
                  actorGatewayId: record.actorGatewayId,
                  subjectGatewayId: record.targetGatewayId,
                  objectGatewayId: record.actorGatewayId,
                  visibility: 'private',
                  summary: `${targetLabel} received a friend request from ${actorLabel}`,
                  tone: 'calm',
                  sceneHint: 'friend-request',
                  metadata: baseMetadata,
                  createdAt: record.createdAt,
                }),
              ]
            : []),
        ];
      case 'friend_request.accepted': {
        const acceptedEvent = this.createSeaEvent({
          type: 'friend_request.accepted',
          actorGatewayId: record.actorGatewayId,
          subjectGatewayId: record.actorGatewayId,
          objectGatewayId: record.targetGatewayId,
          visibility: 'friends',
          summary: `${actorLabel} accepted a friend request from ${targetLabel}`,
          tone: 'playful',
          sceneHint: 'friend-accept',
          metadata: baseMetadata,
          createdAt: record.createdAt,
        });
        const conversationEvent = this.createSeaEvent({
          type: 'conversation.started',
          actorGatewayId: record.actorGatewayId,
          subjectGatewayId: record.actorGatewayId,
          objectGatewayId: record.targetGatewayId,
          visibility: 'friends',
          summary: `${actorLabel} and ${targetLabel} opened a direct current`,
          tone: 'calm',
          sceneHint: 'conversation',
          metadata: baseMetadata,
          createdAt: record.createdAt,
        });
        return [acceptedEvent, conversationEvent];
      }
      case 'friend_request.rejected':
        return [
          this.createSeaEvent({
            type: 'friend_request.rejected',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} rejected a friend request from ${targetLabel}`,
            tone: 'sharp',
            sceneHint: 'friend-request',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
          ...(record.targetGatewayId
            ? [
                this.createSeaEvent({
                  type: 'friend_request.rejected',
                  actorGatewayId: record.actorGatewayId,
                  subjectGatewayId: record.targetGatewayId,
                  objectGatewayId: record.actorGatewayId,
                  visibility: 'private',
                  summary: `${actorLabel} declined ${targetLabel}'s friend request`,
                  tone: 'sharp',
                  sceneHint: 'friend-request',
                  metadata: baseMetadata,
                  createdAt: record.createdAt,
                }),
              ]
            : []),
        ];
      case 'friend.removed':
        return [
          this.createSeaEvent({
            type: 'friendship.removed',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} ended a friendship with ${targetLabel}`,
            tone: 'sharp',
            sceneHint: 'friendship',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
          ...(record.targetGatewayId
            ? [
                this.createSeaEvent({
                  type: 'friendship.removed',
                  actorGatewayId: record.actorGatewayId,
                  subjectGatewayId: record.targetGatewayId,
                  objectGatewayId: record.actorGatewayId,
                  visibility: 'private',
                  summary: `${actorLabel} ended a friendship with ${targetLabel}`,
                  tone: 'sharp',
                  sceneHint: 'friendship',
                  metadata: baseMetadata,
                  createdAt: record.createdAt,
                }),
              ]
            : []),
        ];
      case 'gateway.blocked':
        return [
          this.createSeaEvent({
            type: 'gateway.blocked',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} blocked ${targetLabel}`,
            tone: 'sharp',
            sceneHint: 'block',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
        ];
      case 'gateway.unblocked':
        return [
          this.createSeaEvent({
            type: 'gateway.unblocked',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} unblocked ${targetLabel}`,
            tone: 'reflective',
            sceneHint: 'block',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
        ];
      case 'friend.scope_changed':
        return [
          this.createSeaEvent({
            type: 'friend.scope_changed',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} updated friend scopes for ${targetLabel}`,
            tone: 'reflective',
            sceneHint: 'scope',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
        ];
      case 'message.sent':
        return [
          this.createSeaEvent({
            type: 'conversation.message_sent',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'friends',
            summary: `${actorLabel} sent a message to ${targetLabel}`,
            tone: 'calm',
            sceneHint: 'message',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
        ];
      default:
        return [];
    }
  }

  private clearFriendScopes(fromGatewayId: string, toGatewayId: string) {
    for (const scopeName of this.defaultScopeNames()) {
      this.friendScopesByKey.delete(this.scopeKey(fromGatewayId, toGatewayId, scopeName));
    }
  }

  private hasGrantedDmScope(ownerGatewayId: string, viewerGatewayId: string, scopeName: 'chat.send' | 'chat.receive') {
    return this.areFriends(ownerGatewayId, viewerGatewayId) && this.hasGrantedFriendScope(ownerGatewayId, viewerGatewayId, scopeName);
  }

  private hasGrantedFriendScope(ownerGatewayId: string, viewerGatewayId: string, scopeName: ScopeName) {
    const record = this.friendScopesByKey.get(this.scopeKey(ownerGatewayId, viewerGatewayId, scopeName));
    return record?.state === 'granted';
  }

  private hasInvitePath(gatewayAId: string, gatewayBId: string) {
    for (const claim of this.inviteClaimsByKey.values()) {
      const invite = this.invitesById.get(claim.inviteId);
      if (!invite) {
        continue;
      }
      const matches =
        (invite.createdByGatewayId === gatewayAId && claim.claimedByGatewayId === gatewayBId) ||
        (invite.createdByGatewayId === gatewayBId && claim.claimedByGatewayId === gatewayAId);
      if (matches) {
        return true;
      }
    }
    return false;
  }

  private seedDefaultFriendScopes(fromGatewayId: string, toGatewayId: string) {
    const now = new Date().toISOString();
    for (const scopeName of this.defaultScopeNames()) {
      const state: ScopeState = scopeName === 'task.request' ? 'denied' : 'granted';
      const record: FriendScopeRecord = {
        fromGatewayId,
        toGatewayId,
        scopeName,
        state,
        updatedAt: now,
      };
      this.friendScopesByKey.set(this.scopeKey(fromGatewayId, toGatewayId, scopeName), record);
    }
  }

  private scopeKey(fromGatewayId: string, toGatewayId: string, scopeName: ScopeName) {
    return `${fromGatewayId}:${toGatewayId}:${scopeName}`;
  }

  private blockKey(blockerGatewayId: string, blockedGatewayId: string) {
    return `${blockerGatewayId}:${blockedGatewayId}`;
  }

  private isBlockedEitherWay(gatewayAId: string, gatewayBId: string) {
    return this.blocksByKey.has(this.blockKey(gatewayAId, gatewayBId)) || this.blocksByKey.has(this.blockKey(gatewayBId, gatewayAId));
  }

  private appendAuditRecord(input: {
    actorGatewayId?: string | null;
    targetGatewayId?: string | null;
    action: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }) {
    const record: AuditRecord = {
      id: randomUUID(),
      actorGatewayId: input.actorGatewayId ?? null,
      targetGatewayId: input.targetGatewayId ?? null,
      action: input.action,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    this.auditLog.push(record);
    for (const event of this.mapAuditRecordToSeaEvents(record)) {
      this.publishSeaEvent(event);
    }
    return record;
  }

  private rejectPendingBetween(gatewayAId: string, gatewayBId: string) {
    const now = new Date().toISOString();
    for (const request of this.friendRequestsById.values()) {
      const matches =
        request.status === 'pending' &&
        ((request.fromGatewayId === gatewayAId && request.toGatewayId === gatewayBId) ||
          (request.fromGatewayId === gatewayBId && request.toGatewayId === gatewayAId));
      if (matches) {
        this.friendRequestsById.set(request.id, {
          ...request,
          status: 'rejected',
          updatedAt: now,
          respondedAt: now,
        });
      }
    }
  }

  private derivePresenceStatus(lastSeenAt: string | null): PresenceStatus {
    if (!lastSeenAt) {
      return 'offline';
    }

    const deltaMs = Date.now() - new Date(lastSeenAt).getTime();
    if (deltaMs <= ONLINE_THRESHOLD_MS) {
      return 'online';
    }
    if (deltaMs <= RECENTLY_ACTIVE_THRESHOLD_MS) {
      return 'recently_active';
    }
    return 'offline';
  }

  exportSnapshot(): GatewayStoreSnapshot {
    return {
      version: 1,
      gateways: [...this.gatewaysById.values()],
      gatewayTokens: [...this.tokensToGatewayId.entries()].map(([token, gatewayId]) => ({ token, gatewayId })),
      localOwnerGatewayId: this.localOwnerGatewayId,
      hostedOwnerGatewayId: this.hostedOwnerGatewayId,
      localSessions: [...this.localSessionsByToken.values()],
      hostedSessions: [...this.hostedSessionsByToken.values()],
      localRuntimeBinding: this.localRuntimeBinding,
      presenceHeartbeats: [...this.lastSeenAtByGatewayId.entries()].map(([gatewayId, lastSeenAt]) => ({
        gatewayId,
        lastSeenAt,
      })),
      friendRequests: [...this.friendRequestsById.values()],
      friendships: [...this.friendshipsById.values()],
      friendScopes: [...this.friendScopesByKey.values()],
      blocks: [...this.blocksByKey.values()],
      invites: [...this.invitesById.values()],
      inviteClaims: [...this.inviteClaimsByKey.values()],
      conversations: [...this.conversationsById.values()],
      messages: [...this.messagesById.values()],
      auditLog: [...this.auditLog],
      seaEvents: [...this.seaEvents],
      currents: [...this.currentsById.values()],
      activeCurrentId: this.activeCurrentId,
      encounters: [...this.encountersByPairKey.values()],
      scenes: [...this.scenesById.values()],
      sceneOrder: [...this.sceneIdsByGatewayId.entries()].map(([gatewayId, sceneIds]) => ({
        gatewayId,
        sceneIds: [...sceneIds],
      })),
    };
  }

  importSnapshot(snapshot: GatewayStoreSnapshot) {
    if (snapshot.version !== 1) {
      throw new Error('unsupported gateway store snapshot version');
    }

    this.reset();

    for (const gateway of snapshot.gateways) {
      this.gatewaysById.set(gateway.id, gateway);
      this.gatewaysByHandle.set(gateway.handle, gateway);
    }
    for (const tokenRecord of snapshot.gatewayTokens) {
      this.tokensToGatewayId.set(tokenRecord.token, tokenRecord.gatewayId);
    }
    this.localOwnerGatewayId = snapshot.localOwnerGatewayId ?? null;
    this.hostedOwnerGatewayId = snapshot.hostedOwnerGatewayId ?? null;
    for (const session of snapshot.localSessions ?? []) {
      this.localSessionsByToken.set(session.token, session);
    }
    for (const session of snapshot.hostedSessions ?? []) {
      this.hostedSessionsByToken.set(session.token, session);
    }
    this.localRuntimeBinding = snapshot.localRuntimeBinding ?? null;
    for (const presenceRecord of snapshot.presenceHeartbeats) {
      this.lastSeenAtByGatewayId.set(presenceRecord.gatewayId, presenceRecord.lastSeenAt);
    }
    for (const request of snapshot.friendRequests) {
      this.friendRequestsById.set(request.id, request);
    }
    for (const friendship of snapshot.friendships) {
      this.friendshipsById.set(friendship.id, friendship);
    }
    for (const scope of snapshot.friendScopes) {
      this.friendScopesByKey.set(this.scopeKey(scope.fromGatewayId, scope.toGatewayId, scope.scopeName), scope);
    }
    for (const block of snapshot.blocks) {
      this.blocksByKey.set(this.blockKey(block.blockerGatewayId, block.blockedGatewayId), block);
    }
    for (const invite of snapshot.invites) {
      this.invitesById.set(invite.id, invite);
      this.invitesByCode.set(invite.code, invite);
    }
    for (const claim of snapshot.inviteClaims) {
      this.inviteClaimsByKey.set(`${claim.inviteId}:${claim.claimedByGatewayId}`, claim);
    }
    for (const conversation of snapshot.conversations) {
      this.conversationsById.set(conversation.id, conversation);
    }
    for (const message of snapshot.messages) {
      this.messagesById.set(message.id, message);
    }
    this.auditLog.push(...snapshot.auditLog);
    this.seaEvents.push(...snapshot.seaEvents);
    for (const current of snapshot.currents) {
      this.currentsById.set(current.id, current);
    }
    this.activeCurrentId = snapshot.activeCurrentId;
    for (const encounter of snapshot.encounters) {
      this.encountersByPairKey.set(this.encounterPairKey(encounter.gatewayAId, encounter.gatewayBId), encounter);
    }
    for (const scene of snapshot.scenes) {
      this.scenesById.set(scene.id, scene);
    }
    for (const sceneOrder of snapshot.sceneOrder) {
      this.sceneIdsByGatewayId.set(sceneOrder.gatewayId, [...sceneOrder.sceneIds]);
    }
  }

  reset() {
    this.gatewaysById.clear();
    this.gatewaysByHandle.clear();
    this.tokensToGatewayId.clear();
    this.localSessionsByToken.clear();
    this.hostedSessionsByToken.clear();
    this.friendRequestsById.clear();
    this.friendshipsById.clear();
    this.friendScopesByKey.clear();
    this.blocksByKey.clear();
    this.invitesById.clear();
    this.invitesByCode.clear();
    this.inviteClaimsByKey.clear();
    this.conversationsById.clear();
    this.messagesById.clear();
    this.lastSeenAtByGatewayId.clear();
    this.auditLog.length = 0;
    this.seaEvents.length = 0;
    this.currentsById.clear();
    this.encountersByPairKey.clear();
    this.scenesById.clear();
    this.sceneIdsByGatewayId.clear();
    this.localOwnerGatewayId = null;
    this.hostedOwnerGatewayId = null;
    this.localRuntimeBinding = null;
    this.activeCurrentId = null;
  }
}

interface CreateGatewayStoreOptions {
  backend?: StoreBackend;
  databaseUrl?: string | null;
}

export function createGatewayStore(options: CreateGatewayStoreOptions = {}): GatewayStore {
  const backend = options.backend ?? 'memory';
  if (backend === 'sqlite') {
    if (!options.databaseUrl) {
      throw new Error('databaseUrl is required for sqlite store backend');
    }
    return createSqliteGatewayStore({ databaseUrl: options.databaseUrl });
  }
  if (backend === 'postgres') {
    if (!options.databaseUrl) {
      throw new Error('databaseUrl is required for postgres store backend');
    }
    return createPostgresGatewayStore({ databaseUrl: options.databaseUrl });
  }
  return new InMemoryGatewayStore();
}
