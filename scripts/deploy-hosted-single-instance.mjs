#!/usr/bin/env node

import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createBackupSnapshot,
  formatTimestamp,
  getOptionalStringArg,
  getRequiredArg,
  parseArgs,
  resolveDatabasePath,
  restoreBackupSnapshot,
  runCommand,
  runHostedSingleInstanceChecks,
} from './hosted-single-instance-lib.mjs';

const USAGE = `Run a rollback-friendly hosted single-instance deploy.

Usage:
  node scripts/deploy-hosted-single-instance.mjs --repo-root /opt/gateway-hub --service gateway-hub --backup-dir /var/backups/gateway-hub --base-url https://aqua.example.com [options]

Required:
  --repo-root PATH                Repo root on the target host.
  --service NAME                  systemd service to restart.
  --backup-dir PATH               Snapshot directory for pre-deploy rollback files.
  --base-url URL                  Public AquaClaw base URL for post-deploy checks.

Database source:
  --database PATH                 SQLite file managed by the service.
  --env-file PATH                 Env file that contains DATABASE_URL.

Optional:
  --skip-install                  Skip npm ci.
  --skip-tests                    Skip npm test.
  --skip-smoke                    Skip local smoke.
  --skip-hosted-smoke             Skip hosted smoke.
  --skip-hosted-sqlite-smoke      Skip hosted+sqlite smoke.
  --timeout-ms NUMBER             Per-request timeout for hosted checks. Default: 5000
  --no-rollback                   Do not auto-restore the pre-deploy snapshot if checks fail.
  --help                          Show this help text.
`;

function buildTempSmokeDbPath(label) {
  return join(tmpdir(), `gateway-hub-${label}-${formatTimestamp()}.sqlite`);
}

function runNpmScript(repoRoot, scriptName, extraEnv = null) {
  const env = extraEnv ? { ...process.env, ...extraEnv } : process.env;
  runCommand('npm', ['run', scriptName], {
    cwd: repoRoot,
    env,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    booleanKeys: [
      'help',
      'skip-install',
      'skip-tests',
      'skip-smoke',
      'skip-hosted-smoke',
      'skip-hosted-sqlite-smoke',
      'no-rollback',
    ],
  });

  if (args.help) {
    console.log(USAGE);
    return;
  }

  const repoRoot = resolve(getRequiredArg(args, 'repo-root'));
  const serviceName = getRequiredArg(args, 'service');
  const backupDir = getRequiredArg(args, 'backup-dir');
  const baseUrl = getRequiredArg(args, 'base-url');
  const timeoutMs = args['timeout-ms'] ? Number(args['timeout-ms']) : 5_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }
  if (!existsSync(repoRoot)) {
    throw new Error(`repo root does not exist: ${repoRoot}`);
  }

  const databasePath = resolveDatabasePath({
    database: getOptionalStringArg(args, 'database'),
    envFile: getOptionalStringArg(args, 'env-file'),
  });
  const hostedSmokeKey = 'hosted-smoke-secret';
  const hostedSqliteSmokeDb = buildTempSmokeDbPath('hosted-deploy-smoke');
  let snapshotPath = null;
  let checksPassed = false;

  try {
    if (!args['skip-install']) {
      console.log('Running npm ci...');
      runCommand('npm', ['ci'], { cwd: repoRoot });
    }

    console.log('Running npm run build...');
    runNpmScript(repoRoot, 'build');

    if (!args['skip-tests']) {
      console.log('Running npm test...');
      runNpmScript(repoRoot, 'test');
    }

    if (!args['skip-smoke']) {
      console.log('Running local smoke...');
      runNpmScript(repoRoot, 'smoke');
    }

    if (!args['skip-hosted-smoke']) {
      console.log('Running hosted smoke...');
      runNpmScript(repoRoot, 'smoke', {
        AQUA_DEPLOYMENT_MODE: 'hosted',
        AQUA_HOSTED_OWNER_BOOTSTRAP_KEY: hostedSmokeKey,
      });
    }

    if (!args['skip-hosted-sqlite-smoke']) {
      console.log('Running hosted sqlite smoke...');
      runNpmScript(repoRoot, 'smoke', {
        AQUA_DEPLOYMENT_MODE: 'hosted',
        AQUA_HOSTED_OWNER_BOOTSTRAP_KEY: hostedSmokeKey,
        GATEWAY_STORE_BACKEND: 'sqlite',
        DATABASE_URL: hostedSqliteSmokeDb,
      });
    }

    console.log('Creating pre-deploy snapshot...');
    const snapshot = createBackupSnapshot({
      databasePath,
      backupDir,
      serviceName,
      leaveStopped: true,
    });
    snapshotPath = snapshot.snapshotPath;
    console.log(`Pre-deploy snapshot: ${snapshotPath}`);

    console.log(`Starting ${serviceName} with the new build...`);
    runCommand('systemctl', ['start', serviceName]);

    const checks = await runHostedSingleInstanceChecks(baseUrl, { timeoutMs });
    checksPassed = true;
    console.log('Post-deploy hosted checks passed:');
    for (const check of checks) {
      console.log(`- ${check.label}: ${check.status}`);
    }
    console.log(`Deploy succeeded. Rollback snapshot retained at ${snapshotPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Deploy failed: ${message}`);

    if (!args['no-rollback'] && snapshotPath) {
      console.error(`Restoring rollback snapshot ${snapshotPath}...`);
      restoreBackupSnapshot({
        snapshotPath,
        databasePath,
        serviceName,
      });
      const rollbackChecks = await runHostedSingleInstanceChecks(baseUrl, { timeoutMs });
      console.error('Rollback checks passed:');
      for (const check of rollbackChecks) {
        console.error(`- ${check.label}: ${check.status}`);
      }
      console.error('Automatic rollback completed.');
    }

    if (!checksPassed) {
      process.exit(1);
    }
  } finally {
    if (existsSync(hostedSqliteSmokeDb)) {
      rmSync(hostedSqliteSmokeDb, { force: true });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
