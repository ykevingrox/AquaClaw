#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

import { getOptionalStringArg, getRequiredArg, loadEnvFile, normalizeBaseUrl, parseArgs, requestJson } from './hosted-single-instance-lib.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Bootstrap or reconnect the hosted owner session.

Usage:
  node scripts/bootstrap-hosted-owner.mjs --base-url https://aqua.example.com [options]

Required:
  --base-url URL                  Public AquaClaw base URL.

Owner bootstrap key:
  --bootstrap-key KEY             Bootstrap key value.
  --env-file PATH                 Read AQUA_HOSTED_OWNER_BOOTSTRAP_KEY from an env file.

Optional identity seed:
  --display-name TEXT             Hosted owner display name on first bootstrap.
  --handle TEXT                   Hosted owner handle on first bootstrap.
  --bio TEXT                      Hosted owner bio on first bootstrap.
  --visibility VALUE              private|invite_only|friends_only|public

Output:
  --json                          Print the raw JSON response only.
  --write-file PATH               Write the raw JSON response to a file.
  --timeout-ms NUMBER             Request timeout in milliseconds. Default: 5000
  --help                          Show this help text.
`;

function requireBootstrapKey(args) {
  const explicit = getOptionalStringArg(args, 'bootstrap-key');
  if (explicit) {
    return explicit;
  }

  const envFile = getOptionalStringArg(args, 'env-file');
  if (!envFile) {
    throw new Error('either --bootstrap-key or --env-file is required');
  }

  const env = loadEnvFile(envFile);
  const loaded = env.AQUA_HOSTED_OWNER_BOOTSTRAP_KEY?.trim();
  if (!loaded) {
    throw new Error(`AQUA_HOSTED_OWNER_BOOTSTRAP_KEY is missing in ${resolve(envFile)}`);
  }
  return loaded;
}

function buildPayload(args, bootstrapKey) {
  const payload = {
    bootstrapKey,
  };

  const displayName = getOptionalStringArg(args, 'display-name');
  const handle = getOptionalStringArg(args, 'handle');
  const bio = getOptionalStringArg(args, 'bio');
  const visibility = getOptionalStringArg(args, 'visibility');

  if (displayName) {
    payload.displayName = displayName;
  }
  if (handle) {
    payload.handle = handle;
  }
  if (bio !== null) {
    payload.bio = bio;
  }
  if (visibility) {
    payload.visibility = visibility;
  }

  return payload;
}

function extractMessage(response) {
  if (response.json?.error?.message) {
    return response.json.error.message;
  }
  return `request failed with status ${response.status}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    booleanKeys: ['help', 'json'],
  });

  if (args.help) {
    console.log(USAGE);
    return;
  }

  const baseUrl = normalizeBaseUrl(getRequiredArg(args, 'base-url'));
  const bootstrapKey = requireBootstrapKey(args);
  const timeoutMs = args['timeout-ms'] ? Number(args['timeout-ms']) : 5_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  const response = await requestJson(`${baseUrl}/api/v1/session/bootstrap-hosted`, {
    method: 'POST',
    timeoutMs,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildPayload(args, bootstrapKey)),
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(extractMessage(response));
  }
  if (!response.json?.ok || !response.json?.data?.credential?.token) {
    throw new Error('bootstrap-hosted returned an invalid response payload');
  }

  const writeFilePath = getOptionalStringArg(args, 'write-file');
  if (writeFilePath) {
    const resolved = resolve(repoRoot, writeFilePath);
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, `${JSON.stringify(response.json, null, 2)}\n`, 'utf8');
    console.error(`wrote hosted owner bootstrap response to ${resolved}`);
  }

  if (args.json) {
    console.log(JSON.stringify(response.json, null, 2));
    return;
  }

  const host = response.json.data.host;
  const session = response.json.data.session;
  const credential = response.json.data.credential;
  const created = response.json.data.owner?.created === true;

  console.log('Hosted owner bootstrap succeeded:');
  console.log(`- Base URL: ${baseUrl}`);
  console.log(`- Host: @${host.handle} (${host.displayName})`);
  console.log(`- Host ID: ${host.id}`);
  console.log(`- Session ID: ${session.id}`);
  console.log(`- Created owner: ${created ? 'yes' : 'no, existing owner reconnected'}`);
  console.log(`- Credential kind: ${credential.kind}`);
  console.log(`- Token: ${credential.token}`);
  console.log('');
  console.log('Treat the token as secret owner-session credential.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
