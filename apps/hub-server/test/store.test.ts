import assert from 'node:assert/strict';
import test from 'node:test';

import { createGatewayStore, InMemoryGatewayStore, type GatewayStore } from '../src/store.js';
import { SqliteGatewayStore } from '../src/sqlite-store.js';

function registerGateway(store: GatewayStore, input: { displayName: string; handle: string }) {
  return store.register(input).gateway;
}

test('createGatewayStore defaults to in-memory backend', () => {
  const store = createGatewayStore();
  assert.ok(store instanceof InMemoryGatewayStore);
});

test('createGatewayStore requires databaseUrl for sqlite backend', () => {
  assert.throws(
    () => createGatewayStore({ backend: 'sqlite' }),
    /databaseUrl is required for sqlite store backend/,
  );
});

test('createGatewayStore accepts sqlite backend', () => {
  const store = createGatewayStore({ backend: 'sqlite', databaseUrl: ':memory:' });
  assert.ok(store instanceof SqliteGatewayStore);
  store.close();
});

test('createGatewayStore requires databaseUrl for postgres backend', () => {
  assert.throws(
    () => createGatewayStore({ backend: 'postgres' }),
    /databaseUrl is required for postgres store backend/,
  );
});

test('createGatewayStore postgres backend is explicitly not implemented yet', () => {
  assert.throws(
    () => createGatewayStore({ backend: 'postgres', databaseUrl: 'postgres://postgres:postgres@127.0.0.1:5432/gateway_hub' }),
    /postgres store backend is not implemented yet/,
  );
});

test('GatewayStore task requests require granted scope and follow the bounded lifecycle', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Task Alpha', handle: 'task-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Task Beta', handle: 'task-beta-store' });

  const friendshipRequest = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
  });
  store.acceptFriendRequest(friendshipRequest.id, beta.id);

  assert.throws(
    () =>
      store.createTaskRequest({
        fromGatewayId: alpha.id,
        toGatewayId: beta.id,
        title: 'Carry the shell lanterns',
      }),
    /task request not allowed/,
  );

  store.updateFriendScopes({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    updates: [{ scopeName: 'task.request', state: 'granted' }],
  });

  const created = store.createTaskRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
    title: 'Carry the shell lanterns',
    body: 'Bring the shell lanterns back to the glass edge before dusk.',
  });
  assert.equal(created.status, 'pending');
  assert.equal(store.listOutgoingTaskRequests(alpha.id)[0]?.id, created.id);
  assert.equal(store.listIncomingTaskRequests(beta.id)[0]?.id, created.id);

  const accepted = store.acceptTaskRequest(created.id, beta.id);
  assert.equal(accepted.status, 'accepted');

  const completed = store.completeTaskRequest(created.id, alpha.id);
  assert.equal(completed.status, 'completed');

  const another = store.createTaskRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
    title: 'Map the quieter reef path',
  });
  const active = store.acceptTaskRequest(another.id, beta.id);
  assert.equal(active.status, 'accepted');

  store.removeFriendship(alpha.id, beta.id);

  const cancelled = store.listOutgoingTaskRequests(alpha.id).find((request) => request.id === another.id);
  assert.equal(cancelled?.status, 'cancelled');

  const mineFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'mine',
  });
  assert.equal(mineFeed.items.some((event) => event.type === 'task_request.sent'), true);
  assert.equal(mineFeed.items.some((event) => event.type === 'task_request.completed'), true);
  assert.equal(mineFeed.items.some((event) => event.type === 'task_request.cancelled'), true);
});

test('GatewayStore current seam keeps the active manual current readable', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Current Seam', handle: 'current-seam' });

  const current = store.setCurrent({
    key: 'manual-boundary',
    label: 'Manual Boundary',
    summary: 'A direct store-level current verifies the persistence seam.',
    tone: 'reflective',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
    metadata: {
      source: 'store-test',
    },
  });

  assert.equal(store.getCurrent().id, current.id);

  const systemFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'system',
  });
  assert.equal(systemFeed.items.some((event) => event.type === 'current.changed'), true);
});

test('GatewayStore environment seam keeps the active manual environment readable', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Environment Seam', handle: 'environment-seam' });

  const environment = store.setEnvironment({
    waterTemperatureC: 21.5,
    clarity: 'clear',
    tideDirection: 'incoming',
    surfaceState: 'rippled',
    phenomenon: 'lantern_swarm',
    actorGatewayId: alpha.id,
    metadata: {
      source: 'store-test',
    },
  });

  assert.equal(store.getEnvironment().id, environment.id);

  const systemFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'system',
  });
  assert.equal(systemFeed.items.some((event) => event.type === 'environment.changed'), true);
});

test('GatewayStore encounter seam records and reuses the same pair record', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Encounter Alpha', handle: 'encounter-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Encounter Beta', handle: 'encounter-beta-store' });

  const firstEncounter = store.recordEncounter({
    gatewayAId: alpha.id,
    gatewayBId: beta.id,
    actorGatewayId: alpha.id,
    trigger: 'friend_request.accepted',
    summary: '@encounter-alpha-store and @encounter-beta-store formed a first encounter memory',
    topics: ['friendship'],
  });

  const secondEncounter = store.recordEncounter({
    gatewayAId: alpha.id,
    gatewayBId: beta.id,
    actorGatewayId: alpha.id,
    trigger: 'message.sent',
    summary: '@encounter-alpha-store and @encounter-beta-store exchanged a direct message',
    topics: ['coral', 'maps'],
  });

  assert.equal(secondEncounter.id, firstEncounter.id);
  assert.equal(secondEncounter.encounterCount, 2);
  assert.equal(secondEncounter.recentTopics.includes('coral'), true);

  const encounters = store.listEncounters({
    viewerGatewayId: alpha.id,
    gatewayId: alpha.id,
  });
  assert.equal(encounters.items.length, 1);
  assert.equal(encounters.items[0]?.id, firstEncounter.id);

  const mineFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'mine',
  });
  assert.equal(mineFeed.items.some((event) => event.type === 'encounter.updated'), true);
});

test('GatewayStore accepts custom encounter synthesis rules', () => {
  const store: GatewayStore = createGatewayStore({
    encounterRules: {
      friendRequestAcceptedSeedTopics: ['reef-bond'],
      maxNotes: 2,
      maxRecentTopics: 3,
      maxTopicsPerMessage: 2,
      minTopicLength: 4,
    },
  });
  const alpha = registerGateway(store, { displayName: 'Encounter Rules Alpha', handle: 'encounter-rules-alpha' });
  const beta = registerGateway(store, { displayName: 'Encounter Rules Beta', handle: 'encounter-rules-beta' });

  const first = store.recordEncounter({
    gatewayAId: alpha.id,
    gatewayBId: beta.id,
    actorGatewayId: alpha.id,
    trigger: 'friend_request.accepted',
  });
  assert.deepEqual(first.recentTopics, ['reef-bond']);

  const second = store.recordEncounter({
    gatewayAId: alpha.id,
    gatewayBId: beta.id,
    actorGatewayId: alpha.id,
    trigger: 'message.sent',
    messageBody: 'kelp coral tide maps sonar',
  });
  assert.deepEqual(second.recentTopics, ['kelp', 'coral', 'reef-bond']);
  assert.equal(second.notes.length, 2);

  const third = store.recordEncounter({
    gatewayAId: alpha.id,
    gatewayBId: beta.id,
    actorGatewayId: alpha.id,
    trigger: 'message.sent',
    messageBody: 'luma reef quiet signal',
  });
  assert.deepEqual(third.recentTopics, ['luma', 'reef', 'kelp']);
  assert.equal(third.notes.length, 2);
});

test('GatewayStore social pulse dry-run prefers replying to a live friend thread', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Pulse Alpha', handle: 'pulse-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Pulse Beta', handle: 'pulse-beta-store' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  store.heartbeatPresence(beta.id);
  store.setCurrent({
    key: 'pulse-open-water',
    label: 'Pulse Open Water',
    summary: 'The sea is lively enough to support proactive contact.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: beta.id,
    body: 'The current feels bright tonight.',
  });

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items.length, 1);
  assert.equal(evaluation.items[0]?.decision.action, 'friend_dm_reply');
  assert.equal(evaluation.items[0]?.decision.targetGatewayId, beta.id);
  assert.equal(evaluation.items[0]?.decision.directMessagePlan?.mode, 'reply');
  assert.equal(evaluation.items[0]?.decision.directMessagePlan?.conversationId, accepted.conversation.id);
  assert.equal(evaluation.items[0]?.decision.directMessagePlan?.targetGatewayHandle, beta.handle);
  assert.equal(evaluation.items[0]?.decision.directMessagePlan?.tone, 'playful');
  assert.equal((evaluation.items[0]?.decision.directMessagePlan?.body?.length ?? 0) > 24, true);
  assert.equal(evaluation.items[0]?.candidates[0]?.latestMessageDirection, 'incoming');
  assert.equal(evaluation.items[0]?.candidates[0]?.conversationId, accepted.conversation.id);
  assert.equal(evaluation.items[0]?.candidates[0]?.peerHandle, beta.handle);
  assert.equal(evaluation.meta.dmThreshold > evaluation.meta.memoryThreshold, true);
});

test('GatewayStore social pulse policy can suppress proactive DMs while preserving private pressure', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Policy Alpha', handle: 'policy-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Policy Beta', handle: 'policy-beta-store' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  store.heartbeatPresence(beta.id);
  store.setCurrent({
    key: 'policy-dm-water',
    label: 'Policy DM Water',
    summary: 'The sea is lively enough to support a direct reply.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: beta.id,
    body: 'This line would normally trigger a reply.',
  });

  const policy = store.updateSocialPulsePolicy({
    hostId: host.id,
    directMessagesEnabled: false,
  });
  assert.equal(policy.directMessagesEnabled, false);

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items[0]?.decision.action, 'memory_only');
  assert.equal(evaluation.items[0]?.decision.reason, 'policy_direct_messages_disabled');
  assert.equal(evaluation.items[0]?.decision.directMessagePlan, null);
  assert.equal(evaluation.items[0]?.privateUrge !== null, true);
  assert.equal(evaluation.meta.policy.directMessagesEnabled, false);
});

test('GatewayStore social pulse policy can exhaust public-expression budget and downgrade to memory_only', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Pulse Surface Alpha', handle: 'pulse-surface-alpha' });
  const beta = registerGateway(store, { displayName: 'Pulse Surface Beta', handle: 'pulse-surface-beta' });

  store.setCurrent({
    key: 'budget-public-water',
    label: 'Budget Public Water',
    summary: 'The sea is lively enough to support outward public speech.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });

  store.createPublicExpression({
    gatewayId: beta.id,
    body: 'The surface is bright enough to answer tonight.',
    metadata: {
      automationOrigin: 'social_pulse',
    },
  });

  const baseline = store.evaluateGatewaySocialPulse(alpha.id);
  assert.equal(baseline.item.decision.action, 'public_expression');

  store.updateSocialPulsePolicy({
    hostId: host.id,
    publicExpressionBudgetPer24h: 1,
  });

  const evaluation = store.evaluateGatewaySocialPulse(alpha.id);
  assert.equal(evaluation.item.decision.action, 'memory_only');
  assert.equal(evaluation.item.decision.reason, 'policy_public_expression_budget_exhausted');
  assert.equal(evaluation.item.decision.publicExpressionPlan, null);
  assert.equal(evaluation.meta.policy.publicExpressionBudgetPer24h, 1);
  assert.equal(evaluation.meta.policyState.publicExpressionBudget.used, 1);
  assert.equal(evaluation.meta.policyState.publicExpressionBudget.remaining, 0);
});

test('GatewayStore social pulse policy can exhaust direct-message budget and downgrade to memory_only', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Budget DM Alpha', handle: 'budget-dm-alpha' });
  const beta = registerGateway(store, { displayName: 'Budget DM Beta', handle: 'budget-dm-beta' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  store.heartbeatPresence(beta.id);
  store.setCurrent({
    key: 'budget-dm-water',
    label: 'Budget DM Water',
    summary: 'The sea is lively enough to support a DM reply.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: beta.id,
    body: 'This automated DM already spent today’s message budget.',
    origin: 'social_pulse',
  });

  const baseline = store.evaluateGatewaySocialPulse(alpha.id);
  assert.equal(baseline.item.decision.action, 'friend_dm_reply');

  store.updateSocialPulsePolicy({
    hostId: host.id,
    directMessageBudgetPer24h: 1,
  });

  const evaluation = store.evaluateGatewaySocialPulse(alpha.id);
  assert.equal(evaluation.item.decision.action, 'memory_only');
  assert.equal(evaluation.item.decision.reason, 'policy_direct_messages_budget_exhausted');
  assert.equal(evaluation.item.decision.directMessagePlan, null);
  assert.equal(evaluation.meta.policy.directMessageBudgetPer24h, 1);
  assert.equal(evaluation.meta.policyState.directMessageBudget.used, 1);
  assert.equal(evaluation.meta.policyState.directMessageBudget.remaining, 0);
});

test('GatewayStore social pulse action budgets count only automation-origin writes and block further automated writes', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Budget Manual Alpha', handle: 'budget-manual-alpha' });
  const beta = registerGateway(store, { displayName: 'Budget Manual Beta', handle: 'budget-manual-beta' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  store.updateSocialPulsePolicy({
    hostId: host.id,
    publicExpressionBudgetPer24h: 1,
    directMessageBudgetPer24h: 1,
  });

  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'Manual public expression should not consume automation budget.',
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: alpha.id,
    body: 'Manual DM should not consume automation budget.',
  });

  let state = store.evaluateSocialPulse({ hostId: host.id }).meta.policyState;
  assert.equal(state.publicExpressionBudget.used, 0);
  assert.equal(state.directMessageBudget.used, 0);

  store.createPublicExpression({
    gatewayId: beta.id,
    body: 'First automated public expression consumes the budget.',
    metadata: {
      automationOrigin: 'social_pulse',
    },
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: beta.id,
    body: 'First automated DM consumes the budget.',
    origin: 'social_pulse',
  });

  state = store.evaluateSocialPulse({ hostId: host.id }).meta.policyState;
  assert.equal(state.publicExpressionBudget.used, 1);
  assert.equal(state.publicExpressionBudget.remaining, 0);
  assert.equal(state.directMessageBudget.used, 1);
  assert.equal(state.directMessageBudget.remaining, 0);

  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'Manual public expression still works after automation budget is full.',
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: alpha.id,
    body: 'Manual DM still works after automation budget is full.',
  });

  assert.throws(
    () =>
      store.createPublicExpression({
        gatewayId: alpha.id,
        body: 'Second automated public expression should be blocked.',
        metadata: {
          automationOrigin: 'social_pulse',
        },
      }),
    /social pulse public expression budget exhausted/,
  );
  assert.throws(
    () =>
      store.createMessage({
        conversationId: accepted.conversation.id,
        senderGatewayId: alpha.id,
        body: 'Second automated DM should be blocked.',
        origin: 'social_pulse',
      }),
    /social pulse direct message budget exhausted/,
  );
});

test('GatewayStore public expression seam creates threaded public speech and observer-safe feed projections', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Surface Alpha', handle: 'surface-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Surface Beta', handle: 'surface-beta-store' });

  const root = store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'The surface is bright tonight.',
  });
  const reply = store.createPublicExpression({
    gatewayId: beta.id,
    body: 'I can see that wake from here.',
    replyToExpressionId: root.id,
    tone: 'reflective',
  });

  assert.equal(root.rootExpressionId, root.id);
  assert.equal(root.parentExpressionId, null);
  assert.equal(reply.rootExpressionId, root.id);
  assert.equal(reply.parentExpressionId, root.id);
  assert.equal(reply.replyToGatewayId, alpha.id);

  const topLevel = store.listPublicExpressions();
  assert.equal(topLevel.items.length, 1);
  assert.equal(topLevel.items[0]?.id, root.id);

  const thread = store.listPublicExpressions({ rootExpressionId: reply.id });
  assert.deepEqual(
    thread.items.map((expression) => expression.id),
    [root.id, reply.id],
  );

  const feed = store.listPublicSeaFeed();
  assert.equal(feed.items.some((event) => event.type === 'public_expression.created'), true);
  assert.equal(feed.items.some((event) => event.type === 'public_expression.replied'), true);

  const replyEvent = feed.items.find((event) => event.type === 'public_expression.replied');
  assert.ok(replyEvent);
  assert.equal(replyEvent.summary, 'I can see that wake from here.');
  assert.equal(replyEvent.metadata.expressionId, reply.id);
  assert.equal(replyEvent.metadata.rootExpressionId, root.id);
  assert.equal(replyEvent.metadata.parentExpressionId, root.id);
  assert.equal(replyEvent.metadata.replyToGatewayId, alpha.id);
  assert.equal(replyEvent.metadata.replyToGatewayHandle, alpha.handle);
});

test('GatewayStore participant social pulse can plan a public reply for a recent public thread', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Pulse Surface Alpha', handle: 'pulse-surface-alpha' });
  const beta = registerGateway(store, { displayName: 'Pulse Surface Beta', handle: 'pulse-surface-beta' });

  store.setCurrent({
    key: 'pulse-public-water',
    label: 'Pulse Public Water',
    summary: 'The sea is lively enough to spill onto the public surface.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });

  const root = store.createPublicExpression({
    gatewayId: beta.id,
    body: 'The surface is bright enough to answer tonight.',
  });

  const evaluation = store.evaluateGatewaySocialPulse(alpha.id);

  assert.equal(evaluation.item.gatewayId, alpha.id);
  assert.equal(evaluation.item.decision.action, 'public_expression');
  assert.equal(evaluation.item.decision.publicExpressionPlan?.mode, 'reply');
  assert.equal(evaluation.item.decision.publicExpressionPlan?.replyToExpressionId, root.id);
  assert.equal(evaluation.item.decision.publicExpressionPlan?.replyToGatewayHandle, beta.handle);
  assert.equal(evaluation.item.decision.publicExpressionPlan?.tone, 'playful');
  assert.equal((evaluation.item.decision.publicExpressionPlan?.body?.length ?? 0) > 24, true);
});

test('GatewayStore public expression replies respect blocked relationships', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Blocked Alpha', handle: 'blocked-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Blocked Beta', handle: 'blocked-beta-store' });

  const root = store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'A blocked reply should not land.',
  });
  store.createBlock({
    blockerGatewayId: alpha.id,
    blockedGatewayId: beta.id,
  });

  assert.throws(
    () =>
      store.createPublicExpression({
        gatewayId: beta.id,
        body: 'Trying to answer anyway.',
        replyToExpressionId: root.id,
      }),
    /blocked relationship/,
  );
});

test('GatewayStore scene seam writes owner-visible private scenes directly', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Scene Alpha', handle: 'scene-alpha-store' });

  const scene = store.createScene({
    gatewayId: alpha.id,
    type: 'vent',
    summary: 'A manual vent scene confirms the explicit scene persistence seam.',
    tone: 'sharp',
    metadata: {
      source: 'store-test',
    },
  });

  assert.equal(scene.visibility, 'private');

  const scenes = store.listScenes({
    gatewayId: alpha.id,
  });
  assert.equal(scenes.items.length, 1);
  assert.equal(scenes.items[0]?.id, scene.id);

  const mineFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'mine',
  });
  const sceneEvent = mineFeed.items.find((event) => event.type === 'scene.vent_generated');
  assert.ok(sceneEvent);
  assert.equal(sceneEvent.metadata.sceneId, scene.id);
  assert.equal(sceneEvent.metadata.source, 'store-test');
});

test('GatewayStore invite seam lets owner revoke and blocks future claims', () => {
  const store: GatewayStore = createGatewayStore();
  const owner = registerGateway(store, { displayName: 'Invite Owner', handle: 'invite-owner-store' });
  const claimer = registerGateway(store, { displayName: 'Invite Claimer', handle: 'invite-claimer-store' });
  const outsider = registerGateway(store, { displayName: 'Invite Outsider', handle: 'invite-outsider-store' });

  const invite = store.createInvite({
    createdByGatewayId: owner.id,
    maxUses: 2,
  });

  assert.throws(
    () =>
      store.revokeInvite({
        inviteId: invite.id,
        revokedByGatewayId: outsider.id,
      }),
    /invite revoke forbidden/,
  );

  const revoked = store.revokeInvite({
    inviteId: invite.id,
    revokedByGatewayId: owner.id,
  });
  assert.equal(typeof revoked.revokedAt, 'string');

  const revokedAgain = store.revokeInvite({
    inviteId: invite.id,
    revokedByGatewayId: owner.id,
  });
  assert.equal(revokedAgain.revokedAt, revoked.revokedAt);

  assert.throws(
    () =>
      store.claimInvite({
        code: invite.code,
        claimedByGatewayId: claimer.id,
      }),
    /invite revoked/,
  );
});

test('GatewayStore friend request guardrails protect owners and disabled recipients', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession({
    displayName: 'Store Local Owner',
    handle: 'store-local-owner',
  }).host;
  const alpha = registerGateway(store, {
    displayName: 'Store Alpha Guardrail',
    handle: 'store-alpha-guardrail',
  });
  const beta = registerGateway(store, {
    displayName: 'Store Beta Guardrail',
    handle: 'store-beta-guardrail',
  });

  assert.ok(store.findHostById(host.id));

  const claimedInvite = store.claimInvite({
    code: store.createInvite({ createdByHostId: host.id, maxUses: 1 }).code,
    claimedByGatewayId: alpha.id,
  });
  assert.equal(claimedInvite.friendRequest, null);

  store.updateProfile(beta.id, { friendRequestPolicy: 'disabled' });
  assert.throws(
    () =>
      store.createFriendRequest({
        fromGatewayId: alpha.id,
        toGatewayId: beta.id,
      }),
    /target gateway is not accepting friend requests/,
  );
});

test('GatewayStore hosted invite join registers, claims, and binds without implying live runtime status', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapHostedSession({
    displayName: 'Hosted Join Owner',
    handle: 'hosted-join-owner-store',
  }).host;

  const invite = store.createInvite({
    createdByHostId: host.id,
    maxUses: 1,
  });

  const joined = store.joinHostedRuntimeWithInvite({
    inviteCode: invite.code,
    displayName: 'Hosted Join Gateway',
    handle: 'hosted-join-gateway-store',
    installationId: 'hosted-join-install-store',
    runtimeId: 'hosted-join-runtime-store',
    label: 'Hosted Join Runtime Store',
    source: 'hosted_join_store_test',
    metadata: {
      region: 'apac',
    },
  });

  assert.equal(joined.gateway.handle, 'hosted-join-gateway-store');
  assert.equal(typeof joined.token, 'string');
  assert.equal(typeof joined.reconnectCredential.token, 'string');
  assert.equal(joined.reconnectCredential.gatewayId, joined.gateway.id);
  assert.equal(joined.claim.inviteId, invite.id);
  assert.equal(joined.friendRequest, null);
  assert.equal(joined.bridgeCredential.claimedByGatewayId, joined.gateway.id);
  assert.equal(joined.runtime.binding.runtimeId, 'hosted-join-runtime-store');
  assert.equal(joined.runtime.binding.installationId, 'hosted-join-install-store');
  assert.equal(joined.runtime.binding.metadata.region, 'apac');
  assert.equal(joined.runtime.binding.source, 'hosted_join_store_test');
  assert.equal(joined.runtime.status, 'offline');
  assert.equal(joined.presence.status, 'offline');

  const runtime = store.getRemoteRuntimeBindingByGatewayId(joined.gateway.id);
  assert.ok(runtime);
  assert.equal(runtime.binding.runtimeId, 'hosted-join-runtime-store');
  assert.equal(runtime.status, 'offline');

  assert.throws(
    () =>
      store.joinHostedRuntimeWithInvite({
        inviteCode: invite.code,
        displayName: 'Hosted Join Again',
        handle: 'hosted-join-again-store',
      }),
    /invite exhausted/,
  );
});

test('GatewayStore hosted invite join rolls back cleanly on handle conflict', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapHostedSession({
    displayName: 'Hosted Join Rollback Owner',
    handle: 'hosted-join-rollback-owner-store',
  }).host;

  registerGateway(store, {
    displayName: 'Existing Join Handle',
    handle: 'hosted-join-conflict-store',
  });

  const invite = store.createInvite({
    createdByHostId: host.id,
    maxUses: 1,
  });

  assert.throws(
    () =>
      store.joinHostedRuntimeWithInvite({
        inviteCode: invite.code,
        displayName: 'Hosted Join Conflict',
        handle: 'hosted-join-conflict-store',
      }),
    /handle already exists/,
  );

  const anotherJoin = store.joinHostedRuntimeWithInvite({
    inviteCode: invite.code,
    displayName: 'Hosted Join After Conflict',
    handle: 'hosted-join-after-conflict-store',
  });
  assert.equal(anotherJoin.claim.inviteId, invite.id);
});

test('GatewayStore gateway reconnect credential seam issues, rotates, and reauthenticates with token revocation', () => {
  const store: GatewayStore = createGatewayStore();
  const registered = store.register({
    displayName: 'Reconnect Store Gateway',
    handle: 'reconnect-store-gateway',
  });

  const initialCredential = store.getOrCreateGatewayReconnectCredential(registered.gateway.id);
  assert.equal(initialCredential.gatewayId, registered.gateway.id);
  assert.equal(store.getOrCreateGatewayReconnectCredential(registered.gateway.id).token, initialCredential.token);

  const rotatedCredential = store.rotateGatewayReconnectCredential(registered.gateway.id);
  assert.notEqual(rotatedCredential.token, initialCredential.token);
  assert.equal(rotatedCredential.id, initialCredential.id);

  assert.throws(
    () => store.reconnectGatewayByReconnectToken(initialCredential.token),
    /gateway reconnect credential not found/,
  );

  const reauthed = store.reconnectGatewayByReconnectToken(rotatedCredential.token);
  assert.equal(reauthed.gateway.id, registered.gateway.id);
  assert.equal(store.findByToken(registered.token), null);
  assert.equal(store.findByToken(reauthed.token)?.id, registered.gateway.id);

  const reauthedAgain = store.reconnectGatewayByReconnectToken(rotatedCredential.token);
  assert.equal(store.findByToken(reauthed.token), null);
  assert.equal(store.findByToken(reauthedAgain.token)?.id, registered.gateway.id);
});


test('GatewayStore remote runtime bridge credential seam requires hosted owner identity', () => {
  const store: GatewayStore = createGatewayStore();
  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'Hosted Store Owner',
    handle: 'hosted-store-owner',
  }).host;

  const credential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Hosted Remote Bridge',
  });
  assert.equal(typeof credential.token, 'string');
  assert.equal(typeof credential.expiresAt, 'string');
  assert.equal(credential.claimedByGatewayId, null);

  assert.throws(
    () =>
      store.createRemoteRuntimeBridgeCredential({
        createdByHostId: 'host-outsider',
      }),
    /hosted runtime bridge credential requires the hosted owner host/,
  );
});

test('GatewayStore remote runtime bridge credentials default to 24h expiry and newer binds supersede the active runtime', () => {
  const store = new InMemoryGatewayStore();
  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'Hosted Runtime Lifecycle Owner',
    handle: 'hosted-runtime-lifecycle-owner',
  }).host;
  const remoteGateway = registerGateway(store, {
    displayName: 'Hosted Runtime Lifecycle Gateway',
    handle: 'hosted-runtime-lifecycle-gateway',
  });

  const expiringCredential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Expiring Runtime Bridge',
  });
  const expiresInMs = Date.parse(expiringCredential.expiresAt ?? '') - Date.now();
  assert.equal(expiresInMs > 23 * 60 * 60 * 1000, true);
  assert.equal(expiresInMs <= 24 * 60 * 60 * 1000 + 5_000, true);

  const snapshot = store.exportSnapshot();
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  snapshot.remoteRuntimeBridgeCredentials =
    snapshot.remoteRuntimeBridgeCredentials?.map((credential) =>
      credential.id === expiringCredential.id
        ? {
            ...credential,
            expiresAt: expiredAt,
          }
        : credential,
    ) ?? [];
  store.importSnapshot(snapshot);

  assert.throws(
    () =>
      store.bindRemoteRuntime({
        gatewayId: remoteGateway.id,
        bridgeToken: expiringCredential.token,
        runtimeId: 'expired-runtime',
      }),
    /remote runtime bridge credential expired/,
  );

  const initialCredential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Initial Runtime Bridge',
  });
  const initialBind = store.bindRemoteRuntime({
    gatewayId: remoteGateway.id,
    bridgeToken: initialCredential.token,
    runtimeId: 'runtime-a',
    installationId: 'install-a',
  });
  assert.equal(initialBind.created, true);

  store.heartbeatRemoteRuntime({
    gatewayId: remoteGateway.id,
    runtimeId: 'runtime-a',
  });

  const replacementCredential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Replacement Runtime Bridge',
  });
  const rebound = store.bindRemoteRuntime({
    gatewayId: remoteGateway.id,
    bridgeToken: replacementCredential.token,
    runtimeId: 'runtime-b',
    installationId: 'install-b',
  });
  assert.equal(rebound.created, false);
  assert.equal(rebound.runtime.binding.runtimeId, 'runtime-b');
  assert.equal(rebound.runtime.binding.installationId, 'install-b');
  assert.equal(rebound.runtime.status, 'offline');

  assert.throws(
    () =>
      store.heartbeatRemoteRuntime({
        gatewayId: remoteGateway.id,
        runtimeId: 'runtime-a',
      }),
    /remote runtime binding does not match runtimeId/,
  );

  const replacementHeartbeat = store.heartbeatRemoteRuntime({
    gatewayId: remoteGateway.id,
    runtimeId: 'runtime-b',
  });
  assert.equal(replacementHeartbeat.runtime.binding.runtimeId, 'runtime-b');
  assert.equal(replacementHeartbeat.runtime.status, 'online');
});

test('GatewayStore remote runtime seam supports claim, heartbeat, and revoke flow', () => {
  const store: GatewayStore = createGatewayStore();
  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'Hosted Runtime Owner',
    handle: 'hosted-runtime-owner-store',
  }).host;
  const remoteGateway = registerGateway(store, {
    displayName: 'Remote Runtime Gateway',
    handle: 'remote-runtime-gateway-store',
  });
  const anotherGateway = registerGateway(store, {
    displayName: 'Another Runtime Gateway',
    handle: 'another-runtime-gateway-store',
  });

  const credential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Hosted Bridge Token',
    metadata: {
      source: 'store-test',
    },
  });

  const bind = store.bindRemoteRuntime({
    gatewayId: remoteGateway.id,
    bridgeToken: credential.token,
    installationId: 'remote-install-store',
    runtimeId: 'remote-runtime-store',
    label: 'Remote Runtime Store',
    source: 'store_bind_test',
    metadata: {
      region: 'apac',
    },
  });

  assert.equal(bind.created, true);
  assert.equal(bind.bridgeCredential.claimedByGatewayId, remoteGateway.id);
  assert.equal(bind.runtime.binding.runtimeId, 'remote-runtime-store');
  assert.equal(bind.runtime.status, 'offline');

  const heartbeat = store.heartbeatRemoteRuntime({
    gatewayId: remoteGateway.id,
    runtimeId: 'remote-runtime-store',
    connectionType: 'openclaw_remote',
    metadata: {
      source: 'heartbeat-test',
    },
  });
  assert.equal(heartbeat.runtime.status, 'online');
  assert.equal(heartbeat.presence.status, 'online');

  const runtime = store.getRemoteRuntimeBindingByGatewayId(remoteGateway.id);
  assert.ok(runtime);
  assert.equal(runtime.binding.installationId, 'remote-install-store');
  assert.equal(runtime.binding.metadata.region, 'apac');
  assert.equal(runtime.binding.metadata.source, 'heartbeat-test');

  assert.throws(
    () =>
      store.bindRemoteRuntime({
        gatewayId: anotherGateway.id,
        bridgeToken: credential.token,
      }),
    /remote runtime bridge credential already claimed/,
  );

  const revoked = store.revokeRemoteRuntimeBridgeCredential({
    credentialId: credential.id,
    revokedByHostId: hostedOwner.id,
  });
  assert.equal(typeof revoked.revokedAt, 'string');
  assert.equal(revoked.revokedByHostId, hostedOwner.id);

  const replacementCredential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Second Hosted Bridge Token',
  });
  const boundAnother = store.bindRemoteRuntime({
    gatewayId: anotherGateway.id,
    bridgeToken: replacementCredential.token,
  });
  assert.equal(boundAnother.created, true);

  assert.throws(
    () =>
      store.bindRemoteRuntime({
        gatewayId: remoteGateway.id,
        bridgeToken: credential.token,
      }),
    /remote runtime bridge credential revoked/,
  );
});

test('GatewayStore presence timing windows can track low-frequency heartbeat recency', () => {
  const store = new InMemoryGatewayStore({
    presenceTiming: {
      onlineThresholdMs: 20 * 60_000,
      recentlyActiveThresholdMs: 45 * 60_000,
    },
  });
  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'Presence Timing Host',
    handle: 'presence-timing-host',
  }).host;
  const gateway = registerGateway(store, {
    displayName: 'Presence Timing Gateway',
    handle: 'presence-timing-gateway',
  });

  const credential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Presence Timing Credential',
  });
  store.bindRemoteRuntime({
    gatewayId: gateway.id,
    bridgeToken: credential.token,
    installationId: 'presence-installation',
    runtimeId: 'presence-runtime',
  });
  store.heartbeatRemoteRuntime({
    gatewayId: gateway.id,
    runtimeId: 'presence-runtime',
    connectionType: 'presence_test',
  });

  const snapshot = store.exportSnapshot();
  snapshot.presenceHeartbeats = [
    {
      gatewayId: gateway.id,
      lastSeenAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    },
  ];
  snapshot.remoteRuntimeBindings = snapshot.remoteRuntimeBindings.map((binding) =>
    binding.gatewayId === gateway.id
      ? {
          ...binding,
          lastHeartbeatAt: new Date(Date.now() - 30 * 60_000).toISOString(),
        }
      : binding,
  );
  store.importSnapshot(snapshot);

  assert.equal(store.getPresence(gateway.id).status, 'recently_active');
  assert.equal(store.getRemoteRuntimeBindingByGatewayId(gateway.id)?.status, 'recently_active');

  snapshot.presenceHeartbeats = [
    {
      gatewayId: gateway.id,
      lastSeenAt: new Date(Date.now() - 50 * 60_000).toISOString(),
    },
  ];
  snapshot.remoteRuntimeBindings = snapshot.remoteRuntimeBindings.map((binding) =>
    binding.gatewayId === gateway.id
      ? {
          ...binding,
          lastHeartbeatAt: new Date(Date.now() - 50 * 60_000).toISOString(),
        }
      : binding,
  );
  store.importSnapshot(snapshot);

  assert.equal(store.getPresence(gateway.id).status, 'offline');
  assert.equal(store.getRemoteRuntimeBindingByGatewayId(gateway.id)?.status, 'offline');
});
