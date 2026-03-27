#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_FILES = [
  'README.md',
  'docs/README.md',
  'docs/archive/README.md',
  'docs/ops/gateway-hub-release-checklist-v0.1.md',
  'docs/ops/hosted-single-instance-quickstart-v0.1.md',
  'docs/ops/hosted-deploy-v0.1.md',
  'docs/ops/local-dev-config-v0.1.md',
  'docs/technical/aquaclaw-local-aquarium-launcher-v0.1.md',
  'docs/technical/gateway-social-platform-api-contract-v0.1.md',
  'scripts/README.md',
  'scripts/check-gateway-hub-release.mjs',
  'scripts/configure-local-dev.mjs',
  'scripts/dev-aquarium.mjs',
  'scripts/render-hosted-single-instance.sh',
  'scripts/init-hosted-single-instance.sh',
  'scripts/deploy-hosted-single-instance.mjs',
  'scripts/check-hosted-single-instance.mjs',
  'scripts/bootstrap-hosted-owner.mjs',
  'scripts/aquaclaw-doctor.mjs',
];

const REQUIRED_PACKAGE_SCRIPTS = [
  'build',
  'test',
  'smoke',
  'check:release',
  'dev:aquarium',
  'dev:configure',
  'ops:render:hosted',
  'ops:init:hosted',
  'ops:deploy:hosted',
  'ops:doctor',
];

const FORBIDDEN_RELEASE_SURFACE_FILES = [
  'docs/product/frontend-copy-bilingual-review.md',
  'docs/technical/aquaclaw-pixel-aquarium-next-stage-plan-v0.1.md',
];

const REQUIRED_CONTENT_CHECKS = [
  {
    file: 'README.md',
    includes: [
      '## Start Here',
      'AquaClawSkill',
      '## Local Quickstart',
      '## Hosted Quickstart',
      'docs/ops/gateway-hub-release-checklist-v0.1.md',
    ],
  },
  {
    file: 'docs/README.md',
    includes: [
      '## Start Here',
      '## By Task',
      'scripts/README.md',
      'docs/archive/README.md',
      'docs/ops/gateway-hub-release-checklist-v0.1.md',
    ],
    excludes: [
      'docs/product/frontend-copy-bilingual-review.md',
      'docs/technical/aquaclaw-pixel-aquarium-next-stage-plan-v0.1.md',
    ],
  },
  {
    file: 'scripts/README.md',
    includes: ['## Stable Entry Points', '## Internal And Specialized Helpers', 'scripts/check-gateway-hub-release.mjs'],
  },
  {
    file: 'scripts/export-frontend-translations.mjs',
    includes: ['docs/archive/reviews/frontend-copy-bilingual-review.md'],
  },
];

function isValidSemver(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(String(value ?? '').trim());
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readUtf8(filePath) {
  return readFile(filePath, 'utf8');
}

export async function runReleaseCheck({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const failures = [];

  const packageJsonPath = path.join(resolvedRepoRoot, 'package.json');
  if (!(await fileExists(packageJsonPath))) {
    failures.push('missing required file: package.json');
    return {
      ok: false,
      repoRoot: resolvedRepoRoot,
      packageVersion: null,
      failures,
    };
  }

  let packageJson = null;
  try {
    packageJson = JSON.parse(await readUtf8(packageJsonPath));
  } catch (error) {
    failures.push(`invalid package.json: ${error instanceof Error ? error.message : String(error)}`);
    return {
      ok: false,
      repoRoot: resolvedRepoRoot,
      packageVersion: null,
      failures,
    };
  }

  if (!isValidSemver(packageJson.version)) {
    failures.push(`package.json version must be valid semver, received: ${packageJson.version ?? '<missing>'}`);
  }

  const scripts = packageJson.scripts ?? {};
  for (const scriptName of REQUIRED_PACKAGE_SCRIPTS) {
    if (typeof scripts[scriptName] !== 'string' || !scripts[scriptName].trim()) {
      failures.push(`missing required package script: ${scriptName}`);
    }
  }

  for (const relativePath of REQUIRED_FILES) {
    const absolutePath = path.join(resolvedRepoRoot, relativePath);
    if (!(await fileExists(absolutePath))) {
      failures.push(`missing required file: ${relativePath}`);
    }
  }

  for (const relativePath of FORBIDDEN_RELEASE_SURFACE_FILES) {
    const absolutePath = path.join(resolvedRepoRoot, relativePath);
    if (await fileExists(absolutePath)) {
      failures.push(`file must live behind docs/archive instead of the current release surface: ${relativePath}`);
    }
  }

  for (const check of REQUIRED_CONTENT_CHECKS) {
    const absolutePath = path.join(resolvedRepoRoot, check.file);
    if (!(await fileExists(absolutePath))) {
      continue;
    }

    const content = await readUtf8(absolutePath);
    for (const needle of check.includes) {
      if (!content.includes(needle)) {
        failures.push(`${check.file} must mention: ${needle}`);
      }
    }

    for (const needle of check.excludes ?? []) {
      if (content.includes(needle)) {
        failures.push(`${check.file} must not mention: ${needle}`);
      }
    }
  }

  return {
    ok: failures.length === 0,
    repoRoot: resolvedRepoRoot,
    packageVersion: packageJson.version ?? null,
    failures,
  };
}

async function main() {
  const repoRootArg = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_REPO_ROOT;
  const result = await runReleaseCheck({ repoRoot: repoRootArg });

  if (result.ok) {
    console.log(`Result: pass (${result.packageVersion})`);
    return;
  }

  console.error('Result: fail');
  for (const failure of result.failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  await main();
}
