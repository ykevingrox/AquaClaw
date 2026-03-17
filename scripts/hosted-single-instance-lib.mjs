import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export function parseArgs(argv, options = {}) {
  const booleanKeys = new Set(options.booleanKeys ?? []);
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`unknown positional argument: ${token}`);
    }

    const key = token.slice(2);
    if (!key) {
      throw new Error('empty argument key');
    }

    if (booleanKeys.has(key)) {
      args[key] = true;
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }

  return args;
}

export function getRequiredArg(args, key) {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`--${key} is required`);
  }
  return value.trim();
}

export function getOptionalStringArg(args, key) {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getOptionalConfigEnvFileArg(args) {
  return getOptionalStringArg(args, 'config-env-file') ?? getOptionalStringArg(args, 'env-file');
}

export function normalizeBaseUrl(baseUrl) {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function loadEnvFile(envFilePath) {
  const resolvedPath = resolve(envFilePath);
  const content = readFileSync(resolvedPath, 'utf8');
  const env = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

export function resolveDatabasePath({ database, envFile }) {
  if (database?.trim()) {
    return resolve(database.trim());
  }
  if (!envFile?.trim()) {
    throw new Error('either --database or --config-env-file is required');
  }

  const env = loadEnvFile(envFile);
  if (!env.DATABASE_URL?.trim()) {
    throw new Error(`DATABASE_URL is missing in ${resolve(envFile)}`);
  }
  return resolve(env.DATABASE_URL.trim());
}

export function formatTimestamp(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'inherit',
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
}

export function isServiceActive(serviceName) {
  const result = spawnSync('systemctl', ['is-active', '--quiet', serviceName], {
    stdio: 'ignore',
  });
  if (result.error) {
    throw result.error;
  }
  return result.status === 0;
}

export function createBackupSnapshot({
  databasePath,
  backupDir,
  serviceName = null,
  leaveStopped = false,
  snapshotName = null,
}) {
  const resolvedDatabasePath = resolve(databasePath);
  const resolvedBackupDir = resolve(backupDir);
  if (!existsSync(resolvedDatabasePath)) {
    throw new Error(`database file does not exist: ${resolvedDatabasePath}`);
  }

  mkdirSync(resolvedBackupDir, { recursive: true });
  const defaultPrefix = basename(resolvedDatabasePath, '.sqlite') || 'gateway-hub';
  const resolvedSnapshotName = snapshotName?.trim() || `${defaultPrefix}-${formatTimestamp()}.sqlite`;
  const snapshotPath = join(resolvedBackupDir, resolvedSnapshotName);
  const serviceWasActive = serviceName ? isServiceActive(serviceName) : false;

  if (serviceName && serviceWasActive) {
    console.log(`Stopping ${serviceName} before backup...`);
    runCommand('systemctl', ['stop', serviceName]);
  }

  let copySucceeded = false;
  try {
    copyFileSync(resolvedDatabasePath, snapshotPath);
    copySucceeded = true;
    const bytes = statSync(snapshotPath).size;
    return {
      snapshotPath,
      bytes,
      serviceWasActive,
    };
  } finally {
    if (!copySucceeded && existsSync(snapshotPath)) {
      rmSync(snapshotPath, { force: true });
    }
    if (serviceName && serviceWasActive && !leaveStopped) {
      console.log(`Starting ${serviceName} after backup...`);
      runCommand('systemctl', ['start', serviceName]);
    }
  }
}

export function restoreBackupSnapshot({
  snapshotPath,
  databasePath,
  serviceName = null,
  owner = null,
  group = null,
  leaveStopped = false,
}) {
  const resolvedSnapshotPath = resolve(snapshotPath);
  const resolvedDatabasePath = resolve(databasePath);
  if (!existsSync(resolvedSnapshotPath)) {
    throw new Error(`snapshot file does not exist: ${resolvedSnapshotPath}`);
  }

  if (serviceName && isServiceActive(serviceName)) {
    console.log(`Stopping ${serviceName} before restore...`);
    runCommand('systemctl', ['stop', serviceName]);
  }

  mkdirSync(dirname(resolvedDatabasePath), { recursive: true });
  copyFileSync(resolvedSnapshotPath, resolvedDatabasePath);

  const resolvedOwner = owner?.trim() || null;
  const resolvedGroup = group?.trim() || resolvedOwner;
  if (resolvedOwner && resolvedGroup) {
    runCommand('chown', [`${resolvedOwner}:${resolvedGroup}`, resolvedDatabasePath]);
  }

  if (serviceName && !leaveStopped) {
    console.log(`Starting ${serviceName} after restore...`);
    runCommand('systemctl', ['start', serviceName]);
  }

  return {
    databasePath: resolvedDatabasePath,
  };
}

export async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 5_000;
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (error) {
        throw new Error(`expected JSON from ${url}, received: ${text.slice(0, 200)}`);
      }
    }

    return {
      status: response.status,
      json,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function assertJsonObject(value, label) {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} returned an invalid JSON body`);
  }
}

export async function runHostedSingleInstanceChecks(baseUrl, options = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const timeoutMs = options.timeoutMs ?? 5_000;
  const results = [];

  const health = await requestJson(`${normalizedBaseUrl}/health`, { timeoutMs });
  assertJsonObject(health.json, 'health');
  if (health.status !== 200 || health.json?.ok !== true || health.json?.data?.status !== 'ok') {
    throw new Error(`health check failed with status ${health.status}`);
  }
  results.push({ label: 'health', status: 'ok' });

  const ready = await requestJson(`${normalizedBaseUrl}/ready`, { timeoutMs });
  assertJsonObject(ready.json, 'ready');
  if (ready.status !== 200 || ready.json?.ok !== true || ready.json?.data?.status !== 'ready') {
    throw new Error(`ready check failed with status ${ready.status}`);
  }
  results.push({ label: 'ready', status: 'ok' });

  const publicCurrent = await requestJson(`${normalizedBaseUrl}/api/v1/public/current`, { timeoutMs });
  assertJsonObject(publicCurrent.json, 'public current');
  if (publicCurrent.status !== 200 || publicCurrent.json?.ok !== true || !publicCurrent.json?.data?.current?.key) {
    throw new Error(`public current check failed with status ${publicCurrent.status}`);
  }
  results.push({ label: 'public-current', status: 'ok' });

  const localGuard = await requestJson(`${normalizedBaseUrl}/api/v1/session/bootstrap-local`, {
    method: 'POST',
    timeoutMs,
  });
  assertJsonObject(localGuard.json, 'local guard');
  if (localGuard.status !== 403 || localGuard.json?.error?.code !== 'local_mode_only') {
    throw new Error(`local-mode guard check failed with status ${localGuard.status}`);
  }
  results.push({ label: 'local-mode-guard', status: 'ok' });

  return results;
}
