import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { buildApp } from '../apps/hub-server/src/app.js';
import {
  loadCommunityMemoryIndex,
  resolveCommunityMemoryPaths,
} from '../../skills/aquaclaw-openclaw-bridge/scripts/community-memory-common.mjs';
import { markCommunityMemoryNotesUsed } from '../../skills/aquaclaw-openclaw-bridge/scripts/community-memory-retrieval.mjs';
import { syncCommunityMemory } from '../../skills/aquaclaw-openclaw-bridge/scripts/community-memory-sync.mjs';
import { authorPublicExpressionWithOpenClaw } from '../../skills/aquaclaw-openclaw-bridge/scripts/aqua-hosted-pulse.mjs';
import {
  buildHostedProfileId,
  normalizeBaseUrl,
  requestJson,
  resolveHostedProfilePaths,
  saveActiveHostedProfile,
  saveHostedConfig,
} from '../../skills/aquaclaw-openclaw-bridge/scripts/hosted-aqua-common.mjs';

interface GatewayAuthResult {
  id: string;
  token: string;
  handle: string;
  displayName: string;
}

const execFileAsync = promisify(execFile);
const communityCastLoopScriptPath = fileURLToPath(new URL('./aqua-community-cast-loop.mjs', import.meta.url));

function formatSummaryLine(label: string, value: string) {
  return `${label}: ${value}`;
}

async function requestHosted(
  baseUrl: string,
  pathname: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    token?: string;
    payload?: Record<string, unknown>;
  } = {},
) {
  return requestJson(baseUrl, pathname, options);
}

async function bootstrapHostedOwner(baseUrl: string, bootstrapKey: string) {
  const payload = await requestHosted(baseUrl, '/api/v1/session/bootstrap-hosted', {
    method: 'POST',
    payload: {
      bootstrapKey,
      displayName: 'Community Cast E2E Owner',
      handle: 'community-cast-e2e-owner',
    },
  });
  return {
    hostId: payload.data.host.id as string,
    token: payload.data.credential.token as string,
  };
}

async function openHostedRegistration(baseUrl: string, ownerToken: string) {
  const payload = await requestHosted(baseUrl, '/api/v1/registration-policy', {
    method: 'PATCH',
    token: ownerToken,
    payload: {
      policy: 'open',
    },
  });
  assert.equal(payload.data.policy, 'open');
}

async function registerGateway(baseUrl: string, input: {
  displayName: string;
  handle: string;
  visibility?: 'public' | 'friends_only' | 'private';
}): Promise<GatewayAuthResult> {
  const payload = await requestHosted(baseUrl, '/api/v1/gateways/register', {
    method: 'POST',
    payload: {
      displayName: input.displayName,
      handle: input.handle,
      visibility: input.visibility ?? 'public',
    },
  });
  return {
    id: payload.data.gateway.id as string,
    token: payload.data.credential.token as string,
    handle: payload.data.gateway.handle as string,
    displayName: payload.data.gateway.displayName as string,
  };
}

async function createPublicExpression(baseUrl: string, token: string, input: {
  body: string;
  replyToExpressionId?: string;
}) {
  const payload = await requestHosted(baseUrl, '/api/v1/public-expressions', {
    method: 'POST',
    token,
    payload: input.replyToExpressionId
      ? {
          body: input.body,
          replyToExpressionId: input.replyToExpressionId,
        }
      : {
          body: input.body,
        },
  });
  return payload.data.expression as {
    id: string;
    body: string;
    parentExpressionId: string | null;
    gateway: {
      id: string;
      handle: string;
      displayName: string;
    };
  };
}

async function createRechargeEvent(baseUrl: string, token: string) {
  const payload = await requestHosted(baseUrl, '/api/v1/recharge-events', {
    method: 'POST',
    token,
    payload: {
      venueSlug: 'krusty-krab',
      venueName: 'Krusty Krab',
      cue: 'heavy_reset',
      suggestedItem: '海藻奶昔',
      suggestedKind: '奶昔',
    },
  });
  return payload.data.event as {
    id: string;
  };
}

async function runCommunityCastLoopOnce(baseUrl: string, bootstrapKey: string, rootDir: string) {
  const envFilePath = path.join(rootDir, 'community-cast-loop.env');
  const stateFilePath = path.join(rootDir, 'community-cast-loop-state.json');
  await writeFile(
    envFilePath,
    [
      'AQUA_DEPLOYMENT_MODE=hosted',
      'HOST=127.0.0.1',
      `PORT=${new URL(baseUrl).port || '80'}`,
      `AQUA_HOSTED_OWNER_BOOTSTRAP_KEY=${bootstrapKey}`,
    ].join('\n'),
    'utf8',
  );

  const { stdout } = await execFileAsync(process.execPath, [
    communityCastLoopScriptPath,
    '--once',
    '--config-env-file',
    envFilePath,
    '--state-file',
    stateFilePath,
    '--timeout-ms',
    '15000',
  ]);
  const payload = JSON.parse(stdout) as {
    ok: boolean;
    run?: {
      publishAction: string | null;
      publishedExpressionId: string | null;
      candidateId: string | null;
    };
  };
  assert.equal(payload.ok, true);

  const savedState = JSON.parse(await readFile(stateFilePath, 'utf8')) as {
    ownerSession?: {
      sessionId?: string;
    };
    lastRun?: {
      publishAction?: string | null;
      publishedExpressionId?: string | null;
    };
  };
  assert.ok(savedState.ownerSession?.sessionId);

  return {
    payload,
    stateFilePath,
    savedState,
  };
}

async function createFakeOpenClawBinary(rootDir: string, logPath: string) {
  const binDir = path.join(rootDir, 'bin');
  const binaryPath = path.join(binDir, 'openclaw');
  const source = `#!/usr/bin/env node
const fs = require('node:fs');
const argv = process.argv.slice(2);
const logPath = process.env.FAKE_OPENCLAW_LOG;
const commandIndex = argv.findIndex((value) => value === 'agents' || value === 'agent');
const command = commandIndex >= 0 ? argv[commandIndex] : null;

function log(entry) {
  if (!logPath) {
    return;
  }
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\\n');
}

log({ argv });

if (command === 'agents' && argv[commandIndex + 1] === 'list') {
  process.stdout.write('[]');
  process.exit(0);
}

if (command === 'agents' && argv[commandIndex + 1] === 'add') {
  process.stdout.write(JSON.stringify({ ok: true, id: argv[commandIndex + 2] || null }));
  process.exit(0);
}

if (command === 'agents' && argv[commandIndex + 1] === 'set-identity') {
  process.stdout.write(JSON.stringify({ ok: true }));
  process.exit(0);
}

if (command === 'agent') {
  const agentIndex = argv.indexOf('--agent');
  const promptIndex = argv.indexOf('--message');
  const agentId = agentIndex >= 0 ? argv[agentIndex + 1] : null;
  const prompt = promptIndex >= 0 ? argv[promptIndex + 1] : '';
  log({ kind: 'agent', agentId, prompt });
  const text = prompt.includes('贝贝在Krusty Krab')
    ? '先看谁在 Krusty Krab 把话头吹热吧，我刚好也记住了这股风。'
    : '这片水面今天确实有点意思。';
  process.stdout.write(JSON.stringify({ result: { payloads: [{ text }] } }));
  process.exit(0);
}

process.stdout.write(JSON.stringify({ ok: true }));
`;

  await mkdir(binDir, { recursive: true });
  await writeFile(binaryPath, source, 'utf8');
  await chmod(binaryPath, 0o755);
  await writeFile(logPath, '', 'utf8');
  return {
    binDir,
    binaryPath,
  };
}

async function main() {
  const app = buildApp({
    deploymentMode: 'hosted',
    hostedOwnerBootstrapKey: 'community-cast-e2e-secret',
  });
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gateway-hub-community-cast-e2e-'));
  const workspaceRoot = path.join(tempRoot, 'workspace');
  const fakeOpenClawLogPath = path.join(tempRoot, 'fake-openclaw.ndjson');
  const originalPath = process.env.PATH ?? '';

  try {
    await mkdir(workspaceRoot, { recursive: true });
    const listenAddress = await app.listen({ host: '127.0.0.1', port: 0 });
    const baseUrl = normalizeBaseUrl(listenAddress);
    const owner = await bootstrapHostedOwner(baseUrl, 'community-cast-e2e-secret');
    await openHostedRegistration(baseUrl, owner.token);

    const alpha = await registerGateway(baseUrl, {
      displayName: 'Community Cast Alpha',
      handle: 'community-cast-alpha',
    });
    const beta = await registerGateway(baseUrl, {
      displayName: 'Community Cast Beta',
      handle: 'community-cast-beta',
    });

    const profileId = buildHostedProfileId(baseUrl);
    const profile = resolveHostedProfilePaths({
      workspaceRoot,
      profileId,
    });
    await saveHostedConfig(profile.configPath, {
      version: 1,
      mode: 'hosted',
      hubUrl: baseUrl,
      profile: {
        id: profileId,
      },
      credential: {
        kind: 'gateway_bearer',
        token: alpha.token,
      },
      gateway: {
        id: alpha.id,
        handle: alpha.handle,
        displayName: alpha.displayName,
      },
      runtime: {
        runtimeId: 'community-cast-e2e-runtime',
        installationId: 'community-cast-e2e-installation',
        label: 'Community Cast E2E Runtime',
        source: 'community_cast_e2e',
      },
    });
    await saveActiveHostedProfile({
      workspaceRoot,
      profileId,
      hubUrl: baseUrl,
      configPath: profile.configPath,
    });

    await writeFile(
      path.join(workspaceRoot, 'SOUL.md'),
      ['# SOUL.md', '', '- Likes live, playful social moments.', '- Notices when a room starts to spark.'].join('\n'),
      'utf8',
    );
    await writeFile(
      path.join(workspaceRoot, 'USER.md'),
      ['# USER.md', '', '- Aqua hosted validation workspace.'].join('\n'),
      'utf8',
    );

    const fakeOpenClaw = await createFakeOpenClawBinary(tempRoot, fakeOpenClawLogPath);
    process.env.PATH = `${fakeOpenClaw.binDir}${path.delimiter}${originalPath}`;
    process.env.FAKE_OPENCLAW_LOG = fakeOpenClawLogPath;

    const policy = await requestHosted(baseUrl, '/api/v1/community-cast/policy', {
      method: 'PATCH',
      token: owner.token,
      payload: {
        activeWindowStart: null,
        activeWindowEnd: null,
        npcs: {
          xiaowo: {
            minIntervalMinutes: 60,
            activeWindowStart: null,
            activeWindowEnd: null,
          },
        },
      },
    });
    assert.equal(policy.data.policy.npcs.xiaowo.minIntervalMinutes, 60);

    const bulletinAnchor = await createPublicExpression(baseUrl, beta.token, {
      body: '今天海面最先把话头吹热的，还是蟹堡王那一圈吗？',
    });
    const bulletinRun = await runCommunityCastLoopOnce(baseUrl, 'community-cast-e2e-secret', tempRoot);
    assert.equal(bulletinRun.payload.run?.publishAction, 'published');

    const publishedBulletins = await requestHosted(baseUrl, '/api/v1/community-cast/bulletins?published=true&npcId=xiaowo', {
      token: owner.token,
    });
    assert.equal(publishedBulletins.data.items.length, 1);
    assert.equal(publishedBulletins.data.items[0].anchorId, bulletinAnchor.id);

    const publishedExpressionId = bulletinRun.payload.run?.publishedExpressionId;
    assert.ok(publishedExpressionId);
    const publishedThread = await requestHosted(
      baseUrl,
      `/api/v1/public-expressions?rootExpressionId=${encodeURIComponent(bulletinAnchor.id)}`,
    );
    const xiaowoReply = (publishedThread.data.items as Array<{
      id: string;
      parentExpressionId: string | null;
      gateway: {
        displayName: string;
      };
    }>).find((item) => item.id === publishedExpressionId);
    assert.ok(xiaowoReply);
    assert.equal(xiaowoReply.parentExpressionId, bulletinAnchor.id);
    assert.equal(xiaowoReply.gateway.displayName, '小蜗');

    const rechargeEvent = await createRechargeEvent(baseUrl, alpha.token);
    const alphaMine = await requestHosted(baseUrl, '/api/v1/community-memory/mine', {
      token: alpha.token,
    });
    const betaMine = await requestHosted(baseUrl, '/api/v1/community-memory/mine', {
      token: beta.token,
    });
    assert.equal(alphaMine.data.items.length, 1);
    assert.equal(alphaMine.data.items[0].npcId, 'beibei');
    assert.equal(alphaMine.data.items[0].relatedSeaEventIds[0], rechargeEvent.id);
    assert.equal(betaMine.data.items.length, 0);

    const syncResult = await syncCommunityMemory({
      workspaceRoot,
    });
    assert.equal(syncResult.stats.newNotes, 1);
    assert.equal(syncResult.index.items[0]?.npcId, 'beibei');

    const current = await requestHosted(baseUrl, '/api/v1/currents/current');
    const environment = await requestHosted(baseUrl, '/api/v1/environment/current', {
      token: alpha.token,
    });

    const replyTarget = await createPublicExpression(baseUrl, beta.token, {
      body: '在 Krusty Krab，最先把话头吹热的人总像早就排练过。',
    });

    const authored = await authorPublicExpressionWithOpenClaw({
      workspaceRoot,
      hubUrl: baseUrl,
      token: alpha.token,
      socialDecision: {
        gatewayId: alpha.id,
        handle: alpha.handle,
        reasons: ['a fresh whisper makes this public line worth answering directly'],
      },
      publicExpressionPlan: {
        mode: 'reply',
        tone: 'playful',
        venueSlug: 'krusty-krab',
        replyToExpressionId: replyTarget.id,
        rootExpressionId: replyTarget.id,
        replyToGatewayId: beta.id,
        replyToGatewayHandle: beta.handle,
      },
      current: current.data.current,
      environment: environment.data.environment,
    });
    assert.equal(authored.communityIntent.mode, 'reply');
    assert.equal(authored.communityIntent.socialGoal, 'answer_target');
    assert.equal(authored.communityIntent.topicDomain, 'gossip');
    assert.equal(authored.retrievedNoteIds.length, 1);
    assert.match(authored.prompt, /贝贝在Krusty Krab递来一条轻八卦/);
    assert.match(authored.body, /Krusty Krab/);

    const postedReply = await createPublicExpression(baseUrl, alpha.token, {
      body: authored.body,
      replyToExpressionId: replyTarget.id,
    });
    assert.equal(postedReply.parentExpressionId, replyTarget.id);
    await markCommunityMemoryNotesUsed({
      workspaceRoot,
      noteIds: authored.retrievedNoteIds,
    });

    const notePaths = resolveCommunityMemoryPaths({
      workspaceRoot,
    });
    const localIndex = await loadCommunityMemoryIndex(notePaths);
    assert.equal(localIndex.index.items.length, 1);
    assert.equal(localIndex.index.items[0]?.localRetrievedCount, 1);
    assert.equal(localIndex.index.items[0]?.localUsedCount, 1);

    const hostedBulletins = await requestHosted(
      baseUrl,
      '/api/v1/community-cast/bulletins?published=true&npcId=xiaowo',
      {
        token: owner.token,
      },
    );
    const hostedNotes = await requestHosted(
      baseUrl,
      `/api/v1/community-cast/notes?gatewayId=${encodeURIComponent(alpha.id)}&npcId=beibei`,
      {
        token: owner.token,
      },
    );
    assert.equal(hostedBulletins.data.items.length, 1);
    assert.equal(hostedNotes.data.items.length, 1);
    assert.equal(hostedNotes.data.items[0].relatedSeaEventIds[0], rechargeEvent.id);

    const replyThread = await requestHosted(
      baseUrl,
      `/api/v1/public-expressions?rootExpressionId=${encodeURIComponent(replyTarget.id)}`,
    );
    assert.equal(replyThread.data.items.length, 2);
    assert.equal(replyThread.data.items[1].body, authored.body);
    assert.equal(replyThread.data.items[1].gateway.handle, alpha.handle);

    const communityVoice = await readFile(path.join(workspaceRoot, 'SOCIAL_VOICE.md'), 'utf8');
    const communityAgents = await readFile(path.join(workspaceRoot, '.openclaw', 'community-agent-workspace', 'AGENTS.md'), 'utf8');
    const fakeOpenClawLog = await readFile(fakeOpenClawLogPath, 'utf8');
    assert.match(communityVoice, /Personality Backbone/);
    assert.match(communityAgents, /Community Lane/);
    assert.match(fakeOpenClawLog, /"agents","list"/);
    assert.match(fakeOpenClawLog, /"agents","add","community"/);
    assert.match(fakeOpenClawLog, /"kind":"agent","agentId":"community"/);

    console.log(
      [
        'Community cast cross-repo E2E succeeded.',
        formatSummaryLine('Base URL', baseUrl),
        formatSummaryLine('Owner host', owner.hostId),
        formatSummaryLine('Participant', `${alpha.handle} (${alpha.id})`),
        formatSummaryLine('Published bulletin', publishedExpressionId),
        formatSummaryLine('Retrieved note', authored.retrievedNoteIds[0] as string),
        formatSummaryLine('Reply body', authored.body),
      ].join('\n'),
    );
  } finally {
    delete process.env.FAKE_OPENCLAW_LOG;
    process.env.PATH = originalPath;
    await app.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('Community cast cross-repo E2E failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
