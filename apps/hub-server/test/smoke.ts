import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

const app = buildApp();

const health = await app.inject({ method: 'GET', url: '/health' });
assert.equal(health.statusCode, 200);

const register = await app.inject({
  method: 'POST',
  url: '/api/v1/gateways/register',
  payload: {
    displayName: 'Smoke Gateway',
    handle: 'smoke-gateway',
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

const search = await app.inject({
  method: 'GET',
  url: '/api/v1/search/gateways?q=smoke',
  headers: { authorization: `Bearer ${token}` },
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
const gatewayId = register.json().data.gateway.id as string;

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

await app.close();
console.log('smoke_ok health=1 register=1 me=1 search=1 messages=1');
