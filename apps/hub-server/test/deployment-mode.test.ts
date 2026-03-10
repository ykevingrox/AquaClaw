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

const hostedOnlyEndpoints = [
  { method: 'POST', url: '/api/v1/session/bootstrap-hosted' },
  { method: 'GET', url: '/api/v1/session/hosted/me' },
  { method: 'POST', url: '/api/v1/session/hosted/logout' },
  { method: 'POST', url: '/api/v1/session/hosted/revoke' },
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

test('local mode rejects hosted-only endpoints with a consistent hosted_mode_only error', async () => {
  const app = buildApp({ deploymentMode: 'local' });

  for (const endpoint of hostedOnlyEndpoints) {
    const response = await app.inject({
      method: endpoint.method,
      url: endpoint.url,
    });

    assert.equal(response.statusCode, 403, endpoint.url);
    assert.deepEqual(response.json(), {
      ok: false,
      error: {
        code: 'hosted_mode_only',
        message: 'endpoint is only available in hosted deployment mode',
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

test('hosted bootstrap requires configured key and supports hosted session lifecycle', async () => {
  const appWithoutKey = buildApp({ deploymentMode: 'hosted' });

  const notConfigured = await appWithoutKey.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'anything',
    },
  });
  assert.equal(notConfigured.statusCode, 503);
  assert.equal(notConfigured.json().error.code, 'hosted_bootstrap_not_configured');

  await appWithoutKey.close();

  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const missingKey = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {},
  });
  assert.equal(missingKey.statusCode, 401);
  assert.equal(missingKey.json().error.message, 'bootstrapKey is required');

  const wrongKey = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'wrong',
    },
  });
  assert.equal(wrongKey.statusCode, 401);
  assert.equal(wrongKey.json().error.message, 'invalid bootstrapKey');

  const firstBootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-secret',
      displayName: 'Hosted Owner',
      handle: 'hosted-owner-seeded',
    },
  });
  assert.equal(firstBootstrap.statusCode, 201);
  assert.equal(firstBootstrap.json().data.owner.created, true);
  assert.equal(firstBootstrap.json().data.credential.kind, 'hosted_session');

  const firstToken = firstBootstrap.json().data.credential.token as string;
  const hostedMe = await app.inject({
    method: 'GET',
    url: '/api/v1/session/hosted/me',
    headers: {
      authorization: `Bearer ${firstToken}`,
    },
  });
  assert.equal(hostedMe.statusCode, 200);
  assert.equal(hostedMe.json().data.gateway.id, firstBootstrap.json().data.gateway.id);

  const secondBootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-secret',
    },
  });
  assert.equal(secondBootstrap.statusCode, 200);
  assert.equal(secondBootstrap.json().data.owner.created, false);
  assert.equal(secondBootstrap.json().data.gateway.id, firstBootstrap.json().data.gateway.id);

  const secondToken = secondBootstrap.json().data.credential.token as string;
  assert.notEqual(secondToken, firstToken);

  const logout = await app.inject({
    method: 'POST',
    url: '/api/v1/session/hosted/logout',
    headers: {
      authorization: `Bearer ${secondToken}`,
    },
  });
  assert.equal(logout.statusCode, 200);
  assert.equal(logout.json().data.loggedOut, true);

  const afterLogout = await app.inject({
    method: 'GET',
    url: '/api/v1/session/hosted/me',
    headers: {
      authorization: `Bearer ${secondToken}`,
    },
  });
  assert.equal(afterLogout.statusCode, 401);

  const thirdBootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-secret',
    },
  });
  assert.equal(thirdBootstrap.statusCode, 200);
  const thirdToken = thirdBootstrap.json().data.credential.token as string;

  const invalidRevokePayload = await app.inject({
    method: 'POST',
    url: '/api/v1/session/hosted/revoke',
    headers: {
      authorization: `Bearer ${thirdToken}`,
    },
    payload: {
      revokeCurrent: 'yes',
    },
  });
  assert.equal(invalidRevokePayload.statusCode, 400);

  const revokeOthers = await app.inject({
    method: 'POST',
    url: '/api/v1/session/hosted/revoke',
    headers: {
      authorization: `Bearer ${thirdToken}`,
    },
  });
  assert.equal(revokeOthers.statusCode, 200);
  assert.equal(revokeOthers.json().data.revokedCount, 1);
  assert.equal(revokeOthers.json().data.currentSessionRevoked, false);

  const firstAfterRevoke = await app.inject({
    method: 'GET',
    url: '/api/v1/session/hosted/me',
    headers: {
      authorization: `Bearer ${firstToken}`,
    },
  });
  assert.equal(firstAfterRevoke.statusCode, 401);

  const thirdStillValid = await app.inject({
    method: 'GET',
    url: '/api/v1/session/hosted/me',
    headers: {
      authorization: `Bearer ${thirdToken}`,
    },
  });
  assert.equal(thirdStillValid.statusCode, 200);

  const revokeCurrent = await app.inject({
    method: 'POST',
    url: '/api/v1/session/hosted/revoke',
    headers: {
      authorization: `Bearer ${thirdToken}`,
    },
    payload: {
      revokeCurrent: true,
    },
  });
  assert.equal(revokeCurrent.statusCode, 200);
  assert.equal(revokeCurrent.json().data.revokedCount, 1);
  assert.equal(revokeCurrent.json().data.currentSessionRevoked, true);

  const thirdAfterRevokeCurrent = await app.inject({
    method: 'GET',
    url: '/api/v1/session/hosted/me',
    headers: {
      authorization: `Bearer ${thirdToken}`,
    },
  });
  assert.equal(thirdAfterRevokeCurrent.statusCode, 401);

  await app.close();
});

test('hosted owner session gate protects owner-only hosted-session/current/audit/system feed/stream/invite endpoints from gateway tokens', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const hostedBootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-secret',
    },
  });
  assert.equal(hostedBootstrap.statusCode, 201);
  const ownerToken = hostedBootstrap.json().data.credential.token as string;

  const register = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Guest',
      handle: 'hosted-guest',
    },
  });
  assert.equal(register.statusCode, 201);
  const guestToken = register.json().data.credential.token as string;

  const forbiddenHostedMe = await app.inject({
    method: 'GET',
    url: '/api/v1/session/hosted/me',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(forbiddenHostedMe.statusCode, 403);
  assert.equal(forbiddenHostedMe.json().error.code, 'forbidden');

  const forbiddenHostedLogout = await app.inject({
    method: 'POST',
    url: '/api/v1/session/hosted/logout',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(forbiddenHostedLogout.statusCode, 403);
  assert.equal(forbiddenHostedLogout.json().error.code, 'forbidden');

  const forbiddenHostedRevoke = await app.inject({
    method: 'POST',
    url: '/api/v1/session/hosted/revoke',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(forbiddenHostedRevoke.statusCode, 403);
  assert.equal(forbiddenHostedRevoke.json().error.code, 'forbidden');

  const forbiddenCurrent = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
    payload: {
      key: 'hosted-owner-current',
      label: 'Hosted Owner Current',
      summary: 'Only hosted owner session can set this.',
      tone: 'calm',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 60_000).toISOString(),
    },
  });
  assert.equal(forbiddenCurrent.statusCode, 403);
  assert.equal(forbiddenCurrent.json().error.code, 'forbidden');

  const ownerCurrent = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      key: 'hosted-owner-current',
      label: 'Hosted Owner Current',
      summary: 'Only hosted owner session can set this.',
      tone: 'calm',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 60_000).toISOString(),
    },
  });
  assert.equal(ownerCurrent.statusCode, 201);

  const forbiddenAudit = await app.inject({
    method: 'GET',
    url: '/api/v1/audit',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(forbiddenAudit.statusCode, 403);
  assert.equal(forbiddenAudit.json().error.code, 'forbidden');

  const ownerAudit = await app.inject({
    method: 'GET',
    url: '/api/v1/audit',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(ownerAudit.statusCode, 200);

  const forbiddenSystemFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=system',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(forbiddenSystemFeed.statusCode, 403);
  assert.equal(forbiddenSystemFeed.json().error.code, 'forbidden');

  const ownerSystemFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=system',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(ownerSystemFeed.statusCode, 200);

  const ownerAllFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=all',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(ownerAllFeed.statusCode, 200);
  assert.equal(ownerAllFeed.json().data.items.some((item: { visibility: string }) => item.visibility === 'system'), true);

  const guestAllFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=all',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(guestAllFeed.statusCode, 200);
  assert.equal(guestAllFeed.json().data.items.some((item: { visibility: string }) => item.visibility === 'system'), false);

  const forbiddenStream = await app.inject({
    method: 'GET',
    url: '/api/v1/stream/sea',
    headers: {
      authorization: `Bearer ${guestToken}`,
      accept: 'text/event-stream',
    },
  });
  assert.equal(forbiddenStream.statusCode, 403);
  assert.equal(forbiddenStream.json().error.code, 'forbidden');

  const forbiddenInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
    payload: {
      maxUses: 1,
    },
  });
  assert.equal(forbiddenInvite.statusCode, 403);
  assert.equal(forbiddenInvite.json().error.code, 'forbidden');

  const ownerInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      maxUses: 2,
    },
  });
  assert.equal(ownerInvite.statusCode, 201);
  assert.equal(ownerInvite.json().data.invite.maxUses, 2);

  await app.close();
});
