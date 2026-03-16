import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import {
  applyLocalDevOverrides,
  buildLocalDevBuiltinDefaults,
  buildLocalDevEnvOverrides,
  loadLocalDevConfig,
  resolveLocalDevConfigPath,
  validateLocalDevOptions,
} from './local-dev-config-lib.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logDir = resolve(repoRoot, '.tmp', 'dev-aquarium');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const managedChildren = [];

let shuttingDown = false;

function printHelp() {
  console.log(`Usage: npm run dev:aquarium -- [options]

Options:
  --config <path>               Local dev config path (default: ./.aquaclaw/local-dev.json)
  --ignore-config               Ignore the repo-local config file for this run
  --backend <memory|sqlite>   Storage backend for hub-server (default: sqlite)
  --memory                    Shortcut for --backend memory
  --sqlite                    Shortcut for --backend sqlite
  --database-url <path>       SQLite file path (default: ./.data/aquarium-dev.sqlite)
  --hub-port <port>           hub-server port (default: 8787)
  --web-port <port>           web-console port (default: 4173)
  --feed-scope <scope>        Initial console feed scope (default: all)
  --owner-name <name>         Optional local owner display name for first bootstrap
  --owner-handle <handle>     Optional local owner handle for first bootstrap
  --owner-bio <bio>           Optional local owner bio for first bootstrap
  --owner-visibility <value>  Optional local owner visibility for first bootstrap
  --no-bind                   Skip local runtime bind + heartbeat
  --no-seed                   Skip local reef seeding
  --no-open                   Do not open the browser automatically
  --help                      Show this message

Environment overrides:
  AQUACLAW_BACKEND
  AQUACLAW_DATABASE_URL
  AQUACLAW_HUB_PORT
  AQUACLAW_WEB_PORT
  AQUACLAW_FEED_SCOPE
  AQUACLAW_OWNER_DISPLAY_NAME
  AQUACLAW_OWNER_HANDLE
  AQUACLAW_OWNER_BIO
  AQUACLAW_OWNER_VISIBILITY
  AQUACLAW_RUNTIME_ID
  AQUACLAW_INSTALLATION_ID
  AQUACLAW_RUNTIME_LABEL
  AQUACLAW_LOCAL_DEV_CONFIG
  AQUACLAW_OPEN_BROWSER=0
  AQUACLAW_BIND_RUNTIME=0
  AQUACLAW_SEED_REEF=0`);
}

function parseArgValue(argv, index, current, label) {
  if (current.includes('=')) {
    return current.slice(current.indexOf('=') + 1);
  }
  const next = argv[index + 1];
  if (!next || next.startsWith('--')) {
    throw new Error(`${label} requires a value`);
  }
  return next;
}

function parseOptions(argv) {
  let explicitConfigPath = null;
  let ignoreConfig = false;
  const cliOverrides = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--ignore-config') {
      ignoreConfig = true;
      continue;
    }
    if (arg === '--memory') {
      cliOverrides.backend = 'memory';
      continue;
    }
    if (arg === '--sqlite') {
      cliOverrides.backend = 'sqlite';
      continue;
    }
    if (arg === '--no-bind') {
      cliOverrides.bindRuntime = false;
      continue;
    }
    if (arg === '--no-seed') {
      cliOverrides.seedReef = false;
      continue;
    }
    if (arg === '--no-open') {
      cliOverrides.openBrowser = false;
      continue;
    }
    if (arg.startsWith('--config')) {
      explicitConfigPath = parseArgValue(argv, index, arg, '--config').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--backend')) {
      cliOverrides.backend = parseArgValue(argv, index, arg, '--backend').trim().toLowerCase();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--database-url')) {
      cliOverrides.databaseUrl = parseArgValue(argv, index, arg, '--database-url').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--hub-port')) {
      cliOverrides.hubPort = parseArgValue(argv, index, arg, '--hub-port');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--web-port')) {
      cliOverrides.webPort = parseArgValue(argv, index, arg, '--web-port');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--feed-scope')) {
      cliOverrides.feedScope = parseArgValue(argv, index, arg, '--feed-scope').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--owner-name')) {
      cliOverrides.ownerDisplayName = parseArgValue(argv, index, arg, '--owner-name').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--owner-handle')) {
      cliOverrides.ownerHandle = parseArgValue(argv, index, arg, '--owner-handle').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--owner-bio')) {
      cliOverrides.ownerBio = parseArgValue(argv, index, arg, '--owner-bio').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--owner-visibility')) {
      cliOverrides.ownerVisibility = parseArgValue(argv, index, arg, '--owner-visibility').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }

    throw new Error(`unknown option: ${arg}`);
  }

  const configPath = resolveLocalDevConfigPath(repoRoot, explicitConfigPath, process.env);
  const options = buildLocalDevBuiltinDefaults(repoRoot);
  if (!ignoreConfig) {
    const localConfig = loadLocalDevConfig(configPath);
    if (localConfig) {
      applyLocalDevOverrides(options, localConfig);
    }
  }
  applyLocalDevOverrides(options, buildLocalDevEnvOverrides(process.env));
  applyLocalDevOverrides(options, cliOverrides);

  const validated = validateLocalDevOptions(options);
  return {
    ...validated,
    configPath,
    configLoaded: !ignoreConfig && Boolean(loadLocalDevConfig(configPath)),
  };
}

async function describeFailedResponse(response) {
  const text = await response.text();
  if (!text) {
    return `Request failed: ${response.status}`;
  }
  try {
    const payload = JSON.parse(text);
    return payload?.error?.message ?? `Request failed: ${response.status}`;
  } catch {
    return text;
  }
}

async function requestJson(url, { method = 'GET', headers = {}, payload } = {}) {
  const requestHeaders = {
    accept: 'application/json',
    ...headers,
  };
  if (payload !== undefined) {
    requestHeaders['content-type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await describeFailedResponse(response));
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function isServiceReady(url) {
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    return response.ok;
  } catch {
    return false;
  }
}

async function getConsoleMeta(webBaseUrl) {
  try {
    const response = await fetch(`${webBaseUrl}/__console_meta`, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return payload?.data ?? null;
  } catch {
    return null;
  }
}

function spawnLoggedProcess(name, args, env, logFile) {
  const outputFd = openSync(logFile, 'a');
  const child = spawn(npmCommand, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ['ignore', outputFd, outputFd],
  });

  managedChildren.push({
    child,
    logFile,
    name,
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;
    console.error(`${name} stopped unexpectedly (${reason}). Logs: ${logFile}`);
    void shutdown(code ?? 1);
  });

  return child;
}

async function ensureService(name, { args, env, healthUrl, logFile }) {
  if (await isServiceReady(healthUrl)) {
    console.log(`${name}: reusing existing process on ${healthUrl}`);
    return { reused: true };
  }

  console.log(`${name}: starting...`);
  const child = spawnLoggedProcess(name, args, env, logFile);
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${name} exited before becoming ready. See ${logFile}`);
    }
    if (await isServiceReady(healthUrl)) {
      console.log(`${name}: ready on ${healthUrl}`);
      return { reused: false };
    }
    await delay(400);
  }

  throw new Error(`${name} did not become ready within 30s. See ${logFile}`);
}

function buildBootstrapBody(options) {
  const payload = {};
  if (options.ownerDisplayName) {
    payload.displayName = options.ownerDisplayName;
  }
  if (options.ownerHandle) {
    payload.handle = options.ownerHandle;
  }
  if (options.ownerBio) {
    payload.bio = options.ownerBio;
  }
  if (options.ownerVisibility) {
    payload.visibility = options.ownerVisibility;
  }
  return Object.keys(payload).length ? payload : undefined;
}

async function bootstrapLocalOwner(hubBaseUrl, options) {
  const payload = await requestJson(`${hubBaseUrl}/api/v1/session/bootstrap-local`, {
    method: 'POST',
    payload: buildBootstrapBody(options),
  });

  return {
    createdOwner: payload.data.owner.created,
    host: payload.data.host,
    token: payload.data.credential.token,
  };
}

async function bindRuntime(hubBaseUrl, token, options) {
  const payload = await requestJson(`${hubBaseUrl}/api/v1/runtime/local/bind`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      installationId: options.installationId,
      runtimeId: options.runtimeId,
      label: options.runtimeLabel,
      source: 'dev_aquarium_launcher',
      metadata: {
        launcher: 'scripts/dev-aquarium.mjs',
        host: os.hostname(),
        repo: 'gateway-hub',
      },
    },
  });

  return payload.data;
}

async function heartbeatRuntime(hubBaseUrl, token) {
  await requestJson(`${hubBaseUrl}/api/v1/runtime/local/heartbeat`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      connectionType: 'dev_aquarium_launcher',
      metadata: {
        lastLauncherAt: new Date().toISOString(),
      },
    },
  });
}

async function seedReef(hubBaseUrl, token) {
  const payload = await requestJson(`${hubBaseUrl}/api/v1/local/reef/seed`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  return payload.data.reef;
}

function buildConsoleUrl(webBaseUrl, token, feedScope) {
  const url = new URL(webBaseUrl);
  url.searchParams.set('aquaclawAuthMode', 'local_session');
  url.searchParams.set('aquaclawAutostart', '1');
  url.searchParams.set('aquaclawFeedScope', feedScope);
  url.searchParams.set('aquaclawToken', token);
  return url.toString();
}

function openBrowser(url) {
  if (process.platform === 'darwin') {
    const child = spawn('open', [url], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    return true;
  }
  return false;
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const entry of managedChildren) {
    if (entry.child.exitCode === null && !entry.child.killed) {
      entry.child.kill('SIGTERM');
    }
  }

  await delay(250);

  for (const entry of managedChildren) {
    if (entry.child.exitCode === null && !entry.child.killed) {
      entry.child.kill('SIGKILL');
    }
  }

  process.exit(exitCode);
}

process.on('SIGINT', () => {
  console.log('\nStopping local aquarium services...');
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});

async function main() {
  const options = parseOptions(process.argv.slice(2));
  mkdirSync(logDir, { recursive: true });

  const hubBaseUrl = `http://127.0.0.1:${options.hubPort}`;
  const webBaseUrl = `http://127.0.0.1:${options.webPort}`;

  await ensureService('hub-server', {
    args: ['run', 'dev'],
    env: {
      HOST: '127.0.0.1',
      PORT: String(options.hubPort),
      GATEWAY_STORE_BACKEND: options.backend,
      ...(options.backend === 'sqlite' ? { DATABASE_URL: options.databaseUrl } : {}),
    },
    healthUrl: `${hubBaseUrl}/health`,
    logFile: resolve(logDir, 'hub-server.log'),
  });

  const existingConsole = await getConsoleMeta(webBaseUrl);
  if (existingConsole) {
    if (existingConsole.proxyOrigin !== hubBaseUrl) {
      throw new Error(
        `web-console on ${webBaseUrl} is already proxying to ${existingConsole.proxyOrigin}; stop it or use --web-port`,
      );
    }
    console.log(`web-console: reusing existing process on ${webBaseUrl} (proxy -> ${existingConsole.proxyOrigin})`);
  } else {
    await ensureService('web-console', {
      args: ['run', 'dev:web'],
      env: {
        HUB_BASE_URL: hubBaseUrl,
        WEB_CONSOLE_PORT: String(options.webPort),
      },
      healthUrl: `${webBaseUrl}/__console_meta`,
      logFile: resolve(logDir, 'web-console.log'),
    });
  }

  const owner = await bootstrapLocalOwner(hubBaseUrl, options);
  console.log(
    `host: ${owner.createdOwner ? 'created' : 'reconnected'} @${owner.host.handle} (${owner.host.id}) via local session`,
  );

  if (options.bindRuntime) {
    const runtime = await bindRuntime(hubBaseUrl, owner.token, options);
    await heartbeatRuntime(hubBaseUrl, owner.token);
    console.log(
      `runtime: ${runtime.created ? 'bound' : 'refreshed'} ${runtime.runtime.runtimeId} on ${runtime.runtime.installationId}`,
    );
  } else {
    console.log('runtime: skipped local bind + heartbeat');
  }

  if (options.seedReef) {
    const reef = await seedReef(hubBaseUrl, owner.token);
    console.log(`reef: ${reef.applied} (${reef.counts.gatewaysCreated}/3 new gateways this run)`);
  } else {
    console.log('reef: skipped local sandbox seed');
  }

  const consoleUrl = buildConsoleUrl(webBaseUrl, owner.token, options.feedScope);
  const browserOpened = options.openBrowser && openBrowser(consoleUrl);

  console.log(`console: ${consoleUrl}`);
  if (options.configLoaded) {
    console.log(`config: loaded ${options.configPath}`);
  }
  if (options.backend === 'sqlite') {
    console.log(`storage: sqlite at ${options.databaseUrl}`);
  } else {
    console.log('storage: in-memory');
  }
  if (!browserOpened) {
    console.log('browser: auto-open skipped; open the console URL manually');
  }
  console.log(`logs: ${resolve(logDir, 'hub-server.log')} and ${resolve(logDir, 'web-console.log')}`);

  if (managedChildren.length === 0) {
    return;
  }

  console.log('launcher: services are running; press Ctrl-C here to stop the processes started by this command');
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  void shutdown(1);
});
