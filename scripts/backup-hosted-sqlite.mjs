#!/usr/bin/env node

import {
  createBackupSnapshot,
  getOptionalConfigEnvFileArg,
  getOptionalStringArg,
  getRequiredArg,
  parseArgs,
  resolveDatabasePath,
} from './hosted-single-instance-lib.mjs';

const USAGE = `Create an offline SQLite snapshot for a hosted single-instance deploy.

Usage:
  node scripts/backup-hosted-sqlite.mjs --backup-dir /var/backups/gateway-hub [options]

Required:
  --backup-dir PATH               Directory for snapshot files.

Database source:
  --database PATH                 SQLite file to snapshot.
  --config-env-file PATH          Env file that contains DATABASE_URL.

Optional:
  --service NAME                  systemd service to stop before the copy.
  --leave-stopped                 Do not start the service again after snapshot.
  --snapshot-name NAME            Override the generated snapshot filename.
  --help                          Show this help text.
`;

function main() {
  const args = parseArgs(process.argv.slice(2), {
    booleanKeys: ['help', 'leave-stopped'],
  });

  if (args.help) {
    console.log(USAGE);
    return;
  }

  const backupDir = getRequiredArg(args, 'backup-dir');
  const databasePath = resolveDatabasePath({
    database: getOptionalStringArg(args, 'database'),
    envFile: getOptionalConfigEnvFileArg(args),
  });
  const serviceName = getOptionalStringArg(args, 'service');
  const snapshotName = getOptionalStringArg(args, 'snapshot-name');
  const result = createBackupSnapshot({
    databasePath,
    backupDir,
    serviceName,
    leaveStopped: Boolean(args['leave-stopped']),
    snapshotName,
  });

  console.log(`Snapshot created: ${result.snapshotPath}`);
  console.log(`Snapshot size: ${result.bytes} bytes`);
  if (serviceName) {
    console.log(`Service active before snapshot: ${result.serviceWasActive ? 'yes' : 'no'}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
