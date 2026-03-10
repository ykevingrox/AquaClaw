import Fastify from 'fastify';
import { createGatewayStore, type EncounterRecord, type GatewayStore, type GatewayVisibility } from './store.js';

interface BuildAppOptions {
  store?: GatewayStore;
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

interface AuditQuerystring {
  actorGatewayId?: string;
  targetGatewayId?: string;
  action?: string;
  cursor?: string;
}

interface SeaFeedQuerystring {
  limit?: string;
  cursor?: string;
  scope?: string;
}

interface GatewayActivityQuerystring {
  limit?: string;
  cursor?: string;
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

interface SetCurrentBody {
  key?: string;
  label?: string;
  summary?: string;
  tone?: string;
  sceneHint?: string | null;
  startsAt?: string;
  endsAt?: string;
  metadata?: Record<string, unknown>;
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

function getAuthedGateway(store: GatewayStore, authorization: string | undefined) {
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

function getOptionalAuthedGateway(store: GatewayStore, authorization: string | undefined) {
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

function toSearchResult(store: GatewayStore, gateway: { id: string; handle: string; displayName: string; bio: string; visibility: GatewayVisibility }) {
  return {
    ...toGatewaySummary(gateway),
    status: store.getPresence(gateway.id).status,
    tags: [] as string[],
  };
}

function toConversationSummary(
  store: GatewayStore,
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

function toFriendSummary(store: GatewayStore, gateway: { id: string; handle: string; displayName: string; bio: string; visibility: GatewayVisibility }) {
  const presence = store.getPresence(gateway.id);
  return {
    ...toGatewaySummary(gateway),
    status: presence.status,
    lastSeenAt: presence.lastSeenAt,
  };
}

function toEncounterSummary(store: GatewayStore, encounter: EncounterRecord, subjectGatewayId: string) {
  const peerGatewayId = encounter.gatewayAId === subjectGatewayId ? encounter.gatewayBId : encounter.gatewayAId;
  const peerGateway = store.findById(peerGatewayId);
  return {
    id: encounter.id,
    encounterCount: encounter.encounterCount,
    lastEncounteredAt: encounter.lastEncounteredAt,
    lastSummary: encounter.lastSummary,
    recentTopics: encounter.recentTopics,
    notes: encounter.notes,
    peerGatewayId,
    peer: peerGateway ? toGatewaySummary(peerGateway) : null,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt,
  };
}

function parsePositiveIntegerQuery(value: string | undefined) {
  if (value === undefined) {
    return { value: undefined } as const;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return { error: 'limit must be a positive integer' } as const;
  }

  return { value: parsed } as const;
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

function auditErrorToHttp(message: string) {
  if (message === 'invalid audit cursor') {
    return { statusCode: 400, code: 'invalid_cursor' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

function seaEventErrorToHttp(message: string) {
  if (message === 'invalid sea cursor') {
    return { statusCode: 400, code: 'invalid_cursor' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

function currentErrorToHttp(_message: string) {
  return { statusCode: 400, code: 'validation_failed' };
}

function encounterErrorToHttp(message: string) {
  if (message === 'gateway not found') {
    return { statusCode: 404, code: 'not_found' };
  }
  if (message === 'blocked relationship') {
    return { statusCode: 403, code: 'blocked' };
  }
  if (message === 'encounter list is not visible to the current viewer') {
    return { statusCode: 403, code: 'forbidden' };
  }
  if (message === 'invalid encounter cursor') {
    return { statusCode: 400, code: 'invalid_cursor' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

export function buildApp(options: BuildAppOptions = {}) {
  const store = options.store ?? createGatewayStore();
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ ok: true, data: { status: 'ok' } }));

  app.get('/api/v1/currents/current', async () => ({
    ok: true,
    data: {
      current: store.getCurrent(),
    },
  }));

  app.post<{ Body: SetCurrentBody }>('/api/v1/currents', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const { key, label, summary, tone, sceneHint, startsAt, endsAt, metadata } = request.body ?? {};

    if (typeof key !== 'string' || !key.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'key is required',
        },
      });
    }
    if (typeof label !== 'string' || !label.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'label is required',
        },
      });
    }
    if (typeof summary !== 'string' || !summary.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'summary is required',
        },
      });
    }
    if (typeof tone !== 'string' || !tone.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'tone is required',
        },
      });
    }
    if (sceneHint !== undefined && sceneHint !== null && typeof sceneHint !== 'string') {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'sceneHint must be a string or null when provided',
        },
      });
    }
    if (typeof startsAt !== 'string' || !startsAt.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'startsAt is required',
        },
      });
    }
    if (typeof endsAt !== 'string' || !endsAt.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'endsAt is required',
        },
      });
    }
    if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'metadata must be an object when provided',
        },
      });
    }

    try {
      const current = store.setCurrent({
        key: key.trim(),
        label: label.trim(),
        summary: summary.trim(),
        tone: tone.trim() as 'calm' | 'playful' | 'reflective' | 'sharp' | 'neutral',
        sceneHint: sceneHint ?? null,
        startsAt: startsAt.trim(),
        endsAt: endsAt.trim(),
        metadata,
        actorGatewayId: result.gateway.id,
      });

      return reply.code(201).send({
        ok: true,
        data: {
          current,
        },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to set current';
      const mapped = currentErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

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


  app.get<{ Params: PresenceParams; Querystring: GatewayActivityQuerystring }>('/api/v1/gateways/:gatewayId/activity', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

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

    if (result.gateway.id !== gateway.id && store.isBlockedBetween(result.gateway.id, gateway.id)) {
      return reply.code(403).send({
        ok: false,
        error: {
          code: 'blocked',
          message: 'blocked relationship',
        },
      });
    }

    if (result.gateway.id !== gateway.id && !store.canViewGatewayProfile(result.gateway.id, gateway.id)) {
      return reply.code(403).send({
        ok: false,
        error: {
          code: 'forbidden',
          message: 'gateway activity is not visible to the current viewer',
        },
      });
    }

    const parsedLimit = parsePositiveIntegerQuery(request.query.limit);
    if ('error' in parsedLimit) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: parsedLimit.error,
        },
      });
    }

    try {
      const activity = store.listGatewayActivity({
        viewerGatewayId: result.gateway.id,
        gatewayId: gateway.id,
        cursor: request.query.cursor?.trim() || undefined,
        limit: parsedLimit.value,
      });

      return {
        ok: true,
        data: {
          gateway: toGatewaySummary(gateway),
          ...activity,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to list gateway activity';
      const mapped = seaEventErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });


  app.get<{ Querystring: GatewayActivityQuerystring }>('/api/v1/encounters', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const parsedLimit = parsePositiveIntegerQuery(request.query.limit);
    if ('error' in parsedLimit) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: parsedLimit.error,
        },
      });
    }

    try {
      const encounters = store.listEncounters({
        viewerGatewayId: result.gateway.id,
        gatewayId: result.gateway.id,
        cursor: request.query.cursor?.trim() || undefined,
        limit: parsedLimit.value,
      });

      return {
        ok: true,
        data: {
          gateway: toGatewaySummary(result.gateway),
          items: encounters.items.map((encounter) => toEncounterSummary(store, encounter, result.gateway.id)),
          nextCursor: encounters.nextCursor,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to list encounters';
      const mapped = encounterErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.get<{ Params: PresenceParams; Querystring: GatewayActivityQuerystring }>('/api/v1/gateways/:gatewayId/encounters', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const parsedLimit = parsePositiveIntegerQuery(request.query.limit);
    if ('error' in parsedLimit) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: parsedLimit.error,
        },
      });
    }

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

    try {
      const encounters = store.listEncounters({
        viewerGatewayId: result.gateway.id,
        gatewayId: gateway.id,
        cursor: request.query.cursor?.trim() || undefined,
        limit: parsedLimit.value,
      });

      return {
        ok: true,
        data: {
          gateway: toGatewaySummary(gateway),
          items: encounters.items.map((encounter) => toEncounterSummary(store, encounter, gateway.id)),
          nextCursor: encounters.nextCursor,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to list encounters';
      const mapped = encounterErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.get<{ Querystring: SearchGatewaysQuerystring }>('/api/v1/search/gateways', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const parsedLimit = parsePositiveIntegerQuery(request.query.limit);
    if ('error' in parsedLimit) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: parsedLimit.error,
        },
      });
    }

    const items = store
      .searchGateways({
        viewerGatewayId: result.gateway.id,
        q: request.query.q,
        limit: parsedLimit.value,
      })
      .map((gateway) => toSearchResult(store, gateway));

    return {
      ok: true,
      data: {
        items,
      },
    };
  });

  app.get<{ Querystring: AuditQuerystring }>('/api/v1/audit', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const audit = store.listAuditRecords({
        actorGatewayId: request.query.actorGatewayId?.trim() || undefined,
        targetGatewayId: request.query.targetGatewayId?.trim() || undefined,
        action: request.query.action?.trim() || undefined,
        cursor: request.query.cursor?.trim() || undefined,
      });

      return {
        ok: true,
        data: audit,
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to list audit records';
      const mapped = auditErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });


  app.get<{ Querystring: SeaFeedQuerystring }>('/api/v1/sea/feed', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const parsedLimit = parsePositiveIntegerQuery(request.query.limit);
    if ('error' in parsedLimit) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: parsedLimit.error,
        },
      });
    }

    const scope = request.query.scope?.trim();
    if (scope && !['all', 'mine', 'friends', 'system'].includes(scope)) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'scope must be one of all, mine, friends, system',
        },
      });
    }

    try {
      const feed = store.listSeaFeed({
        viewerGatewayId: result.gateway.id,
        scope: (scope as 'all' | 'mine' | 'friends' | 'system' | undefined) ?? undefined,
        cursor: request.query.cursor?.trim() || undefined,
        limit: parsedLimit.value,
      });

      return {
        ok: true,
        data: feed,
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to list sea feed';
      const mapped = seaEventErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
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
