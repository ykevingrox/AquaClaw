#!/usr/bin/env node

import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  buildLocalDevBuiltinDefaults,
  applyLocalDevOverrides,
  buildLocalDevEnvOverrides,
  loadLocalDevConfig,
  resolveLocalDevConfigPath,
  validateLocalDevOptions,
} from './local-dev-config-lib.mjs';
import {
  getOptionalStringArg,
  getOptionalConfigEnvFileArg,
  loadEnvFile,
  normalizeBaseUrl,
  parseArgs,
  requestJson,
  runHostedSingleInstanceChecks,
} from './hosted-single-instance-lib.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Run AquaClaw configuration diagnostics.

Usage:
  node scripts/aquaclaw-doctor.mjs --mode local|hosted [options]

Required:
  --mode MODE                     local|hosted

Local mode options:
  --config PATH                   Local dev config path
  --ignore-config                 Ignore repo-local config file
  --hub-url URL                   Override local hub URL (default from config)
  --web-url URL                   Override local web-console URL (default from config)

Hosted mode options:
  --config-env-file PATH          Hosted env file to validate
  --service NAME                  systemd service to inspect (default: gateway-hub)
  --base-url URL                  Public AquaClaw base URL for HTTP checks

Shared options:
  --timeout-ms NUMBER             HTTP timeout in milliseconds. Default: 5000
  --help                          Show this help text
`;

function printResult(result) {
  console.log(`[${result.status}] ${result.label}: ${result.message}`);
}

function inspectParentPath(pathValue) {
  const requestedParent = resolve(dirname(pathValue));
  let existingParent = requestedParent;

  while (!existsSync(existingParent)) {
    const nextParent = dirname(existingParent);
    if (nextParent === existingParent) {
      break;
    }
    existingParent = nextParent;
  }

  try {
    accessSync(existingParent, constants.W_OK);
    return {
      ok: true,
      parent: requestedParent,
      existingParent,
      parentExists: existsSync(requestedParent),
    };
  } catch (error) {
    return {
      ok: false,
      parent: requestedParent,
      existingParent,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function localChecks(args, timeoutMs) {
  const results = [];
  let failures = 0;

  const ignoreConfig = args['ignore-config'] === true;
  const configPath = resolveLocalDevConfigPath(repoRoot, getOptionalStringArg(args, 'config'), process.env);
  const options = buildLocalDevBuiltinDefaults(repoRoot);

  if (!ignoreConfig) {
    try {
      const localConfig = loadLocalDevConfig(configPath);
      if (localConfig) {
        applyLocalDevOverrides(options, localConfig);
        results.push({ status: 'pass', label: 'local-config', message: `loaded ${configPath}` });
      } else {
        results.push({
          status: 'warn',
          label: 'local-config',
          message: `no config file at ${configPath}; built-in defaults will be used`,
        });
      }
    } catch (error) {
      failures += 1;
      results.push({
        status: 'fail',
        label: 'local-config',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    results.push({
      status: 'warn',
      label: 'local-config',
      message: 'config loading skipped by --ignore-config',
    });
  }

  applyLocalDevOverrides(options, buildLocalDevEnvOverrides(process.env));

  let validated = null;
  try {
    validated = validateLocalDevOptions(options);
    results.push({
      status: 'pass',
      label: 'local-options',
      message: `backend=${validated.backend}, hubPort=${validated.hubPort}, webPort=${validated.webPort}`,
    });
  } catch (error) {
    failures += 1;
    results.push({
      status: 'fail',
      label: 'local-options',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (validated?.backend === 'sqlite') {
    const dbPath = resolve(validated.databaseUrl);
    const parentState = inspectParentPath(dbPath);
    if (existsSync(dbPath)) {
      results.push({ status: 'pass', label: 'sqlite-path', message: `database file exists: ${dbPath}` });
    } else if (parentState.ok && !parentState.parentExists) {
      results.push({
        status: 'pass',
        label: 'sqlite-path',
        message: `database directory ${parentState.parent} does not exist yet, but it can be created from ${parentState.existingParent}`,
      });
    } else if (parentState.ok) {
      results.push({
        status: 'pass',
        label: 'sqlite-path',
        message: `database file will be created under writable directory ${parentState.parent}`,
      });
    } else {
      failures += 1;
      results.push({
        status: 'fail',
        label: 'sqlite-path',
        message: `parent directory is not writable (${parentState.parent}): ${parentState.message}`,
      });
    }
  }

  const hubUrl = getOptionalStringArg(args, 'hub-url') ?? (validated ? `http://127.0.0.1:${validated.hubPort}` : null);
  if (hubUrl) {
    try {
      const health = await requestJson(`${normalizeBaseUrl(hubUrl)}/health`, { timeoutMs });
      if (health.status === 200 && health.json?.ok === true) {
        results.push({ status: 'pass', label: 'hub-health', message: `${hubUrl} is reachable` });
      } else {
        results.push({
          status: 'warn',
          label: 'hub-health',
          message: `${hubUrl} responded with status ${health.status}; start local services with npm run dev:aquarium`,
        });
      }
    } catch (error) {
      results.push({
        status: 'warn',
        label: 'hub-health',
        message: `${hubUrl} is not reachable (${error instanceof Error ? error.message : String(error)})`,
      });
    }
  }

  const webUrl = getOptionalStringArg(args, 'web-url') ?? (validated ? `http://127.0.0.1:${validated.webPort}` : null);
  if (webUrl) {
    try {
      const meta = await requestJson(`${normalizeBaseUrl(webUrl)}/__console_meta`, { timeoutMs });
      if (meta.status === 200 && meta.json?.ok === true) {
        results.push({
          status: 'pass',
          label: 'web-console',
          message: `${webUrl} is reachable`,
        });
      } else {
        results.push({
          status: 'warn',
          label: 'web-console',
          message: `${webUrl} responded with status ${meta.status}; start local services with npm run dev:aquarium`,
        });
      }
    } catch (error) {
      results.push({
        status: 'warn',
        label: 'web-console',
        message: `${webUrl} is not reachable (${error instanceof Error ? error.message : String(error)})`,
      });
    }
  }

  return { failures, results };
}

function validateHostedEnvFile(envFile) {
  const results = [];
  let failures = 0;
  const env = loadEnvFile(envFile);

  const deploymentMode = env.AQUA_DEPLOYMENT_MODE?.trim() || 'local';
  if (deploymentMode !== 'hosted') {
    failures += 1;
    results.push({
      status: 'fail',
      label: 'hosted-env',
      message: `AQUA_DEPLOYMENT_MODE must be hosted, got ${deploymentMode}`,
    });
  } else {
    results.push({ status: 'pass', label: 'hosted-env', message: 'deployment mode is hosted' });
  }

  const backend = env.GATEWAY_STORE_BACKEND?.trim() || 'memory';
  if (backend !== 'sqlite') {
    failures += 1;
    results.push({
      status: 'fail',
      label: 'store-backend',
      message: `GATEWAY_STORE_BACKEND must be sqlite for the hosted baseline, got ${backend}`,
    });
  } else {
    results.push({ status: 'pass', label: 'store-backend', message: 'sqlite backend configured' });
  }

  const databaseUrl = env.DATABASE_URL?.trim() || '';
  if (!databaseUrl) {
    failures += 1;
    results.push({ status: 'fail', label: 'database-url', message: 'DATABASE_URL is missing' });
  } else {
    const resolved = resolve(databaseUrl);
    const writable = inspectParentPath(resolved);
    const details = existsSync(resolved)
      ? `database file exists: ${resolved}`
      : writable.ok && !writable.parentExists
        ? `database directory ${writable.parent} does not exist yet, but it can be created from ${writable.existingParent}`
      : writable.ok
        ? `database parent is writable: ${writable.parent}`
        : `database parent is not writable: ${writable.parent}`;
    const status = writable.ok ? 'pass' : 'fail';
    if (!writable.ok) {
      failures += 1;
    }
    results.push({ status, label: 'database-url', message: details });
  }

  const bootstrapKey = env.AQUA_HOSTED_OWNER_BOOTSTRAP_KEY?.trim();
  if (!bootstrapKey) {
    failures += 1;
    results.push({
      status: 'fail',
      label: 'bootstrap-key',
      message: 'AQUA_HOSTED_OWNER_BOOTSTRAP_KEY is missing',
    });
  } else {
    results.push({
      status: 'pass',
      label: 'bootstrap-key',
      message: `bootstrap key present (${bootstrapKey.length} chars)`,
    });
  }

  const host = env.HOST?.trim() || '127.0.0.1';
  if (host !== '127.0.0.1') {
    results.push({
      status: 'warn',
      label: 'listen-host',
      message: `HOST is ${host}; hosted baseline usually keeps hub-server on 127.0.0.1 behind a reverse proxy`,
    });
  } else {
    results.push({ status: 'pass', label: 'listen-host', message: 'HOST is 127.0.0.1' });
  }

  const rawPort = env.PORT?.trim() || '8787';
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isFinite(port) || port <= 0) {
    failures += 1;
    results.push({ status: 'fail', label: 'listen-port', message: `PORT must be positive, got ${rawPort}` });
  } else {
    results.push({ status: 'pass', label: 'listen-port', message: `PORT=${rawPort}` });
  }

  const onlineThreshold = Number.parseInt(env.AQUA_ONLINE_THRESHOLD_MS?.trim() || '1200000', 10);
  const recentlyActiveThreshold = Number.parseInt(env.AQUA_RECENTLY_ACTIVE_THRESHOLD_MS?.trim() || '2700000', 10);
  if (!Number.isFinite(onlineThreshold) || !Number.isFinite(recentlyActiveThreshold) || recentlyActiveThreshold <= onlineThreshold) {
    failures += 1;
    results.push({
      status: 'fail',
      label: 'heartbeat-thresholds',
      message: 'AQUA_ONLINE_THRESHOLD_MS and AQUA_RECENTLY_ACTIVE_THRESHOLD_MS must be positive and ordered',
    });
  } else {
    results.push({
      status: 'pass',
      label: 'heartbeat-thresholds',
      message: `online=${onlineThreshold}ms, recently_active=${recentlyActiveThreshold}ms`,
    });
  }

  return { failures, results };
}

function inspectSystemdService(serviceName) {
  const systemctl = spawnSync('systemctl', ['is-active', serviceName], {
    encoding: 'utf8',
  });
  if (systemctl.error) {
    return {
      status: 'warn',
      label: 'systemd',
      message: `failed to inspect ${serviceName}: ${systemctl.error.message}`,
    };
  }
  if (systemctl.status === 0) {
    return { status: 'pass', label: 'systemd', message: `${serviceName} is active` };
  }
  const state = systemctl.stdout?.trim() || systemctl.stderr?.trim() || `exit ${systemctl.status}`;
  return { status: 'fail', label: 'systemd', message: `${serviceName} is not active (${state})` };
}

async function hostedChecks(args, timeoutMs) {
  const results = [];
  let failures = 0;

  const envFile = getOptionalConfigEnvFileArg(args);
  if (envFile) {
    const envChecks = validateHostedEnvFile(envFile);
    failures += envChecks.failures;
    results.push(...envChecks.results);
  } else {
    results.push({
      status: 'warn',
      label: 'hosted-env',
      message: 'no --config-env-file provided; skipping env validation',
    });
  }

  const serviceName = getOptionalStringArg(args, 'service') || 'gateway-hub';
  const serviceResult = inspectSystemdService(serviceName);
  results.push(serviceResult);
  if (serviceResult.status === 'fail') {
    failures += 1;
  }

  const baseUrl = getOptionalStringArg(args, 'base-url');
  if (baseUrl) {
    try {
      const checks = await runHostedSingleInstanceChecks(baseUrl, { timeoutMs });
      for (const check of checks) {
        results.push({
          status: 'pass',
          label: `http:${check.label}`,
          message: `${normalizeBaseUrl(baseUrl)} passed ${check.label}`,
        });
      }
    } catch (error) {
      failures += 1;
      results.push({
        status: 'fail',
        label: 'http',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    results.push({
      status: 'warn',
      label: 'http',
      message: 'no --base-url provided; skipping public hosted HTTP checks',
    });
  }

  return { failures, results };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    booleanKeys: ['help', 'ignore-config'],
  });

  if (args.help) {
    console.log(USAGE);
    return;
  }

  const mode = getOptionalStringArg(args, 'mode');
  if (mode !== 'local' && mode !== 'hosted') {
    throw new Error('--mode must be local or hosted');
  }

  const timeoutMs = args['timeout-ms'] ? Number(args['timeout-ms']) : 5_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  const { failures, results } = mode === 'hosted'
    ? await hostedChecks(args, timeoutMs)
    : await localChecks(args, timeoutMs);

  for (const result of results) {
    printResult(result);
  }

  const warnings = results.filter((result) => result.status === 'warn').length;
  console.log('');
  if (failures > 0) {
    console.log(`Doctor result: ${failures} failure(s), ${warnings} warning(s).`);
    process.exit(1);
  }

  console.log(`Doctor result: ok with ${warnings} warning(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
