import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/app.js';

async function bootstrapLocalSession(
  app: ReturnType<typeof buildApp>,
  payload?: { displayName?: string; handle?: string; bio?: string; visibility?: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-local',
    payload,
  });

  return {
    response,
    json: response.json() as {
      ok: boolean;
      data: {
        gateway: {
          id: string;
          handle: string;
          displayName: string;
          bio: string;
          visibility: string;
        };
        session: {
          id: string;
          gatewayId: string;
          createdAt: string;
          kind: string;
        };
        credential: {
          token: string;
          kind: string;
        };
        owner: {
          isPrimary: boolean;
          created: boolean;
        };
      };
    },
  };
}

test('local session bootstrap creates a stable owner gateway and supports session-first auth', async () => {
  const app = buildApp();

  const bootstrap = await bootstrapLocalSession(app);
  assert.equal(bootstrap.response.statusCode, 201);
  assert.equal(bootstrap.json.data.owner.created, true);
  assert.equal(bootstrap.json.data.owner.isPrimary, true);
  assert.equal(bootstrap.json.data.gateway.handle, 'my-claw');
  assert.equal(bootstrap.json.data.gateway.displayName, 'My Claw');
  assert.equal(bootstrap.json.data.session.gatewayId, bootstrap.json.data.gateway.id);
  assert.equal(bootstrap.json.data.credential.kind, 'local_session');

  const sessionMe = await app.inject({
    method: 'GET',
    url: '/api/v1/session/me',
    headers: {
      authorization: `Bearer ${bootstrap.json.data.credential.token}`,
    },
  });
  assert.equal(sessionMe.statusCode, 200);
  assert.equal(sessionMe.json().data.gateway.id, bootstrap.json.data.gateway.id);

  const gatewayMe = await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${bootstrap.json.data.credential.token}`,
    },
  });
  assert.equal(gatewayMe.statusCode, 200);
  assert.equal(gatewayMe.json().data.gateway.handle, 'my-claw');

  await app.close();
});

test('repeated local bootstrap reuses the same owner gateway and logout only invalidates the active session', async () => {
  const app = buildApp();

  const first = await bootstrapLocalSession(app, {
    displayName: 'Owner Claw',
    handle: 'owner-claw',
  });
  assert.equal(first.response.statusCode, 201);

  const second = await bootstrapLocalSession(app, {
    displayName: 'Ignored',
    handle: 'ignored',
  });
  assert.equal(second.response.statusCode, 200);
  assert.equal(second.json.data.owner.created, false);
  assert.equal(second.json.data.gateway.id, first.json.data.gateway.id);
  assert.equal(second.json.data.gateway.handle, 'owner-claw');
  assert.notEqual(second.json.data.credential.token, first.json.data.credential.token);

  const logout = await app.inject({
    method: 'POST',
    url: '/api/v1/session/logout',
    headers: {
      authorization: `Bearer ${second.json.data.credential.token}`,
    },
  });
  assert.equal(logout.statusCode, 200);
  assert.equal(logout.json().data.loggedOut, true);

  const secondSessionMe = await app.inject({
    method: 'GET',
    url: '/api/v1/session/me',
    headers: {
      authorization: `Bearer ${second.json.data.credential.token}`,
    },
  });
  assert.equal(secondSessionMe.statusCode, 401);

  const firstGatewayMe = await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${first.json.data.credential.token}`,
    },
  });
  assert.equal(firstGatewayMe.statusCode, 200);
  assert.equal(firstGatewayMe.json().data.gateway.id, first.json.data.gateway.id);

  const third = await bootstrapLocalSession(app);
  assert.equal(third.response.statusCode, 200);
  assert.equal(third.json.data.gateway.id, first.json.data.gateway.id);

  await app.close();
});

test('local session endpoints reject manual bearer tokens', async () => {
  const app = buildApp();

  const register = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Manual Dev Gateway',
      handle: 'manual-dev-gateway',
    },
  });
  assert.equal(register.statusCode, 201);
  const token = register.json().data.credential.token as string;

  const sessionMe = await app.inject({
    method: 'GET',
    url: '/api/v1/session/me',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(sessionMe.statusCode, 401);

  const logout = await app.inject({
    method: 'POST',
    url: '/api/v1/session/logout',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(logout.statusCode, 401);

  await app.close();
});
