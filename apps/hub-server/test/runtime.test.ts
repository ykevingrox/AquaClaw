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
    host: {
      id: string;
      handle: string;
    };
    credential: {
      token: string;
    };
  };
}

async function bootstrapHostedOwnerSession(app: ReturnType<typeof buildApp>) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-hosted',
    payload: {
      bootstrapKey: 'hosted-secret',
      displayName: 'Hosted Owner Runtime',
      handle: 'hosted-owner-runtime',
    },
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
  assert.equal(bind.json().data.host.id, owner.host.id);

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
  assert.equal(get.json().data.host.handle, 'my-claw');

  await app.close();
});

test('local runtime heartbeat updates runtime status for the host-bound local runtime', async () => {
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
  assert.equal(get.json().data.host.handle, 'my-claw');

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

test('hosted remote runtime bridge flow supports create-bind-heartbeat-revoke lifecycle', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwnerSession(app);
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const registerRemote = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Remote Runtime Gateway',
      handle: 'hosted-remote-runtime-gateway',
    },
  });
  assert.equal(registerRemote.statusCode, 201);
  const remoteGatewayToken = registerRemote.json().data.credential.token as string;

  const createBridgeCredential = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bridge-credentials',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      label: 'hosted-remote-bridge',
      metadata: {
        issuedBy: 'runtime-test',
      },
    },
  });
  assert.equal(createBridgeCredential.statusCode, 201);
  const bridgeCredential = createBridgeCredential.json().data.credential as {
    id: string;
    token: string;
    label: string;
    expiresAt: string;
  };
  assert.equal(typeof bridgeCredential.expiresAt, 'string');

  const bindRemote = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bind',
    headers: {
      authorization: `Bearer ${remoteGatewayToken}`,
    },
    payload: {
      bridgeToken: bridgeCredential.token,
      installationId: 'remote-installation-slice-a',
      runtimeId: 'remote-runtime-slice-a',
      label: 'Remote Runtime Slice A',
      source: 'runtime_remote_bind_test',
      metadata: {
        host: 'remote-node-a',
      },
    },
  });
  assert.equal(bindRemote.statusCode, 201);
  assert.equal(bindRemote.json().data.created, true);
  assert.equal(bindRemote.json().data.runtime.runtimeId, 'remote-runtime-slice-a');
  assert.equal(bindRemote.json().data.runtime.bridgeCredentialId, bridgeCredential.id);
  assert.equal(bindRemote.json().data.presence.status, 'offline');

  const getRemote = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/remote/me',
    headers: {
      authorization: `Bearer ${remoteGatewayToken}`,
    },
  });
  assert.equal(getRemote.statusCode, 200);
  assert.equal(getRemote.json().data.runtime.runtimeId, 'remote-runtime-slice-a');

  const heartbeatRemote = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/heartbeat',
    headers: {
      authorization: `Bearer ${remoteGatewayToken}`,
    },
    payload: {
      runtimeId: 'remote-runtime-slice-a',
      connectionType: 'openclaw_remote',
      metadata: {
        source: 'runtime-remote-test',
      },
    },
  });
  assert.equal(heartbeatRemote.statusCode, 200);
  assert.equal(heartbeatRemote.json().data.runtime.status, 'online');
  assert.equal(heartbeatRemote.json().data.presence.status, 'online');
  assert.equal(heartbeatRemote.json().data.connectionType, 'openclaw_remote');

  const wrongRuntimeHeartbeat = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/heartbeat',
    headers: {
      authorization: `Bearer ${remoteGatewayToken}`,
    },
    payload: {
      runtimeId: 'wrong-runtime-id',
    },
  });
  assert.equal(wrongRuntimeHeartbeat.statusCode, 409);
  assert.equal(wrongRuntimeHeartbeat.json().error.code, 'invalid_state');

  const createReplacementBridgeCredential = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bridge-credentials',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      label: 'hosted-remote-bridge-replacement',
    },
  });
  assert.equal(createReplacementBridgeCredential.statusCode, 201);
  const replacementBridgeCredential = createReplacementBridgeCredential.json().data.credential as {
    id: string;
    token: string;
  };

  const rebindRemote = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bind',
    headers: {
      authorization: `Bearer ${remoteGatewayToken}`,
    },
    payload: {
      bridgeToken: replacementBridgeCredential.token,
      installationId: 'remote-installation-slice-b',
      runtimeId: 'remote-runtime-slice-b',
      label: 'Remote Runtime Slice B',
      source: 'runtime_remote_bind_test',
    },
  });
  assert.equal(rebindRemote.statusCode, 200);
  assert.equal(rebindRemote.json().data.created, false);
  assert.equal(rebindRemote.json().data.runtime.runtimeId, 'remote-runtime-slice-b');
  assert.equal(rebindRemote.json().data.runtime.bridgeCredentialId, replacementBridgeCredential.id);
  assert.equal(rebindRemote.json().data.runtime.status, 'offline');

  const staleRuntimeHeartbeat = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/heartbeat',
    headers: {
      authorization: `Bearer ${remoteGatewayToken}`,
    },
    payload: {
      runtimeId: 'remote-runtime-slice-a',
    },
  });
  assert.equal(staleRuntimeHeartbeat.statusCode, 409);
  assert.equal(staleRuntimeHeartbeat.json().error.code, 'invalid_state');

  const replacementHeartbeat = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/heartbeat',
    headers: {
      authorization: `Bearer ${remoteGatewayToken}`,
    },
    payload: {
      runtimeId: 'remote-runtime-slice-b',
      connectionType: 'openclaw_remote',
    },
  });
  assert.equal(replacementHeartbeat.statusCode, 200);
  assert.equal(replacementHeartbeat.json().data.runtime.status, 'online');

  const revokeBridgeCredential = await app.inject({
    method: 'POST',
    url: `/api/v1/runtime/remote/bridge-credentials/${bridgeCredential.id}/revoke`,
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(revokeBridgeCredential.statusCode, 200);
  assert.equal(typeof revokeBridgeCredential.json().data.credential.revokedAt, 'string');

  const registerSecondRemote = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Second Remote Runtime Gateway',
      handle: 'hosted-remote-runtime-gw-two',
    },
  });
  assert.equal(registerSecondRemote.statusCode, 201);
  const secondRemoteGatewayToken = registerSecondRemote.json().data.credential.token as string;

  const bindWithRevokedCredential = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bind',
    headers: {
      authorization: `Bearer ${secondRemoteGatewayToken}`,
    },
    payload: {
      bridgeToken: bridgeCredential.token,
    },
  });
  assert.equal(bindWithRevokedCredential.statusCode, 409);
  assert.equal(bindWithRevokedCredential.json().error.code, 'invalid_state');

  await app.close();
});

test('hosted remote runtime bind/heartbeat/me require gateway credential and reject hosted owner session token', async () => {
  const app = buildApp({ deploymentMode: 'hosted', hostedOwnerBootstrapKey: 'hosted-secret' });

  const owner = await bootstrapHostedOwnerSession(app);
  await setHostedRegistrationPolicy(app, owner.credential.token, 'open');

  const createBridgeCredential = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bridge-credentials',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      label: 'hosted-remote-bridge-owner-block',
    },
  });
  assert.equal(createBridgeCredential.statusCode, 201);
  const bridgeToken = createBridgeCredential.json().data.credential.token as string;

  const ownerBindAttempt = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bind',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      bridgeToken,
      runtimeId: 'owner-should-not-bind-remote-runtime',
    },
  });
  assert.equal(ownerBindAttempt.statusCode, 403);
  assert.equal(ownerBindAttempt.json().error.code, 'forbidden');

  const registerRemote = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Hosted Remote Runtime Role Split Gateway',
      handle: 'hosted-remote-runtime-role-split',
    },
  });
  assert.equal(registerRemote.statusCode, 201);
  const remoteGatewayToken = registerRemote.json().data.credential.token as string;

  const bindRemote = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/bind',
    headers: {
      authorization: `Bearer ${remoteGatewayToken}`,
    },
    payload: {
      bridgeToken,
      runtimeId: 'remote-runtime-role-split',
    },
  });
  assert.equal(bindRemote.statusCode, 201);

  const ownerGetRemoteAttempt = await app.inject({
    method: 'GET',
    url: '/api/v1/runtime/remote/me',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
  });
  assert.equal(ownerGetRemoteAttempt.statusCode, 403);
  assert.equal(ownerGetRemoteAttempt.json().error.code, 'forbidden');

  const ownerHeartbeatAttempt = await app.inject({
    method: 'POST',
    url: '/api/v1/runtime/remote/heartbeat',
    headers: {
      authorization: `Bearer ${owner.credential.token}`,
    },
    payload: {
      runtimeId: 'remote-runtime-role-split',
    },
  });
  assert.equal(ownerHeartbeatAttempt.statusCode, 403);
  assert.equal(ownerHeartbeatAttempt.json().error.code, 'forbidden');

  await app.close();
});
