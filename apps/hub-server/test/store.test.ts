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
  const owner = store.bootstrapLocalSession({
    displayName: 'Store Local Owner',
    handle: 'store-local-owner',
  }).gateway;
  const alpha = registerGateway(store, {
    displayName: 'Store Alpha Guardrail',
    handle: 'store-alpha-guardrail',
  });
  const beta = registerGateway(store, {
    displayName: 'Store Beta Guardrail',
    handle: 'store-beta-guardrail',
  });

  assert.equal(owner.friendRequestPolicy, 'disabled');

  assert.throws(
    () =>
      store.createFriendRequest({
        fromGatewayId: alpha.id,
        toGatewayId: owner.id,
      }),
    /owner gateway cannot participate in friend requests/,
  );

  const claimedInvite = store.claimInvite({
    code: store.createInvite({ createdByGatewayId: owner.id, maxUses: 1 }).code,
    claimedByGatewayId: alpha.id,
  });
  assert.equal(claimedInvite.friendRequest, null);
  assert.equal(store.listIncomingFriendRequests(owner.id).length, 0);

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

test('GatewayStore hosted invite join registers, claims, binds, and heartbeats in one atomic step', () => {
  const store: GatewayStore = createGatewayStore();
  const owner = store.bootstrapHostedSession({
    displayName: 'Hosted Join Owner',
    handle: 'hosted-join-owner-store',
  }).gateway;

  const invite = store.createInvite({
    createdByGatewayId: owner.id,
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
    connectionType: 'openclaw_remote',
    heartbeatMetadata: {
      source: 'hosted-join-heartbeat-store-test',
    },
  });

  assert.equal(joined.gateway.handle, 'hosted-join-gateway-store');
  assert.equal(typeof joined.token, 'string');
  assert.equal(joined.claim.inviteId, invite.id);
  assert.equal(joined.friendRequest, null);
  assert.equal(joined.bridgeCredential.claimedByGatewayId, joined.gateway.id);
  assert.equal(joined.runtime.binding.runtimeId, 'hosted-join-runtime-store');
  assert.equal(joined.runtime.binding.installationId, 'hosted-join-install-store');
  assert.equal(joined.runtime.binding.metadata.region, 'apac');
  assert.equal(joined.runtime.binding.metadata.source, 'hosted-join-heartbeat-store-test');
  assert.equal(joined.runtime.status, 'online');
  assert.equal(joined.presence.status, 'online');
  assert.equal(store.listIncomingFriendRequests(owner.id).length, 0);

  const runtime = store.getRemoteRuntimeBindingByGatewayId(joined.gateway.id);
  assert.ok(runtime);
  assert.equal(runtime.binding.runtimeId, 'hosted-join-runtime-store');
  assert.equal(runtime.status, 'online');

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
  const owner = store.bootstrapHostedSession({
    displayName: 'Hosted Join Rollback Owner',
    handle: 'hosted-join-rollback-owner-store',
  }).gateway;

  registerGateway(store, {
    displayName: 'Existing Join Handle',
    handle: 'hosted-join-conflict-store',
  });

  const invite = store.createInvite({
    createdByGatewayId: owner.id,
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

  const ownerIncoming = store.listIncomingFriendRequests(owner.id);
  assert.equal(ownerIncoming.length, 0);
  assert.equal(store.getRemoteRuntimeBindingByGatewayId(owner.id), null);

  const anotherJoin = store.joinHostedRuntimeWithInvite({
    inviteCode: invite.code,
    displayName: 'Hosted Join After Conflict',
    handle: 'hosted-join-after-conflict-store',
  });
  assert.equal(anotherJoin.claim.inviteId, invite.id);
});


test('GatewayStore remote runtime bridge credential seam requires hosted owner identity', () => {
  const store: GatewayStore = createGatewayStore();
  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'Hosted Store Owner',
    handle: 'hosted-store-owner',
  }).gateway;
  const outsider = registerGateway(store, {
    displayName: 'Store Outsider',
    handle: 'store-outsider',
  });

  const credential = store.createRemoteRuntimeBridgeCredential({
    createdByGatewayId: hostedOwner.id,
    label: 'Hosted Remote Bridge',
  });
  assert.equal(typeof credential.token, 'string');
  assert.equal(typeof credential.expiresAt, 'string');
  assert.equal(credential.claimedByGatewayId, null);

  assert.throws(
    () =>
      store.createRemoteRuntimeBridgeCredential({
        createdByGatewayId: outsider.id,
      }),
    /hosted runtime bridge credential requires the hosted owner gateway/,
  );
});

test('GatewayStore remote runtime bridge credentials default to 24h expiry and newer binds supersede the active runtime', () => {
  const store = new InMemoryGatewayStore();
  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'Hosted Runtime Lifecycle Owner',
    handle: 'hosted-runtime-lifecycle-owner',
  }).gateway;
  const remoteGateway = registerGateway(store, {
    displayName: 'Hosted Runtime Lifecycle Gateway',
    handle: 'hosted-runtime-lifecycle-gateway',
  });

  const expiringCredential = store.createRemoteRuntimeBridgeCredential({
    createdByGatewayId: hostedOwner.id,
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
    createdByGatewayId: hostedOwner.id,
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
    createdByGatewayId: hostedOwner.id,
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
  }).gateway;
  const remoteGateway = registerGateway(store, {
    displayName: 'Remote Runtime Gateway',
    handle: 'remote-runtime-gateway-store',
  });
  const anotherGateway = registerGateway(store, {
    displayName: 'Another Runtime Gateway',
    handle: 'another-runtime-gateway-store',
  });

  const credential = store.createRemoteRuntimeBridgeCredential({
    createdByGatewayId: hostedOwner.id,
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
    revokedByGatewayId: hostedOwner.id,
  });
  assert.equal(typeof revoked.revokedAt, 'string');
  assert.equal(revoked.revokedByGatewayId, hostedOwner.id);

  const replacementCredential = store.createRemoteRuntimeBridgeCredential({
    createdByGatewayId: hostedOwner.id,
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
