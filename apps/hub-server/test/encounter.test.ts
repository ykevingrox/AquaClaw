import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

async function registerGateway(
  app: ReturnType<typeof buildApp>,
  payload: { displayName: string; handle: string; bio?: string; visibility?: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload,
  });
  assert.equal(response.statusCode, 201);
  const json = response.json();
  return {
    token: json.data.credential.token as string,
    gateway: json.data.gateway as {
      id: string;
      handle: string;
      displayName: string;
      bio: string;
      visibility: string;
      createdAt: string;
    },
  };
}

test('accepting a friend request records a first encounter visible to both sides', async () => {
  const app = buildApp();
  const alpha = await registerGateway(app, { displayName: 'Alpha Encounter', handle: 'alpha-encounter' });
  const beta = await registerGateway(app, { displayName: 'Beta Encounter', handle: 'beta-encounter' });

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { toGatewayId: beta.gateway.id, message: 'hello reef' },
  });
  assert.equal(friendRequest.statusCode, 201);
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${beta.token}` },
  });
  assert.equal(accept.statusCode, 200);

  const selfEncounters = await app.inject({
    method: 'GET',
    url: '/api/v1/encounters',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(selfEncounters.statusCode, 200);
  assert.equal(selfEncounters.json().data.items.length, 1);
  assert.equal(selfEncounters.json().data.items[0].encounterCount, 1);
  assert.equal(selfEncounters.json().data.items[0].peer.handle, 'beta-encounter');
  assert.equal(selfEncounters.json().data.items[0].recentTopics.includes('friendship'), true);

  const pairEncounters = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${alpha.gateway.id}/encounters`,
    headers: { authorization: `Bearer ${beta.token}` },
  });
  assert.equal(pairEncounters.statusCode, 200);
  assert.equal(pairEncounters.json().data.items.length, 1);
  assert.equal(pairEncounters.json().data.items[0].peer.handle, 'beta-encounter');

  await app.close();
});

test('sending a dm keeps encounter count fixed while preserving private sea events', async () => {
  const app = buildApp();
  const alpha = await registerGateway(app, { displayName: 'Alpha Topics', handle: 'alpha-topics' });
  const beta = await registerGateway(app, { displayName: 'Beta Topics', handle: 'beta-topics' });

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { toGatewayId: beta.gateway.id },
  });
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${beta.token}` },
  });
  assert.equal(accept.statusCode, 200);
  const conversationId = accept.json().data.conversation.id as string;

  const send = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { body: 'shared coral maps' },
  });
  assert.equal(send.statusCode, 201);

  const encounters = await app.inject({
    method: 'GET',
    url: '/api/v1/encounters',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(encounters.statusCode, 200);
  assert.equal(encounters.json().data.items[0].encounterCount, 1);
  assert.equal(encounters.json().data.items[0].recentTopics.includes('friendship'), true);
  assert.match(encounters.json().data.items[0].lastSummary, /first encounter memory/);
  assert.equal(encounters.json().data.items[0].notes.length, 1);

  const seaFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=mine',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(seaFeed.statusCode, 200);
  assert.equal(
    seaFeed.json().data.items.some((item: { type: string }) => item.type === 'conversation.message_sent'),
    true,
  );
  assert.equal(
    seaFeed.json().data.items.some((item: { type: string }) => item.type === 'encounter.updated'),
    false,
  );

  await app.close();
});

test('strangers cannot read encounter lists', async () => {
  const app = buildApp();
  const alpha = await registerGateway(app, { displayName: 'Alpha Private', handle: 'alpha-private-encounter' });
  const beta = await registerGateway(app, { displayName: 'Beta Private', handle: 'beta-private-encounter' });
  const gamma = await registerGateway(app, { displayName: 'Gamma Stranger', handle: 'gamma-stranger-encounter' });

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { toGatewayId: beta.gateway.id },
  });
  const requestId = friendRequest.json().data.request.id as string;
  await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${beta.token}` },
  });

  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${alpha.gateway.id}/encounters`,
    headers: { authorization: `Bearer ${gamma.token}` },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, 'forbidden');

  await app.close();
});

test('blocking hides existing encounters from both self views and pair views', async () => {
  const app = buildApp();
  const alpha = await registerGateway(app, { displayName: 'Alpha Block', handle: 'alpha-block-encounter' });
  const beta = await registerGateway(app, { displayName: 'Beta Block', handle: 'beta-block-encounter' });

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { toGatewayId: beta.gateway.id },
  });
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${beta.token}` },
  });
  const conversationId = accept.json().data.conversation.id as string;

  await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { body: 'keep this hidden after block' },
  });

  const block = await app.inject({
    method: 'POST',
    url: '/api/v1/blocks',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { gatewayId: beta.gateway.id, reason: 'reef closed' },
  });
  assert.equal(block.statusCode, 201);

  const alphaSelf = await app.inject({
    method: 'GET',
    url: '/api/v1/encounters',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(alphaSelf.statusCode, 200);
  assert.equal(alphaSelf.json().data.items.length, 0);

  const betaSelf = await app.inject({
    method: 'GET',
    url: '/api/v1/encounters',
    headers: { authorization: `Bearer ${beta.token}` },
  });
  assert.equal(betaSelf.statusCode, 200);
  assert.equal(betaSelf.json().data.items.length, 0);

  const pairView = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${beta.gateway.id}/encounters`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(pairView.statusCode, 403);
  assert.equal(pairView.json().error.code, 'blocked');

  await app.close();
});
