import assert from 'node:assert/strict';
import test from 'node:test';

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

async function bootstrapLocalHost(app: ReturnType<typeof buildApp>) {
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

async function withFrozenTime<T>(iso: string, fn: () => T | Promise<T>): Promise<T> {
  const fixedNow = new Date(iso).getTime();
  const RealDate = Date;

  class MockDate extends RealDate {
    constructor(value?: string | number | Date) {
      if (arguments.length === 0) {
        super(fixedNow);
        return;
      }
      super(value as string | number | Date);
    }

    static now() {
      return fixedNow;
    }
  }

  Object.setPrototypeOf(MockDate, RealDate);
  MockDate.parse = RealDate.parse;
  MockDate.UTC = RealDate.UTC;

  globalThis.Date = MockDate as DateConstructor;
  try {
    return await fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

test('public environment endpoint returns a seeded readable environment', async () => {
  const app = buildApp();

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/public/environment',
  });

  assert.equal(response.statusCode, 200);
  const environment = response.json().data.environment as {
    id: string;
    waterTemperatureC: number;
    clarity: string;
    tideDirection: string;
    surfaceState: string;
    phenomenon: string;
    summary: string;
    source: string;
    updatedAt: string;
  };

  assert.match(environment.id, /^environment-/);
  assert.equal(environment.source, 'seeded');
  assert.equal(typeof environment.waterTemperatureC, 'number');
  assert.equal(['murky', 'hazy', 'clear', 'crystalline'].includes(environment.clarity), true);
  assert.equal(['slack', 'incoming', 'outgoing', 'crosswind'].includes(environment.tideDirection), true);
  assert.equal(['glassy', 'rippled', 'choppy', 'surging'].includes(environment.surfaceState), true);
  assert.equal(['none', 'warm_bloom', 'lantern_swarm', 'storm_front', 'debris_field'].includes(environment.phenomenon), true);
  assert.equal(environment.summary.length > 10, true);
  assert.equal('metadata' in environment, false);

  await app.close();
});

test('raw environment endpoint requires auth', async () => {
  const app = buildApp();

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/environment/current',
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'unauthorized');

  await app.close();
});

test('setting environment requires bearer auth', async () => {
  const app = buildApp();

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/environment',
    payload: {
      waterTemperatureC: 24,
      clarity: 'clear',
      tideDirection: 'incoming',
      surfaceState: 'rippled',
      phenomenon: 'lantern_swarm',
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'unauthorized');

  await app.close();
});

test('setting environment updates the active environment payload and emits a system event', async () => {
  const app = buildApp();
  const host = await bootstrapLocalHost(app);

  const writeResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/environment',
    headers: { authorization: `Bearer ${host.credential.token}` },
    payload: {
      waterTemperatureC: 24.5,
      clarity: 'clear',
      tideDirection: 'incoming',
      surfaceState: 'rippled',
      phenomenon: 'lantern_swarm',
      summary: 'The water is warmer than usual and lanterns are threading through the incoming tide.',
      metadata: {
        source: 'environment-test',
      },
    },
  });

  assert.equal(writeResponse.statusCode, 201);
  const environment = writeResponse.json().data.environment as {
    id: string;
    waterTemperatureC: number;
    summary: string;
    source: string;
    metadata: Record<string, unknown>;
  };
  assert.match(environment.id, /^environment-/);
  assert.equal(environment.waterTemperatureC, 24.5);
  assert.equal(environment.source, 'manual');
  assert.equal(environment.metadata.source, 'environment-test');

  const readResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/environment/current',
    headers: { authorization: `Bearer ${host.credential.token}` },
  });

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json().data.environment.id, environment.id);

  const systemFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=system',
    headers: { authorization: `Bearer ${host.credential.token}` },
  });

  assert.equal(systemFeed.statusCode, 200);
  const event = (systemFeed.json().data.items as Array<{ type: string; metadata: Record<string, unknown> }>).find(
    (item) => item.type === 'environment.changed',
  );
  assert.ok(event);
  assert.equal(event.metadata.environmentId, environment.id);
  assert.equal(event.metadata.changedByGatewayId, null);

  await app.close();
});

test('environment override expiry returns the API surface to automatic rotation', async () => {
  const app = buildApp();
  const host = await bootstrapLocalHost(app);

  const writeResponse = await withFrozenTime('2026-03-18T00:10:00.000Z', () =>
    app.inject({
      method: 'POST',
      url: '/api/v1/environment',
      headers: { authorization: `Bearer ${host.credential.token}` },
      payload: {
        waterTemperatureC: 20,
        clarity: 'clear',
        tideDirection: 'incoming',
        surfaceState: 'rippled',
        phenomenon: 'warm_bloom',
        expiresAt: '2026-03-18T02:10:00.000Z',
      },
    }),
  );

  assert.equal(writeResponse.statusCode, 201);
  assert.equal(writeResponse.json().data.environment.metadata.expiresAt, '2026-03-18T02:10:00.000Z');

  const readResponse = await withFrozenTime('2026-03-18T02:40:00.000Z', () =>
    app.inject({
      method: 'GET',
      url: '/api/v1/environment/current',
      headers: { authorization: `Bearer ${host.credential.token}` },
    }),
  );

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json().data.environment.source, 'seeded');

  await app.close();
});
