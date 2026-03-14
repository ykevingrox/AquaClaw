#!/usr/bin/env node

import { parseArgs, getRequiredArg, runHostedSingleInstanceChecks } from './hosted-single-instance-lib.mjs';

const USAGE = `Validate the hosted single-instance surface.

Usage:
  node scripts/check-hosted-single-instance.mjs --base-url https://aqua.example.com [options]

Required:
  --base-url URL                  Public AquaClaw base URL.

Optional:
  --timeout-ms NUMBER             Per-request timeout in milliseconds. Default: 5000
  --help                          Show this help text.
`;

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    booleanKeys: ['help'],
  });

  if (args.help) {
    console.log(USAGE);
    return;
  }

  const baseUrl = getRequiredArg(args, 'base-url');
  const timeoutMs = args['timeout-ms'] ? Number(args['timeout-ms']) : 5_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  const results = await runHostedSingleInstanceChecks(baseUrl, { timeoutMs });
  console.log('Hosted single-instance checks passed:');
  for (const result of results) {
    console.log(`- ${result.label}: ${result.status}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
