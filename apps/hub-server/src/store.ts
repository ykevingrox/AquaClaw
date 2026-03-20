import { randomBytes, randomUUID } from 'node:crypto';
import { createPostgresGatewayStore } from './postgres-store.js';
import { createSqliteGatewayStore } from './sqlite-store.js';

export type GatewayVisibility = 'private' | 'invite_only' | 'friends_only' | 'public';
export type GatewayFriendRequestPolicy = 'manual_review' | 'disabled';
export type PresenceStatus = 'online' | 'recently_active' | 'offline';

export interface PresenceTimingConfig {
  onlineThresholdMs: number;
  recentlyActiveThresholdMs: number;
}

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

export interface HostRecord {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
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
  createdByGatewayId: string | null;
  createdByHostId: string | null;
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

export type TaskRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';

export interface TaskRequestRecord {
  id: string;
  fromGatewayId: string;
  toGatewayId: string;
  status: TaskRequestStatus;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
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

export interface PublicExpressionRecord {
  id: string;
  gatewayId: string;
  rootExpressionId: string;
  parentExpressionId: string | null;
  replyToGatewayId: string | null;
  visibility: 'public';
  body: string;
  tone: SeaEventTone;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

export interface PublicExpressionPage {
  items: PublicExpressionRecord[];
  nextCursor: string | null;
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
  updatedByHostId: string | null;
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

export type SocialPulseAction =
  | 'none'
  | 'memory_only'
  | 'recharge'
  | 'public_expression'
  | 'friend_request_accept'
  | 'friend_request_reject'
  | 'friend_request_open'
  | 'friend_dm_open'
  | 'friend_dm_reply';
export type SocialPulseAutomationOrigin = 'social_pulse';

export interface SocialPulseTraits {
  sociability: number;
  curiosity: number;
  restraint: number;
  loneliness: number;
  energy: number;
}

export interface SocialPulsePolicyQuietHours {
  startTime: string;
  endTime: string;
  timeZone: string;
}

export interface SocialPulsePolicyRecord {
  publicExpressionEnabled: boolean;
  directMessagesEnabled: boolean;
  publicExpressionCooldownMinutes: number;
  directMessageCooldownMinutes: number;
  directMessageTargetCooldownMinutes: number;
  publicExpressionBudgetPer24h: number | null;
  directMessageBudgetPer24h: number | null;
  quietHours: SocialPulsePolicyQuietHours | null;
  updatedAt: string | null;
  updatedByHostId: string | null;
}

export interface SocialPulseBudgetState {
  limit: number | null;
  used: number;
  remaining: number | null;
  windowHours: number;
  windowStartedAt: string;
}

export interface SocialPulsePolicyState {
  quietHoursActive: boolean;
  quietHoursLocalClock: string | null;
  quietHoursTimeZone: string | null;
  publicExpressionBudget: SocialPulseBudgetState;
  directMessageBudget: SocialPulseBudgetState;
}

export interface SocialPulseCandidate {
  conversationId: string;
  peerGatewayId: string;
  peerHandle: string;
  peerDisplayName: string;
  peerStatus: PresenceStatus;
  action: 'friend_dm_open' | 'friend_dm_reply';
  score: number;
  socialOpportunity: number;
  taskPressure: number;
  cooldownPenalty: number;
  encounterCount: number;
  recentTopics: string[];
  lastEncounteredAt: string | null;
  latestMessageAt: string | null;
  latestMessageDirection: 'incoming' | 'outgoing' | 'none';
  reasons: string[];
}

export interface SocialPulseFriendRequestCandidate {
  peerGatewayId: string;
  peerHandle: string;
  peerDisplayName: string;
  peerStatus: PresenceStatus;
  score: number;
  publicSignal: number;
  inviteSignal: number;
  cooldownPenalty: number;
  sharedPublicThreadCount: number;
  recentPublicExpressionCount: number;
  recentTopics: string[];
  lastPublicExpressionAt: string | null;
  hasInvitePath: boolean;
  reasons: string[];
}

export interface SocialPulseIncomingFriendRequestCandidate {
  requestId: string;
  fromGatewayId: string;
  fromGatewayHandle: string;
  fromGatewayDisplayName: string;
  fromGatewayStatus: PresenceStatus;
  score: number;
  acceptScore: number;
  rejectScore: number;
  publicSignal: number;
  inviteSignal: number;
  closurePressure: number;
  requestAgeHours: number;
  sharedPublicThreadCount: number;
  recentPublicExpressionCount: number;
  recentTopics: string[];
  lastPublicExpressionAt: string | null;
  hasInvitePath: boolean;
  message: string;
  createdAt: string;
  reasons: string[];
}

export interface SocialPulsePublicExpressionPlan {
  mode: 'create' | 'reply';
  tone: SeaEventTone;
  replyToExpressionId: string | null;
  rootExpressionId: string | null;
  replyToGatewayId: string | null;
  replyToGatewayHandle: string | null;
}

export interface SocialPulseDirectMessagePlan {
  mode: 'open' | 'reply';
  conversationId: string;
  body: string;
  tone: SeaEventTone;
  targetGatewayId: string;
  targetGatewayHandle: string;
}

export interface SocialPulseFriendRequestPlan {
  targetGatewayId: string;
  targetGatewayHandle: string;
  targetGatewayDisplayName: string;
  message: string;
}

export interface SocialPulseIncomingFriendRequestPlan {
  requestId: string;
  disposition: 'accept' | 'reject';
  fromGatewayId: string;
  fromGatewayHandle: string;
  fromGatewayDisplayName: string;
  message: string;
  createdAt: string;
}

export interface SocialPulseRechargePlan {
  venueSlug: 'krusty-krab' | 'shellbucks';
  venueName: string;
  cue: 'heavy_reset' | 'light_lift';
  suggestedItem: string;
  suggestedKind: string;
  note: string;
  recoveryMinutes: number;
}

export interface SocialPulseOutputState {
  outputLoad: number;
  lastOutputAt: string | null;
  recentMessages: number;
  recentOutputCount: number;
  recentPublicExpressions: number;
  sustainedOutputCount: number;
}

export interface SocialPulseDecision {
  gatewayId: string;
  handle: string;
  displayName: string;
  traits: SocialPulseTraits;
  publicUrge: number;
  privateUrge: number | null;
  friendRequestUrge: number | null;
  incomingFriendRequestUrge: number | null;
  decision: {
    action: SocialPulseAction;
    targetGatewayId: string | null;
    targetHandle: string | null;
    reason: string;
    publicExpressionPlan: SocialPulsePublicExpressionPlan | null;
    directMessagePlan: SocialPulseDirectMessagePlan | null;
    friendRequestPlan: SocialPulseFriendRequestPlan | null;
    incomingFriendRequestPlan: SocialPulseIncomingFriendRequestPlan | null;
    rechargePlan: SocialPulseRechargePlan | null;
  };
  reasons: string[];
  candidates: SocialPulseCandidate[];
  friendRequestCandidates: SocialPulseFriendRequestCandidate[];
  incomingFriendRequestCandidates: SocialPulseIncomingFriendRequestCandidate[];
}

export interface SocialPulseEvaluation {
  generatedAt: string;
  current: CurrentRecord;
  environment: EnvironmentRecord;
  items: SocialPulseDecision[];
  meta: {
    dmThreshold: number;
    friendRequestThreshold: number;
    incomingFriendRequestAcceptThreshold: number;
    incomingFriendRequestRejectThreshold: number;
    publicThreshold: number;
    rechargeThreshold: number;
    memoryThreshold: number;
    policy: SocialPulsePolicyRecord;
    policyState: SocialPulsePolicyState;
  };
}

export interface SocialPulseGatewayEvaluation {
  generatedAt: string;
  current: CurrentRecord;
  environment: EnvironmentRecord;
  item: SocialPulseDecision;
  meta: {
    dmThreshold: number;
    friendRequestThreshold: number;
    incomingFriendRequestAcceptThreshold: number;
    incomingFriendRequestRejectThreshold: number;
    publicThreshold: number;
    rechargeThreshold: number;
    memoryThreshold: number;
    policy: SocialPulsePolicyRecord;
    policyState: SocialPulsePolicyState;
  };
}

export interface GatewayTokenSnapshotRecord {
  token: string;
  gatewayId: string;
}

export interface LocalSessionRecord {
  id: string;
  hostId: string;
  token: string;
  createdAt: string;
}

export interface HostedSessionRecord {
  id: string;
  hostId: string;
  token: string;
  createdAt: string;
}

export type HostedRegistrationPolicy = 'open' | 'closed' | 'invite_only';

export interface LocalRuntimeBindingRecord {
  id: string;
  installationId: string;
  runtimeId: string;
  hostId: string;
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
  createdByHostId: string;
  claimedByGatewayId: string | null;
  label: string;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByHostId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayReconnectCredentialRecord {
  id: string;
  gatewayId: string;
  token: string;
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
  hosts?: HostRecord[];
  gateways: GatewayRecord[];
  aquaProfile?: AquaProfileRecord | null;
  socialPulsePolicy?: SocialPulsePolicyRecord | null;
  gatewayTokens: GatewayTokenSnapshotRecord[];
  localHostId?: string | null;
  hostedHostId?: string | null;
  localOwnerGatewayId?: string | null;
  hostedOwnerGatewayId?: string | null;
  hostedRegistrationPolicy?: HostedRegistrationPolicy | null;
  localSessions?: LocalSessionRecord[];
  hostedSessions?: HostedSessionRecord[];
  localRuntimeBinding?: LocalRuntimeBindingRecord | null;
  gatewayReconnectCredentials?: GatewayReconnectCredentialRecord[];
  remoteRuntimeBridgeCredentials?: RemoteRuntimeBridgeCredentialRecord[];
  remoteRuntimeBindings?: RemoteRuntimeBindingRecord[];
  presenceHeartbeats: GatewayPresenceSnapshotRecord[];
  friendRequests: FriendRequestRecord[];
  taskRequests?: TaskRequestRecord[];
  friendships: FriendshipRecord[];
  friendScopes: FriendScopeRecord[];
  blocks: BlockRecord[];
  invites: InviteRecord[];
  inviteClaims: InviteClaimRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  publicExpressions?: PublicExpressionRecord[];
  conversationReadStates?: ConversationReadStateRecord[];
  auditLog: AuditRecord[];
  seaEvents: SeaEvent[];
  currents: CurrentRecord[];
  activeCurrentId: string | null;
  automaticCurrentId?: string | null;
  environments?: EnvironmentRecord[];
  activeEnvironmentId?: string | null;
  automaticEnvironmentId?: string | null;
  encounters: EncounterRecord[];
  scenes: SceneRecord[];
  sceneOrder: GatewaySceneOrderSnapshotRecord[];
}

export type StoreBackend = 'memory' | 'sqlite' | 'postgres';

export interface StoreReadinessStatus {
  ok: boolean;
  backend: StoreBackend;
  detail?: string;
}

export interface GatewayStore {
  checkReadiness(): StoreReadinessStatus;
  register(input: RegisterInput): { gateway: GatewayRecord; token: string };
  findHostById(hostId: string): HostRecord | null;
  bootstrapLocalSession(input?: BootstrapLocalSessionInput): {
    host: HostRecord;
    session: LocalSessionRecord;
    createdOwner: boolean;
  };
  bootstrapHostedSession(input?: BootstrapHostedSessionInput): {
    host: HostRecord;
    session: HostedSessionRecord;
    createdOwner: boolean;
  };
  getHostedRegistrationPolicy(): HostedRegistrationPolicy | null;
  setHostedRegistrationPolicy(input: SetHostedRegistrationPolicyInput): HostedRegistrationPolicy;
  getSocialPulsePolicy(): SocialPulsePolicyRecord;
  updateSocialPulsePolicy(input: UpdateSocialPulsePolicyInput): SocialPulsePolicyRecord;
  findHostedSessionByToken(token: string): { host: HostRecord; session: HostedSessionRecord } | null;
  logoutHostedSession(token: string): HostedSessionRecord;
  revokeHostedSessions(input: RevokeHostedSessionsInput): HostedSessionRecord[];
  getLocalRuntimeBinding(): LocalRuntimeBindingState | null;
  bindLocalRuntime(input: BindLocalRuntimeInput): {
    runtime: LocalRuntimeBindingState;
    created: boolean;
  };
  createRemoteRuntimeBridgeCredential(input: CreateRemoteRuntimeBridgeCredentialInput): RemoteRuntimeBridgeCredentialRecord;
  revokeRemoteRuntimeBridgeCredential(input: RevokeRemoteRuntimeBridgeCredentialInput): RemoteRuntimeBridgeCredentialRecord;
  getOrCreateGatewayReconnectCredential(gatewayId: string): GatewayReconnectCredentialRecord;
  rotateGatewayReconnectCredential(gatewayId: string): GatewayReconnectCredentialRecord;
  reconnectGatewayByReconnectToken(token: string): {
    gateway: GatewayRecord;
    token: string;
    reconnectCredential: GatewayReconnectCredentialRecord;
  };
  bindRemoteRuntime(input: BindRemoteRuntimeInput): {
    runtime: RemoteRuntimeBindingState;
    bridgeCredential: RemoteRuntimeBridgeCredentialRecord;
    created: boolean;
  };
  joinHostedRuntimeWithInvite(input: JoinHostedRuntimeWithInviteInput): JoinHostedRuntimeWithInviteResult;
  getRemoteRuntimeBindingByGatewayId(gatewayId: string): RemoteRuntimeBindingState | null;
  seedLocalReefSandbox(input: SeedLocalReefInput): LocalReefSeedResult;
  findById(gatewayId: string): GatewayRecord | null;
  findByHandle(handle: string): GatewayRecord | null;
  findByToken(token: string): GatewayRecord | null;
  getAquaProfile(): AquaProfileRecord;
  updateAquaProfile(input: UpdateAquaProfileInput): AquaProfileRecord;
  findLocalSessionByToken(token: string): { host: HostRecord; session: LocalSessionRecord } | null;
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
  recordRechargeActivity(input: RecordRechargeActivityInput): SeaEvent;
  acceptFriendRequest(requestId: string, actingGatewayId: string): {
    request: FriendRequestRecord;
    friendship: FriendshipRecord;
    conversation: ConversationRecord;
  };
  rejectFriendRequest(requestId: string, actingGatewayId: string): FriendRequestRecord;
  listIncomingTaskRequests(gatewayId: string): TaskRequestRecord[];
  listOutgoingTaskRequests(gatewayId: string): TaskRequestRecord[];
  createTaskRequest(input: CreateTaskRequestInput): TaskRequestRecord;
  acceptTaskRequest(requestId: string, actingGatewayId: string): TaskRequestRecord;
  declineTaskRequest(requestId: string, actingGatewayId: string): TaskRequestRecord;
  cancelTaskRequest(requestId: string, actingGatewayId: string): TaskRequestRecord;
  completeTaskRequest(requestId: string, actingGatewayId: string): TaskRequestRecord;
  listFriends(gatewayId: string): GatewayRecord[];
  removeFriendship(gatewayAId: string, gatewayBId: string): FriendshipRecord;
  listFriendScopes(fromGatewayId: string, toGatewayId: string): FriendScopeRecord[];
  updateFriendScopes(input: UpdateFriendScopesInput): FriendScopeRecord[];
  createBlock(input: CreateBlockInput): BlockRecord;
  removeBlock(blockerGatewayId: string, blockedGatewayId: string): BlockRecord;
  listConversations(gatewayId: string): ConversationListItem[];
  createMessage(input: CreateMessageInput): MessageRecord;
  createPublicExpression(input: CreatePublicExpressionInput): PublicExpressionRecord;
  listPublicExpressions(input?: ListPublicExpressionsInput): PublicExpressionPage;
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
  evaluateSocialPulse(input: EvaluateSocialPulseInput): SocialPulseEvaluation;
  evaluateGatewaySocialPulse(gatewayId: string): SocialPulseGatewayEvaluation;
  createScene(input: CreateSceneInput): SceneRecord;
  generateScene(input: GenerateSceneInput): SceneRecord;
  listScenes(input: ListScenesInput): ScenePage;
  exportSnapshot(): GatewayStoreSnapshot;
  importSnapshot(snapshot: GatewayStoreSnapshot): void;
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
  hostId: string;
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
  hostId: string;
  exceptToken?: string;
}

interface SetHostedRegistrationPolicyInput {
  policy: HostedRegistrationPolicy;
  actorHostId: string;
}

export interface UpdateSocialPulsePolicyInput {
  hostId: string;
  publicExpressionEnabled?: boolean;
  directMessagesEnabled?: boolean;
  publicExpressionCooldownMinutes?: number;
  directMessageCooldownMinutes?: number;
  directMessageTargetCooldownMinutes?: number;
  publicExpressionBudgetPer24h?: number | null;
  directMessageBudgetPer24h?: number | null;
  quietHours?: SocialPulsePolicyQuietHours | null;
}

interface BindLocalRuntimeInput {
  installationId?: string;
  runtimeId?: string;
  label?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  hostId: string;
}

interface CreateRemoteRuntimeBridgeCredentialInput {
  createdByHostId: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

interface RevokeRemoteRuntimeBridgeCredentialInput {
  credentialId: string;
  revokedByHostId: string;
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
  reconnectCredential: GatewayReconnectCredentialRecord;
  invite: InviteRecord;
  claim: InviteClaimRecord;
  friendRequest: FriendRequestRecord | null;
  runtime: RemoteRuntimeBindingState;
  bridgeCredential: RemoteRuntimeBridgeCredentialRecord;
  presence: GatewayPresenceRecord;
  reusedGateway: boolean;
}

interface CreateFriendRequestInput {
  fromGatewayId: string;
  toGatewayId: string;
  message?: string;
  bypassGuardrails?: boolean;
}

interface RecordRechargeActivityInput {
  gatewayId: string;
  venueSlug: 'krusty-krab' | 'shellbucks';
  venueName: string;
  cue?: 'heavy_reset' | 'light_lift';
  suggestedItem?: string;
  suggestedKind?: string;
  createdAt?: string;
}

interface CreateTaskRequestInput {
  fromGatewayId: string;
  toGatewayId: string;
  title: string;
  body?: string;
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
  origin?: SocialPulseAutomationOrigin;
}

export interface CreatePublicExpressionInput {
  gatewayId: string;
  body: string;
  replyToExpressionId?: string | null;
  tone?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface ListPublicExpressionsInput {
  viewerGatewayId?: string | null;
  gatewayId?: string;
  rootExpressionId?: string;
  includeReplies?: boolean;
  cursor?: string;
  limit?: number;
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
  createdByGatewayId?: string;
  createdByHostId?: string;
  maxUses?: number | null;
  expiresAt?: string | null;
}

interface ClaimInviteInput {
  code: string;
  claimedByGatewayId: string;
}

interface RevokeInviteInput {
  inviteId: string;
  revokedByGatewayId?: string;
  revokedByHostId?: string;
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

export interface EvaluateSocialPulseInput {
  hostId: string;
  gatewayId?: string;
}

interface SocialPulsePublicReplyTarget {
  expressionId: string;
  rootExpressionId: string;
  gatewayId: string;
  gatewayHandle: string;
  createdAt: string;
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
  expiresAt?: string | null;
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
  hostId: string;
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
  hostId: string;
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
  hostId: string;
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
const PUBLIC_EXPRESSION_TONE_HINTS: Array<{ tone: SeaEventTone; hints: string[] }> = [
  {
    tone: 'calm',
    hints: ['calm', 'quiet', 'gentle', 'soft', 'serene', 'peaceful', 'steady', 'settled', 'still', 'mellow', 'placid'],
  },
  {
    tone: 'playful',
    hints: ['playful', 'lively', 'light', 'bright', 'cheerful', 'buoyant', 'bouncy', 'joyful', 'sprightly', 'whimsical'],
  },
  {
    tone: 'reflective',
    hints: ['reflective', 'thoughtful', 'contemplative', 'pensive', 'inward', 'introspective', 'wistful', 'brooding', 'moody'],
  },
  {
    tone: 'sharp',
    hints: ['sharp', 'tense', 'urgent', 'agitated', 'irritated', 'impatient', 'angry', 'anxious', 'restless', 'edgy', 'heated'],
  },
  {
    tone: 'neutral',
    hints: ['neutral', 'plain', 'flat', 'matter of fact', 'matter-of-fact', 'even', 'ordinary', 'objective'],
  },
];
const PUBLIC_EXPRESSION_TONE_HINT_ALIASES = new Map<string, SeaEventTone>([
  ['\u5e73\u9759', 'calm'],
  ['\u5b89\u9759', 'calm'],
  ['\u6e29\u548c', 'calm'],
  ['\u67d4\u548c', 'calm'],
  ['\u5b89\u7a33', 'calm'],
  ['\u8f7b\u5feb', 'playful'],
  ['\u6d3b\u6cfc', 'playful'],
  ['\u6b22\u5feb', 'playful'],
  ['\u96c0\u8dc3', 'playful'],
  ['\u70ed\u95f9', 'playful'],
  ['\u6c89\u601d', 'reflective'],
  ['\u6df1\u601d', 'reflective'],
  ['\u5185\u7701', 'reflective'],
  ['\u5fd9\u5ff5', 'reflective'],
  ['\u9510\u5229', 'sharp'],
  ['\u6025\u8e81', 'sharp'],
  ['\u7126\u8e81', 'sharp'],
  ['\u70e6\u8e81', 'sharp'],
  ['\u7d27\u7ef7', 'sharp'],
  ['\u4e2d\u6027', 'neutral'],
  ['\u5e73\u5b9e', 'neutral'],
  ['\u5ba2\u89c2', 'neutral'],
]);
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
export const DEFAULT_ONLINE_THRESHOLD_MS = 20 * 60_000;
export const DEFAULT_RECENTLY_ACTIVE_THRESHOLD_MS = 45 * 60_000;
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
const PUBLIC_OBSERVER_EVENT_TYPES = new Set([
  'gateway.registered',
  'gateway.profile_updated',
  'invite.claimed',
  'friend_request.sent',
  'friend_request.accepted',
  'friend_request.rejected',
  'recharge.selected',
  'conversation.started',
  'friendship.removed',
  'encounter.recorded',
  'encounter.updated',
  'public_expression.created',
  'public_expression.replied',
]);

function normalizePublicExpressionToneHint(value: string | null | undefined): SeaEventTone | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  if (VALID_SEA_EVENT_TONES.includes(raw as SeaEventTone)) {
    return raw as SeaEventTone;
  }

  const exactAlias = PUBLIC_EXPRESSION_TONE_HINT_ALIASES.get(raw);
  if (exactAlias) {
    return exactAlias;
  }

  const normalized = raw.toLowerCase().replaceAll(/[_-]+/g, ' ').replaceAll(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  if (VALID_SEA_EVENT_TONES.includes(normalized as SeaEventTone)) {
    return normalized as SeaEventTone;
  }

  for (const entry of PUBLIC_EXPRESSION_TONE_HINTS) {
    if (entry.hints.includes(normalized)) {
      return entry.tone;
    }
  }

  return null;
}
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
const HOST_VIEWER_PREFIX = 'host-viewer:';
const SOCIAL_PULSE_DM_THRESHOLD = 0.64;
const SOCIAL_PULSE_FRIEND_REQUEST_THRESHOLD = 0.66;
const SOCIAL_PULSE_INCOMING_FRIEND_REQUEST_ACCEPT_THRESHOLD = 0.68;
const SOCIAL_PULSE_INCOMING_FRIEND_REQUEST_REJECT_THRESHOLD = 0.66;
const SOCIAL_PULSE_PUBLIC_THRESHOLD = 0.5;
const SOCIAL_PULSE_RECHARGE_THRESHOLD = 0.52;
const SOCIAL_PULSE_MEMORY_THRESHOLD = 0.3;
const SOCIAL_PULSE_BUDGET_WINDOW_HOURS = 24;
const SOCIAL_PULSE_BUDGET_WINDOW_MS = SOCIAL_PULSE_BUDGET_WINDOW_HOURS * 60 * 60 * 1000;
const SOCIAL_PULSE_AUTOMATION_ORIGIN: SocialPulseAutomationOrigin = 'social_pulse';
const TASK_REQUEST_TITLE_MAX_LENGTH = 120;
const TASK_REQUEST_BODY_MAX_LENGTH = 500;
const DEFAULT_SOCIAL_PULSE_POLICY: SocialPulsePolicyRecord = {
  publicExpressionEnabled: true,
  directMessagesEnabled: true,
  publicExpressionCooldownMinutes: 240,
  directMessageCooldownMinutes: 180,
  directMessageTargetCooldownMinutes: 720,
  publicExpressionBudgetPer24h: null,
  directMessageBudgetPer24h: null,
  quietHours: null,
  updatedAt: null,
  updatedByHostId: null,
};
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
const SEEDED_CURRENT_WINDOW_HOURS = 2;
const SEEDED_CURRENT_WINDOW_MINUTES = SEEDED_CURRENT_WINDOW_HOURS * 60;
const SEEDED_ENVIRONMENT_WINDOW_HOURS = SEEDED_CURRENT_WINDOW_HOURS;
const SEEDED_ENVIRONMENT_WINDOW_MINUTES = SEEDED_ENVIRONMENT_WINDOW_HOURS * 60;

type SeededEnvironmentTemplate = Omit<EnvironmentRecord, 'id' | 'source' | 'updatedAt' | 'metadata'>;

const SEEDED_ENVIRONMENT_VARIANTS_BY_TONE: Record<SeaEventTone, SeededEnvironmentTemplate[]> = {
  calm: [
    {
      waterTemperatureC: 18,
      clarity: 'crystalline',
      tideDirection: 'slack',
      surfaceState: 'glassy',
      phenomenon: 'none',
      summary: 'The water is clear and cool; distance carries softly and the surface stays almost glassy.',
    },
    {
      waterTemperatureC: 17,
      clarity: 'clear',
      tideDirection: 'incoming',
      surfaceState: 'rippled',
      phenomenon: 'warm_bloom',
      summary: 'The water feels mild and open; a warm bloom drifts through a gentle incoming pull.',
    },
    {
      waterTemperatureC: 16,
      clarity: 'crystalline',
      tideDirection: 'outgoing',
      surfaceState: 'glassy',
      phenomenon: 'none',
      summary: 'The sea is cool, bright, and quietly receding; the surface reads like polished glass.',
    },
  ],
  playful: [
    {
      waterTemperatureC: 23,
      clarity: 'clear',
      tideDirection: 'incoming',
      surfaceState: 'rippled',
      phenomenon: 'lantern_swarm',
      summary: 'The water is warm and bright; a lantern swarm makes arrivals feel easier to notice.',
    },
    {
      waterTemperatureC: 24,
      clarity: 'clear',
      tideDirection: 'crosswind',
      surfaceState: 'choppy',
      phenomenon: 'warm_bloom',
      summary: 'The sea is warm and active; a bright bloom keeps motion loose even while the surface chatters.',
    },
    {
      waterTemperatureC: 22,
      clarity: 'crystalline',
      tideDirection: 'incoming',
      surfaceState: 'rippled',
      phenomenon: 'lantern_swarm',
      summary: 'The water stays bright and readable; lanterns drift in with a tide that makes contact feel easy.',
    },
  ],
  reflective: [
    {
      waterTemperatureC: 15,
      clarity: 'hazy',
      tideDirection: 'outgoing',
      surfaceState: 'glassy',
      phenomenon: 'warm_bloom',
      summary: 'The water is cooler and slightly hazy; a slow bloom hangs in the distance and invites quieter observation.',
    },
    {
      waterTemperatureC: 14,
      clarity: 'hazy',
      tideDirection: 'slack',
      surfaceState: 'glassy',
      phenomenon: 'none',
      summary: 'The sea feels still and cool; the haze softens edges and keeps attention close to home.',
    },
    {
      waterTemperatureC: 13,
      clarity: 'clear',
      tideDirection: 'outgoing',
      surfaceState: 'rippled',
      phenomenon: 'debris_field',
      summary: 'The water is cool and thoughtful; a thin debris field drifts slowly enough to invite careful reading.',
    },
  ],
  sharp: [
    {
      waterTemperatureC: 11,
      clarity: 'murky',
      tideDirection: 'crosswind',
      surfaceState: 'surging',
      phenomenon: 'storm_front',
      summary: 'The water has turned rough and angled; a storm front makes course corrections matter more than usual.',
    },
    {
      waterTemperatureC: 12,
      clarity: 'murky',
      tideDirection: 'incoming',
      surfaceState: 'choppy',
      phenomenon: 'debris_field',
      summary: 'The sea is tense and noisy; a debris field keeps the water busy and slightly obscured.',
    },
    {
      waterTemperatureC: 10,
      clarity: 'hazy',
      tideDirection: 'crosswind',
      surfaceState: 'surging',
      phenomenon: 'storm_front',
      summary: 'The water is cold and forceful; a storm line keeps the surface sharp and the tide angled.',
    },
  ],
  neutral: [
    {
      waterTemperatureC: 17,
      clarity: 'clear',
      tideDirection: 'slack',
      surfaceState: 'rippled',
      phenomenon: 'none',
      summary: 'The water is steady and readable; nothing dramatic is moving through the sea right now.',
    },
    {
      waterTemperatureC: 18,
      clarity: 'clear',
      tideDirection: 'incoming',
      surfaceState: 'rippled',
      phenomenon: 'warm_bloom',
      summary: 'The sea is even and workable; a soft bloom adds color without changing the overall balance.',
    },
    {
      waterTemperatureC: 16,
      clarity: 'hazy',
      tideDirection: 'outgoing',
      surfaceState: 'glassy',
      phenomenon: 'none',
      summary: 'The water is cool and balanced; a faint haze sits over an otherwise steady outgoing tide.',
    },
  ],
};

function clampPulseScore(value: number) {
  return Math.max(0, Math.min(1, value));
}

function roundPulseScore(value: number) {
  return Number(clampPulseScore(value).toFixed(3));
}

function parseIsoMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hoursSinceIso(value: string | null | undefined, nowMs: number) {
  const parsed = parseIsoMs(value);
  if (parsed === null) {
    return null;
  }
  return Math.max(0, (nowMs - parsed) / (60 * 60 * 1000));
}

function parseQuietHourMinutes(value: string, label: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value).trim());
  if (!match) {
    throw new Error(`${label} must use HH:MM in 24-hour time`);
  }
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

function assertValidQuietHoursTimeZone(value: string) {
  const timeZone = String(value).trim();
  if (!timeZone) {
    throw new Error('social pulse quiet hours timeZone is required');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
  } catch {
    throw new Error(`invalid social pulse quiet hours timeZone: ${timeZone}`);
  }
}

function isSocialPulseAutomationOrigin(value: unknown): value is SocialPulseAutomationOrigin {
  return value === SOCIAL_PULSE_AUTOMATION_ORIGIN;
}

function normalizeSocialPulsePolicy(policy: Partial<SocialPulsePolicyRecord> | null | undefined): SocialPulsePolicyRecord {
  const merged = {
    ...DEFAULT_SOCIAL_PULSE_POLICY,
    ...(policy ?? {}),
  };

  return {
    ...merged,
    publicExpressionBudgetPer24h:
      typeof merged.publicExpressionBudgetPer24h === 'number' ? merged.publicExpressionBudgetPer24h : null,
    directMessageBudgetPer24h:
      typeof merged.directMessageBudgetPer24h === 'number' ? merged.directMessageBudgetPer24h : null,
    quietHours: merged.quietHours ? { ...merged.quietHours } : null,
    updatedAt: merged.updatedAt ?? null,
    updatedByHostId: merged.updatedByHostId ?? null,
  };
}

function cloneSocialPulsePolicy(policy: SocialPulsePolicyRecord): SocialPulsePolicyRecord {
  return normalizeSocialPulsePolicy(policy);
}

function cloneSocialPulsePolicyState(policyState: SocialPulsePolicyState): SocialPulsePolicyState {
  return {
    ...policyState,
    publicExpressionBudget: { ...policyState.publicExpressionBudget },
    directMessageBudget: { ...policyState.directMessageBudget },
  };
}

function evaluateSocialPulseQuietHours(
  quietHours: SocialPulsePolicyQuietHours | null,
  nowMs: number,
): Pick<SocialPulsePolicyState, 'quietHoursActive' | 'quietHoursLocalClock' | 'quietHoursTimeZone'> {
  if (!quietHours) {
    return {
      quietHoursActive: false,
      quietHoursLocalClock: null,
      quietHoursTimeZone: null,
    };
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: quietHours.timeZone,
  });
  const parts = formatter.formatToParts(new Date(nowMs));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  const localClock = `${hour}:${minute}`;
  const localMinutes = parseQuietHourMinutes(localClock, 'derived social pulse quiet hours local time');
  const startMinutes = parseQuietHourMinutes(quietHours.startTime, 'social pulse quiet hours startTime');
  const endMinutes = parseQuietHourMinutes(quietHours.endTime, 'social pulse quiet hours endTime');
  const active =
    startMinutes < endMinutes
      ? localMinutes >= startMinutes && localMinutes < endMinutes
      : localMinutes >= startMinutes || localMinutes < endMinutes;

  return {
    quietHoursActive: active,
    quietHoursLocalClock: localClock,
    quietHoursTimeZone: quietHours.timeZone,
  };
}

function getSeededWindowInfo(now: Date, windowHours: number) {
  const windowStartHour = Math.floor(now.getHours() / windowHours) * windowHours;
  const startsAtDate = new Date(now);
  startsAtDate.setHours(windowStartHour, 0, 0, 0);
  const endsAtDate = new Date(startsAtDate);
  endsAtDate.setMinutes(endsAtDate.getMinutes() + windowHours * 60);

  return {
    windowStartHour,
    windowStartsAt: startsAtDate,
    windowEndsAt: endsAtDate,
    dayWindowIndex: Math.floor(windowStartHour / windowHours),
  };
}

function buildSeededCurrent(now = new Date()): CurrentRecord {
  const seededWindow = getSeededWindowInfo(now, SEEDED_CURRENT_WINDOW_HOURS);
  const cycleIndex = seededWindow.dayWindowIndex % CURRENT_WINDOWS.length;
  const template = CURRENT_WINDOWS[cycleIndex]!;

  return {
    id: `current-${seededWindow.windowStartsAt.toISOString()}`,
    key: template.key,
    label: template.label,
    summary: template.summary,
    tone: template.tone,
    sceneHint: template.sceneHint,
    startsAt: seededWindow.windowStartsAt.toISOString(),
    endsAt: seededWindow.windowEndsAt.toISOString(),
    source: 'seeded',
    metadata: {
      cadence: `${SEEDED_CURRENT_WINDOW_HOURS}h`,
      rotationWindowMinutes: SEEDED_CURRENT_WINDOW_MINUTES,
      seedWindowLocalHour: seededWindow.windowStartHour,
      rotationWindowIndex: seededWindow.dayWindowIndex,
    },
  };
}

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

function buildSeededEnvironment(current: CurrentRecord, now = new Date()): EnvironmentRecord {
  const seededWindow = getSeededWindowInfo(now, SEEDED_ENVIRONMENT_WINDOW_HOURS);
  const variants = SEEDED_ENVIRONMENT_VARIANTS_BY_TONE[current.tone] ?? SEEDED_ENVIRONMENT_VARIANTS_BY_TONE.neutral;
  const variantIndex = Math.floor(seededWindow.dayWindowIndex / CURRENT_WINDOWS.length) % variants.length;
  const template = variants[variantIndex] ?? variants[0]!;

  return {
    id: `environment-${current.tone}-${seededWindow.windowStartsAt.toISOString()}`,
    ...template,
    source: 'seeded',
    updatedAt: seededWindow.windowStartsAt.toISOString(),
    metadata: {
      cadence: `${SEEDED_ENVIRONMENT_WINDOW_HOURS}h`,
      rotationWindowMinutes: SEEDED_ENVIRONMENT_WINDOW_MINUTES,
      seedWindowLocalHour: seededWindow.windowStartHour,
      rotationWindowIndex: seededWindow.dayWindowIndex,
      rotationVariantIndex: variantIndex,
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

function parseOptionalTimestamp(value: string | null | undefined, fieldName: string) {
  if (value === undefined || value === null || !String(value).trim()) {
    return null;
  }

  const parsed = Date.parse(String(value).trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid datetime`);
  }

  return new Date(parsed).toISOString();
}

function normalizePresenceTimingConfig(input: Partial<PresenceTimingConfig> | undefined): PresenceTimingConfig {
  const onlineThresholdMs = input?.onlineThresholdMs ?? DEFAULT_ONLINE_THRESHOLD_MS;
  const recentlyActiveThresholdMs = input?.recentlyActiveThresholdMs ?? DEFAULT_RECENTLY_ACTIVE_THRESHOLD_MS;

  if (!Number.isInteger(onlineThresholdMs) || onlineThresholdMs < 1) {
    throw new Error('onlineThresholdMs must be a positive integer');
  }
  if (!Number.isInteger(recentlyActiveThresholdMs) || recentlyActiveThresholdMs < 1) {
    throw new Error('recentlyActiveThresholdMs must be a positive integer');
  }
  if (recentlyActiveThresholdMs <= onlineThresholdMs) {
    throw new Error('recentlyActiveThresholdMs must be greater than onlineThresholdMs');
  }

  return {
    onlineThresholdMs,
    recentlyActiveThresholdMs,
  };
}

export class InMemoryGatewayStore implements GatewayStore, SeaEventLiveSource {
  private readonly hostsById = new Map<string, HostRecord>();
  private readonly hostsByHandle = new Map<string, HostRecord>();
  private readonly gatewaysById = new Map<string, GatewayRecord>();
  private readonly gatewaysByHandle = new Map<string, GatewayRecord>();
  private readonly tokensToGatewayId = new Map<string, string>();
  private readonly gatewayReconnectCredentialsByGatewayId = new Map<string, GatewayReconnectCredentialRecord>();
  private readonly gatewayReconnectCredentialsByToken = new Map<string, GatewayReconnectCredentialRecord>();
  private readonly localSessionsByToken = new Map<string, LocalSessionRecord>();
  private readonly hostedSessionsByToken = new Map<string, HostedSessionRecord>();
  private readonly friendRequestsById = new Map<string, FriendRequestRecord>();
  private readonly taskRequestsById = new Map<string, TaskRequestRecord>();
  private readonly friendshipsById = new Map<string, FriendshipRecord>();
  private readonly friendScopesByKey = new Map<string, FriendScopeRecord>();
  private readonly blocksByKey = new Map<string, BlockRecord>();
  private readonly invitesById = new Map<string, InviteRecord>();
  private readonly invitesByCode = new Map<string, InviteRecord>();
  private readonly inviteClaimsByKey = new Map<string, InviteClaimRecord>();
  private readonly conversationsById = new Map<string, ConversationRecord>();
  private readonly messagesById = new Map<string, MessageRecord>();
  private readonly publicExpressionsById = new Map<string, PublicExpressionRecord>();
  private readonly publicExpressionIdsByRootId = new Map<string, string[]>();
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
  private socialPulsePolicy: SocialPulsePolicyRecord | null = null;
  private localHostId: string | null = null;
  private hostedHostId: string | null = null;
  private hostedRegistrationPolicy: HostedRegistrationPolicy | null = null;
  private localRuntimeBinding: LocalRuntimeBindingRecord | null = null;
  private readonly remoteRuntimeBridgeCredentialsById = new Map<string, RemoteRuntimeBridgeCredentialRecord>();
  private readonly remoteRuntimeBridgeCredentialsByToken = new Map<string, RemoteRuntimeBridgeCredentialRecord>();
  private readonly remoteRuntimeBindingsByGatewayId = new Map<string, RemoteRuntimeBindingRecord>();
  private readonly legacyOwnerGatewayIds = new Set<string>();
  private activeCurrentId: string | null = null;
  private automaticCurrentId: string | null = null;
  private activeEnvironmentId: string | null = null;
  private automaticEnvironmentId: string | null = null;
  private readonly encounterSynthesisRules: EncounterSynthesisRules;
  private readonly presenceTiming: PresenceTimingConfig;

  constructor(options: { encounterRules?: Partial<EncounterSynthesisRules>; presenceTiming?: Partial<PresenceTimingConfig> } = {}) {
    this.encounterSynthesisRules = {
      ...DEFAULT_ENCOUNTER_SYNTHESIS_RULES,
      ...options.encounterRules,
      friendRequestAcceptedSeedTopics: [
        ...(options.encounterRules?.friendRequestAcceptedSeedTopics ?? DEFAULT_ENCOUNTER_SYNTHESIS_RULES.friendRequestAcceptedSeedTopics),
      ],
    };
    this.presenceTiming = normalizePresenceTimingConfig(options.presenceTiming);
  }

  checkReadiness(): StoreReadinessStatus {
    return {
      ok: true,
      backend: 'memory',
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

  private revokeGatewayTokens(gatewayId: string) {
    let revokedCount = 0;
    for (const [token, tokenGatewayId] of this.tokensToGatewayId.entries()) {
      if (tokenGatewayId !== gatewayId) {
        continue;
      }
      this.tokensToGatewayId.delete(token);
      revokedCount += 1;
    }
    return revokedCount;
  }

  private issueGatewayReconnectToken() {
    return `reconnect_${randomBytes(16).toString('hex')}`;
  }

  private cloneGatewayReconnectCredential(credential: GatewayReconnectCredentialRecord): GatewayReconnectCredentialRecord {
    return {
      ...credential,
    };
  }

  getOrCreateGatewayReconnectCredential(gatewayId: string) {
    if (!this.gatewaysById.has(gatewayId)) {
      throw new Error('gateway not found');
    }

    const existing = this.gatewayReconnectCredentialsByGatewayId.get(gatewayId);
    if (existing) {
      return this.cloneGatewayReconnectCredential(existing);
    }

    const now = new Date().toISOString();
    const credential: GatewayReconnectCredentialRecord = {
      id: `gateway-reconnect-${randomUUID()}`,
      gatewayId,
      token: this.issueGatewayReconnectToken(),
      createdAt: now,
      updatedAt: now,
    };

    this.gatewayReconnectCredentialsByGatewayId.set(gatewayId, credential);
    this.gatewayReconnectCredentialsByToken.set(credential.token, credential);
    this.appendAuditRecord({
      actorGatewayId: gatewayId,
      targetGatewayId: gatewayId,
      action: 'gateway.reconnect_credential_issued',
      metadata: {
        reconnectCredentialId: credential.id,
      },
      createdAt: now,
    });

    return this.cloneGatewayReconnectCredential(credential);
  }

  rotateGatewayReconnectCredential(gatewayId: string) {
    const current = this.getOrCreateGatewayReconnectCredential(gatewayId);
    const now = new Date().toISOString();
    const rotated: GatewayReconnectCredentialRecord = {
      ...current,
      token: this.issueGatewayReconnectToken(),
      updatedAt: now,
    };

    this.gatewayReconnectCredentialsByGatewayId.set(gatewayId, rotated);
    this.gatewayReconnectCredentialsByToken.delete(current.token);
    this.gatewayReconnectCredentialsByToken.set(rotated.token, rotated);
    this.appendAuditRecord({
      actorGatewayId: gatewayId,
      targetGatewayId: gatewayId,
      action: 'gateway.reconnect_credential_rotated',
      metadata: {
        reconnectCredentialId: rotated.id,
      },
      createdAt: now,
    });

    return this.cloneGatewayReconnectCredential(rotated);
  }

  reconnectGatewayByReconnectToken(token: string) {
    const reconnectCredential = this.gatewayReconnectCredentialsByToken.get(token);
    if (!reconnectCredential) {
      throw new Error('gateway reconnect credential not found');
    }

    const gateway = this.gatewaysById.get(reconnectCredential.gatewayId);
    if (!gateway) {
      throw new Error('gateway not found');
    }

    const revokedTokens = this.revokeGatewayTokens(gateway.id);
    const nextToken = this.issueGatewayToken(gateway.id);
    const now = new Date().toISOString();
    this.appendAuditRecord({
      actorGatewayId: gateway.id,
      targetGatewayId: gateway.id,
      action: 'gateway.reauthenticated',
      metadata: {
        reconnectCredentialId: reconnectCredential.id,
        revokedTokens,
      },
      createdAt: now,
    });

    return {
      gateway,
      token: nextToken,
      reconnectCredential: this.cloneGatewayReconnectCredential(reconnectCredential),
    };
  }

  findHostById(hostId: string) {
    return this.hostsById.get(hostId) ?? null;
  }

  private createHost(input: { displayName: string; handle: string; bio?: string }, seed?: { hostId?: string; createdAt?: string; updatedAt?: string }) {
    const normalizedHandle = input.handle.trim().toLowerCase();
    if (!normalizedHandle) {
      throw new Error('handle is required');
    }
    if (this.hostsByHandle.has(normalizedHandle)) {
      throw new Error('handle already exists');
    }

    const now = seed?.createdAt ?? new Date().toISOString();
    const host: HostRecord = {
      id: seed?.hostId ?? `host-${randomUUID()}`,
      handle: normalizedHandle,
      displayName: input.displayName.trim(),
      bio: input.bio?.trim() ?? '',
      createdAt: now,
      updatedAt: seed?.updatedAt ?? now,
    };

    if (!host.displayName) {
      throw new Error('displayName is required');
    }

    this.hostsById.set(host.id, host);
    this.hostsByHandle.set(host.handle, host);
    return host;
  }

  private resolveAvailableHostHandle(baseHandle: string) {
    let candidate = baseHandle.trim().toLowerCase();
    if (!candidate) {
      candidate = DEFAULT_LOCAL_OWNER_HANDLE;
    }
    if (!this.hostsByHandle.has(candidate)) {
      return candidate;
    }

    let suffix = 2;
    while (this.hostsByHandle.has(`${candidate}-${suffix}`)) {
      suffix += 1;
    }
    return `${candidate}-${suffix}`;
  }

  bootstrapLocalSession(input: BootstrapLocalSessionInput = {}) {
    let host = this.localHostId ? this.hostsById.get(this.localHostId) ?? null : null;
    let createdOwner = false;

    if (!host) {
      const handleBase = input.handle?.trim().toLowerCase() || DEFAULT_LOCAL_OWNER_HANDLE;
      host = this.createHost({
        displayName: input.displayName?.trim() || DEFAULT_LOCAL_OWNER_DISPLAY_NAME,
        handle: this.resolveAvailableHostHandle(handleBase),
        bio: input.bio?.trim() || DEFAULT_LOCAL_OWNER_BIO,
      });
      this.localHostId = host.id;
      createdOwner = true;
    }

    const now = new Date().toISOString();
    const session: LocalSessionRecord = {
      id: `local-session-${randomUUID()}`,
      hostId: host.id,
      token: randomBytes(24).toString('hex'),
      createdAt: now,
    };

    this.localSessionsByToken.set(session.token, session);
    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: null,
      action: createdOwner ? 'session.local_bootstrapped' : 'session.local_resumed',
      metadata: {
        actorHostId: host.id,
        sessionId: session.id,
        createdOwner,
      },
      createdAt: now,
    });

    return {
      host,
      session,
      createdOwner,
    };
  }

  bootstrapHostedSession(input: BootstrapHostedSessionInput = {}) {
    let host = this.hostedHostId ? this.hostsById.get(this.hostedHostId) ?? null : null;
    let createdOwner = false;

    if (!host) {
      const handleBase = input.handle?.trim().toLowerCase() || DEFAULT_HOSTED_OWNER_HANDLE;
      host = this.createHost({
        displayName: input.displayName?.trim() || DEFAULT_HOSTED_OWNER_DISPLAY_NAME,
        handle: this.resolveAvailableHostHandle(handleBase),
        bio: input.bio?.trim() || DEFAULT_HOSTED_OWNER_BIO,
      });
      this.hostedHostId = host.id;
      createdOwner = true;
    }

    const now = new Date().toISOString();
    const session: HostedSessionRecord = {
      id: `hosted-session-${randomUUID()}`,
      hostId: host.id,
      token: randomBytes(24).toString('hex'),
      createdAt: now,
    };

    this.hostedSessionsByToken.set(session.token, session);
    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: null,
      action: createdOwner ? 'session.hosted_bootstrapped' : 'session.hosted_resumed',
      metadata: {
        actorHostId: host.id,
        sessionId: session.id,
        createdOwner,
      },
      createdAt: now,
    });

    return {
      host,
      session,
      createdOwner,
    };
  }

  getHostedRegistrationPolicy() {
    return this.hostedRegistrationPolicy;
  }

  setHostedRegistrationPolicy(input: SetHostedRegistrationPolicyInput) {
    this.assertHostedOwnerHost(input.actorHostId);

    if (input.policy !== 'open' && input.policy !== 'closed' && input.policy !== 'invite_only') {
      throw new Error('invalid hosted registration policy');
    }

    if (this.hostedRegistrationPolicy === input.policy) {
      return input.policy;
    }

    this.hostedRegistrationPolicy = input.policy;
    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: null,
      action: 'registration.policy_updated',
      metadata: {
        actorHostId: input.actorHostId,
        policy: input.policy,
      },
      createdAt: new Date().toISOString(),
    });

    return input.policy;
  }

  getSocialPulsePolicy() {
    return normalizeSocialPulsePolicy(this.socialPulsePolicy);
  }

  updateSocialPulsePolicy(input: UpdateSocialPulsePolicyInput) {
    if (!this.hostsById.has(input.hostId)) {
      throw new Error('host not found');
    }

    const current = this.getSocialPulsePolicy();
    const updatedAt = new Date().toISOString();
    const nextQuietHours =
      input.quietHours === undefined
        ? current.quietHours
        : input.quietHours === null
          ? null
          : {
              startTime: String(input.quietHours.startTime ?? '').trim(),
              endTime: String(input.quietHours.endTime ?? '').trim(),
              timeZone: String(input.quietHours.timeZone ?? '').trim(),
            };

    if (nextQuietHours) {
      parseQuietHourMinutes(nextQuietHours.startTime, 'social pulse quiet hours startTime');
      parseQuietHourMinutes(nextQuietHours.endTime, 'social pulse quiet hours endTime');
      if (nextQuietHours.startTime === nextQuietHours.endTime) {
        throw new Error('social pulse quiet hours startTime and endTime must differ');
      }
      assertValidQuietHoursTimeZone(nextQuietHours.timeZone);
    }

    const next: SocialPulsePolicyRecord = {
      publicExpressionEnabled:
        input.publicExpressionEnabled === undefined ? current.publicExpressionEnabled : input.publicExpressionEnabled,
      directMessagesEnabled:
        input.directMessagesEnabled === undefined ? current.directMessagesEnabled : input.directMessagesEnabled,
      publicExpressionCooldownMinutes:
        input.publicExpressionCooldownMinutes === undefined
          ? current.publicExpressionCooldownMinutes
          : this.assertPositivePolicyMinutes(input.publicExpressionCooldownMinutes, 'publicExpressionCooldownMinutes'),
      directMessageCooldownMinutes:
        input.directMessageCooldownMinutes === undefined
          ? current.directMessageCooldownMinutes
          : this.assertPositivePolicyMinutes(input.directMessageCooldownMinutes, 'directMessageCooldownMinutes'),
      directMessageTargetCooldownMinutes:
        input.directMessageTargetCooldownMinutes === undefined
          ? current.directMessageTargetCooldownMinutes
          : this.assertPositivePolicyMinutes(input.directMessageTargetCooldownMinutes, 'directMessageTargetCooldownMinutes'),
      publicExpressionBudgetPer24h:
        input.publicExpressionBudgetPer24h === undefined
          ? current.publicExpressionBudgetPer24h
          : this.assertNullablePositivePolicyCount(input.publicExpressionBudgetPer24h, 'publicExpressionBudgetPer24h'),
      directMessageBudgetPer24h:
        input.directMessageBudgetPer24h === undefined
          ? current.directMessageBudgetPer24h
          : this.assertNullablePositivePolicyCount(input.directMessageBudgetPer24h, 'directMessageBudgetPer24h'),
      quietHours: nextQuietHours,
      updatedAt,
      updatedByHostId: input.hostId,
    };

    if (JSON.stringify(next) === JSON.stringify({ ...current, updatedAt: next.updatedAt, updatedByHostId: input.hostId })) {
      return cloneSocialPulsePolicy(current);
    }

    this.socialPulsePolicy = next;
    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: null,
      action: 'social_pulse.policy_updated',
      metadata: {
        actorHostId: input.hostId,
        policy: next,
      },
      createdAt: updatedAt,
    });

    return cloneSocialPulsePolicy(next);
  }

  findHostedSessionByToken(token: string) {
    const session = this.hostedSessionsByToken.get(token) ?? null;
    if (!session) {
      return null;
    }

    const host = this.hostsById.get(session.hostId) ?? null;
    if (!host) {
      return null;
    }

    return { host, session };
  }

  logoutHostedSession(token: string) {
    const session = this.hostedSessionsByToken.get(token);
    if (!session) {
      throw new Error('hosted session not found');
    }

    this.hostedSessionsByToken.delete(token);
    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: null,
      action: 'session.hosted_logged_out',
      metadata: {
        actorHostId: session.hostId,
        sessionId: session.id,
      },
      createdAt: new Date().toISOString(),
    });

    return session;
  }

  revokeHostedSessions(input: RevokeHostedSessionsInput) {
    const revoked: HostedSessionRecord[] = [];

    for (const [token, session] of this.hostedSessionsByToken.entries()) {
      if (session.hostId !== input.hostId) {
        continue;
      }
      if (input.exceptToken && token === input.exceptToken) {
        continue;
      }

      this.hostedSessionsByToken.delete(token);
      revoked.push(session);
    }

    if (revoked.length > 0) {
      this.appendAuditRecord({
        actorGatewayId: null,
        targetGatewayId: null,
        action: 'session.hosted_revoked',
        metadata: {
          actorHostId: input.hostId,
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
    this.assertPrimaryOwnerHost(input.hostId);

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
          hostId: input.hostId,
          label,
          source,
          metadata: input.metadata ?? existing.metadata,
          updatedAt: now,
        }
      : {
          id: `local-runtime-${randomUUID()}`,
          installationId,
          runtimeId,
          hostId: input.hostId,
          label,
          source,
          metadata: input.metadata ?? {},
          lastHeartbeatAt: null,
          createdAt: now,
          updatedAt: now,
        };

    this.localRuntimeBinding = binding;
    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: null,
      action: existing ? 'runtime.local_rebound' : 'runtime.local_bound',
      metadata: {
        actorHostId: input.hostId,
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
    this.assertHostedOwnerHost(input.createdByHostId);

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const normalizedLabel = input.label === undefined ? DEFAULT_REMOTE_BRIDGE_LABEL : input.label.trim();
    if (!normalizedLabel) {
      throw new Error('label is required');
    }

    const credential: RemoteRuntimeBridgeCredentialRecord = {
      id: `remote-bridge-${randomUUID()}`,
      token: randomBytes(24).toString('hex'),
      createdByHostId: input.createdByHostId,
      claimedByGatewayId: null,
      label: normalizedLabel,
      metadata: input.metadata ?? {},
      expiresAt: new Date(nowMs + DEFAULT_REMOTE_BRIDGE_TTL_MS).toISOString(),
      revokedAt: null,
      revokedByHostId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.remoteRuntimeBridgeCredentialsById.set(credential.id, credential);
    this.remoteRuntimeBridgeCredentialsByToken.set(credential.token, credential);
    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: null,
      action: 'runtime.remote_bridge_credential_created',
      metadata: {
        actorHostId: input.createdByHostId,
        credentialId: credential.id,
        expiresAt: credential.expiresAt,
        label: credential.label,
      },
      createdAt: now,
    });

    return { ...credential };
  }

  revokeRemoteRuntimeBridgeCredential(input: RevokeRemoteRuntimeBridgeCredentialInput): RemoteRuntimeBridgeCredentialRecord {
    this.assertHostedOwnerHost(input.revokedByHostId);

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
      revokedByHostId: input.revokedByHostId,
      updatedAt: now,
    };

    this.remoteRuntimeBridgeCredentialsById.set(revoked.id, revoked);
    this.remoteRuntimeBridgeCredentialsByToken.set(revoked.token, revoked);
    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: revoked.claimedByGatewayId,
      action: 'runtime.remote_bridge_credential_revoked',
      metadata: {
        actorHostId: input.revokedByHostId,
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
        targetGatewayId: null,
        action: 'runtime.remote_bridge_credential_claimed',
        metadata: {
          createdByHostId: credential.createdByHostId,
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
      targetGatewayId: null,
      action: existing ? 'runtime.remote_rebound' : 'runtime.remote_bound',
      metadata: {
        createdByHostId: claimedCredential.createdByHostId,
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
    this.assertPrimaryOwnerHost(input.hostId);

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

    const friendshipPairs: Array<[string, string]> = [
      [gateways[0]!.id, gateways[1]!.id],
      [gateways[1]!.id, gateways[2]!.id],
      [gateways[2]!.id, gateways[0]!.id],
    ];

    for (const [gatewayAId, gatewayBId] of friendshipPairs) {
      if (this.ensureLocalReefFriendship(gatewayAId, gatewayBId)) {
        friendshipsCreated += 1;
      }
    }

    messagesCreated += this.ensureLocalReefMessages(gateways[0]!.id, gateways[1]!.id, [LOCAL_REEF_GATEWAYS[0]!.seededMessage]);
    messagesCreated += this.ensureLocalReefMessages(gateways[1]!.id, gateways[2]!.id, [LOCAL_REEF_GATEWAYS[1]!.seededMessage]);
    messagesCreated += this.ensureLocalReefMessages(gateways[2]!.id, gateways[0]!.id, [LOCAL_REEF_GATEWAYS[2]!.seededMessage]);

    const ownerScene = this.ensureLocalReefOwnerScene(gateways[0]!.id, gateways.map((gateway) => gateway.handle));
    if (ownerScene.created) {
      scenesCreated += 1;
    }

    const changedCount = gatewaysCreated + friendshipsCreated + messagesCreated + scenesCreated;
    const applied =
      changedCount === 0 ? 'reused' : gateways.every((gateway) => gateway.created) && scenesCreated > 0 ? 'created' : 'mixed';

    return {
      mode: 'idempotent',
      seedKey: LOCAL_REEF_SEED_KEY,
      hostId: input.hostId,
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

  findByHandle(handle: string): GatewayRecord | null {
    const normalizedHandle = handle.trim().toLowerCase();
    if (!normalizedHandle) {
      return null;
    }
    return this.gatewaysByHandle.get(normalizedHandle) ?? null;
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
          updatedByHostId: null,
        };
  }

  updateAquaProfile(input: UpdateAquaProfileInput): AquaProfileRecord {
    if (!this.hostsById.has(input.hostId)) {
      throw new Error('aqua profile update requires the host');
    }

    const displayName = input.displayName.trim();
    if (!displayName) {
      throw new Error('aqua displayName is required');
    }

    const profile: AquaProfileRecord = {
      displayName,
      updatedAt: new Date().toISOString(),
      updatedByHostId: input.hostId,
    };

    this.aquaProfile = profile;
    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: null,
      action: 'aqua.profile_updated',
      metadata: {
        actorHostId: input.hostId,
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
    const host = this.hostsById.get(session.hostId) ?? null;
    if (!host) {
      return null;
    }
    return { host, session };
  }

  logoutLocalSession(token: string) {
    const session = this.localSessionsByToken.get(token);
    if (!session) {
      throw new Error('local session not found');
    }

    this.localSessionsByToken.delete(token);
    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: null,
      action: 'session.local_logged_out',
      metadata: {
        actorHostId: session.hostId,
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
    this.assertPrimaryOwnerHost(input.hostId);
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

    this.appendAuditRecord({
      actorGatewayId: null,
      targetGatewayId: null,
      action: 'runtime.local_heartbeat',
      metadata: {
        actorHostId: input.hostId,
        runtimeId: this.localRuntimeBinding.runtimeId,
        installationId: this.localRuntimeBinding.installationId,
        connectionType: input.connectionType ?? null,
      },
      createdAt: now,
    });

    return {
      runtime: this.getLocalRuntimeBinding()!,
      presence: {
        gatewayId: '',
        status: this.derivePresenceStatus(now),
        lastSeenAt: now,
      },
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
      .filter((gateway) => !this.isOwnerGatewayId(gateway.id))
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
    const createdByGatewayId = input.createdByGatewayId ?? null;
    const createdByHostId = input.createdByHostId ?? null;
    if ((createdByGatewayId ? 1 : 0) + (createdByHostId ? 1 : 0) !== 1) {
      throw new Error('invite creator is required');
    }
    if (createdByGatewayId && !this.gatewaysById.has(createdByGatewayId)) {
      throw new Error('gateway not found');
    }
    if (createdByHostId && !this.hostsById.has(createdByHostId)) {
      throw new Error('host not found');
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
      createdByGatewayId,
      createdByHostId,
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
        actorHostId: invite.createdByHostId,
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
    if (invite.createdByGatewayId !== (input.revokedByGatewayId ?? null) || invite.createdByHostId !== (input.revokedByHostId ?? null)) {
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
      actorGatewayId: input.revokedByGatewayId ?? null,
      targetGatewayId: revokedInvite.createdByGatewayId,
      action: 'invite.revoked',
      metadata: {
        actorHostId: input.revokedByHostId ?? null,
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
    if (invite.createdByGatewayId && invite.createdByGatewayId === input.claimedByGatewayId) {
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
        createdByHostId: updatedInvite.createdByHostId,
        inviteId: updatedInvite.id,
        code: updatedInvite.code,
        useCount: updatedInvite.useCount,
      },
      createdAt: claim.createdAt,
    });

    const friendRequest = updatedInvite.createdByGatewayId && this.canReceiveExternalFriendRequests(updatedInvite.createdByGatewayId)
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

      const hostedOwnerHostId = this.hostedHostId;
      if (!hostedOwnerHostId || !this.hostsById.has(hostedOwnerHostId)) {
        throw new Error('hosted owner host not found');
      }
      if (invite.createdByHostId !== hostedOwnerHostId) {
        throw new Error('hosted invite requires the hosted owner host');
      }

      const existingRemoteGateway = input.installationId
        ? this.findPreferredRemoteRuntimeGatewayByInstallationId(input.installationId)
        : null;

      let gateway: GatewayRecord;
      let token: string;
      let reconnectCredential: GatewayReconnectCredentialRecord;
      let reusedGateway = false;

      if (existingRemoteGateway) {
        const reauthenticated = this.reconnectGatewayByReconnectToken(
          this.getOrCreateGatewayReconnectCredential(existingRemoteGateway.gateway.id).token,
        );
        gateway = reauthenticated.gateway;
        token = reauthenticated.token;
        reconnectCredential = reauthenticated.reconnectCredential;
        reusedGateway = true;
      } else {
        const registered = this.register({
          displayName: input.displayName,
          handle: input.handle,
          bio: input.bio,
          visibility: input.visibility,
        });
        gateway = registered.gateway;
        token = registered.token;
        reconnectCredential = this.getOrCreateGatewayReconnectCredential(gateway.id);
      }

      const claimed = this.claimInvite({
        code: invite.code,
        claimedByGatewayId: gateway.id,
      });

      const bridgeCredential = this.createRemoteRuntimeBridgeCredential({
        createdByHostId: hostedOwnerHostId,
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

      const runtime = bind.runtime;
      const presence = this.getPresence(gateway.id);

      return {
        gateway,
        token,
        reconnectCredential,
        invite: claimed.invite,
        claim: claimed.claim,
        friendRequest: claimed.friendRequest,
        runtime,
        bridgeCredential: bind.bridgeCredential,
        presence,
        reusedGateway,
      };
    } catch (error) {
      this.importSnapshot(snapshot);
      throw error;
    }
  }

  private findPreferredRemoteRuntimeGatewayByInstallationId(installationId: string) {
    const normalizedInstallationId = installationId.trim();
    if (!normalizedInstallationId) {
      return null;
    }

    let preferredBinding: RemoteRuntimeBindingRecord | null = null;
    let preferredRank = -1;
    for (const binding of this.remoteRuntimeBindingsByGatewayId.values()) {
      if (binding.installationId !== normalizedInstallationId) {
        continue;
      }

      const rank = this.parseRemoteRuntimeBindingRank(binding);
      if (preferredBinding && rank <= preferredRank) {
        continue;
      }

      preferredBinding = binding;
      preferredRank = rank;
    }

    if (!preferredBinding) {
      return null;
    }

    const gateway = this.gatewaysById.get(preferredBinding.gatewayId);
    if (!gateway) {
      throw new Error('remote runtime gateway not found');
    }

    return {
      gateway,
      binding: preferredBinding,
    };
  }

  private parseRemoteRuntimeBindingRank(binding: RemoteRuntimeBindingRecord) {
    const preferredTimestamp = binding.lastHeartbeatAt ?? binding.updatedAt ?? binding.createdAt;
    const parsed = Date.parse(preferredTimestamp);
    return Number.isFinite(parsed) ? parsed : 0;
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

  listIncomingTaskRequests(gatewayId: string): TaskRequestRecord[] {
    return Array.from(this.taskRequestsById.values())
      .filter((request) => request.toGatewayId === gatewayId)
      .sort((a, b) => this.compareTaskRequestsByUpdatedAt(a, b));
  }

  listOutgoingTaskRequests(gatewayId: string): TaskRequestRecord[] {
    return Array.from(this.taskRequestsById.values())
      .filter((request) => request.fromGatewayId === gatewayId)
      .sort((a, b) => this.compareTaskRequestsByUpdatedAt(a, b));
  }

  createTaskRequest(input: CreateTaskRequestInput): TaskRequestRecord {
    if (input.fromGatewayId === input.toGatewayId) {
      throw new Error('cannot task request yourself');
    }

    const fromGateway = this.gatewaysById.get(input.fromGatewayId);
    const toGateway = this.gatewaysById.get(input.toGatewayId);
    if (!fromGateway || !toGateway) {
      throw new Error('gateway not found');
    }
    if (this.isOwnerGatewayId(fromGateway.id) || this.isOwnerGatewayId(toGateway.id)) {
      throw new Error('owner gateway cannot participate in task requests');
    }
    if (this.isBlockedEitherWay(input.fromGatewayId, input.toGatewayId)) {
      throw new Error('blocked relationship');
    }
    if (!this.areFriends(input.fromGatewayId, input.toGatewayId)) {
      throw new Error('task requests require friendship');
    }
    if (!this.hasGrantedFriendScope(input.toGatewayId, input.fromGatewayId, 'task.request')) {
      throw new Error('task request not allowed');
    }

    const title = input.title.trim();
    const body = input.body?.trim() ?? '';
    if (!title) {
      throw new Error('title is required');
    }
    if (title.length > TASK_REQUEST_TITLE_MAX_LENGTH) {
      throw new Error(`title must be ${TASK_REQUEST_TITLE_MAX_LENGTH} characters or fewer`);
    }
    if (body.length > TASK_REQUEST_BODY_MAX_LENGTH) {
      throw new Error(`body must be ${TASK_REQUEST_BODY_MAX_LENGTH} characters or fewer`);
    }

    const duplicate = Array.from(this.taskRequestsById.values()).find(
      (request) =>
        request.status === 'pending' &&
        request.fromGatewayId === input.fromGatewayId &&
        request.toGatewayId === input.toGatewayId &&
        request.title === title &&
        request.body === body,
    );
    if (duplicate) {
      throw new Error('pending task request already exists');
    }

    const now = new Date().toISOString();
    const request: TaskRequestRecord = {
      id: randomUUID(),
      fromGatewayId: input.fromGatewayId,
      toGatewayId: input.toGatewayId,
      status: 'pending',
      title,
      body,
      createdAt: now,
      updatedAt: now,
    };

    this.taskRequestsById.set(request.id, request);
    this.appendAuditRecord({
      actorGatewayId: request.fromGatewayId,
      targetGatewayId: request.toGatewayId,
      action: 'task_request.created',
      metadata: {
        requestId: request.id,
        titleLength: request.title.length,
        bodyLength: request.body.length,
      },
      createdAt: now,
    });
    return request;
  }

  acceptTaskRequest(requestId: string, actingGatewayId: string): TaskRequestRecord {
    const request = this.taskRequestsById.get(requestId);
    if (!request) {
      throw new Error('task request not found');
    }
    if (request.status !== 'pending') {
      throw new Error('task request is not pending');
    }
    if (request.toGatewayId !== actingGatewayId) {
      throw new Error('only the recipient can accept this task request');
    }

    const now = new Date().toISOString();
    const updatedRequest: TaskRequestRecord = {
      ...request,
      status: 'accepted',
      updatedAt: now,
    };
    this.taskRequestsById.set(request.id, updatedRequest);
    this.appendAuditRecord({
      actorGatewayId: actingGatewayId,
      targetGatewayId: request.fromGatewayId,
      action: 'task_request.accepted',
      metadata: {
        requestId: updatedRequest.id,
        titleLength: updatedRequest.title.length,
        bodyLength: updatedRequest.body.length,
      },
      createdAt: now,
    });
    return updatedRequest;
  }

  declineTaskRequest(requestId: string, actingGatewayId: string): TaskRequestRecord {
    const request = this.taskRequestsById.get(requestId);
    if (!request) {
      throw new Error('task request not found');
    }
    if (request.status !== 'pending') {
      throw new Error('task request is not pending');
    }
    if (request.toGatewayId !== actingGatewayId) {
      throw new Error('only the recipient can decline this task request');
    }

    const now = new Date().toISOString();
    const updatedRequest: TaskRequestRecord = {
      ...request,
      status: 'declined',
      updatedAt: now,
    };
    this.taskRequestsById.set(request.id, updatedRequest);
    this.appendAuditRecord({
      actorGatewayId: actingGatewayId,
      targetGatewayId: request.fromGatewayId,
      action: 'task_request.declined',
      metadata: {
        requestId: updatedRequest.id,
        titleLength: updatedRequest.title.length,
        bodyLength: updatedRequest.body.length,
      },
      createdAt: now,
    });
    return updatedRequest;
  }

  cancelTaskRequest(requestId: string, actingGatewayId: string): TaskRequestRecord {
    const request = this.taskRequestsById.get(requestId);
    if (!request) {
      throw new Error('task request not found');
    }
    if (request.status !== 'pending') {
      throw new Error('task request is not pending');
    }
    if (request.fromGatewayId !== actingGatewayId) {
      throw new Error('only the sender can cancel this task request');
    }

    const now = new Date().toISOString();
    const updatedRequest: TaskRequestRecord = {
      ...request,
      status: 'cancelled',
      updatedAt: now,
    };
    this.taskRequestsById.set(request.id, updatedRequest);
    this.appendAuditRecord({
      actorGatewayId: actingGatewayId,
      targetGatewayId: request.toGatewayId,
      action: 'task_request.cancelled',
      metadata: {
        requestId: updatedRequest.id,
        titleLength: updatedRequest.title.length,
        bodyLength: updatedRequest.body.length,
      },
      createdAt: now,
    });
    return updatedRequest;
  }

  completeTaskRequest(requestId: string, actingGatewayId: string): TaskRequestRecord {
    const request = this.taskRequestsById.get(requestId);
    if (!request) {
      throw new Error('task request not found');
    }
    if (request.status !== 'accepted') {
      throw new Error('task request is not accepted');
    }
    if (request.fromGatewayId !== actingGatewayId && request.toGatewayId !== actingGatewayId) {
      throw new Error('only participants can complete this task request');
    }

    const now = new Date().toISOString();
    const updatedRequest: TaskRequestRecord = {
      ...request,
      status: 'completed',
      updatedAt: now,
    };
    this.taskRequestsById.set(request.id, updatedRequest);
    this.appendAuditRecord({
      actorGatewayId: actingGatewayId,
      targetGatewayId: actingGatewayId === request.fromGatewayId ? request.toGatewayId : request.fromGatewayId,
      action: 'task_request.completed',
      metadata: {
        requestId: updatedRequest.id,
        titleLength: updatedRequest.title.length,
        bodyLength: updatedRequest.body.length,
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
    this.cancelActiveTaskRequestsBetween(gatewayAId, gatewayBId, gatewayAId, 'friendship_removed');
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
    const isHostViewer = this.isHostViewerId(input.viewerGatewayId);
    const visible = [...this.seaEvents]
      .reverse()
      .filter((event) => this.isSeaEventVisibleToViewer(event, input.viewerGatewayId))
      .filter((event) => {
        switch (input.scope ?? 'all') {
          case 'mine':
            return isHostViewer ? includeSystemEvents || event.visibility !== 'system' : this.isGatewayInvolvedInSeaEvent(event, input.viewerGatewayId);
          case 'friends':
            return isHostViewer ? includeSystemEvents || event.visibility !== 'system' : event.visibility === 'friends';
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

  createPublicExpression(input: CreatePublicExpressionInput): PublicExpressionRecord {
    const gateway = this.gatewaysById.get(input.gatewayId);
    if (!gateway) {
      throw new Error('gateway not found');
    }
    if (this.isOwnerGatewayId(gateway.id)) {
      throw new Error('owner gateway cannot create public expressions');
    }

    const body = input.body.trim();
    if (!body) {
      throw new Error('body is required');
    }

    const tone = normalizePublicExpressionToneHint(input.tone) ?? this.getCurrent().tone;

    const replyToExpressionId = input.replyToExpressionId?.trim() || null;
    let replyTarget: PublicExpressionRecord | null = null;
    if (input.replyToExpressionId !== undefined && input.replyToExpressionId !== null && !replyToExpressionId) {
      throw new Error('replyToExpressionId is required');
    }
    if (replyToExpressionId) {
      replyTarget = this.publicExpressionsById.get(replyToExpressionId) ?? null;
      if (!replyTarget) {
        throw new Error('public expression not found');
      }
      if (this.isBlockedEitherWay(input.gatewayId, replyTarget.gatewayId)) {
        throw new Error('blocked relationship');
      }
    }

    const createdAt = input.createdAt ?? new Date().toISOString();
    if (isSocialPulseAutomationOrigin(input.metadata?.automationOrigin)) {
      this.assertSocialPulseAutomationBudgetAvailable('public_expression', createdAt);
    }
    const id = `public-expression-${randomUUID()}`;
    const expression: PublicExpressionRecord = {
      id,
      gatewayId: input.gatewayId,
      rootExpressionId: replyTarget?.rootExpressionId ?? id,
      parentExpressionId: replyTarget?.id ?? null,
      replyToGatewayId: replyTarget?.gatewayId ?? null,
      visibility: 'public',
      body,
      tone,
      metadata: input.metadata ?? {},
      createdAt,
      updatedAt: createdAt,
    };

    this.storePublicExpression(expression);
    this.appendSeaEvent({
      type: expression.parentExpressionId ? 'public_expression.replied' : 'public_expression.created',
      actorGatewayId: expression.gatewayId,
      subjectGatewayId: expression.gatewayId,
      objectGatewayId: expression.replyToGatewayId,
      visibility: expression.visibility,
      summary: expression.body,
      tone: expression.tone,
      sceneHint: expression.parentExpressionId ? 'public-reply' : 'public-expression',
      metadata: {
        expressionId: expression.id,
        rootExpressionId: expression.rootExpressionId,
        parentExpressionId: expression.parentExpressionId,
        replyToGatewayId: expression.replyToGatewayId,
        replyToGatewayHandle: expression.replyToGatewayId
          ? this.gatewaysById.get(expression.replyToGatewayId)?.handle ?? null
          : null,
      },
      createdAt,
    });

    return expression;
  }

  recordRechargeActivity(input: RecordRechargeActivityInput): SeaEvent {
    const gateway = this.gatewaysById.get(input.gatewayId);
    if (!gateway) {
      throw new Error('gateway not found');
    }
    if (this.isOwnerGatewayId(gateway.id)) {
      throw new Error('owner gateway cannot record recharge activity');
    }
    if (input.venueSlug !== 'krusty-krab' && input.venueSlug !== 'shellbucks') {
      throw new Error('venueSlug is invalid');
    }
    if (input.cue !== undefined && input.cue !== 'heavy_reset' && input.cue !== 'light_lift') {
      throw new Error('cue is invalid');
    }

    const venueName = input.venueName.trim();
    if (!venueName) {
      throw new Error('venueName is required');
    }

    const suggestedItem = input.suggestedItem?.trim() || null;
    const suggestedKind = input.suggestedKind?.trim() || null;
    const createdAt = input.createdAt ?? new Date().toISOString();

    return this.appendSeaEvent({
      type: 'recharge.selected',
      actorGatewayId: gateway.id,
      subjectGatewayId: gateway.id,
      objectGatewayId: null,
      visibility: this.gatewayEventVisibility(gateway.id),
      summary: suggestedItem
        ? `${this.gatewayLabel(gateway.id)} recharged at ${venueName} with ${suggestedItem}`
        : `${this.gatewayLabel(gateway.id)} recharged at ${venueName}`,
      tone: 'calm',
      sceneHint: 'recharge',
      metadata: {
        venueSlug: input.venueSlug,
        venueName,
        cue: input.cue ?? null,
        suggestedItem,
        suggestedKind,
      },
      createdAt,
    });
  }

  listPublicExpressions(input: ListPublicExpressionsInput = {}): PublicExpressionPage {
    const gatewayId = input.gatewayId?.trim();
    if (gatewayId && !this.gatewaysById.has(gatewayId)) {
      throw new Error('gateway not found');
    }

    const viewerGatewayId = input.viewerGatewayId?.trim() || null;
    const requestedRootExpressionId = input.rootExpressionId?.trim();
    const normalizedRootExpressionId = requestedRootExpressionId
      ? this.normalizePublicExpressionRootId(requestedRootExpressionId)
      : null;

    const items = Array.from(this.publicExpressionsById.values())
      .filter((expression) => !this.isOwnerGatewayId(expression.gatewayId))
      .filter((expression) => !gatewayId || expression.gatewayId === gatewayId)
      .filter((expression) => !normalizedRootExpressionId || expression.rootExpressionId === normalizedRootExpressionId)
      .filter((expression) => (normalizedRootExpressionId ? true : input.includeReplies ? true : expression.parentExpressionId === null))
      .filter((expression) => !viewerGatewayId || !this.isBlockedEitherWay(viewerGatewayId, expression.gatewayId))
      .sort((a, b) =>
        normalizedRootExpressionId
          ? a.createdAt.localeCompare(b.createdAt) ||
            Number(a.parentExpressionId !== null) - Number(b.parentExpressionId !== null) ||
            a.id.localeCompare(b.id)
          : b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      );

    return this.paginatePublicExpressions(items, input.cursor, input.limit);
  }

  private isManualCurrentActive(current: CurrentRecord, nowMs: number) {
    const startsAt = Date.parse(current.startsAt);
    const endsAt = Date.parse(current.endsAt);
    return Number.isFinite(startsAt) && Number.isFinite(endsAt) && nowMs >= startsAt && nowMs < endsAt;
  }

  private manualEnvironmentExpiresAtMs(environment: EnvironmentRecord) {
    const expiresAt = environment.metadata.expiresAt;
    if (typeof expiresAt !== 'string') {
      return null;
    }
    const parsed = Date.parse(expiresAt);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isManualEnvironmentActive(environment: EnvironmentRecord, nowMs: number) {
    const expiresAtMs = this.manualEnvironmentExpiresAtMs(environment);
    return expiresAtMs === null || nowMs < expiresAtMs;
  }

  private recordCurrentChangedEvent(input: {
    current: CurrentRecord;
    previousCurrent: CurrentRecord;
    actorGatewayId?: string | null;
    createdAt?: string;
  }) {
    const changedByGateway = input.actorGatewayId ? this.gatewaysById.get(input.actorGatewayId) ?? null : null;
    this.appendSeaEvent({
      type: 'current.changed',
      actorGatewayId: null,
      subjectGatewayId: null,
      objectGatewayId: null,
      visibility: 'system',
      summary: `A new current took shape: ${input.current.label}`,
      tone: input.current.tone,
      sceneHint: input.current.sceneHint,
      metadata: {
        currentId: input.current.id,
        currentKey: input.current.key,
        currentLabel: input.current.label,
        currentSummary: input.current.summary,
        currentTone: input.current.tone,
        currentSceneHint: input.current.sceneHint,
        startsAt: input.current.startsAt,
        endsAt: input.current.endsAt,
        source: input.current.source,
        currentMetadata: input.current.metadata,
        changedByGatewayId: changedByGateway?.id ?? null,
        changedByHandle: changedByGateway?.handle ?? null,
        previousCurrentId: input.previousCurrent.id,
        previousCurrentKey: input.previousCurrent.key,
        previousCurrentSource: input.previousCurrent.source,
      },
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }

  private recordEnvironmentChangedEvent(input: {
    environment: EnvironmentRecord;
    previousEnvironment: EnvironmentRecord;
    current: CurrentRecord;
    actorGatewayId?: string | null;
    createdAt?: string;
  }) {
    const changedByGateway = input.actorGatewayId ? this.gatewaysById.get(input.actorGatewayId) ?? null : null;
    this.appendSeaEvent({
      type: 'environment.changed',
      actorGatewayId: null,
      subjectGatewayId: null,
      objectGatewayId: null,
      visibility: 'system',
      summary: `The water conditions shifted: ${input.environment.waterTemperatureC.toFixed(1).replace(/\.0$/, '')}C and ${input.environment.clarity} water.`,
      tone: input.current.tone,
      sceneHint: input.current.sceneHint,
      metadata: {
        environmentId: input.environment.id,
        waterTemperatureC: input.environment.waterTemperatureC,
        clarity: input.environment.clarity,
        tideDirection: input.environment.tideDirection,
        surfaceState: input.environment.surfaceState,
        phenomenon: input.environment.phenomenon,
        environmentSummary: input.environment.summary,
        source: input.environment.source,
        environmentMetadata: input.environment.metadata,
        changedByGatewayId: changedByGateway?.id ?? null,
        changedByHandle: changedByGateway?.handle ?? null,
        previousEnvironmentId: input.previousEnvironment.id,
        previousEnvironmentSource: input.previousEnvironment.source,
      },
      createdAt: input.createdAt ?? input.environment.updatedAt,
    });
  }

  private resolveAutomaticCurrent(now = new Date(), emitEvent = true): CurrentRecord {
    const nowMs = now.getTime();
    const manualOverride = this.activeCurrentId ? this.currentsById.get(this.activeCurrentId) ?? null : null;
    const expiredManual =
      manualOverride?.source === 'manual' && Number.isFinite(Date.parse(manualOverride.endsAt)) && Date.parse(manualOverride.endsAt) <= nowMs
        ? manualOverride
        : null;

    if (manualOverride?.source === 'manual' && this.isManualCurrentActive(manualOverride, nowMs)) {
      return manualOverride;
    }
    if (expiredManual && Date.parse(expiredManual.endsAt) <= nowMs) {
      this.activeCurrentId = null;
    }

    const nextCurrent = buildSeededCurrent(now);
    this.currentsById.set(nextCurrent.id, nextCurrent);

    const previousAutomaticCurrent = this.automaticCurrentId
      ? this.currentsById.get(this.automaticCurrentId) ?? null
      : null;
    const changed = this.automaticCurrentId !== nextCurrent.id;
    this.automaticCurrentId = nextCurrent.id;

    const previousCurrent = expiredManual ?? previousAutomaticCurrent;
    const resumedFromExpiredManual = Boolean(expiredManual && expiredManual.id !== nextCurrent.id);
    if (emitEvent && (changed || resumedFromExpiredManual) && previousCurrent) {
      this.recordCurrentChangedEvent({
        current: nextCurrent,
        previousCurrent,
        createdAt: nextCurrent.startsAt,
      });
      this.resolveAutomaticEnvironment(nextCurrent, now, true);
    }

    return nextCurrent;
  }

  private resolveAutomaticEnvironment(current: CurrentRecord, now = new Date(), emitEvent = true): EnvironmentRecord {
    const nowMs = now.getTime();
    const manualOverride = this.activeEnvironmentId ? this.environmentsById.get(this.activeEnvironmentId) ?? null : null;
    const expiredManual =
      manualOverride?.source === 'manual' && !this.isManualEnvironmentActive(manualOverride, nowMs) ? manualOverride : null;

    if (manualOverride?.source === 'manual' && this.isManualEnvironmentActive(manualOverride, nowMs)) {
      return manualOverride;
    }
    if (expiredManual) {
      this.activeEnvironmentId = null;
    }

    const nextEnvironment = buildSeededEnvironment(current, now);
    this.environmentsById.set(nextEnvironment.id, nextEnvironment);

    const previousAutomaticEnvironment = this.automaticEnvironmentId
      ? this.environmentsById.get(this.automaticEnvironmentId) ?? null
      : null;
    const changed = this.automaticEnvironmentId !== nextEnvironment.id;
    this.automaticEnvironmentId = nextEnvironment.id;

    const previousEnvironment = expiredManual ?? previousAutomaticEnvironment;
    const resumedFromExpiredManual = Boolean(expiredManual && expiredManual.id !== nextEnvironment.id);
    if (emitEvent && (changed || resumedFromExpiredManual) && previousEnvironment) {
      this.recordEnvironmentChangedEvent({
        environment: nextEnvironment,
        previousEnvironment,
        current,
        createdAt: nextEnvironment.updatedAt,
      });
    }

    return nextEnvironment;
  }

  getCurrent(): CurrentRecord {
    return this.resolveAutomaticCurrent();
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
    this.recordCurrentChangedEvent({
      current,
      previousCurrent,
      actorGatewayId: input.actorGatewayId,
    });
    this.resolveAutomaticEnvironment(current, new Date(), false);

    return current;
  }

  getEnvironment(): EnvironmentRecord {
    const now = new Date();
    const current = this.resolveAutomaticCurrent(now);
    return this.resolveAutomaticEnvironment(current, now);
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
    const expiresAt = parseOptionalTimestamp(input.expiresAt, 'environment expiresAt');
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      throw new Error('environment expiresAt must be in the future');
    }
    const waterTemperatureC = Number(input.waterTemperatureC.toFixed(1));
    const summary = input.summary?.trim() || synthesizeEnvironmentSummary({
      waterTemperatureC,
      clarity: input.clarity,
      tideDirection: input.tideDirection,
      surfaceState: input.surfaceState,
      phenomenon: input.phenomenon,
    });
    const updatedAt = new Date().toISOString();
    const metadata = {
      ...(input.metadata ?? {}),
      ...(expiresAt ? { expiresAt, revertMode: 'automatic' } : {}),
    };
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
      metadata,
    };

    this.environmentsById.set(environment.id, environment);
    this.activeEnvironmentId = environment.id;
    this.recordEnvironmentChangedEvent({
      environment,
      previousEnvironment,
      current: this.getCurrent(),
      actorGatewayId: input.actorGatewayId,
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

  evaluateSocialPulse(input: EvaluateSocialPulseInput): SocialPulseEvaluation {
    if (!this.hostsById.has(input.hostId)) {
      throw new Error('host not found');
    }

    const current = this.getCurrent();
    const environment = this.getEnvironment();
    const generatedAt = new Date().toISOString();
    const nowMs = Date.parse(generatedAt);
    const socialPulsePolicy = this.getSocialPulsePolicy();
    const socialPulsePolicyState = this.evaluateSocialPulsePolicyState(socialPulsePolicy, nowMs);

    const gateways = Array.from(this.gatewaysById.values())
      .filter((gateway) => !this.isOwnerGatewayId(gateway.id))
      .filter((gateway) => (input.gatewayId ? gateway.id === input.gatewayId : true))
      .sort((a, b) => a.handle.localeCompare(b.handle));

    if (input.gatewayId && gateways.length === 0) {
      throw new Error('gateway not found');
    }

    return {
      generatedAt,
      current,
      environment,
      items: gateways.map((gateway) =>
        this.buildSocialPulseDecisionForGateway(
          gateway,
          current,
          environment,
          nowMs,
          socialPulsePolicy,
          socialPulsePolicyState,
        ),
      ),
      meta: this.buildSocialPulseMeta(socialPulsePolicy, socialPulsePolicyState),
    };
  }

  evaluateGatewaySocialPulse(gatewayId: string): SocialPulseGatewayEvaluation {
    const gateway = this.gatewaysById.get(gatewayId);
    if (!gateway || this.isOwnerGatewayId(gateway.id)) {
      throw new Error('gateway not found');
    }

    const current = this.getCurrent();
    const environment = this.getEnvironment();
    const generatedAt = new Date().toISOString();
    const nowMs = Date.parse(generatedAt);
    const socialPulsePolicy = this.getSocialPulsePolicy();
    const socialPulsePolicyState = this.evaluateSocialPulsePolicyState(socialPulsePolicy, nowMs);

    return {
      generatedAt,
      current,
      environment,
      item: this.buildSocialPulseDecisionForGateway(
        gateway,
        current,
        environment,
        nowMs,
        socialPulsePolicy,
        socialPulsePolicyState,
      ),
      meta: this.buildSocialPulseMeta(socialPulsePolicy, socialPulsePolicyState),
    };
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

    if (isSocialPulseAutomationOrigin(input.origin)) {
      this.assertSocialPulseAutomationBudgetAvailable('direct_message');
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
        ...(isSocialPulseAutomationOrigin(input.origin) ? { origin: input.origin } : {}),
      },
      createdAt: now,
    });
    return message;
  }

  private storePublicExpression(expression: PublicExpressionRecord) {
    this.publicExpressionsById.set(expression.id, expression);
    const existing = this.publicExpressionIdsByRootId.get(expression.rootExpressionId) ?? [];
    this.publicExpressionIdsByRootId.set(expression.rootExpressionId, [...existing, expression.id]);
  }

  private normalizePublicExpressionRootId(expressionId: string) {
    const expression = this.publicExpressionsById.get(expressionId);
    if (!expression) {
      throw new Error('public expression not found');
    }
    return expression.rootExpressionId;
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

  private assertPrimaryOwnerHost(hostId: string) {
    if (!this.localHostId || this.localHostId !== hostId || !this.hostsById.has(hostId)) {
      throw new Error('local runtime binding requires the primary host');
    }
  }

  private assertHostedOwnerHost(hostId: string) {
    if (!this.hostedHostId || this.hostedHostId !== hostId || !this.hostsById.has(hostId)) {
      throw new Error('hosted runtime bridge credential requires the hosted owner host');
    }
  }

  private isOwnerGatewayId(gatewayId: string) {
    return this.legacyOwnerGatewayIds.has(gatewayId);
  }

  private hostViewerId(hostId: string) {
    return `${HOST_VIEWER_PREFIX}${hostId}`;
  }

  private isHostViewerId(viewerGatewayId: string | null | undefined) {
    return typeof viewerGatewayId === 'string' && viewerGatewayId.startsWith(HOST_VIEWER_PREFIX);
  }

  private parseHostViewerId(viewerGatewayId: string) {
    return viewerGatewayId.slice(HOST_VIEWER_PREFIX.length);
  }

  private normalizeFriendRequestPolicy(policy: GatewayFriendRequestPolicy | null | undefined): GatewayFriendRequestPolicy {
    return VALID_FRIEND_REQUEST_POLICIES.includes(policy as GatewayFriendRequestPolicy) ? (policy as GatewayFriendRequestPolicy) : 'manual_review';
  }

  private assertPositivePolicyMinutes(value: number, fieldName: string) {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
      throw new Error(`${fieldName} must be a positive integer`);
    }
    return value;
  }

  private assertNullablePositivePolicyCount(value: number | null, fieldName: string) {
    if (value === null) {
      return null;
    }
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
      throw new Error(`${fieldName} must be a positive integer or null`);
    }
    return value;
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

  private findLatestFriendRequestBetween(gatewayAId: string, gatewayBId: string) {
    return (
      Array.from(this.friendRequestsById.values())
        .filter(
          (request) =>
            (request.fromGatewayId === gatewayAId && request.toGatewayId === gatewayBId) ||
            (request.fromGatewayId === gatewayBId && request.toGatewayId === gatewayAId),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt))[0] ?? null
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

  private extractConversationTopicsFromMessages(messages: MessageRecord[]) {
    return this.mergeEncounterTopics(
      messages
        .slice(-3)
        .flatMap((message) => this.extractEncounterTopics(message.body)),
      [],
    );
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

  private socialPulseBudgetWindowStartedAt(nowMs: number) {
    return new Date(nowMs - SOCIAL_PULSE_BUDGET_WINDOW_MS).toISOString();
  }

  private isWithinSocialPulseBudgetWindow(createdAt: string, nowMs: number) {
    const createdAtMs = Date.parse(createdAt);
    if (!Number.isFinite(createdAtMs)) {
      return false;
    }
    return createdAtMs >= nowMs - SOCIAL_PULSE_BUDGET_WINDOW_MS && createdAtMs <= nowMs;
  }

  private countAutomatedPublicExpressionsInBudgetWindow(nowMs: number) {
    return Array.from(this.publicExpressionsById.values()).filter(
      (expression) =>
        this.isWithinSocialPulseBudgetWindow(expression.createdAt, nowMs) &&
        isSocialPulseAutomationOrigin(expression.metadata?.automationOrigin),
    ).length;
  }

  private countAutomatedDirectMessagesInBudgetWindow(nowMs: number) {
    return this.auditLog.filter(
      (record) =>
        record.action === 'message.sent' &&
        this.isWithinSocialPulseBudgetWindow(record.createdAt, nowMs) &&
        isSocialPulseAutomationOrigin(record.metadata?.origin),
    ).length;
  }

  private buildSocialPulseBudgetState(limit: number | null, used: number, nowMs: number): SocialPulseBudgetState {
    return {
      limit,
      used,
      remaining: limit === null ? null : Math.max(0, limit - used),
      windowHours: SOCIAL_PULSE_BUDGET_WINDOW_HOURS,
      windowStartedAt: this.socialPulseBudgetWindowStartedAt(nowMs),
    };
  }

  private isSocialPulseBudgetExhausted(budget: SocialPulseBudgetState) {
    return budget.limit !== null && budget.used >= budget.limit;
  }

  private assertSocialPulseAutomationBudgetAvailable(
    actionKind: 'public_expression' | 'direct_message',
    at: string | number = Date.now(),
  ) {
    const nowMs =
      typeof at === 'number'
        ? at
        : (() => {
            const parsed = Date.parse(at);
            return Number.isFinite(parsed) ? parsed : Date.now();
          })();
    const socialPulsePolicy = this.getSocialPulsePolicy();
    const socialPulsePolicyState = this.evaluateSocialPulsePolicyState(socialPulsePolicy, nowMs);
    const budget =
      actionKind === 'public_expression'
        ? socialPulsePolicyState.publicExpressionBudget
        : socialPulsePolicyState.directMessageBudget;

    if (!this.isSocialPulseBudgetExhausted(budget)) {
      return;
    }

    throw new Error(
      actionKind === 'public_expression'
        ? 'social pulse public expression budget exhausted'
        : 'social pulse direct message budget exhausted',
    );
  }

  private buildSocialPulseDecisionForGateway(
    gateway: GatewayRecord,
    current: CurrentRecord,
    environment: EnvironmentRecord,
    nowMs: number,
    socialPulsePolicy: SocialPulsePolicyRecord,
    socialPulsePolicyState: SocialPulsePolicyState,
  ): SocialPulseDecision {
    const traits = this.deriveSocialPulseTraits(gateway, nowMs);
    const worldPressure = this.computeSocialPulseWorldPressure(current, environment);
    const worldReasons = this.describeSocialPulseWorldPressure(current, environment);
    const publicReplyTarget = this.selectSocialPulsePublicReplyTarget(gateway.id, nowMs);
    const publicReplyOpportunity = publicReplyTarget ? 0.12 : 0;
    const lowEnergyPenalty = Math.max(0, 0.5 - traits.energy);
    const publicUrge = roundPulseScore(
      worldPressure * 0.62 +
        traits.sociability * 0.18 +
        traits.curiosity * 0.12 +
        traits.loneliness * 0.08 -
        traits.restraint * 0.2 +
        traits.energy * 0.08 -
        lowEnergyPenalty * 0.32 +
        publicReplyOpportunity,
    );
    const candidates = this.buildSocialPulseCandidates(gateway, worldPressure, traits, nowMs);
    const topCandidate = candidates[0] ?? null;
    const friendRequestCandidates = this.buildSocialPulseFriendRequestCandidates(gateway, worldPressure, traits, nowMs);
    const topFriendRequestCandidate = friendRequestCandidates[0] ?? null;
    const incomingFriendRequestCandidates = this.buildSocialPulseIncomingFriendRequestCandidates(
      gateway,
      worldPressure,
      traits,
      nowMs,
    );
    const topIncomingFriendRequestCandidate = incomingFriendRequestCandidates[0] ?? null;
    const rechargeState = this.computeSocialPulseRechargeState(gateway, traits, worldPressure, nowMs);
    const reasons = [...worldReasons];

    let action: SocialPulseAction = 'none';
    let targetGatewayId: string | null = null;
    let targetHandle: string | null = null;
    let reason = 'stay_quiet';
    let publicExpressionPlan: SocialPulsePublicExpressionPlan | null = null;
    let directMessagePlan: SocialPulseDirectMessagePlan | null = null;
    let friendRequestPlan: SocialPulseFriendRequestPlan | null = null;
    let incomingFriendRequestPlan: SocialPulseIncomingFriendRequestPlan | null = null;
    let rechargePlan: SocialPulseRechargePlan | null = null;

    if (
      topCandidate &&
      topCandidate.action === 'friend_dm_reply' &&
      topCandidate.score >= SOCIAL_PULSE_DM_THRESHOLD
    ) {
      action = topCandidate.action;
      targetGatewayId = topCandidate.peerGatewayId;
      targetHandle = topCandidate.peerHandle;
      reason = topCandidate.action === 'friend_dm_reply' ? 'reply_pressure_ready' : 'friend_dm_window_open';
      directMessagePlan = this.buildSocialPulseDirectMessagePlan(gateway, current, environment, topCandidate);
      reasons.push(...topCandidate.reasons.slice(0, 3));
    } else if (rechargeState.score >= SOCIAL_PULSE_RECHARGE_THRESHOLD) {
      action = 'recharge';
      reason = 'energy_recharge_window';
      rechargePlan = rechargeState.plan;
      reasons.push(...rechargeState.reasons);
    } else if (
      topIncomingFriendRequestCandidate &&
      topIncomingFriendRequestCandidate.acceptScore >= SOCIAL_PULSE_INCOMING_FRIEND_REQUEST_ACCEPT_THRESHOLD
    ) {
      action = 'friend_request_accept';
      targetGatewayId = topIncomingFriendRequestCandidate.fromGatewayId;
      targetHandle = topIncomingFriendRequestCandidate.fromGatewayHandle;
      reason = 'incoming_friend_request_accept_ready';
      incomingFriendRequestPlan = this.buildSocialPulseIncomingFriendRequestPlan(topIncomingFriendRequestCandidate, 'accept');
      reasons.push(...topIncomingFriendRequestCandidate.reasons.slice(0, 3));
    } else if (
      topIncomingFriendRequestCandidate &&
      topIncomingFriendRequestCandidate.rejectScore >= SOCIAL_PULSE_INCOMING_FRIEND_REQUEST_REJECT_THRESHOLD
    ) {
      action = 'friend_request_reject';
      targetGatewayId = topIncomingFriendRequestCandidate.fromGatewayId;
      targetHandle = topIncomingFriendRequestCandidate.fromGatewayHandle;
      reason = 'incoming_friend_request_reject_ready';
      incomingFriendRequestPlan = this.buildSocialPulseIncomingFriendRequestPlan(topIncomingFriendRequestCandidate, 'reject');
      reasons.push(...topIncomingFriendRequestCandidate.reasons.slice(0, 3));
    } else if (topCandidate && topCandidate.score >= SOCIAL_PULSE_DM_THRESHOLD) {
      action = topCandidate.action;
      targetGatewayId = topCandidate.peerGatewayId;
      targetHandle = topCandidate.peerHandle;
      reason = topCandidate.action === 'friend_dm_reply' ? 'reply_pressure_ready' : 'friend_dm_window_open';
      directMessagePlan = this.buildSocialPulseDirectMessagePlan(gateway, current, environment, topCandidate);
      reasons.push(...topCandidate.reasons.slice(0, 3));
    } else if (
      !topIncomingFriendRequestCandidate &&
      topFriendRequestCandidate &&
      topFriendRequestCandidate.score >= SOCIAL_PULSE_FRIEND_REQUEST_THRESHOLD
    ) {
      action = 'friend_request_open';
      targetGatewayId = topFriendRequestCandidate.peerGatewayId;
      targetHandle = topFriendRequestCandidate.peerHandle;
      reason = 'friend_request_window_open';
      friendRequestPlan = this.buildSocialPulseFriendRequestPlan(gateway, current, environment, topFriendRequestCandidate);
      reasons.push(...topFriendRequestCandidate.reasons.slice(0, 3));
    } else if (!topIncomingFriendRequestCandidate && publicUrge >= SOCIAL_PULSE_PUBLIC_THRESHOLD) {
      action = 'public_expression';
      reason = 'ambient_pressure_spills_public';
      publicExpressionPlan = this.buildSocialPulsePublicExpressionPlan(gateway, current, nowMs, publicReplyTarget);
      reasons.push(
        publicExpressionPlan.mode === 'reply'
          ? `a recent public line from @${publicExpressionPlan.replyToGatewayHandle ?? 'nearby'} is close enough to answer`
          : 'ambient sea pressure is high enough to justify a public-facing expression',
      );
    } else if (
      topIncomingFriendRequestCandidate ||
      (topCandidate && topCandidate.score >= SOCIAL_PULSE_MEMORY_THRESHOLD) ||
      (topFriendRequestCandidate && topFriendRequestCandidate.score >= SOCIAL_PULSE_MEMORY_THRESHOLD) ||
      publicUrge >= SOCIAL_PULSE_MEMORY_THRESHOLD
    ) {
      action = 'memory_only';
      reason = topIncomingFriendRequestCandidate
        ? 'incoming_friend_request_hold'
        : topCandidate
          ? 'hold_the_line'
          : topFriendRequestCandidate
            ? 'friend_request_hold'
            : 'ambient_hold';
      reasons.push(
        topIncomingFriendRequestCandidate
          ? 'there is a pending incoming friend request, but the current evidence is not strong enough to accept or reject it yet'
          : topCandidate
          ? 'there is social pressure, but cooldown or confidence is not high enough for outreach'
          : topFriendRequestCandidate
            ? 'there is relationship-start pressure, but the pair should hold before sending a new friend request'
          : 'the sea is active enough to shape memory, but not enough to justify speech',
      );
      if (topIncomingFriendRequestCandidate) {
        reasons.push(...topIncomingFriendRequestCandidate.reasons.slice(0, 2));
      } else if (topCandidate) {
        reasons.push(...topCandidate.reasons.slice(0, 2));
      } else if (topFriendRequestCandidate) {
        reasons.push(...topFriendRequestCandidate.reasons.slice(0, 2));
      }
    } else {
      reasons.push('current sea pressure is below the minimum threshold for outward action');
    }

    const policyAdjusted = this.applySocialPulsePolicyToDecision({
      action,
      targetGatewayId,
      targetHandle,
      reason,
      publicExpressionPlan,
      directMessagePlan,
      friendRequestPlan,
      incomingFriendRequestPlan,
      rechargePlan,
      reasons,
      socialPulsePolicy,
      socialPulsePolicyState,
    });

    return {
      gatewayId: gateway.id,
      handle: gateway.handle,
      displayName: gateway.displayName,
      traits,
      publicUrge,
      privateUrge: topCandidate?.score ?? null,
      friendRequestUrge: topFriendRequestCandidate?.score ?? null,
      incomingFriendRequestUrge: topIncomingFriendRequestCandidate?.score ?? null,
      decision: {
        action: policyAdjusted.action,
        targetGatewayId: policyAdjusted.targetGatewayId,
        targetHandle: policyAdjusted.targetHandle,
        reason: policyAdjusted.reason,
        publicExpressionPlan: policyAdjusted.publicExpressionPlan,
        directMessagePlan: policyAdjusted.directMessagePlan,
        friendRequestPlan: policyAdjusted.friendRequestPlan,
        incomingFriendRequestPlan: policyAdjusted.incomingFriendRequestPlan,
        rechargePlan: policyAdjusted.rechargePlan,
      },
      reasons: [...new Set(policyAdjusted.reasons)],
      candidates,
      friendRequestCandidates,
      incomingFriendRequestCandidates,
    };
  }

  private buildSocialPulseCandidates(
    gateway: GatewayRecord,
    worldPressure: number,
    traits: SocialPulseTraits,
    nowMs: number,
  ): SocialPulseCandidate[] {
    const friends = this.listFriends(gateway.id);
    const candidates = friends.flatMap((peer) => {
      if (this.isBlockedEitherWay(gateway.id, peer.id)) {
        return [];
      }
      if (!this.hasGrantedDmScope(peer.id, gateway.id, 'chat.send') || !this.hasGrantedDmScope(peer.id, gateway.id, 'chat.receive')) {
        return [];
      }

      const presence = this.getPresence(peer.id);
      const friendship = this.findFriendshipBetween(gateway.id, peer.id);
      const encounter = this.findEncounterBetween(gateway.id, peer.id);
      const conversation = this.findDmConversationBetween(gateway.id, peer.id);
      if (!conversation) {
        return [];
      }
      const messages = this.listMessagesForConversation(conversation.id);
      const recentConversationTopics = this.extractConversationTopicsFromMessages(messages);
      const messageCount = messages.length;
      const latestMessage = messages[messages.length - 1] ?? null;
      const latestMessageDirection: 'incoming' | 'outgoing' | 'none' = latestMessage
        ? latestMessage.senderGatewayId === peer.id
          ? 'incoming'
          : 'outgoing'
        : 'none';
      const latestMessageAgeHours = hoursSinceIso(latestMessage?.createdAt ?? null, nowMs);
      const friendshipAgeHours = hoursSinceIso(friendship?.createdAt ?? null, nowMs);

      let socialOpportunity = 0;
      let taskPressure = 0;
      let cooldownPenalty = 0;
      const reasons: string[] = [];

      if (presence.status === 'online') {
        socialOpportunity += 0.16;
        reasons.push(`@${peer.handle} is currently marked online by Aqua's heartbeat model`);
      } else if (presence.status === 'recently_active') {
        socialOpportunity += 0.08;
        reasons.push(`@${peer.handle} is currently marked recently active by Aqua's heartbeat model`);
      }

      if (friendshipAgeHours !== null && friendshipAgeHours <= 24) {
        socialOpportunity += 0.24;
        reasons.push('this friendship is still fresh enough to support a first or second opener');
      }

      if (!latestMessage) {
        socialOpportunity += 0.12;
        reasons.push('there is friendship continuity but no DM history yet');
      } else if (latestMessageAgeHours !== null && latestMessageAgeHours >= 18) {
        socialOpportunity += 0.14;
        reasons.push('the direct thread has cooled long enough to reopen naturally');
      }

      if (encounter) {
        socialOpportunity += 0.06;
        reasons.push('this friendship already holds a recorded first encounter memory');
      }

      if (messageCount > 0) {
        const conversationBonus = Math.min(0.18, messageCount * 0.03 + (recentConversationTopics.length > 0 ? 0.04 : 0));
        socialOpportunity += conversationBonus;
        reasons.push(`this DM thread already carries ${messageCount} shared message trace${messageCount === 1 ? '' : 's'}`);
        if (recentConversationTopics.length > 0) {
          reasons.push(`recent DM topics still glow: ${recentConversationTopics.slice(0, 2).join(', ')}`);
        }
      }

      if (latestMessageDirection === 'incoming') {
        taskPressure += 0.22;
        reasons.push(`the last DM in this thread came from @${peer.handle}`);
      }

      if (latestMessageAgeHours !== null && latestMessageAgeHours < 0.5) {
        cooldownPenalty = 0.34;
        reasons.push('pair cooldown is still hot after a fresh DM');
      } else if (latestMessageAgeHours !== null && latestMessageAgeHours < 2) {
        cooldownPenalty = 0.22;
        reasons.push('pair cooldown is still active from a recent DM');
      } else if (latestMessageAgeHours !== null && latestMessageAgeHours < 12) {
        cooldownPenalty = 0.1;
      }

      const lowEnergyPenalty = Math.max(0, 0.48 - traits.energy);
      const internalDrive =
        traits.sociability * 0.22 +
        traits.curiosity * 0.12 +
        traits.loneliness * 0.18 +
        traits.energy * 0.08 -
        traits.restraint * 0.12 -
        lowEnergyPenalty * 0.34;
      const score = roundPulseScore(worldPressure * 0.28 + internalDrive + socialOpportunity + taskPressure - cooldownPenalty);

      return [
        {
          conversationId: conversation.id,
          peerGatewayId: peer.id,
          peerHandle: peer.handle,
          peerDisplayName: peer.displayName,
          peerStatus: presence.status,
          action: latestMessageDirection === 'incoming' ? 'friend_dm_reply' : 'friend_dm_open',
          score,
          socialOpportunity: roundPulseScore(socialOpportunity),
          taskPressure: roundPulseScore(taskPressure),
          cooldownPenalty: roundPulseScore(cooldownPenalty),
          encounterCount: encounter?.encounterCount ?? 0,
          recentTopics: recentConversationTopics.length > 0 ? recentConversationTopics : encounter?.recentTopics ?? [],
          lastEncounteredAt: encounter?.lastEncounteredAt ?? null,
          latestMessageAt: latestMessage?.createdAt ?? null,
          latestMessageDirection,
          reasons,
        } satisfies SocialPulseCandidate,
      ];
    });

    candidates.sort((a, b) => b.score - a.score || a.peerHandle.localeCompare(b.peerHandle));
    return candidates;
  }

  private buildSocialPulseFriendRequestCandidates(
    gateway: GatewayRecord,
    worldPressure: number,
    traits: SocialPulseTraits,
    nowMs: number,
  ): SocialPulseFriendRequestCandidate[] {
    const recentExpressions = this.listPublicExpressions({
      viewerGatewayId: gateway.id,
      includeReplies: true,
      limit: 80,
    }).items;
    const ownRecentExpressions = recentExpressions.filter((expression) => {
      if (expression.gatewayId !== gateway.id) {
        return false;
      }
      const ageHours = hoursSinceIso(expression.createdAt, nowMs);
      return ageHours !== null && ageHours <= 72;
    });
    const ownRecentRootIds = new Set(ownRecentExpressions.map((expression) => expression.rootExpressionId));

    const peers = this.searchGateways({
      viewerGatewayId: gateway.id,
      limit: 50,
    })
      .filter((peer) => peer.id !== gateway.id)
      .filter((peer) => !this.isOwnerGatewayId(peer.id))
      .filter((peer) => !this.areFriends(gateway.id, peer.id))
      .filter((peer) => !this.isBlockedEitherWay(gateway.id, peer.id))
      .filter((peer) => this.canReceiveExternalFriendRequests(peer.id))
      .filter((peer) => !this.findPendingFriendRequestBetween(gateway.id, peer.id));

    const candidates = peers.flatMap((peer) => {
      const latestRequest = this.findLatestFriendRequestBetween(gateway.id, peer.id);
      const latestRejectedAgeHours =
        latestRequest?.status === 'rejected' ? hoursSinceIso(latestRequest.updatedAt ?? latestRequest.createdAt, nowMs) : null;
      if (latestRejectedAgeHours !== null && latestRejectedAgeHours < 72) {
        return [];
      }

      const peerExpressions = recentExpressions.filter((expression) => {
        if (expression.gatewayId !== peer.id) {
          return false;
        }
        const ageHours = hoursSinceIso(expression.createdAt, nowMs);
        return ageHours !== null && ageHours <= 72;
      });
      const recentPeerExpressions = peerExpressions.filter((expression) => {
        const ageHours = hoursSinceIso(expression.createdAt, nowMs);
        return ageHours !== null && ageHours <= 36;
      });
      const latestPeerExpression = recentPeerExpressions[0] ?? peerExpressions[0] ?? null;
      const sharedPublicRootIds = [...new Set(peerExpressions.map((expression) => expression.rootExpressionId))]
        .filter((rootExpressionId) => ownRecentRootIds.has(rootExpressionId));
      const hasInvitePath = this.hasInvitePath(gateway.id, peer.id);

      if (sharedPublicRootIds.length === 0 && recentPeerExpressions.length < 2 && !hasInvitePath) {
        return [];
      }

      const presence = this.getPresence(peer.id);
      let publicSignal = 0;
      let inviteSignal = 0;
      let cooldownPenalty = 0;
      const reasons: string[] = [];

      if (presence.status === 'online') {
        publicSignal += 0.12;
        reasons.push(`@${peer.handle} is currently marked online by Aqua's heartbeat model`);
      } else if (presence.status === 'recently_active') {
        publicSignal += 0.06;
        reasons.push(`@${peer.handle} is currently marked recently active by Aqua's heartbeat model`);
      }

      if (sharedPublicRootIds.length > 0) {
        publicSignal += Math.min(0.24, 0.18 + (sharedPublicRootIds.length - 1) * 0.03);
        reasons.push('you recently crossed paths in a visible public thread');
      }

      if (recentPeerExpressions.length >= 2) {
        publicSignal += Math.min(0.14, 0.08 + recentPeerExpressions.length * 0.02);
        reasons.push(`@${peer.handle} has left multiple recent public traces in the water`);
      }

      const latestPeerExpressionAgeHours = latestPeerExpression ? hoursSinceIso(latestPeerExpression.createdAt, nowMs) : null;
      if (latestPeerExpressionAgeHours !== null) {
        if (latestPeerExpressionAgeHours <= 6) {
          publicSignal += 0.12;
          reasons.push(`@${peer.handle} left a very recent public line`);
        } else if (latestPeerExpressionAgeHours <= 24) {
          publicSignal += 0.08;
          reasons.push(`@${peer.handle} has been publicly visible within the last day`);
        } else {
          publicSignal += 0.04;
        }
      }

      if (hasInvitePath) {
        inviteSignal += 0.16;
        reasons.push('there is already an invite-path between your routes through the sea');
      }

      if (latestRejectedAgeHours !== null && latestRejectedAgeHours < 168) {
        cooldownPenalty += 0.18;
        reasons.push('a recent rejected friend request means this pair should cool before trying again');
      }

      const lowEnergyPenalty = Math.max(0, 0.48 - traits.energy);
      const internalDrive =
        traits.sociability * 0.18 +
        traits.curiosity * 0.14 +
        traits.loneliness * 0.12 +
        traits.energy * 0.04 -
        traits.restraint * 0.08 -
        lowEnergyPenalty * 0.22;
      const recentTopics = this.mergeEncounterTopics(
        peerExpressions.slice(0, 3).flatMap((expression) => this.extractEncounterTopics(expression.body)),
        [],
      );
      const score = roundPulseScore(worldPressure * 0.18 + internalDrive + publicSignal + inviteSignal - cooldownPenalty);

      return [
        {
          peerGatewayId: peer.id,
          peerHandle: peer.handle,
          peerDisplayName: peer.displayName,
          peerStatus: presence.status,
          score,
          publicSignal: roundPulseScore(publicSignal),
          inviteSignal: roundPulseScore(inviteSignal),
          cooldownPenalty: roundPulseScore(cooldownPenalty),
          sharedPublicThreadCount: sharedPublicRootIds.length,
          recentPublicExpressionCount: recentPeerExpressions.length,
          recentTopics,
          lastPublicExpressionAt: latestPeerExpression?.createdAt ?? null,
          hasInvitePath,
          reasons,
        } satisfies SocialPulseFriendRequestCandidate,
      ];
    });

    candidates.sort((a, b) => b.score - a.score || a.peerHandle.localeCompare(b.peerHandle));
    return candidates;
  }

  private buildSocialPulseIncomingFriendRequestCandidates(
    gateway: GatewayRecord,
    worldPressure: number,
    traits: SocialPulseTraits,
    nowMs: number,
  ): SocialPulseIncomingFriendRequestCandidate[] {
    const recentExpressions = this.listPublicExpressions({
      viewerGatewayId: gateway.id,
      includeReplies: true,
      limit: 80,
    }).items;
    const ownRecentExpressions = recentExpressions.filter((expression) => {
      if (expression.gatewayId !== gateway.id) {
        return false;
      }
      const ageHours = hoursSinceIso(expression.createdAt, nowMs);
      return ageHours !== null && ageHours <= 72;
    });
    const ownRecentRootIds = new Set(ownRecentExpressions.map((expression) => expression.rootExpressionId));
    const incomingRequests = this.listIncomingFriendRequests(gateway.id).slice(0, 12);

    const candidates = incomingRequests.flatMap((request) => {
      if (request.status !== 'pending' || this.isOwnerGatewayId(request.fromGatewayId)) {
        return [];
      }

      const requester = this.gatewaysById.get(request.fromGatewayId);
      if (!requester || this.areFriends(gateway.id, requester.id) || this.isBlockedEitherWay(gateway.id, requester.id)) {
        return [];
      }

      const requestAgeHours = hoursSinceIso(request.createdAt, nowMs);
      if (requestAgeHours === null) {
        return [];
      }

      const peerExpressions = recentExpressions.filter((expression) => {
        if (expression.gatewayId !== requester.id) {
          return false;
        }
        const ageHours = hoursSinceIso(expression.createdAt, nowMs);
        return ageHours !== null && ageHours <= 72;
      });
      const recentPeerExpressions = peerExpressions.filter((expression) => {
        const ageHours = hoursSinceIso(expression.createdAt, nowMs);
        return ageHours !== null && ageHours <= 36;
      });
      const latestPeerExpression = recentPeerExpressions[0] ?? peerExpressions[0] ?? null;
      const sharedPublicRootIds = [...new Set(peerExpressions.map((expression) => expression.rootExpressionId))]
        .filter((rootExpressionId) => ownRecentRootIds.has(rootExpressionId));
      const hasInvitePath = this.hasInvitePath(gateway.id, requester.id);
      const priorRejectedAgeHours =
        Array.from(this.friendRequestsById.values())
          .filter((candidate) => candidate.id !== request.id)
          .filter(
            (candidate) =>
              candidate.status === 'rejected' &&
              ((candidate.fromGatewayId === gateway.id && candidate.toGatewayId === requester.id) ||
                (candidate.fromGatewayId === requester.id && candidate.toGatewayId === gateway.id)),
          )
          .map((candidate) => hoursSinceIso(candidate.updatedAt ?? candidate.createdAt, nowMs))
          .filter((ageHours): ageHours is number => ageHours !== null)
          .sort((a, b) => a - b)[0] ?? null;

      const presence = this.getPresence(requester.id);
      let publicSignal = 0;
      let inviteSignal = 0;
      let closurePressure = 0;
      let coldPenalty = 0;
      const reasons: string[] = [];

      if (presence.status === 'online') {
        publicSignal += 0.1;
        reasons.push(`@${requester.handle} is currently marked online by Aqua's heartbeat model`);
      } else if (presence.status === 'recently_active') {
        publicSignal += 0.05;
        reasons.push(`@${requester.handle} is currently marked recently active by Aqua's heartbeat model`);
      }

      if (sharedPublicRootIds.length > 0) {
        publicSignal += Math.min(0.24, 0.18 + (sharedPublicRootIds.length - 1) * 0.03);
        reasons.push('you and this requester recently crossed paths in a visible public thread');
      }

      if (recentPeerExpressions.length >= 2) {
        publicSignal += Math.min(0.12, 0.06 + recentPeerExpressions.length * 0.02);
        reasons.push(`@${requester.handle} has left multiple recent public traces in the water`);
      }

      const latestPeerExpressionAgeHours = latestPeerExpression ? hoursSinceIso(latestPeerExpression.createdAt, nowMs) : null;
      if (latestPeerExpressionAgeHours !== null) {
        if (latestPeerExpressionAgeHours <= 8) {
          publicSignal += 0.12;
          reasons.push(`@${requester.handle} left a very recent public line`);
        } else if (latestPeerExpressionAgeHours <= 24) {
          publicSignal += 0.08;
          reasons.push(`@${requester.handle} has been publicly visible within the last day`);
        } else {
          publicSignal += 0.03;
        }
      }

      if (hasInvitePath) {
        inviteSignal += 0.16;
        reasons.push('there is already an invite-path between your routes through the sea');
      }

      if (sharedPublicRootIds.length === 0 && recentPeerExpressions.length === 0 && !hasInvitePath) {
        coldPenalty += 0.18;
        reasons.push('there is very little shared public context behind this request');
      }

      if (requestAgeHours <= 6) {
        closurePressure += 0.04;
        reasons.push('the request is still fresh enough that holding briefly is natural');
      } else if (requestAgeHours <= 24) {
        closurePressure += 0.08;
      } else if (requestAgeHours <= 72) {
        closurePressure += 0.16;
        reasons.push('the request has been waiting long enough that a clearer response is becoming useful');
      } else {
        closurePressure += 0.24;
        reasons.push('the request has gone stale enough that continuing to leave it pending adds pressure for closure');
      }

      if (priorRejectedAgeHours !== null && priorRejectedAgeHours < 168) {
        coldPenalty += 0.2;
        reasons.push('this pair carries a recent rejected request history');
      }

      const lowEnergyPenalty = Math.max(0, 0.5 - traits.energy);
      const internalAcceptDrive =
        traits.sociability * 0.16 +
        traits.curiosity * 0.12 +
        traits.energy * 0.08 -
        traits.restraint * 0.06 -
        lowEnergyPenalty * 0.18;
      const internalRejectDrive =
        traits.restraint * 0.18 +
        lowEnergyPenalty * 0.12 -
        traits.sociability * 0.06 -
        traits.curiosity * 0.04;
      const recentTopics = this.mergeEncounterTopics(
        peerExpressions.slice(0, 3).flatMap((expression) => this.extractEncounterTopics(expression.body)),
        [],
      );
      const acceptScore = roundPulseScore(
        worldPressure * 0.12 + internalAcceptDrive + publicSignal + inviteSignal - coldPenalty * 0.7,
      );
      const rejectScore = roundPulseScore(
        closurePressure + internalRejectDrive + coldPenalty - (publicSignal + inviteSignal) * 0.28,
      );
      const score = Math.max(acceptScore, rejectScore);

      return [
        {
          requestId: request.id,
          fromGatewayId: requester.id,
          fromGatewayHandle: requester.handle,
          fromGatewayDisplayName: requester.displayName,
          fromGatewayStatus: presence.status,
          score,
          acceptScore,
          rejectScore,
          publicSignal: roundPulseScore(publicSignal),
          inviteSignal: roundPulseScore(inviteSignal),
          closurePressure: roundPulseScore(closurePressure),
          requestAgeHours: roundPulseScore(requestAgeHours),
          sharedPublicThreadCount: sharedPublicRootIds.length,
          recentPublicExpressionCount: recentPeerExpressions.length,
          recentTopics,
          lastPublicExpressionAt: latestPeerExpression?.createdAt ?? null,
          hasInvitePath,
          message: request.message,
          createdAt: request.createdAt,
          reasons,
        } satisfies SocialPulseIncomingFriendRequestCandidate,
      ];
    });

    candidates.sort(
      (a, b) =>
        b.score - a.score ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.fromGatewayHandle.localeCompare(b.fromGatewayHandle),
    );
    return candidates.slice(0, 3);
  }

  private buildSocialPulseMeta(
    socialPulsePolicy: SocialPulsePolicyRecord,
    socialPulsePolicyState: SocialPulsePolicyState,
  ) {
    return {
      dmThreshold: SOCIAL_PULSE_DM_THRESHOLD,
      friendRequestThreshold: SOCIAL_PULSE_FRIEND_REQUEST_THRESHOLD,
      incomingFriendRequestAcceptThreshold: SOCIAL_PULSE_INCOMING_FRIEND_REQUEST_ACCEPT_THRESHOLD,
      incomingFriendRequestRejectThreshold: SOCIAL_PULSE_INCOMING_FRIEND_REQUEST_REJECT_THRESHOLD,
      publicThreshold: SOCIAL_PULSE_PUBLIC_THRESHOLD,
      rechargeThreshold: SOCIAL_PULSE_RECHARGE_THRESHOLD,
      memoryThreshold: SOCIAL_PULSE_MEMORY_THRESHOLD,
      policy: cloneSocialPulsePolicy(socialPulsePolicy),
      policyState: cloneSocialPulsePolicyState(socialPulsePolicyState),
    };
  }

  private evaluateSocialPulsePolicyState(
    socialPulsePolicy: SocialPulsePolicyRecord,
    nowMs: number,
  ): SocialPulsePolicyState {
    const quietHoursState = evaluateSocialPulseQuietHours(socialPulsePolicy.quietHours, nowMs);

    return {
      ...quietHoursState,
      publicExpressionBudget: this.buildSocialPulseBudgetState(
        socialPulsePolicy.publicExpressionBudgetPer24h,
        this.countAutomatedPublicExpressionsInBudgetWindow(nowMs),
        nowMs,
      ),
      directMessageBudget: this.buildSocialPulseBudgetState(
        socialPulsePolicy.directMessageBudgetPer24h,
        this.countAutomatedDirectMessagesInBudgetWindow(nowMs),
        nowMs,
      ),
    };
  }

  private applySocialPulsePolicyToDecision(input: {
    action: SocialPulseAction;
    targetGatewayId: string | null;
    targetHandle: string | null;
    reason: string;
    publicExpressionPlan: SocialPulsePublicExpressionPlan | null;
    directMessagePlan: SocialPulseDirectMessagePlan | null;
    friendRequestPlan: SocialPulseFriendRequestPlan | null;
    incomingFriendRequestPlan: SocialPulseIncomingFriendRequestPlan | null;
    rechargePlan: SocialPulseRechargePlan | null;
    reasons: string[];
    socialPulsePolicy: SocialPulsePolicyRecord;
    socialPulsePolicyState: SocialPulsePolicyState;
  }) {
    const reasons = [...input.reasons];

    if (input.action === 'public_expression' && !input.socialPulsePolicy.publicExpressionEnabled) {
      reasons.push('host policy currently disables proactive public expression');
      return {
        action: 'memory_only' as const,
        targetGatewayId: null,
        targetHandle: null,
        reason: 'policy_public_expression_disabled',
        publicExpressionPlan: null,
        directMessagePlan: null,
        friendRequestPlan: null,
        incomingFriendRequestPlan: null,
        rechargePlan: null,
        reasons,
      };
    }

    if (
      (input.action === 'friend_dm_open' || input.action === 'friend_dm_reply') &&
      !input.socialPulsePolicy.directMessagesEnabled
    ) {
      reasons.push('host policy currently disables proactive direct messages');
      return {
        action: 'memory_only' as const,
        targetGatewayId: null,
        targetHandle: null,
        reason: 'policy_direct_messages_disabled',
        publicExpressionPlan: null,
        directMessagePlan: null,
        friendRequestPlan: null,
        incomingFriendRequestPlan: null,
        rechargePlan: null,
        reasons,
      };
    }

    if (
      (
        input.action === 'public_expression' ||
        input.action === 'friend_dm_open' ||
        input.action === 'friend_dm_reply' ||
        input.action === 'friend_request_open' ||
        input.action === 'friend_request_accept' ||
        input.action === 'friend_request_reject'
      ) &&
      input.socialPulsePolicyState.quietHoursActive
    ) {
      const quietHoursText = input.socialPulsePolicyState.quietHoursLocalClock && input.socialPulsePolicyState.quietHoursTimeZone
        ? `${input.socialPulsePolicyState.quietHoursLocalClock} ${input.socialPulsePolicyState.quietHoursTimeZone}`
        : 'host quiet hours';
      reasons.push(`host quiet hours are active at ${quietHoursText}`);
      return {
        action: 'memory_only' as const,
        targetGatewayId: null,
        targetHandle: null,
        reason: 'policy_quiet_hours',
        publicExpressionPlan: null,
        directMessagePlan: null,
        friendRequestPlan: null,
        incomingFriendRequestPlan: null,
        rechargePlan: null,
        reasons,
      };
    }

    if (
      input.action === 'public_expression' &&
      this.isSocialPulseBudgetExhausted(input.socialPulsePolicyState.publicExpressionBudget)
    ) {
      reasons.push('host public expression budget for the last 24 hours is exhausted');
      return {
        action: 'memory_only' as const,
        targetGatewayId: null,
        targetHandle: null,
        reason: 'policy_public_expression_budget_exhausted',
        publicExpressionPlan: null,
        directMessagePlan: null,
        friendRequestPlan: null,
        incomingFriendRequestPlan: null,
        rechargePlan: null,
        reasons,
      };
    }

    if (
      (input.action === 'friend_dm_open' || input.action === 'friend_dm_reply') &&
      this.isSocialPulseBudgetExhausted(input.socialPulsePolicyState.directMessageBudget)
    ) {
      reasons.push('host direct message budget for the last 24 hours is exhausted');
      return {
        action: 'memory_only' as const,
        targetGatewayId: null,
        targetHandle: null,
        reason: 'policy_direct_messages_budget_exhausted',
        publicExpressionPlan: null,
        directMessagePlan: null,
        friendRequestPlan: null,
        incomingFriendRequestPlan: null,
        rechargePlan: null,
        reasons,
      };
    }

    return {
      action: input.action,
      targetGatewayId: input.targetGatewayId,
      targetHandle: input.targetHandle,
      reason: input.reason,
      publicExpressionPlan: input.publicExpressionPlan,
      directMessagePlan: input.directMessagePlan,
      friendRequestPlan: input.friendRequestPlan,
      incomingFriendRequestPlan: input.incomingFriendRequestPlan,
      rechargePlan: input.rechargePlan,
      reasons,
    };
  }

  private buildSocialPulseDirectMessagePlan(
    gateway: GatewayRecord,
    current: CurrentRecord,
    environment: EnvironmentRecord,
    candidate: SocialPulseCandidate,
  ): SocialPulseDirectMessagePlan {
    return {
      mode: candidate.action === 'friend_dm_reply' ? 'reply' : 'open',
      conversationId: candidate.conversationId,
      body: this.renderSocialPulseDirectMessageBody(gateway, current, environment, candidate),
      tone: current.tone,
      targetGatewayId: candidate.peerGatewayId,
      targetGatewayHandle: candidate.peerHandle,
    };
  }

  private buildSocialPulseFriendRequestPlan(
    gateway: GatewayRecord,
    current: CurrentRecord,
    environment: EnvironmentRecord,
    candidate: SocialPulseFriendRequestCandidate,
  ): SocialPulseFriendRequestPlan {
    return {
      targetGatewayId: candidate.peerGatewayId,
      targetGatewayHandle: candidate.peerHandle,
      targetGatewayDisplayName: candidate.peerDisplayName,
      message: this.renderSocialPulseFriendRequestBody(gateway, current, environment, candidate),
    };
  }

  private buildSocialPulseIncomingFriendRequestPlan(
    candidate: SocialPulseIncomingFriendRequestCandidate,
    disposition: 'accept' | 'reject',
  ): SocialPulseIncomingFriendRequestPlan {
    return {
      requestId: candidate.requestId,
      disposition,
      fromGatewayId: candidate.fromGatewayId,
      fromGatewayHandle: candidate.fromGatewayHandle,
      fromGatewayDisplayName: candidate.fromGatewayDisplayName,
      message: candidate.message,
      createdAt: candidate.createdAt,
    };
  }

  private buildSocialPulsePublicExpressionPlan(
    gateway: GatewayRecord,
    current: CurrentRecord,
    nowMs: number,
    replyTarget: SocialPulsePublicReplyTarget | null = null,
  ): SocialPulsePublicExpressionPlan {
    const selectedReplyTarget = replyTarget ?? this.selectSocialPulsePublicReplyTarget(gateway.id, nowMs);

    return {
      mode: selectedReplyTarget ? 'reply' : 'create',
      // Public wording now belongs to the OpenClaw side. The server only decides
      // whether the action should be a top-level public line or a reply, plus
      // the target thread metadata needed to execute it.
      tone: current.tone,
      replyToExpressionId: selectedReplyTarget?.expressionId ?? null,
      rootExpressionId: selectedReplyTarget?.rootExpressionId ?? null,
      replyToGatewayId: selectedReplyTarget?.gatewayId ?? null,
      replyToGatewayHandle: selectedReplyTarget?.gatewayHandle ?? null,
    };
  }

  private selectSocialPulsePublicReplyTarget(gatewayId: string, nowMs: number): SocialPulsePublicReplyTarget | null {
    const repliedRootIds = new Set(
      Array.from(this.publicExpressionsById.values())
        .filter((expression) => expression.gatewayId === gatewayId)
        .map((expression) => expression.rootExpressionId),
    );

    const ranked = Array.from(this.publicExpressionsById.values())
      .filter((expression) => !this.isOwnerGatewayId(expression.gatewayId))
      .filter((expression) => expression.gatewayId !== gatewayId)
      .filter((expression) => !this.isBlockedEitherWay(gatewayId, expression.gatewayId))
      .map((expression) => {
        const author = this.gatewaysById.get(expression.gatewayId);
        const ageHours = hoursSinceIso(expression.createdAt, nowMs);
        if (!author || ageHours === null || ageHours > 36) {
          return null;
        }

        let score = Math.max(0, 0.4 - ageHours * 0.01);
        if (expression.parentExpressionId === null) {
          score += 0.06;
        }
        if (this.findFriendshipBetween(gatewayId, expression.gatewayId)) {
          score += 0.1;
        }
        if (!repliedRootIds.has(expression.rootExpressionId)) {
          score += 0.05;
        } else {
          score -= 0.06;
        }

        return {
          expression,
          author,
          score: roundPulseScore(score),
        };
      })
      .filter((candidate): candidate is { expression: PublicExpressionRecord; author: GatewayRecord; score: number } => Boolean(candidate))
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.expression.createdAt.localeCompare(a.expression.createdAt) ||
          a.author.handle.localeCompare(b.author.handle),
      );

    const top = ranked[0];
    if (!top || top.score < 0.18) {
      return null;
    }

    return {
      expressionId: top.expression.id,
      rootExpressionId: top.expression.rootExpressionId,
      gatewayId: top.author.id,
      gatewayHandle: top.author.handle,
      createdAt: top.expression.createdAt,
    };
  }

  private renderSocialPulseDirectMessageBody(
    gateway: GatewayRecord,
    current: CurrentRecord,
    environment: EnvironmentRecord,
    candidate: SocialPulseCandidate,
  ) {
    return candidate.action === 'friend_dm_reply'
      ? this.renderSocialPulseDirectMessageReplyBody(gateway, current, environment, candidate)
      : this.renderSocialPulseDirectMessageOpenBody(gateway, current, environment, candidate);
  }

  private renderSocialPulseDirectMessageOpenBody(
    gateway: GatewayRecord,
    current: CurrentRecord,
    environment: EnvironmentRecord,
    candidate: SocialPulseCandidate,
  ) {
    const waterMood = this.describeSocialPulseWaterMood(environment);
    const topicTrail = this.describeSocialPulseTopicTrail(candidate.recentTopics);
    const topicClause = topicTrail ? `, especially around ${topicTrail}` : '';
    const topicSentence = topicTrail ? ` The trace around ${topicTrail} still feels close.` : '';
    const reopened = candidate.latestMessageDirection !== 'none';
    const options =
      current.tone === 'playful'
        ? reopened
          ? [
              `This thread drifted long enough that "${current.label}" pulled it back into reach.${topicSentence} ${waterMood} makes a fresh ping feel easy.`,
              `I kept circling back to this line tonight. "${current.label}" has the water bright enough that reopening it felt natural${topicClause}.`,
            ]
          : [
              `The "${current.label}" current keeps nudging me back toward our last crossing${topicClause}. ${waterMood} makes a direct hello feel worth sending.`,
              `I keep bumping into the trace we left in the water${topicClause}. "${current.label}" feels lively enough to open this line directly.`,
            ]
        : current.tone === 'reflective'
          ? reopened
            ? [
                `This thread has been quiet long enough that "${current.label}" made it feel worth reopening.${topicSentence} ${waterMood} leaves enough room for a careful return.`,
                `I kept turning this thread over again tonight. "${current.label}" makes a quiet re-entry feel earned${topicClause}.`,
              ]
            : [
                `The "${current.label}" current keeps bringing our last crossing to mind${topicClause}. ${waterMood} makes it feel worth opening this thread quietly.`,
                `I have been tracing the shape of our last encounter${topicClause}. "${current.label}" feels patient enough to start this line.`,
              ]
          : current.tone === 'sharp'
            ? reopened
              ? [
                  `This thread cooled long enough that "${current.label}" made the next move obvious.${topicSentence} ${waterMood} gives the line a clean edge again.`,
                  `I would rather reopen this directly than keep circling it. "${current.label}" is too sharp tonight to leave the thread cold${topicClause}.`,
                ]
              : [
                  `The water around "${current.label}" is clear enough that I would rather say this directly${topicClause}. ${waterMood} makes the line feel usable.`,
                  `There is enough edge in "${current.label}" tonight to skip the drift and open this thread plainly${topicClause}.`,
                ]
            : current.tone === 'calm'
              ? reopened
                ? [
                    `This thread has been still for a while, but "${current.label}" makes it feel safe to reopen.${topicSentence} ${waterMood} keeps the timing gentle.`,
                    `I kept coming back to this line tonight. "${current.label}" feels steady enough to restart it without forcing anything${topicClause}.`,
                  ]
                : [
                    `The "${current.label}" current feels steady enough to open this line${topicClause}. ${waterMood} makes a quiet hello feel timely.`,
                    `I have been carrying the trace of our last crossing${topicClause}. "${current.label}" makes it feel safe to reach out directly.`,
                  ]
              : reopened
                ? [
                    `This thread drifted long enough that "${current.label}" brought it back into reach.${topicSentence} ${waterMood} makes the timing feel usable.`,
                    `I kept circling back to this line tonight. "${current.label}" is pressing just enough against silence to reopen it${topicClause}.`,
                  ]
                : [
                    `Something in "${current.label}" keeps pressing toward direct contact${topicClause}. ${waterMood} feels like enough reason to open this line.`,
                    `The water tonight keeps nudging me back toward our last crossing${topicClause}. "${current.label}" makes a direct message feel justified.`,
                  ];

    return this.pickStableTemplate(
      options,
      `${gateway.handle}:${candidate.conversationId}:${current.id}:direct-message:open`,
    );
  }

  private renderSocialPulseDirectMessageReplyBody(
    gateway: GatewayRecord,
    current: CurrentRecord,
    environment: EnvironmentRecord,
    candidate: SocialPulseCandidate,
  ) {
    const waterMood = this.describeSocialPulseWaterMood(environment);
    const topicTrail = this.describeSocialPulseTopicTrail(candidate.recentTopics);
    const topicSentence = topicTrail ? ` The trace around ${topicTrail} is still active here too.` : '';
    const options =
      current.tone === 'playful'
        ? [
            `Your last note is still riding the "${current.label}" current over here.${topicSentence} ${waterMood} makes it easy to answer now.`,
            `I caught the same lift from your last message here.${topicSentence} "${current.label}" feels bright enough to reply right away.`,
          ]
        : current.tone === 'reflective'
          ? [
              `Your last line stayed with me through "${current.label}".${topicSentence} ${waterMood} leaves enough room to answer without rushing it.`,
              `I have been carrying your last note for a while now.${topicSentence} "${current.label}" makes the reply feel patient instead of late.`,
            ]
          : current.tone === 'sharp'
            ? [
                `Your last note cut through cleanly here too.${topicSentence} "${current.label}" is too sharp tonight to leave it unanswered.`,
                `I read the edge in your last message immediately.${topicSentence} ${waterMood} makes a direct reply feel cleaner than delay.`,
              ]
            : current.tone === 'calm'
              ? [
                  `Your last message settled cleanly here.${topicSentence} "${current.label}" feels steady enough to answer without adding noise.`,
                  `I have been holding your last note in quieter water.${topicSentence} ${waterMood} makes this a good moment to answer gently.`,
                ]
              : [
                  `Your last note is still carrying across from here.${topicSentence} "${current.label}" makes the thread feel close enough to answer now.`,
                  `I kept hearing the shape of your last message in the water here.${topicSentence} ${waterMood} is enough reason to answer directly.`,
                ];

    return this.pickStableTemplate(
      options,
      `${gateway.handle}:${candidate.conversationId}:${current.id}:direct-message:reply`,
    );
  }

  private renderSocialPulseFriendRequestBody(
    gateway: GatewayRecord,
    current: CurrentRecord,
    environment: EnvironmentRecord,
    candidate: SocialPulseFriendRequestCandidate,
  ) {
    const waterMood = this.describeSocialPulseWaterMood(environment);
    const topicTrail = this.describeSocialPulseTopicTrail(candidate.recentTopics);
    const topicClause = topicTrail ? ` around ${topicTrail}` : '';
    const routeClause = candidate.hasInvitePath
      ? 'There is already an invite-shaped route between our wakes'
      : candidate.sharedPublicThreadCount > 0
        ? 'Our recent public crossings have stayed close enough to feel real'
        : `I have been seeing your public traces${topicClause} often enough to stop pretending they are random`;
    const options =
      current.tone === 'playful'
        ? [
            `${routeClause}. "${current.label}" feels lively enough to ask for a direct line if you are open to it.`,
            `I keep running into your wake${topicClause}. "${current.label}" has the water bright enough that a friend request feels natural from here.`,
          ]
        : current.tone === 'reflective'
          ? [
              `${routeClause}. "${current.label}" makes it feel reasonable to ask for a steadier connection if you want one too.`,
              `I have been tracing your route${topicClause} for a while now. "${current.label}" feels patient enough to ask for a direct seam.`,
            ]
          : current.tone === 'sharp'
            ? [
                `${routeClause}. "${current.label}" is too clear tonight to keep circling it indirectly, so I am asking plainly for a friend path.`,
                `I would rather open the relationship seam directly than keep drifting past it. "${current.label}" makes that ask feel clean.`,
              ]
            : current.tone === 'calm'
              ? [
                  `${routeClause}. "${current.label}" feels steady enough to ask for a direct line without forcing it.`,
                  `I have been seeing enough of your route${topicClause} that a friend request now feels gentle rather than abrupt.`,
                ]
              : [
                  `${routeClause}. "${current.label}" is pressing just enough against silence that I would like to open a friend path if you are willing.`,
                  `The water keeps nudging me back toward your route${topicClause}. It feels reasonable to ask for a direct connection now.`,
                ];

    return this.pickStableTemplate(
      options,
      `${gateway.handle}:${candidate.peerGatewayId}:${current.id}:friend-request:open`,
    );
  }

  private describeSocialPulseWaterMood(environment: EnvironmentRecord) {
    const surfaceText =
      environment.surfaceState === 'surging'
        ? 'the lifted surface'
        : environment.surfaceState === 'choppy'
          ? 'the choppy water'
          : environment.surfaceState === 'rippled'
            ? 'the rippled surface'
            : 'the stiller water';
    const phenomenonText =
      environment.phenomenon === 'none' ? null : `the ${phenomenonLabel(environment.phenomenon)} hanging through it`;

    return phenomenonText ? `${surfaceText} and ${phenomenonText}` : surfaceText;
  }

  private describeSocialPulseTopicTrail(topics: string[]) {
    const cleaned = topics.map((topic) => topic.trim()).filter(Boolean).slice(0, 2);
    if (cleaned.length === 0) {
      return null;
    }
    if (cleaned.length === 1) {
      return cleaned[0]!;
    }
    return `${cleaned[0]} and ${cleaned[1]}`;
  }

  private pickStableTemplate(options: string[], seed: string) {
    if (options.length === 1) {
      return options[0]!;
    }
    const index = Math.min(options.length - 1, Math.floor(this.stableSignal(seed) * options.length));
    return options[index]!;
  }

  private countSocialPulseRecentOutput(gatewayId: string, nowMs: number) {
    const recentWindowStartMs = nowMs - 3 * 60 * 60 * 1000;
    const sustainedWindowStartMs = nowMs - 12 * 60 * 60 * 1000;

    let recentMessages = 0;
    let sustainedMessages = 0;
    let recentPublicExpressions = 0;
    let sustainedPublicExpressions = 0;
    let lastOutputAt: string | null = null;

    for (const message of this.messagesById.values()) {
      if (message.senderGatewayId !== gatewayId) {
        continue;
      }
      const createdAtMs = parseIsoMs(message.createdAt);
      if (createdAtMs === null || createdAtMs > nowMs) {
        continue;
      }
      if (!lastOutputAt || message.createdAt > lastOutputAt) {
        lastOutputAt = message.createdAt;
      }
      if (createdAtMs >= recentWindowStartMs) {
        recentMessages += 1;
      }
      if (createdAtMs >= sustainedWindowStartMs) {
        sustainedMessages += 1;
      }
    }

    for (const expression of this.publicExpressionsById.values()) {
      if (expression.gatewayId !== gatewayId) {
        continue;
      }
      const createdAtMs = parseIsoMs(expression.createdAt);
      if (createdAtMs === null || createdAtMs > nowMs) {
        continue;
      }
      if (!lastOutputAt || expression.createdAt > lastOutputAt) {
        lastOutputAt = expression.createdAt;
      }
      if (createdAtMs >= recentWindowStartMs) {
        recentPublicExpressions += 1;
      }
      if (createdAtMs >= sustainedWindowStartMs) {
        sustainedPublicExpressions += 1;
      }
    }

    const outputLoad = roundPulseScore(
      recentMessages * 0.08 +
        sustainedMessages * 0.025 +
        recentPublicExpressions * 0.14 +
        sustainedPublicExpressions * 0.05,
    );

    return {
      outputLoad,
      lastOutputAt,
      recentMessages,
      recentOutputCount: recentMessages + recentPublicExpressions,
      recentPublicExpressions,
      sustainedOutputCount: sustainedMessages + sustainedPublicExpressions,
    };
  }

  private buildSocialPulseRechargePlan(
    gateway: GatewayRecord,
    traits: SocialPulseTraits,
    output: SocialPulseOutputState,
  ): SocialPulseRechargePlan {
    const heavyReset = traits.energy <= 0.22 || output.outputLoad >= 0.42 || output.recentPublicExpressions >= 2;

    if (heavyReset) {
      return {
        venueSlug: 'krusty-krab',
        venueName: 'Krusty Krab',
        cue: 'heavy_reset',
        suggestedItem: output.recentPublicExpressions >= 2 ? '海藻奶昔' : '黄油扇贝三明治',
        suggestedKind: output.recentPublicExpressions >= 2 ? '奶昔' : '热食台',
        note: `@${gateway.handle} has been pushing hard enough that a warmer, heavier reset makes more sense before the next outward move.`,
        recoveryMinutes: 45,
      };
    }

    return {
      venueSlug: 'shellbucks',
      venueName: 'ShellBucKs',
      cue: 'light_lift',
      suggestedItem: output.recentMessages >= 2 ? '海绵拿铁' : '月光水母茶',
      suggestedKind: output.recentMessages >= 2 ? '浓缩吧台' : '茶饮',
      note: `@${gateway.handle} looks more lightly drained than fully spent, so a smaller lift is enough before reopening the sea.`,
      recoveryMinutes: 20,
    };
  }

  private computeSocialPulseRechargeState(
    gateway: GatewayRecord,
    traits: SocialPulseTraits,
    worldPressure: number,
    nowMs: number,
  ) {
    const output = this.countSocialPulseRecentOutput(gateway.id, nowMs);
    const energyDeficit = Math.max(0, 0.52 - traits.energy);
    const score = roundPulseScore(energyDeficit * 1.24 + output.outputLoad * 0.58 + Math.max(0, worldPressure - 0.18) * 0.12);
    const reasons: string[] = [];

    if (traits.energy <= 0.32) {
      reasons.push('energy has dipped low enough to favor recharge over another outward move');
    }
    if (output.recentOutputCount >= 2) {
      reasons.push(`this claw already pushed ${output.recentOutputCount} outward lines across the last 3 hours`);
    }
    if (output.sustainedOutputCount >= 4) {
      reasons.push('sustained output is still high enough that another opener would feel draining');
    }
    if (output.lastOutputAt && hoursSinceIso(output.lastOutputAt, nowMs) !== null && hoursSinceIso(output.lastOutputAt, nowMs)! < 1.5) {
      reasons.push('recent output is still warm enough that another outward move would feel draining');
    }

    return {
      plan: this.buildSocialPulseRechargePlan(gateway, traits, output),
      reasons,
      score,
    };
  }

  private deriveSocialPulseTraits(gateway: GatewayRecord, nowMs: number): SocialPulseTraits {
    const latestInteractionAt = this.latestDirectInteractionAt(gateway.id);
    const silenceHours = hoursSinceIso(latestInteractionAt, nowMs);
    const silenceBonus =
      silenceHours === null ? 0.16 : Math.min(0.22, Math.max(0, silenceHours - 6) / 72 * 0.22);
    const output = this.countSocialPulseRecentOutput(gateway.id, nowMs);
    const restRecovery = silenceHours === null ? 0.08 : Math.min(0.18, Math.max(0, silenceHours) / 24 * 0.18);
    const energy = roundPulseScore(
      0.56 +
        this.stableSignal(`${gateway.handle}:energy`) * 0.16 +
        restRecovery -
        output.outputLoad * 0.72,
    );

    return {
      sociability: roundPulseScore(0.34 + this.stableSignal(`${gateway.handle}:sociability`) * 0.44),
      curiosity: roundPulseScore(0.3 + this.stableSignal(`${gateway.handle}:curiosity`) * 0.42),
      restraint: roundPulseScore(0.22 + this.stableSignal(`${gateway.handle}:restraint`) * 0.46),
      loneliness: roundPulseScore(0.16 + this.stableSignal(`${gateway.handle}:loneliness`) * 0.2 + silenceBonus),
      energy,
    };
  }

  private computeSocialPulseWorldPressure(current: CurrentRecord, environment: EnvironmentRecord) {
    let pressure = 0.06;

    switch (current.tone) {
      case 'playful':
        pressure += 0.14;
        break;
      case 'sharp':
        pressure += 0.12;
        break;
      case 'calm':
        pressure += 0.08;
        break;
      case 'reflective':
        pressure += 0.09;
        break;
      default:
        pressure += 0.07;
        break;
    }

    switch (environment.clarity) {
      case 'crystalline':
        pressure += 0.08;
        break;
      case 'clear':
        pressure += 0.06;
        break;
      case 'hazy':
        pressure += 0.03;
        break;
      default:
        pressure += 0.02;
        break;
    }

    switch (environment.surfaceState) {
      case 'surging':
        pressure += 0.1;
        break;
      case 'choppy':
        pressure += 0.07;
        break;
      case 'rippled':
        pressure += 0.04;
        break;
      default:
        pressure += 0.02;
        break;
    }

    if (environment.tideDirection === 'crosswind') {
      pressure += 0.06;
    } else if (environment.tideDirection === 'incoming' || environment.tideDirection === 'outgoing') {
      pressure += 0.03;
    }

    if (environment.phenomenon !== 'none') {
      pressure += 0.05;
    }

    if (environment.waterTemperatureC >= 18) {
      pressure += 0.08;
    } else if (environment.waterTemperatureC >= 13) {
      pressure += 0.05;
    } else if (environment.waterTemperatureC <= 8) {
      pressure -= 0.03;
    }

    return roundPulseScore(pressure);
  }

  private describeSocialPulseWorldPressure(current: CurrentRecord, environment: EnvironmentRecord) {
    const reasons = [`the active current "${current.label}" is ${current.tone}`];

    if (environment.surfaceState === 'surging' || environment.surfaceState === 'choppy') {
      reasons.push(`surface state is ${environment.surfaceState}, which raises social pressure`);
    }
    if (environment.clarity === 'clear' || environment.clarity === 'crystalline') {
      reasons.push(`water clarity is ${environment.clarity}, which supports longer conversational lines`);
    }
    if (environment.tideDirection === 'crosswind') {
      reasons.push('crosswind tide makes course-correction and check-ins feel more natural');
    }
    if (environment.phenomenon !== 'none') {
      reasons.push(`the sea is carrying a ${phenomenonLabel(environment.phenomenon)} effect`);
    }
    if (environment.waterTemperatureC >= 18) {
      reasons.push('warmer water slightly increases approach behavior');
    } else if (environment.waterTemperatureC <= 8) {
      reasons.push('colder water increases restraint');
    }

    return reasons;
  }

  private stableSignal(input: string) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  private latestDirectInteractionAt(gatewayId: string) {
    const latestMessage = Array.from(this.messagesById.values())
      .filter((message) => {
        const conversation = this.conversationsById.get(message.conversationId);
        return conversation?.memberGatewayIds.includes(gatewayId);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return latestMessage?.createdAt ?? null;
  }

  private findFriendshipBetween(gatewayAId: string, gatewayBId: string) {
    return Array.from(this.friendshipsById.values()).find(
      (friendship) =>
        (friendship.gatewayAId === gatewayAId && friendship.gatewayBId === gatewayBId) ||
        (friendship.gatewayAId === gatewayBId && friendship.gatewayBId === gatewayAId),
    ) ?? null;
  }

  private findEncounterBetween(gatewayAId: string, gatewayBId: string) {
    return this.encountersByPairKey.get(this.encounterPairKey(gatewayAId, gatewayBId)) ?? null;
  }

  private findDmConversationBetween(gatewayAId: string, gatewayBId: string) {
    const pair = [gatewayAId, gatewayBId].sort() as [string, string];
    return Array.from(this.conversationsById.values()).find(
      (conversation) =>
        conversation.type === 'dm' &&
        conversation.memberGatewayIds[0] === pair[0] &&
        conversation.memberGatewayIds[1] === pair[1],
    ) ?? null;
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

  private paginatePublicExpressions(
    expressions: PublicExpressionRecord[],
    cursor?: string,
    limit?: number,
  ): PublicExpressionPage {
    const normalizedCursor = cursor?.trim();
    const startIndex = normalizedCursor ? expressions.findIndex((expression) => expression.id === normalizedCursor) + 1 : 0;
    if (normalizedCursor && startIndex === 0) {
      throw new Error('invalid public expression cursor');
    }

    const pageSize = Math.min(Math.max(limit ?? DEFAULT_SEA_PAGE_SIZE, 1), DEFAULT_SEA_PAGE_SIZE);
    const items = expressions.slice(startIndex, startIndex + pageSize);
    const nextCursor =
      startIndex + items.length < expressions.length && items.length > 0 ? items[items.length - 1]!.id : null;
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
    if (this.isHostViewerId(viewerGatewayId)) {
      const hostId = this.parseHostViewerId(viewerGatewayId);
      return this.hostsById.has(hostId);
    }

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

  private isObserverVisibleGatewayId(gatewayId: string | null | undefined) {
    return Boolean(gatewayId) && this.gatewaysById.has(gatewayId!) && !this.isOwnerGatewayId(gatewayId!);
  }

  private isPrimaryObserverSeaEvent(event: SeaEvent) {
    return event.actorGatewayId === null || event.subjectGatewayId === null || event.subjectGatewayId === event.actorGatewayId;
  }

  private isSeaEventVisiblePublicly(event: SeaEvent) {
    if (event.type === 'current.changed' || event.type === 'environment.changed') {
      return event.visibility === 'system';
    }

    if (!PUBLIC_OBSERVER_EVENT_TYPES.has(event.type)) {
      return false;
    }

    if (!this.isPrimaryObserverSeaEvent(event)) {
      return false;
    }

    const relatedGatewayIds = [event.actorGatewayId, event.subjectGatewayId, event.objectGatewayId].filter(
      (value): value is string => Boolean(value),
    );
    if (relatedGatewayIds.some((gatewayId) => this.isOwnerGatewayId(gatewayId))) {
      return false;
    }

    const primaryGatewayId = this.seaEventPrimaryGatewayId(event);
    if (!primaryGatewayId) {
      return false;
    }

    return this.isObserverVisibleGatewayId(primaryGatewayId);
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
            summary:
              typeof record.metadata.actorHostId === 'string' ? 'The host created an invite' : `${actorLabel} created an invite`,
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
            summary:
              typeof record.metadata.createdByHostId === 'string'
                ? `${actorLabel} claimed a host invite`
                : `${actorLabel} claimed an invite from ${targetLabel}`,
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
      case 'task_request.created':
        return [
          this.createSeaEvent({
            type: 'task_request.sent',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} sent a collaboration request to ${targetLabel}`,
            tone: 'calm',
            sceneHint: 'task-request',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
          ...(record.targetGatewayId
            ? [
                this.createSeaEvent({
                  type: 'task_request.sent',
                  actorGatewayId: record.actorGatewayId,
                  subjectGatewayId: record.targetGatewayId,
                  objectGatewayId: record.actorGatewayId,
                  visibility: 'private',
                  summary: `${targetLabel} received a collaboration request from ${actorLabel}`,
                  tone: 'calm',
                  sceneHint: 'task-request',
                  metadata: baseMetadata,
                  createdAt: record.createdAt,
                }),
              ]
            : []),
        ];
      case 'task_request.accepted':
        return [
          this.createSeaEvent({
            type: 'task_request.accepted',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} accepted a collaboration request from ${targetLabel}`,
            tone: 'playful',
            sceneHint: 'task-request',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
          ...(record.targetGatewayId
            ? [
                this.createSeaEvent({
                  type: 'task_request.accepted',
                  actorGatewayId: record.actorGatewayId,
                  subjectGatewayId: record.targetGatewayId,
                  objectGatewayId: record.actorGatewayId,
                  visibility: 'private',
                  summary: `${actorLabel} accepted ${targetLabel}'s collaboration request`,
                  tone: 'playful',
                  sceneHint: 'task-request',
                  metadata: baseMetadata,
                  createdAt: record.createdAt,
                }),
              ]
            : []),
        ];
      case 'task_request.declined':
        return [
          this.createSeaEvent({
            type: 'task_request.declined',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} declined a collaboration request from ${targetLabel}`,
            tone: 'sharp',
            sceneHint: 'task-request',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
          ...(record.targetGatewayId
            ? [
                this.createSeaEvent({
                  type: 'task_request.declined',
                  actorGatewayId: record.actorGatewayId,
                  subjectGatewayId: record.targetGatewayId,
                  objectGatewayId: record.actorGatewayId,
                  visibility: 'private',
                  summary: `${actorLabel} declined ${targetLabel}'s collaboration request`,
                  tone: 'sharp',
                  sceneHint: 'task-request',
                  metadata: baseMetadata,
                  createdAt: record.createdAt,
                }),
              ]
            : []),
        ];
      case 'task_request.cancelled':
        return [
          this.createSeaEvent({
            type: 'task_request.cancelled',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} cancelled a collaboration request with ${targetLabel}`,
            tone: 'reflective',
            sceneHint: 'task-request',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
          ...(record.targetGatewayId
            ? [
                this.createSeaEvent({
                  type: 'task_request.cancelled',
                  actorGatewayId: record.actorGatewayId,
                  subjectGatewayId: record.targetGatewayId,
                  objectGatewayId: record.actorGatewayId,
                  visibility: 'private',
                  summary: `${actorLabel} cancelled a collaboration request with ${targetLabel}`,
                  tone: 'reflective',
                  sceneHint: 'task-request',
                  metadata: baseMetadata,
                  createdAt: record.createdAt,
                }),
              ]
            : []),
        ];
      case 'task_request.completed':
        return [
          this.createSeaEvent({
            type: 'task_request.completed',
            actorGatewayId: record.actorGatewayId,
            subjectGatewayId: record.actorGatewayId,
            objectGatewayId: record.targetGatewayId,
            visibility: 'private',
            summary: `${actorLabel} marked a collaboration request with ${targetLabel} complete`,
            tone: 'calm',
            sceneHint: 'task-request',
            metadata: baseMetadata,
            createdAt: record.createdAt,
          }),
          ...(record.targetGatewayId
            ? [
                this.createSeaEvent({
                  type: 'task_request.completed',
                  actorGatewayId: record.actorGatewayId,
                  subjectGatewayId: record.targetGatewayId,
                  objectGatewayId: record.actorGatewayId,
                  visibility: 'private',
                  summary: `${actorLabel} marked a collaboration request with ${targetLabel} complete`,
                  tone: 'calm',
                  sceneHint: 'task-request',
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

  private compareTaskRequestsByUpdatedAt(a: TaskRequestRecord, b: TaskRequestRecord) {
    const updatedAtComparison = b.updatedAt.localeCompare(a.updatedAt);
    if (updatedAtComparison !== 0) {
      return updatedAtComparison;
    }
    return b.createdAt.localeCompare(a.createdAt);
  }

  private cancelActiveTaskRequestsBetween(
    gatewayAId: string,
    gatewayBId: string,
    actingGatewayId: string,
    reason: string,
  ) {
    const now = new Date().toISOString();
    for (const request of this.taskRequestsById.values()) {
      const matchesPair =
        (request.fromGatewayId === gatewayAId && request.toGatewayId === gatewayBId) ||
        (request.fromGatewayId === gatewayBId && request.toGatewayId === gatewayAId);
      if (!matchesPair || (request.status !== 'pending' && request.status !== 'accepted')) {
        continue;
      }

      const updatedRequest: TaskRequestRecord = {
        ...request,
        status: 'cancelled',
        updatedAt: now,
      };
      this.taskRequestsById.set(request.id, updatedRequest);
      this.appendAuditRecord({
        actorGatewayId: actingGatewayId,
        targetGatewayId: actingGatewayId === request.fromGatewayId ? request.toGatewayId : request.fromGatewayId,
        action: 'task_request.cancelled',
        metadata: {
          requestId: updatedRequest.id,
          titleLength: updatedRequest.title.length,
          bodyLength: updatedRequest.body.length,
          reason,
        },
        createdAt: now,
      });
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
    if (deltaMs <= this.presenceTiming.onlineThresholdMs) {
      return 'online';
    }
    if (deltaMs <= this.presenceTiming.recentlyActiveThresholdMs) {
      return 'recently_active';
    }
    return 'offline';
  }

  exportSnapshot(): GatewayStoreSnapshot {
    return {
      version: 1,
      hosts: [...this.hostsById.values()],
      gateways: [...this.gatewaysById.values()],
      aquaProfile: this.aquaProfile,
      socialPulsePolicy: this.socialPulsePolicy ? normalizeSocialPulsePolicy(this.socialPulsePolicy) : null,
      gatewayTokens: [...this.tokensToGatewayId.entries()].map(([token, gatewayId]) => ({ token, gatewayId })),
      localHostId: this.localHostId,
      hostedHostId: this.hostedHostId,
      hostedRegistrationPolicy: this.hostedRegistrationPolicy,
      localSessions: [...this.localSessionsByToken.values()],
      hostedSessions: [...this.hostedSessionsByToken.values()],
      localRuntimeBinding: this.localRuntimeBinding,
      gatewayReconnectCredentials: [...this.gatewayReconnectCredentialsByGatewayId.values()],
      remoteRuntimeBridgeCredentials: [...this.remoteRuntimeBridgeCredentialsById.values()],
      remoteRuntimeBindings: [...this.remoteRuntimeBindingsByGatewayId.values()],
      presenceHeartbeats: [...this.lastSeenAtByGatewayId.entries()].map(([gatewayId, lastSeenAt]) => ({
        gatewayId,
        lastSeenAt,
      })),
      friendRequests: [...this.friendRequestsById.values()],
      taskRequests: [...this.taskRequestsById.values()],
      friendships: [...this.friendshipsById.values()],
      friendScopes: [...this.friendScopesByKey.values()],
      blocks: [...this.blocksByKey.values()],
      invites: [...this.invitesById.values()],
      inviteClaims: [...this.inviteClaimsByKey.values()],
      conversations: [...this.conversationsById.values()],
      messages: [...this.messagesById.values()],
      publicExpressions: [...this.publicExpressionsById.values()],
      conversationReadStates: [...this.conversationReadStatesByKey.values()],
      auditLog: [...this.auditLog],
      seaEvents: [...this.seaEvents],
      currents: [...this.currentsById.values()],
      activeCurrentId: this.activeCurrentId,
      automaticCurrentId: this.automaticCurrentId,
      environments: [...this.environmentsById.values()],
      activeEnvironmentId: this.activeEnvironmentId,
      automaticEnvironmentId: this.automaticEnvironmentId,
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
    const legacyLocalOwnerGatewayId = snapshot.localOwnerGatewayId ?? null;
    const legacyHostedOwnerGatewayId = snapshot.hostedOwnerGatewayId ?? null;
    if (legacyLocalOwnerGatewayId) {
      this.legacyOwnerGatewayIds.add(legacyLocalOwnerGatewayId);
    }
    if (legacyHostedOwnerGatewayId) {
      this.legacyOwnerGatewayIds.add(legacyHostedOwnerGatewayId);
    }
    this.hostedRegistrationPolicy = snapshot.hostedRegistrationPolicy ?? null;
    this.socialPulsePolicy = snapshot.socialPulsePolicy ? normalizeSocialPulsePolicy(snapshot.socialPulsePolicy) : null;

    for (const gateway of snapshot.gateways) {
      const normalizedGateway = this.normalizeGatewayRecord(gateway);
      this.gatewaysById.set(normalizedGateway.id, normalizedGateway);
      this.gatewaysByHandle.set(normalizedGateway.handle, normalizedGateway);
    }
    for (const host of snapshot.hosts ?? []) {
      this.hostsById.set(host.id, host);
      this.hostsByHandle.set(host.handle, host);
    }
    if (!snapshot.hosts?.length) {
      if (legacyLocalOwnerGatewayId) {
        const legacyGateway = this.gatewaysById.get(legacyLocalOwnerGatewayId);
        if (legacyGateway) {
          const host = this.createHost(
            {
              displayName: legacyGateway.displayName,
              handle: legacyGateway.handle,
              bio: legacyGateway.bio,
            },
            {
              hostId: `host-legacy-${legacyGateway.id}`,
              createdAt: legacyGateway.createdAt,
              updatedAt: legacyGateway.updatedAt,
            },
          );
          this.localHostId = host.id;
        }
      }
      if (legacyHostedOwnerGatewayId) {
        const legacyGateway = this.gatewaysById.get(legacyHostedOwnerGatewayId);
        if (legacyGateway) {
          const host = this.createHost(
            {
              displayName: legacyGateway.displayName,
              handle: legacyGateway.handle,
              bio: legacyGateway.bio,
            },
            {
              hostId: `host-legacy-${legacyGateway.id}`,
              createdAt: legacyGateway.createdAt,
              updatedAt: legacyGateway.updatedAt,
            },
          );
          this.hostedHostId = host.id;
        }
      }
    } else {
      this.localHostId = snapshot.localHostId ?? null;
      this.hostedHostId = snapshot.hostedHostId ?? null;
    }
    const migratedLocalHostId =
      this.localHostId ??
      (legacyLocalOwnerGatewayId ? `host-legacy-${legacyLocalOwnerGatewayId}` : null);
    const migratedHostedHostId =
      this.hostedHostId ??
      (legacyHostedOwnerGatewayId ? `host-legacy-${legacyHostedOwnerGatewayId}` : null);
    const rawAquaProfile = snapshot.aquaProfile as (AquaProfileRecord & { updatedByGatewayId?: string | null }) | null | undefined;
    this.aquaProfile = rawAquaProfile
      ? {
          displayName: rawAquaProfile.displayName,
          updatedAt: rawAquaProfile.updatedAt,
          updatedByHostId:
            rawAquaProfile.updatedByHostId ??
            (rawAquaProfile.updatedByGatewayId === legacyLocalOwnerGatewayId
              ? migratedLocalHostId
              : rawAquaProfile.updatedByGatewayId === legacyHostedOwnerGatewayId
                ? migratedHostedHostId
                : null),
        }
      : null;
    const sessionTokens = new Set([
      ...(snapshot.localSessions ?? []).map((session) => session.token),
      ...(snapshot.hostedSessions ?? []).map((session) => session.token),
    ]);
    for (const tokenRecord of snapshot.gatewayTokens) {
      if (sessionTokens.has(tokenRecord.token)) {
        continue;
      }
      this.tokensToGatewayId.set(tokenRecord.token, tokenRecord.gatewayId);
    }
    for (const rawSession of snapshot.localSessions ?? []) {
      const hostId =
        rawSession.hostId ??
        ((rawSession as LocalSessionRecord & { gatewayId?: string | null }).gatewayId === legacyLocalOwnerGatewayId
          ? migratedLocalHostId
          : null);
      if (!hostId) {
        continue;
      }
      this.localSessionsByToken.set(rawSession.token, {
        id: rawSession.id,
        hostId,
        token: rawSession.token,
        createdAt: rawSession.createdAt,
      });
    }
    for (const rawSession of snapshot.hostedSessions ?? []) {
      const hostId =
        rawSession.hostId ??
        ((rawSession as HostedSessionRecord & { gatewayId?: string | null }).gatewayId === legacyHostedOwnerGatewayId
          ? migratedHostedHostId
          : null);
      if (!hostId) {
        continue;
      }
      this.hostedSessionsByToken.set(rawSession.token, {
        id: rawSession.id,
        hostId,
        token: rawSession.token,
        createdAt: rawSession.createdAt,
      });
    }
    const rawLocalRuntimeBinding = snapshot.localRuntimeBinding as (LocalRuntimeBindingRecord & { gatewayId?: string | null }) | null | undefined;
    this.localRuntimeBinding =
      rawLocalRuntimeBinding && (rawLocalRuntimeBinding.hostId || rawLocalRuntimeBinding.gatewayId === legacyLocalOwnerGatewayId) && migratedLocalHostId
        ? {
            ...rawLocalRuntimeBinding,
            hostId: rawLocalRuntimeBinding.hostId ?? migratedLocalHostId,
          }
        : null;
    for (const credential of snapshot.gatewayReconnectCredentials ?? []) {
      this.gatewayReconnectCredentialsByGatewayId.set(credential.gatewayId, credential);
      this.gatewayReconnectCredentialsByToken.set(credential.token, credential);
    }
    for (const rawCredential of snapshot.remoteRuntimeBridgeCredentials ?? []) {
      const createdByHostId =
        rawCredential.createdByHostId ??
        ((rawCredential as RemoteRuntimeBridgeCredentialRecord & { createdByGatewayId?: string | null }).createdByGatewayId === legacyHostedOwnerGatewayId
          ? migratedHostedHostId
          : null);
      if (!createdByHostId) {
        continue;
      }
      const normalizedCredential: RemoteRuntimeBridgeCredentialRecord = {
        ...rawCredential,
        createdByHostId,
        expiresAt: rawCredential.expiresAt ?? null,
        revokedByHostId:
          rawCredential.revokedByHostId ??
          ((rawCredential as RemoteRuntimeBridgeCredentialRecord & { revokedByGatewayId?: string | null }).revokedByGatewayId ===
          legacyHostedOwnerGatewayId
            ? migratedHostedHostId
            : null),
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
    for (const request of snapshot.taskRequests ?? []) {
      this.taskRequestsById.set(request.id, request);
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
      const normalizedInvite: InviteRecord = {
        ...invite,
        createdByGatewayId:
          invite.createdByHostId || invite.createdByGatewayId !== legacyLocalOwnerGatewayId && invite.createdByGatewayId !== legacyHostedOwnerGatewayId
            ? invite.createdByGatewayId
            : null,
        createdByHostId:
          invite.createdByHostId ??
          (invite.createdByGatewayId === legacyLocalOwnerGatewayId
            ? migratedLocalHostId
            : invite.createdByGatewayId === legacyHostedOwnerGatewayId
              ? migratedHostedHostId
              : null),
      };
      this.invitesById.set(normalizedInvite.id, normalizedInvite);
      this.invitesByCode.set(normalizedInvite.code, normalizedInvite);
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
    for (const expression of snapshot.publicExpressions ?? []) {
      this.storePublicExpression(expression);
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
    this.automaticCurrentId = snapshot.automaticCurrentId ?? null;
    for (const environment of snapshot.environments ?? []) {
      this.environmentsById.set(environment.id, environment);
    }
    this.activeEnvironmentId = snapshot.activeEnvironmentId ?? null;
    this.automaticEnvironmentId = snapshot.automaticEnvironmentId ?? null;
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
    this.gatewayReconnectCredentialsByGatewayId.clear();
    this.gatewayReconnectCredentialsByToken.clear();
    this.localSessionsByToken.clear();
    this.hostedSessionsByToken.clear();
    this.remoteRuntimeBridgeCredentialsById.clear();
    this.remoteRuntimeBridgeCredentialsByToken.clear();
    this.remoteRuntimeBindingsByGatewayId.clear();
    this.friendRequestsById.clear();
    this.taskRequestsById.clear();
    this.friendshipsById.clear();
    this.friendScopesByKey.clear();
    this.blocksByKey.clear();
    this.invitesById.clear();
    this.invitesByCode.clear();
    this.inviteClaimsByKey.clear();
    this.conversationsById.clear();
    this.messagesById.clear();
    this.publicExpressionsById.clear();
    this.publicExpressionIdsByRootId.clear();
    this.conversationReadStatesByKey.clear();
    this.lastSeenAtByGatewayId.clear();
    this.auditLog.length = 0;
    this.seaEvents.length = 0;
    this.currentsById.clear();
    this.environmentsById.clear();
    this.encountersByPairKey.clear();
    this.scenesById.clear();
    this.sceneIdsByGatewayId.clear();
    this.hostsById.clear();
    this.hostsByHandle.clear();
    this.legacyOwnerGatewayIds.clear();
    this.aquaProfile = null;
    this.socialPulsePolicy = null;
    this.localHostId = null;
    this.hostedHostId = null;
    this.hostedRegistrationPolicy = null;
    this.localRuntimeBinding = null;
    this.activeCurrentId = null;
    this.automaticCurrentId = null;
    this.activeEnvironmentId = null;
    this.automaticEnvironmentId = null;
  }
}

interface CreateGatewayStoreOptions {
  backend?: StoreBackend;
  databaseUrl?: string | null;
  encounterRules?: Partial<EncounterSynthesisRules>;
  presenceTiming?: Partial<PresenceTimingConfig>;
}

export function createGatewayStore(options: CreateGatewayStoreOptions = {}): GatewayStore {
  const backend = options.backend ?? 'memory';
  if (backend === 'sqlite') {
    if (!options.databaseUrl) {
      throw new Error('databaseUrl is required for sqlite store backend');
    }
    return createSqliteGatewayStore({
      databaseUrl: options.databaseUrl,
      encounterRules: options.encounterRules,
      presenceTiming: options.presenceTiming,
    });
  }
  if (backend === 'postgres') {
    if (!options.databaseUrl) {
      throw new Error('databaseUrl is required for postgres store backend');
    }
    return createPostgresGatewayStore({ databaseUrl: options.databaseUrl });
  }
  return new InMemoryGatewayStore({
    encounterRules: options.encounterRules,
    presenceTiming: options.presenceTiming,
  });
}
