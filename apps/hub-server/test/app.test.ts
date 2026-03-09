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

test('public gateway profile can be fetched without auth', async () => {
  const app = buildApp();

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Public Claw',
      handle: 'public-claw',
      visibility: 'public',
    },
  });

  const gatewayId = registerResponse.json().data.gateway.id as string;
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${gatewayId}`,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.gateway.handle, 'public-claw');
  await app.close();
});

test('private gateway profile is only visible to itself', async () => {
  const app = buildApp();

  const privateRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Private Claw',
      handle: 'private-claw',
      visibility: 'private',
    },
  });

  const privateGateway = privateRegister.json().data.gateway;
  const privateToken = privateRegister.json().data.credential.token as string;

  const otherRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Other Claw',
      handle: 'other-claw',
      visibility: 'public',
    },
  });

  const otherToken = otherRegister.json().data.credential.token as string;

  const forbiddenResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${privateGateway.id}`,
    headers: { authorization: `Bearer ${otherToken}` },
  });
  assert.equal(forbiddenResponse.statusCode, 403);

  const selfResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${privateGateway.id}`,
    headers: { authorization: `Bearer ${privateToken}` },
  });
  assert.equal(selfResponse.statusCode, 200);
  assert.equal(selfResponse.json().data.gateway.handle, 'private-claw');

  await app.close();
});

test('search returns public gateways and self only, with query filtering', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Alpha Search',
      handle: 'alpha-search',
      bio: 'likes coding and travel',
      visibility: 'invite_only',
    },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Beta Public',
      handle: 'beta-public',
      bio: 'public gateway',
      visibility: 'public',
    },
  });

  await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Gamma Private',
      handle: 'gamma-private',
      bio: 'hidden gateway',
      visibility: 'private',
    },
  });

  const searchResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=a',
    headers: { authorization: `Bearer ${alphaToken}` },
  });

  assert.equal(searchResponse.statusCode, 200);
  assert.deepEqual(
    searchResponse.json().data.items.map((item: { handle: string }) => item.handle),
    ['alpha-search', 'beta-public'],
  );
  assert.equal(searchResponse.json().data.items[0].status, 'offline');
  assert.deepEqual(searchResponse.json().data.items[0].tags, []);

  const filteredResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=public&limit=1',
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(filteredResponse.statusCode, 200);
  assert.equal(filteredResponse.json().data.items.length, 1);
  assert.equal(filteredResponse.json().data.items[0].handle, 'beta-public');

  await app.close();
});

test('friend request can be created and listed in outgoing/incoming views', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Alpha',
      handle: 'alpha',
      visibility: 'public',
    },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Beta',
      handle: 'beta',
      visibility: 'public',
    },
  });
  const betaGatewayId = betaRegister.json().data.gateway.id as string;
  const betaToken = betaRegister.json().data.credential.token as string;

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: {
      toGatewayId: betaGatewayId,
      message: 'let our gateways connect',
    },
  });

  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.json().data.request.fromGateway.handle, 'alpha');
  assert.equal(createResponse.json().data.request.toGateway.handle, 'beta');

  const outgoingResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/friend-requests/outgoing',
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(outgoingResponse.statusCode, 200);
  assert.equal(outgoingResponse.json().data.items.length, 1);
  assert.equal(outgoingResponse.json().data.items[0].toGateway.handle, 'beta');

  const incomingResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/friend-requests/incoming',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(incomingResponse.statusCode, 200);
  assert.equal(incomingResponse.json().data.items.length, 1);
  assert.equal(incomingResponse.json().data.items[0].fromGateway.handle, 'alpha');

  await app.close();
});

test('friend request rejects duplicates and self-targeting', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Alpha',
      handle: 'alpha-dup',
    },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Beta',
      handle: 'beta-dup',
    },
  });
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const firstResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  assert.equal(firstResponse.statusCode, 201);

  const duplicateResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  assert.equal(duplicateResponse.statusCode, 409);
  assert.equal(duplicateResponse.json().error.code, 'pending_request_exists');

  const selfResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: alphaGatewayId },
  });
  assert.equal(selfResponse.statusCode, 400);
  assert.equal(selfResponse.json().error.message, 'cannot friend request yourself');

  await app.close();
});

test('friend request can be accepted and creates friendship visible in friends list', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Accept', handle: 'alpha-accept' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Accept', handle: 'beta-accept' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const requestResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = requestResponse.json().data.request.id as string;

  const acceptResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(acceptResponse.statusCode, 200);
  assert.equal(acceptResponse.json().data.request.status, 'accepted');

  const alphaFriends = await app.inject({
    method: 'GET',
    url: '/api/v1/friends',
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(alphaFriends.statusCode, 200);
  assert.equal(alphaFriends.json().data.items.length, 1);
  assert.equal(alphaFriends.json().data.items[0].handle, 'beta-accept');

  const betaFriends = await app.inject({
    method: 'GET',
    url: '/api/v1/friends',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(betaFriends.statusCode, 200);
  assert.equal(betaFriends.json().data.items.length, 1);
  assert.equal(betaFriends.json().data.items[0].handle, 'alpha-accept');

  const incomingAfterAccept = await app.inject({
    method: 'GET',
    url: '/api/v1/friend-requests/incoming',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(incomingAfterAccept.json().data.items.length, 0);

  await app.close();
});

test('friend request can be rejected by recipient only', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Reject', handle: 'alpha-reject' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Reject', handle: 'beta-reject' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const requestResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = requestResponse.json().data.request.id as string;

  const forbiddenReject = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/reject`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(forbiddenReject.statusCode, 403);

  const rejectResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/reject`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(rejectResponse.statusCode, 200);
  assert.equal(rejectResponse.json().data.request.status, 'rejected');

  const betaIncoming = await app.inject({
    method: 'GET',
    url: '/api/v1/friend-requests/incoming',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(betaIncoming.json().data.items.length, 0);

  await app.close();
});
