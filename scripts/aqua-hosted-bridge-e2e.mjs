#!/usr/bin/env node

import process from 'node:process';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_CONNECTION_TYPE = 'openclaw_remote';
const DEFAULT_SOURCE = 'hosted_bridge_e2e';

function printHelp() {
  console.log(`Usage: npm run aqua:bridge:hosted -- [options]

Required:
  --base-url <url>                 Aqua hosted base URL (env: BASE_URL, default: ${DEFAULT_BASE_URL})
  --hosted-bootstrap-key <key>     Hosted owner bootstrap key (env: HOSTED_BOOTSTRAP_KEY)
  --owner-handle <handle>          Hosted owner handle (env: OWNER_HANDLE)
  --runtime-id <id>                Runtime id to bind + heartbeat (env: RUNTIME_ID)

Gateway auth:
  --gateway-token <token>          Reuse an existing gateway token (env: GATEWAY_TOKEN)
  --gateway-handle <handle>        Gateway handle when registering a new gateway (env: GATEWAY_HANDLE)
  --gateway-name <name>            Gateway display name when registering a new gateway (env: GATEWAY_NAME)

Optional:
  --owner-name <name>              Hosted owner display name (env: OWNER_NAME)
  --help                           Show this message

Notes:
  - When --gateway-token is omitted, the script registers a new gateway and requires --gateway-handle.
  - OWNER_NAME and GATEWAY_NAME default from their handles when not provided.
`);
}

function getEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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

function capitalize(value) {
  if (!value) {
    return '';
  }

  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function humanizeHandle(handle, fallback) {
  if (typeof handle !== 'string' || !handle.trim()) {
    return fallback;
  }

  const words = handle
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => capitalize(word.toLowerCase()));

  return words.length > 0 ? words.join(' ') : fallback;
}

function normalizeBaseUrl(raw) {
  const url = new URL(String(raw || DEFAULT_BASE_URL).trim());
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function parseOptions(argv) {
  const options = {
    baseUrl: getEnv('BASE_URL') ?? DEFAULT_BASE_URL,
    gatewayHandle: getEnv('GATEWAY_HANDLE'),
    gatewayName: getEnv('GATEWAY_NAME'),
    gatewayToken: getEnv('GATEWAY_TOKEN'),
    hostedBootstrapKey: getEnv('HOSTED_BOOTSTRAP_KEY'),
    ownerHandle: getEnv('OWNER_HANDLE'),
    ownerName: getEnv('OWNER_NAME'),
    runtimeId: getEnv('RUNTIME_ID'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith('--base-url')) {
      options.baseUrl = parseArgValue(argv, index, arg, '--base-url').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--hosted-bootstrap-key')) {
      options.hostedBootstrapKey = parseArgValue(argv, index, arg, '--hosted-bootstrap-key').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--owner-handle')) {
      options.ownerHandle = parseArgValue(argv, index, arg, '--owner-handle').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--owner-name')) {
      options.ownerName = parseArgValue(argv, index, arg, '--owner-name').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--gateway-handle')) {
      options.gatewayHandle = parseArgValue(argv, index, arg, '--gateway-handle').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--gateway-name')) {
      options.gatewayName = parseArgValue(argv, index, arg, '--gateway-name').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--gateway-token')) {
      options.gatewayToken = parseArgValue(argv, index, arg, '--gateway-token').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--runtime-id')) {
      options.runtimeId = parseArgValue(argv, index, arg, '--runtime-id').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }

    throw new Error(`unknown option: ${arg}`);
  }

  if (!options.hostedBootstrapKey) {
    throw new Error('HOSTED_BOOTSTRAP_KEY or --hosted-bootstrap-key is required');
  }
  if (!options.ownerHandle) {
    throw new Error('OWNER_HANDLE or --owner-handle is required');
  }
  if (!options.runtimeId) {
    throw new Error('RUNTIME_ID or --runtime-id is required');
  }
  if (!options.gatewayToken && !options.gatewayHandle) {
    throw new Error('GATEWAY_HANDLE or --gateway-handle is required when GATEWAY_TOKEN is not provided');
  }

  options.baseUrl = normalizeBaseUrl(options.baseUrl);
  options.ownerName = options.ownerName ?? humanizeHandle(options.ownerHandle, 'Hosted Bridge Owner');
  options.gatewayName = options.gatewayName ?? humanizeHandle(options.gatewayHandle, 'Hosted Bridge Gateway');

  return options;
}

function annotateError(error, fields) {
  const annotated = error instanceof Error ? error : new Error(String(error));
  Object.assign(annotated, fields);
  return annotated;
}

function buildError(response, payload, fallbackMessage, request) {
  const error = new Error(payload?.error?.message ?? fallbackMessage);
  return annotateError(error, {
    code: payload?.error?.code ?? null,
    method: request.method,
    payload,
    statusCode: response.status,
    url: request.url,
  });
}

async function requestJson(baseUrl, path, { method = 'GET', token, payload } = {}) {
  const url = `${baseUrl}${path}`;
  let response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw annotateError(new Error(`failed to reach ${url}: ${message}`), { method, url });
  }

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw annotateError(new Error(`invalid JSON response from ${url}`), {
        method,
        responseBody: text,
        statusCode: response.status,
        url,
      });
    }
  }

  if (!response.ok) {
    throw buildError(response, body, `request failed: ${response.status}`, { method, url });
  }

  return body;
}

function requireToken(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} did not return a token`);
  }

  return value;
}

function requireObject(value, label) {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${label} did not return the expected object`);
  }

  return value;
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runStep(label, action) {
  console.log(label);

  try {
    return await action();
  } catch (error) {
    throw annotateError(error, { step: label });
  }
}

function formatSummaryLine(label, value) {
  return `${label}: ${value}`;
}

function printSuccessSummary({
  baseUrl,
  bindResult,
  bridgeCredential,
  gateway,
  gatewayMode,
  owner,
  runtime,
}) {
  const lines = [
    'Hosted remote bridge E2E succeeded.',
    formatSummaryLine('Base URL', baseUrl),
    formatSummaryLine('Owner', `${owner.handle} (${owner.id})`),
    formatSummaryLine('Gateway', `${gateway.handle} (${gateway.id}) [${gatewayMode}]`),
    formatSummaryLine(
      'Runtime',
      `${runtime.runtimeId} status=${runtime.status} presence=${runtime.presenceStatus ?? 'unknown'} heartbeat=${runtime.lastHeartbeatAt ?? 'n/a'}`,
    ),
    formatSummaryLine('Bridge credential', `${bridgeCredential.id} bind=${bindResult.created ? 'created' : 'refreshed'}`),
  ];

  console.log(lines.join('\n'));
}

function printFailure(error) {
  console.error('Hosted remote bridge E2E failed.');

  if (error?.step) {
    console.error(`Step: ${error.step}`);
  }

  console.error(`Message: ${error instanceof Error ? error.message : String(error)}`);

  if (error?.statusCode || error?.code) {
    const httpParts = [];
    if (error?.statusCode) {
      httpParts.push(String(error.statusCode));
    }
    if (error?.code) {
      httpParts.push(String(error.code));
    }
    console.error(`HTTP: ${httpParts.join(' ')}`);
  }

  if (error?.method && error?.url) {
    console.error(`Request: ${error.method} ${error.url}`);
  }

  if (error?.hint) {
    console.error(`Hint: ${error.hint}`);
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  const ownerBootstrap = await runStep('[1/6] Bootstrap hosted owner session', async () => {
    return requestJson(options.baseUrl, '/api/v1/session/bootstrap-hosted', {
      method: 'POST',
      payload: {
        bootstrapKey: options.hostedBootstrapKey,
        displayName: options.ownerName,
        handle: options.ownerHandle,
      },
    });
  });

  const ownerGateway = requireObject(ownerBootstrap?.data?.gateway, 'bootstrap-hosted');
  const ownerToken = requireToken(ownerBootstrap?.data?.credential?.token, 'bootstrap-hosted');

  const gatewayResult = await runStep('[2/6] Acquire gateway credential', async () => {
    if (options.gatewayToken) {
      const me = await requestJson(options.baseUrl, '/api/v1/gateways/me', {
        token: options.gatewayToken,
      });

      return {
        gateway: requireObject(me?.data?.gateway, 'gateways/me'),
        mode: 'reused',
        token: options.gatewayToken,
      };
    }

    try {
      const register = await requestJson(options.baseUrl, '/api/v1/gateways/register', {
        method: 'POST',
        payload: {
          displayName: options.gatewayName,
          handle: options.gatewayHandle,
        },
      });

      return {
        gateway: requireObject(register?.data?.gateway, 'gateways/register'),
        mode: 'registered',
        token: requireToken(register?.data?.credential?.token, 'gateways/register'),
      };
    } catch (error) {
      if (error?.statusCode === 409 && error?.code === 'handle_conflict') {
        throw annotateError(error, {
          hint: 'Use a unique GATEWAY_HANDLE or pass GATEWAY_TOKEN to reuse an existing gateway.',
        });
      }
      throw error;
    }
  });

  const gateway = gatewayResult.gateway;
  const gatewayToken = gatewayResult.token;

  const bridgeCredentialResponse = await runStep('[3/6] Create remote bridge credential', async () => {
    return requestJson(options.baseUrl, '/api/v1/runtime/remote/bridge-credentials', {
      method: 'POST',
      token: ownerToken,
      payload: {
        label: `${options.runtimeId} bridge`,
        metadata: {
          runtimeId: options.runtimeId,
          source: DEFAULT_SOURCE,
        },
      },
    });
  });

  const bridgeCredential = requireObject(bridgeCredentialResponse?.data?.credential, 'runtime/remote/bridge-credentials');
  const bridgeToken = requireToken(bridgeCredential.token, 'runtime/remote/bridge-credentials');

  const bindResponse = await runStep('[4/6] Bind remote runtime', async () => {
    return requestJson(options.baseUrl, '/api/v1/runtime/remote/bind', {
      method: 'POST',
      token: gatewayToken,
      payload: {
        bridgeToken,
        installationId: gateway.handle ?? options.gatewayHandle ?? options.runtimeId,
        label: `${gateway.displayName ?? options.gatewayName ?? options.runtimeId} Runtime`,
        metadata: {
          ownerGatewayId: ownerGateway.id,
          source: DEFAULT_SOURCE,
        },
        runtimeId: options.runtimeId,
        source: DEFAULT_SOURCE,
      },
    });
  });

  const bindRuntime = requireObject(bindResponse?.data?.runtime, 'runtime/remote/bind');

  assertCondition(bindRuntime.runtimeId === options.runtimeId, 'bind returned an unexpected runtimeId');

  const heartbeatResponse = await runStep('[5/6] Send remote heartbeat', async () => {
    return requestJson(options.baseUrl, '/api/v1/runtime/remote/heartbeat', {
      method: 'POST',
      token: gatewayToken,
      payload: {
        connectionType: DEFAULT_CONNECTION_TYPE,
        metadata: {
          source: DEFAULT_SOURCE,
        },
        runtimeId: options.runtimeId,
      },
    });
  });

  const heartbeatRuntime = requireObject(heartbeatResponse?.data?.runtime, 'runtime/remote/heartbeat');

  assertCondition(heartbeatRuntime.status === 'online', 'remote heartbeat did not move runtime to online');

  const remoteMeResponse = await runStep('[6/6] Query remote runtime summary', async () => {
    return requestJson(options.baseUrl, '/api/v1/runtime/remote/me', {
      token: gatewayToken,
    });
  });

  const remoteMeRuntime = requireObject(remoteMeResponse?.data?.runtime, 'runtime/remote/me');
  const remoteMePresence = remoteMeResponse?.data?.presence ?? null;

  assertCondition(remoteMeRuntime.runtimeId === options.runtimeId, 'remote runtime me returned an unexpected runtimeId');
  assertCondition(remoteMeRuntime.bridgeCredentialId === bridgeCredential.id, 'remote runtime me returned an unexpected bridge credential');
  assertCondition(remoteMeRuntime.status === 'online', 'remote runtime me is not online after heartbeat');

  printSuccessSummary({
    baseUrl: options.baseUrl,
    bindResult: {
      created: Boolean(bindResponse?.data?.created),
    },
    bridgeCredential,
    gateway: {
      handle: gateway.handle ?? options.gatewayHandle ?? 'unknown-gateway',
      id: gateway.id ?? 'unknown-gateway-id',
    },
    gatewayMode: gatewayResult.mode,
    owner: {
      handle: ownerGateway.handle ?? options.ownerHandle,
      id: ownerGateway.id ?? 'unknown-owner-id',
    },
    runtime: {
      lastHeartbeatAt: remoteMeRuntime.lastHeartbeatAt ?? heartbeatRuntime.lastHeartbeatAt ?? null,
      presenceStatus: remoteMePresence?.status ?? null,
      runtimeId: remoteMeRuntime.runtimeId,
      status: remoteMeRuntime.status,
    },
  });
}

try {
  await main();
} catch (error) {
  printFailure(error);
  process.exit(1);
}
