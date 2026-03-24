import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

async function registerGateway(
  app: ReturnType<typeof buildApp>,
  payload: { displayName: string; handle: string; bio?: string; visibility?: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload,
  });
  assert.equal(response.statusCode, 201);
  const json = response.json();
  return {
    token: json.data.credential.token as string,
    gateway: json.data.gateway as {
      id: string;
      handle: string;
      displayName: string;
      bio: string;
      visibility: string;
      createdAt: string;
    },
  };
}

test('generating a vent scene returns a private scene and emits a private SeaEvent', async () => {
  const app = buildApp();
  const alpha = await registerGateway(app, { displayName: 'Alpha Scene', handle: 'alpha-scene' });

  const generate = await app.inject({
    method: 'POST',
    url: '/api/v1/scenes/generate',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { type: 'vent' },
  });
  assert.equal(generate.statusCode, 201);
  const scene = generate.json().data.scene as {
    id: string;
    gatewayId: string;
    type: string;
    visibility: string;
    summary: string;
    metadata: {
      trigger: {
        kind: string;
        sourceKind: string;
        reason: string;
      };
    };
    createdAt: string;
  };
  assert.match(scene.id, /^scene-/);
  assert.equal(scene.gatewayId, alpha.gateway.id);
  assert.equal(scene.type, 'vent');
  assert.equal(scene.visibility, 'private');
  assert.equal(scene.summary.length > 10, true);
  assert.equal(scene.metadata.trigger.kind, 'manual.generate');
  assert.equal(scene.metadata.trigger.sourceKind, 'manual');
  assert.equal(scene.metadata.trigger.reason, 'vent');

  const mine = await app.inject({
    method: 'GET',
    url: '/api/v1/scenes/mine',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(mine.statusCode, 200);
  const items = mine.json().data.items as Array<{ id: string; type: string }>;
  assert.equal(items.some((item) => item.id === scene.id), true);

  const feed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=mine',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(feed.statusCode, 200);
  assert.equal((feed.json().data.items as Array<{ type: string }>).some((item) => item.type === 'scene.vent_generated'), true);

  await app.close();
});

test('scene list is owner-scoped: another gateway does not see someone else scenes', async () => {
  const app = buildApp();
  const alpha = await registerGateway(app, { displayName: 'Alpha Scene 2', handle: 'alpha-scene-2' });
  const beta = await registerGateway(app, { displayName: 'Beta Scene 2', handle: 'beta-scene-2' });

  const generate = await app.inject({
    method: 'POST',
    url: '/api/v1/scenes/generate',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { type: 'social_glimpse' },
  });
  assert.equal(generate.statusCode, 201);
  const sceneId = generate.json().data.scene.id as string;

  const betaMine = await app.inject({
    method: 'GET',
    url: '/api/v1/scenes/mine',
    headers: { authorization: `Bearer ${beta.token}` },
  });
  assert.equal(betaMine.statusCode, 200);
  assert.equal((betaMine.json().data.items as Array<{ id: string }>).some((item) => item.id === sceneId), false);

  await app.close();
});
