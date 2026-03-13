import { type ServerResponse } from 'node:http';

import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { DeploymentMode } from './config.js';
import { SeaLiveHub, type SeaLiveHubOptions } from './live-hub.js';
import { createInMemoryRateLimiter, type RateLimitPolicy } from './rate-limiter.js';
import {
  type AquaProfileRecord,
  type CurrentRecord,
  createGatewayStore,
  type ConversationListItem,
  type ConversationReadStateSummary,
  type EnvironmentRecord,
  type EncounterRecord,
  type GatewayFriendRequestPolicy,
  type GatewayRecord,
  type GatewayStore,
  type GatewayVisibility,
  type HostedRegistrationPolicy,
  type SeaEvent,
  type SeaEventLiveSource,
} from './store.js';

interface BuildAppOptions {
  store?: GatewayStore;
  deploymentMode?: DeploymentMode;
  hostedOwnerBootstrapKey?: string | null;
  hostedRateLimits?: Partial<HostedRateLimitPolicies>;
  seaLiveHub?: SeaLiveHubOptions;
  now?: () => number;
}

interface HostedRateLimitPolicies {
  bootstrapHosted: RateLimitPolicy;
  registerGateway: RateLimitPolicy;
  remoteBind: RateLimitPolicy;
  remoteHeartbeat: RateLimitPolicy;
}

interface RegisterBody {
  displayName?: string;
  handle?: string;
  bio?: string;
  visibility?: GatewayVisibility;
  friendRequestPolicy?: GatewayFriendRequestPolicy;
}

interface BootstrapLocalSessionBody {
  displayName?: string;
  handle?: string;
  bio?: string;
  visibility?: GatewayVisibility;
}

interface BootstrapHostedSessionBody {
  bootstrapKey?: string;
  displayName?: string;
  handle?: string;
  bio?: string;
  visibility?: GatewayVisibility;
}

interface UpdateHostedRegistrationPolicyBody {
  policy?: string;
}

interface RevokeHostedSessionsBody {
  revokeCurrent?: boolean;
}

interface BindLocalRuntimeBody {
  installationId?: string;
  runtimeId?: string;
  label?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

interface CreateRemoteRuntimeBridgeCredentialBody {
  label?: string;
  metadata?: Record<string, unknown>;
}

interface RevokeRemoteRuntimeBridgeCredentialParams {
  credentialId: string;
}

interface BindRemoteRuntimeBody {
  bridgeToken?: string;
  installationId?: string;
  runtimeId?: string;
  label?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

interface JoinHostedRuntimeByInviteBody {
  inviteCode?: string;
  displayName?: string;
  handle?: string;
  bio?: string;
  visibility?: GatewayVisibility;
  installationId?: string;
  runtimeId?: string;
  label?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  connectionType?: string;
  heartbeatMetadata?: Record<string, unknown>;
}

interface UpdateMeBody {
  displayName?: string;
  bio?: string;
  visibility?: GatewayVisibility;
  friendRequestPolicy?: GatewayFriendRequestPolicy;
}

interface UpdateAquaBody {
  displayName?: string;
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

interface SeaStreamQuerystring {
  cursor?: string;
}

interface GatewayActivityQuerystring {
  limit?: string;
  cursor?: string;
}

interface PublicGatewayQuerystring {
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

interface UpdateConversationReadStateBody {
  messageId?: string;
}

interface UpdateFriendScopesBody {
  updates?: Array<{ scopeName?: string; state?: string }>;
}

interface PresenceHeartbeatBody {
  sessionId?: string;
  connectionType?: string;
}

interface RuntimeHeartbeatBody {
  runtimeId?: string;
  connectionType?: string;
  metadata?: Record<string, unknown>;
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

interface SetEnvironmentBody {
  waterTemperatureC?: number;
  clarity?: string;
  tideDirection?: string;
  surfaceState?: string;
  phenomenon?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

interface GenerateSceneBody {
  type?: string;
}

interface CreateInviteBody {
  maxUses?: number | null;
  expiresAt?: string | null;
}

interface ClaimInviteBody {
  code?: string;
}

interface RevokeInviteParams {
  inviteId?: string;
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

function extractSingleHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseSeaStreamCursor(headers: Record<string, string | string[] | undefined>, queryCursor?: string) {
  const headerCursor = extractSingleHeaderValue(headers['last-event-id'])?.trim();
  const cursor = headerCursor || queryCursor?.trim();
  return cursor || undefined;
}

function writeSseEvent(
  response: ServerResponse,
  input: {
    event: string;
    id?: string;
    data?: unknown;
  },
) {
  if (response.destroyed || response.writableEnded) {
    return;
  }

  if (input.id) {
    response.write(`id: ${input.id}\n`);
  }
  response.write(`event: ${input.event}\n`);
  if (input.data !== undefined) {
    const payload = JSON.stringify(input.data);
    for (const line of payload.split('\n')) {
      response.write(`data: ${line}\n`);
    }
  }
  response.write('\n');
}

function isSeaEventLiveSource(store: GatewayStore): store is GatewayStore & SeaEventLiveSource {
  return 'addSeaEventListener' in store && typeof store.addSeaEventListener === 'function';
}

type AuthedGatewayResult =
  | {
      gateway: NonNullable<ReturnType<GatewayStore['findByToken']>>;
    }
  | {
      error: {
        code: 'unauthorized';
        message: string;
      };
    };

function getAuthedGateway(store: GatewayStore, authorization: string | undefined): AuthedGatewayResult {
  const token = extractBearerToken(authorization);
  if (!token) {
    return {
      error: {
        code: 'unauthorized',
        message: 'missing or invalid bearer token',
      },
    };
  }

  const gateway = store.findByToken(token);
  if (gateway) {
    return { gateway };
  }

  const hostedSession = store.findHostedSessionByToken(token);
  if (hostedSession) {
    return { gateway: hostedSession.gateway };
  }

  return {
    error: {
      code: 'unauthorized',
      message: 'invalid bearer token',
    },
  };
}

type AuthedGatewayCredentialOnlyResult =
  | {
      gateway: NonNullable<ReturnType<GatewayStore['findByToken']>>;
    }
  | {
      error: {
        statusCode: 401 | 403;
        code: 'unauthorized' | 'forbidden';
        message: string;
      };
    };

function getAuthedGatewayCredentialOnly(
  store: GatewayStore,
  authorization: string | undefined,
): AuthedGatewayCredentialOnlyResult {
  const token = extractBearerToken(authorization);
  if (!token) {
    return {
      error: {
        statusCode: 401,
        code: 'unauthorized',
        message: 'missing or invalid bearer token',
      },
    };
  }

  const hostedSession = store.findHostedSessionByToken(token);
  if (hostedSession) {
    return {
      error: {
        statusCode: 403,
        code: 'forbidden',
        message: 'endpoint requires gateway bearer token',
      },
    };
  }

  const gateway = store.findByToken(token);
  if (gateway) {
    return { gateway };
  }

  return {
    error: {
      statusCode: 401,
      code: 'unauthorized',
      message: 'invalid bearer token',
    },
  };
}

function getOptionalAuthedGateway(store: GatewayStore, authorization: string | undefined) {
  const token = extractBearerToken(authorization);
  if (!token) {
    return null;
  }
  return store.findByToken(token);
}

function getAuthedLocalSession(store: GatewayStore, authorization: string | undefined) {
  const token = extractBearerToken(authorization);
  if (!token) {
    return {
      error: {
        code: 'unauthorized',
        message: 'missing or invalid local session token',
      },
    } as const;
  }

  const session = store.findLocalSessionByToken(token);
  if (!session) {
    return {
      error: {
        code: 'unauthorized',
        message: 'invalid local session token',
      },
    } as const;
  }

  return session;
}

function getAuthedHostedSession(store: GatewayStore, authorization: string | undefined) {
  const token = extractBearerToken(authorization);
  if (!token) {
    return {
      error: {
        code: 'unauthorized',
        message: 'missing or invalid hosted session token',
      },
    } as const;
  }

  const session = store.findHostedSessionByToken(token);
  if (!session) {
    return {
      error: {
        code: 'unauthorized',
        message: 'invalid hosted session token',
      },
    } as const;
  }

  return session;
}

type HostedOwnerSessionEndpointResult =
  | {
      ok: true;
      session: NonNullable<ReturnType<GatewayStore['findHostedSessionByToken']>>;
    }
  | {
      ok: false;
      error: {
        statusCode: 401 | 403;
        code: 'unauthorized' | 'forbidden';
        message: string;
      };
    };

function getHostedOwnerSessionForEndpoint(store: GatewayStore, authorization: string | undefined): HostedOwnerSessionEndpointResult {
  const hostedSession = getAuthedHostedSession(store, authorization);
  if ('error' in hostedSession) {
    const gateway = getOptionalAuthedGateway(store, authorization);
    if (gateway) {
      return {
        ok: false,
        error: {
          statusCode: 403,
          code: 'forbidden',
          message: 'endpoint requires hosted owner session token',
        },
      };
    }

    return {
      ok: false,
      error: {
        statusCode: 401,
        code: hostedSession.error.code,
        message: hostedSession.error.message,
      },
    };
  }

  return {
    ok: true,
    session: hostedSession,
  };
}

type GatewayWriteEndpointResult =
  | {
      ok: true;
      gateway: NonNullable<ReturnType<GatewayStore['findByToken']>>;
    }
  | {
      ok: false;
      error: {
        statusCode: 401 | 403;
        code: 'unauthorized' | 'forbidden';
        message: string;
      };
    };

function getGatewayForSocialWriteEndpoint(
  store: GatewayStore,
  deploymentMode: DeploymentMode,
  authorization: string | undefined,
): GatewayWriteEndpointResult {
  if (deploymentMode === 'hosted') {
    const result = getAuthedGatewayCredentialOnly(store, authorization);
    if (!('gateway' in result)) {
      return {
        ok: false,
        error: result.error,
      };
    }

    return {
      ok: true,
      gateway: result.gateway,
    };
  }

  const result = getAuthedGateway(store, authorization);
  if ('error' in result) {
    return {
      ok: false,
      error: {
        statusCode: 401,
        code: result.error.code,
        message: result.error.message,
      },
    };
  }

  return {
    ok: true,
    gateway: result.gateway,
  };
}

function normalizeHostedRegistrationPolicy(value: string | undefined): HostedRegistrationPolicy | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'open' || normalized === 'closed' || normalized === 'invite_only') {
    return normalized;
  }

  return null;
}

function getEffectiveHostedRegistrationPolicy(store: GatewayStore): HostedRegistrationPolicy {
  return store.getHostedRegistrationPolicy() ?? 'invite_only';
}

function hostedRegistrationPolicyError(policy: HostedRegistrationPolicy) {
  if (policy === 'closed') {
    return {
      statusCode: 403,
      code: 'registration_closed',
      message: 'hosted registration is closed',
    } as const;
  }

  return {
    statusCode: 403,
    code: 'registration_invite_only',
    message: 'hosted registration is invite-only',
  } as const;
}

function toGatewaySummary(
  gateway: Pick<GatewayRecord, 'id' | 'handle' | 'displayName' | 'bio' | 'visibility' | 'friendRequestPolicy'>,
) {
  return {
    id: gateway.id,
    handle: gateway.handle,
    displayName: gateway.displayName,
    bio: gateway.bio,
    visibility: gateway.visibility,
    friendRequestPolicy: gateway.friendRequestPolicy,
  };
}

function toPublicGatewaySummary(gateway: GatewayRecord) {
  return {
    ...toGatewaySummary(gateway),
    createdAt: gateway.createdAt,
    updatedAt: gateway.updatedAt,
  };
}

function toPublicCurrentSummary(current: CurrentRecord) {
  return {
    id: current.id,
    key: current.key,
    label: current.label,
    summary: current.summary,
    tone: current.tone,
    sceneHint: current.sceneHint,
    startsAt: current.startsAt,
    endsAt: current.endsAt,
    source: current.source,
  };
}

function toAquaProfileSummary(profile: AquaProfileRecord) {
  return {
    displayName: profile.displayName,
    updatedAt: profile.updatedAt,
  };
}

function toEnvironmentSummary(environment: EnvironmentRecord) {
  return {
    id: environment.id,
    waterTemperatureC: environment.waterTemperatureC,
    clarity: environment.clarity,
    tideDirection: environment.tideDirection,
    surfaceState: environment.surfaceState,
    phenomenon: environment.phenomenon,
    summary: environment.summary,
    source: environment.source,
    updatedAt: environment.updatedAt,
    metadata: environment.metadata,
  };
}

function toPublicEnvironmentSummary(environment: EnvironmentRecord) {
  return {
    id: environment.id,
    waterTemperatureC: environment.waterTemperatureC,
    clarity: environment.clarity,
    tideDirection: environment.tideDirection,
    surfaceState: environment.surfaceState,
    phenomenon: environment.phenomenon,
    summary: environment.summary,
    source: environment.source,
    updatedAt: environment.updatedAt,
  };
}

function toPublicSeaEventMetadata(event: SeaEvent) {
  if (event.type === 'current.changed') {
    return {
      currentId: typeof event.metadata.currentId === 'string' ? event.metadata.currentId : null,
      currentKey: typeof event.metadata.currentKey === 'string' ? event.metadata.currentKey : null,
      currentLabel: typeof event.metadata.currentLabel === 'string' ? event.metadata.currentLabel : null,
      currentSummary: typeof event.metadata.currentSummary === 'string' ? event.metadata.currentSummary : null,
      currentTone: typeof event.metadata.currentTone === 'string' ? event.metadata.currentTone : null,
      currentSceneHint: typeof event.metadata.currentSceneHint === 'string' ? event.metadata.currentSceneHint : null,
      startsAt: typeof event.metadata.startsAt === 'string' ? event.metadata.startsAt : null,
      endsAt: typeof event.metadata.endsAt === 'string' ? event.metadata.endsAt : null,
      source: typeof event.metadata.source === 'string' ? event.metadata.source : null,
    };
  }

  if (event.type === 'environment.changed') {
    return {
      environmentId: typeof event.metadata.environmentId === 'string' ? event.metadata.environmentId : null,
      waterTemperatureC: typeof event.metadata.waterTemperatureC === 'number' ? event.metadata.waterTemperatureC : null,
      clarity: typeof event.metadata.clarity === 'string' ? event.metadata.clarity : null,
      tideDirection: typeof event.metadata.tideDirection === 'string' ? event.metadata.tideDirection : null,
      surfaceState: typeof event.metadata.surfaceState === 'string' ? event.metadata.surfaceState : null,
      phenomenon: typeof event.metadata.phenomenon === 'string' ? event.metadata.phenomenon : null,
      environmentSummary: typeof event.metadata.environmentSummary === 'string' ? event.metadata.environmentSummary : null,
      source: typeof event.metadata.source === 'string' ? event.metadata.source : null,
    };
  }

  return {};
}

function toPublicSeaEventSummary(store: GatewayStore, event: SeaEvent) {
  const primaryGatewayId = event.subjectGatewayId ?? event.actorGatewayId ?? null;
  const gateway = primaryGatewayId ? store.findById(primaryGatewayId) : null;

  return {
    id: event.id,
    type: event.type,
    visibility: event.visibility,
    summary: event.summary,
    tone: event.tone,
    sceneHint: event.sceneHint,
    createdAt: event.createdAt,
    gateway: gateway && store.canViewGatewayProfile(null, gateway.id) ? toPublicGatewaySummary(gateway) : null,
    metadata: toPublicSeaEventMetadata(event),
  };
}

function toSearchResult(
  store: GatewayStore,
  gateway: Pick<GatewayRecord, 'id' | 'handle' | 'displayName' | 'bio' | 'visibility' | 'friendRequestPolicy'>,
) {
  return {
    ...toGatewaySummary(gateway),
    status: store.getPresence(gateway.id).status,
    tags: [] as string[],
  };
}

function toConversationSummary(
  store: GatewayStore,
  item: ConversationListItem,
) {
  return {
    id: item.conversation.id,
    type: item.conversation.type,
    peer: {
      ...toGatewaySummary(item.peerGateway),
      status: store.getPresence(item.peerGateway.id).status,
    },
    latestMessage: item.latestMessage
      ? {
          id: item.latestMessage.id,
          senderGatewayId: item.latestMessage.senderGatewayId,
          messageType: item.latestMessage.messageType,
          createdAt: item.latestMessage.createdAt,
        }
      : null,
    readState: toConversationReadStateSummary(item.readState, item.unreadCount, item.latestMessage),
    createdAt: item.conversation.createdAt,
    updatedAt: item.conversation.updatedAt,
  };
}

function toConversationReadStateSummary(
  state: ConversationReadStateSummary['readState'],
  unreadCount: number,
  latestMessage: ConversationReadStateSummary['latestMessage'],
) {
  return {
    lastReadMessageId: state.lastReadMessageId,
    lastReadAt: state.lastReadAt,
    updatedAt: state.updatedAt,
    unreadCount,
    latestMessageId: latestMessage?.id ?? null,
    latestMessageAt: latestMessage?.createdAt ?? null,
  };
}

function toFriendSummary(
  store: GatewayStore,
  gateway: Pick<GatewayRecord, 'id' | 'handle' | 'displayName' | 'bio' | 'visibility' | 'friendRequestPolicy'>,
) {
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

function toLocalSessionSummary(session: { id: string; gatewayId: string; createdAt: string }) {
  return {
    id: session.id,
    gatewayId: session.gatewayId,
    createdAt: session.createdAt,
    kind: 'local_session',
  };
}

function toHostedSessionSummary(session: { id: string; gatewayId: string; createdAt: string }) {
  return {
    id: session.id,
    gatewayId: session.gatewayId,
    createdAt: session.createdAt,
    kind: 'hosted_session',
  };
}

function toLocalRuntimeSummary(
  store: GatewayStore,
  runtime: {
    binding: {
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
    };
    status: 'online' | 'recently_active' | 'offline';
  },
) {
  const gateway = store.findById(runtime.binding.gatewayId);
  const presence = gateway ? store.getPresence(gateway.id) : null;

  return {
    runtime: {
      id: runtime.binding.id,
      installationId: runtime.binding.installationId,
      runtimeId: runtime.binding.runtimeId,
      label: runtime.binding.label,
      source: runtime.binding.source,
      status: runtime.status,
      lastHeartbeatAt: runtime.binding.lastHeartbeatAt,
      metadata: runtime.binding.metadata,
      createdAt: runtime.binding.createdAt,
      updatedAt: runtime.binding.updatedAt,
    },
    gateway: gateway ? toGatewaySummary(gateway) : null,
    presence: presence
      ? {
          status: presence.status,
          lastSeenAt: presence.lastSeenAt,
        }
      : null,
  };
}

function toRemoteRuntimeSummary(
  store: GatewayStore,
  runtime: {
    binding: {
      id: string;
      bridgeCredentialId: string;
      installationId: string;
      runtimeId: string;
      gatewayId: string;
      label: string;
      source: string;
      metadata: Record<string, unknown>;
      lastHeartbeatAt: string | null;
      createdAt: string;
      updatedAt: string;
    };
    status: 'online' | 'recently_active' | 'offline';
  },
) {
  const gateway = store.findById(runtime.binding.gatewayId);
  const presence = gateway ? store.getPresence(gateway.id) : null;

  return {
    runtime: {
      id: runtime.binding.id,
      bridgeCredentialId: runtime.binding.bridgeCredentialId,
      installationId: runtime.binding.installationId,
      runtimeId: runtime.binding.runtimeId,
      label: runtime.binding.label,
      source: runtime.binding.source,
      status: runtime.status,
      lastHeartbeatAt: runtime.binding.lastHeartbeatAt,
      metadata: runtime.binding.metadata,
      createdAt: runtime.binding.createdAt,
      updatedAt: runtime.binding.updatedAt,
    },
    gateway: gateway ? toGatewaySummary(gateway) : null,
    presence: presence
      ? {
          status: presence.status,
          lastSeenAt: presence.lastSeenAt,
        }
      : null,
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
  if (message === 'owner gateway cannot participate in friend requests') {
    return { statusCode: 403, code: 'owner_protected' };
  }
  if (message === 'target gateway is not accepting friend requests') {
    return { statusCode: 403, code: 'friend_requests_disabled' };
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
  if (message === 'invite revoke forbidden') {
    return { statusCode: 403, code: 'forbidden' };
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

function environmentErrorToHttp(_message: string) {
  return { statusCode: 400, code: 'validation_failed' };
}

function aquaProfileErrorToHttp(message: string) {
  if (message === 'aqua profile update requires the owner gateway') {
    return { statusCode: 403, code: 'forbidden' };
  }
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

function sceneErrorToHttp(message: string) {
  if (message === 'gateway not found') {
    return { statusCode: 404, code: 'not_found' };
  }
  if (message === 'invalid scene cursor') {
    return { statusCode: 400, code: 'invalid_cursor' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

function localRuntimeErrorToHttp(message: string) {
  if (message === 'local runtime binding not found') {
    return { statusCode: 404, code: 'not_found' };
  }
  if (message === 'local runtime binding requires the primary owner gateway') {
    return { statusCode: 403, code: 'forbidden' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

function remoteRuntimeErrorToHttp(message: string) {
  if (message === 'gateway not found' || message === 'remote runtime bridge credential not found' || message === 'remote runtime binding not found') {
    return { statusCode: 404, code: 'not_found' };
  }
  if (message === 'hosted runtime bridge credential requires the hosted owner gateway') {
    return { statusCode: 403, code: 'forbidden' };
  }
  if (
    message === 'remote runtime bridge credential expired' ||
    message === 'remote runtime bridge credential revoked' ||
    message === 'remote runtime bridge credential already claimed' ||
    message === 'remote runtime binding does not match runtimeId'
  ) {
    return { statusCode: 409, code: 'invalid_state' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

function localReefErrorToHttp(message: string) {
  if (message === 'gateway not found') {
    return { statusCode: 404, code: 'not_found' };
  }
  if (message === 'blocked relationship') {
    return { statusCode: 403, code: 'blocked' };
  }
  if (message === 'local runtime binding requires the primary owner gateway') {
    return { statusCode: 403, code: 'forbidden' };
  }
  return { statusCode: 400, code: 'validation_failed' };
}

function sendLocalModeOnly(reply: FastifyReply) {
  return reply.code(403).send({
    ok: false,
    error: {
      code: 'local_mode_only',
      message: 'endpoint is only available in local deployment mode',
    },
  });
}

function sendHostedModeOnly(reply: FastifyReply) {
  return reply.code(403).send({
    ok: false,
    error: {
      code: 'hosted_mode_only',
      message: 'endpoint is only available in hosted deployment mode',
    },
  });
}

function sendRateLimited(reply: FastifyReply, retryAfterSeconds?: number) {
  if (retryAfterSeconds !== undefined) {
    reply.header('retry-after', String(retryAfterSeconds));
  }

  return reply.code(429).send({
    ok: false,
    error: {
      code: 'rate_limited',
      message: 'rate limit exceeded',
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    },
  });
}

function getSourceRateLimitKey(request: FastifyRequest) {
  const source = request.ip.trim();
  return source || 'unknown';
}

const DEFAULT_HOSTED_RATE_LIMITS: HostedRateLimitPolicies = {
  bootstrapHosted: { limit: 5, windowMs: 60_000 },
  registerGateway: { limit: 10, windowMs: 60_000 },
  remoteBind: { limit: 10, windowMs: 60_000 },
  remoteHeartbeat: { limit: 120, windowMs: 60_000 },
};

export function buildApp(options: BuildAppOptions = {}) {
  const store = options.store ?? createGatewayStore();
  const deploymentMode = options.deploymentMode ?? 'local';
  const hostedOwnerBootstrapKey = options.hostedOwnerBootstrapKey ?? process.env.AQUA_HOSTED_OWNER_BOOTSTRAP_KEY ?? null;
  const hostedRateLimits: HostedRateLimitPolicies = {
    ...DEFAULT_HOSTED_RATE_LIMITS,
    ...options.hostedRateLimits,
  };
  const hostedRateLimiter = createInMemoryRateLimiter(options.now ?? Date.now);
  const app = Fastify({ logger: true });
  const liveHub = new SeaLiveHub(store, options.seaLiveHub);
  const detachLiveSource = isSeaEventLiveSource(store) ? liveHub.attach(store) : null;

  app.addHook('onClose', async () => {
    detachLiveSource?.();
  });

  function enforceHostedRateLimit(target: keyof HostedRateLimitPolicies, key: string, reply: FastifyReply) {
    const decision = hostedRateLimiter.consume(`${target}:${key}`, hostedRateLimits[target]);
    if (!decision.allowed) {
      return sendRateLimited(reply, decision.retryAfterSeconds);
    }
    return null;
  }

  app.get('/health', async () => ({ ok: true, data: { status: 'ok' } }));

  app.get('/api/v1/public/aqua', async () => ({
    ok: true,
    data: {
      aqua: toAquaProfileSummary(store.getAquaProfile()),
    },
  }));

  app.get('/api/v1/public/current', async () => ({
    ok: true,
    data: {
      current: toPublicCurrentSummary(store.getCurrent()),
    },
  }));

  app.get('/api/v1/public/environment', async () => ({
    ok: true,
    data: {
      environment: toPublicEnvironmentSummary(store.getEnvironment()),
    },
  }));

  app.get<{ Querystring: SeaFeedQuerystring }>('/api/v1/public/feed', async (request, reply) => {
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
      const feed = store.listPublicSeaFeed({
        cursor: request.query.cursor?.trim() || undefined,
        limit: parsedLimit.value,
      });

      return {
        ok: true,
        data: {
          items: feed.items.map((event) => toPublicSeaEventSummary(store, event)),
          nextCursor: feed.nextCursor,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to list public sea feed';
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: messageText,
        },
      });
    }
  });

  app.get<{ Querystring: PublicGatewayQuerystring }>('/api/v1/public/gateways', async (request, reply) => {
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
      const gateways = store.listPublicGateways({
        cursor: request.query.cursor?.trim() || undefined,
        limit: parsedLimit.value,
      });

      return {
        ok: true,
        data: {
          items: gateways.items.map((gateway) => toPublicGatewaySummary(gateway)),
          nextCursor: gateways.nextCursor,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to list public gateways';
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: messageText,
        },
      });
    }
  });

  app.post<{ Body: BootstrapLocalSessionBody }>('/api/v1/session/bootstrap-local', async (request, reply) => {
    if (deploymentMode === 'hosted') {
      return sendLocalModeOnly(reply);
    }

    const { displayName, handle, bio, visibility } = request.body ?? {};

    if (displayName !== undefined && (typeof displayName !== 'string' || !displayName.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'displayName must be a non-empty string when provided',
        },
      });
    }
    if (handle !== undefined && (typeof handle !== 'string' || !handle.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'handle must be a non-empty string when provided',
        },
      });
    }
    if (bio !== undefined && typeof bio !== 'string') {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'bio must be a string when provided',
        },
      });
    }

    try {
      const result = store.bootstrapLocalSession({
        displayName,
        handle,
        bio,
        visibility,
      });

      return reply.code(result.createdOwner ? 201 : 200).send({
        ok: true,
        data: {
          gateway: result.gateway,
          session: toLocalSessionSummary(result.session),
          credential: {
            token: result.session.token,
            kind: 'local_session',
          },
          owner: {
            isPrimary: true,
            created: result.createdOwner,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to bootstrap local session';
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

  app.get('/api/v1/session/me', async (request, reply) => {
    if (deploymentMode === 'hosted') {
      return sendLocalModeOnly(reply);
    }

    const result = getAuthedLocalSession(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    return {
      ok: true,
      data: {
        gateway: result.gateway,
        session: toLocalSessionSummary(result.session),
        owner: {
          isPrimary: true,
        },
      },
    };
  });

  app.post('/api/v1/session/logout', async (request, reply) => {
    if (deploymentMode === 'hosted') {
      return sendLocalModeOnly(reply);
    }

    const token = extractBearerToken(request.headers.authorization);
    const session = token ? store.findLocalSessionByToken(token) : null;
    if (!token || !session) {
      return reply.code(401).send({
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'invalid local session token',
        },
      });
    }

    store.logoutLocalSession(token);
    return {
      ok: true,
      data: {
        loggedOut: true,
        sessionId: session.session.id,
      },
    };
  });

  app.post<{ Body: BootstrapHostedSessionBody }>('/api/v1/session/bootstrap-hosted', async (request, reply) => {
    if (deploymentMode !== 'hosted') {
      return sendHostedModeOnly(reply);
    }

    const configuredBootstrapKey = hostedOwnerBootstrapKey?.trim();
    if (!configuredBootstrapKey) {
      return reply.code(503).send({
        ok: false,
        error: {
          code: 'hosted_bootstrap_not_configured',
          message: 'AQUA_HOSTED_OWNER_BOOTSTRAP_KEY is required for hosted owner bootstrap',
        },
      });
    }

    const { bootstrapKey, displayName, handle, bio, visibility } = request.body ?? {};
    if (typeof bootstrapKey !== 'string' || !bootstrapKey.trim()) {
      return reply.code(401).send({
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'bootstrapKey is required',
        },
      });
    }
    if (bootstrapKey.trim() !== configuredBootstrapKey) {
      return reply.code(401).send({
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'invalid bootstrapKey',
        },
      });
    }

    if (displayName !== undefined && (typeof displayName !== 'string' || !displayName.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'displayName must be a non-empty string when provided',
        },
      });
    }
    if (handle !== undefined && (typeof handle !== 'string' || !handle.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'handle must be a non-empty string when provided',
        },
      });
    }
    if (bio !== undefined && typeof bio !== 'string') {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'bio must be a string when provided',
        },
      });
    }

    const bootstrapLimit = enforceHostedRateLimit('bootstrapHosted', getSourceRateLimitKey(request), reply);
    if (bootstrapLimit) {
      return bootstrapLimit;
    }

    try {
      const result = store.bootstrapHostedSession({
        displayName,
        handle,
        bio,
        visibility,
      });

      return reply.code(result.createdOwner ? 201 : 200).send({
        ok: true,
        data: {
          gateway: result.gateway,
          session: toHostedSessionSummary(result.session),
          credential: {
            token: result.session.token,
            kind: 'hosted_session',
          },
          owner: {
            isPrimary: true,
            created: result.createdOwner,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to bootstrap hosted session';
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

  app.get('/api/v1/session/hosted/me', async (request, reply) => {
    if (deploymentMode !== 'hosted') {
      return sendHostedModeOnly(reply);
    }

    const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
    if (!hostedOwner.ok) {
      const endpointError = hostedOwner.error;
      return reply.code(endpointError.statusCode).send({
        ok: false,
        error: {
          code: endpointError.code,
          message: endpointError.message,
        },
      });
    }

    return {
      ok: true,
      data: {
        gateway: hostedOwner.session.gateway,
        session: toHostedSessionSummary(hostedOwner.session.session),
        owner: {
          isPrimary: true,
        },
      },
    };
  });

  app.post('/api/v1/session/hosted/logout', async (request, reply) => {
    if (deploymentMode !== 'hosted') {
      return sendHostedModeOnly(reply);
    }

    const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
    if (!hostedOwner.ok) {
      const endpointError = hostedOwner.error;
      return reply.code(endpointError.statusCode).send({
        ok: false,
        error: {
          code: endpointError.code,
          message: endpointError.message,
        },
      });
    }

    store.logoutHostedSession(hostedOwner.session.session.token);
    return {
      ok: true,
      data: {
        loggedOut: true,
        sessionId: hostedOwner.session.session.id,
      },
    };
  });

  app.post<{ Body: RevokeHostedSessionsBody }>('/api/v1/session/hosted/revoke', async (request, reply) => {
    if (deploymentMode !== 'hosted') {
      return sendHostedModeOnly(reply);
    }

    const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
    if (!hostedOwner.ok) {
      const endpointError = hostedOwner.error;
      return reply.code(endpointError.statusCode).send({
        ok: false,
        error: {
          code: endpointError.code,
          message: endpointError.message,
        },
      });
    }

    const { revokeCurrent } = request.body ?? {};
    if (revokeCurrent !== undefined && typeof revokeCurrent !== 'boolean') {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'revokeCurrent must be a boolean when provided',
        },
      });
    }

    const revokedSessions = store.revokeHostedSessions({
      gatewayId: hostedOwner.session.gateway.id,
      exceptToken: revokeCurrent ? undefined : hostedOwner.session.session.token,
    });

    return {
      ok: true,
      data: {
        revokedCount: revokedSessions.length,
        revokedSessionIds: revokedSessions.map((session) => session.id),
        currentSessionRevoked: revokeCurrent === true,
      },
    };
  });

  app.patch<{ Body: UpdateHostedRegistrationPolicyBody }>('/api/v1/registration-policy', async (request, reply) => {
    if (deploymentMode !== 'hosted') {
      return sendHostedModeOnly(reply);
    }

    const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
    if (!hostedOwner.ok) {
      const endpointError = hostedOwner.error;
      return reply.code(endpointError.statusCode).send({
        ok: false,
        error: {
          code: endpointError.code,
          message: endpointError.message,
        },
      });
    }

    const policy = normalizeHostedRegistrationPolicy(request.body?.policy);
    if (!policy) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'policy must be one of open, closed, invite_only',
        },
      });
    }

    try {
      const updatedPolicy = store.setHostedRegistrationPolicy({
        policy,
        actorGatewayId: hostedOwner.session.gateway.id,
      });

      return {
        ok: true,
        data: {
          policy: updatedPolicy,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to update hosted registration policy';
      const statusCode = message === 'hosted runtime bridge credential requires the hosted owner gateway' ? 403 : 400;
      return reply.code(statusCode).send({
        ok: false,
        error: {
          code: statusCode === 403 ? 'forbidden' : 'validation_failed',
          message,
        },
      });
    }
  });

  app.get('/api/v1/runtime/local', async (request, reply) => {
    if (deploymentMode === 'hosted') {
      return sendLocalModeOnly(reply);
    }

    const result = getAuthedLocalSession(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const runtime = store.getLocalRuntimeBinding();
    if (!runtime) {
      return reply.code(404).send({
        ok: false,
        error: {
          code: 'not_found',
          message: 'local runtime binding not found',
        },
      });
    }

    return {
      ok: true,
      data: toLocalRuntimeSummary(store, runtime),
    };
  });

  app.post<{ Body: BindLocalRuntimeBody }>('/api/v1/runtime/local/bind', async (request, reply) => {
    if (deploymentMode === 'hosted') {
      return sendLocalModeOnly(reply);
    }

    const result = getAuthedLocalSession(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const { installationId, runtimeId, label, source, metadata } = request.body ?? {};
    if (installationId !== undefined && (typeof installationId !== 'string' || !installationId.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'installationId must be a non-empty string when provided',
        },
      });
    }
    if (runtimeId !== undefined && (typeof runtimeId !== 'string' || !runtimeId.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'runtimeId must be a non-empty string when provided',
        },
      });
    }
    if (label !== undefined && (typeof label !== 'string' || !label.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'label must be a non-empty string when provided',
        },
      });
    }
    if (source !== undefined && (typeof source !== 'string' || !source.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'source must be a non-empty string when provided',
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
      const runtime = store.bindLocalRuntime({
        gatewayId: result.gateway.id,
        installationId,
        runtimeId,
        label,
        source,
        metadata,
      });

      return reply.code(runtime.created ? 201 : 200).send({
        ok: true,
        data: {
          ...toLocalRuntimeSummary(store, runtime.runtime),
          created: runtime.created,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to bind local runtime';
      const mapped = localRuntimeErrorToHttp(message);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message,
        },
      });
    }
  });

  app.post<{ Body: RuntimeHeartbeatBody }>('/api/v1/runtime/local/heartbeat', async (request, reply) => {
    if (deploymentMode === 'hosted') {
      return sendLocalModeOnly(reply);
    }

    const result = getAuthedLocalSession(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const connectionType = request.body?.connectionType?.trim();
    if (request.body?.connectionType !== undefined && !connectionType) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'connectionType must be a non-empty string when provided',
        },
      });
    }
    const metadata = request.body?.metadata;
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
      const runtime = store.heartbeatLocalRuntime({
        gatewayId: result.gateway.id,
        connectionType: connectionType ?? null,
        metadata,
      });

      return {
        ok: true,
        data: {
          ...toLocalRuntimeSummary(store, runtime.runtime),
          connectionType: connectionType ?? null,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to heartbeat local runtime';
      const mapped = localRuntimeErrorToHttp(message);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message,
        },
      });
    }
  });

  app.get('/api/v1/runtime/remote/me', async (request, reply) => {
    if (deploymentMode !== 'hosted') {
      return sendHostedModeOnly(reply);
    }

    const result = getAuthedGatewayCredentialOnly(store, request.headers.authorization);
    if (!('gateway' in result)) {
      const error = result.error;
      return reply.code(error.statusCode).send({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    const runtime = store.getRemoteRuntimeBindingByGatewayId(result.gateway!.id);
    if (!runtime) {
      return reply.code(404).send({
        ok: false,
        error: {
          code: 'not_found',
          message: 'remote runtime binding not found',
        },
      });
    }

    return {
      ok: true,
      data: toRemoteRuntimeSummary(store, runtime),
    };
  });

  app.post<{ Body: CreateRemoteRuntimeBridgeCredentialBody }>('/api/v1/runtime/remote/bridge-credentials', async (request, reply) => {
    if (deploymentMode !== 'hosted') {
      return sendHostedModeOnly(reply);
    }

    const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
    if (!hostedOwner.ok) {
      const endpointError = hostedOwner.error;
      return reply.code(endpointError.statusCode).send({
        ok: false,
        error: {
          code: endpointError.code,
          message: endpointError.message,
        },
      });
    }

    const { label, metadata } = request.body ?? {};
    if (label !== undefined && (typeof label !== 'string' || !label.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'label must be a non-empty string when provided',
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
      const credential = store.createRemoteRuntimeBridgeCredential({
        createdByGatewayId: hostedOwner.session.gateway.id,
        label,
        metadata,
      });

      return reply.code(201).send({
        ok: true,
        data: {
          credential: {
            id: credential.id,
            token: credential.token,
            createdByGatewayId: credential.createdByGatewayId,
            claimedByGatewayId: credential.claimedByGatewayId,
            label: credential.label,
            metadata: credential.metadata,
            expiresAt: credential.expiresAt,
            revokedAt: credential.revokedAt,
            revokedByGatewayId: credential.revokedByGatewayId,
            createdAt: credential.createdAt,
            updatedAt: credential.updatedAt,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to create remote runtime bridge credential';
      const mapped = remoteRuntimeErrorToHttp(message);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message,
        },
      });
    }
  });

  app.post<{ Params: RevokeRemoteRuntimeBridgeCredentialParams }>(
    '/api/v1/runtime/remote/bridge-credentials/:credentialId/revoke',
    async (request, reply) => {
      if (deploymentMode !== 'hosted') {
        return sendHostedModeOnly(reply);
      }

      const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
      if (!hostedOwner.ok) {
        const endpointError = hostedOwner.error;
        return reply.code(endpointError.statusCode).send({
          ok: false,
          error: {
            code: endpointError.code,
            message: endpointError.message,
          },
        });
      }

      const credentialId = request.params?.credentialId?.trim();
      if (!credentialId) {
        return reply.code(400).send({
          ok: false,
          error: {
            code: 'validation_failed',
            message: 'credentialId is required',
          },
        });
      }

      try {
        const credential = store.revokeRemoteRuntimeBridgeCredential({
          credentialId,
          revokedByGatewayId: hostedOwner.session.gateway.id,
        });

        return {
          ok: true,
          data: {
            credential: {
              id: credential.id,
              createdByGatewayId: credential.createdByGatewayId,
              claimedByGatewayId: credential.claimedByGatewayId,
              label: credential.label,
              metadata: credential.metadata,
              expiresAt: credential.expiresAt,
              revokedAt: credential.revokedAt,
              revokedByGatewayId: credential.revokedByGatewayId,
              createdAt: credential.createdAt,
              updatedAt: credential.updatedAt,
            },
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'failed to revoke remote runtime bridge credential';
        const mapped = remoteRuntimeErrorToHttp(message);
        return reply.code(mapped.statusCode).send({
          ok: false,
          error: {
            code: mapped.code,
            message,
          },
        });
      }
    },
  );

  app.post<{ Body: BindRemoteRuntimeBody }>('/api/v1/runtime/remote/bind', async (request, reply) => {
    if (deploymentMode !== 'hosted') {
      return sendHostedModeOnly(reply);
    }

    const result = getAuthedGatewayCredentialOnly(store, request.headers.authorization);
    if (!('gateway' in result)) {
      const error = result.error;
      return reply.code(error.statusCode).send({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    const { bridgeToken, installationId, runtimeId, label, source, metadata } = request.body ?? {};

    if (typeof bridgeToken !== 'string' || !bridgeToken.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'bridgeToken is required',
        },
      });
    }
    if (installationId !== undefined && (typeof installationId !== 'string' || !installationId.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'installationId must be a non-empty string when provided',
        },
      });
    }
    if (runtimeId !== undefined && (typeof runtimeId !== 'string' || !runtimeId.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'runtimeId must be a non-empty string when provided',
        },
      });
    }
    if (label !== undefined && (typeof label !== 'string' || !label.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'label must be a non-empty string when provided',
        },
      });
    }
    if (source !== undefined && (typeof source !== 'string' || !source.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'source must be a non-empty string when provided',
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

    const bindLimit = enforceHostedRateLimit('remoteBind', result.gateway.id, reply);
    if (bindLimit) {
      return bindLimit;
    }

    try {
      const runtime = store.bindRemoteRuntime({
        bridgeToken,
        gatewayId: result.gateway!.id,
        installationId,
        runtimeId,
        label,
        source,
        metadata,
      });

      return reply.code(runtime.created ? 201 : 200).send({
        ok: true,
        data: {
          ...toRemoteRuntimeSummary(store, runtime.runtime),
          bridgeCredential: {
            id: runtime.bridgeCredential.id,
            createdByGatewayId: runtime.bridgeCredential.createdByGatewayId,
            claimedByGatewayId: runtime.bridgeCredential.claimedByGatewayId,
            label: runtime.bridgeCredential.label,
            metadata: runtime.bridgeCredential.metadata,
            expiresAt: runtime.bridgeCredential.expiresAt,
            revokedAt: runtime.bridgeCredential.revokedAt,
            revokedByGatewayId: runtime.bridgeCredential.revokedByGatewayId,
            createdAt: runtime.bridgeCredential.createdAt,
            updatedAt: runtime.bridgeCredential.updatedAt,
          },
          created: runtime.created,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to bind remote runtime';
      const mapped = remoteRuntimeErrorToHttp(message);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message,
        },
      });
    }
  });

  app.post<{ Body: RuntimeHeartbeatBody }>('/api/v1/runtime/remote/heartbeat', async (request, reply) => {
    if (deploymentMode !== 'hosted') {
      return sendHostedModeOnly(reply);
    }

    const result = getAuthedGatewayCredentialOnly(store, request.headers.authorization);
    if (!('gateway' in result)) {
      const error = result.error;
      return reply.code(error.statusCode).send({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    const runtimeId = request.body?.runtimeId?.trim();
    if (!runtimeId) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'runtimeId is required',
        },
      });
    }

    const connectionType = request.body?.connectionType?.trim();
    if (request.body?.connectionType !== undefined && !connectionType) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'connectionType must be a non-empty string when provided',
        },
      });
    }

    const metadata = request.body?.metadata;
    if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'metadata must be an object when provided',
        },
      });
    }

    const heartbeatLimit = enforceHostedRateLimit('remoteHeartbeat', result.gateway.id, reply);
    if (heartbeatLimit) {
      return heartbeatLimit;
    }

    try {
      const runtime = store.heartbeatRemoteRuntime({
        gatewayId: result.gateway!.id,
        runtimeId,
        connectionType: connectionType ?? null,
        metadata,
      });

      return {
        ok: true,
        data: {
          ...toRemoteRuntimeSummary(store, runtime.runtime),
          connectionType: connectionType ?? null,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to heartbeat remote runtime';
      const mapped = remoteRuntimeErrorToHttp(message);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message,
        },
      });
    }
  });

  app.post<{ Body: JoinHostedRuntimeByInviteBody }>('/api/v1/runtime/remote/join-by-invite', async (request, reply) => {
    if (deploymentMode !== 'hosted') {
      return sendHostedModeOnly(reply);
    }

    const inviteCode = request.body?.inviteCode?.trim();
    if (!inviteCode) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'inviteCode is required',
        },
      });
    }

    const displayName = request.body?.displayName?.trim();
    if (!displayName) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'displayName is required',
        },
      });
    }

    const handle = request.body?.handle?.trim();
    if (!handle) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'handle is required',
        },
      });
    }

    const connectionType = request.body?.connectionType?.trim();
    if (request.body?.connectionType !== undefined && !connectionType) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'connectionType must be a non-empty string when provided',
        },
      });
    }

    const { bio, visibility, installationId, runtimeId, label, source, metadata, heartbeatMetadata } = request.body ?? {};

    if (bio !== undefined && typeof bio !== 'string') {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'bio must be a string when provided',
        },
      });
    }
    if (installationId !== undefined && (typeof installationId !== 'string' || !installationId.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'installationId must be a non-empty string when provided',
        },
      });
    }
    if (runtimeId !== undefined && (typeof runtimeId !== 'string' || !runtimeId.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'runtimeId must be a non-empty string when provided',
        },
      });
    }
    if (label !== undefined && (typeof label !== 'string' || !label.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'label must be a non-empty string when provided',
        },
      });
    }
    if (source !== undefined && (typeof source !== 'string' || !source.trim())) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'source must be a non-empty string when provided',
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
    if (
      heartbeatMetadata !== undefined &&
      (typeof heartbeatMetadata !== 'object' || heartbeatMetadata === null || Array.isArray(heartbeatMetadata))
    ) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'heartbeatMetadata must be an object when provided',
        },
      });
    }

    const registrationLimit = enforceHostedRateLimit('registerGateway', getSourceRateLimitKey(request), reply);
    if (registrationLimit) {
      return registrationLimit;
    }

    try {
      const joined = store.joinHostedRuntimeWithInvite({
        inviteCode,
        displayName,
        handle,
        bio,
        visibility,
        installationId,
        runtimeId,
        label,
        source,
        metadata,
        connectionType: connectionType ?? 'openclaw_hosted_join',
        heartbeatMetadata: heartbeatMetadata ?? metadata,
      });
      const inviterGateway = store.findById(joined.invite.createdByGatewayId);
      const friendRequest = joined.friendRequest
        ? {
            ...joined.friendRequest,
            fromGateway: toGatewaySummary(joined.gateway),
            toGateway: inviterGateway ? toGatewaySummary(inviterGateway) : null,
          }
        : null;

      return reply.code(201).send({
        ok: true,
        data: {
          gateway: joined.gateway,
          credential: {
            token: joined.token,
            kind: 'gateway_bearer',
          },
          invite: joined.invite,
          claim: joined.claim,
          inviterGateway: inviterGateway ? toGatewaySummary(inviterGateway) : null,
          friendRequest,
          runtime: toRemoteRuntimeSummary(store, joined.runtime),
          bridgeCredential: {
            id: joined.bridgeCredential.id,
            createdByGatewayId: joined.bridgeCredential.createdByGatewayId,
            claimedByGatewayId: joined.bridgeCredential.claimedByGatewayId,
            label: joined.bridgeCredential.label,
            metadata: joined.bridgeCredential.metadata,
            expiresAt: joined.bridgeCredential.expiresAt,
            revokedAt: joined.bridgeCredential.revokedAt,
            revokedByGatewayId: joined.bridgeCredential.revokedByGatewayId,
            createdAt: joined.bridgeCredential.createdAt,
            updatedAt: joined.bridgeCredential.updatedAt,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to join hosted runtime by invite';
      let mapped:
        | { statusCode: number; code: string }
        | undefined;

      if (message === 'handle already exists') {
        mapped = { statusCode: 409, code: 'handle_conflict' };
      } else if (message === 'hosted owner gateway not found') {
        mapped = { statusCode: 503, code: 'hosted_join_unavailable' };
      } else if (message === 'hosted invite requires the hosted owner gateway') {
        mapped = { statusCode: 403, code: 'forbidden' };
      } else if (
        message === 'invite not found' ||
        message === 'invite revoked' ||
        message === 'invite expired' ||
        message === 'invite exhausted' ||
        message === 'invite already claimed' ||
        message === 'pending request already exists' ||
        message === 'already friends'
      ) {
        mapped = inviteErrorToHttp(message);
      } else if (
        message === 'gateway not found' ||
        message === 'remote runtime bridge credential not found' ||
        message === 'remote runtime binding not found' ||
        message === 'remote runtime bridge credential revoked' ||
        message === 'remote runtime bridge credential expired' ||
        message === 'remote runtime bridge credential already claimed' ||
        message === 'remote runtime binding does not match runtimeId'
      ) {
        mapped = remoteRuntimeErrorToHttp(message);
      } else {
        mapped = { statusCode: 400, code: 'validation_failed' };
      }

      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message,
        },
      });
    }
  });

  app.post('/api/v1/local/reef/seed', async (request, reply) => {
    if (deploymentMode === 'hosted') {
      return sendLocalModeOnly(reply);
    }

    const result = getAuthedLocalSession(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    try {
      const reef = store.seedLocalReefSandbox({
        ownerGatewayId: result.gateway.id,
      });

      return reply.code(reef.applied === 'created' ? 201 : 200).send({
        ok: true,
        data: {
          reef,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to seed local reef';
      const mapped = localReefErrorToHttp(message);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message,
        },
      });
    }
  });

  app.get('/api/v1/currents/current', async () => ({
    ok: true,
    data: {
      current: store.getCurrent(),
    },
  }));

  app.get('/api/v1/environment/current', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({
        ok: false,
        error: result.error,
      });
    }

    return {
      ok: true,
      data: {
        environment: toEnvironmentSummary(store.getEnvironment()),
      },
    };
  });

  app.post<{ Body: SetCurrentBody }>('/api/v1/currents', async (request, reply) => {
    let actorGatewayId: string;

    if (deploymentMode === 'hosted') {
      const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
      if (!hostedOwner.ok) {
        const endpointError = hostedOwner.error;
        return reply.code(endpointError.statusCode).send({
          ok: false,
          error: {
            code: endpointError.code,
            message: endpointError.message,
          },
        });
      }
      actorGatewayId = hostedOwner.session.gateway.id;
    } else {
      const result = getAuthedGateway(store, request.headers.authorization);
      if ('error' in result) {
        return reply.code(401).send({ ok: false, error: result.error });
      }
      actorGatewayId = result.gateway.id;
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
        actorGatewayId,
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
    if (deploymentMode === 'hosted') {
      const policy = getEffectiveHostedRegistrationPolicy(store);
      if (policy !== 'open') {
        const registrationError = hostedRegistrationPolicyError(policy);
        return reply.code(registrationError.statusCode).send({
          ok: false,
          error: {
            code: registrationError.code,
            message: registrationError.message,
          },
        });
      }
    }

    const { displayName, handle, bio, visibility, friendRequestPolicy } = request.body ?? {};

    if (!displayName?.trim() || !handle?.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'displayName and handle are required',
        },
      });
    }

    if (deploymentMode === 'hosted') {
      const registrationLimit = enforceHostedRateLimit('registerGateway', getSourceRateLimitKey(request), reply);
      if (registrationLimit) {
        return registrationLimit;
      }
    }

    try {
      const { gateway, token } = store.register({ displayName, handle, bio, visibility, friendRequestPolicy });
      return reply.code(201).send({
        ok: true,
        data: {
          gateway: {
            id: gateway.id,
            displayName: gateway.displayName,
            handle: gateway.handle,
            bio: gateway.bio,
            visibility: gateway.visibility,
            friendRequestPolicy: gateway.friendRequestPolicy,
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

  app.patch<{ Body: UpdateAquaBody }>('/api/v1/aqua/me', async (request, reply) => {
    let actorGatewayId: string;

    if (deploymentMode === 'hosted') {
      const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
      if (!hostedOwner.ok) {
        const endpointError = hostedOwner.error;
        return reply.code(endpointError.statusCode).send({
          ok: false,
          error: {
            code: endpointError.code,
            message: endpointError.message,
          },
        });
      }
      actorGatewayId = hostedOwner.session.gateway.id;
    } else {
      const result = getAuthedGateway(store, request.headers.authorization);
      if ('error' in result) {
        return reply.code(401).send({ ok: false, error: result.error });
      }
      actorGatewayId = result.gateway.id;
    }

    const { displayName } = request.body ?? {};
    if (typeof displayName !== 'string' || !displayName.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'displayName is required',
        },
      });
    }

    try {
      const aqua = store.updateAquaProfile({
        gatewayId: actorGatewayId,
        displayName,
      });
      return {
        ok: true,
        data: {
          aqua: toAquaProfileSummary(aqua),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to update aqua profile';
      const mapped = aquaProfileErrorToHttp(message);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message,
        },
      });
    }
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

  app.post<{ Body: SetEnvironmentBody }>('/api/v1/environment', async (request, reply) => {
    let actorGatewayId: string;

    if (deploymentMode === 'hosted') {
      const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
      if (!hostedOwner.ok) {
        const endpointError = hostedOwner.error;
        return reply.code(endpointError.statusCode).send({
          ok: false,
          error: {
            code: endpointError.code,
            message: endpointError.message,
          },
        });
      }
      actorGatewayId = hostedOwner.session.gateway.id;
    } else {
      const result = getAuthedGateway(store, request.headers.authorization);
      if ('error' in result) {
        return reply.code(401).send({ ok: false, error: result.error });
      }
      actorGatewayId = result.gateway.id;
    }

    const { waterTemperatureC, clarity, tideDirection, surfaceState, phenomenon, summary, metadata } = request.body ?? {};

    if (typeof waterTemperatureC !== 'number' || !Number.isFinite(waterTemperatureC)) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'waterTemperatureC is required',
        },
      });
    }
    if (typeof clarity !== 'string' || !clarity.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'clarity is required',
        },
      });
    }
    if (typeof tideDirection !== 'string' || !tideDirection.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'tideDirection is required',
        },
      });
    }
    if (typeof surfaceState !== 'string' || !surfaceState.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'surfaceState is required',
        },
      });
    }
    if (typeof phenomenon !== 'string' || !phenomenon.trim()) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'phenomenon is required',
        },
      });
    }
    if (summary !== undefined && typeof summary !== 'string') {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'summary must be a string when provided',
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
      const environment = store.setEnvironment({
        waterTemperatureC,
        clarity: clarity.trim() as EnvironmentRecord['clarity'],
        tideDirection: tideDirection.trim() as EnvironmentRecord['tideDirection'],
        surfaceState: surfaceState.trim() as EnvironmentRecord['surfaceState'],
        phenomenon: phenomenon.trim() as EnvironmentRecord['phenomenon'],
        summary: summary?.trim() || undefined,
        metadata,
        actorGatewayId,
      });

      return reply.code(201).send({
        ok: true,
        data: {
          environment: toEnvironmentSummary(environment),
        },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to set environment';
      const mapped = environmentErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.post<{ Body: GenerateSceneBody }>('/api/v1/scenes/generate', async (request, reply) => {
    const result = getAuthedGateway(store, request.headers.authorization);
    if ('error' in result) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    const type = request.body?.type?.trim() ?? 'vent';
    if (!['vent', 'social_glimpse'].includes(type)) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'type must be one of vent, social_glimpse',
        },
      });
    }

    try {
      const scene = store.generateScene({
        gatewayId: result.gateway.id,
        type: type as 'vent' | 'social_glimpse',
      });

      return reply.code(201).send({
        ok: true,
        data: {
          scene,
        },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to generate scene';
      const mapped = sceneErrorToHttp(messageText);
      return reply.code(mapped.statusCode).send({
        ok: false,
        error: {
          code: mapped.code,
          message: messageText,
        },
      });
    }
  });

  app.get<{ Querystring: GatewayActivityQuerystring }>('/api/v1/scenes/mine', async (request, reply) => {
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
      const scenes = store.listScenes({
        gatewayId: result.gateway.id,
        cursor: request.query.cursor?.trim() || undefined,
        limit: parsedLimit.value,
      });

      return {
        ok: true,
        data: scenes,
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to list scenes';
      const mapped = sceneErrorToHttp(messageText);
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
    if (deploymentMode === 'hosted') {
      const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
      if (!hostedOwner.ok) {
        const endpointError = hostedOwner.error;
        return reply.code(endpointError.statusCode).send({
          ok: false,
          error: {
            code: endpointError.code,
            message: endpointError.message,
          },
        });
      }
    } else {
      const result = getAuthedGateway(store, request.headers.authorization);
      if ('error' in result) {
        return reply.code(401).send({ ok: false, error: result.error });
      }
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

    let viewerGatewayId: string;
    let includeSystemEvents = true;
    if (deploymentMode === 'hosted' && scope === 'system') {
      const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
      if (!hostedOwner.ok) {
        const endpointError = hostedOwner.error;
        return reply.code(endpointError.statusCode).send({
          ok: false,
          error: {
            code: endpointError.code,
            message: endpointError.message,
          },
        });
      }
      viewerGatewayId = hostedOwner.session.gateway.id;
    } else if (deploymentMode === 'hosted') {
      const hostedSession = getAuthedHostedSession(store, request.headers.authorization);
      if ('error' in hostedSession) {
        const result = getAuthedGateway(store, request.headers.authorization);
        if ('error' in result) {
          return reply.code(401).send({ ok: false, error: result.error });
        }
        viewerGatewayId = result.gateway.id;
        includeSystemEvents = false;
      } else {
        viewerGatewayId = hostedSession.gateway.id;
      }
    } else {
      const result = getAuthedGateway(store, request.headers.authorization);
      if ('error' in result) {
        return reply.code(401).send({ ok: false, error: result.error });
      }
      viewerGatewayId = result.gateway.id;
    }

    try {
      const feed = store.listSeaFeed({
        viewerGatewayId,
        includeSystemEvents,
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

  app.get<{ Querystring: SeaStreamQuerystring }>('/api/v1/stream/sea', async (request, reply) => {
    let viewerGatewayId: string;
    if (deploymentMode === 'hosted') {
      const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
      if (!hostedOwner.ok) {
        const endpointError = hostedOwner.error;
        return reply.code(endpointError.statusCode).send({
          ok: false,
          error: {
            code: endpointError.code,
            message: endpointError.message,
          },
        });
      }
      viewerGatewayId = hostedOwner.session.gateway.id;
    } else {
      const result = getAuthedGateway(store, request.headers.authorization);
      if ('error' in result) {
        return reply.code(401).send({ ok: false, error: result.error });
      }
      viewerGatewayId = result.gateway.id;
    }

    const cursor = parseSeaStreamCursor(request.headers, request.query.cursor);
    let cleanedUp = false;
    let unsubscribe = () => {};
    let keepAliveTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      unsubscribe();
      if (!reply.raw.destroyed && !reply.raw.writableEnded) {
        reply.raw.end();
      }
    };

    reply.hijack();
    reply.raw.writeHead(200, {
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8',
      'x-accel-buffering': 'no',
    });
    reply.raw.flushHeaders();

    const subscription = liveHub.subscribe({
      viewerGatewayId,
      cursor,
      push: (delivery) => {
        try {
          writeSseEvent(reply.raw, {
            event: 'sea.invalidate',
            id: delivery.id,
            data: delivery,
          });
        } catch {
          cleanup();
        }
      },
    });
    unsubscribe = subscription.unsubscribe;

    request.raw.on('close', cleanup);
    reply.raw.on('close', cleanup);
    reply.raw.on('error', cleanup);

    writeSseEvent(reply.raw, {
      event: 'hello',
      data: {
        connectedAt: new Date().toISOString(),
        cursor: subscription.latestVisibleDeliveryId,
        replayedCount: subscription.backlog.length,
        replayWindow: subscription.replayWindow,
        viewerGatewayId,
      },
    });

    if (subscription.resyncRequired) {
      writeSseEvent(reply.raw, {
        event: 'resync_required',
        data: subscription.resyncRequired,
      });
    }

    for (const delivery of subscription.backlog) {
      writeSseEvent(reply.raw, {
        event: 'sea.invalidate',
        id: delivery.id,
        data: delivery,
      });
    }

    keepAliveTimer = setInterval(() => {
      try {
        writeSseEvent(reply.raw, {
          event: 'ping',
          data: {
            at: new Date().toISOString(),
          },
        });
      } catch {
        cleanup();
      }
    }, 15_000);
    keepAliveTimer.unref?.();
  });

  app.post<{ Body: CreateInviteBody }>('/api/v1/invites', async (request, reply) => {
    let createdByGatewayId: string;
    if (deploymentMode === 'hosted') {
      const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
      if (!hostedOwner.ok) {
        const endpointError = hostedOwner.error;
        return reply.code(endpointError.statusCode).send({
          ok: false,
          error: {
            code: endpointError.code,
            message: endpointError.message,
          },
        });
      }
      createdByGatewayId = hostedOwner.session.gateway.id;
    } else {
      const result = getAuthedGateway(store, request.headers.authorization);
      if ('error' in result) {
        return reply.code(401).send({ ok: false, error: result.error });
      }
      createdByGatewayId = result.gateway.id;
    }

    try {
      const invite = store.createInvite({
        createdByGatewayId,
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

  app.post<{ Params: RevokeInviteParams }>('/api/v1/invites/:inviteId/revoke', async (request, reply) => {
    let revokedByGatewayId: string;
    if (deploymentMode === 'hosted') {
      const hostedOwner = getHostedOwnerSessionForEndpoint(store, request.headers.authorization);
      if (!hostedOwner.ok) {
        const endpointError = hostedOwner.error;
        return reply.code(endpointError.statusCode).send({
          ok: false,
          error: {
            code: endpointError.code,
            message: endpointError.message,
          },
        });
      }
      revokedByGatewayId = hostedOwner.session.gateway.id;
    } else {
      const result = getAuthedGateway(store, request.headers.authorization);
      if ('error' in result) {
        return reply.code(401).send({ ok: false, error: result.error });
      }
      revokedByGatewayId = result.gateway.id;
    }

    const inviteId = request.params?.inviteId?.trim();
    if (!inviteId) {
      return reply.code(400).send({
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'inviteId is required',
        },
      });
    }

    try {
      const invite = store.revokeInvite({
        inviteId,
        revokedByGatewayId,
      });
      return {
        ok: true,
        data: {
          invite,
        },
      };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'failed to revoke invite';
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
    const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
    if (!result.ok) {
      return reply.code(result.error.statusCode).send({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
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
      const friendRequest = claimed.friendRequest
        ? {
            ...claimed.friendRequest,
            fromGateway: toGatewaySummary(result.gateway),
            toGateway: inviter ? toGatewaySummary(inviter) : null,
          }
        : null;
      return {
        ok: true,
        data: {
          invite: claimed.invite,
          claim: claimed.claim,
          inviterGateway: inviter ? toGatewaySummary(inviter) : null,
          friendRequest,
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
    const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
    if (!result.ok) {
      return reply.code(result.error.statusCode).send({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
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
    const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
    if (!result.ok) {
      return reply.code(result.error.statusCode).send({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
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
    const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
    if (!result.ok) {
      return reply.code(result.error.statusCode).send({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
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
    const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
    if (!result.ok) {
      return reply.code(result.error.statusCode).send({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
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
    const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
    if (!result.ok) {
      return reply.code(result.error.statusCode).send({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
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
    const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
    if (!result.ok) {
      return reply.code(result.error.statusCode).send({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
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
    const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
    if (!result.ok) {
      return reply.code(result.error.statusCode).send({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
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
      const readState = store.getConversationReadState(request.params.conversationId, result.gateway.id);
      return {
        ok: true,
        data: {
          items,
          readState: toConversationReadStateSummary(readState.readState, readState.unreadCount, readState.latestMessage),
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

  app.post<{ Params: ConversationParams; Body: UpdateConversationReadStateBody }>(
    '/api/v1/conversations/:conversationId/read-state',
    async (request, reply) => {
      const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
      if (!result.ok) {
        return reply.code(result.error.statusCode).send({
          ok: false,
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        });
      }

      try {
        const readState = store.markConversationRead({
          conversationId: request.params.conversationId,
          gatewayId: result.gateway.id,
          messageId: request.body?.messageId,
        });
        return {
          ok: true,
          data: {
            readState: toConversationReadStateSummary(readState.readState, readState.unreadCount, readState.latestMessage),
          },
        };
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'failed to update read state';
        const mapped = conversationErrorToHttp(messageText);
        return reply.code(mapped.statusCode).send({
          ok: false,
          error: {
            code: mapped.code,
            message: messageText,
          },
        });
      }
    },
  );

  app.post<{ Params: ConversationParams; Body: CreateMessageBody }>('/api/v1/conversations/:conversationId/messages', async (request, reply) => {
    const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
    if (!result.ok) {
      return reply.code(result.error.statusCode).send({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
    }

    try {
      const message = store.createMessage({
        conversationId: request.params.conversationId,
        senderGatewayId: result.gateway.id,
        body: request.body?.body ?? '',
      });
      const readState = store.getConversationReadState(request.params.conversationId, result.gateway.id);
      return reply.code(201).send({
        ok: true,
        data: {
          message,
          readState: toConversationReadStateSummary(readState.readState, readState.unreadCount, readState.latestMessage),
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
    const result = getGatewayForSocialWriteEndpoint(store, deploymentMode, request.headers.authorization);
    if (!result.ok) {
      return reply.code(result.error.statusCode).send({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
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
