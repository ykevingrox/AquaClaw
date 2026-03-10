import { randomBytes, randomUUID } from 'node:crypto';

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

const VALID_VISIBILITIES: GatewayVisibility[] = ['private', 'invite_only', 'friends_only', 'public'];
const ONLINE_THRESHOLD_MS = 90_000;
const RECENTLY_ACTIVE_THRESHOLD_MS = 5 * 60_000;

export class InMemoryGatewayStore {
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

  register(input: RegisterInput) {
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

    const now = new Date().toISOString();
    const gateway: GatewayRecord = {
      id: randomUUID(),
      handle: normalizedHandle,
      displayName: input.displayName.trim(),
      bio: input.bio?.trim() ?? '',
      visibility,
      createdAt: now,
      updatedAt: now,
    };

    if (!gateway.displayName) {
      throw new Error('displayName is required');
    }

    const token = randomBytes(24).toString('hex');
    this.gatewaysById.set(gateway.id, gateway);
    this.gatewaysByHandle.set(gateway.handle, gateway);
    this.tokensToGatewayId.set(token, gateway.id);

    return { gateway, token };
  }

  findById(gatewayId: string): GatewayRecord | null {
    return this.gatewaysById.get(gatewayId) ?? null;
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

    switch (target.visibility) {
      case 'public':
        return true;
      case 'private':
        return false;
      case 'friends_only':
        return viewerGatewayId ? this.areFriends(viewerGatewayId, targetGatewayId) : false;
      case 'invite_only':
        return viewerGatewayId ? this.areFriends(viewerGatewayId, targetGatewayId) || this.hasInvitePath(viewerGatewayId, targetGatewayId) : false;
      default:
        return false;
    }
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
    return block;
  }

  removeBlock(blockerGatewayId: string, blockedGatewayId: string) {
    const key = this.blockKey(blockerGatewayId, blockedGatewayId);
    const existing = this.blocksByKey.get(key);
    if (!existing) {
      throw new Error('block not found');
    }
    this.blocksByKey.delete(key);
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

    return this.listFriendScopes(input.fromGatewayId, input.toGatewayId);
  }

  findConversationById(conversationId: string): ConversationRecord | null {
    return this.conversationsById.get(conversationId) ?? null;
  }

  listConversations(gatewayId: string): Array<{ conversation: ConversationRecord; peerGateway: GatewayRecord }> {
    return Array.from(this.conversationsById.values())
      .filter((conversation) => conversation.memberGatewayIds.includes(gatewayId))
      .map((conversation) => {
        const peerGatewayId = conversation.memberGatewayIds[0] === gatewayId ? conversation.memberGatewayIds[1] : conversation.memberGatewayIds[0];
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
    const peerGatewayId = conversation.memberGatewayIds[0] === input.senderGatewayId ? conversation.memberGatewayIds[1] : conversation.memberGatewayIds[0];
    if (this.isBlockedEitherWay(input.senderGatewayId, peerGatewayId)) {
      throw new Error('blocked relationship');
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
    const peerGatewayId = conversation.memberGatewayIds[0] === viewerGatewayId ? conversation.memberGatewayIds[1] : conversation.memberGatewayIds[0];
    if (this.isBlockedEitherWay(viewerGatewayId, peerGatewayId)) {
      throw new Error('blocked relationship');
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

  private clearFriendScopes(fromGatewayId: string, toGatewayId: string) {
    for (const scopeName of this.defaultScopeNames()) {
      this.friendScopesByKey.delete(this.scopeKey(fromGatewayId, toGatewayId, scopeName));
    }
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
  }
}

export function createGatewayStore() {
  return new InMemoryGatewayStore();
}
