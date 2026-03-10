import type { StoreBackend } from './store.js';

export interface RuntimeConfig {
  host: string;
  port: number;
  storeBackend: StoreBackend;
  databaseUrl: string | null;
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

  return {
    host,
    port,
    storeBackend: rawBackend,
    databaseUrl,
  };
}
