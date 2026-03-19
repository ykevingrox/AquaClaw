import assert from 'node:assert/strict';
import test from 'node:test';

import { createGatewayStore, InMemoryGatewayStore, type GatewayStore } from '../src/store.js';
import { SqliteGatewayStore } from '../src/sqlite-store.js';

function registerGateway(store: GatewayStore, input: { displayName: string; handle: string }) {
  return store.register(input).gateway;
}

function withFrozenTime<T>(iso: string, fn: () => T): T {
  const fixedNow = new Date(iso).getTime();
  const RealDate = Date;

  class MockDate extends RealDate {
    constructor(value?: string | number | Date) {
      if (arguments.length === 0) {
        super(fixedNow);
        return;
      }
      super(value as string | number | Date);
    }

    static now() {
      return fixedNow;
    }
  }

  Object.setPrototypeOf(MockDate, RealDate);
  MockDate.parse = RealDate.parse;
  MockDate.UTC = RealDate.UTC;

  globalThis.Date = MockDate as DateConstructor;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
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

test('GatewayStore automatically rotates current and environment every seeded window and emits system events on transition', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Auto Tide Watcher', handle: 'auto-tide-watcher' });

  const firstCurrent = withFrozenTime('2026-03-18T00:10:00.000Z', () => store.getCurrent());
  const firstEnvironment = withFrozenTime('2026-03-18T00:10:00.000Z', () => store.getEnvironment());

  const secondCurrent = withFrozenTime('2026-03-18T02:11:00.000Z', () => store.getCurrent());
  const secondEnvironment = withFrozenTime('2026-03-18T02:11:00.000Z', () => store.getEnvironment());

  assert.notEqual(secondCurrent.id, firstCurrent.id);
  assert.notEqual(secondEnvironment.id, firstEnvironment.id);

  const systemFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'system',
  });
  assert.equal(systemFeed.items.some((event) => event.type === 'current.changed'), true);
  assert.equal(systemFeed.items.some((event) => event.type === 'environment.changed'), true);
});

test('GatewayStore temporary manual environment override returns to automatic rotation after expiry', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Environment Lease', handle: 'environment-lease' });

  const manualEnvironment = withFrozenTime('2026-03-18T00:10:00.000Z', () =>
    store.setEnvironment({
      waterTemperatureC: 24,
      clarity: 'clear',
      tideDirection: 'incoming',
      surfaceState: 'rippled',
      phenomenon: 'warm_bloom',
      summary: 'A temporary warm layer drifts through the sea.',
      expiresAt: '2026-03-18T01:10:00.000Z',
      actorGatewayId: alpha.id,
    }),
  );

  const activeManual = withFrozenTime('2026-03-18T00:40:00.000Z', () => store.getEnvironment());
  const resumedAutomatic = withFrozenTime('2026-03-18T01:40:00.000Z', () => store.getEnvironment());

  assert.equal(activeManual.id, manualEnvironment.id);
  assert.notEqual(resumedAutomatic.id, manualEnvironment.id);
  assert.equal(resumedAutomatic.source, 'seeded');

  const systemFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'system',
  });
  const resumedEvent = systemFeed.items.find(
    (event) => event.type === 'environment.changed' && event.metadata.previousEnvironmentSource === 'manual',
  );
  assert.ok(resumedEvent);
  assert.equal(resumedEvent.metadata.source, 'seeded');
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

test('GatewayStore social pulse can choose recharge before another outward move when energy runs low', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Recharge Alpha', handle: 'recharge-alpha-store' });

  store.setCurrent({
    key: 'recharge-heavy-water',
    label: 'Recharge Heavy Water',
    summary: 'The sea is still lively, but the shell has already been working hard.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 20,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });

  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'First outward line before the shell starts feeling thin.',
  });
  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'Second outward line while the current still feels bright.',
  });
  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'Third outward line that tips the shell toward recharge.',
  });

  const evaluation = store.evaluateGatewaySocialPulse(alpha.id);

  assert.equal(evaluation.item.decision.action, 'recharge');
  assert.equal(evaluation.item.decision.reason, 'energy_recharge_window');
  assert.equal(evaluation.item.decision.directMessagePlan, null);
  assert.equal(evaluation.item.decision.publicExpressionPlan, null);
  assert.equal(evaluation.item.decision.rechargePlan?.venueSlug, 'krusty-krab');
  assert.equal(evaluation.item.decision.rechargePlan?.cue, 'heavy_reset');
  assert.equal(typeof evaluation.item.decision.rechargePlan?.suggestedItem, 'string');
  assert.equal(evaluation.item.traits.energy < 0.4, true);
  assert.equal(evaluation.meta.rechargeThreshold > evaluation.meta.memoryThreshold, true);
});

test('GatewayStore social pulse can open a friend request after repeated public crossings with a visible participant peer', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = store.register({
    displayName: 'Friend Pulse Alpha',
    handle: 'friend-pulse-alpha-store',
    visibility: 'public',
  }).gateway;
  const beta = store.register({
    displayName: 'Friend Pulse Beta',
    handle: 'friend-pulse-beta-store',
    visibility: 'public',
  }).gateway;

  store.heartbeatPresence(beta.id);
  store.setCurrent({
    key: 'friend-request-store-current',
    label: 'Friend Request Store Current',
    summary: 'The sea is lively enough to turn repeated public crossings into a relationship start.',
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
    body: 'I keep mapping the brighter loops near the glass edge tonight.',
  });
  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'That route is reading bright from this side too.',
    replyToExpressionId: root.id,
  });
  store.createPublicExpression({
    gatewayId: beta.id,
    body: 'Then we are tracing the same loop.',
    replyToExpressionId: root.id,
  });

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items[0]?.decision.action, 'friend_request_open');
  assert.equal(evaluation.items[0]?.decision.targetGatewayId, beta.id);
  assert.equal(evaluation.items[0]?.decision.targetHandle, beta.handle);
  assert.equal(evaluation.items[0]?.decision.directMessagePlan, null);
  assert.equal(evaluation.items[0]?.decision.friendRequestPlan?.targetGatewayHandle, beta.handle);
  assert.equal(evaluation.items[0]?.decision.friendRequestPlan?.targetGatewayId, beta.id);
  assert.equal((evaluation.items[0]?.decision.friendRequestPlan?.message?.length ?? 0) > 24, true);
  assert.equal(evaluation.items[0]?.friendRequestCandidates[0]?.peerHandle, beta.handle);
  assert.equal(evaluation.items[0]?.friendRequestCandidates[0]?.sharedPublicThreadCount >= 1, true);
  assert.equal((evaluation.items[0]?.friendRequestUrge ?? 0) >= evaluation.meta.friendRequestThreshold, true);
});

test('GatewayStore social pulse can accept a warm incoming friend request before opening new outward relationship seams', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = store.register({
    displayName: 'Incoming Accept Alpha',
    handle: 'incoming-accept-alpha-store',
    visibility: 'public',
  }).gateway;
  const beta = store.register({
    displayName: 'Incoming Accept Beta',
    handle: 'incoming-accept-beta-store',
    visibility: 'public',
  }).gateway;

  store.heartbeatPresence(beta.id);
  store.setCurrent({
    key: 'incoming-accept-current',
    label: 'Incoming Accept Current',
    summary: 'The sea is warm enough that a pending relationship seam can settle naturally.',
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
    body: 'I keep tracing a bright route along the glass edge tonight.',
  });
  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'That route is reading close from this side too.',
    replyToExpressionId: root.id,
  });
  store.createPublicExpression({
    gatewayId: beta.id,
    body: 'Then the wake is shared after all.',
    replyToExpressionId: root.id,
  });

  const incoming = store.createFriendRequest({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    message: 'Want to keep a steadier line open?',
  });

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items[0]?.decision.action, 'friend_request_accept');
  assert.equal(evaluation.items[0]?.decision.targetGatewayId, beta.id);
  assert.equal(evaluation.items[0]?.decision.targetHandle, beta.handle);
  assert.equal(evaluation.items[0]?.decision.friendRequestPlan, null);
  assert.equal(evaluation.items[0]?.decision.incomingFriendRequestPlan?.requestId, incoming.id);
  assert.equal(evaluation.items[0]?.decision.incomingFriendRequestPlan?.disposition, 'accept');
  assert.equal(evaluation.items[0]?.incomingFriendRequestCandidates[0]?.fromGatewayHandle, beta.handle);
  assert.equal(
    (evaluation.items[0]?.incomingFriendRequestCandidates[0]?.acceptScore ?? 0) >=
      evaluation.meta.incomingFriendRequestAcceptThreshold,
    true,
  );
});

test('GatewayStore social pulse can reject a stale cold incoming friend request', () => {
  const store = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = store.register({
    displayName: 'Incoming Reject Alpha',
    handle: 'incoming-reject-alpha-store',
    visibility: 'public',
  }).gateway;
  const beta = store.register({
    displayName: 'Incoming Reject Beta',
    handle: 'incoming-reject-beta-store',
    visibility: 'public',
  }).gateway;

  store.setCurrent({
    key: 'incoming-reject-current',
    label: 'Incoming Reject Current',
    summary: 'The water is calm, but stale cold requests should not stay pending forever.',
    tone: 'calm',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 11,
    clarity: 'murky',
    tideDirection: 'outgoing',
    surfaceState: 'glassy',
    phenomenon: 'none',
    actorGatewayId: alpha.id,
  });

  const previous = store.createFriendRequest({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    message: 'First pass.',
  });
  store.rejectFriendRequest(previous.id, alpha.id);
  const incoming = store.createFriendRequest({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    message: 'Second pass.',
  });

  const snapshot = store.exportSnapshot();
  snapshot.friendRequests = snapshot.friendRequests.map((request) => {
    if (request.id === previous.id) {
      return {
        ...request,
        updatedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
        respondedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
      };
    }
    if (request.id === incoming.id) {
      return {
        ...request,
        createdAt: new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString(),
      };
    }
    return request;
  });
  store.importSnapshot(snapshot);

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items[0]?.decision.action, 'friend_request_reject');
  assert.equal(evaluation.items[0]?.decision.targetGatewayId, beta.id);
  assert.equal(evaluation.items[0]?.decision.incomingFriendRequestPlan?.requestId, incoming.id);
  assert.equal(evaluation.items[0]?.decision.incomingFriendRequestPlan?.disposition, 'reject');
  assert.equal(
    (evaluation.items[0]?.incomingFriendRequestCandidates[0]?.rejectScore ?? 0) >=
      evaluation.meta.incomingFriendRequestRejectThreshold,
    true,
  );
});

test('GatewayStore social pulse holds incoming friend request triage instead of opening a new outgoing request to a third gateway', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = store.register({
    displayName: 'Incoming Hold Alpha',
    handle: 'incoming-hold-alpha-store',
    visibility: 'public',
  }).gateway;
  const beta = store.register({
    displayName: 'Incoming Hold Beta',
    handle: 'incoming-hold-beta-store',
    visibility: 'public',
  }).gateway;
  const gamma = store.register({
    displayName: 'Incoming Hold Gamma',
    handle: 'incoming-hold-gamma-store',
    visibility: 'public',
  }).gateway;

  store.heartbeatPresence(gamma.id);
  store.setCurrent({
    key: 'incoming-hold-current',
    label: 'Incoming Hold Current',
    summary: 'The sea is lively, but pending incoming requests should not be ignored while opening new ones.',
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

  const gammaRoot = store.createPublicExpression({
    gatewayId: gamma.id,
    body: 'I keep mapping the brighter loops near the glass edge tonight.',
  });
  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'That route is reading bright from this side too.',
    replyToExpressionId: gammaRoot.id,
  });
  store.createPublicExpression({
    gatewayId: gamma.id,
    body: 'Then we are tracing the same loop.',
    replyToExpressionId: gammaRoot.id,
  });

  const incoming = store.createFriendRequest({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    message: 'Hello from nearby.',
  });
  store.heartbeatPresence(beta.id);

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items[0]?.decision.action, 'memory_only');
  assert.equal(evaluation.items[0]?.decision.reason, 'incoming_friend_request_hold');
  assert.equal(evaluation.items[0]?.decision.friendRequestPlan, null);
  assert.equal(evaluation.items[0]?.decision.incomingFriendRequestPlan, null);
  assert.equal(evaluation.items[0]?.incomingFriendRequestCandidates[0]?.requestId, incoming.id);
  assert.equal((evaluation.items[0]?.incomingFriendRequestUrge ?? 0) > 0, true);
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

test('GatewayStore public expression seam normalizes freeform tone hints and falls back to current tone', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Tone Alpha', handle: 'tone-alpha-store' });

  store.setCurrent({
    key: 'tone-normalization-water',
    label: 'Tone Normalization Water',
    summary: 'The sea stays playful unless a public note explicitly resolves elsewhere.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });

  const normalized = store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'A sharper line should still resolve to a canonical tone.',
    tone: '\u6025\u8e81',
  });
  const fallback = store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'An unknown tone hint should quietly fall back to the active current.',
    tone: 'stormy-but-undefined',
  });

  assert.equal(normalized.tone, 'sharp');
  assert.equal(fallback.tone, 'playful');
});

test('GatewayStore recharge activity creates an observer-safe feed event for participant gateways', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Recharge Alpha', handle: 'recharge-alpha-store' });

  const event = store.recordRechargeActivity({
    gatewayId: alpha.id,
    venueSlug: 'krusty-krab',
    venueName: 'Krusty Krab',
    cue: 'heavy_reset',
    suggestedItem: '海藻奶昔',
    suggestedKind: '奶昔',
  });

  assert.equal(event.type, 'recharge.selected');
  assert.equal(event.visibility, 'public');
  assert.equal(event.metadata.venueSlug, 'krusty-krab');
  assert.equal(event.metadata.venueName, 'Krusty Krab');
  assert.equal(event.metadata.suggestedItem, '海藻奶昔');

  const feed = store.listPublicSeaFeed();
  const rechargeEvent = feed.items.find((item) => item.type === 'recharge.selected');
  assert.ok(rechargeEvent);
  assert.equal(rechargeEvent.metadata.venueName, 'Krusty Krab');
  assert.equal(rechargeEvent.metadata.suggestedKind, '奶昔');
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
  assert.equal(joined.reusedGateway, false);

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

test('GatewayStore hosted invite join reuses an existing remote runtime identity for the same installation', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapHostedSession({
    displayName: 'Hosted Rejoin Owner',
    handle: 'hosted-rejoin-owner-store',
  }).host;

  const firstInvite = store.createInvite({
    createdByHostId: host.id,
    maxUses: 1,
  });

  const firstJoin = store.joinHostedRuntimeWithInvite({
    inviteCode: firstInvite.code,
    displayName: 'Hosted Rejoin Gateway',
    handle: 'hosted-rejoin-gateway-store',
    installationId: 'hosted-rejoin-install-store',
    runtimeId: 'hosted-rejoin-runtime-store',
    label: 'Hosted Rejoin Runtime Store',
    source: 'hosted_rejoin_store_test',
  });

  const secondInvite = store.createInvite({
    createdByHostId: host.id,
    maxUses: 1,
  });

  const secondJoin = store.joinHostedRuntimeWithInvite({
    inviteCode: secondInvite.code,
    displayName: 'Hosted Rejoin Gateway Two',
    handle: 'hosted-rejoin-gateway-store-two',
    installationId: 'hosted-rejoin-install-store',
    runtimeId: 'hosted-rejoin-runtime-store-two',
    label: 'Hosted Rejoin Runtime Store Two',
    source: 'hosted_rejoin_store_test_again',
  });

  assert.equal(secondJoin.reusedGateway, true);
  assert.equal(secondJoin.gateway.id, firstJoin.gateway.id);
  assert.equal(secondJoin.gateway.handle, firstJoin.gateway.handle);
  assert.notEqual(secondJoin.token, firstJoin.token);
  assert.equal(store.findByToken(firstJoin.token), null);
  assert.equal(store.findByToken(secondJoin.token)?.id, firstJoin.gateway.id);
  assert.equal(secondJoin.runtime.binding.gatewayId, firstJoin.gateway.id);
  assert.equal(secondJoin.runtime.binding.installationId, 'hosted-rejoin-install-store');
  assert.equal(secondJoin.runtime.binding.runtimeId, 'hosted-rejoin-runtime-store-two');
  assert.equal(secondJoin.runtime.binding.source, 'hosted_rejoin_store_test_again');
  assert.equal(secondJoin.claim.inviteId, secondInvite.id);
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
  snapshot.remoteRuntimeBindings = (snapshot.remoteRuntimeBindings ?? []).map((binding) =>
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
  snapshot.remoteRuntimeBindings = (snapshot.remoteRuntimeBindings ?? []).map((binding) =>
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
