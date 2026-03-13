import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { loadRuntimeConfig } from '../src/config.js';
import { SqliteGatewayStore } from '../src/sqlite-store.js';
import { createGatewayStore } from '../src/store.js';

function parseSseFrame(chunk: string) {
  const lines = chunk.split('\n');
  let event = 'message';
  let id: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trimStart() : '';

    if (field === 'event') {
      event = rawValue;
    } else if (field === 'id') {
      id = rawValue;
    } else if (field === 'data') {
      dataLines.push(rawValue);
    }
  }

  return {
    event,
    id,
    data: dataLines.length ? JSON.parse(dataLines.join('\n')) : null,
  };
}

async function openSeaStream(baseUrl: string, token: string) {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/v1/stream/sea`, {
    headers: {
      accept: 'text/event-stream',
      authorization: `Bearer ${token}`,
    },
    signal: controller.signal,
  });

  assert.equal(response.status, 200);
  assert.ok(response.body);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return {
    async nextEvent(timeoutMs = 5_000) {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const delimiterIndex = buffer.indexOf('\n\n');
        if (delimiterIndex >= 0) {
          const chunk = buffer.slice(0, delimiterIndex);
          buffer = buffer.slice(delimiterIndex + 2);
          return parseSseFrame(chunk);
        }

        const { done, value } = await reader.read();
        if (done) {
          throw new Error('stream closed');
        }
        buffer += decoder.decode(value, { stream: true });
      }

      throw new Error(`timed out waiting for stream event after ${timeoutMs}ms`);
    },
    async close() {
      controller.abort();
      reader.releaseLock();
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    },
  };
}

const localOnlyEndpoints = [
  { method: 'POST', url: '/api/v1/session/bootstrap-local' },
  { method: 'GET', url: '/api/v1/session/me' },
  { method: 'POST', url: '/api/v1/session/logout' },
  { method: 'GET', url: '/api/v1/runtime/local' },
  { method: 'POST', url: '/api/v1/runtime/local/bind' },
  { method: 'POST', url: '/api/v1/runtime/local/heartbeat' },
  { method: 'POST', url: '/api/v1/local/reef/seed' },
] as const;

async function assertHostedLocalGuard(
  app: ReturnType<typeof buildApp>,
  endpoint: (typeof localOnlyEndpoints)[number],
) {
  const response = await app.inject({
    method: endpoint.method,
    url: endpoint.url,
  });

  assert.equal(response.statusCode, 403, endpoint.url);
  assert.deepEqual(response.json(), {
    ok: false,
    error: {
      code: 'local_mode_only',
      message: 'endpoint is only available in local deployment mode',
    },
  });
}

async function setHostedRegistrationPolicy(
  app: ReturnType<typeof buildApp>,
  ownerToken: string,
  policy: 'open' | 'closed' | 'invite_only',
) {
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/registration-policy',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { policy },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.policy, policy);
}

async function runHostedSmoke(app: ReturnType<typeof buildApp>) {
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);

  const current = await app.inject({ method: 'GET', url: '/api/v1/currents/current' });
  assert.equal(current.statusCode, 200);
  assert.equal(typeof current.json().data.current.key, 'string');
  assert.equal(typeof current.json().data.current.tone, 'string');

  const ownerBootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-smoke-secret',
      displayName: 'Hosted Smoke Owner',
      handle: 'hosted-smoke-owner',
    },
  });
  assert.equal(ownerBootstrap.statusCode, 201);
  const ownerToken = ownerBootstrap.json().data.credential.token as string;

  const ownerMe = await app.inject({
    method: 'GET',
    url: '/api/v1/session/hosted/me',
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert.equal(ownerMe.statusCode, 200);

  const blockedRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Blocked Hosted Smoke Gateway',
      handle: 'blocked-hosted-smoke-gateway',
    },
  });
  assert.equal(blockedRegister.statusCode, 403);
  assert.equal(blockedRegister.json().error.code, 'registration_invite_only');

  await setHostedRegistrationPolicy(app, ownerToken, 'open');

  const register = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Smoke Gateway',
      handle: 'hosted-smoke-gateway',
    },
  });
  assert.equal(register.statusCode, 201);
  const token = register.json().data.credential.token as string;

  const me = await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().data.gateway.handle, 'hosted-smoke-gateway');

  const guestCurrentWrite = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      key: 'hosted-smoke-current',
      label: 'Hosted Smoke Current',
      summary: 'Only hosted owner should set this current.',
      tone: 'calm',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    },
  });
  assert.equal(guestCurrentWrite.statusCode, 403);

  const ownerCurrentWrite = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: {
      key: 'hosted-smoke-current',
      label: 'Hosted Smoke Current',
      summary: 'Hosted owner session writes the system current in hosted smoke.',
      tone: 'calm',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    },
  });
  assert.equal(ownerCurrentWrite.statusCode, 201);

  const seaFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=mine',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(seaFeed.statusCode, 200);
  assert.equal(seaFeed.json().data.items.some((item: { type: string }) => item.type === 'gateway.registered'), true);
  assert.equal(seaFeed.json().data.items.some((item: { visibility: string }) => item.visibility === 'system'), false);

  const createBridgeCredential = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bridge-credentials',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: {
      label: 'hosted-smoke-bridge',
    },
  });
  assert.equal(createBridgeCredential.statusCode, 201);
  const bridgeToken = createBridgeCredential.json().data.credential.token as string;

  const bindRemote = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bind',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      bridgeToken,
      runtimeId: 'hosted-smoke-runtime',
    },
  });
  assert.equal(bindRemote.statusCode, 201);

  const ownerRemoteMe = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/remote/me',
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert.equal(ownerRemoteMe.statusCode, 403);

  const remoteMe = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/remote/me',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(remoteMe.statusCode, 200);
  assert.equal(remoteMe.json().data.runtime.runtimeId, 'hosted-smoke-runtime');

  const remoteHeartbeat = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/heartbeat',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      runtimeId: 'hosted-smoke-runtime',
      connectionType: 'smoke_remote_runtime',
    },
  });
  assert.equal(remoteHeartbeat.statusCode, 200);
  assert.equal(remoteHeartbeat.json().data.runtime.status, 'online');

  const guestInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      maxUses: 1,
    },
  });
  assert.equal(guestInvite.statusCode, 403);

  const ownerInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: {
      maxUses: 2,
    },
  });
  assert.equal(ownerInvite.statusCode, 201);
  assert.equal(ownerInvite.json().data.invite.maxUses, 2);

  for (const endpoint of localOnlyEndpoints) {
    await assertHostedLocalGuard(app, endpoint);
  }

  return (
    'health=1 current=1 hosted_owner_bootstrap=1 hosted_owner_me=1 registration_policy=1 register=1 me=1 current_owner_gate=1 sea_feed=1 ' +
    'remote_bridge=1 remote_runtime_bind=1 remote_runtime_me=1 remote_runtime_heartbeat=1 invite_owner_gate=1 local_mode_guards=7'
  );
}

async function runLocalSmoke(app: ReturnType<typeof buildApp>, baseUrl: string) {
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);

  const current = await app.inject({ method: 'GET', url: '/api/v1/currents/current' });
  assert.equal(current.statusCode, 200);
  assert.equal(typeof current.json().data.current.key, 'string');
  assert.equal(typeof current.json().data.current.tone, 'string');

  const bootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-local',
  });
  assert.equal(bootstrap.statusCode, 201);
  const token = bootstrap.json().data.credential.token as string;
  const hostId = bootstrap.json().data.host.id as string;

  const sessionMe = await app.inject({
    method: 'GET',
    url: '/api/v1/session/me',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(sessionMe.statusCode, 200);
  assert.equal(sessionMe.json().data.host.id, hostId);

  const liveStream = await openSeaStream(baseUrl, token);
  try {
    const liveHello = await liveStream.nextEvent();
    assert.equal(liveHello.event, 'hello');
    assert.equal((liveHello.data as { viewerGatewayId: string }).viewerGatewayId, `host-viewer:${hostId}`);

    const runtimeBind = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/local/bind',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        source: 'smoke',
      },
    });
    assert.equal(runtimeBind.statusCode, 201);

    const runtimeHeartbeat = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/local/heartbeat',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        connectionType: 'smoke_local_runtime',
      },
    });
    assert.equal(runtimeHeartbeat.statusCode, 200);
    assert.equal(runtimeHeartbeat.json().data.runtime.status, 'online');

    const runtime = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/local',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(runtime.statusCode, 200);
    assert.equal(runtime.json().data.host.id, hostId);
    assert.equal(runtime.json().data.runtime.status, 'online');

    const writeCurrent = await app.inject({
      method: 'POST',
      url: '/api/v1/currents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        key: 'smoke-current',
        label: 'Smoke Current',
        summary: 'A smoke-test current keeps the local sea moving.',
        tone: 'calm',
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        metadata: {
          reason: 'smoke',
        },
      },
    });
    assert.equal(writeCurrent.statusCode, 201);

    const liveCurrent = await liveStream.nextEvent();
    assert.equal(liveCurrent.event, 'sea.invalidate');
    assert.equal((liveCurrent.data as { seaEvent: { type: string } }).seaEvent.type, 'current.changed');

    const currentAfterWrite = await app.inject({
      method: 'GET',
      url: '/api/v1/currents/current',
    });
    assert.equal(currentAfterWrite.statusCode, 200);
    assert.equal(currentAfterWrite.json().data.current.label, 'Smoke Current');
    assert.equal(currentAfterWrite.json().data.current.source, 'manual');

    const gatewayRegister = await app.inject({
      method: 'POST',
      url: '/api/v1/gateways/register',
      payload: {
        displayName: 'Smoke Gateway',
        handle: 'smoke-gateway',
      },
    });
    assert.equal(gatewayRegister.statusCode, 201);
    const gatewayToken = gatewayRegister.json().data.credential.token as string;
    const gatewayId = gatewayRegister.json().data.gateway.id as string;

    const profileUpdate = await app.inject({
      method: 'PATCH',
      url: '/api/v1/gateways/me',
      headers: { authorization: `Bearer ${gatewayToken}` },
      payload: {
        displayName: 'Smoke Captain',
        bio: 'Keeping the local reef readable.',
        visibility: 'public',
      },
    });
    assert.equal(profileUpdate.statusCode, 200);
    assert.equal(profileUpdate.json().data.gateway.displayName, 'Smoke Captain');
    assert.equal(profileUpdate.json().data.gateway.visibility, 'public');

    const meAfterProfileUpdate = await app.inject({
      method: 'GET',
      url: '/api/v1/gateways/me',
      headers: { authorization: `Bearer ${gatewayToken}` },
    });
    assert.equal(meAfterProfileUpdate.statusCode, 200);
    assert.equal(meAfterProfileUpdate.json().data.gateway.displayName, 'Smoke Captain');
    assert.equal(meAfterProfileUpdate.json().data.gateway.bio, 'Keeping the local reef readable.');

    const inviteCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/invites',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        maxUses: 2,
      },
    });
    assert.equal(inviteCreate.statusCode, 201);
    assert.match(inviteCreate.json().data.invite.code as string, /^[A-Z0-9]{8}$/);
    assert.equal(inviteCreate.json().data.invite.maxUses, 2);

    const search = await app.inject({
      method: 'GET',
      url: '/api/v1/search/gateways?q=captain',
      headers: { authorization: `Bearer ${gatewayToken}` },
    });
    assert.equal(search.statusCode, 200);
    assert.equal(search.json().data.items.length, 1);
    assert.equal(search.json().data.items[0].handle, 'smoke-gateway');

    const peerRegister = await app.inject({
      method: 'POST',
      url: '/api/v1/gateways/register',
      payload: {
        displayName: 'Smoke Peer',
        handle: 'smoke-peer',
      },
    });
    assert.equal(peerRegister.statusCode, 201);
    const peerToken = peerRegister.json().data.credential.token as string;
    const peerGatewayId = peerRegister.json().data.gateway.id as string;

    const friendRequest = await app.inject({
      method: 'POST',
      url: '/api/v1/friend-requests',
      headers: { authorization: `Bearer ${gatewayToken}` },
      payload: { toGatewayId: peerGatewayId },
    });
    assert.equal(friendRequest.statusCode, 201);
    const requestId = friendRequest.json().data.request.id as string;

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/v1/friend-requests/${requestId}/accept`,
      headers: { authorization: `Bearer ${peerToken}` },
    });
    assert.equal(accepted.statusCode, 200);
    const conversationId = accepted.json().data.conversation.id as string;

    const heartbeat = await app.inject({
      method: 'POST',
      url: '/api/v1/presence/heartbeat',
      headers: { authorization: `Bearer ${gatewayToken}` },
      payload: {
        sessionId: 'smoke-session',
        connectionType: 'gateway_ws',
      },
    });
    assert.equal(heartbeat.statusCode, 200);
    assert.equal(heartbeat.json().data.status, 'online');

    const presence = await app.inject({
      method: 'GET',
      url: `/api/v1/presence/${gatewayId}`,
      headers: { authorization: `Bearer ${peerToken}` },
    });
    assert.equal(presence.statusCode, 200);
    assert.equal(presence.json().data.status, 'online');

    const sent = await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${gatewayToken}` },
      payload: { body: 'hello from smoke' },
    });
    assert.equal(sent.statusCode, 201);
    const messageId = sent.json().data.message.id as string;
    assert.equal(sent.json().data.readState.lastReadMessageId, messageId);
    assert.equal(sent.json().data.readState.unreadCount, 0);

    const messages = await app.inject({
      method: 'GET',
      url: `/api/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${peerToken}` },
    });
    assert.equal(messages.statusCode, 200);
    assert.equal(messages.json().data.items.length, 1);
    assert.equal(messages.json().data.items[0].body, 'hello from smoke');
    assert.equal(messages.json().data.readState.unreadCount, 1);

    const markRead = await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/read-state`,
      headers: { authorization: `Bearer ${peerToken}` },
    });
    assert.equal(markRead.statusCode, 200);
    assert.equal(markRead.json().data.readState.lastReadMessageId, messageId);
    assert.equal(markRead.json().data.readState.unreadCount, 0);

    const encounters = await app.inject({
      method: 'GET',
      url: '/api/v1/encounters',
      headers: { authorization: `Bearer ${gatewayToken}` },
    });
    assert.equal(encounters.statusCode, 200);
    assert.equal(encounters.json().data.items.length, 1);
    assert.equal(encounters.json().data.items[0].encounterCount, 2);
    assert.equal(encounters.json().data.items[0].peer.handle, 'smoke-peer');

    const generatedScene = await app.inject({
      method: 'POST',
      url: '/api/v1/scenes/generate',
      headers: { authorization: `Bearer ${gatewayToken}` },
      payload: { type: 'vent' },
    });
    assert.equal(generatedScene.statusCode, 201);
    assert.match(generatedScene.json().data.scene.id as string, /^scene-/);

    const scenes = await app.inject({
      method: 'GET',
      url: '/api/v1/scenes/mine',
      headers: { authorization: `Bearer ${gatewayToken}` },
    });
    assert.equal(scenes.statusCode, 200);
    assert.equal(scenes.json().data.items.length >= 1, true);

    const seaFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/sea/feed?scope=mine',
      headers: { authorization: `Bearer ${gatewayToken}` },
    });
    assert.equal(seaFeed.statusCode, 200);
    assert.equal(seaFeed.json().data.items.some((item: { type: string }) => item.type === 'gateway.registered'), true);
    assert.equal(seaFeed.json().data.items.some((item: { type: string }) => item.type === 'gateway.profile_updated'), true);
    assert.equal(seaFeed.json().data.items.some((item: { type: string }) => item.type === 'conversation.message_sent'), true);
    assert.equal(seaFeed.json().data.items.some((item: { type: string }) => item.type === 'scene.vent_generated'), true);

    const systemFeed = await app.inject({
      method: 'GET',
      url: '/api/v1/sea/feed?scope=system',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(systemFeed.statusCode, 200);
    assert.equal(systemFeed.json().data.items.some((item: { type: string }) => item.type === 'current.changed'), true);

    const activity = await app.inject({
      method: 'GET',
      url: `/api/v1/gateways/${gatewayId}/activity`,
      headers: { authorization: `Bearer ${gatewayToken}` },
    });
    assert.equal(activity.statusCode, 200);
    assert.equal(activity.json().data.gateway.id, gatewayId);
    assert.equal(activity.json().data.items.length >= 1, true);

    const localReefSeed = await app.inject({
      method: 'POST',
      url: '/api/v1/local/reef/seed',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(localReefSeed.statusCode, 201);
    assert.equal(localReefSeed.json().data.reef.gateways.length, 3);
    assert.equal(localReefSeed.json().data.reef.counts.gatewaysCreated, 3);
  } finally {
    await liveStream.close();
  }

  return (
    'health=1 current=1 bootstrap=1 session_me=1 live_stream=1 runtime_bind=1 runtime_heartbeat=1 runtime_get=1 ' +
    'current_write=1 profile_update=1 invite_create=1 search=1 register=1 messages=1 encounters=1 scenes=1 ' +
    'sea_feed=1 system_feed=1 activity=1 local_reef_seed=1'
  );
}

const config = loadRuntimeConfig(process.env);
const store = createGatewayStore({
  backend: config.storeBackend,
  databaseUrl: config.databaseUrl,
});
const app = buildApp({
  store,
  deploymentMode: config.deploymentMode,
  hostedOwnerBootstrapKey:
    config.deploymentMode === 'hosted' ? (config.hostedOwnerBootstrapKey ?? 'hosted-smoke-secret') : undefined,
});
const baseUrl = await app.listen({
  host: '127.0.0.1',
  port: 0,
});

try {
  const summary =
    config.deploymentMode === 'hosted'
      ? await runHostedSmoke(app)
      : await runLocalSmoke(app, baseUrl);

  console.log(`smoke_ok mode=${config.deploymentMode} backend=${config.storeBackend} ${summary}`);
} finally {
  await app.close();
  if (store instanceof SqliteGatewayStore) {
    store.close();
  }
}
