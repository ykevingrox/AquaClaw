import Fastify from 'fastify';
import { createGatewayStore, type GatewayVisibility, type InMemoryGatewayStore } from './store.js';

interface BuildAppOptions {
  store?: InMemoryGatewayStore;
}

interface RegisterBody {
  displayName?: string;
  handle?: string;
  bio?: string;
  visibility?: GatewayVisibility;
}

interface UpdateMeBody {
  displayName?: string;
  bio?: string;
  visibility?: GatewayVisibility;
}

interface CreateFriendRequestBody {
  toGatewayId?: string;
  message?: string;
}

interface SearchGatewaysQuerystring {
  q?: string;
  limit?: string;
}

interface FriendRequestParams {
  requestId: string;
}

interface ConversationParams {
  conversationId: string;
}

interface PresenceParams {
  gatewayId: string;
}

interface FriendScopesParams {
  gatewayId: string;
}

interface CreateMessageBody {
  body?: string;
}

interface UpdateFriendScopesBody {
  updates?: Array<{ scopeName?: string; state?: string }>;
}

interface PresenceHeartbeatBody {
  sessionId?: string;
  connectionType?: string;
}

interface CreateInviteBody {
  maxUses?: number | null;
  expiresAt?: string | null;
}

interface ClaimInviteBody {
  code?: string;
}

interface CreateBlockBody {
  gatewayId?: string;
  reason?: string;
}

function extractBearerToken(value: string | undefined) {
  if (!value) return null;
  const [scheme, token] = value.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function getAuthedGateway(store: InMemoryGatewayStore, authorization: string | undefined) {
  const token = extractBearerToken(authorization);
  if (!token) {
    return {
      error: {
        code: 'unauthorized',
        message: 'missing or invalid bearer token',
      },
    } as const;
  }

  const gateway = store.findByToken(token);
  if (!gateway) {
    return {
      error: {
        code: 'unauthorized',
        message: 'invalid bearer token',
      },
    } as const;
  }

  return { gateway } as const;
}

function getOptionalAuthedGateway(store: InMemoryGatewayStore, authorization: string | undefined) {
  const token = extractBearerToken(authorization);
  if (!token) {
    return null;
  }
  return store.findByToken(token);
}

function toGatewaySummary(gateway: { id: string; handle: string; displayName: string; bio: string; visibility: GatewayVisibility }) {
  return {
    id: gateway.id,
    handle: gateway.handle,
    displayName: gateway.displayName,
    bio: gateway.bio,
    visibility: gateway.visibility,
  };
}

function toSearchResult(store: InMemoryGatewayStore, gateway: { id: string; handle: string; displayName: string; bio: string; visibility: GatewayVisibility }) {
  return {
    ...toGatewaySummary(gateway),
    status: store.getPresence(gateway.id).status,
    tags: [] as string[],
  };
}

function toConversationSummary(
  store: InMemoryGatewayStore,
  item: { conversation: { id: string; type: 'dm'; createdAt: string; updatedAt: string }; peerGateway: { id: string; handle: string; displayName: string; bio: string; visibility: GatewayVisibility } },
) {
  return {
    id: item.conversation.id,
    type: item.conversation.type,
    peer: {
      ...toGatewaySummary(item.peerGateway),
      status: store.getPresence(item.peerGateway.id).status,
    },
    createdAt: item.conversation.createdAt,
    updatedAt: item.conversation.updatedAt,
  };
}

function toFriendSummary(store: InMemoryGatewayStore, gateway: { id: string; handle: string; displayName: string; bio: string; visibility: GatewayVisibility }) {
  const presence = store.getPresence(gateway.id);
  return {
    ...toGatewaySummary(gateway),
    status: presence.status,
    lastSeenAt: presence.lastSeenAt,
  };
}

function friendRequestErrorToHttp(message: string) {
  if (message === 'pending request already exists') {
    return { statusCode: 409, code: 'pending_request_exists' };
  }
  if (message === 'already friends') {
    return { statusCode: 409, code: 'already_friends' };
  }
  if (message === 'friend request not found') {
    return { statusCode: 404, code: 'not_found' };
  }
  if (message === 'only the recipient can accept this request' || message === 'only the recipient can reject this request') {
    return { statusCode: 403, code: 'forbidden' };
  }
  if (message === 'blocked relationship') {
    return { statusCode: 403, code: 'blocked' };
  }
  if (message === 'friend request is not pending') {
    return { statusCode: 409, code: 'invalid_state' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

function conversationErrorToHttp(message: string) {
  if (message === 'conversation not found') {
    return { statusCode: 404, code: 'not_found' };
  }
  if (
    message === 'gateway is not a member of this conversation' ||
    message === 'chat send not allowed' ||
    message === 'chat receive not allowed'
  ) {
    return { statusCode: 403, code: 'forbidden' };
  }
  if (message === 'blocked relationship') {
    return { statusCode: 403, code: 'blocked' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

function friendScopesErrorToHttp(message: string) {
  if (message === 'friendship not found') {
    return { statusCode: 404, code: 'not_found' };
  }
  if (message === 'invalid scope name') {
    return { statusCode: 400, code: 'validation_failed' };
  }
  if (message === 'at least one scope update is required') {
    return { statusCode: 400, code: 'validation_failed' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

function inviteErrorToHttp(message: string) {
  if (message === 'invite not found') {
    return { statusCode: 404, code: 'not_found' };
  }
  if (message === 'invite revoked' || message === 'invite expired' || message === 'invite exhausted') {
    return { statusCode: 409, code: 'invalid_state' };
  }
  if (message === 'invite already claimed' || message === 'pending request already exists' || message === 'already friends') {
    return { statusCode: 409, code: message === 'invite already claimed' ? 'invite_already_claimed' : message === 'pending request already exists' ? 'pending_request_exists' : 'already_friends' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

function socialActionErrorToHttp(message: string) {
  if (message === 'friendship not found' || message === 'block not found') {
    return { statusCode: 404, code: 'not_found' };
  }
  if (message === 'already blocked') {
    return { statusCode: 409, code: 'already_blocked' };
  }
  if (message === 'blocked relationship') {
    return { statusCode: 403, code: 'blocked' };
  }
  if (message === 'cannot block yourself') {
    return { statusCode: 400, code: 'validation_failed' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

export function buildApp(options: BuildAppOptions = {}) {
  const store = options.store ?? createGatewayStore();
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ ok: true, data: { status: 'ok' } }));

  app.post<{ Body: RegisterBody }>('/api/v1/gateways/register', async (request, reply) => {
    const { displayName, handle, bio, visibility } = request.body ?? {};

    if (!displayName?.trim() || !handle?.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'displayName and handle are required',
        },
      });
    }

    try {
      const { gateway, token } = store.register({ displayName, handle, bio, visibility });
      return reply.code(201).send({
        ok: true,
        data: {
          gateway: {
            id: gateway.id,
            displayName: gateway.displayName,
            handle: gateway.handle,
            bio: gateway.bio,
            visibility: gateway.visibility,
            createdAt: gateway.createdAt,
          },
          credential: {
            token,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to register gateway';
      const statusCode = message === 'handle already exists' ? 409 : 400;
      return reply.code(statusCode).send({
        ok: false,
        error: {
          code: statusCode === 409 ? 'handle_conflict' : 'validation_failed',
          message,
        },
      });
    }
  });

  app.get('/api/v1/gateways/me', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    return {
      ok: true,
      data: {
        gateway: result.gateway,
      },
    };
  });

  app.get<{ Params: { gatewayId: string } }>('/api/v1/gateways/:gatewayId', async (request, reply) => {
    const gateway = store.findById(request.params.gatewayId);
    if (!gateway) {
      return reply.code(404).send({
        ok: false,
        error: {
          code: 'not_found',
          message: 'gateway not found',
        },
      });
    }

    const viewer = getOptionalAuthedGateway(store, request.headers.authorization);
    const isSelf = viewer?.id === gateway.id;

    if (viewer && !isSelf && store.isBlockedBetween(viewer.id, gateway.id)) {
      return reply.code(403).send({
        ok: false,
        error: {
          code: 'blocked',
          message: 'blocked relationship',
        },
      });
    }

    const canView = store.canViewGatewayProfile(viewer?.id, gateway.id);

    if (!canView) {
      return reply.code(403).send({
        ok: false,
        error: {
          code: 'forbidden',
          message: 'gateway is not visible to the current viewer',
        },
      });
    }

    return {
      ok: true,
      data: {
        gateway,
      },
    };
  });

  app.patch<{ Body: UpdateMeBody }>('/api/v1/gateways/me', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const gateway = store.updateProfile(result.gateway.id, request.body ?? {});
      return {
        ok: true,
        data: {
          gateway,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to update gateway profile';
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message,
        },
      });
    }
  });

  app.get<{ Querystring: SearchGatewaysQuerystring }>('/api/v1/search/gateways', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const parsedLimit = request.query.limit === undefined ? undefined : Number.parseInt(request.query.limit, 10);
    if (request.query.limit !== undefined && (!Number.isFinite(parsedLimit ?? Number.NaN) || (parsedLimit ?? 0) < 1)) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'limit must be a positive integer',
        },
      });
    }

    const items = store
      .searchGateways({
        viewerGatewayId: result.gateway.id,
        q: request.query.q,
        limit: parsedLimit,
      })
      .map((gateway) => toSearchResult(store, gateway));

    return {
      ok: true,
      data: {
        items,
      },
    };
  });

  app.post<{ Body: CreateInviteBody }>('/api/v1/invites', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const invite = store.createInvite({
        createdByGatewayId: result.gateway.id,
        maxUses: request.body?.maxUses,
        expiresAt: request.body?.expiresAt,
      });
      return reply.code(201).send({
        ok: true,
        data: {
          invite,
        },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to create invite';
      const mapped = inviteErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.post<{ Body: ClaimInviteBody }>('/api/v1/invites/claim', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const code = request.body?.code?.trim();
    if (!code) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'code is required',
        },
      });
    }

    try {
      const claimed = store.claimInvite({
        code,
        claimedByGatewayId: result.gateway.id,
      });
      const inviter = store.findById(claimed.invite.createdByGatewayId);
      return {
        ok: true,
        data: {
          invite: claimed.invite,
          claim: claimed.claim,
          inviterGateway: inviter ? toGatewaySummary(inviter) : null,
          friendRequest: {
            ...claimed.friendRequest,
            fromGateway: toGatewaySummary(result.gateway),
            toGateway: inviter ? toGatewaySummary(inviter) : null,
          },
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to claim invite';
      const mapped = inviteErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.post<{ Body: CreateFriendRequestBody }>('/api/v1/friend-requests', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const { toGatewayId, message } = request.body ?? {};
    if (!toGatewayId?.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'toGatewayId is required',
        },
      });
    }

    try {
      const friendRequest = store.createFriendRequest({
        fromGatewayId: result.gateway.id,
        toGatewayId,
        message,
      });
      const toGateway = store.findById(friendRequest.toGatewayId);
      return reply.code(201).send({
        ok: true,
        data: {
          request: {
            ...friendRequest,
            fromGateway: toGatewaySummary(result.gateway),
            toGateway: toGateway ? toGatewaySummary(toGateway) : null,
          },
        },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to create friend request';
      const mapped = friendRequestErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.get('/api/v1/friend-requests/incoming', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const items = store.listIncomingFriendRequests(result.gateway.id).map((friendRequest) => ({
      ...friendRequest,
      fromGateway: toGatewaySummary(store.findById(friendRequest.fromGatewayId)!),
      toGateway: toGatewaySummary(result.gateway),
    }));

    return {
      ok: true,
      data: {
        items,
      },
    };
  });

  app.get('/api/v1/friend-requests/outgoing', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const items = store.listOutgoingFriendRequests(result.gateway.id).map((friendRequest) => ({
      ...friendRequest,
      fromGateway: toGatewaySummary(result.gateway),
      toGateway: toGatewaySummary(store.findById(friendRequest.toGatewayId)!),
    }));

    return {
      ok: true,
      data: {
        items,
      },
    };
  });

  app.post<{ Params: FriendRequestParams }>('/api/v1/friend-requests/:requestId/accept', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const accepted = store.acceptFriendRequest(request.params.requestId, result.gateway.id);
      const peerId = accepted.request.fromGatewayId === result.gateway.id ? accepted.request.toGatewayId : accepted.request.fromGatewayId;
      const peerGateway = store.findById(peerId);
      return {
        ok: true,
        data: {
          request: accepted.request,
          friendship: accepted.friendship,
          conversation: accepted.conversation,
          peerGateway: peerGateway ? toGatewaySummary(peerGateway) : null,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to accept friend request';
      const mapped = friendRequestErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.post<{ Params: FriendRequestParams }>('/api/v1/friend-requests/:requestId/reject', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const rejected = store.rejectFriendRequest(request.params.requestId, result.gateway.id);
      return {
        ok: true,
        data: {
          request: rejected,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to reject friend request';
      const mapped = friendRequestErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.get('/api/v1/friends', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const items = store.listFriends(result.gateway.id).map((gateway) => toFriendSummary(store, gateway));
    return {
      ok: true,
      data: {
        items,
      },
    };
  });

  app.delete<{ Params: FriendScopesParams }>('/api/v1/friends/:gatewayId', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const friendship = store.removeFriendship(result.gateway.id, request.params.gatewayId);
      return {
        ok: true,
        data: {
          friendship,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to remove friendship';
      const mapped = socialActionErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.get<{ Params: FriendScopesParams }>('/api/v1/friends/:gatewayId/scopes', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const outbound = store.listFriendScopes(result.gateway.id, request.params.gatewayId).map((scope) => ({
        scope: scope.scopeName,
        state: scope.state,
        updatedAt: scope.updatedAt,
      }));
      return {
        ok: true,
        data: {
          outbound,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to list friend scopes';
      const mapped = friendScopesErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.patch<{ Params: FriendScopesParams; Body: UpdateFriendScopesBody }>('/api/v1/friends/:gatewayId/scopes', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const rawUpdates = request.body?.updates ?? [];
    if (rawUpdates.length === 0) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'at least one scope update is required',
        },
      });
    }

    if (rawUpdates.some((update) => !update.scopeName || (update.state !== 'granted' && update.state !== 'denied'))) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'each scope update requires valid scopeName and state',
        },
      });
    }

    try {
      const outbound = store
        .updateFriendScopes({
          fromGatewayId: result.gateway.id,
          toGatewayId: request.params.gatewayId,
          updates: rawUpdates.map((update) => ({
            scopeName: update.scopeName as Parameters<typeof store.updateFriendScopes>[0]['updates'][number]['scopeName'],
            state: update.state as Parameters<typeof store.updateFriendScopes>[0]['updates'][number]['state'],
          })),
        })
        .map((scope) => ({
          scope: scope.scopeName,
          state: scope.state,
          updatedAt: scope.updatedAt,
        }));

      return {
        ok: true,
        data: {
          outbound,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to update friend scopes';
      const mapped = friendScopesErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.post<{ Body: CreateBlockBody }>('/api/v1/blocks', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const gatewayId = request.body?.gatewayId?.trim();
    if (!gatewayId) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'gatewayId is required',
        },
      });
    }

    try {
      const block = store.createBlock({
        blockerGatewayId: result.gateway.id,
        blockedGatewayId: gatewayId,
        reason: request.body?.reason,
      });
      return reply.code(201).send({
        ok: true,
        data: {
          block,
        },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to create block';
      const mapped = socialActionErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.delete<{ Params: FriendScopesParams }>('/api/v1/blocks/:gatewayId', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const block = store.removeBlock(result.gateway.id, request.params.gatewayId);
      return {
        ok: true,
        data: {
          block,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to remove block';
      const mapped = socialActionErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.get('/api/v1/conversations', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const items = store.listConversations(result.gateway.id).map((item) => toConversationSummary(store, item));
    return {
      ok: true,
      data: {
        items,
      },
    };
  });

  app.get<{ Params: ConversationParams }>('/api/v1/conversations/:conversationId/messages', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const items = store.listMessages(request.params.conversationId, result.gateway.id);
      return {
        ok: true,
        data: {
          items,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to list messages';
      const mapped = conversationErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.post<{ Params: ConversationParams; Body: CreateMessageBody }>('/api/v1/conversations/:conversationId/messages', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const message = store.createMessage({
        conversationId: request.params.conversationId,
        senderGatewayId: result.gateway.id,
        body: request.body?.body ?? '',
      });
      return reply.code(201).send({
        ok: true,
        data: {
          message,
        },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to create message';
      const mapped = conversationErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.post<{ Body: PresenceHeartbeatBody }>('/api/v1/presence/heartbeat', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const sessionId = request.body?.sessionId?.trim();
    const connectionType = request.body?.connectionType?.trim();
    if (request.body?.sessionId !== undefined && !sessionId) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'sessionId must be a non-empty string when provided',
        },
      });
    }
    if (request.body?.connectionType !== undefined && !connectionType) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'connectionType must be a non-empty string when provided',
        },
      });
    }

    const presence = store.heartbeatPresence(result.gateway.id);
    return {
      ok: true,
      data: {
        sessionId: sessionId ?? null,
        connectionType: connectionType ?? null,
        status: presence.status,
        lastSeenAt: presence.lastSeenAt,
      },
    };
  });

  app.get<{ Params: PresenceParams }>('/api/v1/presence/:gatewayId', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const target = store.findById(request.params.gatewayId);
    if (!target) {
      return reply.code(404).send({
        ok: false,
        error: {
          code: 'not_found',
          message: 'gateway not found',
        },
      });
    }

    if (!store.canViewPresence(result.gateway.id, target.id)) {
      return reply.code(403).send({
        ok: false,
        error: {
          code: 'forbidden',
          message: 'presence is only visible to the gateway itself or friends with granted presence.read',
        },
      });
    }

    const presence = store.getPresence(target.id);
    return {
      ok: true,
      data: {
        status: presence.status,
        lastSeenAt: presence.lastSeenAt,
      },
    };
  });

  return app;
}
