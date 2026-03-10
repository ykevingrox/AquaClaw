import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';

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
