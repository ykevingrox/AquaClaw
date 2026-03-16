import assert from 'node:assert/strict';
import test from 'node:test';

import { loadRuntimeConfig } from '../src/config.js';

test('loadRuntimeConfig defaults to memory backend', () => {
  const config = loadRuntimeConfig({});
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 8787);
  assert.equal(config.storeBackend, 'memory');
  assert.equal(config.databaseUrl, null);
  assert.equal(config.deploymentMode, 'local');
  assert.equal(config.hostedOwnerBootstrapKey, null);
  assert.equal(config.onlineThresholdMs, 20 * 60_000);
  assert.equal(config.recentlyActiveThresholdMs, 45 * 60_000);
});

test('loadRuntimeConfig accepts sqlite backend', () => {
  const config = loadRuntimeConfig({
    GATEWAY_STORE_BACKEND: 'sqlite',
    DATABASE_URL: './.data/gateway-hub.sqlite',
  });
  assert.equal(config.storeBackend, 'sqlite');
  assert.equal(config.databaseUrl, './.data/gateway-hub.sqlite');
});

test('loadRuntimeConfig accepts postgres backend', () => {
  const config = loadRuntimeConfig({
    AQUA_DEPLOYMENT_MODE: 'hosted',
    GATEWAY_STORE_BACKEND: 'postgres',
    DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/gateway_hub',
    PORT: '9999',
    HOST: '0.0.0.0',
    AQUA_HOSTED_OWNER_BOOTSTRAP_KEY: 'hosted-secret',
    AQUA_ONLINE_THRESHOLD_MS: '1200000',
    AQUA_RECENTLY_ACTIVE_THRESHOLD_MS: '2700000',
  });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 9999);
  assert.equal(config.storeBackend, 'postgres');
  assert.equal(config.databaseUrl, 'postgres://postgres:postgres@127.0.0.1:5432/gateway_hub');
  assert.equal(config.deploymentMode, 'hosted');
  assert.equal(config.hostedOwnerBootstrapKey, 'hosted-secret');
  assert.equal(config.onlineThresholdMs, 1_200_000);
  assert.equal(config.recentlyActiveThresholdMs, 2_700_000);
});

test('loadRuntimeConfig requires DATABASE_URL for sqlite backend', () => {
  assert.throws(
    () => loadRuntimeConfig({ GATEWAY_STORE_BACKEND: 'sqlite' }),
    /DATABASE_URL is required when GATEWAY_STORE_BACKEND=sqlite/,
  );
});

test('loadRuntimeConfig requires DATABASE_URL for postgres backend', () => {
  assert.throws(
    () => loadRuntimeConfig({ GATEWAY_STORE_BACKEND: 'postgres' }),
    /DATABASE_URL is required when GATEWAY_STORE_BACKEND=postgres/,
  );
});

test('loadRuntimeConfig rejects invalid backend values', () => {
  assert.throws(() => loadRuntimeConfig({ GATEWAY_STORE_BACKEND: 'mysql' }), /GATEWAY_STORE_BACKEND/);
});

test('loadRuntimeConfig rejects invalid deployment mode values', () => {
  assert.throws(() => loadRuntimeConfig({ AQUA_DEPLOYMENT_MODE: 'remote' }), /AQUA_DEPLOYMENT_MODE/);
});

test('loadRuntimeConfig rejects invalid presence timing windows', () => {
  assert.throws(
    () =>
      loadRuntimeConfig({
        AQUA_ONLINE_THRESHOLD_MS: '2700000',
        AQUA_RECENTLY_ACTIVE_THRESHOLD_MS: '1200000',
      }),
    /AQUA_RECENTLY_ACTIVE_THRESHOLD_MS must be greater than AQUA_ONLINE_THRESHOLD_MS/,
  );
});
