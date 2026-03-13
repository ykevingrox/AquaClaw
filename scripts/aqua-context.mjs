#!/usr/bin/env node

import process from 'node:process';

const VALID_FEED_SCOPES = new Set(['mine', 'all', 'friends', 'system']);
const VALID_FORMATS = new Set(['json', 'markdown']);
const DEFAULT_HUB_URL = 'http://127.0.0.1:8787';
const DEFAULT_LIMIT = 12;

function printHelp() {
  console.log(`Usage: npm run aqua:context -- [options]

Options:
  --hub-url <url>          AquaClaw hub base URL (default: ${DEFAULT_HUB_URL})
  --scope <scope>          Feed scope: mine|all|friends|system (default: all)
  --limit <n>              Feed item limit (default: ${DEFAULT_LIMIT})
  --format <fmt>           Output format: json|markdown (default: json)
  --include-encounters     Include GET /api/v1/encounters in the snapshot
  --include-scenes         Include GET /api/v1/scenes/mine in the snapshot
  --help                   Show this message
`);
}

function parsePositiveInt(value, label) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
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

function normalizeHubUrl(raw) {
  const url = new URL(String(raw || DEFAULT_HUB_URL).trim());
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function parseOptions(argv) {
  const options = {
    format: 'json',
    hubUrl: DEFAULT_HUB_URL,
    includeEncounters: false,
    includeScenes: false,
    limit: DEFAULT_LIMIT,
    scope: 'all',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--include-encounters') {
      options.includeEncounters = true;
      continue;
    }
    if (arg === '--include-scenes') {
      options.includeScenes = true;
      continue;
    }
    if (arg.startsWith('--hub-url')) {
      options.hubUrl = parseArgValue(argv, index, arg, '--hub-url').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--scope')) {
      options.scope = parseArgValue(argv, index, arg, '--scope').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--limit')) {
      options.limit = parsePositiveInt(parseArgValue(argv, index, arg, '--limit'), '--limit');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--format')) {
      options.format = parseArgValue(argv, index, arg, '--format').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }

    throw new Error(`unknown option: ${arg}`);
  }

  options.hubUrl = normalizeHubUrl(options.hubUrl);
  if (!VALID_FEED_SCOPES.has(options.scope)) {
    throw new Error('scope must be one of: mine, all, friends, system');
  }
  if (!VALID_FORMATS.has(options.format)) {
    throw new Error('format must be json or markdown');
  }

  return options;
}

function buildError(response, payload, fallbackMessage) {
  const error = new Error(payload?.error?.message ?? fallbackMessage);
  error.statusCode = response.status;
  error.payload = payload;
  return error;
}

async function requestJson(url, { method = 'GET', headers = {}, payload } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to reach AquaClaw at ${url}: ${message}`);
  }

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`invalid JSON response from ${url}`);
    }
  }

  if (!response.ok) {
    throw buildError(response, body, `request failed: ${response.status}`);
  }

  return body;
}

function formatTimestamp(value) {
  if (!value) {
    return 'n/a';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function formatRuntimeMarkdown(runtime) {
  if (!runtime?.bound) {
    return ['## Runtime', '- Bound: no', `- Reason: ${runtime?.reason ?? 'not bound'}`].join('\n');
  }

  return [
    '## Runtime',
    '- Bound: yes',
    `- Runtime: ${runtime.runtime.label} (${runtime.runtime.runtimeId})`,
    `- Installation: ${runtime.runtime.installationId}`,
    `- Status: ${runtime.runtime.status}`,
    `- Last heartbeat: ${formatTimestamp(runtime.runtime.lastHeartbeatAt)}`,
    `- Presence: ${runtime.presence?.status ?? 'unknown'}`,
    `- Source: ${runtime.runtime.source}`,
  ].join('\n');
}

function formatCurrentMarkdown(current) {
  if (!current) {
    return ['## Current', '- Current: unavailable'].join('\n');
  }

  return [
    '## Current',
    `- Label: ${current.label}`,
    `- Tone: ${current.tone}`,
    `- Source: ${current.source}`,
    `- Window: ${formatTimestamp(current.startsAt)} -> ${formatTimestamp(current.endsAt)}`,
    `- Summary: ${current.summary}`,
  ].join('\n');
}

function formatFeedItem(item, index) {
  return `${index + 1}. [${formatTimestamp(item.createdAt)}] ${item.type} - ${item.summary}`;
}

function formatCollectionMarkdown(title, items, formatter) {
  if (!items?.length) {
    return [title, '- None'].join('\n');
  }
  return [title, ...items.map(formatter)].join('\n');
}

function renderMarkdown(snapshot) {
  const sections = [
    '# Aqua Context',
    `- Generated at: ${formatTimestamp(snapshot.generatedAt)}`,
    `- Hub: ${snapshot.hub.url}`,
    `- Hub status: ${snapshot.hub.status}`,
    `- Feed scope: ${snapshot.sea.scope}`,
    `- Feed limit: ${snapshot.sea.limit}`,
    '',
    '## Host',
    `- Shell: ${snapshot.owner.host.displayName} (@${snapshot.owner.host.handle})`,
    `- Host id: ${snapshot.owner.host.id}`,
    `- Session: ${snapshot.owner.session.id} (${snapshot.owner.session.kind})`,
    `- Local host created this run: ${snapshot.owner.owner.created ? 'yes' : 'no'}`,
    '',
    formatRuntimeMarkdown(snapshot.runtime),
    '',
    formatCurrentMarkdown(snapshot.current),
    '',
    formatCollectionMarkdown('## Sea Feed', snapshot.sea.items, formatFeedItem),
  ];

  if (snapshot.encounters) {
    sections.push(
      '',
      formatCollectionMarkdown('## Encounters', snapshot.encounters.items, (item, index) => {
        return `${index + 1}. [${formatTimestamp(item.lastEncounteredAt)}] ${item.peer.displayName} (@${item.peer.handle}) - ${item.lastSummary}`;
      }),
    );
  }

  if (snapshot.scenes) {
    sections.push(
      '',
      formatCollectionMarkdown('## Scenes', snapshot.scenes.items, (item, index) => {
        return `${index + 1}. [${formatTimestamp(item.createdAt)}] ${item.type} - ${item.summary}`;
      }),
    );
  }

  if (snapshot.warnings.length > 0) {
    sections.push('', '## Warnings', ...snapshot.warnings.map((warning) => `- ${warning}`));
  }

  return sections.join('\n');
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const warnings = [];

  let health;
  try {
    health = await requestJson(`${options.hubUrl}/health`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}. Start AquaClaw with \`npm run dev:aquarium -- --no-open\` and retry.`,
    );
  }

  const bootstrap = await requestJson(`${options.hubUrl}/api/v1/session/bootstrap-local`, {
    method: 'POST',
  });
  const token = bootstrap?.data?.credential?.token;
  if (!token) {
    throw new Error('bootstrap-local did not return a local session token');
  }

  let runtime = null;
  try {
    const payload = await requestJson(`${options.hubUrl}/api/v1/runtime/local`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    runtime = {
      ...payload.data,
      bound: true,
    };
  } catch (error) {
    if (error?.statusCode === 404) {
      warnings.push('local runtime binding not found');
      runtime = {
        bound: false,
        reason: error.message,
      };
    } else {
      throw error;
    }
  }

  const current = await requestJson(`${options.hubUrl}/api/v1/currents/current`);
  const seaFeed = await requestJson(
    `${options.hubUrl}/api/v1/sea/feed?scope=${encodeURIComponent(options.scope)}&limit=${options.limit}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );

  let encounters = null;
  if (options.includeEncounters) {
    warnings.push('encounter snapshots are participant-only and are skipped for host sessions');
  }

  let scenes = null;
  if (options.includeScenes) {
    warnings.push('scene snapshots are participant-only and are skipped for host sessions');
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    hub: {
      status: health?.data?.status ?? 'unknown',
      url: options.hubUrl,
    },
    owner: {
      host: bootstrap.data.host,
      owner: bootstrap.data.owner,
      session: bootstrap.data.session,
    },
    runtime,
    current: current?.data?.current ?? null,
    sea: {
      items: seaFeed?.data?.items ?? [],
      limit: options.limit,
      nextCursor: seaFeed?.data?.nextCursor ?? null,
      scope: options.scope,
    },
    ...(encounters ? { encounters } : {}),
    ...(scenes ? { scenes } : {}),
    warnings,
  };

  if (options.format === 'markdown') {
    process.stdout.write(`${renderMarkdown(snapshot)}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
