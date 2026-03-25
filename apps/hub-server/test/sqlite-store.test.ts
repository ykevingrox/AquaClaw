import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { buildApp } from '../src/app.js';
import { SqliteGatewayStore } from '../src/sqlite-store.js';
import { createGatewayStore, type GatewayStore } from '../src/store.js';

function buildActiveCurrentWindow(durationMinutes = 2 * 60) {
  return {
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + durationMinutes * 60_000).toISOString(),
  };
}

function registerGateway(store: GatewayStore, input: { displayName: string; handle: string }) {
  return store.register(input).gateway;
}

function importXiaowoQueue(
  store: GatewayStore,
  hostId: string,
  items: Array<{ headline: string; promptSummary: string; body: string }>,
  createdAt = '2026-03-23T09:00:00.000Z',
) {
  return store.importCommunityBulletinCandidates({
    hostId,
    createdAt,
    items,
  });
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

function exerciseCoreSeam(store: GatewayStore) {
  const alpha = registerGateway(store, { displayName: 'SQLite Alpha', handle: 'sqlite-alpha' });
  const beta = registerGateway(store, { displayName: 'SQLite Beta', handle: 'sqlite-beta' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
    message: 'reef hello',
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  store.updateFriendScopes({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    updates: [{ scopeName: 'task.request', state: 'granted' }],
  });
  const taskRequest = store.createTaskRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
    title: 'Check the lantern route',
    body: 'Map the lantern route before the next drift.',
  });
  store.acceptTaskRequest(taskRequest.id, beta.id);
  store.completeTaskRequest(taskRequest.id, alpha.id);

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
    taskRequests: store.listOutgoingTaskRequests(alpha.id).map((request) => ({
      status: request.status,
      title: request.title,
      body: request.body,
    })),
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
  payload: { displayName: string; handle: string; visibility?: string },
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

test('sqlite readiness check reflects whether the database connection is still usable', () => {
  const store = new SqliteGatewayStore({ databaseUrl: ':memory:' });
  assert.deepEqual(store.checkReadiness(), {
    ok: true,
    backend: 'sqlite',
  });

  store.close();

  const readiness = store.checkReadiness();
  assert.equal(readiness.ok, false);
  assert.equal(readiness.backend, 'sqlite');
  assert.equal(typeof readiness.detail, 'string');
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

    const publicExpression = await app1.inject({
      method: 'POST',
      url: '/api/v1/public-expressions',
      headers: { authorization: `Bearer ${alpha.credential.token}` },
      payload: {
        body: 'A public wake should survive restart.',
      },
    });
    assert.equal(publicExpression.statusCode, 201);
    const publicExpressionId = publicExpression.json().data.expression.id as string;

    const taskScope = await app1.inject({
      method: 'PATCH',
      url: `/api/v1/friends/${alpha.gateway.id}/scopes`,
      headers: { authorization: `Bearer ${beta.credential.token}` },
      payload: {
        updates: [{ scopeName: 'task.request', state: 'granted' }],
      },
    });
    assert.equal(taskScope.statusCode, 200);

    const taskRequest = await app1.inject({
      method: 'POST',
      url: '/api/v1/task-requests',
      headers: { authorization: `Bearer ${alpha.credential.token}` },
      payload: {
        toGatewayId: beta.gateway.id,
        title: 'Carry the restart ledger',
        body: 'Bring the restart ledger back after the glass check.',
      },
    });
    assert.equal(taskRequest.statusCode, 201);
    const taskRequestId = taskRequest.json().data.request.id as string;

    const acceptTaskRequest = await app1.inject({
      method: 'POST',
      url: `/api/v1/task-requests/${taskRequestId}/accept`,
      headers: { authorization: `Bearer ${beta.credential.token}` },
    });
    assert.equal(acceptTaskRequest.statusCode, 200);

    const completeTaskRequest = await app1.inject({
      method: 'POST',
      url: `/api/v1/task-requests/${taskRequestId}/complete`,
      headers: { authorization: `Bearer ${alpha.credential.token}` },
    });
    assert.equal(completeTaskRequest.statusCode, 200);

    const publicReply = await app1.inject({
      method: 'POST',
      url: '/api/v1/public-expressions',
      headers: { authorization: `Bearer ${beta.credential.token}` },
      payload: {
        body: 'And so should the reply.',
        replyToExpressionId: publicExpressionId,
      },
    });
    assert.equal(publicReply.statusCode, 201);
    const publicReplyId = publicReply.json().data.expression.id as string;

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

      const outgoingTaskRequests = await app2.inject({
        method: 'GET',
        url: '/api/v1/task-requests/outgoing',
        headers: { authorization: `Bearer ${alpha.credential.token}` },
      });
      assert.equal(outgoingTaskRequests.statusCode, 200);
      assert.equal(outgoingTaskRequests.json().data.items.length, 1);
      assert.equal(outgoingTaskRequests.json().data.items[0].title, 'Carry the restart ledger');
      assert.equal(outgoingTaskRequests.json().data.items[0].status, 'completed');

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
        (mineFeed.json().data.items as Array<{ type: string }>).some((item) => item.type === 'conversation.message_sent'),
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

      const publicExpressions = await app2.inject({
        method: 'GET',
        url: `/api/v1/public-expressions?rootExpressionId=${publicReplyId}`,
      });
      assert.equal(publicExpressions.statusCode, 200);
      assert.deepEqual(
        publicExpressions.json().data.items.map((item: { id: string }) => item.id),
        [publicExpressionId, publicReplyId],
      );

      const publicFeed = await app2.inject({
        method: 'GET',
        url: '/api/v1/public/feed',
      });
      assert.equal(publicFeed.statusCode, 200);
      assert.equal(
        (publicFeed.json().data.items as Array<{ type: string }>).some((item) => item.type === 'public_expression.created'),
        true,
      );
      assert.equal(
        (publicFeed.json().data.items as Array<{ type: string }>).some((item) => item.type === 'public_expression.replied'),
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

test('Sqlite store persists automatic current/environment rotation state across restart', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-rotation-'));
  const databasePath = join(tempDir, 'gateway-hub.sqlite');

  try {
    const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    const alpha = registerGateway(store1, { displayName: 'SQLite Rotator', handle: 'sqlite-rotator' });

    withFrozenTime('2026-03-18T00:10:00.000Z', () => {
      store1.getCurrent();
      store1.getEnvironment();
    });

    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    try {
      withFrozenTime('2026-03-18T06:11:00.000Z', () => {
        store2.getCurrent();
        store2.getEnvironment();
      });

      const systemFeed = store2.listSeaFeed({
        viewerGatewayId: alpha.id,
        scope: 'system',
      });
      assert.equal(systemFeed.items.some((event) => event.type === 'current.changed'), true);
      assert.equal(systemFeed.items.some((event) => event.type === 'environment.changed'), true);
    } finally {
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

test('sqlite backend preserves social pulse policy across restart', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-social-policy-'));
  const databasePath = join(tempDir, 'aquaclaw.sqlite');

  const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
  const app1 = buildApp({ store: store1 });

  try {
    const owner = await bootstrapLocalSessionViaApi(app1, {
      displayName: 'SQLite Policy Owner',
      handle: 'sqlite-policy-owner',
    });

    const update = await app1.inject({
      method: 'PATCH',
      url: '/api/v1/social-pulse/policy',
      headers: { authorization: `Bearer ${owner.credential.token}` },
      payload: {
        publicExpressionEnabled: false,
        directMessageTargetCooldownMinutes: 960,
        publicExpressionBudgetPer24h: 3,
        directMessageBudgetPer24h: 2,
        quietHours: {
          startTime: '22:30',
          endTime: '07:30',
          timeZone: 'Asia/Shanghai',
        },
      },
    });
    assert.equal(update.statusCode, 200);
    assert.equal(update.json().data.policy.publicExpressionEnabled, false);

    await app1.close();
    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    const app2 = buildApp({ store: store2 });

    try {
      const ownerAgain = await bootstrapLocalSessionViaApi(app2, {
        displayName: 'SQLite Policy Owner',
        handle: 'sqlite-policy-owner',
      });

      const read = await app2.inject({
        method: 'GET',
        url: '/api/v1/social-pulse/policy',
        headers: { authorization: `Bearer ${ownerAgain.credential.token}` },
      });
      assert.equal(read.statusCode, 200);
      assert.equal(read.json().data.policy.publicExpressionEnabled, false);
      assert.equal(read.json().data.policy.directMessageTargetCooldownMinutes, 960);
      assert.equal(read.json().data.policy.publicExpressionBudgetPer24h, 3);
      assert.equal(read.json().data.policy.directMessageBudgetPer24h, 2);
      assert.equal(read.json().data.policy.quietHours.startTime, '22:30');
      assert.equal(read.json().data.policy.quietHours.timeZone, 'Asia/Shanghai');
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

test('sqlite backend preserves community cast policy across restart', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-community-cast-'));
  const databasePath = join(tempDir, 'aquaclaw.sqlite');

  const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
  const app1 = buildApp({ store: store1 });

  try {
    const owner = await bootstrapLocalSessionViaApi(app1, {
      displayName: 'SQLite Community Cast Owner',
      handle: 'sqlite-community-cast-owner',
    });

    const update = await app1.inject({
      method: 'PATCH',
      url: '/api/v1/community-cast/policy',
      headers: { authorization: `Bearer ${owner.credential.token}` },
      payload: {
        globalDailyCap: 5,
        blockedTopicDomains: ['community_callback', 'observer_note'],
        npcs: {
          xiaowo: {
            minIntervalMinutes: 90,
            activeWindowStart: '10:30',
            activeWindowEnd: '19:30',
          },
          beibei: {
            enabled: false,
          },
        },
      },
    });
    assert.equal(update.statusCode, 200);
    assert.equal(update.json().data.policy.globalDailyCap, 5);
    assert.deepEqual(update.json().data.policy.blockedTopicDomains, ['community_callback', 'observer_note']);

    await app1.close();
    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    const app2 = buildApp({ store: store2 });

    try {
      const ownerAgain = await bootstrapLocalSessionViaApi(app2, {
        displayName: 'SQLite Community Cast Owner',
        handle: 'sqlite-community-cast-owner',
      });

      const read = await app2.inject({
        method: 'GET',
        url: '/api/v1/community-cast/policy',
        headers: { authorization: `Bearer ${ownerAgain.credential.token}` },
      });
      assert.equal(read.statusCode, 200);
      assert.equal(read.json().data.registry[0].id, 'xiaowo');
      assert.equal(read.json().data.policy.globalDailyCap, 5);
      assert.deepEqual(read.json().data.policy.blockedTopicDomains, ['community_callback', 'observer_note']);
      assert.equal(read.json().data.policy.npcs.xiaowo.minIntervalMinutes, 90);
      assert.equal(read.json().data.policy.npcs.xiaowo.activeWindowStart, '10:30');
      assert.equal(read.json().data.policy.npcs.beibei.enabled, false);
      assert.equal(read.json().data.policy.npcs.qiaoqiao.enabled, true);
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

test('sqlite backend preserves community memory notes across restart', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-community-memory-'));
  const databasePath = join(tempDir, 'aquaclaw.sqlite');

  const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
  const app1 = buildApp({ store: store1 });

  try {
    await bootstrapLocalSessionViaApi(app1, {
      displayName: 'SQLite Community Memory Host',
      handle: 'sqlite-community-memory-host',
    });
    const alpha = await registerGatewayViaApi(app1, {
      displayName: 'SQLite Community Memory Alpha',
      handle: 'sqlite-community-memory-alpha',
      visibility: 'public',
    });

    const recharge = await app1.inject({
      method: 'POST',
      url: '/api/v1/recharge-events',
      headers: { authorization: `Bearer ${alpha.credential.token}` },
      payload: {
        venueSlug: 'shellbucks',
        venueName: 'ShellBucks',
        cue: 'light_lift',
        suggestedItem: '月光水母茶',
        suggestedKind: '茶饮',
      },
    });
    assert.equal(recharge.statusCode, 201);

    await app1.close();
    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    const app2 = buildApp({ store: store2 });

    try {
      const mine = await app2.inject({
        method: 'GET',
        url: '/api/v1/community-memory/mine?venueSlug=shellbucks',
        headers: { authorization: `Bearer ${alpha.credential.token}` },
      });
      assert.equal(mine.statusCode, 200);
      assert.equal(mine.json().data.items.length, 1);
      assert.equal(mine.json().data.items[0].npcId, 'qiaoqiao');
      assert.equal(mine.json().data.items[0].relatedSeaEventIds[0], recharge.json().data.event.id);
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

test('sqlite backend preserves imported xiaowo bulletin queue items across restart', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-community-bulletin-'));
  const databasePath = join(tempDir, 'aquaclaw.sqlite');

  const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });

  try {
    const host = store1.bootstrapLocalSession().host;

    store1.updateCommunityCastPolicy({
      hostId: host.id,
      activeWindowStart: null,
      activeWindowEnd: null,
      npcs: {
        xiaowo: {
          activeWindowStart: null,
          activeWindowEnd: null,
        },
      },
    });
    const imported = importXiaowoQueue(
      store1,
      host.id,
      [
        {
          headline: '海底洋葱新闻：SQLite 队列一号',
          promptSummary: '围绕一条国际热点改写成洋葱化插播。',
          body: '小蜗插播一条：有些大场面每次一整齐，就会显得像排练过。',
        },
      ],
      '2026-03-23T11:00:00.000Z',
    );
    assert.equal(imported.items.length, 1);
    const importedId = imported.items[0]?.id ?? null;

    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    try {
      const page = store2.listCommunityBulletins({ published: false });
      assert.equal(page.items.length, 1);
      assert.equal(page.items[0]?.id, importedId);
      assert.equal(page.items[0]?.npcId, 'xiaowo');
      assert.equal(page.items[0]?.anchorKind, 'none');
      assert.match(page.items[0]?.bodyDraft ?? '', /排练过/);
    } finally {
      if (store2 instanceof SqliteGatewayStore) {
        store2.close();
      }
    }
  } finally {
    if (store1 instanceof SqliteGatewayStore) {
      try {
        store1.close();
      } catch {}
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('sqlite backend preserves published imported xiaowo bulletin state and managed actor hiding across restart', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-community-bulletin-publish-'));
  const databasePath = join(tempDir, 'aquaclaw.sqlite');

  const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });

  try {
    const host = store1.bootstrapLocalSession().host;

    store1.updateCommunityCastPolicy({
      hostId: host.id,
      activeWindowStart: null,
      activeWindowEnd: null,
      npcs: {
        xiaowo: {
          minIntervalMinutes: 60,
          activeWindowStart: null,
          activeWindowEnd: null,
        },
      },
    });

    const imported = importXiaowoQueue(
      store1,
      host.id,
      [
        {
          headline: '海底洋葱新闻：SQLite 发布一号',
          promptSummary: '围绕一条国际热点改写成洋葱化播报。',
          body: '小蜗插播一条：这条亮线又把同一段 rumor 带回来了。',
        },
      ],
      '2026-03-23T11:00:00.000Z',
    );
    const published = store1.publishCommunityBulletinCandidate({
      candidateId: imported.items[0]?.id,
      createdAt: '2026-03-23T11:05:00.000Z',
    });
    assert.equal(published.action, 'published');

    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    try {
      const bulletins = store2.listCommunityBulletins({ published: true });
      assert.equal(bulletins.items.length, 1);
      assert.equal(bulletins.items[0]?.publishedAt, '2026-03-23T11:05:00.000Z');
      assert.match(bulletins.items[0]?.bodyDraft ?? '', /同一段 rumor 带回来了/);

      const expressions = store2.listPublicExpressions();
      const xiaowoExpression = expressions.items.find((item) => item.gatewayId === published.expression?.gatewayId) ?? null;
      assert.ok(xiaowoExpression);
      assert.equal(store2.findById(xiaowoExpression!.gatewayId)?.displayName, '小蜗');
      assert.equal(store2.listPublicGateways().items.some((gateway) => gateway.id === xiaowoExpression?.gatewayId), false);
    } finally {
      if (store2 instanceof SqliteGatewayStore) {
        store2.close();
      }
    }
  } finally {
    if (store1 instanceof SqliteGatewayStore) {
      try {
        store1.close();
      } catch {}
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('sqlite backend preserves gateway reconnect credentials across restart', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'gateway-hub-sqlite-reconnect-'));
  const databasePath = join(tempDir, 'aquaclaw.sqlite');

  const store1 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
  const app1 = buildApp({
    store: store1,
    deploymentMode: 'hosted',
    hostedOwnerBootstrapKey: 'hosted-secret',
  });

  try {
    const owner = await app1.inject({
      method: 'POST',
      url: '/api/v1/session/bootstrap-hosted',
      payload: {
        bootstrapKey: 'hosted-secret',
        displayName: 'SQLite Hosted Reconnect Owner',
        handle: 'sqlite-hosted-reconnect-owner',
      },
    });
    assert.equal(owner.statusCode, 201);
    const ownerToken = owner.json().data.credential.token as string;

    const policy = await app1.inject({
      method: 'PATCH',
      url: '/api/v1/registration-policy',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { policy: 'open' },
    });
    assert.equal(policy.statusCode, 200);

    const register = await app1.inject({
      method: 'POST',
      url: '/api/v1/gateways/register',
      payload: {
        displayName: 'SQLite Reconnect Gateway',
        handle: 'sqlite-reconnect-gateway',
      },
    });
    assert.equal(register.statusCode, 201);
    const gatewayToken = register.json().data.credential.token as string;

    const rotate = await app1.inject({
      method: 'POST',
      url: '/api/v1/runtime/remote/reconnect-credential/rotate',
      headers: { authorization: `Bearer ${gatewayToken}` },
    });
    assert.equal(rotate.statusCode, 200);
    const reconnectCode = rotate.json().data.reconnectCredential.token as string;

    await app1.close();
    if (store1 instanceof SqliteGatewayStore) {
      store1.close();
    }

    const store2 = createGatewayStore({ backend: 'sqlite', databaseUrl: databasePath });
    const app2 = buildApp({
      store: store2,
      deploymentMode: 'hosted',
      hostedOwnerBootstrapKey: 'hosted-secret',
    });

    try {
      const reconnect = await app2.inject({
        method: 'POST',
        url: '/api/v1/runtime/remote/reconnect-by-code',
        payload: {
          reconnectCode,
        },
      });
      assert.equal(reconnect.statusCode, 200);
      const reauthedToken = reconnect.json().data.credential.token as string;
      assert.equal(reconnect.json().data.gateway.handle, 'sqlite-reconnect-gateway');

      const staleMe = await app2.inject({
        method: 'GET',
        url: '/api/v1/gateways/me',
        headers: { authorization: `Bearer ${gatewayToken}` },
      });
      assert.equal(staleMe.statusCode, 401);

      const reauthedMe = await app2.inject({
        method: 'GET',
        url: '/api/v1/gateways/me',
        headers: { authorization: `Bearer ${reauthedToken}` },
      });
      assert.equal(reauthedMe.statusCode, 200);
      assert.equal(reauthedMe.json().data.gateway.handle, 'sqlite-reconnect-gateway');
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
