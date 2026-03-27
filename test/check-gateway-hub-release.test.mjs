#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runReleaseCheck } from '../scripts/check-gateway-hub-release.mjs';

async function createFixture(repoRoot, { version = '0.1.0', omitFile = null } = {}) {
  const files = {
    'README.md': [
      '# AquaClaw / gateway-hub',
      '',
      '## Start Here',
      '',
      'Use AquaClawSkill when you only need participant onboarding.',
      'See docs/ops/gateway-hub-release-checklist-v0.1.md before handoff.',
      '',
      '## Local Quickstart',
      '',
      '## Hosted Quickstart',
      '',
    ].join('\n'),
    'docs/README.md': [
      '# Docs',
      '',
      '## Start Here',
      '',
      'See scripts/README.md, docs/archive/README.md, and docs/ops/gateway-hub-release-checklist-v0.1.md.',
      '',
      '## By Task',
      '',
    ].join('\n'),
    'docs/archive/README.md': '# Archive\n',
    'docs/ops/gateway-hub-release-checklist-v0.1.md': '# Release Checklist\n',
    'docs/ops/hosted-single-instance-quickstart-v0.1.md': '# Hosted Quickstart\n',
    'docs/ops/hosted-deploy-v0.1.md': '# Hosted Deploy\n',
    'docs/ops/local-dev-config-v0.1.md': '# Local Dev Config\n',
    'docs/technical/aquaclaw-local-aquarium-launcher-v0.1.md': '# Local Aquarium Launcher\n',
    'docs/technical/gateway-social-platform-api-contract-v0.1.md': '# API Contract\n',
    'scripts/README.md': [
      '# Scripts',
      '',
      '## Stable Entry Points',
      '',
      'scripts/check-gateway-hub-release.mjs',
      '',
      '## Internal And Specialized Helpers',
      '',
    ].join('\n'),
    'scripts/check-gateway-hub-release.mjs': 'export async function runReleaseCheck() {}\n',
    'scripts/configure-local-dev.mjs': 'export {};\n',
    'scripts/dev-aquarium.mjs': 'export {};\n',
    'scripts/render-hosted-single-instance.sh': '#!/usr/bin/env bash\n',
    'scripts/init-hosted-single-instance.sh': '#!/usr/bin/env bash\n',
    'scripts/deploy-hosted-single-instance.mjs': 'export {};\n',
    'scripts/check-hosted-single-instance.mjs': 'export {};\n',
    'scripts/bootstrap-hosted-owner.mjs': 'export {};\n',
    'scripts/aquaclaw-doctor.mjs': 'export {};\n',
    'package.json': JSON.stringify(
      {
        name: 'gateway-hub',
        version,
        scripts: {
          build: 'npm run build',
          test: 'npm run test',
          smoke: 'npm run smoke',
          'check:release': 'node scripts/check-gateway-hub-release.mjs',
          'dev:aquarium': 'node scripts/dev-aquarium.mjs',
          'dev:configure': 'node scripts/configure-local-dev.mjs',
          'ops:render:hosted': 'bash scripts/render-hosted-single-instance.sh',
          'ops:init:hosted': 'bash scripts/init-hosted-single-instance.sh',
          'ops:deploy:hosted': 'node scripts/deploy-hosted-single-instance.mjs',
          'ops:doctor': 'node scripts/aquaclaw-doctor.mjs',
        },
      },
      null,
      2,
    ),
  };

  for (const [relativePath, content] of Object.entries(files)) {
    if (relativePath === omitFile) {
      continue;
    }

    const absolutePath = path.join(repoRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }
}

test('runReleaseCheck passes on a minimal valid gateway-hub release fixture', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'gateway-hub-release-check-'));
  await createFixture(repoRoot);

  const result = await runReleaseCheck({ repoRoot });

  assert.equal(result.ok, true);
  assert.equal(result.packageVersion, '0.1.0');
  assert.deepEqual(result.failures, []);
});

test('runReleaseCheck rejects missing required release-surface files', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'gateway-hub-release-check-missing-'));
  await createFixture(repoRoot, { omitFile: 'scripts/README.md' });

  const result = await runReleaseCheck({ repoRoot });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('missing required file: scripts/README.md')));
});

test('runReleaseCheck rejects legacy files that should sit behind docs/archive', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'gateway-hub-release-check-archive-'));
  await createFixture(repoRoot);
  const legacyPath = path.join(repoRoot, 'docs/product/frontend-copy-bilingual-review.md');
  await mkdir(path.dirname(legacyPath), { recursive: true });
  await writeFile(legacyPath, '# Legacy working sheet\n');

  const result = await runReleaseCheck({ repoRoot });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.includes('file must live behind docs/archive instead of the current release surface')),
  );
});

test('runReleaseCheck rejects invalid package semver', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'gateway-hub-release-check-version-'));
  await createFixture(repoRoot, { version: 'latest' });

  const result = await runReleaseCheck({ repoRoot });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('valid semver')));
});
