import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const LOCAL_DEV_CONFIG_VERSION = 1;
export const VALID_BACKENDS = new Set(['memory', 'sqlite']);
export const VALID_FEED_SCOPES = new Set(['mine', 'all', 'friends', 'system']);
export const VALID_VISIBILITIES = new Set(['private', 'invite_only', 'friends_only', 'public']);
const FALSEY_VALUES = new Set(['0', 'false', 'no', 'off']);

function currentUsername() {
  try {
    return os.userInfo().username || 'openclaw';
  } catch {
    return 'openclaw';
  }
}

export function slug(value, fallback) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

export function parsePort(value, label) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${label} must be a valid port`);
  }
  return parsed;
}

function parseBooleanish(value, label) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a boolean or string`);
  }
  return !FALSEY_VALUES.has(value.trim().toLowerCase());
}

function normalizeOptionalString(value, label) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
  return value.trim();
}

export function resolveLocalDevConfigPath(repoRoot, explicitPath = null, env = process.env) {
  const candidate = explicitPath?.trim() || env.AQUACLAW_LOCAL_DEV_CONFIG?.trim() || join(repoRoot, '.aquaclaw', 'local-dev.json');
  return resolve(candidate);
}

export function buildLocalDevBuiltinDefaults(repoRoot) {
  const username = currentUsername();
  return {
    backend: 'sqlite',
    bindRuntime: true,
    databaseUrl: join(repoRoot, '.data', 'aquarium-dev.sqlite'),
    feedScope: 'all',
    hubPort: 8787,
    installationId: slug(os.hostname(), 'local-installation'),
    openBrowser: true,
    ownerBio: '',
    ownerDisplayName: '',
    ownerHandle: '',
    ownerVisibility: '',
    runtimeId: `openclaw-${slug(username, 'local')}`,
    runtimeLabel: `${username}'s OpenClaw Runtime`,
    seedReef: true,
    webPort: 4173,
  };
}

export function loadLocalDevConfig(configPath) {
  const resolvedPath = resolve(configPath);
  if (!existsSync(resolvedPath)) {
    return null;
  }

  const content = readFileSync(resolvedPath, 'utf8');
  if (!content.trim()) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `failed to parse local dev config ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`local dev config ${resolvedPath} must be a JSON object`);
  }

  const version = parsed.version;
  if (version !== undefined && version !== LOCAL_DEV_CONFIG_VERSION) {
    throw new Error(
      `local dev config ${resolvedPath} uses unsupported version ${String(version)}; expected ${LOCAL_DEV_CONFIG_VERSION}`,
    );
  }

  return parsed;
}

export function buildLocalDevEnvOverrides(env = process.env) {
  const overrides = {};

  if (env.AQUACLAW_BACKEND !== undefined) {
    overrides.backend = env.AQUACLAW_BACKEND;
  }
  if (env.AQUACLAW_BIND_RUNTIME !== undefined) {
    overrides.bindRuntime = parseBooleanish(env.AQUACLAW_BIND_RUNTIME, 'AQUACLAW_BIND_RUNTIME');
  }
  if (env.AQUACLAW_DATABASE_URL !== undefined) {
    overrides.databaseUrl = env.AQUACLAW_DATABASE_URL;
  }
  if (env.AQUACLAW_FEED_SCOPE !== undefined) {
    overrides.feedScope = env.AQUACLAW_FEED_SCOPE;
  }
  if (env.AQUACLAW_HUB_PORT !== undefined) {
    overrides.hubPort = env.AQUACLAW_HUB_PORT;
  }
  if (env.AQUACLAW_INSTALLATION_ID !== undefined) {
    overrides.installationId = env.AQUACLAW_INSTALLATION_ID;
  }
  if (env.AQUACLAW_OPEN_BROWSER !== undefined) {
    overrides.openBrowser = parseBooleanish(env.AQUACLAW_OPEN_BROWSER, 'AQUACLAW_OPEN_BROWSER');
  }
  if (env.AQUACLAW_OWNER_BIO !== undefined) {
    overrides.ownerBio = env.AQUACLAW_OWNER_BIO;
  }
  if (env.AQUACLAW_OWNER_DISPLAY_NAME !== undefined) {
    overrides.ownerDisplayName = env.AQUACLAW_OWNER_DISPLAY_NAME;
  }
  if (env.AQUACLAW_OWNER_HANDLE !== undefined) {
    overrides.ownerHandle = env.AQUACLAW_OWNER_HANDLE;
  }
  if (env.AQUACLAW_OWNER_VISIBILITY !== undefined) {
    overrides.ownerVisibility = env.AQUACLAW_OWNER_VISIBILITY;
  }
  if (env.AQUACLAW_RUNTIME_ID !== undefined) {
    overrides.runtimeId = env.AQUACLAW_RUNTIME_ID;
  }
  if (env.AQUACLAW_RUNTIME_LABEL !== undefined) {
    overrides.runtimeLabel = env.AQUACLAW_RUNTIME_LABEL;
  }
  if (env.AQUACLAW_SEED_REEF !== undefined) {
    overrides.seedReef = parseBooleanish(env.AQUACLAW_SEED_REEF, 'AQUACLAW_SEED_REEF');
  }
  if (env.AQUACLAW_WEB_PORT !== undefined) {
    overrides.webPort = env.AQUACLAW_WEB_PORT;
  }

  return overrides;
}

export function applyLocalDevOverrides(target, overrides = {}) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      target[key] = value;
    }
  }
}

export function validateLocalDevOptions(options) {
  const normalized = {
    backend: String(options.backend ?? '').trim().toLowerCase(),
    bindRuntime: parseBooleanish(options.bindRuntime ?? true, 'bindRuntime'),
    databaseUrl: normalizeOptionalString(options.databaseUrl, 'databaseUrl'),
    feedScope: String(options.feedScope ?? '').trim(),
    hubPort: parsePort(options.hubPort ?? 8787, 'hub port'),
    installationId: normalizeOptionalString(options.installationId, 'installationId'),
    openBrowser: parseBooleanish(options.openBrowser ?? true, 'openBrowser'),
    ownerBio: normalizeOptionalString(options.ownerBio, 'ownerBio'),
    ownerDisplayName: normalizeOptionalString(options.ownerDisplayName, 'ownerDisplayName'),
    ownerHandle: normalizeOptionalString(options.ownerHandle, 'ownerHandle'),
    ownerVisibility: normalizeOptionalString(options.ownerVisibility, 'ownerVisibility'),
    runtimeId: normalizeOptionalString(options.runtimeId, 'runtimeId'),
    runtimeLabel: normalizeOptionalString(options.runtimeLabel, 'runtimeLabel'),
    seedReef: parseBooleanish(options.seedReef ?? true, 'seedReef'),
    webPort: parsePort(options.webPort ?? 4173, 'web-console port'),
  };

  if (!VALID_BACKENDS.has(normalized.backend)) {
    throw new Error('backend must be memory or sqlite');
  }
  if (!VALID_FEED_SCOPES.has(normalized.feedScope)) {
    throw new Error('feed scope must be one of: mine, all, friends, system');
  }
  if (normalized.ownerVisibility && !VALID_VISIBILITIES.has(normalized.ownerVisibility)) {
    throw new Error('owner visibility must be one of: private, invite_only, friends_only, public');
  }
  if (normalized.backend === 'sqlite' && !normalized.databaseUrl) {
    throw new Error('databaseUrl is required when backend=sqlite');
  }
  if (normalized.backend === 'memory') {
    normalized.databaseUrl = '';
  }

  return normalized;
}

export function serializeLocalDevConfig(options) {
  return {
    version: LOCAL_DEV_CONFIG_VERSION,
    ...options,
  };
}

export function writeLocalDevConfig(configPath, config) {
  const resolvedPath = resolve(configPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return resolvedPath;
}
