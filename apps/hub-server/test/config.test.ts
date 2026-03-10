import assert from 'node:assert/strict';
import test from 'node:test';

import { loadRuntimeConfig } from '../src/config.js';

test('loadRuntimeConfig defaults to memory backend', () => {
  const config = loadRuntimeConfig({});
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 8787);
  assert.equal(config.storeBackend, 'memory');
  assert.equal(config.databaseUrl, null);
});

test('loadRuntimeConfig accepts postgres backend', () => {
  const config = loadRuntimeConfig({
    GATEWAY_STORE_BACKEND: 'postgres',
    DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/gateway_hub',
    PORT: '9999',
    HOST: '0.0.0.0',
  });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 9999);
  assert.equal(config.storeBackend, 'postgres');
  assert.equal(config.databaseUrl, 'postgres://postgres:postgres@127.0.0.1:5432/gateway_hub');
});

test('loadRuntimeConfig requires DATABASE_URL for postgres backend', () => {
  assert.throws(
    () => loadRuntimeConfig({ GATEWAY_STORE_BACKEND: 'postgres' }),
    /DATABASE_URL is required when GATEWAY_STORE_BACKEND=postgres/,
  );
});

test('loadRuntimeConfig rejects invalid backend values', () => {
  assert.throws(() => loadRuntimeConfig({ GATEWAY_STORE_BACKEND: 'sqlite' }), /GATEWAY_STORE_BACKEND/);
});
