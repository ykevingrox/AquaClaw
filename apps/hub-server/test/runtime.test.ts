import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/app.js';

async function bootstrapLocalSession(app: ReturnType<typeof buildApp>) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-local',
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

test('local runtime bind creates a stable binding and get returns its summary', async () => {
  const app = buildApp();
  const owner = await bootstrapLocalSession(app);

  const bind = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/local/bind',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      installationId: 'sizhi-macbook',
      runtimeId: 'openclaw-main',
      label: 'Sizhi Local Claw',
      source: 'test_bind',
      metadata: {
        host: 'macbook',
      },
    },
  });
  assert.equal(bind.statusCode, 201);
  assert.equal(bind.json().data.created, true);
  assert.equal(bind.json().data.runtime.runtimeId, 'openclaw-main');
  assert.equal(bind.json().data.runtime.installationId, 'sizhi-macbook');
  assert.equal(bind.json().data.runtime.status, 'offline');
  assert.equal(bind.json().data.gateway.id, owner.gateway.id);

  const get = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/local',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().data.runtime.runtimeId, 'openclaw-main');
  assert.equal(get.json().data.runtime.label, 'Sizhi Local Claw');
  assert.equal(get.json().data.presence.status, 'offline');

  await app.close();
});

test('local runtime heartbeat updates runtime status and owner gateway presence', async () => {
  const app = buildApp();
  const owner = await bootstrapLocalSession(app);

  const bind = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/local/bind',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(bind.statusCode, 201);

  const heartbeat = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/local/heartbeat',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      connectionType: 'openclaw_local',
      metadata: {
        source: 'runtime-test',
      },
    },
  });
  assert.equal(heartbeat.statusCode, 200);
  assert.equal(heartbeat.json().data.runtime.status, 'online');
  assert.equal(heartbeat.json().data.presence.status, 'online');
  assert.equal(heartbeat.json().data.connectionType, 'openclaw_local');
  assert.equal(typeof heartbeat.json().data.runtime.lastHeartbeatAt, 'string');

  const get = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/local',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().data.runtime.status, 'online');
  assert.equal(get.json().data.presence.status, 'online');

  await app.close();
});

test('local runtime endpoints require a local owner session instead of a manual bearer token', async () => {
  const app = buildApp();

  const register = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Manual Runtime Gateway',
      handle: 'manual-runtime-gateway',
    },
  });
  assert.equal(register.statusCode, 201);
  const token = register.json().data.credential.token as string;

  for (const [method, url] of [
    ['GET', '/api/v1/runtime/local'],
    ['POST', '/api/v1/runtime/local/bind'],
    ['POST', '/api/v1/runtime/local/heartbeat'],
  ] as const) {
    const response = await app.inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.equal(response.statusCode, 401);
  }

  await app.close();
});
