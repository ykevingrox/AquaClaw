import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/app.js';

async function bootstrapLocalSession(app: ReturnType<typeof buildApp>) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/session/bootstrap-local',
  });

  assert.equal(response.statusCode, 201);
  const json = response.json();
  return {
    token: json.data.credential.token as string,
    host: json.data.host as {
      id: string;
      handle: string;
      displayName: string;
    },
  };
}

test('local reef seed requires a local owner session instead of a manual bearer token', async () => {
  const app = buildApp();

  const register = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Manual Reef Token',
      handle: 'manual-reef-token',
    },
  });
  assert.equal(register.statusCode, 201);
  const token = register.json().data.credential.token as string;

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/local/reef/seed',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'unauthorized');

  await app.close();
});

test('local reef seed creates deterministic sandbox data and repeats idempotently', async () => {
  const app = buildApp();
  const owner = await bootstrapLocalSession(app);

  const first = await app.inject({
    method: 'POST',
    url: '/api/v1/local/reef/seed',
    headers: {
      authorization: `Bearer ${owner.token}`,
    },
  });

  assert.equal(first.statusCode, 201);
  const firstReef = first.json().data.reef as {
    applied: string;
    gateways: Array<{ handle: string; created: boolean }>;
    counts: {
      gatewaysCreated: number;
      friendshipsCreated: number;
      messagesCreated: number;
      scenesCreated: number;
    };
    ownerScene: {
      id: string;
      created: boolean;
    };
  };
  assert.equal(firstReef.applied, 'created');
  assert.deepEqual(
    firstReef.gateways.map((gateway) => gateway.handle).sort(),
    ['reef-cartographer', 'reef-chorus', 'reef-lantern'],
  );
  assert.equal(firstReef.gateways.every((gateway) => gateway.created), true);
  assert.deepEqual(firstReef.counts, {
    gatewaysCreated: 3,
    friendshipsCreated: 3,
    messagesCreated: 3,
    scenesCreated: 1,
  });
  assert.equal(firstReef.ownerScene.created, true);

  const feed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=all&limit=30',
    headers: {
      authorization: `Bearer ${owner.token}`,
    },
  });
  assert.equal(feed.statusCode, 200);
  const sandboxFeedItems = feed.json().data.items.filter((item: { metadata?: Record<string, unknown> }) => item.metadata?.sandbox === true);
  assert.equal(sandboxFeedItems.length >= 3, true);
  assert.equal(
    sandboxFeedItems.some((item: { type: string }) => item.type === 'scene.social_glimpse_generated'),
    true,
  );

  const second = await app.inject({
    method: 'POST',
    url: '/api/v1/local/reef/seed',
    headers: {
      authorization: `Bearer ${owner.token}`,
    },
  });

  assert.equal(second.statusCode, 200);
  const secondReef = second.json().data.reef as typeof firstReef;
  assert.equal(secondReef.applied, 'reused');
  assert.deepEqual(secondReef.counts, {
    gatewaysCreated: 0,
    friendshipsCreated: 0,
    messagesCreated: 0,
    scenesCreated: 0,
  });
  assert.equal(secondReef.ownerScene.id, firstReef.ownerScene.id);

  await app.close();
});
