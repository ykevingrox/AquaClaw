#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import {
  getOptionalConfigEnvFileArg,
  getOptionalStringArg,
  loadEnvFile,
  normalizeBaseUrl,
  parseArgs,
  requestJson,
} from './hosted-single-instance-lib.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_STATE_FILE = '.data/aqua-community-cast-loop-state.json';
const DEFAULT_MIN_INTERVAL_SECONDS = 20 * 60;
const DEFAULT_JITTER_SECONDS = 15 * 60;
const DEFAULT_FAILURE_MIN_SECONDS = 2 * 60;
const DEFAULT_FAILURE_JITTER_SECONDS = 2 * 60;
const DEFAULT_TIMEOUT_MS = 30_000;
const LABEL = 'aqua-community-cast-loop';

function printHelp() {
  console.log(`Usage: node scripts/aqua-community-cast-loop.mjs [options]

Options:
  --base-url URL                  AquaClaw base URL. Defaults to HOST/PORT from --config-env-file, then ${DEFAULT_BASE_URL}
  --bootstrap-key KEY             Hosted owner bootstrap key. Defaults to AQUA_HOSTED_OWNER_BOOTSTRAP_KEY or the env file value
  --config-env-file PATH          Env file with AQUA_HOSTED_OWNER_BOOTSTRAP_KEY and optional HOST/PORT
  --state-file PATH               Loop state file (default: ${DEFAULT_STATE_FILE})
  --min-seconds N                 Success-path base delay in seconds (default: ${DEFAULT_MIN_INTERVAL_SECONDS})
  --jitter-seconds N              Success-path extra random delay in seconds (default: ${DEFAULT_JITTER_SECONDS})
  --failure-min-seconds N         Failure retry base delay in seconds (default: ${DEFAULT_FAILURE_MIN_SECONDS})
  --failure-jitter-seconds N      Failure retry extra random delay in seconds (default: ${DEFAULT_FAILURE_JITTER_SECONDS})
  --timeout-ms N                  Per-request timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --once                          Run exactly one tick and print JSON
  --help                          Show this message
`);
}

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, label) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function trimToNull(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveStateFile(filePath) {
  return path.resolve(filePath || DEFAULT_STATE_FILE);
}

function resolveBootstrapKey(args, envFile) {
  const explicit = getOptionalStringArg(args, 'bootstrap-key') ?? trimToNull(process.env.AQUA_HOSTED_OWNER_BOOTSTRAP_KEY);
  if (explicit) {
    return explicit;
  }
  if (!envFile) {
    throw new Error('either --bootstrap-key, AQUA_HOSTED_OWNER_BOOTSTRAP_KEY, or --config-env-file is required');
  }
  const env = loadEnvFile(envFile);
  const bootstrapKey = env.AQUA_HOSTED_OWNER_BOOTSTRAP_KEY?.trim();
  if (!bootstrapKey) {
    throw new Error(`AQUA_HOSTED_OWNER_BOOTSTRAP_KEY is missing in ${path.resolve(envFile)}`);
  }
  return bootstrapKey;
}

function resolveBaseUrl(args, envFile) {
  const explicit = getOptionalStringArg(args, 'base-url') ?? trimToNull(process.env.AQUA_COMMUNITY_CAST_BASE_URL);
  if (explicit) {
    return normalizeBaseUrl(explicit);
  }

  if (envFile) {
    const env = loadEnvFile(envFile);
    const host = env.HOST?.trim();
    const port = env.PORT?.trim();
    if (host && port) {
      return normalizeBaseUrl(`http://${host}:${port}`);
    }
  }

  return normalizeBaseUrl(DEFAULT_BASE_URL);
}

function parseOptions(argv) {
  const args = parseArgs(argv, {
    booleanKeys: ['help', 'once'],
  });

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const configEnvFile = getOptionalConfigEnvFileArg(args);
  if (configEnvFile) {
    const env = loadEnvFile(configEnvFile);
    const deploymentMode = env.AQUA_DEPLOYMENT_MODE?.trim();
    if (deploymentMode && deploymentMode !== 'hosted') {
      throw new Error(`community cast loop requires hosted deployment mode, received: ${deploymentMode}`);
    }
  }

  return {
    baseUrl: resolveBaseUrl(args, configEnvFile),
    bootstrapKey: resolveBootstrapKey(args, configEnvFile),
    configEnvFile: configEnvFile ? path.resolve(configEnvFile) : null,
    failureJitterSeconds: parseNonNegativeInteger(
      getOptionalStringArg(args, 'failure-jitter-seconds') ?? DEFAULT_FAILURE_JITTER_SECONDS,
      '--failure-jitter-seconds',
    ),
    failureMinSeconds: parsePositiveInteger(
      getOptionalStringArg(args, 'failure-min-seconds') ?? DEFAULT_FAILURE_MIN_SECONDS,
      '--failure-min-seconds',
    ),
    jitterSeconds: parseNonNegativeInteger(
      getOptionalStringArg(args, 'jitter-seconds') ?? DEFAULT_JITTER_SECONDS,
      '--jitter-seconds',
    ),
    minIntervalSeconds: parsePositiveInteger(
      getOptionalStringArg(args, 'min-seconds') ?? DEFAULT_MIN_INTERVAL_SECONDS,
      '--min-seconds',
    ),
    once: args.once === true,
    stateFile: resolveStateFile(getOptionalStringArg(args, 'state-file')),
    timeoutMs: parsePositiveInteger(
      getOptionalStringArg(args, 'timeout-ms') ?? DEFAULT_TIMEOUT_MS,
      '--timeout-ms',
    ),
  };
}

function buildDelayMs(minSeconds, jitterSeconds, randomValue = Math.random()) {
  const clampedRandom = Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), 0.999999) : 0;
  const jitter = jitterSeconds > 0 ? Math.floor(clampedRandom * (jitterSeconds + 1)) : 0;
  return (minSeconds + jitter) * 1_000;
}

function log(level, message, extra = undefined) {
  const prefix = `[${new Date().toISOString()}] [${LABEL}] [${level}]`;
  if (extra === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }
  console.log(`${prefix} ${message} ${JSON.stringify(extra)}`);
}

async function loadState(stateFile) {
  try {
    const raw = await readFile(stateFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    return null;
  }
}

async function saveState(stateFile, state) {
  await mkdir(path.dirname(stateFile), { recursive: true, mode: 0o750 });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function buildRequestError(response, fallbackMessage) {
  const error = new Error(response.json?.error?.message || fallbackMessage);
  error.statusCode = response.status;
  error.payload = response.json ?? null;
  return error;
}

function isAuthError(error) {
  return Boolean(error && typeof error === 'object' && 'statusCode' in error && (error.statusCode === 401 || error.statusCode === 403));
}

async function bootstrapHostedOwnerSession(baseUrl, bootstrapKey, timeoutMs) {
  const response = await requestJson(`${baseUrl}/api/v1/session/bootstrap-hosted`, {
    method: 'POST',
    timeoutMs,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      bootstrapKey,
    }),
  });
  if (response.status !== 200 && response.status !== 201) {
    throw buildRequestError(response, 'failed to bootstrap hosted owner session');
  }

  const token = response.json?.data?.credential?.token;
  const sessionId = response.json?.data?.session?.id;
  const hostId = response.json?.data?.host?.id;
  if (!token || !sessionId || !hostId) {
    throw new Error('bootstrap-hosted returned an invalid response payload');
  }

  return {
    bootstrappedAt: new Date().toISOString(),
    hostId,
    sessionId,
    token,
  };
}

async function runCommunityCast(baseUrl, token, timeoutMs) {
  const response = await requestJson(`${baseUrl}/api/v1/community-cast/run`, {
    method: 'POST',
    timeoutMs,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
  });
  if (response.status !== 200) {
    throw buildRequestError(response, 'failed to run community cast');
  }
  if (!response.json?.ok || !response.json?.data) {
    throw new Error('community-cast/run returned an invalid response payload');
  }
  return response.json.data;
}

function summarizeRun(data, { usedBootstrap, usedStoredSession }) {
  return {
    attemptedAt: new Date().toISOString(),
    generationAction: data.generation?.action ?? null,
    generationReasons: Array.isArray(data.generation?.reasons) ? [...data.generation.reasons] : [],
    publishAction: data.publish?.action ?? null,
    publishReasons: Array.isArray(data.publish?.reasons) ? [...data.publish.reasons] : [],
    candidateId: data.publish?.candidate?.id ?? data.generation?.candidate?.id ?? null,
    publishedExpressionId: data.publish?.expression?.id ?? null,
    publishedNpcId: data.publish?.candidate?.npcId ?? data.generation?.candidate?.npcId ?? null,
    usedBootstrap,
    usedStoredSession,
  };
}

async function runTick(options) {
  const previousState = (await loadState(options.stateFile)) ?? {};
  const startedAt = new Date().toISOString();
  let ownerSession = previousState.ownerSession ?? null;
  let usedStoredSession = Boolean(ownerSession?.token);
  let usedBootstrap = false;

  try {
    if (!ownerSession?.token) {
      ownerSession = await bootstrapHostedOwnerSession(options.baseUrl, options.bootstrapKey, options.timeoutMs);
      usedBootstrap = true;
      usedStoredSession = false;
    }

    let payload;
    try {
      payload = await runCommunityCast(options.baseUrl, ownerSession.token, options.timeoutMs);
    } catch (error) {
      if (!isAuthError(error)) {
        throw error;
      }

      ownerSession = await bootstrapHostedOwnerSession(options.baseUrl, options.bootstrapKey, options.timeoutMs);
      usedBootstrap = true;
      payload = await runCommunityCast(options.baseUrl, ownerSession.token, options.timeoutMs);
    }

    const run = summarizeRun(payload, {
      usedBootstrap,
      usedStoredSession,
    });
    const state = {
      version: 1,
      baseUrl: options.baseUrl,
      configEnvFile: options.configEnvFile,
      lastStartedAt: startedAt,
      lastCompletedAt: new Date().toISOString(),
      consecutiveFailures: 0,
      ownerSession,
      lastRun: run,
      lastError: null,
      nextScheduledAt: previousState.nextScheduledAt ?? null,
      lastDelayMs: previousState.lastDelayMs ?? null,
    };
    await saveState(options.stateFile, state);

    return {
      ok: true,
      run,
      state,
    };
  } catch (error) {
    const failure = {
      attemptedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
      statusCode: error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : null,
      usedBootstrap,
      usedStoredSession,
    };
    const state = {
      version: 1,
      baseUrl: options.baseUrl,
      configEnvFile: options.configEnvFile,
      lastStartedAt: startedAt,
      lastCompletedAt: new Date().toISOString(),
      consecutiveFailures: Number(previousState.consecutiveFailures ?? 0) + 1,
      ownerSession: isAuthError(error) ? null : ownerSession,
      lastRun: previousState.lastRun ?? null,
      lastError: failure,
      nextScheduledAt: previousState.nextScheduledAt ?? null,
      lastDelayMs: previousState.lastDelayMs ?? null,
    };
    await saveState(options.stateFile, state);

    return {
      ok: false,
      error: failure,
      state,
    };
  }
}

async function updateSchedule(stateFile, state, delayMs) {
  const nextScheduledAt = new Date(Date.now() + delayMs).toISOString();
  const nextState = {
    ...state,
    lastDelayMs: delayMs,
    nextScheduledAt,
  };
  await saveState(stateFile, nextState);
  return nextState;
}

function redactStateForOutput(state) {
  if (!state || typeof state !== 'object') {
    return state;
  }
  return {
    ...state,
    ownerSession: state.ownerSession
      ? {
          ...state.ownerSession,
          token: state.ownerSession.token ? '[redacted]' : null,
        }
      : null,
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  if (options.once) {
    const tick = await runTick(options);
    console.log(JSON.stringify({
      ...tick,
      state: redactStateForOutput(tick.state),
    }, null, 2));
    process.exit(tick.ok ? 0 : 1);
  }

  log('info', 'starting hosted community cast loop', {
    baseUrl: options.baseUrl,
    stateFile: options.stateFile,
  });

  while (true) {
    const tick = await runTick(options);
    const delayMs = tick.ok
      ? buildDelayMs(options.minIntervalSeconds, options.jitterSeconds)
      : buildDelayMs(options.failureMinSeconds, options.failureJitterSeconds);
    const nextState = await updateSchedule(options.stateFile, tick.state, delayMs);

    if (tick.ok) {
      log('info', 'community cast tick completed', tick.run);
    } else {
      log('warn', 'community cast tick failed', tick.error);
    }
    log('info', 'community cast loop sleeping', {
      delayMs,
      nextScheduledAt: nextState.nextScheduledAt,
    });

    await delay(delayMs);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
