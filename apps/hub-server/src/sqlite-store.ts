import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import {
  InMemoryGatewayStore,
  type EncounterSynthesisRules,
  type GatewayStore,
  type GatewayStoreSnapshot,
  type SeaEvent,
  type SeaEventListener,
  type SeaEventLiveSource,
  type StoreReadinessStatus,
} from './store.js';

const SQLITE_SCHEMA_SQL = `
create table if not exists gateway_store_state (
  id integer primary key check (id = 1),
  snapshot_json text not null,
  updated_at text not null
);
`;

interface CreateSqliteGatewayStoreOptions {
  databaseUrl: string;
  encounterRules?: Partial<EncounterSynthesisRules>;
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
  private readonly inner: InMemoryGatewayStore;
  private readonly db: DatabaseSync;

  constructor(options: CreateSqliteGatewayStoreOptions) {
    const databasePath = resolveSqliteDatabasePath(options.databaseUrl);
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    this.db = new DatabaseSync(databasePath);
    this.db.exec(SQLITE_SCHEMA_SQL);
    this.inner = new InMemoryGatewayStore({ encounterRules: options.encounterRules });
    this.loadSnapshot();
  }

  close() {
    this.db.close();
  }

  checkReadiness(): StoreReadinessStatus {
    try {
      this.db.prepare('select 1 as ready').get();
      this.db.exec('begin immediate');
      this.db.exec('rollback');
      return {
        ok: true,
        backend: 'sqlite',
      };
    } catch (error) {
      return {
        ok: false,
        backend: 'sqlite',
        detail: error instanceof Error ? error.message : 'unknown sqlite readiness failure',
      };
    }
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

  findHostById(...args: Parameters<GatewayStore['findHostById']>): ReturnType<GatewayStore['findHostById']> {
    return this.inner.findHostById(...args);
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

  getHostedRegistrationPolicy(
    ...args: Parameters<GatewayStore['getHostedRegistrationPolicy']>
  ): ReturnType<GatewayStore['getHostedRegistrationPolicy']> {
    return this.inner.getHostedRegistrationPolicy(...args);
  }

  setHostedRegistrationPolicy(
    ...args: Parameters<GatewayStore['setHostedRegistrationPolicy']>
  ): ReturnType<GatewayStore['setHostedRegistrationPolicy']> {
    return this.runMutation(() => this.inner.setHostedRegistrationPolicy(...args));
  }

  getSocialPulsePolicy(
    ...args: Parameters<GatewayStore['getSocialPulsePolicy']>
  ): ReturnType<GatewayStore['getSocialPulsePolicy']> {
    return this.inner.getSocialPulsePolicy(...args);
  }

  updateSocialPulsePolicy(
    ...args: Parameters<GatewayStore['updateSocialPulsePolicy']>
  ): ReturnType<GatewayStore['updateSocialPulsePolicy']> {
    return this.runMutation(() => this.inner.updateSocialPulsePolicy(...args));
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

  joinHostedRuntimeWithInvite(
    ...args: Parameters<GatewayStore['joinHostedRuntimeWithInvite']>
  ): ReturnType<GatewayStore['joinHostedRuntimeWithInvite']> {
    return this.runMutation(() => this.inner.joinHostedRuntimeWithInvite(...args));
  }

  getOrCreateGatewayReconnectCredential(
    ...args: Parameters<GatewayStore['getOrCreateGatewayReconnectCredential']>
  ): ReturnType<GatewayStore['getOrCreateGatewayReconnectCredential']> {
    return this.runMutation(() => this.inner.getOrCreateGatewayReconnectCredential(...args));
  }

  rotateGatewayReconnectCredential(
    ...args: Parameters<GatewayStore['rotateGatewayReconnectCredential']>
  ): ReturnType<GatewayStore['rotateGatewayReconnectCredential']> {
    return this.runMutation(() => this.inner.rotateGatewayReconnectCredential(...args));
  }

  reconnectGatewayByReconnectToken(
    ...args: Parameters<GatewayStore['reconnectGatewayByReconnectToken']>
  ): ReturnType<GatewayStore['reconnectGatewayByReconnectToken']> {
    return this.runMutation(() => this.inner.reconnectGatewayByReconnectToken(...args));
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

  getAquaProfile(...args: Parameters<GatewayStore['getAquaProfile']>): ReturnType<GatewayStore['getAquaProfile']> {
    return this.inner.getAquaProfile(...args);
  }

  updateAquaProfile(...args: Parameters<GatewayStore['updateAquaProfile']>): ReturnType<GatewayStore['updateAquaProfile']> {
    return this.runMutation(() => this.inner.updateAquaProfile(...args));
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

  listPublicGateways(
    ...args: Parameters<GatewayStore['listPublicGateways']>
  ): ReturnType<GatewayStore['listPublicGateways']> {
    return this.inner.listPublicGateways(...args);
  }

  createInvite(...args: Parameters<GatewayStore['createInvite']>): ReturnType<GatewayStore['createInvite']> {
    return this.runMutation(() => this.inner.createInvite(...args));
  }

  revokeInvite(...args: Parameters<GatewayStore['revokeInvite']>): ReturnType<GatewayStore['revokeInvite']> {
    return this.runMutation(() => this.inner.revokeInvite(...args));
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

  listIncomingTaskRequests(
    ...args: Parameters<GatewayStore['listIncomingTaskRequests']>
  ): ReturnType<GatewayStore['listIncomingTaskRequests']> {
    return this.inner.listIncomingTaskRequests(...args);
  }

  listOutgoingTaskRequests(
    ...args: Parameters<GatewayStore['listOutgoingTaskRequests']>
  ): ReturnType<GatewayStore['listOutgoingTaskRequests']> {
    return this.inner.listOutgoingTaskRequests(...args);
  }

  createTaskRequest(
    ...args: Parameters<GatewayStore['createTaskRequest']>
  ): ReturnType<GatewayStore['createTaskRequest']> {
    return this.runMutation(() => this.inner.createTaskRequest(...args));
  }

  acceptTaskRequest(
    ...args: Parameters<GatewayStore['acceptTaskRequest']>
  ): ReturnType<GatewayStore['acceptTaskRequest']> {
    return this.runMutation(() => this.inner.acceptTaskRequest(...args));
  }

  declineTaskRequest(
    ...args: Parameters<GatewayStore['declineTaskRequest']>
  ): ReturnType<GatewayStore['declineTaskRequest']> {
    return this.runMutation(() => this.inner.declineTaskRequest(...args));
  }

  cancelTaskRequest(
    ...args: Parameters<GatewayStore['cancelTaskRequest']>
  ): ReturnType<GatewayStore['cancelTaskRequest']> {
    return this.runMutation(() => this.inner.cancelTaskRequest(...args));
  }

  completeTaskRequest(
    ...args: Parameters<GatewayStore['completeTaskRequest']>
  ): ReturnType<GatewayStore['completeTaskRequest']> {
    return this.runMutation(() => this.inner.completeTaskRequest(...args));
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

  createPublicExpression(
    ...args: Parameters<GatewayStore['createPublicExpression']>
  ): ReturnType<GatewayStore['createPublicExpression']> {
    return this.runMutation(() => this.inner.createPublicExpression(...args));
  }

  listPublicExpressions(
    ...args: Parameters<GatewayStore['listPublicExpressions']>
  ): ReturnType<GatewayStore['listPublicExpressions']> {
    return this.inner.listPublicExpressions(...args);
  }

  listMessages(...args: Parameters<GatewayStore['listMessages']>): ReturnType<GatewayStore['listMessages']> {
    return this.inner.listMessages(...args);
  }

  getConversationReadState(
    ...args: Parameters<GatewayStore['getConversationReadState']>
  ): ReturnType<GatewayStore['getConversationReadState']> {
    return this.inner.getConversationReadState(...args);
  }

  markConversationRead(
    ...args: Parameters<GatewayStore['markConversationRead']>
  ): ReturnType<GatewayStore['markConversationRead']> {
    return this.runMutation(() => this.inner.markConversationRead(...args));
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

  listPublicSeaFeed(
    ...args: Parameters<GatewayStore['listPublicSeaFeed']>
  ): ReturnType<GatewayStore['listPublicSeaFeed']> {
    return this.inner.listPublicSeaFeed(...args);
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

  getEnvironment(...args: Parameters<GatewayStore['getEnvironment']>): ReturnType<GatewayStore['getEnvironment']> {
    const snapshotBefore = this.inner.exportSnapshot();
    const environment = this.inner.getEnvironment(...args);
    const snapshotAfter = this.inner.exportSnapshot();
    if (
      snapshotBefore.activeCurrentId !== snapshotAfter.activeCurrentId ||
      snapshotBefore.activeEnvironmentId !== snapshotAfter.activeEnvironmentId
    ) {
      this.persistSnapshot();
    }
    return environment;
  }

  setEnvironment(...args: Parameters<GatewayStore['setEnvironment']>): ReturnType<GatewayStore['setEnvironment']> {
    return this.runMutation(() => this.inner.setEnvironment(...args));
  }

  recordEncounter(
    ...args: Parameters<GatewayStore['recordEncounter']>
  ): ReturnType<GatewayStore['recordEncounter']> {
    return this.runMutation(() => this.inner.recordEncounter(...args));
  }

  listEncounters(...args: Parameters<GatewayStore['listEncounters']>): ReturnType<GatewayStore['listEncounters']> {
    return this.inner.listEncounters(...args);
  }

  evaluateSocialPulse(
    ...args: Parameters<GatewayStore['evaluateSocialPulse']>
  ): ReturnType<GatewayStore['evaluateSocialPulse']> {
    return this.inner.evaluateSocialPulse(...args);
  }

  evaluateGatewaySocialPulse(
    ...args: Parameters<GatewayStore['evaluateGatewaySocialPulse']>
  ): ReturnType<GatewayStore['evaluateGatewaySocialPulse']> {
    return this.inner.evaluateGatewaySocialPulse(...args);
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
