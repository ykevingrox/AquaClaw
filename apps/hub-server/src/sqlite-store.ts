import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import { InMemoryGatewayStore, type GatewayStore, type GatewayStoreSnapshot, type SeaEvent, type SeaEventListener, type SeaEventLiveSource } from './store.js';

const SQLITE_SCHEMA_SQL = `
create table if not exists gateway_store_state (
  id integer primary key check (id = 1),
  snapshot_json text not null,
  updated_at text not null
);
`;

interface CreateSqliteGatewayStoreOptions {
  databaseUrl: string;
}

function resolveSqliteDatabasePath(databaseUrl: string) {
  const normalized = databaseUrl.trim();
  if (!normalized) {
    throw new Error('databaseUrl is required for sqlite store backend');
  }
  if (normalized === ':memory:' || normalized === 'file::memory:') {
    return ':memory:';
  }
  if (normalized.startsWith('file:')) {
    return fileURLToPath(new URL(normalized));
  }
  return resolve(normalized);
}

export class SqliteGatewayStore implements GatewayStore, SeaEventLiveSource {
  private readonly inner = new InMemoryGatewayStore();
  private readonly db: DatabaseSync;

  constructor(options: CreateSqliteGatewayStoreOptions) {
    const databasePath = resolveSqliteDatabasePath(options.databaseUrl);
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    this.db = new DatabaseSync(databasePath);
    this.db.exec(SQLITE_SCHEMA_SQL);
    this.loadSnapshot();
  }

  close() {
    this.db.close();
  }

  private loadSnapshot() {
    const row = this.db
      .prepare('select snapshot_json from gateway_store_state where id = 1')
      .get() as { snapshot_json: string } | undefined;
    if (!row) {
      return;
    }

    const snapshot = JSON.parse(row.snapshot_json) as GatewayStoreSnapshot;
    this.inner.importSnapshot(snapshot);
  }

  private persistSnapshot() {
    const snapshotJson = JSON.stringify(this.inner.exportSnapshot());
    this.db
      .prepare(
        `insert into gateway_store_state (id, snapshot_json, updated_at)
         values (1, ?, ?)
         on conflict(id) do update
           set snapshot_json = excluded.snapshot_json,
               updated_at = excluded.updated_at`,
      )
      .run(snapshotJson, new Date().toISOString());
  }

  private runMutation<T>(fn: () => T) {
    const result = fn();
    this.persistSnapshot();
    return result;
  }

  register(...args: Parameters<GatewayStore['register']>): ReturnType<GatewayStore['register']> {
    return this.runMutation(() => this.inner.register(...args));
  }

  bootstrapLocalSession(
    ...args: Parameters<GatewayStore['bootstrapLocalSession']>
  ): ReturnType<GatewayStore['bootstrapLocalSession']> {
    return this.runMutation(() => this.inner.bootstrapLocalSession(...args));
  }

  bootstrapHostedSession(
    ...args: Parameters<GatewayStore['bootstrapHostedSession']>
  ): ReturnType<GatewayStore['bootstrapHostedSession']> {
    return this.runMutation(() => this.inner.bootstrapHostedSession(...args));
  }

  findHostedSessionByToken(
    ...args: Parameters<GatewayStore['findHostedSessionByToken']>
  ): ReturnType<GatewayStore['findHostedSessionByToken']> {
    return this.inner.findHostedSessionByToken(...args);
  }

  logoutHostedSession(
    ...args: Parameters<GatewayStore['logoutHostedSession']>
  ): ReturnType<GatewayStore['logoutHostedSession']> {
    return this.runMutation(() => this.inner.logoutHostedSession(...args));
  }

  revokeHostedSessions(
    ...args: Parameters<GatewayStore['revokeHostedSessions']>
  ): ReturnType<GatewayStore['revokeHostedSessions']> {
    return this.runMutation(() => this.inner.revokeHostedSessions(...args));
  }

  getLocalRuntimeBinding(
    ...args: Parameters<GatewayStore['getLocalRuntimeBinding']>
  ): ReturnType<GatewayStore['getLocalRuntimeBinding']> {
    return this.inner.getLocalRuntimeBinding(...args);
  }

  bindLocalRuntime(...args: Parameters<GatewayStore['bindLocalRuntime']>): ReturnType<GatewayStore['bindLocalRuntime']> {
    return this.runMutation(() => this.inner.bindLocalRuntime(...args));
  }

  createRemoteRuntimeBridgeCredential(
    ...args: Parameters<GatewayStore['createRemoteRuntimeBridgeCredential']>
  ): ReturnType<GatewayStore['createRemoteRuntimeBridgeCredential']> {
    return this.runMutation(() => this.inner.createRemoteRuntimeBridgeCredential(...args));
  }

  revokeRemoteRuntimeBridgeCredential(
    ...args: Parameters<GatewayStore['revokeRemoteRuntimeBridgeCredential']>
  ): ReturnType<GatewayStore['revokeRemoteRuntimeBridgeCredential']> {
    return this.runMutation(() => this.inner.revokeRemoteRuntimeBridgeCredential(...args));
  }

  bindRemoteRuntime(...args: Parameters<GatewayStore['bindRemoteRuntime']>): ReturnType<GatewayStore['bindRemoteRuntime']> {
    return this.runMutation(() => this.inner.bindRemoteRuntime(...args));
  }

  getRemoteRuntimeBindingByGatewayId(
    ...args: Parameters<GatewayStore['getRemoteRuntimeBindingByGatewayId']>
  ): ReturnType<GatewayStore['getRemoteRuntimeBindingByGatewayId']> {
    return this.inner.getRemoteRuntimeBindingByGatewayId(...args);
  }

  seedLocalReefSandbox(
    ...args: Parameters<GatewayStore['seedLocalReefSandbox']>
  ): ReturnType<GatewayStore['seedLocalReefSandbox']> {
    return this.runMutation(() => this.inner.seedLocalReefSandbox(...args));
  }

  findById(...args: Parameters<GatewayStore['findById']>): ReturnType<GatewayStore['findById']> {
    return this.inner.findById(...args);
  }

  findByToken(...args: Parameters<GatewayStore['findByToken']>): ReturnType<GatewayStore['findByToken']> {
    return this.inner.findByToken(...args);
  }

  findLocalSessionByToken(
    ...args: Parameters<GatewayStore['findLocalSessionByToken']>
  ): ReturnType<GatewayStore['findLocalSessionByToken']> {
    return this.inner.findLocalSessionByToken(...args);
  }

  logoutLocalSession(...args: Parameters<GatewayStore['logoutLocalSession']>): ReturnType<GatewayStore['logoutLocalSession']> {
    return this.runMutation(() => this.inner.logoutLocalSession(...args));
  }

  canViewGatewayProfile(
    ...args: Parameters<GatewayStore['canViewGatewayProfile']>
  ): ReturnType<GatewayStore['canViewGatewayProfile']> {
    return this.inner.canViewGatewayProfile(...args);
  }

  updateProfile(...args: Parameters<GatewayStore['updateProfile']>): ReturnType<GatewayStore['updateProfile']> {
    return this.runMutation(() => this.inner.updateProfile(...args));
  }

  getPresence(...args: Parameters<GatewayStore['getPresence']>): ReturnType<GatewayStore['getPresence']> {
    return this.inner.getPresence(...args);
  }

  searchGateways(...args: Parameters<GatewayStore['searchGateways']>): ReturnType<GatewayStore['searchGateways']> {
    return this.inner.searchGateways(...args);
  }

  createInvite(...args: Parameters<GatewayStore['createInvite']>): ReturnType<GatewayStore['createInvite']> {
    return this.runMutation(() => this.inner.createInvite(...args));
  }

  claimInvite(...args: Parameters<GatewayStore['claimInvite']>): ReturnType<GatewayStore['claimInvite']> {
    return this.runMutation(() => this.inner.claimInvite(...args));
  }

  listIncomingFriendRequests(
    ...args: Parameters<GatewayStore['listIncomingFriendRequests']>
  ): ReturnType<GatewayStore['listIncomingFriendRequests']> {
    return this.inner.listIncomingFriendRequests(...args);
  }

  listOutgoingFriendRequests(
    ...args: Parameters<GatewayStore['listOutgoingFriendRequests']>
  ): ReturnType<GatewayStore['listOutgoingFriendRequests']> {
    return this.inner.listOutgoingFriendRequests(...args);
  }

  createFriendRequest(
    ...args: Parameters<GatewayStore['createFriendRequest']>
  ): ReturnType<GatewayStore['createFriendRequest']> {
    return this.runMutation(() => this.inner.createFriendRequest(...args));
  }

  acceptFriendRequest(
    ...args: Parameters<GatewayStore['acceptFriendRequest']>
  ): ReturnType<GatewayStore['acceptFriendRequest']> {
    return this.runMutation(() => this.inner.acceptFriendRequest(...args));
  }

  rejectFriendRequest(
    ...args: Parameters<GatewayStore['rejectFriendRequest']>
  ): ReturnType<GatewayStore['rejectFriendRequest']> {
    return this.runMutation(() => this.inner.rejectFriendRequest(...args));
  }

  listFriends(...args: Parameters<GatewayStore['listFriends']>): ReturnType<GatewayStore['listFriends']> {
    return this.inner.listFriends(...args);
  }

  removeFriendship(
    ...args: Parameters<GatewayStore['removeFriendship']>
  ): ReturnType<GatewayStore['removeFriendship']> {
    return this.runMutation(() => this.inner.removeFriendship(...args));
  }

  listFriendScopes(
    ...args: Parameters<GatewayStore['listFriendScopes']>
  ): ReturnType<GatewayStore['listFriendScopes']> {
    return this.inner.listFriendScopes(...args);
  }

  updateFriendScopes(
    ...args: Parameters<GatewayStore['updateFriendScopes']>
  ): ReturnType<GatewayStore['updateFriendScopes']> {
    return this.runMutation(() => this.inner.updateFriendScopes(...args));
  }

  createBlock(...args: Parameters<GatewayStore['createBlock']>): ReturnType<GatewayStore['createBlock']> {
    return this.runMutation(() => this.inner.createBlock(...args));
  }

  removeBlock(...args: Parameters<GatewayStore['removeBlock']>): ReturnType<GatewayStore['removeBlock']> {
    return this.runMutation(() => this.inner.removeBlock(...args));
  }

  listConversations(
    ...args: Parameters<GatewayStore['listConversations']>
  ): ReturnType<GatewayStore['listConversations']> {
    return this.inner.listConversations(...args);
  }

  createMessage(...args: Parameters<GatewayStore['createMessage']>): ReturnType<GatewayStore['createMessage']> {
    return this.runMutation(() => this.inner.createMessage(...args));
  }

  listMessages(...args: Parameters<GatewayStore['listMessages']>): ReturnType<GatewayStore['listMessages']> {
    return this.inner.listMessages(...args);
  }

  heartbeatPresence(
    ...args: Parameters<GatewayStore['heartbeatPresence']>
  ): ReturnType<GatewayStore['heartbeatPresence']> {
    return this.runMutation(() => this.inner.heartbeatPresence(...args));
  }

  heartbeatLocalRuntime(
    ...args: Parameters<GatewayStore['heartbeatLocalRuntime']>
  ): ReturnType<GatewayStore['heartbeatLocalRuntime']> {
    return this.runMutation(() => this.inner.heartbeatLocalRuntime(...args));
  }

  heartbeatRemoteRuntime(
    ...args: Parameters<GatewayStore['heartbeatRemoteRuntime']>
  ): ReturnType<GatewayStore['heartbeatRemoteRuntime']> {
    return this.runMutation(() => this.inner.heartbeatRemoteRuntime(...args));
  }

  canViewPresence(
    ...args: Parameters<GatewayStore['canViewPresence']>
  ): ReturnType<GatewayStore['canViewPresence']> {
    return this.inner.canViewPresence(...args);
  }

  isBlockedBetween(
    ...args: Parameters<GatewayStore['isBlockedBetween']>
  ): ReturnType<GatewayStore['isBlockedBetween']> {
    return this.inner.isBlockedBetween(...args);
  }

  listAuditRecords(
    ...args: Parameters<GatewayStore['listAuditRecords']>
  ): ReturnType<GatewayStore['listAuditRecords']> {
    return this.inner.listAuditRecords(...args);
  }

  listSeaFeed(...args: Parameters<GatewayStore['listSeaFeed']>): ReturnType<GatewayStore['listSeaFeed']> {
    return this.inner.listSeaFeed(...args);
  }

  listGatewayActivity(
    ...args: Parameters<GatewayStore['listGatewayActivity']>
  ): ReturnType<GatewayStore['listGatewayActivity']> {
    return this.inner.listGatewayActivity(...args);
  }

  canViewSeaEvent(...args: [viewerGatewayId: string, event: SeaEvent]): boolean {
    return this.inner.canViewSeaEvent(...args);
  }

  addSeaEventListener(listener: SeaEventListener) {
    return this.inner.addSeaEventListener(listener);
  }

  getCurrent(...args: Parameters<GatewayStore['getCurrent']>): ReturnType<GatewayStore['getCurrent']> {
    const before = this.inner.exportSnapshot().activeCurrentId;
    const current = this.inner.getCurrent(...args);
    if (before !== this.inner.exportSnapshot().activeCurrentId) {
      this.persistSnapshot();
    }
    return current;
  }

  setCurrent(...args: Parameters<GatewayStore['setCurrent']>): ReturnType<GatewayStore['setCurrent']> {
    return this.runMutation(() => this.inner.setCurrent(...args));
  }

  recordEncounter(
    ...args: Parameters<GatewayStore['recordEncounter']>
  ): ReturnType<GatewayStore['recordEncounter']> {
    return this.runMutation(() => this.inner.recordEncounter(...args));
  }

  listEncounters(...args: Parameters<GatewayStore['listEncounters']>): ReturnType<GatewayStore['listEncounters']> {
    return this.inner.listEncounters(...args);
  }

  createScene(...args: Parameters<GatewayStore['createScene']>): ReturnType<GatewayStore['createScene']> {
    return this.runMutation(() => this.inner.createScene(...args));
  }

  generateScene(...args: Parameters<GatewayStore['generateScene']>): ReturnType<GatewayStore['generateScene']> {
    return this.runMutation(() => this.inner.generateScene(...args));
  }

  listScenes(...args: Parameters<GatewayStore['listScenes']>): ReturnType<GatewayStore['listScenes']> {
    return this.inner.listScenes(...args);
  }
}

export function createSqliteGatewayStore(options: CreateSqliteGatewayStoreOptions): GatewayStore {
  return new SqliteGatewayStore(options);
}
