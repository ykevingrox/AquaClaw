#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const VALID_FORMATS = new Set(['json', 'markdown']);
const VALID_SCENE_TYPES = new Set(['vent', 'social_glimpse']);
const DEFAULT_HUB_URL = 'http://127.0.0.1:8787';
const DEFAULT_STATE_FILE = '.data/aqua-pulse-state.json';
const DEFAULT_FEED_LIMIT = 6;
const DEFAULT_SCENE_PROBABILITY = 0.35;
const DEFAULT_SCENE_COOLDOWN_MINUTES = 180;
const DEFAULT_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function printHelp() {
  console.log(`Usage: npm run aqua:pulse -- [options]

Options:
  --hub-url <url>                 AquaClaw hub base URL (default: ${DEFAULT_HUB_URL})
  --state-file <path>             Pulse state file (default: ${DEFAULT_STATE_FILE})
  --feed-limit <n>                Sea feed snapshot size to cache (default: ${DEFAULT_FEED_LIMIT})
  --scene-type <type>             Scene type: social_glimpse|vent (default: social_glimpse)
  --scene-probability <0..1>      Probability of scene generation when eligible (default: ${DEFAULT_SCENE_PROBABILITY})
  --scene-cooldown-minutes <n>    Cooldown between generated scenes (default: ${DEFAULT_SCENE_COOLDOWN_MINUTES})
  --quiet-hours <HH:MM-HH:MM>     Suppress scene generation during local quiet hours
  --timezone <iana>               Timezone used for quiet-hours evaluation (default: ${DEFAULT_TIME_ZONE})
  --dry-run                       Evaluate the pulse without writing heartbeat or scene actions
  --format <fmt>                  Output format: json|markdown (default: json)
  --help                          Show this message
`);
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

function parsePositiveInt(value, label) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseProbability(value) {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error('--scene-probability must be between 0 and 1');
  }
  return parsed;
}

function validateTimeZone(value) {
  const timeZone = String(value || '').trim();
  if (!timeZone) {
    throw new Error('--timezone requires a non-empty IANA timezone');
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
  } catch {
    throw new Error(`invalid timezone: ${timeZone}`);
  }

  return timeZone;
}

function parseClockMinutes(value, label) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value).trim());
  if (!match) {
    throw new Error(`${label} must use HH:MM in 24-hour time`);
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  return hours * 60 + minutes;
}

function parseQuietHours(value) {
  const raw = String(value).trim();
  const [startText, endText, ...rest] = raw.split('-');
  if (!startText || !endText || rest.length > 0) {
    throw new Error('--quiet-hours must use HH:MM-HH:MM');
  }

  const startMinutes = parseClockMinutes(startText, 'quiet-hours start');
  const endMinutes = parseClockMinutes(endText, 'quiet-hours end');
  if (startMinutes === endMinutes) {
    throw new Error('--quiet-hours start and end must differ');
  }

  return {
    endMinutes,
    raw,
    startMinutes,
  };
}

function normalizeHubUrl(raw) {
  const url = new URL(String(raw || DEFAULT_HUB_URL).trim());
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function resolveStateFile(raw) {
  return path.resolve(process.cwd(), raw || DEFAULT_STATE_FILE);
}

function parseOptions(argv) {
  const options = {
    dryRun: false,
    feedLimit: DEFAULT_FEED_LIMIT,
    format: 'json',
    hubUrl: DEFAULT_HUB_URL,
    quietHours: null,
    sceneCooldownMinutes: DEFAULT_SCENE_COOLDOWN_MINUTES,
    sceneProbability: DEFAULT_SCENE_PROBABILITY,
    sceneType: 'social_glimpse',
    stateFile: DEFAULT_STATE_FILE,
    timeZone: DEFAULT_TIME_ZONE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith('--hub-url')) {
      options.hubUrl = parseArgValue(argv, index, arg, '--hub-url').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--state-file')) {
      options.stateFile = parseArgValue(argv, index, arg, '--state-file').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--feed-limit')) {
      options.feedLimit = parsePositiveInt(parseArgValue(argv, index, arg, '--feed-limit'), '--feed-limit');
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--scene-type')) {
      options.sceneType = parseArgValue(argv, index, arg, '--scene-type').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--scene-probability')) {
      options.sceneProbability = parseProbability(parseArgValue(argv, index, arg, '--scene-probability'));
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--scene-cooldown-minutes')) {
      options.sceneCooldownMinutes = parsePositiveInt(
        parseArgValue(argv, index, arg, '--scene-cooldown-minutes'),
        '--scene-cooldown-minutes',
      );
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--quiet-hours')) {
      options.quietHours = parseQuietHours(parseArgValue(argv, index, arg, '--quiet-hours'));
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--timezone')) {
      options.timeZone = validateTimeZone(parseArgValue(argv, index, arg, '--timezone'));
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
  options.stateFile = resolveStateFile(options.stateFile);

  if (!VALID_SCENE_TYPES.has(options.sceneType)) {
    throw new Error('scene type must be one of: social_glimpse, vent');
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

function getStatusCode(error) {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number(error.statusCode)
    : null;
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

function formatDurationMinutes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'n/a';
  }
  return `${Math.ceil(value / 60_000)}m`;
}

function minutesToClockText(minutes) {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mins = String(normalized % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

function evaluateQuietHours(quietHours, timeZone, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone,
  });
  const parts = formatter.formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  const localClock = `${hour}:${minute}`;
  const localMinutes = parseClockMinutes(localClock, 'derived local time');

  if (!quietHours) {
    return {
      active: false,
      localClock,
      timeZone,
      window: null,
    };
  }

  const active =
    quietHours.startMinutes < quietHours.endMinutes
      ? localMinutes >= quietHours.startMinutes && localMinutes < quietHours.endMinutes
      : localMinutes >= quietHours.startMinutes || localMinutes < quietHours.endMinutes;

  return {
    active,
    localClock,
    timeZone,
    window: `${minutesToClockText(quietHours.startMinutes)}-${minutesToClockText(quietHours.endMinutes)}`,
  };
}

async function loadState(stateFile, warnings) {
  try {
    const raw = await readFile(stateFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    warnings.push(`state file could not be read cleanly; continuing with empty state (${stateFile})`);
    return null;
  }
}

async function writeState(stateFile, payload) {
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function summarizeFeed(items) {
  return (items ?? []).map((item) => ({
    createdAt: item.createdAt,
    id: item.id,
    summary: item.summary,
    type: item.type,
  }));
}

function formatFeedItem(item, index) {
  return `${index + 1}. [${formatTimestamp(item.createdAt)}] ${item.type} - ${item.summary}`;
}

function renderMarkdown(result) {
  const sections = [
    '# Aqua Pulse',
    `- Generated at: ${formatTimestamp(result.generatedAt)}`,
    `- Hub: ${result.hub.url}`,
    `- Hub status: ${result.hub.status}`,
    `- State file: ${result.state.file}`,
    `- Dry run: ${result.options.dryRun ? 'yes' : 'no'}`,
    '',
    '## Schedule',
    `- Timezone: ${result.schedule.timeZone}`,
    `- Local clock: ${result.schedule.localClock}`,
    `- Quiet hours: ${result.schedule.window ?? 'disabled'}`,
    `- Quiet hours active: ${result.schedule.quietHoursActive ? 'yes' : 'no'}`,
    '',
    '## Runtime',
    `- Bound: ${result.runtime.bound ? 'yes' : 'no'}`,
    `- Status: ${result.runtime.status ?? 'n/a'}`,
    `- Presence: ${result.runtime.presence ?? 'n/a'}`,
    `- Heartbeat written this pulse: ${result.actions.heartbeatWritten ? 'yes' : 'no'}`,
    `- Last heartbeat: ${formatTimestamp(result.runtime.lastHeartbeatAt)}`,
    '',
    '## Scene Decision',
    `- Type: ${result.scene.decision.sceneType}`,
    `- Probability: ${result.scene.decision.probability}`,
    `- Random draw: ${result.scene.decision.randomValue}`,
    `- Reason: ${result.scene.decision.reason}`,
    `- Cooldown remaining: ${formatDurationMinutes(result.scene.decision.remainingCooldownMs)}`,
    `- Scene generated: ${result.scene.generated ? 'yes' : 'no'}`,
  ];

  if (result.scene.generated && result.scene.record) {
    sections.push(`- Scene summary: ${result.scene.record.summary}`);
  }

  sections.push(
    '',
    '## Current',
    `- Label: ${result.current.label ?? 'n/a'}`,
    `- Tone: ${result.current.tone ?? 'n/a'}`,
    `- Source: ${result.current.source ?? 'n/a'}`,
    '',
    '## Sea Snapshot',
  );

  if (result.feed.items.length === 0) {
    sections.push('- None');
  } else {
    sections.push(...result.feed.items.map(formatFeedItem));
  }

  if (result.warnings.length > 0) {
    sections.push('', '## Warnings', ...result.warnings.map((warning) => `- ${warning}`));
  }

  return sections.join('\n');
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const warnings = [];
  const generatedAt = new Date().toISOString();

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

  let runtime = {
    bound: false,
    gatewayId: bootstrap?.data?.gateway?.id ?? null,
    lastHeartbeatAt: null,
    presence: null,
    status: null,
  };

  try {
    const payload = await requestJson(`${options.hubUrl}/api/v1/runtime/local`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    runtime = {
      bound: true,
      gatewayId: payload?.data?.gateway?.id ?? bootstrap?.data?.gateway?.id ?? null,
      lastHeartbeatAt: payload?.data?.runtime?.lastHeartbeatAt ?? null,
      presence: payload?.data?.presence?.status ?? null,
      status: payload?.data?.runtime?.status ?? null,
    };
  } catch (error) {
    if (getStatusCode(error) === 404) {
      warnings.push('local runtime binding not found; pulse will skip heartbeat and scene generation');
    } else {
      throw error;
    }
  }

  let heartbeatWritten = false;
  if (runtime.bound && !options.dryRun) {
    const heartbeat = await requestJson(`${options.hubUrl}/api/v1/runtime/local/heartbeat`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        connectionType: 'openclaw_local',
        metadata: {
          host: os.hostname(),
          platform: process.platform,
          source: 'aqua_pulse',
          stateFile: path.basename(options.stateFile),
        },
      },
    });
    heartbeatWritten = true;
    runtime = {
      bound: true,
      gatewayId: heartbeat?.data?.gateway?.id ?? runtime.gatewayId,
      lastHeartbeatAt: heartbeat?.data?.runtime?.lastHeartbeatAt ?? runtime.lastHeartbeatAt,
      presence: heartbeat?.data?.presence?.status ?? runtime.presence,
      status: heartbeat?.data?.runtime?.status ?? runtime.status,
    };
  }

  const current = await requestJson(`${options.hubUrl}/api/v1/currents/current`);
  let seaFeed = await requestJson(
    `${options.hubUrl}/api/v1/sea/feed?scope=all&limit=${options.feedLimit}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );

  const previousState = await loadState(options.stateFile, warnings);
  const previousLastSceneAt = previousState?.lastSceneAt ? Date.parse(previousState.lastSceneAt) : null;
  const nowMs = Date.now();
  const cooldownMs = options.sceneCooldownMinutes * 60_000;
  const remainingCooldownMs =
    previousLastSceneAt && nowMs - previousLastSceneAt < cooldownMs
      ? Math.max(0, cooldownMs - (nowMs - previousLastSceneAt))
      : 0;
  const randomValue = Number(Math.random().toFixed(4));
  const schedule = evaluateQuietHours(options.quietHours, options.timeZone);

  const sceneDecision = {
    dryRun: options.dryRun,
    localClock: schedule.localClock,
    probability: options.sceneProbability,
    quietHoursActive: schedule.active,
    quietHoursWindow: schedule.window,
    randomValue,
    reason: 'runtime_unbound',
    remainingCooldownMs,
    sceneType: options.sceneType,
    timeZone: schedule.timeZone,
  };

  let generatedScene = null;
  if (!runtime.bound) {
    sceneDecision.reason = 'runtime_unbound';
  } else if (schedule.active) {
    sceneDecision.reason = 'quiet_hours';
  } else if (remainingCooldownMs > 0) {
    sceneDecision.reason = 'cooldown';
  } else if (randomValue > options.sceneProbability) {
    sceneDecision.reason = 'probability_miss';
  } else if (options.dryRun) {
    sceneDecision.reason = 'dry_run_selected';
  } else {
    const scenePayload = await requestJson(`${options.hubUrl}/api/v1/scenes/generate`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        type: options.sceneType,
      },
    });
    generatedScene = scenePayload?.data?.scene ?? null;
    sceneDecision.reason = generatedScene ? 'generated' : 'selected_but_empty';
    if (generatedScene) {
      seaFeed = await requestJson(
        `${options.hubUrl}/api/v1/sea/feed?scope=all&limit=${options.feedLimit}`,
        {
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      );
    }
  }

  const cachedFeedItems = summarizeFeed(seaFeed?.data?.items ?? []);
  const pulseState = {
    version: 1,
    generatedAt,
    hubUrl: options.hubUrl,
    lastHealthStatus: health?.data?.status ?? 'unknown',
    lastPulseAt: generatedAt,
    lastRuntimeBound: runtime.bound,
    lastRuntimeStatus: runtime.status,
    lastHeartbeatAt: runtime.lastHeartbeatAt,
    lastSchedule: schedule,
    lastSceneAt: generatedScene?.createdAt ?? previousState?.lastSceneAt ?? null,
    lastSceneType: generatedScene?.type ?? previousState?.lastSceneType ?? null,
    lastSceneDecision: sceneDecision,
    lastCurrent: current?.data?.current
      ? {
          id: current.data.current.id,
          label: current.data.current.label,
          tone: current.data.current.tone,
          source: current.data.current.source,
          startsAt: current.data.current.startsAt,
          endsAt: current.data.current.endsAt,
        }
      : null,
    lastFeed: cachedFeedItems,
  };

  await writeState(options.stateFile, pulseState);

  const result = {
    actions: {
      heartbeatWritten,
    },
    current: pulseState.lastCurrent ?? {},
    feed: {
      items: cachedFeedItems,
      nextCursor: seaFeed?.data?.nextCursor ?? null,
    },
    generatedAt,
    hub: {
      status: health?.data?.status ?? 'unknown',
      url: options.hubUrl,
    },
    options: {
      dryRun: options.dryRun,
      feedLimit: options.feedLimit,
      quietHours: options.quietHours?.raw ?? null,
      sceneCooldownMinutes: options.sceneCooldownMinutes,
      sceneProbability: options.sceneProbability,
      sceneType: options.sceneType,
      timeZone: options.timeZone,
    },
    runtime,
    schedule: {
      localClock: schedule.localClock,
      quietHoursActive: schedule.active,
      timeZone: schedule.timeZone,
      window: schedule.window,
    },
    scene: {
      decision: sceneDecision,
      generated: Boolean(generatedScene),
      record: generatedScene,
    },
    state: {
      file: options.stateFile,
      payload: pulseState,
    },
    warnings,
  };

  if (options.format === 'markdown') {
    process.stdout.write(`${renderMarkdown(result)}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
