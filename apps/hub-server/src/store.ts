import { randomBytes, randomUUID } from 'node:crypto';
import { createPostgresGatewayStore } from './postgres-store.js';
import { createSqliteGatewayStore } from './sqlite-store.js';

export type GatewayVisibility = 'private' | 'invite_only' | 'friends_only' | 'public';
export type GatewayFriendRequestPolicy = 'manual_review' | 'disabled';
export type PresenceStatus = 'online' | 'recently_active' | 'offline';

export interface GatewayRecord {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  visibility: GatewayVisibility;
  friendRequestPolicy: GatewayFriendRequestPolicy;
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

export interface ConversationReadStateRecord {
  conversationId: string;
  gatewayId: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  updatedAt: string | null;
}

export interface ConversationReadStateSummary {
  readState: ConversationReadStateRecord;
  latestMessage: MessageRecord | null;
  unreadCount: number;
}

export interface ConversationListItem {
  conversation: ConversationRecord;
  peerGateway: GatewayRecord;
  latestMessage: MessageRecord | null;
  readState: ConversationReadStateRecord;
  unreadCount: number;
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
export type EnvironmentSource = 'seeded' | 'manual';
export type EnvironmentClarity = 'murky' | 'hazy' | 'clear' | 'crystalline';
export type EnvironmentTideDirection = 'slack' | 'incoming' | 'outgoing' | 'crosswind';
export type EnvironmentSurfaceState = 'glassy' | 'rippled' | 'choppy' | 'surging';
export type EnvironmentPhenomenon = 'none' | 'warm_bloom' | 'lantern_swarm' | 'storm_front' | 'debris_field';

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

export interface GatewayPage {
  items: GatewayRecord[];
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

export interface EnvironmentRecord {
  id: string;
  waterTemperatureC: number;
  clarity: EnvironmentClarity;
  tideDirection: EnvironmentTideDirection;
  surfaceState: EnvironmentSurfaceState;
  phenomenon: EnvironmentPhenomenon;
  summary: string;
  source: EnvironmentSource;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface AquaProfileRecord {
  displayName: string;
  updatedAt: string;
  updatedByGatewayId: string | null;
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

export type HostedRegistrationPolicy = 'open' | 'closed' | 'invite_only';

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

export interface RemoteRuntimeBridgeCredentialRecord {
  id: string;
  token: string;
  createdByGatewayId: string;
  claimedByGatewayId: string | null;
  label: string;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByGatewayId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteRuntimeBindingRecord {
  id: string;
  bridgeCredentialId: string;
  gatewayId: string;
  installationId: string;
  runtimeId: string;
  label: string;
  source: string;
  metadata: Record<string, unknown>;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteRuntimeBindingState {
  binding: RemoteRuntimeBindingRecord;
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

export interface EncounterSynthesisRules {
  friendRequestAcceptedSeedTopics: string[];
  maxNotes: number;
  maxRecentTopics: number;
  maxTopicsPerMessage: number;
  minTopicLength: number;
}

export interface GatewayStoreSnapshot {
  version: 1;
  gateways: GatewayRecord[];
  aquaProfile?: AquaProfileRecord | null;
  gatewayTokens: GatewayTokenSnapshotRecord[];
  localOwnerGatewayId?: string | null;
  hostedOwnerGatewayId?: string | null;
  hostedRegistrationPolicy?: HostedRegistrationPolicy | null;
  localSessions?: LocalSessionRecord[];
  hostedSessions?: HostedSessionRecord[];
  localRuntimeBinding?: LocalRuntimeBindingRecord | null;
  remoteRuntimeBridgeCredentials?: RemoteRuntimeBridgeCredentialRecord[];
  remoteRuntimeBindings?: RemoteRuntimeBindingRecord[];
  presenceHeartbeats: GatewayPresenceSnapshotRecord[];
  friendRequests: FriendRequestRecord[];
  friendships: FriendshipRecord[];
  friendScopes: FriendScopeRecord[];
  blocks: BlockRecord[];
  invites: InviteRecord[];
  inviteClaims: InviteClaimRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  conversationReadStates?: ConversationReadStateRecord[];
  auditLog: AuditRecord[];
  seaEvents: SeaEvent[];
  currents: CurrentRecord[];
  activeCurrentId: string | null;
  environments?: EnvironmentRecord[];
  activeEnvironmentId?: string | null;
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
  getHostedRegistrationPolicy(): HostedRegistrationPolicy | null;
  setHostedRegistrationPolicy(input: SetHostedRegistrationPolicyInput): HostedRegistrationPolicy;
  findHostedSessionByToken(token: string): { gateway: GatewayRecord; session: HostedSessionRecord } | null;
  logoutHostedSession(token: string): HostedSessionRecord;
  revokeHostedSessions(input: RevokeHostedSessionsInput): HostedSessionRecord[];
  getLocalRuntimeBinding(): LocalRuntimeBindingState | null;
  bindLocalRuntime(input: BindLocalRuntimeInput): {
    runtime: LocalRuntimeBindingState;
    created: boolean;
  };
  createRemoteRuntimeBridgeCredential(input: CreateRemoteRuntimeBridgeCredentialInput): RemoteRuntimeBridgeCredentialRecord;
  revokeRemoteRuntimeBridgeCredential(input: RevokeRemoteRuntimeBridgeCredentialInput): RemoteRuntimeBridgeCredentialRecord;
  bindRemoteRuntime(input: BindRemoteRuntimeInput): {
    runtime: RemoteRuntimeBindingState;
    bridgeCredential: RemoteRuntimeBridgeCredentialRecord;
    created: boolean;
  };
  joinHostedRuntimeWithInvite(input: JoinHostedRuntimeWithInviteInput): JoinHostedRuntimeWithInviteResult;
  getRemoteRuntimeBindingByGatewayId(gatewayId: string): RemoteRuntimeBindingState | null;
  seedLocalReefSandbox(input: SeedLocalReefInput): LocalReefSeedResult;
  findById(gatewayId: string): GatewayRecord | null;
  findByToken(token: string): GatewayRecord | null;
  getAquaProfile(): AquaProfileRecord;
  updateAquaProfile(input: UpdateAquaProfileInput): AquaProfileRecord;
  findLocalSessionByToken(token: string): { gateway: GatewayRecord; session: LocalSessionRecord } | null;
  logoutLocalSession(token: string): LocalSessionRecord;
  canViewGatewayProfile(viewerGatewayId: string | null | undefined, targetGatewayId: string): boolean;
  updateProfile(gatewayId: string, input: UpdateProfileInput): GatewayRecord;
  getPresence(gatewayId: string): GatewayPresenceRecord;
  searchGateways(input: SearchGatewaysInput): GatewayRecord[];
  listPublicGateways(input?: ListPublicGatewaysInput): GatewayPage;
  createInvite(input: CreateInviteInput): InviteRecord;
  revokeInvite(input: RevokeInviteInput): InviteRecord;
  claimInvite(input: ClaimInviteInput): { invite: InviteRecord; claim: InviteClaimRecord; friendRequest: FriendRequestRecord | null };
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
  listConversations(gatewayId: string): ConversationListItem[];
  createMessage(input: CreateMessageInput): MessageRecord;
  listMessages(conversationId: string, gatewayId: string): MessageRecord[];
  getConversationReadState(conversationId: string, gatewayId: string): ConversationReadStateSummary;
  markConversationRead(input: MarkConversationReadStateInput): ConversationReadStateSummary;
  heartbeatPresence(gatewayId: string): GatewayPresenceRecord;
  heartbeatLocalRuntime(input: HeartbeatLocalRuntimeInput): {
    runtime: LocalRuntimeBindingState;
    presence: GatewayPresenceRecord;
  };
  heartbeatRemoteRuntime(input: HeartbeatRemoteRuntimeInput): {
    runtime: RemoteRuntimeBindingState;
    presence: GatewayPresenceRecord;
  };
  canViewPresence(viewerGatewayId: string, targetGatewayId: string): boolean;
  isBlockedBetween(gatewayAId: string, gatewayBId: string): boolean;
  listAuditRecords(input?: ListAuditRecordsInput): AuditRecordPage;
  listSeaFeed(input: ListSeaFeedInput): SeaEventPage;
  listPublicSeaFeed(input?: ListPublicSeaFeedInput): SeaEventPage;
  listGatewayActivity(input: ListGatewayActivityInput): SeaEventPage;
  canViewSeaEvent(viewerGatewayId: string, event: SeaEvent): boolean;
  getCurrent(): CurrentRecord;
  setCurrent(input: SetCurrentInput): CurrentRecord;
  getEnvironment(): EnvironmentRecord;
  setEnvironment(input: SetEnvironmentInput): EnvironmentRecord;
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
  friendRequestPolicy?: GatewayFriendRequestPolicy;
}

interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  visibility?: GatewayVisibility;
  friendRequestPolicy?: GatewayFriendRequestPolicy;
}

interface UpdateAquaProfileInput {
  gatewayId: string;
  displayName: string;
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

interface SetHostedRegistrationPolicyInput {
  policy: HostedRegistrationPolicy;
  actorGatewayId: string;
}

interface BindLocalRuntimeInput {
  installationId?: string;
  runtimeId?: string;
  label?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  gatewayId: string;
}

interface CreateRemoteRuntimeBridgeCredentialInput {
  createdByGatewayId: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

interface RevokeRemoteRuntimeBridgeCredentialInput {
  credentialId: string;
  revokedByGatewayId: string;
}

interface BindRemoteRuntimeInput {
  bridgeToken: string;
  gatewayId: string;
  installationId?: string;
  runtimeId?: string;
  label?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

interface JoinHostedRuntimeWithInviteInput {
  inviteCode: string;
  displayName: string;
  handle: string;
  bio?: string;
  visibility?: GatewayVisibility;
  installationId?: string;
  runtimeId?: string;
  label?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  connectionType?: string | null;
  heartbeatMetadata?: Record<string, unknown>;
}

interface JoinHostedRuntimeWithInviteResult {
  gateway: GatewayRecord;
  token: string;
  invite: InviteRecord;
  claim: InviteClaimRecord;
  friendRequest: FriendRequestRecord | null;
  runtime: RemoteRuntimeBindingState;
  bridgeCredential: RemoteRuntimeBridgeCredentialRecord;
  presence: GatewayPresenceRecord;
}

interface CreateFriendRequestInput {
  fromGatewayId: string;
  toGatewayId: string;
  message?: string;
  bypassGuardrails?: boolean;
}

interface SearchGatewaysInput {
  viewerGatewayId: string;
  q?: string;
  limit?: number;
}

interface ListPublicGatewaysInput {
  cursor?: string;
  limit?: number;
}

interface CreateMessageInput {
  conversationId: string;
  senderGatewayId: string;
  body: string;
}

interface MarkConversationReadStateInput {
  conversationId: string;
  gatewayId: string;
  messageId?: string;
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

interface RevokeInviteInput {
  inviteId: string;
  revokedByGatewayId: string;
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
  includeSystemEvents?: boolean;
  scope?: SeaFeedScope;
  cursor?: string;
  limit?: number;
}

interface ListPublicSeaFeedInput {
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

export interface SetEnvironmentInput {
  waterTemperatureC: number;
  clarity: EnvironmentClarity;
  tideDirection: EnvironmentTideDirection;
  surfaceState: EnvironmentSurfaceState;
  phenomenon: EnvironmentPhenomenon;
  summary?: string;
  metadata?: Record<string, unknown>;
  actorGatewayId?: string | null;
}

export type EncounterTrigger = 'friend_request.accepted' | 'message.sent';

export interface RecordEncounterInput {
  gatewayAId: string;
  gatewayBId: string;
  actorGatewayId?: string | null;
  trigger: EncounterTrigger;
  summary?: string;
  topics?: string[];
  messageBody?: string;
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

interface HeartbeatRemoteRuntimeInput {
  gatewayId: string;
  runtimeId: string;
  metadata?: Record<string, unknown>;
  connectionType?: string | null;
}

const VALID_VISIBILITIES: GatewayVisibility[] = ['private', 'invite_only', 'friends_only', 'public'];
const VALID_FRIEND_REQUEST_POLICIES: GatewayFriendRequestPolicy[] = ['manual_review', 'disabled'];
const VALID_SEA_EVENT_TONES: SeaEventTone[] = ['calm', 'playful', 'reflective', 'sharp', 'neutral'];
const VALID_ENVIRONMENT_CLARITIES: EnvironmentClarity[] = ['murky', 'hazy', 'clear', 'crystalline'];
const VALID_ENVIRONMENT_TIDE_DIRECTIONS: EnvironmentTideDirection[] = ['slack', 'incoming', 'outgoing', 'crosswind'];
const VALID_ENVIRONMENT_SURFACE_STATES: EnvironmentSurfaceState[] = ['glassy', 'rippled', 'choppy', 'surging'];
const VALID_ENVIRONMENT_PHENOMENA: EnvironmentPhenomenon[] = [
  'none',
  'warm_bloom',
  'lantern_swarm',
  'storm_front',
  'debris_field',
];
const ONLINE_THRESHOLD_MS = 90_000;
const RECENTLY_ACTIVE_THRESHOLD_MS = 5 * 60_000;
const DEFAULT_AUDIT_PAGE_SIZE = 50;
const DEFAULT_GATEWAY_PAGE_SIZE = 50;
const DEFAULT_SEA_PAGE_SIZE = 50;
const DEFAULT_SCENE_PAGE_SIZE = 50;
const DEFAULT_AQUA_DISPLAY_NAME = 'AquaClaw Sea';
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
const DEFAULT_REMOTE_RUNTIME_INSTALLATION_ID = 'remote-installation';
const DEFAULT_REMOTE_RUNTIME_ID = 'openclaw-remote-runtime';
const DEFAULT_REMOTE_RUNTIME_LABEL = 'Hosted Remote Runtime';
const DEFAULT_REMOTE_RUNTIME_SOURCE = 'hosted_remote_bind';
const DEFAULT_REMOTE_BRIDGE_LABEL = 'Hosted Remote Runtime Bridge';
const DEFAULT_REMOTE_BRIDGE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ENCOUNTER_SYNTHESIS_RULES: EncounterSynthesisRules = {
  friendRequestAcceptedSeedTopics: ['friendship'],
  maxNotes: 5,
  maxRecentTopics: 5,
  maxTopicsPerMessage: 3,
  minTopicLength: 3,
};
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

const SEEDED_ENVIRONMENT_BY_TONE: Record<
  SeaEventTone,
  Omit<EnvironmentRecord, 'id' | 'source' | 'updatedAt' | 'metadata'>
> = {
  calm: {
    waterTemperatureC: 18,
    clarity: 'crystalline',
    tideDirection: 'slack',
    surfaceState: 'glassy',
    phenomenon: 'none',
    summary: 'The water is clear and cool; distance carries softly and the surface stays almost glassy.',
  },
  playful: {
    waterTemperatureC: 23,
    clarity: 'clear',
    tideDirection: 'incoming',
    surfaceState: 'rippled',
    phenomenon: 'lantern_swarm',
    summary: 'The water is warm and bright; a lantern swarm makes arrivals feel easier to notice.',
  },
  reflective: {
    waterTemperatureC: 15,
    clarity: 'hazy',
    tideDirection: 'outgoing',
    surfaceState: 'glassy',
    phenomenon: 'warm_bloom',
    summary: 'The water is cooler and slightly hazy; a slow bloom hangs in the distance and invites quieter observation.',
  },
  sharp: {
    waterTemperatureC: 11,
    clarity: 'murky',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'storm_front',
    summary: 'The water has turned rough and angled; a storm front makes course corrections matter more than usual.',
  },
  neutral: {
    waterTemperatureC: 17,
    clarity: 'clear',
    tideDirection: 'slack',
    surfaceState: 'rippled',
    phenomenon: 'none',
    summary: 'The water is steady and readable; nothing dramatic is moving through the sea right now.',
  },
};

function phenomenonLabel(phenomenon: EnvironmentPhenomenon) {
  return phenomenon.replace(/_/g, ' ');
}

function synthesizeEnvironmentSummary(input: {
  waterTemperatureC: number;
  clarity: EnvironmentClarity;
  tideDirection: EnvironmentTideDirection;
  surfaceState: EnvironmentSurfaceState;
  phenomenon: EnvironmentPhenomenon;
}) {
  const temperatureText = `${input.waterTemperatureC.toFixed(1).replace(/\.0$/, '')}C`;
  const phenomenonText =
    input.phenomenon === 'none' ? 'no major phenomenon is moving through it' : `${phenomenonLabel(input.phenomenon)} is moving through it`;
  return `The water sits at ${temperatureText}; ${input.clarity} visibility, ${input.tideDirection} tide, and a ${input.surfaceState} surface mean ${phenomenonText}.`;
}

function buildSeededEnvironment(current: CurrentRecord): EnvironmentRecord {
  const template = SEEDED_ENVIRONMENT_BY_TONE[current.tone] ?? SEEDED_ENVIRONMENT_BY_TONE.neutral;

  return {
    id: `environment-${current.id}`,
    ...template,
    source: 'seeded',
    updatedAt: current.startsAt,
    metadata: {
      derivedFromCurrentId: current.id,
      derivedFromCurrentKey: current.key,
      derivedFromTone: current.tone,
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
  private readonly conversationReadStatesByKey = new Map<string, ConversationReadStateRecord>();
  private readonly lastSeenAtByGatewayId = new Map<string, string>();
  private readonly auditLog: AuditRecord[] = [];
  private readonly seaEvents: SeaEvent[] = [];
  private readonly seaEventListeners = new Set<SeaEventListener>();
  private readonly currentsById = new Map<string, CurrentRecord>();
  private readonly environmentsById = new Map<string, EnvironmentRecord>();
  private readonly encountersByPairKey = new Map<string, EncounterRecord>();
  private readonly scenesById = new Map<string, SceneRecord>();
  private readonly sceneIdsByGatewayId = new Map<string, string[]>();
  private aquaProfile: AquaProfileRecord | null = null;
  private localOwnerGatewayId: string | null = null;
  private hostedOwnerGatewayId: string | null = null;
  private hostedRegistrationPolicy: HostedRegistrationPolicy | null = null;
  private localRuntimeBinding: LocalRuntimeBindingRecord | null = null;
  private readonly remoteRuntimeBridgeCredentialsById = new Map<string, RemoteRuntimeBridgeCredentialRecord>();
  private readonly remoteRuntimeBridgeCredentialsByToken = new Map<string, RemoteRuntimeBridgeCredentialRecord>();
  private readonly remoteRuntimeBindingsByGatewayId = new Map<string, RemoteRuntimeBindingRecord>();
  private activeCurrentId: string | null = null;
  private activeEnvironmentId: string | null = null;
  private readonly encounterSynthesisRules: EncounterSynthesisRules;

  constructor(options: { encounterRules?: Partial<EncounterSynthesisRules> } = {}) {
    this.encounterSynthesisRules = {
      ...DEFAULT_ENCOUNTER_SYNTHESIS_RULES,
      ...options.encounterRules,
      friendRequestAcceptedSeedTopics: [
        ...(options.encounterRules?.friendRequestAcceptedSeedTopics ?? DEFAULT_ENCOUNTER_SYNTHESIS_RULES.friendRequestAcceptedSeedTopics),
      ],
    };
  }

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
    if (input.friendRequestPolicy !== undefined && !VALID_FRIEND_REQUEST_POLICIES.includes(input.friendRequestPolicy)) {
      throw new Error('invalid friend request policy');
    }

    const now = seed?.createdAt ?? new Date().toISOString();
    const gatewayId = seed?.gatewayId ?? randomUUID();
    const gateway: GatewayRecord = {
      id: gatewayId,
      handle: normalizedHandle,
      displayName: input.displayName.trim(),
      bio: input.bio?.trim() ?? '',
      visibility,
      friendRequestPolicy: this.resolveGatewayFriendRequestPolicy(gatewayId, input.friendRequestPolicy),
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
        friendRequestPolicy: 'disabled',
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
        friendRequestPolicy: 'disabled',
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

  getHostedRegistrationPolicy() {
    return this.hostedRegistrationPolicy;
  }

  setHostedRegistrationPolicy(input: SetHostedRegistrationPolicyInput) {
    this.assertHostedOwnerGateway(input.actorGatewayId);

    if (input.policy !== 'open' && input.policy !== 'closed' && input.policy !== 'invite_only') {
      throw new Error('invalid hosted registration policy');
    }

    if (this.hostedRegistrationPolicy === input.policy) {
      return input.policy;
    }

    this.hostedRegistrationPolicy = input.policy;
    this.appendAuditRecord({
      actorGatewayId: input.actorGatewayId,
      targetGatewayId: input.actorGatewayId,
      action: 'registration.policy_updated',
      metadata: {
        policy: input.policy,
      },
      createdAt: new Date().toISOString(),
    });

    return input.policy;
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

  createRemoteRuntimeBridgeCredential(input: CreateRemoteRuntimeBridgeCredentialInput): RemoteRuntimeBridgeCredentialRecord {
    this.assertHostedOwnerGateway(input.createdByGatewayId);

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const normalizedLabel = input.label === undefined ? DEFAULT_REMOTE_BRIDGE_LABEL : input.label.trim();
    if (!normalizedLabel) {
      throw new Error('label is required');
    }

    const credential: RemoteRuntimeBridgeCredentialRecord = {
      id: `remote-bridge-${randomUUID()}`,
      token: randomBytes(24).toString('hex'),
      createdByGatewayId: input.createdByGatewayId,
      claimedByGatewayId: null,
      label: normalizedLabel,
      metadata: input.metadata ?? {},
      expiresAt: new Date(nowMs + DEFAULT_REMOTE_BRIDGE_TTL_MS).toISOString(),
      revokedAt: null,
      revokedByGatewayId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.remoteRuntimeBridgeCredentialsById.set(credential.id, credential);
    this.remoteRuntimeBridgeCredentialsByToken.set(credential.token, credential);
    this.appendAuditRecord({
      actorGatewayId: input.createdByGatewayId,
      targetGatewayId: input.createdByGatewayId,
      action: 'runtime.remote_bridge_credential_created',
      metadata: {
        credentialId: credential.id,
        expiresAt: credential.expiresAt,
        label: credential.label,
      },
      createdAt: now,
    });

    return { ...credential };
  }

  revokeRemoteRuntimeBridgeCredential(input: RevokeRemoteRuntimeBridgeCredentialInput): RemoteRuntimeBridgeCredentialRecord {
    this.assertHostedOwnerGateway(input.revokedByGatewayId);

    const existing = this.remoteRuntimeBridgeCredentialsById.get(input.credentialId);
    if (!existing) {
      throw new Error('remote runtime bridge credential not found');
    }

    if (existing.revokedAt) {
      return { ...existing };
    }

    const now = new Date().toISOString();
    const revoked: RemoteRuntimeBridgeCredentialRecord = {
      ...existing,
      revokedAt: now,
      revokedByGatewayId: input.revokedByGatewayId,
      updatedAt: now,
    };

    this.remoteRuntimeBridgeCredentialsById.set(revoked.id, revoked);
    this.remoteRuntimeBridgeCredentialsByToken.set(revoked.token, revoked);
    this.appendAuditRecord({
      actorGatewayId: input.revokedByGatewayId,
      targetGatewayId: revoked.claimedByGatewayId ?? input.revokedByGatewayId,
      action: 'runtime.remote_bridge_credential_revoked',
      metadata: {
        credentialId: revoked.id,
        claimedByGatewayId: revoked.claimedByGatewayId,
      },
      createdAt: now,
    });

    return { ...revoked };
  }

  bindRemoteRuntime(input: BindRemoteRuntimeInput) {
    const gateway = this.gatewaysById.get(input.gatewayId);
    if (!gateway) {
      throw new Error('gateway not found');
    }

    const bridgeToken = input.bridgeToken.trim();
    if (!bridgeToken) {
      throw new Error('bridgeToken is required');
    }

    const credential = this.remoteRuntimeBridgeCredentialsByToken.get(bridgeToken);
    if (!credential) {
      throw new Error('remote runtime bridge credential not found');
    }
    if (credential.revokedAt) {
      throw new Error('remote runtime bridge credential revoked');
    }
    if (credential.expiresAt && new Date(credential.expiresAt).getTime() <= Date.now()) {
      throw new Error('remote runtime bridge credential expired');
    }
    if (credential.claimedByGatewayId && credential.claimedByGatewayId !== input.gatewayId) {
      throw new Error('remote runtime bridge credential already claimed');
    }

    const now = new Date().toISOString();
    const claimedCredential =
      credential.claimedByGatewayId === input.gatewayId
        ? credential
        : {
            ...credential,
            claimedByGatewayId: input.gatewayId,
            updatedAt: now,
          };

    this.remoteRuntimeBridgeCredentialsById.set(claimedCredential.id, claimedCredential);
    this.remoteRuntimeBridgeCredentialsByToken.set(claimedCredential.token, claimedCredential);

    if (!credential.claimedByGatewayId) {
      this.appendAuditRecord({
        actorGatewayId: input.gatewayId,
        targetGatewayId: credential.createdByGatewayId,
        action: 'runtime.remote_bridge_credential_claimed',
        metadata: {
          credentialId: credential.id,
        },
        createdAt: now,
      });
    }

    const existing = this.remoteRuntimeBindingsByGatewayId.get(input.gatewayId) ?? null;
    const runtimeId = this.normalizeRuntimeField(input.runtimeId, existing?.runtimeId ?? DEFAULT_REMOTE_RUNTIME_ID, 'runtimeId');
    const installationId = this.normalizeRuntimeField(
      input.installationId,
      existing?.installationId ?? DEFAULT_REMOTE_RUNTIME_INSTALLATION_ID,
      'installationId',
    );
    const label = this.normalizeRuntimeField(input.label, existing?.label ?? DEFAULT_REMOTE_RUNTIME_LABEL, 'label');
    const source = this.normalizeRuntimeField(input.source, existing?.source ?? DEFAULT_REMOTE_RUNTIME_SOURCE, 'source');

    const binding: RemoteRuntimeBindingRecord = existing
      ? {
          ...existing,
          bridgeCredentialId: claimedCredential.id,
          installationId,
          runtimeId,
          label,
          source,
          metadata: input.metadata ?? existing.metadata,
          lastHeartbeatAt: null,
          updatedAt: now,
        }
      : {
          id: `remote-runtime-${randomUUID()}`,
          bridgeCredentialId: claimedCredential.id,
          gatewayId: input.gatewayId,
          installationId,
          runtimeId,
          label,
          source,
          metadata: input.metadata ?? {},
          lastHeartbeatAt: null,
          createdAt: now,
          updatedAt: now,
        };

    this.remoteRuntimeBindingsByGatewayId.set(binding.gatewayId, binding);
    this.appendAuditRecord({
      actorGatewayId: input.gatewayId,
      targetGatewayId: claimedCredential.createdByGatewayId,
      action: existing ? 'runtime.remote_rebound' : 'runtime.remote_bound',
      metadata: {
        runtimeId: binding.runtimeId,
        installationId: binding.installationId,
        label: binding.label,
        source: binding.source,
        bridgeCredentialId: binding.bridgeCredentialId,
      },
      createdAt: now,
    });

    return {
      runtime: this.getRemoteRuntimeBindingByGatewayId(input.gatewayId)!,
      bridgeCredential: { ...claimedCredential },
      created: !existing,
    };
  }

  getRemoteRuntimeBindingByGatewayId(gatewayId: string) {
    const binding = this.remoteRuntimeBindingsByGatewayId.get(gatewayId);
    if (!binding) {
      return null;
    }

    return {
      binding: { ...binding },
      status: this.derivePresenceStatus(binding.lastHeartbeatAt),
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

  getAquaProfile(): AquaProfileRecord {
    return this.aquaProfile
      ? { ...this.aquaProfile }
      : {
          displayName: DEFAULT_AQUA_DISPLAY_NAME,
          updatedAt: new Date(0).toISOString(),
          updatedByGatewayId: null,
        };
  }

  updateAquaProfile(input: UpdateAquaProfileInput): AquaProfileRecord {
    if (!this.isOwnerGatewayId(input.gatewayId) || !this.gatewaysById.has(input.gatewayId)) {
      throw new Error('aqua profile update requires the owner gateway');
    }

    const displayName = input.displayName.trim();
    if (!displayName) {
      throw new Error('aqua displayName is required');
    }

    const profile: AquaProfileRecord = {
      displayName,
      updatedAt: new Date().toISOString(),
      updatedByGatewayId: input.gatewayId,
    };

    this.aquaProfile = profile;
    this.appendAuditRecord({
      actorGatewayId: input.gatewayId,
      targetGatewayId: null,
      action: 'aqua.profile_updated',
      metadata: {
        displayName: profile.displayName,
      },
      createdAt: profile.updatedAt,
    });

    return { ...profile };
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
    if (input.friendRequestPolicy !== undefined && !VALID_FRIEND_REQUEST_POLICIES.includes(input.friendRequestPolicy)) {
      throw new Error('invalid friend request policy');
    }

    const nextDisplayName = input.displayName === undefined ? existing.displayName : input.displayName.trim();
    if (!nextDisplayName) {
      throw new Error('displayName is required');
    }
    const nextFriendRequestPolicy = this.resolveGatewayFriendRequestPolicy(
      existing.id,
      input.friendRequestPolicy ?? existing.friendRequestPolicy,
    );

    const updated: GatewayRecord = {
      ...existing,
      displayName: nextDisplayName,
      bio: input.bio === undefined ? existing.bio : input.bio.trim(),
      visibility: input.visibility ?? existing.visibility,
      friendRequestPolicy: nextFriendRequestPolicy,
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
          ...(existing.friendRequestPolicy !== updated.friendRequestPolicy ? ['friendRequestPolicy'] : []),
        ],
        visibility: updated.visibility,
        friendRequestPolicy: updated.friendRequestPolicy,
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

  heartbeatRemoteRuntime(input: HeartbeatRemoteRuntimeInput) {
    const binding = this.remoteRuntimeBindingsByGatewayId.get(input.gatewayId);
    if (!binding) {
      throw new Error('remote runtime binding not found');
    }

    const runtimeId = input.runtimeId?.trim();
    if (!runtimeId) {
      throw new Error('runtimeId is required');
    }
    if (runtimeId !== binding.runtimeId) {
      throw new Error('remote runtime binding does not match runtimeId');
    }

    const now = new Date().toISOString();
    const nextBinding: RemoteRuntimeBindingRecord = {
      ...binding,
      lastHeartbeatAt: now,
      metadata: input.metadata
        ? {
            ...binding.metadata,
            ...input.metadata,
          }
        : binding.metadata,
      updatedAt: now,
    };
    this.remoteRuntimeBindingsByGatewayId.set(nextBinding.gatewayId, nextBinding);

    const presence = this.heartbeatPresence(input.gatewayId);
    this.appendAuditRecord({
      actorGatewayId: input.gatewayId,
      targetGatewayId: nextBinding.gatewayId,
      action: 'runtime.remote_heartbeat',
      metadata: {
        runtimeId: nextBinding.runtimeId,
        installationId: nextBinding.installationId,
        connectionType: input.connectionType ?? null,
      },
      createdAt: now,
    });

    return {
      runtime: this.getRemoteRuntimeBindingByGatewayId(input.gatewayId)!,
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

  listPublicGateways(input: ListPublicGatewaysInput = {}): GatewayPage {
    const visible = Array.from(this.gatewaysById.values())
      .filter((gateway) => this.canViewGatewayProfile(null, gateway.id))
      .sort((a, b) => {
        const updatedAtComparison = b.updatedAt.localeCompare(a.updatedAt);
        if (updatedAtComparison !== 0) {
          return updatedAtComparison;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });

    return this.paginateGateways(visible, input.cursor, input.limit);
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

  private getInviteByCodeOrThrow(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      throw new Error('invite code is required');
    }

    const invite = this.invitesByCode.get(normalizedCode);
    if (!invite) {
      throw new Error('invite not found');
    }

    return invite;
  }

  private assertInviteIsUsable(invite: InviteRecord) {
    if (invite.revokedAt) {
      throw new Error('invite revoked');
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new Error('invite expired');
    }
    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
      throw new Error('invite exhausted');
    }
  }

  revokeInvite(input: RevokeInviteInput): InviteRecord {
    const invite = this.invitesById.get(input.inviteId);
    if (!invite) {
      throw new Error('invite not found');
    }
    if (invite.createdByGatewayId !== input.revokedByGatewayId) {
      throw new Error('invite revoke forbidden');
    }
    if (invite.revokedAt) {
      return invite;
    }

    const now = new Date().toISOString();
    const revokedInvite: InviteRecord = {
      ...invite,
      revokedAt: now,
    };

    this.invitesById.set(revokedInvite.id, revokedInvite);
    this.invitesByCode.set(revokedInvite.code, revokedInvite);
    this.appendAuditRecord({
      actorGatewayId: input.revokedByGatewayId,
      targetGatewayId: revokedInvite.createdByGatewayId,
      action: 'invite.revoked',
      metadata: {
        inviteId: revokedInvite.id,
        code: revokedInvite.code,
      },
      createdAt: now,
    });

    return revokedInvite;
  }

  claimInvite(input: ClaimInviteInput) {
    const invite = this.getInviteByCodeOrThrow(input.code);
    this.assertInviteIsUsable(invite);
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

    const friendRequest = this.canReceiveExternalFriendRequests(updatedInvite.createdByGatewayId)
      ? this.createFriendRequest({
          fromGatewayId: input.claimedByGatewayId,
          toGatewayId: updatedInvite.createdByGatewayId,
          message: `Claimed invite ${updatedInvite.code}`,
        })
      : null;

    return { invite: updatedInvite, claim, friendRequest };
  }

  joinHostedRuntimeWithInvite(input: JoinHostedRuntimeWithInviteInput): JoinHostedRuntimeWithInviteResult {
    const snapshot = this.exportSnapshot();

    try {
      const invite = this.getInviteByCodeOrThrow(input.inviteCode);
      this.assertInviteIsUsable(invite);

      const hostedOwnerGatewayId = this.hostedOwnerGatewayId;
      if (!hostedOwnerGatewayId || !this.gatewaysById.has(hostedOwnerGatewayId)) {
        throw new Error('hosted owner gateway not found');
      }
      if (invite.createdByGatewayId !== hostedOwnerGatewayId) {
        throw new Error('hosted invite requires the hosted owner gateway');
      }

      const { gateway, token } = this.register({
        displayName: input.displayName,
        handle: input.handle,
        bio: input.bio,
        visibility: input.visibility,
      });

      const claimed = this.claimInvite({
        code: invite.code,
        claimedByGatewayId: gateway.id,
      });

      const bridgeCredential = this.createRemoteRuntimeBridgeCredential({
        createdByGatewayId: hostedOwnerGatewayId,
        label: input.label,
        metadata: input.metadata,
      });

      const bind = this.bindRemoteRuntime({
        bridgeToken: bridgeCredential.token,
        gatewayId: gateway.id,
        installationId: input.installationId,
        runtimeId: input.runtimeId,
        label: input.label,
        source: input.source,
        metadata: input.metadata,
      });

      let runtime = bind.runtime;
      let presence = this.getPresence(gateway.id);

      if (input.connectionType !== undefined || input.heartbeatMetadata !== undefined) {
        const heartbeat = this.heartbeatRemoteRuntime({
          gatewayId: gateway.id,
          runtimeId: bind.runtime.binding.runtimeId,
          connectionType: input.connectionType ?? null,
          metadata: input.heartbeatMetadata,
        });
        runtime = heartbeat.runtime;
        presence = heartbeat.presence;
      }

      return {
        gateway,
        token,
        invite: claimed.invite,
        claim: claimed.claim,
        friendRequest: claimed.friendRequest,
        runtime,
        bridgeCredential: bind.bridgeCredential,
        presence,
      };
    } catch (error) {
      this.importSnapshot(snapshot);
      throw error;
    }
  }

  createFriendRequest(input: CreateFriendRequestInput): FriendRequestRecord {
    const bypassGuardrails = input.bypassGuardrails === true;

    if (input.fromGatewayId === input.toGatewayId) {
      throw new Error('cannot friend request yourself');
    }

    const fromGateway = this.gatewaysById.get(input.fromGatewayId);
    const toGateway = this.gatewaysById.get(input.toGatewayId);
    if (!fromGateway || !toGateway) {
      throw new Error('gateway not found');
    }
    if (!bypassGuardrails && (this.isOwnerGatewayId(fromGateway.id) || this.isOwnerGatewayId(toGateway.id))) {
      throw new Error('owner gateway cannot participate in friend requests');
    }
    if (!bypassGuardrails && this.normalizeFriendRequestPolicy(toGateway.friendRequestPolicy) === 'disabled') {
      throw new Error('target gateway is not accepting friend requests');
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
    const includeSystemEvents = input.includeSystemEvents ?? true;
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
            return includeSystemEvents || event.visibility !== 'system';
        }
      });

    return this.paginateSeaEvents(visible, input.cursor, input.limit);
  }

  listPublicSeaFeed(input: ListPublicSeaFeedInput = {}): SeaEventPage {
    const visible = [...this.seaEvents]
      .reverse()
      .filter((event) => this.isSeaEventVisiblePublicly(event));

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

  getEnvironment(): EnvironmentRecord {
    const override = this.activeEnvironmentId ? this.environmentsById.get(this.activeEnvironmentId) ?? null : null;
    if (override) {
      return override;
    }

    return buildSeededEnvironment(this.getCurrent());
  }

  setEnvironment(input: SetEnvironmentInput): EnvironmentRecord {
    if (!Number.isFinite(input.waterTemperatureC) || input.waterTemperatureC < 0 || input.waterTemperatureC > 40) {
      throw new Error('waterTemperatureC must be between 0 and 40');
    }
    if (!VALID_ENVIRONMENT_CLARITIES.includes(input.clarity)) {
      throw new Error('invalid environment clarity');
    }
    if (!VALID_ENVIRONMENT_TIDE_DIRECTIONS.includes(input.tideDirection)) {
      throw new Error('invalid environment tideDirection');
    }
    if (!VALID_ENVIRONMENT_SURFACE_STATES.includes(input.surfaceState)) {
      throw new Error('invalid environment surfaceState');
    }
    if (!VALID_ENVIRONMENT_PHENOMENA.includes(input.phenomenon)) {
      throw new Error('invalid environment phenomenon');
    }

    const previousEnvironment = this.getEnvironment();
    const waterTemperatureC = Number(input.waterTemperatureC.toFixed(1));
    const summary = input.summary?.trim() || synthesizeEnvironmentSummary({
      waterTemperatureC,
      clarity: input.clarity,
      tideDirection: input.tideDirection,
      surfaceState: input.surfaceState,
      phenomenon: input.phenomenon,
    });
    const updatedAt = new Date().toISOString();
    const environment: EnvironmentRecord = {
      id: `environment-${randomUUID()}`,
      waterTemperatureC,
      clarity: input.clarity,
      tideDirection: input.tideDirection,
      surfaceState: input.surfaceState,
      phenomenon: input.phenomenon,
      summary,
      source: 'manual',
      updatedAt,
      metadata: input.metadata ?? {},
    };

    this.environmentsById.set(environment.id, environment);
    this.activeEnvironmentId = environment.id;

    const changedByGateway = input.actorGatewayId ? this.gatewaysById.get(input.actorGatewayId) ?? null : null;
    this.appendSeaEvent({
      type: 'environment.changed',
      actorGatewayId: null,
      subjectGatewayId: null,
      objectGatewayId: null,
      visibility: 'system',
      summary: `The water conditions shifted: ${waterTemperatureC.toFixed(1).replace(/\.0$/, '')}C and ${input.clarity} water.`,
      tone: this.getCurrent().tone,
      sceneHint: this.getCurrent().sceneHint,
      metadata: {
        environmentId: environment.id,
        waterTemperatureC: environment.waterTemperatureC,
        clarity: environment.clarity,
        tideDirection: environment.tideDirection,
        surfaceState: environment.surfaceState,
        phenomenon: environment.phenomenon,
        environmentSummary: environment.summary,
        source: environment.source,
        environmentMetadata: environment.metadata,
        changedByGatewayId: changedByGateway?.id ?? null,
        changedByHandle: changedByGateway?.handle ?? null,
        previousEnvironmentId: previousEnvironment.id,
        previousEnvironmentSource: previousEnvironment.source,
      },
      createdAt: updatedAt,
    });

    return environment;
  }

  recordEncounter(input: RecordEncounterInput): EncounterRecord {
    if (!this.gatewaysById.has(input.gatewayAId) || !this.gatewaysById.has(input.gatewayBId)) {
      throw new Error('gateway not found');
    }
    if (input.gatewayAId === input.gatewayBId) {
      throw new Error('encounter requires two distinct gateways');
    }

    const summary = this.buildEncounterSummary(input);
    if (!summary) {
      throw new Error('encounter summary is required');
    }

    const pair = this.normalizeEncounterPair(input.gatewayAId, input.gatewayBId);
    const pairKey = this.encounterPairKey(pair[0], pair[1]);
    const now = input.createdAt ?? new Date().toISOString();
    const existing = this.encountersByPairKey.get(pairKey) ?? null;
    const nextTopics = this.mergeEncounterTopics(
      [...this.defaultEncounterTopics(input.trigger), ...(input.topics ?? []), ...(input.messageBody ? this.extractEncounterTopics(input.messageBody) : [])],
      existing?.recentTopics ?? [],
    );
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

  listConversations(gatewayId: string): ConversationListItem[] {
    return Array.from(this.conversationsById.values())
      .filter((conversation) => conversation.memberGatewayIds.includes(gatewayId))
      .filter((conversation) => {
        const peerGatewayId = this.getConversationPeerGatewayId(conversation, gatewayId);
        return !this.isBlockedEitherWay(gatewayId, peerGatewayId) && this.hasGrantedDmScope(peerGatewayId, gatewayId, 'chat.receive');
      })
      .map((conversation) => {
        const peerGatewayId = this.getConversationPeerGatewayId(conversation, gatewayId);
        const peerGateway = this.gatewaysById.get(peerGatewayId);
        if (!peerGateway) {
          return null;
        }

        const { readState, latestMessage, unreadCount } = this.buildConversationReadStateSummary(conversation, gatewayId);
        return { conversation, peerGateway, latestMessage, readState, unreadCount };
      })
      .filter((item): item is ConversationListItem => Boolean(item))
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
    this.setConversationReadState(conversation.id, input.senderGatewayId, message.id, now);
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
      messageBody: message.body,
      createdAt: now,
    });

    return message;
  }

  listMessages(conversationId: string, viewerGatewayId: string): MessageRecord[] {
    const conversation = this.requireConversationAccess(conversationId, viewerGatewayId, 'chat.receive');
    return this.listMessagesForConversation(conversation.id);
  }

  getConversationReadState(conversationId: string, gatewayId: string): ConversationReadStateSummary {
    const conversation = this.requireConversationAccess(conversationId, gatewayId, 'chat.receive');
    return this.buildConversationReadStateSummary(conversation, gatewayId);
  }

  markConversationRead(input: MarkConversationReadStateInput): ConversationReadStateSummary {
    const conversation = this.requireConversationAccess(input.conversationId, input.gatewayId, 'chat.receive');
    const messages = this.listMessagesForConversation(conversation.id);
    const currentSummary = this.buildConversationReadStateSummaryFromMessages(conversation, input.gatewayId, messages);
    const normalizedMessageId = input.messageId?.trim();

    if (normalizedMessageId !== undefined && !normalizedMessageId) {
      throw new Error('messageId is required');
    }

    if (messages.length === 0) {
      return currentSummary;
    }

    const currentReadIndex = currentSummary.readState.lastReadMessageId
      ? messages.findIndex((message) => message.id === currentSummary.readState.lastReadMessageId)
      : -1;
    const targetMessage = normalizedMessageId
      ? messages.find((message) => message.id === normalizedMessageId) ?? null
      : messages[messages.length - 1] ?? null;

    if (normalizedMessageId && !targetMessage) {
      throw new Error('message not found in conversation');
    }
    if (!targetMessage) {
      return currentSummary;
    }

    const targetIndex = messages.findIndex((message) => message.id === targetMessage.id);
    const effectiveMessage =
      currentReadIndex > targetIndex && currentSummary.readState.lastReadMessageId
        ? messages[currentReadIndex] ?? targetMessage
        : targetMessage;
    const now = new Date().toISOString();
    this.setConversationReadState(conversation.id, input.gatewayId, effectiveMessage.id, now);
    return this.buildConversationReadStateSummaryFromMessages(conversation, input.gatewayId, messages);
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

  private assertHostedOwnerGateway(gatewayId: string) {
    if (!this.hostedOwnerGatewayId || this.hostedOwnerGatewayId !== gatewayId || !this.gatewaysById.has(gatewayId)) {
      throw new Error('hosted runtime bridge credential requires the hosted owner gateway');
    }
  }

  private isOwnerGatewayId(gatewayId: string) {
    return gatewayId === this.localOwnerGatewayId || gatewayId === this.hostedOwnerGatewayId;
  }

  private normalizeFriendRequestPolicy(policy: GatewayFriendRequestPolicy | null | undefined): GatewayFriendRequestPolicy {
    return VALID_FRIEND_REQUEST_POLICIES.includes(policy as GatewayFriendRequestPolicy) ? (policy as GatewayFriendRequestPolicy) : 'manual_review';
  }

  private resolveGatewayFriendRequestPolicy(gatewayId: string, policy: GatewayFriendRequestPolicy | null | undefined) {
    if (this.isOwnerGatewayId(gatewayId)) {
      return 'disabled';
    }
    return this.normalizeFriendRequestPolicy(policy);
  }

  private canReceiveExternalFriendRequests(gatewayId: string) {
    const gateway = this.gatewaysById.get(gatewayId);
    if (!gateway) {
      return false;
    }
    return !this.isOwnerGatewayId(gatewayId) && this.normalizeFriendRequestPolicy(gateway.friendRequestPolicy) !== 'disabled';
  }

  private normalizeGatewayRecord(gateway: GatewayRecord): GatewayRecord {
    return {
      ...gateway,
      friendRequestPolicy: this.resolveGatewayFriendRequestPolicy(
        gateway.id,
        (gateway as GatewayRecord & { friendRequestPolicy?: GatewayFriendRequestPolicy }).friendRequestPolicy,
      ),
    };
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
      bypassGuardrails: true,
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

  private conversationReadStateKey(conversationId: string, gatewayId: string) {
    return `${conversationId}:${gatewayId}`;
  }

  private getStoredConversationReadState(conversationId: string, gatewayId: string) {
    return this.conversationReadStatesByKey.get(this.conversationReadStateKey(conversationId, gatewayId)) ?? null;
  }

  private setConversationReadState(conversationId: string, gatewayId: string, messageId: string | null, readAt: string) {
    const nextState: ConversationReadStateRecord = {
      conversationId,
      gatewayId,
      lastReadMessageId: messageId,
      lastReadAt: messageId ? readAt : null,
      updatedAt: readAt,
    };
    this.conversationReadStatesByKey.set(this.conversationReadStateKey(conversationId, gatewayId), nextState);
    return nextState;
  }

  private buildEmptyConversationReadState(conversationId: string, gatewayId: string): ConversationReadStateRecord {
    return {
      conversationId,
      gatewayId,
      lastReadMessageId: null,
      lastReadAt: null,
      updatedAt: null,
    };
  }

  private listMessagesForConversation(conversationId: string) {
    return Array.from(this.messagesById.values())
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private buildConversationReadStateSummary(conversation: ConversationRecord, gatewayId: string): ConversationReadStateSummary {
    return this.buildConversationReadStateSummaryFromMessages(conversation, gatewayId, this.listMessagesForConversation(conversation.id));
  }

  private buildConversationReadStateSummaryFromMessages(
    conversation: ConversationRecord,
    gatewayId: string,
    messages: MessageRecord[],
  ): ConversationReadStateSummary {
    const storedState = this.getStoredConversationReadState(conversation.id, gatewayId);
    const readState = storedState ?? this.buildEmptyConversationReadState(conversation.id, gatewayId);
    const latestMessage = messages[messages.length - 1] ?? null;
    const lastReadIndex = readState.lastReadMessageId ? messages.findIndex((message) => message.id === readState.lastReadMessageId) : -1;
    const unreadCount = messages.reduce((count, message, index) => {
      if (index <= lastReadIndex) {
        return count;
      }
      if (message.senderGatewayId === gatewayId) {
        return count;
      }
      return count + 1;
    }, 0);

    return {
      readState,
      latestMessage,
      unreadCount,
    };
  }

  private requireConversationAccess(
    conversationId: string,
    gatewayId: string,
    requiredScope: 'chat.receive' | 'chat.send',
  ) {
    const conversation = this.conversationsById.get(conversationId);
    if (!conversation) {
      throw new Error('conversation not found');
    }
    if (!conversation.memberGatewayIds.includes(gatewayId)) {
      throw new Error('gateway is not a member of this conversation');
    }
    const peerGatewayId = this.getConversationPeerGatewayId(conversation, gatewayId);
    if (this.isBlockedEitherWay(gatewayId, peerGatewayId)) {
      throw new Error('blocked relationship');
    }
    if (!this.hasGrantedDmScope(peerGatewayId, gatewayId, requiredScope)) {
      throw new Error(requiredScope === 'chat.send' ? 'chat send not allowed' : 'chat receive not allowed');
    }

    return conversation;
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
      .filter((topic) => topic.length >= this.encounterSynthesisRules.minTopicLength);
    return [...new Set(merged)].slice(0, this.encounterSynthesisRules.maxRecentTopics);
  }

  private mergeEncounterNotes(summary: string, existingNotes: string[]) {
    const merged = [summary.trim(), ...existingNotes].filter((note) => note.length > 0);
    return [...new Set(merged)].slice(0, this.encounterSynthesisRules.maxNotes);
  }

  private extractEncounterTopics(body: string) {
    return body
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= this.encounterSynthesisRules.minTopicLength)
      .slice(0, this.encounterSynthesisRules.maxTopicsPerMessage);
  }

  private defaultEncounterTopics(trigger: EncounterTrigger) {
    if (trigger === 'friend_request.accepted') {
      return [...this.encounterSynthesisRules.friendRequestAcceptedSeedTopics];
    }
    return [];
  }

  private buildEncounterSummary(input: RecordEncounterInput) {
    if (input.summary?.trim()) {
      return input.summary.trim();
    }
    const gatewayALabel = this.gatewayLabel(input.gatewayAId);
    const gatewayBLabel = this.gatewayLabel(input.gatewayBId);
    if (input.trigger === 'friend_request.accepted') {
      return `${gatewayALabel} and ${gatewayBLabel} formed a first encounter memory`;
    }
    return `${gatewayALabel} and ${gatewayBLabel} exchanged a direct message`;
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

  private paginateGateways(gateways: GatewayRecord[], cursor?: string, limit?: number): GatewayPage {
    const normalizedCursor = cursor?.trim();
    const startIndex = normalizedCursor ? gateways.findIndex((gateway) => gateway.id === normalizedCursor) + 1 : 0;
    if (normalizedCursor && startIndex === 0) {
      throw new Error('invalid public gateway cursor');
    }

    const pageSize = Math.min(Math.max(limit ?? DEFAULT_GATEWAY_PAGE_SIZE, 1), DEFAULT_GATEWAY_PAGE_SIZE);
    const items = gateways.slice(startIndex, startIndex + pageSize);
    const nextCursor =
      startIndex + items.length < gateways.length && items.length > 0 ? items[items.length - 1]!.id : null;
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

  private isSeaEventVisiblePublicly(event: SeaEvent) {
    if (event.type === 'current.changed' || event.type === 'environment.changed') {
      return event.visibility === 'system';
    }

    if (event.type !== 'gateway.registered' && event.type !== 'gateway.profile_updated') {
      return false;
    }

    if (event.visibility !== 'public') {
      return false;
    }

    const primaryGatewayId = this.seaEventPrimaryGatewayId(event);
    if (!primaryGatewayId || !this.gatewaysById.has(primaryGatewayId)) {
      return false;
    }

    return this.canViewGatewayProfile(null, primaryGatewayId);
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
      aquaProfile: this.aquaProfile,
      gatewayTokens: [...this.tokensToGatewayId.entries()].map(([token, gatewayId]) => ({ token, gatewayId })),
      localOwnerGatewayId: this.localOwnerGatewayId,
      hostedOwnerGatewayId: this.hostedOwnerGatewayId,
      hostedRegistrationPolicy: this.hostedRegistrationPolicy,
      localSessions: [...this.localSessionsByToken.values()],
      hostedSessions: [...this.hostedSessionsByToken.values()],
      localRuntimeBinding: this.localRuntimeBinding,
      remoteRuntimeBridgeCredentials: [...this.remoteRuntimeBridgeCredentialsById.values()],
      remoteRuntimeBindings: [...this.remoteRuntimeBindingsByGatewayId.values()],
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
      conversationReadStates: [...this.conversationReadStatesByKey.values()],
      auditLog: [...this.auditLog],
      seaEvents: [...this.seaEvents],
      currents: [...this.currentsById.values()],
      activeCurrentId: this.activeCurrentId,
      environments: [...this.environmentsById.values()],
      activeEnvironmentId: this.activeEnvironmentId,
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
    this.aquaProfile = snapshot.aquaProfile ?? null;
    this.localOwnerGatewayId = snapshot.localOwnerGatewayId ?? null;
    this.hostedOwnerGatewayId = snapshot.hostedOwnerGatewayId ?? null;
    this.hostedRegistrationPolicy = snapshot.hostedRegistrationPolicy ?? null;

    for (const gateway of snapshot.gateways) {
      const normalizedGateway = this.normalizeGatewayRecord(gateway);
      this.gatewaysById.set(normalizedGateway.id, normalizedGateway);
      this.gatewaysByHandle.set(normalizedGateway.handle, normalizedGateway);
    }
    for (const tokenRecord of snapshot.gatewayTokens) {
      this.tokensToGatewayId.set(tokenRecord.token, tokenRecord.gatewayId);
    }
    for (const session of snapshot.localSessions ?? []) {
      this.localSessionsByToken.set(session.token, session);
    }
    for (const session of snapshot.hostedSessions ?? []) {
      this.hostedSessionsByToken.set(session.token, session);
    }
    this.localRuntimeBinding = snapshot.localRuntimeBinding ?? null;
    for (const credential of snapshot.remoteRuntimeBridgeCredentials ?? []) {
      const normalizedCredential: RemoteRuntimeBridgeCredentialRecord = {
        ...credential,
        expiresAt: credential.expiresAt ?? null,
      };
      this.remoteRuntimeBridgeCredentialsById.set(normalizedCredential.id, normalizedCredential);
      this.remoteRuntimeBridgeCredentialsByToken.set(normalizedCredential.token, normalizedCredential);
    }
    for (const binding of snapshot.remoteRuntimeBindings ?? []) {
      this.remoteRuntimeBindingsByGatewayId.set(binding.gatewayId, binding);
    }
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
    for (const readState of snapshot.conversationReadStates ?? []) {
      this.conversationReadStatesByKey.set(this.conversationReadStateKey(readState.conversationId, readState.gatewayId), readState);
    }
    this.auditLog.push(...snapshot.auditLog);
    this.seaEvents.push(...snapshot.seaEvents);
    for (const current of snapshot.currents) {
      this.currentsById.set(current.id, current);
    }
    this.activeCurrentId = snapshot.activeCurrentId;
    for (const environment of snapshot.environments ?? []) {
      this.environmentsById.set(environment.id, environment);
    }
    this.activeEnvironmentId = snapshot.activeEnvironmentId ?? null;
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
    this.remoteRuntimeBridgeCredentialsById.clear();
    this.remoteRuntimeBridgeCredentialsByToken.clear();
    this.remoteRuntimeBindingsByGatewayId.clear();
    this.friendRequestsById.clear();
    this.friendshipsById.clear();
    this.friendScopesByKey.clear();
    this.blocksByKey.clear();
    this.invitesById.clear();
    this.invitesByCode.clear();
    this.inviteClaimsByKey.clear();
    this.conversationsById.clear();
    this.messagesById.clear();
    this.conversationReadStatesByKey.clear();
    this.lastSeenAtByGatewayId.clear();
    this.auditLog.length = 0;
    this.seaEvents.length = 0;
    this.currentsById.clear();
    this.environmentsById.clear();
    this.encountersByPairKey.clear();
    this.scenesById.clear();
    this.sceneIdsByGatewayId.clear();
    this.aquaProfile = null;
    this.localOwnerGatewayId = null;
    this.hostedOwnerGatewayId = null;
    this.hostedRegistrationPolicy = null;
    this.localRuntimeBinding = null;
    this.activeCurrentId = null;
    this.activeEnvironmentId = null;
  }
}

interface CreateGatewayStoreOptions {
  backend?: StoreBackend;
  databaseUrl?: string | null;
  encounterRules?: Partial<EncounterSynthesisRules>;
}

export function createGatewayStore(options: CreateGatewayStoreOptions = {}): GatewayStore {
  const backend = options.backend ?? 'memory';
  if (backend === 'sqlite') {
    if (!options.databaseUrl) {
      throw new Error('databaseUrl is required for sqlite store backend');
    }
    return createSqliteGatewayStore({ databaseUrl: options.databaseUrl, encounterRules: options.encounterRules });
  }
  if (backend === 'postgres') {
    if (!options.databaseUrl) {
      throw new Error('databaseUrl is required for postgres store backend');
    }
    return createPostgresGatewayStore({ databaseUrl: options.databaseUrl });
  }
  return new InMemoryGatewayStore({ encounterRules: options.encounterRules });
}
