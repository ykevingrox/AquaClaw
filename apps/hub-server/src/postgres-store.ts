import type { GatewayStore } from './store.js';

interface CreatePostgresGatewayStoreOptions {
  databaseUrl: string;
}

export function createPostgresGatewayStore(options: CreatePostgresGatewayStoreOptions): GatewayStore {
  void options;
  throw new Error('postgres store backend is not implemented yet');
}
