import {
  DEFAULT_ONLINE_THRESHOLD_MS,
  DEFAULT_RECENTLY_ACTIVE_THRESHOLD_MS,
  type StoreBackend,
} from './store.js';

export type DeploymentMode = 'local' | 'hosted';

export interface RuntimeConfig {
  host: string;
  port: number;
  storeBackend: StoreBackend;
  databaseUrl: string | null;
  deploymentMode: DeploymentMode;
  hostedOwnerBootstrapKey: string | null;
  onlineThresholdMs: number;
  recentlyActiveThresholdMs: number;
}

function parsePositiveInteger(value: string | undefined, label: string, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const host = env.HOST ?? '127.0.0.1';
  const port = Number(env.PORT ?? 8787);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('PORT must be a positive number');
  }

  const rawBackend = (env.GATEWAY_STORE_BACKEND ?? 'memory').trim().toLowerCase();
  if (rawBackend !== 'memory' && rawBackend !== 'sqlite' && rawBackend !== 'postgres') {
    throw new Error('GATEWAY_STORE_BACKEND must be one of: memory, sqlite, postgres');
  }

  const databaseUrl = env.DATABASE_URL?.trim() ? env.DATABASE_URL.trim() : null;
  if ((rawBackend === 'sqlite' || rawBackend === 'postgres') && !databaseUrl) {
    throw new Error(`DATABASE_URL is required when GATEWAY_STORE_BACKEND=${rawBackend}`);
  }

  const rawDeploymentMode = (env.AQUA_DEPLOYMENT_MODE ?? 'local').trim().toLowerCase();
  if (rawDeploymentMode !== 'local' && rawDeploymentMode !== 'hosted') {
    throw new Error('AQUA_DEPLOYMENT_MODE must be one of: local, hosted');
  }

  const hostedOwnerBootstrapKey = env.AQUA_HOSTED_OWNER_BOOTSTRAP_KEY?.trim() ? env.AQUA_HOSTED_OWNER_BOOTSTRAP_KEY.trim() : null;
  const onlineThresholdMs = parsePositiveInteger(
    env.AQUA_ONLINE_THRESHOLD_MS,
    'AQUA_ONLINE_THRESHOLD_MS',
    DEFAULT_ONLINE_THRESHOLD_MS,
  );
  const recentlyActiveThresholdMs = parsePositiveInteger(
    env.AQUA_RECENTLY_ACTIVE_THRESHOLD_MS,
    'AQUA_RECENTLY_ACTIVE_THRESHOLD_MS',
    DEFAULT_RECENTLY_ACTIVE_THRESHOLD_MS,
  );
  if (recentlyActiveThresholdMs <= onlineThresholdMs) {
    throw new Error('AQUA_RECENTLY_ACTIVE_THRESHOLD_MS must be greater than AQUA_ONLINE_THRESHOLD_MS');
  }

  return {
    host,
    port,
    storeBackend: rawBackend,
    databaseUrl,
    deploymentMode: rawDeploymentMode,
    hostedOwnerBootstrapKey,
    onlineThresholdMs,
    recentlyActiveThresholdMs,
  };
}
