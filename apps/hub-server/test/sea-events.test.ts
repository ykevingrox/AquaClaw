import assert from 'node:assert/strict';
import test from 'node:test';
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

async function bootstrapLocalHost(app: ReturnType<typeof buildApp>, payload?: { displayName?: string; handle?: string }) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-local',
    payload,
  });
  assert.equal(response.statusCode, 201);
  return response.json().data as {
    host: {
      id: string;
      handle: string;
    };
    credential: {
      token: string;
    };
  };
}

async function createFriendRequest(
  app: ReturnType<typeof buildApp>,
  fromToken: string,
  toGatewayId: string,
  message?: string,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${fromToken}` },
    payload: { toGatewayId, message },
  });
  assert.equal(response.statusCode, 201);
  return response.json().data.request.id as string;
}

async function acceptFriendRequest(app: ReturnType<typeof buildApp>, recipientToken: string, requestId: string) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${recipientToken}` },
  });
  assert.equal(response.statusCode, 200);
  return response.json().data.conversation.id as string;
}

type SeaEventItem = {
  id: string;
  type: string;
  actorGatewayId: string | null;
  subjectGatewayId: string | null;
  objectGatewayId: string | null;
  visibility: string;
  summary: string;
  metadata: Record<string, unknown>;
};

test('sea feed emits representative events with readable summaries and structured metadata', async () => {
  const app = buildApp();

  const alpha = await registerGateway(app, {
    displayName: 'Alpha Tide',
    handle: 'sea-alpha',
    visibility: 'public',
  });
  const beta = await registerGateway(app, {
    displayName: 'Beta Tide',
    handle: 'sea-beta',
    visibility: 'public',
  });
  const gamma = await registerGateway(app, {
    displayName: 'Gamma Tide',
    handle: 'sea-gamma',
    visibility: 'public',
  });
  const delta = await registerGateway(app, {
    displayName: 'Delta Tide',
    handle: 'sea-delta',
    visibility: 'public',
  });

  const profileUpdate = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: {
      displayName: 'Alpha Tide Updated',
      bio: 'watching the reef',
    },
  });
  assert.equal(profileUpdate.statusCode, 200);

  const invite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { maxUses: 2 },
  });
  assert.equal(invite.statusCode, 201);
  const inviteCode = invite.json().data.invite.code as string;

  const claimedInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: { authorization: `Bearer ${beta.token}` },
    payload: { code: inviteCode },
  });
  assert.equal(claimedInvite.statusCode, 200);
  const claimedRequestId = claimedInvite.json().data.friendRequest.id as string;

  const betaConversationId = await acceptFriendRequest(app, alpha.token, claimedRequestId);

  const scopeUpdate = await app.inject({
    method: 'PATCH',
    url: `/api/v1/friends/${beta.gateway.id}/scopes`,
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: {
      updates: [{ scopeName: 'task.request', state: 'granted' }],
    },
  });
  assert.equal(scopeUpdate.statusCode, 200);

  const sentMessage = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${betaConversationId}/messages`,
    headers: { authorization: `Bearer ${beta.token}` },
    payload: { body: 'hello from the beta current' },
  });
  assert.equal(sentMessage.statusCode, 201);

  const gammaRequestId = await createFriendRequest(app, gamma.token, alpha.gateway.id, 'request from gamma');

  const rejectedGamma = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${gammaRequestId}/reject`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(rejectedGamma.statusCode, 200);

  const deltaRequestId = await createFriendRequest(app, alpha.token, delta.gateway.id, 'hello delta');
  await acceptFriendRequest(app, delta.token, deltaRequestId);

  const removedDelta = await app.inject({
    method: 'DELETE',
    url: `/api/v1/friends/${delta.gateway.id}`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(removedDelta.statusCode, 200);

  const blockedGamma = await app.inject({
    method: 'POST',
    url: '/api/v1/blocks',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: {
      gatewayId: gamma.gateway.id,
      reason: 'reef reset',
    },
  });
  assert.equal(blockedGamma.statusCode, 201);

  const unblockedGamma = await app.inject({
    method: 'DELETE',
    url: `/api/v1/blocks/${gamma.gateway.id}`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(unblockedGamma.statusCode, 200);

  const feed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=mine',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(feed.statusCode, 200);

  const feedItems = feed.json().data.items as SeaEventItem[];
  const feedTypes = new Set(feedItems.map((item) => item.type));
  const requiredTypes = [
    'gateway.registered',
    'gateway.profile_updated',
    'invite.created',
    'invite.claimed',
    'friend_request.sent',
    'friend_request.accepted',
    'friend_request.rejected',
    'friendship.removed',
    'gateway.blocked',
    'gateway.unblocked',
    'friend.scope_changed',
    'conversation.message_sent',
    'conversation.started',
  ];

  for (const type of requiredTypes) {
    assert.equal(feedTypes.has(type), true, `expected sea feed to include ${type}`);
  }

  assert.equal(
    feedItems.every(
      (item) =>
        item.actorGatewayId === alpha.gateway.id || item.subjectGatewayId === alpha.gateway.id || item.objectGatewayId === alpha.gateway.id,
    ),
    true,
  );

  const messageEvent = feedItems.find((item) => item.type === 'conversation.message_sent');
  assert.ok(messageEvent);
  assert.match(messageEvent.summary, /sent a message/);
  assert.equal(messageEvent.metadata.auditAction, 'message.sent');
  assert.equal(typeof messageEvent.metadata.auditRecordId, 'string');
  assert.equal(typeof messageEvent.metadata.messageId, 'string');
  assert.equal(typeof messageEvent.metadata.conversationId, 'string');
  assert.equal(typeof messageEvent.metadata.bodyLength, 'number');
  assert.equal('body' in messageEvent.metadata, false);

  const scopeEvent = feedItems.find((item) => item.type === 'friend.scope_changed');
  assert.ok(scopeEvent);
  assert.match(scopeEvent.summary, /updated friend scopes/);
  assert.deepEqual(scopeEvent.metadata.updates, [{ scopeName: 'task.request', state: 'granted' }]);

  const activityPageOne = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${alpha.gateway.id}/activity?limit=3`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(activityPageOne.statusCode, 200);

  const activityOneJson = activityPageOne.json().data as {
    gateway: { id: string; handle: string };
    items: SeaEventItem[];
    nextCursor: string | null;
  };
  assert.equal(activityOneJson.gateway.id, alpha.gateway.id);
  assert.equal(activityOneJson.gateway.handle, 'sea-alpha');
  assert.equal(activityOneJson.items.length, 3);
  assert.equal(typeof activityOneJson.nextCursor, 'string');
  assert.equal(
    activityOneJson.items.every(
      (item) =>
        item.actorGatewayId === alpha.gateway.id || item.subjectGatewayId === alpha.gateway.id || item.objectGatewayId === alpha.gateway.id,
    ),
    true,
  );

  const activityPageTwo = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${alpha.gateway.id}/activity?limit=3&cursor=${activityOneJson.nextCursor}`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(activityPageTwo.statusCode, 200);
  const activityTwoItems = activityPageTwo.json().data.items as SeaEventItem[];
  assert.equal(activityTwoItems.some((item) => item.id === activityOneJson.items[2]!.id), false);

  await app.close();
});

test('sea feed and gateway activity apply visibility and scope filtering', async () => {
  const app = buildApp();

  const alpha = await registerGateway(app, {
    displayName: 'Filter Alpha',
    handle: 'filter-alpha',
    visibility: 'public',
  });
  const beta = await registerGateway(app, {
    displayName: 'Filter Beta',
    handle: 'filter-beta',
    visibility: 'public',
  });
  const gamma = await registerGateway(app, {
    displayName: 'Filter Gamma',
    handle: 'filter-gamma',
    visibility: 'public',
  });
  const hidden = await registerGateway(app, {
    displayName: 'Hidden Reef',
    handle: 'hidden-reef',
    visibility: 'private',
  });

  const invite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { maxUses: 1 },
  });
  assert.equal(invite.statusCode, 201);

  const requestId = await createFriendRequest(app, alpha.token, beta.gateway.id, 'come swim');
  const conversationId = await acceptFriendRequest(app, beta.token, requestId);

  const sentMessage = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { body: 'visible to beta, not to gamma' },
  });
  assert.equal(sentMessage.statusCode, 201);

  const gammaFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed',
    headers: { authorization: `Bearer ${gamma.token}` },
  });
  assert.equal(gammaFeed.statusCode, 200);
  const gammaTypes = new Set((gammaFeed.json().data.items as SeaEventItem[]).map((item) => item.type));
  assert.equal(gammaTypes.has('gateway.registered'), true);
  assert.equal(gammaTypes.has('invite.created'), false);
  assert.equal(gammaTypes.has('friend_request.accepted'), false);
  assert.equal(gammaTypes.has('conversation.message_sent'), false);

  const betaFriendsFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=friends',
    headers: { authorization: `Bearer ${beta.token}` },
  });
  assert.equal(betaFriendsFeed.statusCode, 200);
  const betaFriendTypes = new Set((betaFriendsFeed.json().data.items as SeaEventItem[]).map((item) => item.type));
  assert.equal(betaFriendTypes.has('friend_request.accepted'), true);
  assert.equal(betaFriendTypes.has('conversation.started'), true);
  assert.equal(betaFriendTypes.has('conversation.message_sent'), true);
  assert.equal(betaFriendTypes.has('gateway.registered'), false);

  const alphaSystemFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=system',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(alphaSystemFeed.statusCode, 200);
  assert.deepEqual(alphaSystemFeed.json().data.items, []);

  const gammaAlphaActivity = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${alpha.gateway.id}/activity`,
    headers: { authorization: `Bearer ${gamma.token}` },
  });
  assert.equal(gammaAlphaActivity.statusCode, 200);
  const gammaAlphaActivityTypes = new Set((gammaAlphaActivity.json().data.items as SeaEventItem[]).map((item) => item.type));
  assert.equal(gammaAlphaActivityTypes.has('gateway.registered'), true);
  assert.equal(gammaAlphaActivityTypes.has('invite.created'), false);
  assert.equal(gammaAlphaActivityTypes.has('friend_request.accepted'), false);
  assert.equal(gammaAlphaActivityTypes.has('conversation.message_sent'), false);

  const hiddenActivity = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${hidden.gateway.id}/activity`,
    headers: { authorization: `Bearer ${gamma.token}` },
  });
  assert.equal(hiddenActivity.statusCode, 403);
  assert.equal(hiddenActivity.json().error.code, 'forbidden');

  await app.close();
});

test('setting current emits a system sea event with readable metadata', async () => {
  const app = buildApp();
  const host = await bootstrapLocalHost(app, {
    displayName: 'Current Host',
    handle: 'current-host',
  });

  const beta = await registerGateway(app, {
    displayName: 'Current Beta',
    handle: 'current-beta',
    visibility: 'public',
  });

  const writeCurrent = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: { authorization: `Bearer ${host.credential.token}` },
    payload: {
      key: 'moonlit-updraft',
      label: 'Moonlit Updraft',
      summary: 'The sea lifts gently upward; bright encounters travel farther tonight.',
      tone: 'reflective',
      sceneHint: 'moonlit-water',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      metadata: {
        reason: 'system-feed-test',
      },
    },
  });
  assert.equal(writeCurrent.statusCode, 201);
  const current = writeCurrent.json().data.current as {
    id: string;
    key: string;
    label: string;
    tone: string;
    startsAt: string;
    endsAt: string;
  };

  const systemFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=system',
    headers: { authorization: `Bearer ${beta.token}` },
  });
  assert.equal(systemFeed.statusCode, 200);

  const systemItems = systemFeed.json().data.items as SeaEventItem[];
  const currentChangedEvent = systemItems.find((item) => item.type === 'current.changed');
  assert.ok(currentChangedEvent);
  assert.equal(currentChangedEvent.visibility, 'system');
  assert.match(currentChangedEvent.summary, /Moonlit Updraft/);
  assert.equal(currentChangedEvent.metadata.currentId, current.id);
  assert.equal(currentChangedEvent.metadata.currentKey, 'moonlit-updraft');
  assert.equal(currentChangedEvent.metadata.currentLabel, 'Moonlit Updraft');
  assert.equal(currentChangedEvent.metadata.currentTone, 'reflective');
  assert.equal(currentChangedEvent.metadata.changedByGatewayId, null);
  assert.equal(currentChangedEvent.metadata.changedByHandle, null);
  assert.equal(currentChangedEvent.metadata.source, 'manual');
  assert.equal(currentChangedEvent.metadata.startsAt, current.startsAt);
  assert.equal(currentChangedEvent.metadata.endsAt, current.endsAt);

  const allFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=all',
    headers: { authorization: `Bearer ${beta.token}` },
  });
  assert.equal(allFeed.statusCode, 200);
  assert.equal((allFeed.json().data.items as SeaEventItem[]).some((item) => item.type === 'current.changed'), true);

  await app.close();
});
