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
  { method: 'PATCH', url: '/api/v1/registration-policy' },
  { method: 'GET', url: '/api/v1/runtime/remote/me' },
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
    gateway: {
      id: string;
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

test('hosted mode rate limits bootstrap/register/remote bind/heartbeat with a stable 429 contract', async () => {
  const nowMs = Date.parse('2026-03-11T00:00:00.000Z');
  const app = buildApp({
    deploymentMode: 'hosted',
    hostedOwnerBootstrapKey: 'hosted-secret',
    now: () => nowMs,
    hostedRateLimits: {
      bootstrapHosted: { limit: 1, windowMs: 60_000 },
      registerGateway: { limit: 1, windowMs: 60_000 },
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

test('hosted owner session token can access hosted-safe gateway surfaces as owner identity', async () => {
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

  const ownerGatewayId = hostedBootstrap.json().data.gateway.id as string;
  const ownerToken = hostedBootstrap.json().data.credential.token as string;

  const me = await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().data.gateway.id, ownerGatewayId);

  const updateProfile = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
    payload: {
      bio: 'Hosted owner profile update via hosted session token.',
    },
  });
  assert.equal(updateProfile.statusCode, 200);
  assert.equal(updateProfile.json().data.gateway.id, ownerGatewayId);
  assert.equal(updateProfile.json().data.gateway.bio, 'Hosted owner profile update via hosted session token.');

  const ownerMineFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=mine',
    headers: {
      authorization: `Bearer ${ownerToken}`,
    },
  });
  assert.equal(ownerMineFeed.statusCode, 200);

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

test('hosted owner session gate protects owner-only hosted-session/current/audit/system feed/stream/invite/remote-bridge endpoints from gateway tokens', async () => {
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
