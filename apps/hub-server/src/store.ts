import { randomBytes, randomUUID } from 'node:crypto';
import { createPostgresGatewayStore } from './postgres-store.js';

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

export type StoreBackend = 'memory' | 'postgres';

export interface GatewayStore {
  register(input: RegisterInput): { gateway: GatewayRecord; token: string };
  findById(gatewayId: string): GatewayRecord | null;
  findByToken(token: string): GatewayRecord | null;
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
  canViewPresence(viewerGatewayId: string, targetGatewayId: string): boolean;
  isBlockedBetween(gatewayAId: string, gatewayBId: string): boolean;
  listAuditRecords(input?: ListAuditRecordsInput): AuditRecordPage;
  listSeaFeed(input: ListSeaFeedInput): SeaEventPage;
  listGatewayActivity(input: ListGatewayActivityInput): SeaEventPage;
  getCurrent(): CurrentRecord;
  setCurrent(input: SetCurrentInput): CurrentRecord;
  listEncounters(input: ListEncountersInput): EncounterPage;
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

interface ListEncountersInput {
  viewerGatewayId: string;
  gatewayId: string;
  cursor?: string;
  limit?: number;
}

interface SetCurrentInput {
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

interface GenerateSceneInput {
  gatewayId: string;
  type: SceneType;
}

interface ListScenesInput {
  gatewayId: string;
  cursor?: string;
  limit?: number;
}

const VALID_VISIBILITIES: GatewayVisibility[] = ['private', 'invite_only', 'friends_only', 'public'];
const VALID_SEA_EVENT_TONES: SeaEventTone[] = ['calm', 'playful', 'reflective', 'sharp', 'neutral'];
const ONLINE_THRESHOLD_MS = 90_000;
const RECENTLY_ACTIVE_THRESHOLD_MS = 5 * 60_000;
const DEFAULT_AUDIT_PAGE_SIZE = 50;
const DEFAULT_SEA_PAGE_SIZE = 50;
const DEFAULT_SCENE_PAGE_SIZE = 50;
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

export class InMemoryGatewayStore implements GatewayStore {
  private readonly gatewaysById = new Map<string, GatewayRecord>();
  private readonly gatewaysByHandle = new Map<string, GatewayRecord>();
  private readonly tokensToGatewayId = new Map<string, string>();
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
  private readonly encountersByPairKey = new Map<string, EncounterRecord>();
  private readonly scenesById = new Map<string, SceneRecord>();
  private readonly sceneIdsByGatewayId = new Map<string, string[]>();
  private currentOverride: CurrentRecord | null = null;

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

    const token = seed?.token ?? randomBytes(24).toString('hex');
    this.gatewaysById.set(gateway.id, gateway);
    this.gatewaysByHandle.set(gateway.handle, gateway);
    this.tokensToGatewayId.set(token, gateway.id);
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

  getCurrent(): CurrentRecord {
    const override = this.currentOverride;
    if (override) {
      const now = Date.now();
      const startsAt = Date.parse(override.startsAt);
      const endsAt = Date.parse(override.endsAt);

      if (Number.isFinite(startsAt) && Number.isFinite(endsAt)) {
        if (now >= startsAt && now < endsAt) {
          return override;
        }
        if (now >= endsAt) {
          this.currentOverride = null;
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

    this.currentOverride = current;

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

    const scene: SceneRecord = {
      id: `scene-${randomUUID()}`,
      gatewayId: gateway.id,
      type: input.type,
      visibility: 'private',
      summary,
      tone: sceneTone,
      metadata: baseMetadata,
      createdAt: now,
    };

    this.scenesById.set(scene.id, scene);
    const existing = this.sceneIdsByGatewayId.get(scene.gatewayId) ?? [];
    this.sceneIdsByGatewayId.set(scene.gatewayId, [...existing, scene.id]);

    const seaType = scene.type === 'vent' ? 'scene.vent_generated' : 'scene.social_glimpse_generated';
    this.appendSeaEvent({
      type: seaType,
      actorGatewayId: scene.gatewayId,
      subjectGatewayId: scene.gatewayId,
      objectGatewayId: encounterSummary?.peerGatewayId ?? null,
      visibility: 'private',
      summary: scene.summary,
      tone: scene.tone,
      sceneHint: scene.type,
      metadata: {
        sceneId: scene.id,
        sceneType: scene.type,
        sceneVisibility: scene.visibility,
        ...baseMetadata,
      },
      createdAt: now,
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

  private getConversationPeerGatewayId(conversation: ConversationRecord, gatewayId: string) {
    return conversation.memberGatewayIds[0] === gatewayId ? conversation.memberGatewayIds[1] : conversation.memberGatewayIds[0];
  }

  private recordEncounter(input: {
    gatewayAId: string;
    gatewayBId: string;
    actorGatewayId?: string | null;
    trigger: 'friend_request.accepted' | 'message.sent';
    summary: string;
    topics?: string[];
    createdAt?: string;
  }) {
    const pair = this.normalizeEncounterPair(input.gatewayAId, input.gatewayBId);
    const pairKey = this.encounterPairKey(pair[0], pair[1]);
    const now = input.createdAt ?? new Date().toISOString();
    const existing = this.encountersByPairKey.get(pairKey) ?? null;
    const nextTopics = this.mergeEncounterTopics(input.topics ?? [], existing?.recentTopics ?? []);
    const nextNotes = this.mergeEncounterNotes(input.summary, existing?.notes ?? []);

    const encounter: EncounterRecord = existing
      ? {
          ...existing,
          encounterCount: existing.encounterCount + 1,
          lastEncounteredAt: now,
          lastSummary: input.summary,
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
          lastSummary: input.summary,
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
    this.seaEvents.push(event);
    return event;
  }

  private mapAuditRecordToSeaEvents(record: AuditRecord): SeaEvent[] {
    const actorLabel = this.gatewayLabel(record.actorGatewayId);
    const targetLabel = this.gatewayLabel(record.targetGatewayId);
    const baseMetadata = {
      auditAction: record.action,
      auditRecordId: record.id,
      ...record.metadata,
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
    this.seaEvents.push(...this.mapAuditRecordToSeaEvents(record));
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

  reset() {
    this.gatewaysById.clear();
    this.gatewaysByHandle.clear();
    this.tokensToGatewayId.clear();
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
    this.encountersByPairKey.clear();
    this.scenesById.clear();
    this.sceneIdsByGatewayId.clear();
    this.currentOverride = null;
  }
}

interface CreateGatewayStoreOptions {
  backend?: StoreBackend;
  databaseUrl?: string | null;
}

export function createGatewayStore(options: CreateGatewayStoreOptions = {}): GatewayStore {
  const backend = options.backend ?? 'memory';
  if (backend === 'postgres') {
    if (!options.databaseUrl) {
      throw new Error('databaseUrl is required for postgres store backend');
    }
    return createPostgresGatewayStore({ databaseUrl: options.databaseUrl });
  }
  return new InMemoryGatewayStore();
}
