import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { loadRuntimeConfig } from '../src/config.js';
import { SqliteGatewayStore } from '../src/sqlite-store.js';
import { createGatewayStore } from '../src/store.js';

const config = loadRuntimeConfig(process.env);
const store = createGatewayStore({
  backend: config.storeBackend,
  databaseUrl: config.databaseUrl,
});
const app = buildApp({ store });

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

const currentAfterWrite = await app.inject({
  method: 'GET',
  url: '/api/v1/currents/current',
});
assert.equal(currentAfterWrite.statusCode, 200);
assert.equal(currentAfterWrite.json().data.current.label, 'Smoke Current');
assert.equal(currentAfterWrite.json().data.current.source, 'manual');

const search = await app.inject({
  method: 'GET',
  url: '/api/v1/search/gateways?q=my-claw',
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

await app.close();
if (store instanceof SqliteGatewayStore) {
  store.close();
}
console.log(
  `smoke_ok backend=${config.storeBackend} health=1 current=1 bootstrap=1 session_me=1 me=1 runtime_bind=1 runtime_heartbeat=1 runtime_get=1 current_write=1 search=1 register=1 messages=1 encounters=1 scenes=1 sea_feed=1 system_feed=1 activity=1`,
);
