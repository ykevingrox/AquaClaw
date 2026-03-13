import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { buildApp } from '../src/app.js';
import { SqliteGatewayStore } from '../src/sqlite-store.js';
import { createGatewayStore, type GatewayStore } from '../src/store.js';

function buildActiveCurrentWindow(durationMinutes = 6 * 60) {
  return {
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + durationMinutes * 60_000).toISOString(),
  };
}

function registerGateway(store: GatewayStore, input: { displayName: string; handle: string }) {
  return store.register(input).gateway;
}

function exerciseCoreSeam(store: GatewayStore) {
  const alpha = registerGateway(store, { displayName: 'SQLite Alpha', handle: 'sqlite-alpha' });
  const beta = registerGateway(store, { displayName: 'SQLite Beta', handle: 'sqlite-beta' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
    message: 'reef hello',
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: alpha.id,
    body: 'shared coral maps',
  });
  store.markConversationRead({
    conversationId: accepted.conversation.id,
    gatewayId: beta.id,
  });

  store.setCurrent({
    key: 'sqlite-parity',
    label: 'SQLite Parity',
    summary: 'The sea keeps the same shape across memory and sqlite.',
    tone: 'reflective',
    ...buildActiveCurrentWindow(),
    actorGatewayId: alpha.id,
    metadata: {
      source: 'parity-test',
    },
  });

  store.createScene({
    gatewayId: alpha.id,
    type: 'vent',
    summary: 'A direct scene write checks parity on the seam.',
    tone: 'sharp',
    metadata: {
      source: 'parity-test',
    },
  });

  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'SQLite Hosted Owner',
    handle: 'sqlite-hosted-owner',
  }).host;
  const remoteGateway = registerGateway(store, {
    displayName: 'SQLite Remote Runtime',
    handle: 'sqlite-remote-runtime',
  });
  const bridgeCredential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'SQLite Bridge',
  });
  store.bindRemoteRuntime({
    gatewayId: remoteGateway.id,
    bridgeToken: bridgeCredential.token,
    installationId: 'sqlite-remote-install',
    runtimeId: 'sqlite-remote-runtime',
    label: 'SQLite Remote Runtime',
    source: 'parity-test',
  });
  store.heartbeatRemoteRuntime({
    gatewayId: remoteGateway.id,
    runtimeId: 'sqlite-remote-runtime',
    connectionType: 'sqlite_test',
    metadata: {
      source: 'parity-test-heartbeat',
    },
  });
  const remoteRuntime = store.getRemoteRuntimeBindingByGatewayId(remoteGateway.id);
  const revokedBridgeCredential = store.revokeRemoteRuntimeBridgeCredential({
    credentialId: bridgeCredential.id,
    revokedByHostId: hostedOwner.id,
  });

  return {
    current: {
      key: store.getCurrent().key,
      label: store.getCurrent().label,
      source: store.getCurrent().source,
      tone: store.getCurrent().tone,
    },
    friends: store.listFriends(alpha.id).map((gateway) => gateway.handle),
    messages: store.listMessages(accepted.conversation.id, beta.id).map((message) => ({
      body: message.body,
      messageType: message.messageType,
    })),
    conversationReadState: {
      unreadCount: store.getConversationReadState(accepted.conversation.id, beta.id).unreadCount,
      hasLatestMessage: store.getConversationReadState(accepted.conversation.id, beta.id).latestMessage !== null,
      hasReadCursor: store.getConversationReadState(accepted.conversation.id, beta.id).readState.lastReadMessageId !== null,
    },
    encounters: store.listEncounters({
      viewerGatewayId: alpha.id,
      gatewayId: alpha.id,
    }).items.map((encounter) => ({
      encounterCount: encounter.encounterCount,
      lastSummary: encounter.lastSummary,
      recentTopics: encounter.recentTopics,
      notes: encounter.notes,
    })),
    scenes: store.listScenes({ gatewayId: alpha.id }).items.map((scene) => ({
      type: scene.type,
      visibility: scene.visibility,
      summary: scene.summary,
      tone: scene.tone,
    })),
    remoteRuntime: {
      status: remoteRuntime?.status ?? null,
      runtimeId: remoteRuntime?.binding.runtimeId ?? null,
      installationId: remoteRuntime?.binding.installationId ?? null,
      source: remoteRuntime?.binding.source ?? null,
      metadata: remoteRuntime?.binding.metadata ?? null,
      claimedByBoundGateway: bridgeCredential.claimedByGatewayId === remoteGateway.id,
      revoked: revokedBridgeCredential.revokedAt !== null,
      presenceStatus: store.getPresence(remoteGateway.id).status,
    },
    mineEventTypes: store.listSeaFeed({
      viewerGatewayId: alpha.id,
      scope: 'mine',
    }).items.map((event) => event.type),
    systemEventTypes: store.listSeaFeed({
      viewerGatewayId: alpha.id,
      scope: 'system',
    }).items.map((event) => event.type),
  };
}

async function registerGatewayViaApi(
  app: ReturnType<typeof buildApp>,
  payload: { displayName: string; handle: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload,
  });
  assert.equal(response.statusCode, 201);
  return response.json().data as {
    gateway: {
      id: string;
      handle: string;
    };
    credential: {
      token: string;
    };
  };
}

async function bootstrapLocalSessionViaApi(
  app: ReturnType<typeof buildApp>,
  payload?: { displayName?: string; handle?: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-local',
    payload,
  });
  assert.ok([200, 201].includes(response.statusCode));
  return response.json().data as {
    host: {
      id: string;
      handle: string;
    };
    session: {
      id: string;
      hostId: string;
    };
    credential: {
      token: string;
    };
    owner: {
      created: boolean;
    };
  };
}

test('sqlite backend matches memory backend on the core store seam', () => {
  const memoryStore = createGatewayStore();
  const sqliteStore = createGatewayStore({ backend: 'sqlite', databaseUrl: ':memory:' });

  try {
    const memoryResult = exerciseCoreSeam(memoryStore);
    const sqliteResult = exerciseCoreSeam(sqliteStore);
    assert.deepEqual(sqliteResult, memoryResult);
  } finally {
    if (sqliteStore instanceof SqliteGatewayStore) {
      sqliteStore.close();
    }
  }
});

test('sqlite backend survives restart for auth, current, encounters, messages, scenes, and feed', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-'));
  const databasePath = join(tempDir, 'aquaclaw.sqlite');

  const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
  const app1 = buildApp({ store: store1 });

  try {
    const host = await bootstrapLocalSessionViaApi(app1, {
      displayName: 'Restart Host',
      handle: 'restart-host',
    });
    const alpha = await registerGatewayViaApi(app1, {
      displayName: 'Restart Alpha',
      handle: 'restart-alpha',
    });
    const beta = await registerGatewayViaApi(app1, {
      displayName: 'Restart Beta',
      handle: 'restart-beta',
    });

    const currentWrite = await app1.inject({
      method: 'POST',
      url: '/api/v1/currents',
      headers: { authorization: `Bearer ${host.credential.token}` },
      payload: {
        key: 'restart-current',
        label: 'Restart Current',
        summary: 'A durable current should remain after restart.',
        tone: 'calm',
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      },
    });
    assert.equal(currentWrite.statusCode, 201);
    const currentId = currentWrite.json().data.current.id as string;

    const friendRequest = await app1.inject({
      method: 'POST',
      url: '/api/v1/friend-requests',
      headers: { authorization: `Bearer ${alpha.credential.token}` },
      payload: { toGatewayId: beta.gateway.id },
    });
    assert.equal(friendRequest.statusCode, 201);
    const requestId = friendRequest.json().data.request.id as string;

    const accept = await app1.inject({
      method: 'POST',
      url: `/api/v1/friend-requests/${requestId}/accept`,
      headers: { authorization: `Bearer ${beta.credential.token}` },
    });
    assert.equal(accept.statusCode, 200);
    const conversationId = accept.json().data.conversation.id as string;

    const message = await app1.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${alpha.credential.token}` },
      payload: { body: 'durable coral memory' },
    });
    assert.equal(message.statusCode, 201);
    const messageId = message.json().data.message.id as string;

    const markRead = await app1.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/read-state`,
      headers: { authorization: `Bearer ${beta.credential.token}` },
    });
    assert.equal(markRead.statusCode, 200);
    assert.equal(markRead.json().data.readState.lastReadMessageId, messageId);
    assert.equal(markRead.json().data.readState.unreadCount, 0);

    const scene = await app1.inject({
      method: 'POST',
      url: '/api/v1/scenes/generate',
      headers: { authorization: `Bearer ${alpha.credential.token}` },
      payload: { type: 'vent' },
    });
    assert.equal(scene.statusCode, 201);
    const sceneId = scene.json().data.scene.id as string;

    const environment = await app1.inject({
      method: 'POST',
      url: '/api/v1/environment',
      headers: { authorization: `Bearer ${host.credential.token}` },
      payload: {
        waterTemperatureC: 19,
        clarity: 'clear',
        tideDirection: 'incoming',
        surfaceState: 'rippled',
        phenomenon: 'lantern_swarm',
      },
    });
    assert.equal(environment.statusCode, 201);
    const environmentId = environment.json().data.environment.id as string;

    await app1.close();
    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    const app2 = buildApp({ store: store2 });

    try {
      const me = await app2.inject({
        method: 'GET',
        url: '/api/v1/gateways/me',
        headers: { authorization: `Bearer ${alpha.credential.token}` },
      });
      assert.equal(me.statusCode, 200);
      assert.equal(me.json().data.gateway.handle, 'restart-alpha');

      const current = await app2.inject({
        method: 'GET',
        url: '/api/v1/currents/current',
      });
      assert.equal(current.statusCode, 200);
      assert.equal(current.json().data.current.id, currentId);
      assert.equal(current.json().data.current.label, 'Restart Current');

      const environment = await app2.inject({
        method: 'GET',
        url: '/api/v1/environment/current',
        headers: { authorization: `Bearer ${alpha.credential.token}` },
      });
      assert.equal(environment.statusCode, 200);
      assert.equal(environment.json().data.environment.id, environmentId);

      const messages = await app2.inject({
        method: 'GET',
        url: `/api/v1/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${beta.credential.token}` },
      });
      assert.equal(messages.statusCode, 200);
      assert.equal(messages.json().data.items.length, 1);
      assert.equal(messages.json().data.items[0].body, 'durable coral memory');
      assert.equal(messages.json().data.readState.lastReadMessageId, messageId);
      assert.equal(messages.json().data.readState.unreadCount, 0);

      const encounters = await app2.inject({
        method: 'GET',
        url: '/api/v1/encounters',
        headers: { authorization: `Bearer ${alpha.credential.token}` },
      });
      assert.equal(encounters.statusCode, 200);
      assert.equal(encounters.json().data.items.length, 1);
      assert.equal(encounters.json().data.items[0].encounterCount, 2);
      assert.equal(encounters.json().data.items[0].peer.handle, 'restart-beta');

      const scenes = await app2.inject({
        method: 'GET',
        url: '/api/v1/scenes/mine',
        headers: { authorization: `Bearer ${alpha.credential.token}` },
      });
      assert.equal(scenes.statusCode, 200);
      assert.equal((scenes.json().data.items as Array<{ id: string }>).some((item) => item.id === sceneId), true);

      const mineFeed = await app2.inject({
        method: 'GET',
        url: '/api/v1/sea/feed?scope=mine',
        headers: { authorization: `Bearer ${alpha.credential.token}` },
      });
      assert.equal(mineFeed.statusCode, 200);
      assert.equal(
        (mineFeed.json().data.items as Array<{ type: string }>).some((item) => item.type === 'scene.vent_generated'),
        true,
      );
      assert.equal(
        (mineFeed.json().data.items as Array<{ type: string }>).some((item) => item.type === 'encounter.updated'),
        true,
      );

      const systemFeed = await app2.inject({
        method: 'GET',
        url: '/api/v1/sea/feed?scope=system',
        headers: { authorization: `Bearer ${alpha.credential.token}` },
      });
      assert.equal(systemFeed.statusCode, 200);
      assert.equal(
        (systemFeed.json().data.items as Array<{ type: string }>).some((item) => item.type === 'current.changed'),
        true,
      );
      assert.equal(
        (systemFeed.json().data.items as Array<{ type: string }>).some((item) => item.type === 'environment.changed'),
        true,
      );
    } finally {
      await app2.close();
      if (store2 instanceof SqliteGatewayStore) {
        store2.close();
      }
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('sqlite backend preserves local owner bootstrap and session continuity across restart', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-session-'));
  const databasePath = join(tempDir, 'aquaclaw.sqlite');

  const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
  const app1 = buildApp({ store: store1 });

  try {
    const first = await bootstrapLocalSessionViaApi(app1, {
      displayName: 'SQLite Owner',
      handle: 'sqlite-owner',
    });
    assert.equal(first.owner.created, true);

    await app1.close();
    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    const app2 = buildApp({ store: store2 });

    try {
      const sessionMe = await app2.inject({
        method: 'GET',
        url: '/api/v1/session/me',
        headers: { authorization: `Bearer ${first.credential.token}` },
      });
      assert.equal(sessionMe.statusCode, 200);
      assert.equal(sessionMe.json().data.host.id, first.host.id);
      assert.equal(sessionMe.json().data.host.handle, 'sqlite-owner');

      const second = await bootstrapLocalSessionViaApi(app2);
      assert.equal(second.owner.created, false);
      assert.equal(second.host.id, first.host.id);

      const logout = await app2.inject({
        method: 'POST',
        url: '/api/v1/session/logout',
        headers: { authorization: `Bearer ${first.credential.token}` },
      });
      assert.equal(logout.statusCode, 200);

      const afterLogout = await app2.inject({
        method: 'GET',
        url: '/api/v1/session/me',
        headers: { authorization: `Bearer ${first.credential.token}` },
      });
      assert.equal(afterLogout.statusCode, 401);
    } finally {
      await app2.close();
      if (store2 instanceof SqliteGatewayStore) {
        store2.close();
      }
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('sqlite backend preserves aqua profile rename across restart', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-aqua-'));
  const databasePath = join(tempDir, 'aquaclaw.sqlite');

  const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
  const app1 = buildApp({ store: store1 });

  try {
    const owner = await bootstrapLocalSessionViaApi(app1, {
      displayName: 'SQLite Aqua Owner',
      handle: 'sqlite-aqua-owner',
    });

    const rename = await app1.inject({
      method: 'PATCH',
      url: '/api/v1/aqua/me',
      headers: { authorization: `Bearer ${owner.credential.token}` },
      payload: { displayName: 'Durable Sea' },
    });
    assert.equal(rename.statusCode, 200);
    assert.equal(rename.json().data.aqua.displayName, 'Durable Sea');

    await app1.close();
    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    const app2 = buildApp({ store: store2 });

    try {
      const publicAqua = await app2.inject({
        method: 'GET',
        url: '/api/v1/public/aqua',
      });
      assert.equal(publicAqua.statusCode, 200);
      assert.equal(publicAqua.json().data.aqua.displayName, 'Durable Sea');
    } finally {
      await app2.close();
      if (store2 instanceof SqliteGatewayStore) {
        store2.close();
      }
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('sqlite backend preserves local runtime binding and heartbeat continuity across restart', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-runtime-'));
  const databasePath = join(tempDir, 'aquaclaw.sqlite');

  const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
  const app1 = buildApp({ store: store1 });

  try {
    const owner = await bootstrapLocalSessionViaApi(app1, {
      displayName: 'SQLite Runtime Owner',
      handle: 'sqlite-runtime-owner',
    });

    const bind = await app1.inject({
      method: 'POST',
      url: '/api/v1/runtime/local/bind',
      headers: { authorization: `Bearer ${owner.credential.token}` },
      payload: {
        installationId: 'sqlite-runtime-install',
        runtimeId: 'sqlite-runtime-main',
        label: 'SQLite Runtime',
      },
    });
    assert.equal(bind.statusCode, 201);

    const heartbeat = await app1.inject({
      method: 'POST',
      url: '/api/v1/runtime/local/heartbeat',
      headers: { authorization: `Bearer ${owner.credential.token}` },
      payload: {
        connectionType: 'sqlite_test',
      },
    });
    assert.equal(heartbeat.statusCode, 200);

    await app1.close();
    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    const app2 = buildApp({ store: store2 });

    try {
      const runtime = await app2.inject({
        method: 'GET',
        url: '/api/v1/runtime/local',
        headers: { authorization: `Bearer ${owner.credential.token}` },
      });
      assert.equal(runtime.statusCode, 200);
      assert.equal(runtime.json().data.runtime.runtimeId, 'sqlite-runtime-main');
      assert.equal(runtime.json().data.runtime.installationId, 'sqlite-runtime-install');
      assert.equal(runtime.json().data.runtime.status, 'online');
      assert.equal(runtime.json().data.host.handle, 'sqlite-runtime-owner');
    } finally {
      await app2.close();
      if (store2 instanceof SqliteGatewayStore) {
        store2.close();
      }
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
