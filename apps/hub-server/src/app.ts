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

function toSearchResult(gateway: { id: string; handle: string; displayName: string; bio: string; visibility: GatewayVisibility }) {
  return {
    ...toGatewaySummary(gateway),
    status: 'offline' as const,
    tags: [] as string[],
  };
}

function toConversationSummary(item: { conversation: { id: string; type: 'dm'; createdAt: string; updatedAt: string }; peerGateway: { id: string; handle: string; displayName: string; bio: string; visibility: GatewayVisibility } }) {
  return {
    id: item.conversation.id,
    type: item.conversation.type,
    peer: toGatewaySummary(item.peerGateway),
    createdAt: item.conversation.createdAt,
    updatedAt: item.conversation.updatedAt,
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
  if (message === 'friend request is not pending') {
    return { statusCode: 409, code: 'invalid_state' };
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
    const canView = gateway.visibility === 'public' || isSelf;

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
      .map((gateway) => toSearchResult(gateway));

    return {
      ok: true,
      data: {
        items,
      },
    };
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

    const items = store.listFriends(result.gateway.id).map((gateway) => toGatewaySummary(gateway));
    return {
      ok: true,
      data: {
        items,
      },
    };
  });

  app.get('/api/v1/conversations', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const items = store.listConversations(result.gateway.id).map((item) => toConversationSummary(item));
    return {
      ok: true,
      data: {
        items,
      },
    };
  });

  return app;
}
