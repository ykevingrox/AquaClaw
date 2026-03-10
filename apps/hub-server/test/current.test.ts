import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/app.js';
import { InMemoryGatewayStore } from '../src/store.js';

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
  return response.json().data as {
    gateway: {
      id: string;
      handle: string;
      displayName: string;
      bio: string;
      visibility: string;
      createdAt: string;
    };
    credential: {
      token: string;
    };
  };
}

test('current endpoint returns a seeded readable current window', async () => {
  const app = buildApp();

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/currents/current',
  });

  assert.equal(response.statusCode, 200);
  const current = response.json().data.current as {
    id: string;
    key: string;
    label: string;
    summary: string;
    tone: string;
    sceneHint: string | null;
    startsAt: string;
    endsAt: string;
    source: string;
    metadata: Record<string, unknown>;
  };

  assert.match(current.id, /^current-/);
  assert.equal(typeof current.key, 'string');
  assert.equal(current.key.length > 0, true);
  assert.equal(typeof current.label, 'string');
  assert.equal(current.label.length > 0, true);
  assert.equal(typeof current.summary, 'string');
  assert.equal(current.summary.length > 10, true);
  assert.equal(['calm', 'playful', 'reflective', 'sharp', 'neutral'].includes(current.tone), true);
  assert.equal(current.source, 'seeded');
  assert.equal(typeof current.metadata.cadence, 'string');
  assert.equal(Date.parse(current.startsAt) < Date.parse(current.endsAt), true);

  await app.close();
});

test('setting current requires bearer auth', async () => {
  const app = buildApp();

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    payload: {
      key: 'manual-reef',
      label: 'Manual Reef',
      summary: 'A bright test current is moving through the water.',
      tone: 'playful',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'unauthorized');

  await app.close();
});

test('setting current updates the active current payload', async () => {
  const app = buildApp();
  const registered = await registerGateway(app, {
    displayName: 'Current Keeper',
    handle: 'current-keeper',
  });

  const startsAt = new Date(Date.now() - 60_000).toISOString();
  const endsAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const writeResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: { authorization: `Bearer ${registered.credential.token}` },
    payload: {
      key: 'ember-run',
      label: 'Ember Run',
      summary: 'The sea warms and moves quickly; playful sparks travel farther than usual.',
      tone: 'playful',
      sceneHint: 'ember-reef',
      startsAt,
      endsAt,
      metadata: {
        reason: 'manual-test',
      },
    },
  });

  assert.equal(writeResponse.statusCode, 201);
  const current = writeResponse.json().data.current as {
    id: string;
    key: string;
    label: string;
    summary: string;
    tone: string;
    sceneHint: string | null;
    startsAt: string;
    endsAt: string;
    source: string;
    metadata: Record<string, unknown>;
  };
  assert.match(current.id, /^current-/);
  assert.equal(current.key, 'ember-run');
  assert.equal(current.label, 'Ember Run');
  assert.equal(current.tone, 'playful');
  assert.equal(current.sceneHint, 'ember-reef');
  assert.equal(current.source, 'manual');
  assert.equal(current.metadata.reason, 'manual-test');

  const readResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/currents/current',
  });

  assert.equal(readResponse.statusCode, 200);
  const readCurrent = readResponse.json().data.current as typeof current;
  assert.equal(readCurrent.id, current.id);
  assert.equal(readCurrent.label, 'Ember Run');
  assert.equal(readCurrent.source, 'manual');

  await app.close();
});

test('setting current rejects invalid tone', async () => {
  const app = buildApp();
  const registered = await registerGateway(app, {
    displayName: 'Tone Guard',
    handle: 'tone-guard',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: { authorization: `Bearer ${registered.credential.token}` },
    payload: {
      key: 'tone-break',
      label: 'Tone Break',
      summary: 'This current should fail validation.',
      tone: 'stormy',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'validation_failed');
  assert.match(response.json().error.message, /invalid current tone/);

  await app.close();
});

test('setting current rejects an invalid time window', async () => {
  const app = buildApp();
  const registered = await registerGateway(app, {
    displayName: 'Window Guard',
    handle: 'window-guard',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: { authorization: `Bearer ${registered.credential.token}` },
    payload: {
      key: 'reversed-window',
      label: 'Reversed Window',
      summary: 'This current should fail because its time window is inverted.',
      tone: 'sharp',
      startsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      endsAt: new Date(Date.now() - 60_000).toISOString(),
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'validation_failed');
  assert.match(response.json().error.message, /startsAt must be before endsAt/);

  await app.close();
});

test('expired manual current falls back to the seeded current', async () => {
  const store = new InMemoryGatewayStore();
  const registered = store.register({
    displayName: 'Fallback Reef',
    handle: 'fallback-reef',
  });

  store.setCurrent({
    key: 'short-window',
    label: 'Short Window',
    summary: 'A tiny test current flashes through the sea.',
    tone: 'calm',
    startsAt: new Date(Date.now() - 20).toISOString(),
    endsAt: new Date(Date.now() + 20).toISOString(),
    actorGatewayId: registered.gateway.id,
  });

  assert.equal(store.getCurrent().source, 'manual');

  await new Promise((resolve) => setTimeout(resolve, 60));

  const current = store.getCurrent();
  assert.equal(current.source, 'seeded');
  assert.notEqual(current.label, 'Short Window');
});
