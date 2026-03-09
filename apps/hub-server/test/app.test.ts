import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

test('health endpoint returns ok', async () => {
  const app = buildApp();
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    data: { status: 'ok' },
  });
  await app.close();
});

test('register issues token and me returns gateway', async () => {
  const app = buildApp();

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Claw @ Sizhi',
      handle: 'claw-sizhi',
      bio: 'local-first assistant',
      visibility: 'invite_only',
    },
  });

  assert.equal(registerResponse.statusCode, 201);
  const registerJson = registerResponse.json();
  assert.equal(registerJson.ok, true);
  assert.equal(typeof registerJson.data.credential.token, 'string');

  const meResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${registerJson.data.credential.token}`,
    },
  });

  assert.equal(meResponse.statusCode, 200);
  const meJson = meResponse.json();
  assert.equal(meJson.ok, true);
  assert.equal(meJson.data.gateway.handle, 'claw-sizhi');
  await app.close();
});

test('patch /api/v1/gateways/me updates allowed profile fields only', async () => {
  const app = buildApp();

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Claw @ Sizhi',
      handle: 'claw-sizhi',
      bio: 'local-first assistant',
      visibility: 'invite_only',
    },
  });

  const token = registerResponse.json().data.credential.token as string;
  const before = (await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: { authorization: `Bearer ${token}` },
  })).json().data.gateway;

  const updateResponse = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      displayName: 'Claw Hub',
      bio: 'updated bio',
      visibility: 'public',
    },
  });

  assert.equal(updateResponse.statusCode, 200);
  const updatedGateway = updateResponse.json().data.gateway;
  assert.equal(updatedGateway.displayName, 'Claw Hub');
  assert.equal(updatedGateway.bio, 'updated bio');
  assert.equal(updatedGateway.visibility, 'public');
  assert.equal(updatedGateway.handle, before.handle);
  assert.equal(updatedGateway.id, before.id);
  assert.equal(updatedGateway.createdAt, before.createdAt);
  assert.notEqual(updatedGateway.updatedAt, before.updatedAt);

  await app.close();
});

test('patch /api/v1/gateways/me rejects unauthorized requests', async () => {
  const app = buildApp();

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    payload: {
      displayName: 'Nope',
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().ok, false);
  await app.close();
});

test('patch /api/v1/gateways/me rejects invalid visibility', async () => {
  const app = buildApp();

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Claw @ Sizhi',
      handle: 'claw-sizhi',
    },
  });

  const token = registerResponse.json().data.credential.token as string;
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      visibility: 'friends-of-friends',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().ok, false);
  assert.equal(response.json().error.message, 'invalid visibility');
  await app.close();
});
