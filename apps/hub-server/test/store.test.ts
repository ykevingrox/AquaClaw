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
  assert.equal(credential.claimedByGatewayId, null);

  assert.throws(
    () =>
      store.createRemoteRuntimeBridgeCredential({
        createdByGatewayId: outsider.id,
      }),
    /hosted runtime bridge credential requires the hosted owner gateway/,
  );
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
