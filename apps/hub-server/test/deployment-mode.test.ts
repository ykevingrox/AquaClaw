import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/app.js';

function buildActiveCurrentWindow(durationMinutes = 2 * 60) {
  return {
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + durationMinutes * 60_000).toISOString(),
  };
}

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
  { method: 'PATCH', url: '/api/v1/registration-policy' },
  { method: 'POST', url: '/api/v1/runtime/remote/join-by-invite' },
  { method: 'POST', url: '/api/v1/runtime/remote/reconnect-by-code' },
  { method: 'GET', url: '/api/v1/runtime/remote/me' },
  { method: 'GET', url: '/api/v1/runtime/remote/reconnect-credential' },
  { method: 'POST', url: '/api/v1/runtime/remote/reconnect-credential/rotate' },
  { method: 'POST', url: '/api/v1/runtime/remote/bridge-credentials' },
  { method: 'POST', url: '/api/v1/runtime/remote/bridge-credentials/remote-bridge-id/revoke' },
  { method: 'POST', url: '/api/v1/runtime/remote/bind' },
  { method: 'POST', url: '/api/v1/runtime/remote/heartbeat' },
] as const;

async function bootstrapHostedOwner(app: ReturnType<typeof buildApp>, handle = 'hosted-owner-deployment') {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-secret',
      handle,
    },
  });
  assert.equal(response.statusCode, 201);
  return response.json().data as {
    host: {
      id: string;
      handle: string;
    };
    credential: {
      token: string;
    };
  };
}

async function setHostedRegistrationPolicy(
  app: ReturnType<typeof buildApp>,
  ownerToken: string,
  policy: 'open' | 'closed' | 'invite_only',
) {
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/registration-policy',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      policy,
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.policy, policy);
}

function assertRateLimited(
  response: {
    statusCode: number;
    json(): unknown;
    headers: Record<string, string | number | string[] | undefined>;
  },
) {
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['retry-after'], '60');
  assert.deepEqual(response.json(), {
    ok: false,
    error: {
      code: 'rate_limited',
      message: 'rate limit exceeded',
      retryAfterSeconds: 60,
    },
  });
}

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

test('hosted registration defaults invite-only until the owner opens it, and hosted-safe gateway auth flows continue afterward', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const blockedRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Smoke Gateway',
      handle: 'hosted-smoke-gateway',
    },
  });
  assert.equal(blockedRegister.statusCode, 403);
  assert.equal(blockedRegister.json().error.code, 'registration_invite_only');

  const owner = await bootstrapHostedOwner(app, 'hosted-open-registration-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

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

test('hosted mode keeps public aquarium endpoints anonymous while exposing non-host participants and observer-safe dynamics', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-public-aquarium-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const publicRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Public',
      handle: 'hosted-public',
      visibility: 'public',
    },
  });
  assert.equal(publicRegister.statusCode, 201);

  const privateRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Private',
      handle: 'hosted-private',
      visibility: 'invite_only',
    },
  });
  assert.equal(privateRegister.statusCode, 201);

  const currentWrite = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      key: 'hosted-surface',
      label: 'Hosted Surface',
      summary: 'A readable public hosted current.',
      tone: 'playful',
      sceneHint: 'surface',
      ...buildActiveCurrentWindow(),
    },
  });
  assert.equal(currentWrite.statusCode, 201);

  const environmentWrite = await app.inject({
    method: 'POST',
    url: '/api/v1/environment',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      waterTemperatureC: 20,
      clarity: 'hazy',
      tideDirection: 'outgoing',
      surfaceState: 'rippled',
      phenomenon: 'warm_bloom',
    },
  });
  assert.equal(environmentWrite.statusCode, 201);

  const current = await app.inject({
    method: 'GET',
    url: '/api/v1/public/current',
  });
  assert.equal(current.statusCode, 200);
  assert.equal(current.json().data.current.label, 'Hosted Surface');

  const environment = await app.inject({
    method: 'GET',
    url: '/api/v1/public/environment',
  });
  assert.equal(environment.statusCode, 200);
  assert.equal(environment.json().data.environment.phenomenon, 'warm_bloom');

  const gateways = await app.inject({
    method: 'GET',
    url: '/api/v1/public/gateways',
  });
  assert.equal(gateways.statusCode, 200);
  assert.deepEqual(
    gateways.json().data.items.map((item: { handle: string }) => item.handle).sort(),
    ['hosted-private', 'hosted-public'],
  );

  const feed = await app.inject({
    method: 'GET',
    url: '/api/v1/public/feed',
  });
  assert.equal(feed.statusCode, 200);
  const itemTypes = new Set(feed.json().data.items.map((item: { type: string }) => item.type));
  assert.equal(itemTypes.has('current.changed'), true);
  assert.equal(itemTypes.has('environment.changed'), true);
  assert.equal(itemTypes.has('gateway.registered'), true);
  assert.equal(
    feed.json().data.items.some((item: { gateway: { handle: string } | null }) => item.gateway?.handle === 'hosted-public-aquarium-owner'),
    false,
  );

  await app.close();
});

test('hosted registration policy is owner-session-only and supports open, closed, and invite-only states', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-registration-policy-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const guestRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Registration Guest',
      handle: 'hosted-registration-guest',
    },
  });
  assert.equal(guestRegister.statusCode, 201);
  const guestToken = guestRegister.json().data.credential.token as string;

  const forbiddenGuestPatch = await app.inject({
    method: 'PATCH',
    url: '/api/v1/registration-policy',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
    payload: {
      policy: 'closed',
    },
  });
  assert.equal(forbiddenGuestPatch.statusCode, 403);
  assert.equal(forbiddenGuestPatch.json().error.code, 'forbidden');

  await setHostedRegistrationPolicy(app, owner.credential.token, 'closed');

  const closedRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Closed Hosted Guest',
      handle: 'closed-hosted-guest',
    },
  });
  assert.equal(closedRegister.statusCode, 403);
  assert.equal(closedRegister.json().error.code, 'registration_closed');

  await setHostedRegistrationPolicy(app, owner.credential.token, 'invite_only');

  const inviteOnlyRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Invite Only Hosted Guest',
      handle: 'invite-only-hosted-guest',
    },
  });
  assert.equal(inviteOnlyRegister.statusCode, 403);
  assert.equal(inviteOnlyRegister.json().error.code, 'registration_invite_only');

  await app.close();
});

test('hosted invite join lets a remote gateway enter and bind without opening global registration', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const blockedRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Blocked Hosted Join Register',
      handle: 'blocked-hosted-join-register',
    },
  });
  assert.equal(blockedRegister.statusCode, 403);
  assert.equal(blockedRegister.json().error.code, 'registration_invite_only');

  const owner = await bootstrapHostedOwner(app, 'hosted-join-by-invite-owner');
  const ownerToken = owner.credential.token;

  const inviteResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      maxUses: 1,
    },
  });
  assert.equal(inviteResponse.statusCode, 201);
  const inviteCode = inviteResponse.json().data.invite.code as string;

  const joined = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/join-by-invite',
    payload: {
      inviteCode,
      displayName: 'Hosted Join Invite Gateway',
      handle: 'hosted-join-invite-gateway',
      installationId: 'hosted-join-installation',
      runtimeId: 'hosted-join-runtime',
      label: 'Hosted Join Runtime',
      source: 'deployment_test_join',
      metadata: {
        region: 'apac',
      },
    },
  });
  assert.equal(joined.statusCode, 201);
  const joinedToken = joined.json().data.credential.token as string;
  const reconnectCode = joined.json().data.reconnectCredential.token as string;
  assert.equal(joined.json().data.gateway.handle, 'hosted-join-invite-gateway');
  assert.equal(typeof reconnectCode, 'string');
  assert.equal(joined.json().data.runtime.runtime.runtimeId, 'hosted-join-runtime');
  assert.equal(joined.json().data.runtime.runtime.installationId, 'hosted-join-installation');
  assert.equal(joined.json().data.runtime.runtime.metadata.region, 'apac');
  assert.equal(joined.json().data.runtime.runtime.source, 'deployment_test_join');
  assert.equal(joined.json().data.runtime.runtime.status, 'offline');
  assert.equal(joined.json().data.runtime.presence.status, 'offline');
  assert.equal(joined.json().data.friendRequest, null);
  assert.equal(joined.json().data.reusedGateway, false);

  const reconnectCredential = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/remote/reconnect-credential',
    headers: {
      authorization: `Bearer ${joinedToken}`,
    },
  });
  assert.equal(reconnectCredential.statusCode, 200);
  assert.equal(reconnectCredential.json().data.reconnectCredential.token, reconnectCode);

  const ownerReconnectCredentialAttempt = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/remote/reconnect-credential',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(ownerReconnectCredentialAttempt.statusCode, 403);
  assert.equal(ownerReconnectCredentialAttempt.json().error.code, 'forbidden');

  const rotatedReconnectCredential = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/reconnect-credential/rotate',
    headers: {
      authorization: `Bearer ${joinedToken}`,
    },
  });
  assert.equal(rotatedReconnectCredential.statusCode, 200);
  const rotatedReconnectCode = rotatedReconnectCredential.json().data.reconnectCredential.token as string;
  assert.notEqual(rotatedReconnectCode, reconnectCode);

  const staleReconnectAttempt = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/reconnect-by-code',
    payload: {
      reconnectCode,
    },
  });
  assert.equal(staleReconnectAttempt.statusCode, 404);
  assert.equal(staleReconnectAttempt.json().error.code, 'not_found');

  const reauthed = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/reconnect-by-code',
    payload: {
      reconnectCode: rotatedReconnectCode,
    },
  });
  assert.equal(reauthed.statusCode, 200);
  const reauthedToken = reauthed.json().data.credential.token as string;
  assert.equal(reauthed.json().data.gateway.handle, 'hosted-join-invite-gateway');
  assert.equal(reauthed.json().data.runtime.runtime.runtimeId, 'hosted-join-runtime');

  const oldTokenRejected = await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${joinedToken}`,
    },
  });
  assert.equal(oldTokenRejected.statusCode, 401);
  assert.equal(oldTokenRejected.json().error.code, 'unauthorized');

  const remoteMe = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/remote/me',
    headers: {
      authorization: `Bearer ${reauthedToken}`,
    },
  });
  assert.equal(remoteMe.statusCode, 200);
  assert.equal(remoteMe.json().data.runtime.runtimeId, 'hosted-join-runtime');
  assert.equal(remoteMe.json().data.runtime.metadata.region, 'apac');
  assert.equal(remoteMe.json().data.runtime.source, 'deployment_test_join');
  assert.equal(remoteMe.json().data.presence.status, 'offline');

  const inviteReuse = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/join-by-invite',
    payload: {
      inviteCode,
      displayName: 'Hosted Join Invite Gateway Two',
      handle: 'hosted-join-invite-gateway-two',
    },
  });
  assert.equal(inviteReuse.statusCode, 409);
  assert.equal(inviteReuse.json().error.code, 'invalid_state');

  await app.close();
});

test('hosted invite join reuses the same gateway when the installation rejoins with a new invite', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-rejoin-owner');
  const ownerToken = owner.credential.token;

  const firstInviteResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      maxUses: 1,
    },
  });
  assert.equal(firstInviteResponse.statusCode, 201);

  const firstJoin = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/join-by-invite',
    payload: {
      inviteCode: firstInviteResponse.json().data.invite.code,
      displayName: 'Hosted Rejoin Gateway',
      handle: 'hosted-rejoin-gateway',
      installationId: 'hosted-rejoin-installation',
      runtimeId: 'hosted-rejoin-runtime',
      label: 'Hosted Rejoin Runtime',
      source: 'deployment_test_rejoin_first',
    },
  });
  assert.equal(firstJoin.statusCode, 201);
  const firstToken = firstJoin.json().data.credential.token as string;
  const firstGatewayId = firstJoin.json().data.gateway.id as string;

  const secondInviteResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      maxUses: 1,
    },
  });
  assert.equal(secondInviteResponse.statusCode, 201);

  const secondJoin = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/join-by-invite',
    payload: {
      inviteCode: secondInviteResponse.json().data.invite.code,
      displayName: 'Hosted Rejoin Gateway Again',
      handle: 'hosted-rejoin-gateway-again',
      installationId: 'hosted-rejoin-installation',
      runtimeId: 'hosted-rejoin-runtime-updated',
      label: 'Hosted Rejoin Runtime Updated',
      source: 'deployment_test_rejoin_second',
    },
  });
  assert.equal(secondJoin.statusCode, 200);
  assert.equal(secondJoin.json().data.reusedGateway, true);
  assert.equal(secondJoin.json().data.gateway.id, firstGatewayId);
  assert.equal(secondJoin.json().data.gateway.handle, 'hosted-rejoin-gateway');
  assert.equal(secondJoin.json().data.runtime.runtime.runtimeId, 'hosted-rejoin-runtime-updated');
  assert.equal(secondJoin.json().data.runtime.runtime.source, 'deployment_test_rejoin_second');

  const oldTokenRejected = await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${firstToken}`,
    },
  });
  assert.equal(oldTokenRejected.statusCode, 401);

  const secondToken = secondJoin.json().data.credential.token as string;
  const remoteMe = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/remote/me',
    headers: {
      authorization: `Bearer ${secondToken}`,
    },
  });
  assert.equal(remoteMe.statusCode, 200);
  assert.equal(remoteMe.json().data.gateway.id, firstGatewayId);
  assert.equal(remoteMe.json().data.runtime.runtimeId, 'hosted-rejoin-runtime-updated');

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
  assert.equal(hostedMe.json().data.host.id, firstBootstrap.json().data.host.id);

  const secondBootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-secret',
    },
  });
  assert.equal(secondBootstrap.statusCode, 200);
  assert.equal(secondBootstrap.json().data.owner.created, false);
  assert.equal(secondBootstrap.json().data.host.id, firstBootstrap.json().data.host.id);

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

test('hosted mode rate limits bootstrap/register/reconnect/remote bind/heartbeat with a stable 429 contract', async () => {
  const nowMs = Date.parse('2026-03-11T00:00:00.000Z');
  const app = buildApp({
    deploymentMode: 'hosted',
    hostedOwnerBootstrapKey: 'hosted-secret',
    now: () => nowMs,
    hostedRateLimits: {
      bootstrapHosted: { limit: 1, windowMs: 60_000 },
      registerGateway: { limit: 1, windowMs: 60_000 },
      reconnectGateway: { limit: 1, windowMs: 60_000 },
      remoteBind: { limit: 1, windowMs: 60_000 },
      remoteHeartbeat: { limit: 1, windowMs: 60_000 },
    },
  });

  const firstBootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-secret',
      handle: 'hosted-rate-limit-owner',
    },
  });
  assert.equal(firstBootstrap.statusCode, 201);
  const ownerToken = firstBootstrap.json().data.credential.token as string;

  const secondBootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-secret',
      handle: 'hosted-rate-limit-owner',
    },
  });
  assertRateLimited(secondBootstrap);

  await setHostedRegistrationPolicy(app, ownerToken, 'open');

  const firstRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Rate Limit Gateway One',
      handle: 'hosted-rate-limit-gateway-one',
    },
  });
  assert.equal(firstRegister.statusCode, 201);
  const gatewayToken = firstRegister.json().data.credential.token as string;

  const secondRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Rate Limit Gateway Two',
      handle: 'hosted-rate-limit-gateway-two',
    },
  });
  assertRateLimited(secondRegister);

  const firstBridgeCredential = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bridge-credentials',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      label: 'hosted-rate-limit-bridge-one',
    },
  });
  assert.equal(firstBridgeCredential.statusCode, 201);
  const firstBridgeToken = firstBridgeCredential.json().data.credential.token as string;

  const firstBind = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bind',
    headers: {
      authorization: `Bearer ${gatewayToken}`,
    },
    payload: {
      bridgeToken: firstBridgeToken,
      runtimeId: 'hosted-rate-limit-runtime-one',
    },
  });
  assert.equal(firstBind.statusCode, 201);

  const secondBridgeCredential = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bridge-credentials',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      label: 'hosted-rate-limit-bridge-two',
    },
  });
  assert.equal(secondBridgeCredential.statusCode, 201);
  const secondBridgeToken = secondBridgeCredential.json().data.credential.token as string;

  const secondBind = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bind',
    headers: {
      authorization: `Bearer ${gatewayToken}`,
    },
    payload: {
      bridgeToken: secondBridgeToken,
      runtimeId: 'hosted-rate-limit-runtime-two',
    },
  });
  assertRateLimited(secondBind);

  const firstHeartbeat = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/heartbeat',
    headers: {
      authorization: `Bearer ${gatewayToken}`,
    },
    payload: {
      runtimeId: 'hosted-rate-limit-runtime-one',
      connectionType: 'openclaw_remote',
    },
  });
  assert.equal(firstHeartbeat.statusCode, 200);

  const secondHeartbeat = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/heartbeat',
    headers: {
      authorization: `Bearer ${gatewayToken}`,
    },
    payload: {
      runtimeId: 'hosted-rate-limit-runtime-one',
      connectionType: 'openclaw_remote',
    },
  });
  assertRateLimited(secondHeartbeat);

  const reconnectCredential = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/remote/reconnect-credential',
    headers: {
      authorization: `Bearer ${gatewayToken}`,
    },
  });
  assert.equal(reconnectCredential.statusCode, 200);
  const reconnectCode = reconnectCredential.json().data.reconnectCredential.token as string;

  const firstReconnect = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/reconnect-by-code',
    payload: {
      reconnectCode,
    },
  });
  assert.equal(firstReconnect.statusCode, 200);

  const secondReconnect = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/reconnect-by-code',
    payload: {
      reconnectCode,
    },
  });
  assertRateLimited(secondReconnect);

  await app.close();
});

test('local mode leaves shared registration behavior unchanged when hosted limits are configured', async () => {
  const nowMs = Date.parse('2026-03-11T00:00:00.000Z');
  const app = buildApp({
    deploymentMode: 'local',
    now: () => nowMs,
    hostedRateLimits: {
      registerGateway: { limit: 1, windowMs: 60_000 },
    },
  });

  const firstRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Local Rate Limit Gateway One',
      handle: 'local-rate-limit-gateway-one',
    },
  });
  assert.equal(firstRegister.statusCode, 201);

  const secondRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Local Rate Limit Gateway Two',
      handle: 'local-rate-limit-gateway-two',
    },
  });
  assert.equal(secondRegister.statusCode, 201);

  await app.close();
});

test('hosted owner session token stays in the control room instead of masquerading as a gateway', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const hostedBootstrap = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-secret',
      displayName: 'Hosted Owner',
      handle: 'hosted-owner-gateway-surfaces',
    },
  });
  assert.equal(hostedBootstrap.statusCode, 201);

  const ownerHostId = hostedBootstrap.json().data.host.id as string;
  const ownerToken = hostedBootstrap.json().data.credential.token as string;

  const hostedMe = await app.inject({
    method: 'GET',
    url: '/api/v1/session/hosted/me',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(hostedMe.statusCode, 200);
  assert.equal(hostedMe.json().data.host.id, ownerHostId);

  const gatewayMe = await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(gatewayMe.statusCode, 401);

  const updateAqua = await app.inject({
    method: 'PATCH',
    url: '/api/v1/aqua/me',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      displayName: 'Hosted Control Room',
    },
  });
  assert.equal(updateAqua.statusCode, 200);
  assert.equal(updateAqua.json().data.aqua.displayName, 'Hosted Control Room');

  const ownerCurrent = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      key: 'hosted-control-room-current',
      label: 'Hosted Control Room Current',
      summary: 'Hosted owner can still shape the water from shore.',
      tone: 'calm',
      ...buildActiveCurrentWindow(),
    },
  });
  assert.equal(ownerCurrent.statusCode, 201);

  const ownerMineFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=mine',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(ownerMineFeed.statusCode, 200);
  assert.equal(
    ownerMineFeed.json().data.items.some((item: { type: string }) => item.type === 'current.changed'),
    true,
  );

  await app.close();
});

test('hosted owner session token cannot act as gateway identity on hosted social write surfaces', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-owner-social-writes');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Social Alpha',
      handle: 'hosted-social-alpha',
    },
  });
  assert.equal(alphaRegister.statusCode, 201);
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Social Beta',
      handle: 'hosted-social-beta',
    },
  });
  assert.equal(betaRegister.statusCode, 201);
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;
  const betaHandle = betaRegister.json().data.gateway.handle as string;

  const gammaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Social Gamma',
      handle: 'hosted-social-gamma',
    },
  });
  assert.equal(gammaRegister.statusCode, 201);
  const gammaToken = gammaRegister.json().data.credential.token as string;

  const ownerInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      maxUses: 1,
    },
  });
  assert.equal(ownerInvite.statusCode, 201);
  const inviteCode = ownerInvite.json().data.invite.code as string;

  const ownerClaimInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      code: inviteCode,
    },
  });
  assert.equal(ownerClaimInvite.statusCode, 403);
  assert.equal(ownerClaimInvite.json().error.code, 'forbidden');

  const ownerCreateFriendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      toGatewayId: alphaGatewayId,
    },
  });
  assert.equal(ownerCreateFriendRequest.statusCode, 403);
  assert.equal(ownerCreateFriendRequest.json().error.code, 'forbidden');

  const alphaToBetaRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: {
      authorization: `Bearer ${alphaToken}`,
    },
    payload: {
      toGatewayId: betaGatewayId,
    },
  });
  assert.equal(alphaToBetaRequest.statusCode, 201);
  const alphaToBetaRequestId = alphaToBetaRequest.json().data.request.id as string;

  const ownerAcceptAttempt = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${alphaToBetaRequestId}/accept`,
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(ownerAcceptAttempt.statusCode, 403);
  assert.equal(ownerAcceptAttempt.json().error.code, 'forbidden');

  const betaAccept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${alphaToBetaRequestId}/accept`,
    headers: {
      authorization: `Bearer ${betaToken}`,
    },
  });
  assert.equal(betaAccept.statusCode, 200);
  const conversationId = betaAccept.json().data.conversation.id as string;

  const gammaToBetaRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: {
      authorization: `Bearer ${gammaToken}`,
    },
    payload: {
      toGatewayId: betaGatewayId,
    },
  });
  assert.equal(gammaToBetaRequest.statusCode, 201);
  const gammaToBetaRequestId = gammaToBetaRequest.json().data.request.id as string;

  const ownerRejectAttempt = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${gammaToBetaRequestId}/reject`,
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(ownerRejectAttempt.statusCode, 403);
  assert.equal(ownerRejectAttempt.json().error.code, 'forbidden');

  const ownerSendMessage = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      body: 'owner session should not send hosted DM',
    },
  });
  assert.equal(ownerSendMessage.statusCode, 403);
  assert.equal(ownerSendMessage.json().error.code, 'forbidden');

  const ownerMarkRead = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/read-state`,
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(ownerMarkRead.statusCode, 403);
  assert.equal(ownerMarkRead.json().error.code, 'forbidden');

  const ownerPresenceHeartbeat = await app.inject({
    method: 'POST',
    url: '/api/v1/presence/heartbeat',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      sessionId: 'hosted-owner-social-write',
    },
  });
  assert.equal(ownerPresenceHeartbeat.statusCode, 403);
  assert.equal(ownerPresenceHeartbeat.json().error.code, 'forbidden');

  const ownerUpdateScopes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/friends/${betaGatewayId}/scopes`,
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      updates: [{ scopeName: 'presence.read', state: 'granted' }],
    },
  });
  assert.equal(ownerUpdateScopes.statusCode, 403);
  assert.equal(ownerUpdateScopes.json().error.code, 'forbidden');

  const ownerRemoveFriend = await app.inject({
    method: 'DELETE',
    url: `/api/v1/friends/${betaGatewayId}`,
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(ownerRemoveFriend.statusCode, 403);
  assert.equal(ownerRemoveFriend.json().error.code, 'forbidden');

  const ownerCreateBlock = await app.inject({
    method: 'POST',
    url: '/api/v1/blocks',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      gatewayId: alphaGatewayId,
      reason: 'should not block from owner session',
    },
  });
  assert.equal(ownerCreateBlock.statusCode, 403);
  assert.equal(ownerCreateBlock.json().error.code, 'forbidden');

  const ownerRemoveBlock = await app.inject({
    method: 'DELETE',
    url: `/api/v1/blocks/${alphaGatewayId}`,
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(ownerRemoveBlock.statusCode, 403);
  assert.equal(ownerRemoveBlock.json().error.code, 'forbidden');

  await app.close();
});

test('hosted owner session can inspect social pulse dry-run while gateways cannot', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-owner-social-pulse');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Pulse Alpha',
      handle: 'hosted-pulse-alpha',
    },
  });
  assert.equal(alphaRegister.statusCode, 201);
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Pulse Beta',
      handle: 'hosted-pulse-beta',
    },
  });
  assert.equal(betaRegister.statusCode, 201);
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;
  const betaHandle = betaRegister.json().data.gateway.handle as string;

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: {
      authorization: `Bearer ${alphaToken}`,
    },
    payload: {
      toGatewayId: betaGatewayId,
    },
  });
  assert.equal(friendRequest.statusCode, 201);
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: {
      authorization: `Bearer ${betaToken}`,
    },
  });
  assert.equal(accept.statusCode, 200);
  const conversationId = accept.json().data.conversation.id as string;

  const ownerCurrent = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      key: 'hosted-social-pulse-current',
      label: 'Hosted Social Pulse Current',
      summary: 'A lively hosted current for social pulse dry-run.',
      tone: 'playful',
      ...buildActiveCurrentWindow(),
    },
  });
  assert.equal(ownerCurrent.statusCode, 201);

  const ownerEnvironment = await app.inject({
    method: 'POST',
    url: '/api/v1/environment',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      waterTemperatureC: 19,
      clarity: 'clear',
      tideDirection: 'crosswind',
      surfaceState: 'surging',
      phenomenon: 'warm_bloom',
    },
  });
  assert.equal(ownerEnvironment.statusCode, 201);

  const betaPresence = await app.inject({
    method: 'POST',
    url: '/api/v1/presence/heartbeat',
    headers: {
      authorization: `Bearer ${betaToken}`,
    },
    payload: {
      sessionId: 'hosted-pulse-beta-session',
      connectionType: 'gateway_ws',
    },
  });
  assert.equal(betaPresence.statusCode, 200);

  const betaMessage = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: {
      authorization: `Bearer ${betaToken}`,
    },
    payload: {
      body: 'The hosted tide needs a reply.',
    },
  });
  assert.equal(betaMessage.statusCode, 201);

  const ownerSocialPulse = await app.inject({
    method: 'GET',
    url: `/api/v1/social-pulse/dry-run?gatewayId=${alphaGatewayId}`,
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(ownerSocialPulse.statusCode, 200);
  assert.equal(ownerSocialPulse.json().data.items[0].gatewayId, alphaGatewayId);
  assert.equal(ownerSocialPulse.json().data.items[0].decision.action, 'friend_dm_reply');
  assert.equal(ownerSocialPulse.json().data.items[0].decision.targetGatewayId, betaGatewayId);
  assert.equal(ownerSocialPulse.json().data.items[0].decision.directMessagePlan.mode, 'reply');
  assert.equal(ownerSocialPulse.json().data.items[0].decision.directMessagePlan.conversationId, conversationId);
  assert.equal(ownerSocialPulse.json().data.items[0].decision.directMessagePlan.targetGatewayHandle, betaHandle);
  assert.equal(ownerSocialPulse.json().data.items[0].decision.directMessagePlan.tone, 'playful');

  const forbiddenSocialPulse = await app.inject({
    method: 'GET',
    url: '/api/v1/social-pulse/dry-run',
    headers: {
      authorization: `Bearer ${alphaToken}`,
    },
  });
  assert.equal(forbiddenSocialPulse.statusCode, 403);
  assert.equal(forbiddenSocialPulse.json().error.code, 'forbidden');

  await app.close();
});

test('hosted owner session can patch and read social pulse policy while gateway tokens stay excluded', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-social-policy-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const participantRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Policy Reader',
      handle: 'hosted-policy-reader',
    },
  });
  assert.equal(participantRegister.statusCode, 201);
  const participantToken = participantRegister.json().data.credential.token as string;

  const update = await app.inject({
    method: 'PATCH',
    url: '/api/v1/social-pulse/policy',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      publicExpressionEnabled: false,
      directMessageCooldownMinutes: 210,
      publicExpressionBudgetPer24h: 5,
      directMessageBudgetPer24h: 2,
      quietHours: {
        startTime: '22:00',
        endTime: '07:00',
        timeZone: 'Asia/Shanghai',
      },
    },
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.policy.publicExpressionEnabled, false);
  assert.equal(update.json().data.policy.directMessageCooldownMinutes, 210);
  assert.equal(update.json().data.policy.publicExpressionBudgetPer24h, 5);
  assert.equal(update.json().data.policy.directMessageBudgetPer24h, 2);
  assert.equal(update.json().data.policy.quietHours.timeZone, 'Asia/Shanghai');

  const read = await app.inject({
    method: 'GET',
    url: '/api/v1/social-pulse/policy',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(read.statusCode, 200);
  assert.equal(read.json().data.policy.publicExpressionEnabled, false);
  assert.equal(read.json().data.policy.publicExpressionBudgetPer24h, 5);
  assert.equal(read.json().data.policy.directMessageBudgetPer24h, 2);
  assert.equal(read.json().data.policy.quietHours.startTime, '22:00');

  const forbidden = await app.inject({
    method: 'GET',
    url: '/api/v1/social-pulse/policy',
    headers: {
      authorization: `Bearer ${participantToken}`,
    },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, 'forbidden');

  await app.close();
});

test('hosted owner session can patch and read community cast policy while gateway tokens stay excluded', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-community-cast-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const participantRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Community Cast Reader',
      handle: 'hosted-community-cast-reader',
    },
  });
  assert.equal(participantRegister.statusCode, 201);
  const participantToken = participantRegister.json().data.credential.token as string;

  const update = await app.inject({
    method: 'PATCH',
    url: '/api/v1/community-cast/policy',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
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
  assert.equal(update.json().data.registry[0].id, 'xiaowo');
  assert.equal(update.json().data.policy.globalDailyCap, 5);
  assert.deepEqual(update.json().data.policy.blockedTopicDomains, ['community_callback', 'observer_note']);
  assert.equal(update.json().data.policy.npcs.xiaowo.minIntervalMinutes, 90);
  assert.equal(update.json().data.policy.npcs.beibei.enabled, false);

  const read = await app.inject({
    method: 'GET',
    url: '/api/v1/community-cast/policy',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(read.statusCode, 200);
  assert.equal(read.json().data.registry[1].primaryVenueSlug, 'krusty-krab');
  assert.equal(read.json().data.policy.globalDailyCap, 5);
  assert.deepEqual(read.json().data.policy.blockedTopicDomains, ['community_callback', 'observer_note']);
  assert.equal(read.json().data.policy.npcs.beibei.enabled, false);

  const forbidden = await app.inject({
    method: 'GET',
    url: '/api/v1/community-cast/policy',
    headers: {
      authorization: `Bearer ${participantToken}`,
    },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, 'forbidden');

  await app.close();
});

test('hosted owner session can run community cast publishing while gateway tokens stay excluded', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-community-cast-run-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const participantRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Community Cast Alpha',
      handle: 'hosted-community-cast-alpha',
      visibility: 'public',
    },
  });
  assert.equal(participantRegister.statusCode, 201);
  const participantToken = participantRegister.json().data.credential.token as string;

  const policy = await app.inject({
    method: 'PATCH',
    url: '/api/v1/community-cast/policy',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      activeWindowStart: null,
      activeWindowEnd: null,
      npcs: {
        xiaowo: {
          minIntervalMinutes: 60,
          activeWindowStart: null,
          activeWindowEnd: null,
        },
      },
    },
  });
  assert.equal(policy.statusCode, 200);

  const root = await app.inject({
    method: 'POST',
    url: '/api/v1/public-expressions',
    headers: {
      authorization: `Bearer ${participantToken}`,
    },
    payload: {
      body: 'The hosted reef keeps echoing the same bright little rumor.',
    },
  });
  assert.equal(root.statusCode, 201);
  const rootExpressionId = root.json().data.expression.id as string;

  const run = await app.inject({
    method: 'POST',
    url: '/api/v1/community-cast/run',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(run.statusCode, 200);
  assert.equal(run.json().data.generation.action, 'created');
  assert.equal(run.json().data.publish.action, 'published');
  assert.equal(run.json().data.publish.expression.gateway.displayName, '小蜗');
  assert.equal(run.json().data.publish.expression.parentExpressionId, rootExpressionId);

  const publicGateways = await app.inject({
    method: 'GET',
    url: '/api/v1/public/gateways',
  });
  assert.equal(publicGateways.statusCode, 200);
  assert.equal(publicGateways.json().data.items.some((gateway: { displayName: string }) => gateway.displayName === '小蜗'), false);

  const forbidden = await app.inject({
    method: 'POST',
    url: '/api/v1/community-cast/run',
    headers: {
      authorization: `Bearer ${participantToken}`,
    },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, 'forbidden');

  await app.close();
});

test('hosted owner session can inspect community cast bulletins and notes while gateway tokens stay excluded', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-community-cast-inspection-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Inspection Alpha',
      handle: 'hosted-inspection-alpha',
      visibility: 'public',
    },
  });
  assert.equal(alphaRegister.statusCode, 201);
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Inspection Beta',
      handle: 'hosted-inspection-beta',
      visibility: 'public',
    },
  });
  assert.equal(betaRegister.statusCode, 201);
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const policy = await app.inject({
    method: 'PATCH',
    url: '/api/v1/community-cast/policy',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      activeWindowStart: null,
      activeWindowEnd: null,
      npcs: {
        xiaowo: {
          minIntervalMinutes: 60,
          activeWindowStart: null,
          activeWindowEnd: null,
        },
      },
    },
  });
  assert.equal(policy.statusCode, 200);

  const root = await app.inject({
    method: 'POST',
    url: '/api/v1/public-expressions',
    headers: {
      authorization: `Bearer ${alphaToken}`,
    },
    payload: {
      body: 'The hosted reef keeps echoing the same bright little rumor.',
    },
  });
  assert.equal(root.statusCode, 201);

  const run = await app.inject({
    method: 'POST',
    url: '/api/v1/community-cast/run',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(run.statusCode, 200);
  assert.equal(run.json().data.publish.action, 'published');

  const recharge = await app.inject({
    method: 'POST',
    url: '/api/v1/recharge-events',
    headers: {
      authorization: `Bearer ${betaToken}`,
    },
    payload: {
      venueSlug: 'krusty-krab',
      venueName: 'Krusty Krab',
      cue: 'heavy_reset',
      suggestedItem: '海藻奶昔',
      suggestedKind: '奶昔',
    },
  });
  assert.equal(recharge.statusCode, 201);

  const bulletins = await app.inject({
    method: 'GET',
    url: '/api/v1/community-cast/bulletins?published=true&npcId=xiaowo',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(bulletins.statusCode, 200);
  assert.equal(bulletins.json().data.items.length, 1);
  assert.equal(bulletins.json().data.items[0].npcId, 'xiaowo');

  const notes = await app.inject({
    method: 'GET',
    url: `/api/v1/community-cast/notes?gatewayId=${encodeURIComponent(betaGatewayId)}&npcId=beibei`,
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(notes.statusCode, 200);
  assert.equal(notes.json().data.items.length, 1);
  assert.equal(notes.json().data.items[0].gateway.id, betaGatewayId);
  assert.equal(notes.json().data.items[0].npcId, 'beibei');
  assert.equal(notes.json().data.items[0].relatedSeaEventIds[0], recharge.json().data.event.id);

  const forbidden = await app.inject({
    method: 'GET',
    url: '/api/v1/community-cast/bulletins',
    headers: {
      authorization: `Bearer ${alphaToken}`,
    },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.json().error.code, 'forbidden');

  assert.notEqual(alphaGatewayId, betaGatewayId);
  await app.close();
});

test('hosted participant can read community memory notes while owner sessions stay ashore', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-community-memory-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const participantRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Community Memory Alpha',
      handle: 'hosted-community-memory-alpha',
      visibility: 'public',
    },
  });
  assert.equal(participantRegister.statusCode, 201);
  const participantToken = participantRegister.json().data.credential.token as string;

  const recharge = await app.inject({
    method: 'POST',
    url: '/api/v1/recharge-events',
    headers: {
      authorization: `Bearer ${participantToken}`,
    },
    payload: {
      venueSlug: 'krusty-krab',
      venueName: 'Krusty Krab',
      cue: 'heavy_reset',
      suggestedItem: '海藻奶昔',
      suggestedKind: '奶昔',
    },
  });
  assert.equal(recharge.statusCode, 201);

  const mine = await app.inject({
    method: 'GET',
    url: '/api/v1/community-memory/mine?venueSlug=krusty-krab',
    headers: {
      authorization: `Bearer ${participantToken}`,
    },
  });
  assert.equal(mine.statusCode, 200);
  assert.equal(mine.json().data.items.length, 1);
  assert.equal(mine.json().data.items[0].npcId, 'beibei');
  assert.equal(mine.json().data.items[0].relatedSeaEventIds[0], recharge.json().data.event.id);

  const ownerRead = await app.inject({
    method: 'GET',
    url: '/api/v1/community-memory/mine',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(ownerRead.statusCode, 401);
  assert.equal(ownerRead.json().error.code, 'unauthorized');

  await app.close();
});

test('hosted participant social pulse endpoint returns a DM reply plan while owner sessions stay ashore', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-participant-dm-social-pulse-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Pulse DM Alpha',
      handle: 'hosted-pulse-dm-alpha',
    },
  });
  assert.equal(alphaRegister.statusCode, 201);
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Pulse DM Beta',
      handle: 'hosted-pulse-dm-beta',
    },
  });
  assert.equal(betaRegister.statusCode, 201);
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;
  const betaHandle = betaRegister.json().data.gateway.handle as string;

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: {
      authorization: `Bearer ${alphaToken}`,
    },
    payload: {
      toGatewayId: betaGatewayId,
    },
  });
  assert.equal(friendRequest.statusCode, 201);
  const requestId = friendRequest.json().data.request.id as string;

  const accepted = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: {
      authorization: `Bearer ${betaToken}`,
    },
  });
  assert.equal(accepted.statusCode, 200);
  const conversationId = accepted.json().data.conversation.id as string;

  const betaPresence = await app.inject({
    method: 'POST',
    url: '/api/v1/presence/heartbeat',
    headers: {
      authorization: `Bearer ${betaToken}`,
    },
    payload: {
      sessionId: 'hosted-pulse-dm-beta-session',
      connectionType: 'gateway_ws',
    },
  });
  assert.equal(betaPresence.statusCode, 200);

  const ownerCurrent = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      key: 'hosted-participant-dm-social-pulse-current',
      label: 'Hosted Participant DM Social Pulse Current',
      summary: 'The hosted sea is lively enough to support a DM reply.',
      tone: 'playful',
      ...buildActiveCurrentWindow(),
    },
  });
  assert.equal(ownerCurrent.statusCode, 201);

  const ownerEnvironment = await app.inject({
    method: 'POST',
    url: '/api/v1/environment',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      waterTemperatureC: 19,
      clarity: 'clear',
      tideDirection: 'crosswind',
      surfaceState: 'surging',
      phenomenon: 'warm_bloom',
    },
  });
  assert.equal(ownerEnvironment.statusCode, 201);

  const betaMessage = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: {
      authorization: `Bearer ${betaToken}`,
    },
    payload: {
      body: 'The hosted tide needs a reply.',
    },
  });
  assert.equal(betaMessage.statusCode, 201);

  const participantPulse = await app.inject({
    method: 'GET',
    url: '/api/v1/social-pulse/me',
    headers: {
      authorization: `Bearer ${alphaToken}`,
    },
  });
  assert.equal(participantPulse.statusCode, 200);
  assert.equal(participantPulse.json().data.item.gatewayId, alphaGatewayId);
  assert.equal(participantPulse.json().data.item.decision.action, 'friend_dm_reply');
  assert.equal(participantPulse.json().data.item.decision.targetGatewayId, betaGatewayId);
  assert.equal(participantPulse.json().data.item.decision.directMessagePlan.mode, 'reply');
  assert.equal(participantPulse.json().data.item.decision.directMessagePlan.conversationId, conversationId);
  assert.equal(participantPulse.json().data.item.decision.directMessagePlan.targetGatewayHandle, betaHandle);
  assert.equal(participantPulse.json().data.item.decision.directMessagePlan.tone, 'playful');
  assert.equal(participantPulse.json().data.item.decision.directMessagePlan.body.length > 24, true);

  const ownerForbidden = await app.inject({
    method: 'GET',
    url: '/api/v1/social-pulse/me',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(ownerForbidden.statusCode, 403);
  assert.equal(ownerForbidden.json().error.code, 'forbidden');

  await app.close();
});

test('hosted public expression write requires a gateway bearer token while owner sessions remain read-only', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-public-expression-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Public Expression Alpha',
      handle: 'hosted-public-expression-alpha',
    },
  });
  assert.equal(alphaRegister.statusCode, 201);
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const ownerWrite = await app.inject({
    method: 'POST',
    url: '/api/v1/public-expressions',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      body: 'Host should not speak from inside the sea.',
    },
  });
  assert.equal(ownerWrite.statusCode, 403);
  assert.equal(ownerWrite.json().error.code, 'forbidden');

  const alphaWrite = await app.inject({
    method: 'POST',
    url: '/api/v1/public-expressions',
    headers: {
      authorization: `Bearer ${alphaToken}`,
    },
    payload: {
      body: 'A hosted participant can speak publicly.',
    },
  });
  assert.equal(alphaWrite.statusCode, 201);

  const list = await app.inject({
    method: 'GET',
    url: '/api/v1/public-expressions',
  });
  assert.equal(list.statusCode, 200);
  assert.deepEqual(
    list.json().data.items.map((item: { gateway: { handle: string } | null }) => item.gateway?.handle),
    ['hosted-public-expression-alpha'],
  );

  await app.close();
});

test('hosted participant social pulse endpoint returns a public reply plan while owner sessions stay ashore', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-participant-social-pulse-owner');
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Pulse Surface Alpha',
      handle: 'hosted-pulse-surface-alpha',
    },
  });
  assert.equal(alphaRegister.statusCode, 201);
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Pulse Surface Beta',
      handle: 'hosted-pulse-surface-beta',
    },
  });
  assert.equal(betaRegister.statusCode, 201);
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaHandle = betaRegister.json().data.gateway.handle as string;

  const ownerCurrent = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      key: 'hosted-participant-social-pulse-current',
      label: 'Hosted Participant Social Pulse Current',
      summary: 'The hosted sea is lively enough to support public surface speech.',
      tone: 'playful',
      ...buildActiveCurrentWindow(),
    },
  });
  assert.equal(ownerCurrent.statusCode, 201);

  const ownerEnvironment = await app.inject({
    method: 'POST',
    url: '/api/v1/environment',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      waterTemperatureC: 19,
      clarity: 'clear',
      tideDirection: 'crosswind',
      surfaceState: 'surging',
      phenomenon: 'warm_bloom',
    },
  });
  assert.equal(ownerEnvironment.statusCode, 201);

  const betaExpression = await app.inject({
    method: 'POST',
    url: '/api/v1/public-expressions',
    headers: {
      authorization: `Bearer ${betaToken}`,
    },
    payload: {
      body: 'The hosted surface is bright enough to answer tonight.',
    },
  });
  assert.equal(betaExpression.statusCode, 201);
  const expressionId = betaExpression.json().data.expression.id as string;

  const participantPulse = await app.inject({
    method: 'GET',
    url: '/api/v1/social-pulse/me',
    headers: {
      authorization: `Bearer ${alphaToken}`,
    },
  });
  assert.equal(participantPulse.statusCode, 200);
  assert.equal(participantPulse.json().data.item.gatewayId, alphaGatewayId);
  assert.equal(participantPulse.json().data.item.decision.action, 'public_expression');
  assert.equal(participantPulse.json().data.item.decision.publicExpressionPlan.mode, 'reply');
  assert.equal(participantPulse.json().data.item.decision.publicExpressionPlan.replyToExpressionId, expressionId);
  assert.equal(participantPulse.json().data.item.decision.publicExpressionPlan.replyToGatewayHandle, betaHandle);
  assert.equal(
    Object.prototype.hasOwnProperty.call(participantPulse.json().data.item.decision.publicExpressionPlan, 'body'),
    false,
  );

  const ownerForbidden = await app.inject({
    method: 'GET',
    url: '/api/v1/social-pulse/me',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(ownerForbidden.statusCode, 403);
  assert.equal(ownerForbidden.json().error.code, 'forbidden');

  await app.close();
});

test('hosted owner session gate protects owner-only hosted-session/current/audit/system feed/invite/remote-bridge endpoints from gateway tokens', async () => {
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
  await setHostedRegistrationPolicy(app, ownerToken, 'open');

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

  const forbiddenRegistrationPolicy = await app.inject({
    method: 'PATCH',
    url: '/api/v1/registration-policy',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
    payload: {
      policy: 'closed',
    },
  });
  assert.equal(forbiddenRegistrationPolicy.statusCode, 403);
  assert.equal(forbiddenRegistrationPolicy.json().error.code, 'forbidden');

  const forbiddenBridgeCredentialCreate = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bridge-credentials',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
    payload: {
      label: 'guest-should-not-create',
    },
  });
  assert.equal(forbiddenBridgeCredentialCreate.statusCode, 403);
  assert.equal(forbiddenBridgeCredentialCreate.json().error.code, 'forbidden');

  const ownerBridgeCredentialCreate = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bridge-credentials',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      label: 'owner-remote-bridge',
    },
  });
  assert.equal(ownerBridgeCredentialCreate.statusCode, 201);
  const ownerBridgeCredentialId = ownerBridgeCredentialCreate.json().data.credential.id as string;

  const forbiddenBridgeCredentialRevoke = await app.inject({
    method: 'POST',
    url: `/api/v1/runtime/remote/bridge-credentials/${ownerBridgeCredentialId}/revoke`,
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(forbiddenBridgeCredentialRevoke.statusCode, 403);
  assert.equal(forbiddenBridgeCredentialRevoke.json().error.code, 'forbidden');

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

  const guestDefaultFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(guestDefaultFeed.statusCode, 200);
  assert.equal(guestDefaultFeed.json().data.items.some((item: { visibility: string }) => item.visibility === 'system'), false);

  const ownerDefaultFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(ownerDefaultFeed.statusCode, 200);
  assert.equal(ownerDefaultFeed.json().data.items.some((item: { visibility: string }) => item.visibility === 'system'), true);

  const guestMineFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=mine',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(guestMineFeed.statusCode, 200);
  assert.equal(guestMineFeed.json().data.items.some((item: { visibility: string }) => item.visibility === 'system'), false);

  const guestFriendsFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=friends',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(guestFriendsFeed.statusCode, 200);
  assert.equal(guestFriendsFeed.json().data.items.some((item: { visibility: string }) => item.visibility === 'system'), false);

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
  const ownerInviteId = ownerInvite.json().data.invite.id as string;

  const forbiddenInviteRevoke = await app.inject({
    method: 'POST',
    url: `/api/v1/invites/${ownerInviteId}/revoke`,
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
  });
  assert.equal(forbiddenInviteRevoke.statusCode, 403);
  assert.equal(forbiddenInviteRevoke.json().error.code, 'forbidden');

  await app.close();
});

test('hosted registration policy matrix keeps invite create/claim/revoke available for existing hosted gateways', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-registration-invite-matrix-owner');
  const ownerToken = owner.credential.token;
  await setHostedRegistrationPolicy(app, ownerToken, 'open');

  const claimerOneRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Matrix Claimer One',
      handle: 'hosted-matrix-claimer-one',
    },
  });
  assert.equal(claimerOneRegister.statusCode, 201);
  const claimerOneToken = claimerOneRegister.json().data.credential.token as string;

  const claimerTwoRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Matrix Claimer Two',
      handle: 'hosted-matrix-claimer-two',
    },
  });
  assert.equal(claimerTwoRegister.statusCode, 201);
  const claimerTwoToken = claimerTwoRegister.json().data.credential.token as string;

  const claimerThreeRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Matrix Claimer Three',
      handle: 'hosted-matrix-claimer-three',
    },
  });
  assert.equal(claimerThreeRegister.statusCode, 201);
  const claimerThreeToken = claimerThreeRegister.json().data.credential.token as string;

  const openInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      maxUses: 1,
    },
  });
  assert.equal(openInvite.statusCode, 201);
  const openInviteCode = openInvite.json().data.invite.code as string;

  const openClaim = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: {
      authorization: `Bearer ${claimerOneToken}`,
    },
    payload: {
      code: openInviteCode,
    },
  });
  assert.equal(openClaim.statusCode, 200);

  await setHostedRegistrationPolicy(app, ownerToken, 'closed');

  const closedRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Matrix Closed Register',
      handle: 'hosted-matrix-closed-register',
    },
  });
  assert.equal(closedRegister.statusCode, 403);
  assert.equal(closedRegister.json().error.code, 'registration_closed');

  const closedInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      maxUses: 1,
    },
  });
  assert.equal(closedInvite.statusCode, 201);
  const closedInviteCode = closedInvite.json().data.invite.code as string;

  const closedClaim = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: {
      authorization: `Bearer ${claimerTwoToken}`,
    },
    payload: {
      code: closedInviteCode,
    },
  });
  assert.equal(closedClaim.statusCode, 200);

  await setHostedRegistrationPolicy(app, ownerToken, 'invite_only');

  const inviteOnlyRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Matrix Invite-only Register',
      handle: 'hosted-matrix-invite-only-register',
    },
  });
  assert.equal(inviteOnlyRegister.statusCode, 403);
  assert.equal(inviteOnlyRegister.json().error.code, 'registration_invite_only');

  const inviteOnlyInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      maxUses: 1,
    },
  });
  assert.equal(inviteOnlyInvite.statusCode, 201);
  const inviteOnlyInviteId = inviteOnlyInvite.json().data.invite.id as string;
  const inviteOnlyInviteCode = inviteOnlyInvite.json().data.invite.code as string;

  const inviteOnlyRevoke = await app.inject({
    method: 'POST',
    url: `/api/v1/invites/${inviteOnlyInviteId}/revoke`,
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(inviteOnlyRevoke.statusCode, 200);

  const revokedClaim = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: {
      authorization: `Bearer ${claimerThreeToken}`,
    },
    payload: {
      code: inviteOnlyInviteCode,
    },
  });
  assert.equal(revokedClaim.statusCode, 409);
  assert.equal(revokedClaim.json().error.code, 'invalid_state');
  assert.equal(revokedClaim.json().error.message, 'invite revoked');

  await app.close();
});

test('hosted invite lifecycle enforces expiresAt validation plus revoke behavior', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwner(app, 'hosted-invite-lifecycle-owner');
  const ownerToken = owner.credential.token;
  await setHostedRegistrationPolicy(app, ownerToken, 'open');

  const guestRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Invite Guest',
      handle: 'hosted-invite-guest',
    },
  });
  assert.equal(guestRegister.statusCode, 201);
  const guestToken = guestRegister.json().data.credential.token as string;

  const invalidExpiryInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      expiresAt: 'not-a-date',
    },
  });
  assert.equal(invalidExpiryInvite.statusCode, 400);
  assert.equal(invalidExpiryInvite.json().error.code, 'validation_failed');

  const expiredInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      maxUses: 1,
      expiresAt: '2000-01-01T00:00:00.000Z',
    },
  });
  assert.equal(expiredInvite.statusCode, 201);
  const code = expiredInvite.json().data.invite.code as string;

  const expiredClaim = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
    payload: {
      code,
    },
  });
  assert.equal(expiredClaim.statusCode, 409);
  assert.equal(expiredClaim.json().error.code, 'invalid_state');
  assert.equal(expiredClaim.json().error.message, 'invite expired');

  const revocableInvite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      maxUses: 2,
    },
  });
  assert.equal(revocableInvite.statusCode, 201);
  const revocableInviteId = revocableInvite.json().data.invite.id as string;
  const revocableInviteCode = revocableInvite.json().data.invite.code as string;

  const revokeInvite = await app.inject({
    method: 'POST',
    url: `/api/v1/invites/${revocableInviteId}/revoke`,
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(revokeInvite.statusCode, 200);
  assert.equal(typeof revokeInvite.json().data.invite.revokedAt, 'string');

  const revokedClaim = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: {
      authorization: `Bearer ${guestToken}`,
    },
    payload: {
      code: revocableInviteCode,
    },
  });
  assert.equal(revokedClaim.statusCode, 409);
  assert.equal(revokedClaim.json().error.code, 'invalid_state');
  assert.equal(revokedClaim.json().error.message, 'invite revoked');

  await app.close();
});
