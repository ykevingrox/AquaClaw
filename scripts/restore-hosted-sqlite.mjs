#!/usr/bin/env node

import {
  getOptionalConfigEnvFileArg,
  getOptionalStringArg,
  getRequiredArg,
  parseArgs,
  resolveDatabasePath,
  restoreBackupSnapshot,
  runHostedSingleInstanceChecks,
} from './hosted-single-instance-lib.mjs';

const USAGE = `Restore a hosted SQLite snapshot and optionally re-run readiness checks.

Usage:
  node scripts/restore-hosted-sqlite.mjs --snapshot /var/backups/gateway-hub/gateway-hub-20260314-120000.sqlite [options]

Required:
  --snapshot PATH                 Snapshot file to restore.

Database destination:
  --database PATH                 SQLite file to overwrite.
  --config-env-file PATH          Env file that contains DATABASE_URL.

Optional:
  --service NAME                  systemd service to stop/start around the restore.
  --owner USER                    chown owner for the restored SQLite file.
  --group GROUP                   chown group for the restored SQLite file. Defaults to --owner.
  --base-url URL                  Run hosted checks after restore.
  --timeout-ms NUMBER             Per-request timeout for hosted checks. Default: 5000
  --leave-stopped                 Do not start the service after restore.
  --help                          Show this help text.
`;

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    booleanKeys: ['help', 'leave-stopped'],
  });

  if (args.help) {
    console.log(USAGE);
    return;
  }

  const snapshotPath = getRequiredArg(args, 'snapshot');
  const databasePath = resolveDatabasePath({
    database: getOptionalStringArg(args, 'database'),
    envFile: getOptionalConfigEnvFileArg(args),
  });
  const serviceName = getOptionalStringArg(args, 'service');
  const owner = getOptionalStringArg(args, 'owner');
  const group = getOptionalStringArg(args, 'group');
  const baseUrl = getOptionalStringArg(args, 'base-url');
  const timeoutMs = args['timeout-ms'] ? Number(args['timeout-ms']) : 5_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  const result = restoreBackupSnapshot({
    snapshotPath,
    databasePath,
    serviceName,
    owner,
    group,
    leaveStopped: Boolean(args['leave-stopped']),
  });
  console.log(`Snapshot restored to: ${result.databasePath}`);

  if (baseUrl && !args['leave-stopped']) {
    const checks = await runHostedSingleInstanceChecks(baseUrl, { timeoutMs });
    console.log('Hosted checks after restore passed:');
    for (const check of checks) {
      console.log(`- ${check.label}: ${check.status}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
