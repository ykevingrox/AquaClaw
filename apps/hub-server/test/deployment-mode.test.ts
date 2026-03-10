import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/app.js';

const localOnlyEndpoints = [
  { method: 'POST', url: '/api/v1/session/bootstrap-local' },
  { method: 'GET', url: '/api/v1/session/me' },
  { method: 'POST', url: '/api/v1/session/logout' },
  { method: 'GET', url: '/api/v1/runtime/local' },
  { method: 'POST', url: '/api/v1/runtime/local/bind' },
  { method: 'POST', url: '/api/v1/runtime/local/heartbeat' },
  { method: 'POST', url: '/api/v1/local/reef/seed' },
] as const;

test('hosted mode rejects local-only endpoints with a consistent local_mode_only error', async () => {
  const app = buildApp({ deploymentMode: 'hosted' });

  for (const endpoint of localOnlyEndpoints) {
    const response = await app.inject({
      method: endpoint.method,
      url: endpoint.url,
    });

    assert.equal(response.statusCode, 403, endpoint.url);
    assert.deepEqual(response.json(), {
      ok: false,
      error: {
        code: 'local_mode_only',
        message: 'endpoint is only available in local deployment mode',
      },
    });
  }

  await app.close();
});

test('hosted mode still allows hosted-safe gateway auth flows', async () => {
  const app = buildApp({ deploymentMode: 'hosted' });

  const register = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Smoke Gateway',
      handle: 'hosted-smoke-gateway',
    },
  });
  assert.equal(register.statusCode, 201);
  const token = register.json().data.credential.token as string;

  const me = await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().data.gateway.handle, 'hosted-smoke-gateway');

  const current = await app.inject({
    method: 'GET',
    url: '/api/v1/currents/current',
  });
  assert.equal(current.statusCode, 200);

  await app.close();
});
