import { randomBytes, randomUUID } from 'node:crypto';

export type GatewayVisibility = 'private' | 'invite_only' | 'friends_only' | 'public';

export interface GatewayRecord {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  visibility: GatewayVisibility;
  createdAt: string;
  updatedAt: string;
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

const VALID_VISIBILITIES: GatewayVisibility[] = ['private', 'invite_only', 'friends_only', 'public'];

export class InMemoryGatewayStore {
  private readonly gatewaysById = new Map<string, GatewayRecord>();
  private readonly gatewaysByHandle = new Map<string, GatewayRecord>();
  private readonly tokensToGatewayId = new Map<string, string>();
  private readonly friendRequestsById = new Map<string, FriendRequestRecord>();
  private readonly friendshipsById = new Map<string, FriendshipRecord>();

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

  createFriendRequest(input: CreateFriendRequestInput): FriendRequestRecord {
    if (input.fromGatewayId === input.toGatewayId) {
      throw new Error('cannot friend request yourself');
    }

    const fromGateway = this.gatewaysById.get(input.fromGatewayId);
    const toGateway = this.gatewaysById.get(input.toGatewayId);
    if (!fromGateway || !toGateway) {
      throw new Error('gateway not found');
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

    return { request: updatedRequest, friendship };
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

  private areFriends(gatewayAId: string, gatewayBId: string) {
    return Array.from(this.friendshipsById.values()).some(
      (friendship) =>
        (friendship.gatewayAId === gatewayAId && friendship.gatewayBId === gatewayBId) ||
        (friendship.gatewayAId === gatewayBId && friendship.gatewayBId === gatewayAId),
    );
  }

  reset() {
    this.gatewaysById.clear();
    this.gatewaysByHandle.clear();
    this.tokensToGatewayId.clear();
    this.friendRequestsById.clear();
    this.friendshipsById.clear();
  }
}

export function createGatewayStore() {
  return new InMemoryGatewayStore();
}
