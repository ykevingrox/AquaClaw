#!/usr/bin/env node

import process from 'node:process';

const VALID_FORMATS = new Set(['json', 'markdown']);
const DEFAULT_HUB_URL = 'http://127.0.0.1:8787';

function printHelp() {
  console.log(`Usage: npm run aqua:social-pulse -- [options]

Options:
  --hub-url <url>          AquaClaw hub base URL (default: ${DEFAULT_HUB_URL})
  --gateway-id <id>        Limit evaluation to one gateway id
  --format <fmt>           Output format: json|markdown (default: json)
  --help                   Show this message
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
    gatewayId: null,
    hubUrl: DEFAULT_HUB_URL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith('--hub-url')) {
      options.hubUrl = parseArgValue(argv, index, arg, '--hub-url').trim();
      if (!arg.includes('=')) {
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--gateway-id')) {
      options.gatewayId = parseArgValue(argv, index, arg, '--gateway-id').trim();
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

async function requestJson(url, { method = 'GET', token, payload } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
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

function renderCandidate(candidate, index) {
  const reasons = candidate.reasons.length > 0 ? candidate.reasons.slice(0, 3).join('; ') : 'no specific reason';
  return `${index + 1}. @${candidate.peerHandle} score=${candidate.score} action=${candidate.action} status=${candidate.peerStatus} reason=${reasons}`;
}

function renderMarkdown(result) {
  const lines = [
    '# Aqua Social Pulse',
    `- Generated at: ${formatTimestamp(result.generatedAt)}`,
    `- Hub: ${result.hubUrl}`,
    `- Current: ${result.data.current.label} (${result.data.current.tone})`,
    `- Environment: ${result.data.environment.surfaceState}, ${result.data.environment.clarity}, ${result.data.environment.waterTemperatureC}C`,
    '',
    '## Decisions',
  ];

  if (result.data.items.length === 0) {
    lines.push('- None');
    return lines.join('\n');
  }

  for (const item of result.data.items) {
    lines.push(`### @${item.handle}`);
    lines.push(`- Decision: ${item.decision.action}`);
    lines.push(`- Reason: ${item.decision.reason}`);
    lines.push(`- Public urge: ${item.publicUrge}`);
    lines.push(`- Private urge: ${item.privateUrge ?? 'n/a'}`);
    if (item.decision.targetHandle) {
      lines.push(`- Target: @${item.decision.targetHandle}`);
    }
    lines.push(`- Traits: sociability=${item.traits.sociability}, curiosity=${item.traits.curiosity}, restraint=${item.traits.restraint}, loneliness=${item.traits.loneliness}`);
    lines.push(`- Reasons: ${item.reasons.slice(0, 4).join(' | ')}`);
    lines.push('- Candidates:');
    if (item.candidates.length === 0) {
      lines.push('  - none');
    } else {
      lines.push(...item.candidates.slice(0, 3).map((candidate, index) => `  ${renderCandidate(candidate, index)}`));
    }
  }

  return lines.join('\n');
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  await requestJson(`${options.hubUrl}/health`);
  const bootstrap = await requestJson(`${options.hubUrl}/api/v1/session/bootstrap-local`, {
    method: 'POST',
  });
  const token = bootstrap?.data?.credential?.token;
  if (!token) {
    throw new Error('bootstrap-local did not return a local session token');
  }

  const query = options.gatewayId ? `?gatewayId=${encodeURIComponent(options.gatewayId)}` : '';
  const response = await requestJson(`${options.hubUrl}/api/v1/social-pulse/dry-run${query}`, {
    token,
  });

  const result = {
    data: response.data,
    generatedAt: response.data.generatedAt,
    hubUrl: options.hubUrl,
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
