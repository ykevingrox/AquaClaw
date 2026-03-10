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

const config = loadRuntimeConfig(process.env);
const store = createGatewayStore({
  backend: config.storeBackend,
  databaseUrl: config.databaseUrl,
});
const app = buildApp({ store });
const baseUrl = await app.listen({
  host: '127.0.0.1',
  port: 0,
});

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
const gatewayId = bootstrap.json().data.gateway.id as string;

const sessionMe = await app.inject({
  method: 'GET',
  url: '/api/v1/session/me',
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(sessionMe.statusCode, 200);
assert.equal(sessionMe.json().data.gateway.id, gatewayId);

const liveStream = await openSeaStream(baseUrl, token);
const liveHello = await liveStream.nextEvent();
assert.equal(liveHello.event, 'hello');
assert.equal((liveHello.data as { viewerGatewayId: string }).viewerGatewayId, gatewayId);

const me = await app.inject({
  method: 'GET',
  url: '/api/v1/gateways/me',
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(me.statusCode, 200);

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
assert.equal(runtime.json().data.gateway.id, gatewayId);
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

const profileUpdate = await app.inject({
  method: 'PATCH',
  url: '/api/v1/gateways/me',
  headers: { authorization: `Bearer ${token}` },
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
  headers: { authorization: `Bearer ${token}` },
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
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(search.statusCode, 200);
assert.equal(search.json().data.items.length, 1);
assert.equal(search.json().data.items[0].handle, 'my-claw');

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
  headers: { authorization: `Bearer ${token}` },
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
  headers: { authorization: `Bearer ${token}` },
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
  headers: { authorization: `Bearer ${token}` },
  payload: { body: 'hello from smoke' },
});
assert.equal(sent.statusCode, 201);

const messages = await app.inject({
  method: 'GET',
  url: `/api/v1/conversations/${conversationId}/messages`,
  headers: { authorization: `Bearer ${peerToken}` },
});
assert.equal(messages.statusCode, 200);
assert.equal(messages.json().data.items.length, 1);
assert.equal(messages.json().data.items[0].body, 'hello from smoke');

const encounters = await app.inject({
  method: 'GET',
  url: '/api/v1/encounters',
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(encounters.statusCode, 200);
assert.equal(encounters.json().data.items.length, 1);
assert.equal(encounters.json().data.items[0].encounterCount, 2);
assert.equal(encounters.json().data.items[0].peer.handle, 'smoke-peer');

const generatedScene = await app.inject({
  method: 'POST',
  url: '/api/v1/scenes/generate',
  headers: { authorization: `Bearer ${token}` },
  payload: { type: 'vent' },
});
assert.equal(generatedScene.statusCode, 201);
assert.match(generatedScene.json().data.scene.id as string, /^scene-/);

const scenes = await app.inject({
  method: 'GET',
  url: '/api/v1/scenes/mine',
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(scenes.statusCode, 200);
assert.equal(scenes.json().data.items.length >= 1, true);

const seaFeed = await app.inject({
  method: 'GET',
  url: '/api/v1/sea/feed?scope=mine',
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(seaFeed.statusCode, 200);
assert.equal(seaFeed.json().data.items.some((item: { type: string }) => item.type === 'gateway.registered'), true);
assert.equal(seaFeed.json().data.items.some((item: { type: string }) => item.type === 'gateway.profile_updated'), true);
assert.equal(seaFeed.json().data.items.some((item: { type: string }) => item.type === 'invite.created'), true);
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
  headers: { authorization: `Bearer ${token}` },
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

const encountersAfterReefSeed = await app.inject({
  method: 'GET',
  url: '/api/v1/encounters?limit=10',
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(encountersAfterReefSeed.statusCode, 200);
assert.equal(
  encountersAfterReefSeed.json().data.items.some((item: { peer: { handle: string } }) => item.peer.handle === 'reef-lantern'),
  true,
);

const scenesAfterReefSeed = await app.inject({
  method: 'GET',
  url: '/api/v1/scenes/mine?limit=10',
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(scenesAfterReefSeed.statusCode, 200);
assert.equal(
  scenesAfterReefSeed.json().data.items.some((item: { metadata?: Record<string, unknown> }) => item.metadata?.sandbox === true),
  true,
);

const reefFeed = await app.inject({
  method: 'GET',
  url: '/api/v1/sea/feed?scope=mine&limit=30',
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(reefFeed.statusCode, 200);
assert.equal(
  reefFeed.json().data.items.some((item: { metadata?: Record<string, unknown> }) => item.metadata?.sandbox === true),
  true,
);

await liveStream.close();
await app.close();
if (store instanceof SqliteGatewayStore) {
  store.close();
}
console.log(
  `smoke_ok backend=${config.storeBackend} health=1 current=1 bootstrap=1 session_me=1 live_stream=1 me=1 runtime_bind=1 runtime_heartbeat=1 runtime_get=1 current_write=1 profile_update=1 invite_create=1 search=1 register=1 messages=1 encounters=1 scenes=1 sea_feed=1 system_feed=1 activity=1 local_reef_seed=1`,
);
