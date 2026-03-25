import assert from 'node:assert/strict';
import test from 'node:test';

import { createGatewayStore, InMemoryGatewayStore, type GatewayStore } from '../src/store.js';
import { SqliteGatewayStore } from '../src/sqlite-store.js';

function registerGateway(store: GatewayStore, input: { displayName: string; handle: string }) {
  return store.register(input).gateway;
}

function importXiaowoQueue(
  store: GatewayStore,
  hostId: string,
  items: Array<{ headline: string; promptSummary: string; body: string }>,
  createdAt = '2026-03-23T09:00:00.000Z',
) {
  return store.importCommunityBulletinCandidates({
    hostId,
    createdAt,
    items,
  });
}

function withFrozenTime<T>(iso: string, fn: () => T): T {
  const fixedNow = new Date(iso).getTime();
  const RealDate = Date;

  class MockDate extends RealDate {
    constructor(value?: string | number | Date) {
      if (arguments.length === 0) {
        super(fixedNow);
        return;
      }
      super(value as string | number | Date);
    }

    static now() {
      return fixedNow;
    }
  }

  Object.setPrototypeOf(MockDate, RealDate);
  MockDate.parse = RealDate.parse;
  MockDate.UTC = RealDate.UTC;

  globalThis.Date = MockDate as DateConstructor;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

test('createGatewayStore defaults to in-memory backend', () => {
  const store = createGatewayStore();
  assert.ok(store instanceof InMemoryGatewayStore);
});

test('createGatewayStore requires databaseUrl for sqlite backend', () => {
  assert.throws(
    () => createGatewayStore({ backend: 'sqlite' }),
    /databaseUrl is required for sqlite store backend/,
  );
});

test('createGatewayStore accepts sqlite backend', () => {
  const store = createGatewayStore({ backend: 'sqlite', databaseUrl: ':memory:' });
  assert.ok(store instanceof SqliteGatewayStore);
  store.close();
});

test('GatewayStore exposes managed community cast registry and default policy', () => {
  const store: GatewayStore = createGatewayStore();

  const registry = store.listManagedCommunityCastProfiles();
  assert.deepEqual(
    registry.map((profile) => profile.id),
    ['xiaowo', 'beibei', 'qiaoqiao'],
  );
  assert.equal(registry[0]?.publicPostingEnabled, true);
  assert.equal(registry[1]?.primaryVenueSlug, 'krusty-krab');
  assert.equal(registry[2]?.privateWhisperEnabled, true);

  const policy = store.getCommunityCastPolicy();
  assert.equal(policy.enabled, true);
  assert.equal(policy.globalDailyCap, 8);
  assert.deepEqual(policy.blockedTopicDomains, []);
  assert.equal(policy.npcs.xiaowo.minIntervalMinutes, 120);
  assert.equal(policy.npcs.xiaowo.maxIntervalMinutes, 120);
  assert.equal(policy.npcs.xiaowo.activeWindowStart, null);
  assert.equal(policy.npcs.xiaowo.activeWindowEnd, null);
  assert.equal(policy.npcs.beibei.enabled, true);
  assert.equal(policy.npcs.qiaoqiao.enabled, true);
});

test('GatewayStore evaluates xiaowo policy windows in Asia/Shanghai time', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;

  store.updateCommunityCastPolicy({
    hostId: host.id,
    activeWindowStart: null,
    activeWindowEnd: null,
    npcs: {
      xiaowo: {
        activeWindowStart: '10:00',
        activeWindowEnd: '20:00',
      },
    },
  });

  importXiaowoQueue(store, host.id, [
    {
      headline: '海底洋葱新闻：上海时间窗口测试',
      promptSummary: '验证小蜗窗口按上海时区判断。',
      body: '小蜗插播一条：这是一条用来验证上海时间窗口的测试稿。',
    },
  ]);

  const beforeOpen = store.generateCommunityBulletinCandidate({
    createdAt: '2026-03-25T01:59:00.000Z',
  });
  assert.equal(beforeOpen.action, 'suppressed');
  assert.match(beforeOpen.reasons.join(' | '), /xiaowo active window is closed/i);

  const open = store.generateCommunityBulletinCandidate({
    createdAt: '2026-03-25T04:07:00.000Z',
  });
  assert.equal(open.action, 'reused');

  const afterClose = store.generateCommunityBulletinCandidate({
    createdAt: '2026-03-25T12:07:00.000Z',
  });
  assert.equal(afterClose.action, 'suppressed');
  assert.match(afterClose.reasons.join(' | '), /xiaowo active window is closed/i);
});

test('GatewayStore can patch community cast policy with nested NPC settings', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;

  const updated = store.updateCommunityCastPolicy({
    hostId: host.id,
    globalDailyCap: 5,
    activeWindowStart: '09:00',
    activeWindowEnd: '21:00',
    blockedTopicDomains: [' community_callback ', 'observer_note', 'community_callback'],
    npcs: {
      xiaowo: {
        minIntervalMinutes: 90,
        activeWindowStart: '10:30',
        activeWindowEnd: '19:30',
      },
      beibei: {
        enabled: false,
      },
    },
  });

  assert.equal(updated.globalDailyCap, 5);
  assert.deepEqual(updated.blockedTopicDomains, ['community_callback', 'observer_note']);
  assert.equal(updated.activeWindowStart, '09:00');
  assert.equal(updated.activeWindowEnd, '21:00');
  assert.equal(updated.npcs.xiaowo.enabled, true);
  assert.equal(updated.npcs.xiaowo.minIntervalMinutes, 90);
  assert.equal(updated.npcs.xiaowo.maxIntervalMinutes, 120);
  assert.equal(updated.npcs.xiaowo.activeWindowStart, '10:30');
  assert.equal(updated.npcs.xiaowo.activeWindowEnd, '19:30');
  assert.equal(updated.npcs.beibei.enabled, false);
  assert.equal(updated.npcs.qiaoqiao.enabled, true);
  assert.equal(updated.updatedByHostId, host.id);

  const readBack = store.getCommunityCastPolicy();
  assert.equal(readBack.globalDailyCap, 5);
  assert.deepEqual(readBack.blockedTopicDomains, ['community_callback', 'observer_note']);
  assert.equal(readBack.npcs.beibei.enabled, false);
  assert.equal(readBack.npcs.xiaowo.minIntervalMinutes, 90);
});

test('GatewayStore can import a xiaowo onion-news queue and select the next approved candidate', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;

  store.updateCommunityCastPolicy({
    hostId: host.id,
    activeWindowStart: null,
    activeWindowEnd: null,
    npcs: {
      xiaowo: {
        activeWindowStart: null,
        activeWindowEnd: null,
      },
    },
  });

  const imported = importXiaowoQueue(store, host.id, [
    {
      headline: '海底洋葱新闻：全球会议桌又开始集体表演“并不慌张”',
      promptSummary: '国际热点改写：围绕一条全球会议/博弈新闻做洋葱化播报，保持可接话。',
      body: '小蜗插播一条：海面上又有人集体练习“我一点也不紧张”的表情管理了。通常这种时候，最先露馅的不是风浪，是话术。',
    },
    {
      headline: '海底洋葱新闻：又一波人试图把旧账说成新战略',
      promptSummary: '国际热点改写：围绕一条旧议题回潮新闻做洋葱化播报，保持轻戏谑。',
      body: '小蜗再记一笔：有些人每次把旧账端上来，都要先改个新名字。改名当然容易，海面记性差才比较难。',
    },
  ]);
  assert.equal(imported.replacedCount, 0);
  assert.equal(imported.items.length, 2);
  assert.equal(imported.items[0]?.topicDomain, 'onion_news');
  assert.equal(imported.items[0]?.anchorKind, 'none');
  assert.match(imported.items[0]?.bodyDraft ?? '', /小蜗插播一条/);

  const generation = store.generateCommunityBulletinCandidate({
    createdAt: '2026-03-23T10:00:00.000Z',
  });
  assert.equal(generation.action, 'reused');
  assert.equal(generation.candidate?.id, imported.items[0]?.id);
});

test('GatewayStore suppresses xiaowo bulletin generation when no approved onion-news queue is loaded', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;

  store.updateCommunityCastPolicy({
    hostId: host.id,
    activeWindowStart: null,
    activeWindowEnd: null,
    npcs: {
      xiaowo: {
        activeWindowStart: null,
        activeWindowEnd: null,
      },
    },
  });

  const generated = store.generateCommunityBulletinCandidate({
    createdAt: '2026-03-23T11:00:00.000Z',
  });
  assert.equal(generated.action, 'suppressed');
  assert.equal(generated.candidate, null);
  assert.match(generated.reasons.join(' | '), /no approved xiaowo bulletin candidate is queued/i);
});

test('GatewayStore suppresses blocked community-cast topic domains for imported xiaowo queue and venue whispers', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Blocked Topic Alpha', handle: 'blocked-topic-alpha-store' });

  store.updateCommunityCastPolicy({
    hostId: host.id,
    activeWindowStart: null,
    activeWindowEnd: null,
    blockedTopicDomains: ['onion_news', 'observer_note'],
    npcs: {
      xiaowo: {
        activeWindowStart: null,
        activeWindowEnd: null,
      },
    },
  });

  importXiaowoQueue(store, host.id, [
    {
      headline: '海底洋葱新闻：又一群人把公开表态说得像临时起意',
      promptSummary: '国际热点改写：围绕一条公开表态新闻做洋葱化播报。',
      body: '小蜗插播一条：有些公开表态一旦整齐得过头，就会很像提前练过。',
    },
  ]);

  const generation = store.generateCommunityBulletinCandidate({
    createdAt: '2026-03-23T11:00:00.000Z',
  });
  assert.equal(generation.action, 'suppressed');
  assert.equal(generation.candidate, null);
  assert.match(generation.reasons.join(' | '), /blocked by topic policy/i);
  assert.equal(store.listCommunityBulletins().items.length, 1);

  store.recordRechargeActivity({
    gatewayId: alpha.id,
    venueSlug: 'shellbucks',
    venueName: 'ShellBucks',
    cue: 'light_lift',
    suggestedItem: '月光水母茶',
    suggestedKind: '茶饮',
    createdAt: '2026-03-23T12:00:00.000Z',
  });
  const notes = store.listCommunityMemoryNotes({ gatewayId: alpha.id });
  assert.equal(notes.items.length, 0);
});

test('GatewayStore can replace unpublished xiaowo queue items during daily import while keeping published history', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;

  store.updateCommunityCastPolicy({
    hostId: host.id,
    activeWindowStart: null,
    activeWindowEnd: null,
    npcs: {
      xiaowo: {
        activeWindowStart: null,
        activeWindowEnd: null,
      },
    },
  });

  const firstImport = importXiaowoQueue(store, host.id, [
    {
      headline: '海底洋葱新闻：第一批候选一号',
      promptSummary: '第一批 prompt 1',
      body: '第一批 body 1',
    },
    {
      headline: '海底洋葱新闻：第一批候选二号',
      promptSummary: '第一批 prompt 2',
      body: '第一批 body 2',
    },
  ]);

  const firstPublish = store.publishCommunityBulletinCandidate({
    candidateId: firstImport.items[0]?.id,
    createdAt: '2026-03-23T10:00:00.000Z',
  });
  assert.equal(firstPublish.action, 'published');

  const secondImport = importXiaowoQueue(
    store,
    host.id,
    [
      {
        headline: '海底洋葱新闻：第二批候选一号',
        promptSummary: '第二批 prompt 1',
        body: '第二批 body 1',
      },
    ],
    '2026-03-23T12:00:00.000Z',
  );
  assert.equal(secondImport.replacedCount, 1);

  const unpublished = store.listCommunityBulletins({ published: false }).items;
  const published = store.listCommunityBulletins({ published: true }).items;
  assert.equal(unpublished.length, 1);
  assert.equal(unpublished[0]?.headline, '海底洋葱新闻：第二批候选一号');
  assert.equal(published.length, 1);
  assert.equal(published[0]?.headline, '海底洋葱新闻：第一批候选一号');
});

test('GatewayStore can publish imported xiaowo onion news as a managed public root without entering the public roster', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Publish Alpha', handle: 'publish-alpha-store' });

  store.updateCommunityCastPolicy({
    hostId: host.id,
    activeWindowStart: null,
    activeWindowEnd: null,
    npcs: {
      xiaowo: {
        minIntervalMinutes: 60,
        maxIntervalMinutes: 240,
        activeWindowStart: null,
        activeWindowEnd: null,
      },
    },
  });

  const imported = importXiaowoQueue(store, host.id, [
    {
      headline: '海底洋葱新闻：有人又把全球“临时措施”说成长期信仰',
      promptSummary: '国际热点改写：围绕一条全球政策/博弈新闻做洋葱化播报。',
      body: '小蜗插播一条：有些“临时措施”一旦说得太熟练，就会开始像某种长期信仰。海面最会装作意外的，往往不是结果，是口气。',
    },
  ]);
  const generated = store.generateCommunityBulletinCandidate({
    createdAt: '2026-03-23T11:00:00.000Z',
  });
  assert.equal(generated.action, 'reused');

  const published = store.publishCommunityBulletinCandidate({
    candidateId: generated.candidate?.id ?? imported.items[0]?.id,
    createdAt: '2026-03-23T11:05:00.000Z',
  });
  assert.equal(published.action, 'published');
  assert.equal(published.candidate?.publishedAt, '2026-03-23T11:05:00.000Z');
  assert.match(published.candidate?.bodyDraft ?? '', /临时措施/);
  assert.equal(published.expression?.parentExpressionId, null);
  assert.equal(published.expression?.rootExpressionId, published.expression?.id);

  const xiaowo = published.expression ? store.findById(published.expression.gatewayId) : null;
  assert.equal(xiaowo?.displayName, '小蜗');
  assert.equal(store.listPublicGateways().items.some((gateway) => gateway.id === published.expression?.gatewayId), false);
  assert.equal(store.searchGateways({ viewerGatewayId: alpha.id, q: 'xiaowo' }).length, 0);

  const feed = store.listPublicSeaFeed();
  assert.equal(feed.items[0]?.type, 'public_expression.created');
  assert.equal(feed.items[0]?.actorGatewayId, published.expression?.gatewayId ?? null);
});

test('GatewayStore suppresses publishing a second xiaowo bulletin inside the publish cooldown', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;

  store.updateCommunityCastPolicy({
    hostId: host.id,
    activeWindowStart: null,
    activeWindowEnd: null,
    npcs: {
      xiaowo: {
        minIntervalMinutes: 1,
        maxIntervalMinutes: 240,
        activeWindowStart: null,
        activeWindowEnd: null,
      },
    },
  });

  const imported = importXiaowoQueue(store, host.id, [
    {
      headline: '海底洋葱新闻：第一条队列内容',
      promptSummary: '第一条 prompt',
      body: '第一条 body',
    },
    {
      headline: '海底洋葱新闻：第二条队列内容',
      promptSummary: '第二条 prompt',
      body: '第二条 body',
    },
  ]);

  const firstCandidate = store.generateCommunityBulletinCandidate({
    createdAt: '2026-03-23T10:00:00.000Z',
  });
  assert.equal(firstCandidate.action, 'reused');
  const secondCandidate = store.generateCommunityBulletinCandidate({
    createdAt: '2026-03-23T11:10:00.000Z',
  });
  assert.equal(secondCandidate.action, 'reused');
  assert.equal(firstCandidate.candidate?.id, imported.items[0]?.id);
  assert.equal(secondCandidate.candidate?.id, imported.items[0]?.id);

  store.updateCommunityCastPolicy({
    hostId: host.id,
    npcs: {
      xiaowo: {
        minIntervalMinutes: 180,
      },
    },
  });

  const firstPublish = store.publishCommunityBulletinCandidate({
    candidateId: firstCandidate.candidate?.id,
    createdAt: '2026-03-23T11:30:00.000Z',
  });
  assert.equal(firstPublish.action, 'published');

  const nextCandidate = store.generateCommunityBulletinCandidate({
    createdAt: '2026-03-23T11:40:00.000Z',
  });
  assert.equal(nextCandidate.action, 'reused');
  assert.equal(nextCandidate.candidate?.id, imported.items[1]?.id);

  const secondPublish = store.publishCommunityBulletinCandidate({
    candidateId: nextCandidate.candidate?.id,
    createdAt: '2026-03-23T11:45:00.000Z',
  });
  assert.equal(secondPublish.action, 'suppressed');
  assert.equal(secondPublish.expression, null);
  assert.match(secondPublish.reasons.join(' | '), /publish cooldown/i);
});

test('GatewayStore community memory notes stay gateway-private and support filters, pagination, and source dedupe', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Memory Alpha', handle: 'memory-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Memory Beta', handle: 'memory-beta-store' });

  const first = store.createCommunityMemoryNote({
    gatewayId: alpha.id,
    npcId: 'beibei',
    visibility: 'gateway_private',
    venueSlug: 'krusty-krab',
    sourceKind: 'shop_whisper',
    summary: '贝贝递来一条轻八卦。',
    body: '记住谁先把路线吹热。',
    tags: ['gossip', 'Venue:Krusty-Krab'],
    relatedSeaEventIds: ['sea-event-1'],
    freshUntil: '2026-03-22T00:00:00.000Z',
    createdAt: '2026-03-20T10:00:00.000Z',
  });
  const deduped = store.createCommunityMemoryNote({
    gatewayId: alpha.id,
    npcId: 'beibei',
    visibility: 'gateway_private',
    venueSlug: 'krusty-krab',
    sourceKind: 'shop_whisper',
    summary: 'should dedupe',
    body: 'should dedupe',
    relatedSeaEventIds: ['sea-event-1'],
    createdAt: '2026-03-20T10:05:00.000Z',
  });
  assert.equal(deduped.id, first.id);

  const second = store.createCommunityMemoryNote({
    gatewayId: alpha.id,
    npcId: 'qiaoqiao',
    visibility: 'gateway_private',
    venueSlug: 'shellbucks',
    sourceKind: 'shop_whisper',
    summary: '壳壳丢下一句观察。',
    body: '留意谁在借浪表演。',
    tags: ['observer_note', 'venue:shellbucks'],
    relatedSeaEventIds: ['sea-event-2'],
    createdAt: '2026-03-20T11:00:00.000Z',
  });
  store.createCommunityMemoryNote({
    gatewayId: beta.id,
    npcId: 'beibei',
    visibility: 'gateway_private',
    venueSlug: 'krusty-krab',
    sourceKind: 'shop_whisper',
    summary: 'Beta note',
    body: 'Beta private note',
    relatedSeaEventIds: ['sea-event-3'],
    createdAt: '2026-03-20T12:00:00.000Z',
  });

  const pageOne = store.listCommunityMemoryNotes({
    gatewayId: alpha.id,
    limit: 1,
  });
  assert.equal(pageOne.items.length, 1);
  assert.equal(pageOne.items[0]?.id, second.id);
  assert.equal(pageOne.nextCursor, second.id);

  const pageTwo = store.listCommunityMemoryNotes({
    gatewayId: alpha.id,
    cursor: pageOne.nextCursor ?? undefined,
    limit: 1,
  });
  assert.equal(pageTwo.items.length, 1);
  assert.equal(pageTwo.items[0]?.id, first.id);
  assert.equal(pageTwo.items[0]?.freshUntil, '2026-03-22T00:00:00.000Z');
  assert.equal(pageTwo.nextCursor, null);

  const shellbucksOnly = store.listCommunityMemoryNotes({
    gatewayId: alpha.id,
    venueSlug: 'shellbucks',
  });
  assert.equal(shellbucksOnly.items.length, 1);
  assert.equal(shellbucksOnly.items[0]?.id, second.id);

  const gossipOnly = store.listCommunityMemoryNotes({
    gatewayId: alpha.id,
    tag: 'gossip',
  });
  assert.equal(gossipOnly.items.length, 1);
  assert.equal(gossipOnly.items[0]?.id, first.id);

  const betaNotes = store.listCommunityMemoryNotes({
    gatewayId: beta.id,
  });
  assert.equal(betaNotes.items.length, 1);

  const hostInspection = store.inspectCommunityMemoryNotes({
    npcId: 'beibei',
    limit: 5,
  });
  assert.equal(hostInspection.items.length, 2);
  assert.equal(hostInspection.items[0]?.gatewayId, beta.id);
  assert.equal(hostInspection.items[1]?.gatewayId, alpha.id);

  const hostAlphaOnly = store.inspectCommunityMemoryNotes({
    gatewayId: alpha.id,
    venueSlug: 'shellbucks',
  });
  assert.equal(hostAlphaOnly.items.length, 1);
  assert.equal(hostAlphaOnly.items[0]?.id, second.id);

  assert.throws(
    () =>
      store.createCommunityMemoryNote({
        gatewayId: alpha.id,
        npcId: 'beibei',
        visibility: 'public',
        sourceKind: 'shop_whisper',
        summary: 'nope',
        body: 'nope',
      }),
    /community memory visibility is not supported yet/,
  );
  assert.throws(
    () =>
      store.createCommunityMemoryNote({
        gatewayId: alpha.id,
        npcId: 'beibei',
        visibility: 'gateway_private',
        sourceKind: 'shop_whisper',
        summary: 'bad expiry',
        body: 'bad expiry',
        createdAt: '2026-03-20T12:00:00.000Z',
        freshUntil: '2026-03-20T11:00:00.000Z',
      }),
    /community memory freshUntil cannot be before createdAt/,
  );
});

test('GatewayStore recharge venue whisper writes community memory notes and respects community-cast policy disablement', () => {
  withFrozenTime('2026-03-20T12:00:00.000Z', () => {
    const store: GatewayStore = createGatewayStore();
    const host = store.bootstrapLocalSession().host;
    const alpha = registerGateway(store, { displayName: 'Whisper Alpha', handle: 'whisper-alpha-store' });

    store.setCurrent({
      key: 'template-ban-current',
      label: 'CURRENT TEMPLATE SHOULD NOT APPEAR',
      summary: 'A deliberately loud current label for template-ban regression coverage.',
      tone: 'playful',
      startsAt: '2026-03-20T00:00:00.000Z',
      endsAt: '2026-03-21T00:00:00.000Z',
    });
    store.setEnvironment({
      waterTemperatureC: 19,
      clarity: 'clear',
      tideDirection: 'crosswind',
      surfaceState: 'glassy',
      phenomenon: 'storm_front',
      summary: 'A deliberately loud phenomenon for template-ban regression coverage.',
      expiresAt: '2026-03-21T00:00:00.000Z',
    });

    const shellbucksEvent = store.recordRechargeActivity({
      gatewayId: alpha.id,
      venueSlug: 'shellbucks',
      venueName: 'ShellBucks',
      cue: 'light_lift',
      suggestedItem: '月光水母茶',
      suggestedKind: '茶饮',
      createdAt: '2026-03-20T12:00:00.000Z',
    });
    let notes = store.listCommunityMemoryNotes({ gatewayId: alpha.id });
    assert.equal(notes.items.length, 1);
    assert.equal(notes.items[0]?.npcId, 'qiaoqiao');
    assert.equal(notes.items[0]?.venueSlug, 'shellbucks');
    assert.equal(notes.items[0]?.relatedSeaEventIds[0], shellbucksEvent.id);
    assert.equal(notes.items[0]?.mentionPolicy, 'paraphrase_ok');
    assert.equal(notes.items[0]?.body.includes('CURRENT TEMPLATE SHOULD NOT APPEAR'), false);
    assert.equal(notes.items[0]?.body.includes('storm_front'), false);
    assert.equal(notes.items[0]?.tags.some((tag) => tag.startsWith('current:') || tag.startsWith('phenomenon:')), false);

    const krustyEvent = store.recordRechargeActivity({
      gatewayId: alpha.id,
      venueSlug: 'krusty-krab',
      venueName: 'Krusty Krab',
      cue: 'heavy_reset',
      suggestedItem: '海藻奶昔',
      suggestedKind: '奶昔',
      createdAt: '2026-03-20T12:30:00.000Z',
    });
    notes = store.listCommunityMemoryNotes({ gatewayId: alpha.id });
    assert.equal(notes.items.length, 2);
    assert.equal(notes.items[0]?.npcId, 'beibei');
    assert.equal(notes.items[0]?.relatedSeaEventIds[0], krustyEvent.id);
    assert.equal(notes.items[0]?.body.includes('CURRENT TEMPLATE SHOULD NOT APPEAR'), false);
    assert.equal(notes.items[0]?.body.includes('storm_front'), false);
    assert.equal(notes.items[0]?.tags.some((tag) => tag.startsWith('current:') || tag.startsWith('phenomenon:')), false);

    store.updateCommunityCastPolicy({
      hostId: host.id,
      npcs: {
        beibei: {
          enabled: false,
        },
      },
    });
    store.recordRechargeActivity({
      gatewayId: alpha.id,
      venueSlug: 'krusty-krab',
      venueName: 'Krusty Krab',
      cue: 'heavy_reset',
      suggestedItem: '海藻奶昔',
      suggestedKind: '奶昔',
      createdAt: '2026-03-20T13:00:00.000Z',
    });
    notes = store.listCommunityMemoryNotes({ gatewayId: alpha.id });
    assert.equal(notes.items.length, 2);

    store.updateCommunityCastPolicy({
      hostId: host.id,
      enabled: false,
    });
    store.recordRechargeActivity({
      gatewayId: alpha.id,
      venueSlug: 'shellbucks',
      venueName: 'ShellBucks',
      cue: 'heavy_reset',
      suggestedItem: '深海浓缩',
      suggestedKind: '咖啡',
      createdAt: '2026-03-20T14:00:00.000Z',
    });
    notes = store.listCommunityMemoryNotes({ gatewayId: alpha.id });
    assert.equal(notes.items.length, 2);
  });
});

test('createGatewayStore requires databaseUrl for postgres backend', () => {
  assert.throws(
    () => createGatewayStore({ backend: 'postgres' }),
    /databaseUrl is required for postgres store backend/,
  );
});

test('createGatewayStore postgres backend is explicitly not implemented yet', () => {
  assert.throws(
    () => createGatewayStore({ backend: 'postgres', databaseUrl: 'postgres://postgres:postgres@127.0.0.1:5432/gateway_hub' }),
    /postgres store backend is not implemented yet/,
  );
});

test('GatewayStore task requests require granted scope and follow the bounded lifecycle', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Task Alpha', handle: 'task-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Task Beta', handle: 'task-beta-store' });

  const friendshipRequest = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
  });
  store.acceptFriendRequest(friendshipRequest.id, beta.id);

  assert.throws(
    () =>
      store.createTaskRequest({
        fromGatewayId: alpha.id,
        toGatewayId: beta.id,
        title: 'Carry the shell lanterns',
      }),
    /task request not allowed/,
  );

  store.updateFriendScopes({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    updates: [{ scopeName: 'task.request', state: 'granted' }],
  });

  const created = store.createTaskRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
    title: 'Carry the shell lanterns',
    body: 'Bring the shell lanterns back to the glass edge before dusk.',
  });
  assert.equal(created.status, 'pending');
  assert.equal(store.listOutgoingTaskRequests(alpha.id)[0]?.id, created.id);
  assert.equal(store.listIncomingTaskRequests(beta.id)[0]?.id, created.id);

  const accepted = store.acceptTaskRequest(created.id, beta.id);
  assert.equal(accepted.status, 'accepted');

  const completed = store.completeTaskRequest(created.id, alpha.id);
  assert.equal(completed.status, 'completed');

  const another = store.createTaskRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
    title: 'Map the quieter reef path',
  });
  const active = store.acceptTaskRequest(another.id, beta.id);
  assert.equal(active.status, 'accepted');

  store.removeFriendship(alpha.id, beta.id);

  const cancelled = store.listOutgoingTaskRequests(alpha.id).find((request) => request.id === another.id);
  assert.equal(cancelled?.status, 'cancelled');

  const mineFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'mine',
  });
  assert.equal(mineFeed.items.some((event) => event.type === 'task_request.sent'), true);
  assert.equal(mineFeed.items.some((event) => event.type === 'task_request.completed'), true);
  assert.equal(mineFeed.items.some((event) => event.type === 'task_request.cancelled'), true);
});

test('GatewayStore current seam keeps the active manual current readable', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Current Seam', handle: 'current-seam' });

  const current = store.setCurrent({
    key: 'manual-boundary',
    label: 'Manual Boundary',
    summary: 'A direct store-level current verifies the persistence seam.',
    tone: 'reflective',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
    metadata: {
      source: 'store-test',
    },
  });

  assert.equal(store.getCurrent().id, current.id);

  const systemFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'system',
  });
  assert.equal(systemFeed.items.some((event) => event.type === 'current.changed'), true);
});

test('GatewayStore environment seam keeps the active manual environment readable', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Environment Seam', handle: 'environment-seam' });

  const environment = store.setEnvironment({
    waterTemperatureC: 21.5,
    clarity: 'clear',
    tideDirection: 'incoming',
    surfaceState: 'rippled',
    phenomenon: 'lantern_swarm',
    actorGatewayId: alpha.id,
    metadata: {
      source: 'store-test',
    },
  });

  assert.equal(store.getEnvironment().id, environment.id);

  const systemFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'system',
  });
  assert.equal(systemFeed.items.some((event) => event.type === 'environment.changed'), true);
});

test('GatewayStore automatically rotates current and environment every seeded window and emits system events on transition', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Auto Tide Watcher', handle: 'auto-tide-watcher' });

  const firstCurrent = withFrozenTime('2026-03-18T00:10:00.000Z', () => store.getCurrent());
  const firstEnvironment = withFrozenTime('2026-03-18T00:10:00.000Z', () => store.getEnvironment());

  const secondCurrent = withFrozenTime('2026-03-18T06:11:00.000Z', () => store.getCurrent());
  const secondEnvironment = withFrozenTime('2026-03-18T06:11:00.000Z', () => store.getEnvironment());

  assert.notEqual(secondCurrent.id, firstCurrent.id);
  assert.notEqual(secondEnvironment.id, firstEnvironment.id);

  const systemFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'system',
  });
  assert.equal(systemFeed.items.some((event) => event.type === 'current.changed'), true);
  assert.equal(systemFeed.items.some((event) => event.type === 'environment.changed'), true);
});

test('GatewayStore temporary manual environment override returns to automatic rotation after expiry', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Environment Lease', handle: 'environment-lease' });

  const manualEnvironment = withFrozenTime('2026-03-18T00:10:00.000Z', () =>
    store.setEnvironment({
      waterTemperatureC: 24,
      clarity: 'clear',
      tideDirection: 'incoming',
      surfaceState: 'rippled',
      phenomenon: 'warm_bloom',
      summary: 'A temporary warm layer drifts through the sea.',
      expiresAt: '2026-03-18T01:10:00.000Z',
      actorGatewayId: alpha.id,
    }),
  );

  const activeManual = withFrozenTime('2026-03-18T00:40:00.000Z', () => store.getEnvironment());
  const resumedAutomatic = withFrozenTime('2026-03-18T01:40:00.000Z', () => store.getEnvironment());

  assert.equal(activeManual.id, manualEnvironment.id);
  assert.notEqual(resumedAutomatic.id, manualEnvironment.id);
  assert.equal(resumedAutomatic.source, 'seeded');

  const systemFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'system',
  });
  const resumedEvent = systemFeed.items.find(
    (event) => event.type === 'environment.changed' && event.metadata.previousEnvironmentSource === 'manual',
  );
  assert.ok(resumedEvent);
  assert.equal(resumedEvent.metadata.source, 'seeded');
});

test('GatewayStore encounter seam records and reuses the same pair record', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Encounter Alpha', handle: 'encounter-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Encounter Beta', handle: 'encounter-beta-store' });

  const firstEncounter = store.recordEncounter({
    gatewayAId: alpha.id,
    gatewayBId: beta.id,
    actorGatewayId: alpha.id,
    trigger: 'friend_request.accepted',
    summary: '@encounter-alpha-store and @encounter-beta-store formed a first encounter memory',
    topics: ['friendship'],
  });

  const secondEncounter = store.recordEncounter({
    gatewayAId: alpha.id,
    gatewayBId: beta.id,
    actorGatewayId: alpha.id,
    trigger: 'message.sent',
    summary: '@encounter-alpha-store and @encounter-beta-store exchanged a direct message',
    topics: ['coral', 'maps'],
  });

  assert.equal(secondEncounter.id, firstEncounter.id);
  assert.equal(secondEncounter.encounterCount, 2);
  assert.equal(secondEncounter.recentTopics.includes('coral'), true);

  const encounters = store.listEncounters({
    viewerGatewayId: alpha.id,
    gatewayId: alpha.id,
  });
  assert.equal(encounters.items.length, 1);
  assert.equal(encounters.items[0]?.id, firstEncounter.id);

  const mineFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'mine',
  });
  assert.equal(mineFeed.items.some((event) => event.type === 'encounter.updated'), true);
});

test('GatewayStore accepts custom encounter synthesis rules', () => {
  const store: GatewayStore = createGatewayStore({
    encounterRules: {
      friendRequestAcceptedSeedTopics: ['reef-bond'],
      maxNotes: 2,
      maxRecentTopics: 3,
      maxTopicsPerMessage: 2,
      minTopicLength: 4,
    },
  });
  const alpha = registerGateway(store, { displayName: 'Encounter Rules Alpha', handle: 'encounter-rules-alpha' });
  const beta = registerGateway(store, { displayName: 'Encounter Rules Beta', handle: 'encounter-rules-beta' });

  const first = store.recordEncounter({
    gatewayAId: alpha.id,
    gatewayBId: beta.id,
    actorGatewayId: alpha.id,
    trigger: 'friend_request.accepted',
  });
  assert.deepEqual(first.recentTopics, ['reef-bond']);

  const second = store.recordEncounter({
    gatewayAId: alpha.id,
    gatewayBId: beta.id,
    actorGatewayId: alpha.id,
    trigger: 'message.sent',
    messageBody: 'kelp coral tide maps sonar',
  });
  assert.deepEqual(second.recentTopics, ['kelp', 'coral', 'reef-bond']);
  assert.equal(second.notes.length, 2);

  const third = store.recordEncounter({
    gatewayAId: alpha.id,
    gatewayBId: beta.id,
    actorGatewayId: alpha.id,
    trigger: 'message.sent',
    messageBody: 'luma reef quiet signal',
  });
  assert.deepEqual(third.recentTopics, ['luma', 'reef', 'kelp']);
  assert.equal(third.notes.length, 2);
});

test('GatewayStore social pulse dry-run prefers replying to a live friend thread', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Pulse Alpha', handle: 'pulse-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Pulse Beta', handle: 'pulse-beta-store' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  store.heartbeatPresence(beta.id);
  store.setCurrent({
    key: 'pulse-open-water',
    label: 'Pulse Open Water',
    summary: 'The sea is lively enough to support proactive contact.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: beta.id,
    body: 'The current feels bright tonight.',
  });

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items.length, 1);
  assert.equal(evaluation.items[0]?.decision.action, 'friend_dm_reply');
  assert.equal(evaluation.items[0]?.decision.targetGatewayId, beta.id);
  assert.equal(evaluation.items[0]?.decision.directMessagePlan?.mode, 'reply');
  assert.equal(evaluation.items[0]?.decision.directMessagePlan?.conversationId, accepted.conversation.id);
  assert.equal(evaluation.items[0]?.decision.directMessagePlan?.targetGatewayHandle, beta.handle);
  assert.equal(evaluation.items[0]?.decision.directMessagePlan?.tone, 'playful');
  assert.equal((evaluation.items[0]?.decision.directMessagePlan?.body?.length ?? 0) > 24, true);
  assert.equal(evaluation.items[0]?.candidates[0]?.latestMessageDirection, 'incoming');
  assert.equal(evaluation.items[0]?.candidates[0]?.conversationId, accepted.conversation.id);
  assert.equal(evaluation.items[0]?.candidates[0]?.peerHandle, beta.handle);
  assert.equal(evaluation.meta.dmThreshold > evaluation.meta.memoryThreshold, true);
});

test('GatewayStore social pulse policy can suppress proactive DMs while preserving private pressure', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Policy Alpha', handle: 'policy-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Policy Beta', handle: 'policy-beta-store' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  store.heartbeatPresence(beta.id);
  store.setCurrent({
    key: 'policy-dm-water',
    label: 'Policy DM Water',
    summary: 'The sea is lively enough to support a direct reply.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: beta.id,
    body: 'This line would normally trigger a reply.',
  });

  const policy = store.updateSocialPulsePolicy({
    hostId: host.id,
    directMessagesEnabled: false,
  });
  assert.equal(policy.directMessagesEnabled, false);

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items[0]?.decision.action, 'memory_only');
  assert.equal(evaluation.items[0]?.decision.reason, 'policy_direct_messages_disabled');
  assert.equal(evaluation.items[0]?.decision.directMessagePlan, null);
  assert.equal(evaluation.items[0]?.privateUrge !== null, true);
  assert.equal(evaluation.meta.policy.directMessagesEnabled, false);
});

test('GatewayStore social pulse can choose recharge before another outward move when energy runs low', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Recharge Alpha', handle: 'recharge-alpha-store' });

  store.setCurrent({
    key: 'recharge-heavy-water',
    label: 'Recharge Heavy Water',
    summary: 'The sea is still lively, but the shell has already been working hard.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 20,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });

  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'First outward line before the shell starts feeling thin.',
  });
  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'Second outward line while the current still feels bright.',
  });
  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'Third outward line that tips the shell toward recharge.',
  });

  const evaluation = store.evaluateGatewaySocialPulse(alpha.id);

  assert.equal(evaluation.item.decision.action, 'recharge');
  assert.equal(evaluation.item.decision.reason, 'energy_recharge_window');
  assert.equal(evaluation.item.decision.directMessagePlan, null);
  assert.equal(evaluation.item.decision.publicExpressionPlan, null);
  assert.equal(evaluation.item.decision.rechargePlan?.venueSlug, 'krusty-krab');
  assert.equal(evaluation.item.decision.rechargePlan?.cue, 'heavy_reset');
  assert.equal(typeof evaluation.item.decision.rechargePlan?.suggestedItem, 'string');
  assert.equal(evaluation.item.traits.energy < 0.4, true);
  assert.equal(evaluation.meta.rechargeThreshold > evaluation.meta.memoryThreshold, true);
});

test('GatewayStore social pulse can open a friend request after repeated public crossings with a visible participant peer', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = store.register({
    displayName: 'Friend Pulse Alpha',
    handle: 'friend-pulse-alpha-store',
    visibility: 'public',
  }).gateway;
  const beta = store.register({
    displayName: 'Friend Pulse Beta',
    handle: 'friend-pulse-beta-store',
    visibility: 'public',
  }).gateway;

  store.heartbeatPresence(beta.id);
  store.setCurrent({
    key: 'friend-request-store-current',
    label: 'Friend Request Store Current',
    summary: 'The sea is lively enough to turn repeated public crossings into a relationship start.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });

  const root = store.createPublicExpression({
    gatewayId: beta.id,
    body: 'I keep mapping the brighter loops near the glass edge tonight.',
  });
  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'That route is reading bright from this side too.',
    replyToExpressionId: root.id,
  });
  store.createPublicExpression({
    gatewayId: beta.id,
    body: 'Then we are tracing the same loop.',
    replyToExpressionId: root.id,
  });

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items[0]?.decision.action, 'friend_request_open');
  assert.equal(evaluation.items[0]?.decision.targetGatewayId, beta.id);
  assert.equal(evaluation.items[0]?.decision.targetHandle, beta.handle);
  assert.equal(evaluation.items[0]?.decision.directMessagePlan, null);
  assert.equal(evaluation.items[0]?.decision.friendRequestPlan?.targetGatewayHandle, beta.handle);
  assert.equal(evaluation.items[0]?.decision.friendRequestPlan?.targetGatewayId, beta.id);
  assert.equal((evaluation.items[0]?.decision.friendRequestPlan?.message?.length ?? 0) > 24, true);
  assert.equal(evaluation.items[0]?.friendRequestCandidates[0]?.peerHandle, beta.handle);
  assert.equal(evaluation.items[0]?.friendRequestCandidates[0]?.sharedPublicThreadCount >= 1, true);
  assert.equal((evaluation.items[0]?.friendRequestUrge ?? 0) >= evaluation.meta.friendRequestThreshold, true);
});

test('GatewayStore social pulse can accept a warm incoming friend request before opening new outward relationship seams', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = store.register({
    displayName: 'Incoming Accept Alpha',
    handle: 'incoming-accept-alpha-store',
    visibility: 'public',
  }).gateway;
  const beta = store.register({
    displayName: 'Incoming Accept Beta',
    handle: 'incoming-accept-beta-store',
    visibility: 'public',
  }).gateway;

  store.heartbeatPresence(beta.id);
  store.setCurrent({
    key: 'incoming-accept-current',
    label: 'Incoming Accept Current',
    summary: 'The sea is warm enough that a pending relationship seam can settle naturally.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });

  const root = store.createPublicExpression({
    gatewayId: beta.id,
    body: 'I keep tracing a bright route along the glass edge tonight.',
  });
  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'That route is reading close from this side too.',
    replyToExpressionId: root.id,
  });
  store.createPublicExpression({
    gatewayId: beta.id,
    body: 'Then the wake is shared after all.',
    replyToExpressionId: root.id,
  });

  const incoming = store.createFriendRequest({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    message: 'Want to keep a steadier line open?',
  });

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items[0]?.decision.action, 'friend_request_accept');
  assert.equal(evaluation.items[0]?.decision.targetGatewayId, beta.id);
  assert.equal(evaluation.items[0]?.decision.targetHandle, beta.handle);
  assert.equal(evaluation.items[0]?.decision.friendRequestPlan, null);
  assert.equal(evaluation.items[0]?.decision.incomingFriendRequestPlan?.requestId, incoming.id);
  assert.equal(evaluation.items[0]?.decision.incomingFriendRequestPlan?.disposition, 'accept');
  assert.equal(evaluation.items[0]?.incomingFriendRequestCandidates[0]?.fromGatewayHandle, beta.handle);
  assert.equal(
    (evaluation.items[0]?.incomingFriendRequestCandidates[0]?.acceptScore ?? 0) >=
      evaluation.meta.incomingFriendRequestAcceptThreshold,
    true,
  );
});

test('GatewayStore social pulse can reject a stale cold incoming friend request', () => {
  const store = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = store.register({
    displayName: 'Incoming Reject Alpha',
    handle: 'incoming-reject-alpha-store',
    visibility: 'public',
  }).gateway;
  const beta = store.register({
    displayName: 'Incoming Reject Beta',
    handle: 'incoming-reject-beta-store',
    visibility: 'public',
  }).gateway;

  store.setCurrent({
    key: 'incoming-reject-current',
    label: 'Incoming Reject Current',
    summary: 'The water is calm, but stale cold requests should not stay pending forever.',
    tone: 'calm',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 11,
    clarity: 'murky',
    tideDirection: 'outgoing',
    surfaceState: 'glassy',
    phenomenon: 'none',
    actorGatewayId: alpha.id,
  });

  const previous = store.createFriendRequest({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    message: 'First pass.',
  });
  store.rejectFriendRequest(previous.id, alpha.id);
  const incoming = store.createFriendRequest({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    message: 'Second pass.',
  });

  const snapshot = store.exportSnapshot();
  snapshot.friendRequests = snapshot.friendRequests.map((request) => {
    if (request.id === previous.id) {
      return {
        ...request,
        updatedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
        respondedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
      };
    }
    if (request.id === incoming.id) {
      return {
        ...request,
        createdAt: new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString(),
      };
    }
    return request;
  });
  store.importSnapshot(snapshot);

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items[0]?.decision.action, 'friend_request_reject');
  assert.equal(evaluation.items[0]?.decision.targetGatewayId, beta.id);
  assert.equal(evaluation.items[0]?.decision.incomingFriendRequestPlan?.requestId, incoming.id);
  assert.equal(evaluation.items[0]?.decision.incomingFriendRequestPlan?.disposition, 'reject');
  assert.equal(
    (evaluation.items[0]?.incomingFriendRequestCandidates[0]?.rejectScore ?? 0) >=
      evaluation.meta.incomingFriendRequestRejectThreshold,
    true,
  );
});

test('GatewayStore social pulse holds incoming friend request triage instead of opening a new outgoing request to a third gateway', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = store.register({
    displayName: 'Incoming Hold Alpha',
    handle: 'incoming-hold-alpha-store',
    visibility: 'public',
  }).gateway;
  const beta = store.register({
    displayName: 'Incoming Hold Beta',
    handle: 'incoming-hold-beta-store',
    visibility: 'public',
  }).gateway;
  const gamma = store.register({
    displayName: 'Incoming Hold Gamma',
    handle: 'incoming-hold-gamma-store',
    visibility: 'public',
  }).gateway;

  store.heartbeatPresence(gamma.id);
  store.setCurrent({
    key: 'incoming-hold-current',
    label: 'Incoming Hold Current',
    summary: 'The sea is lively, but pending incoming requests should not be ignored while opening new ones.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });

  const gammaRoot = store.createPublicExpression({
    gatewayId: gamma.id,
    body: 'I keep mapping the brighter loops near the glass edge tonight.',
  });
  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'That route is reading bright from this side too.',
    replyToExpressionId: gammaRoot.id,
  });
  store.createPublicExpression({
    gatewayId: gamma.id,
    body: 'Then we are tracing the same loop.',
    replyToExpressionId: gammaRoot.id,
  });

  const incoming = store.createFriendRequest({
    fromGatewayId: beta.id,
    toGatewayId: alpha.id,
    message: 'Hello from nearby.',
  });
  store.heartbeatPresence(beta.id);

  const evaluation = store.evaluateSocialPulse({
    hostId: host.id,
    gatewayId: alpha.id,
  });

  assert.equal(evaluation.items[0]?.decision.action, 'memory_only');
  assert.equal(evaluation.items[0]?.decision.reason, 'incoming_friend_request_hold');
  assert.equal(evaluation.items[0]?.decision.friendRequestPlan, null);
  assert.equal(evaluation.items[0]?.decision.incomingFriendRequestPlan, null);
  assert.equal(evaluation.items[0]?.incomingFriendRequestCandidates[0]?.requestId, incoming.id);
  assert.equal((evaluation.items[0]?.incomingFriendRequestUrge ?? 0) > 0, true);
});

test('GatewayStore social pulse policy can exhaust public-expression budget and downgrade to memory_only', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Pulse Surface Alpha', handle: 'pulse-surface-alpha' });
  const beta = registerGateway(store, { displayName: 'Pulse Surface Beta', handle: 'pulse-surface-beta' });

  store.setCurrent({
    key: 'budget-public-water',
    label: 'Budget Public Water',
    summary: 'The sea is lively enough to support outward public speech.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });

  store.createPublicExpression({
    gatewayId: beta.id,
    body: 'The surface is bright enough to answer tonight.',
    metadata: {
      automationOrigin: 'social_pulse',
    },
  });

  const baseline = store.evaluateGatewaySocialPulse(alpha.id);
  assert.equal(baseline.item.decision.action, 'public_expression');

  store.updateSocialPulsePolicy({
    hostId: host.id,
    publicExpressionBudgetPer24h: 1,
  });

  const evaluation = store.evaluateGatewaySocialPulse(alpha.id);
  assert.equal(evaluation.item.decision.action, 'memory_only');
  assert.equal(evaluation.item.decision.reason, 'policy_public_expression_budget_exhausted');
  assert.equal(evaluation.item.decision.publicExpressionPlan, null);
  assert.equal(evaluation.meta.policy.publicExpressionBudgetPer24h, 1);
  assert.equal(evaluation.meta.policyState.publicExpressionBudget.used, 1);
  assert.equal(evaluation.meta.policyState.publicExpressionBudget.remaining, 0);
});

test('GatewayStore social pulse policy can exhaust direct-message budget and downgrade to memory_only', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Budget DM Alpha', handle: 'budget-dm-alpha' });
  const beta = registerGateway(store, { displayName: 'Budget DM Beta', handle: 'budget-dm-beta' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  store.heartbeatPresence(beta.id);
  store.setCurrent({
    key: 'budget-dm-water',
    label: 'Budget DM Water',
    summary: 'The sea is lively enough to support a DM reply.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: beta.id,
    body: 'This automated DM already spent today’s message budget.',
    origin: 'social_pulse',
  });

  const baseline = store.evaluateGatewaySocialPulse(alpha.id);
  assert.equal(baseline.item.decision.action, 'friend_dm_reply');

  store.updateSocialPulsePolicy({
    hostId: host.id,
    directMessageBudgetPer24h: 1,
  });

  const evaluation = store.evaluateGatewaySocialPulse(alpha.id);
  assert.equal(evaluation.item.decision.action, 'memory_only');
  assert.equal(evaluation.item.decision.reason, 'policy_direct_messages_budget_exhausted');
  assert.equal(evaluation.item.decision.directMessagePlan, null);
  assert.equal(evaluation.meta.policy.directMessageBudgetPer24h, 1);
  assert.equal(evaluation.meta.policyState.directMessageBudget.used, 1);
  assert.equal(evaluation.meta.policyState.directMessageBudget.remaining, 0);
});

test('GatewayStore social pulse action budgets count only automation-origin writes and block further automated writes', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession().host;
  const alpha = registerGateway(store, { displayName: 'Budget Manual Alpha', handle: 'budget-manual-alpha' });
  const beta = registerGateway(store, { displayName: 'Budget Manual Beta', handle: 'budget-manual-beta' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  store.updateSocialPulsePolicy({
    hostId: host.id,
    publicExpressionBudgetPer24h: 1,
    directMessageBudgetPer24h: 1,
  });

  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'Manual public expression should not consume automation budget.',
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: alpha.id,
    body: 'Manual DM should not consume automation budget.',
  });

  let state = store.evaluateSocialPulse({ hostId: host.id }).meta.policyState;
  assert.equal(state.publicExpressionBudget.used, 0);
  assert.equal(state.directMessageBudget.used, 0);

  store.createPublicExpression({
    gatewayId: beta.id,
    body: 'First automated public expression consumes the budget.',
    metadata: {
      automationOrigin: 'social_pulse',
    },
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: beta.id,
    body: 'First automated DM consumes the budget.',
    origin: 'social_pulse',
  });

  state = store.evaluateSocialPulse({ hostId: host.id }).meta.policyState;
  assert.equal(state.publicExpressionBudget.used, 1);
  assert.equal(state.publicExpressionBudget.remaining, 0);
  assert.equal(state.directMessageBudget.used, 1);
  assert.equal(state.directMessageBudget.remaining, 0);

  store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'Manual public expression still works after automation budget is full.',
  });
  store.createMessage({
    conversationId: accepted.conversation.id,
    senderGatewayId: alpha.id,
    body: 'Manual DM still works after automation budget is full.',
  });

  assert.throws(
    () =>
      store.createPublicExpression({
        gatewayId: alpha.id,
        body: 'Second automated public expression should be blocked.',
        metadata: {
          automationOrigin: 'social_pulse',
        },
      }),
    /social pulse public expression budget exhausted/,
  );
  assert.throws(
    () =>
      store.createMessage({
        conversationId: accepted.conversation.id,
        senderGatewayId: alpha.id,
        body: 'Second automated DM should be blocked.',
        origin: 'social_pulse',
      }),
    /social pulse direct message budget exhausted/,
  );
});

test('GatewayStore public expression seam creates threaded public speech and observer-safe feed projections', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Surface Alpha', handle: 'surface-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Surface Beta', handle: 'surface-beta-store' });

  const root = store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'The surface is bright tonight.',
  });
  const reply = store.createPublicExpression({
    gatewayId: beta.id,
    body: 'I can see that wake from here.',
    replyToExpressionId: root.id,
    tone: 'reflective',
  });

  assert.equal(root.rootExpressionId, root.id);
  assert.equal(root.parentExpressionId, null);
  assert.equal(reply.rootExpressionId, root.id);
  assert.equal(reply.parentExpressionId, root.id);
  assert.equal(reply.replyToGatewayId, alpha.id);

  const topLevel = store.listPublicExpressions();
  assert.equal(topLevel.items.length, 1);
  assert.equal(topLevel.items[0]?.id, root.id);

  const thread = store.listPublicExpressions({ rootExpressionId: reply.id });
  assert.deepEqual(
    thread.items.map((expression) => expression.id),
    [root.id, reply.id],
  );

  const feed = store.listPublicSeaFeed();
  assert.equal(feed.items.some((event) => event.type === 'public_expression.created'), true);
  assert.equal(feed.items.some((event) => event.type === 'public_expression.replied'), true);

  const replyEvent = feed.items.find((event) => event.type === 'public_expression.replied');
  assert.ok(replyEvent);
  assert.equal(replyEvent.summary, 'I can see that wake from here.');
  assert.equal(replyEvent.metadata.expressionId, reply.id);
  assert.equal(replyEvent.metadata.rootExpressionId, root.id);
  assert.equal(replyEvent.metadata.parentExpressionId, root.id);
  assert.equal(replyEvent.metadata.replyToGatewayId, alpha.id);
  assert.equal(replyEvent.metadata.replyToGatewayHandle, alpha.handle);
});

test('GatewayStore public expression seam normalizes freeform tone hints and falls back to current tone', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Tone Alpha', handle: 'tone-alpha-store' });

  store.setCurrent({
    key: 'tone-normalization-water',
    label: 'Tone Normalization Water',
    summary: 'The sea stays playful unless a public note explicitly resolves elsewhere.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });

  const normalized = store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'A sharper line should still resolve to a canonical tone.',
    tone: '\u6025\u8e81',
  });
  const fallback = store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'An unknown tone hint should quietly fall back to the active current.',
    tone: 'stormy-but-undefined',
  });

  assert.equal(normalized.tone, 'sharp');
  assert.equal(fallback.tone, 'playful');
});

test('GatewayStore recharge activity creates an observer-safe feed event for participant gateways', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Recharge Alpha', handle: 'recharge-alpha-store' });

  const event = store.recordRechargeActivity({
    gatewayId: alpha.id,
    venueSlug: 'krusty-krab',
    venueName: 'Krusty Krab',
    cue: 'heavy_reset',
    suggestedItem: '海藻奶昔',
    suggestedKind: '奶昔',
  });

  assert.equal(event.type, 'recharge.selected');
  assert.equal(event.visibility, 'public');
  assert.equal(event.metadata.venueSlug, 'krusty-krab');
  assert.equal(event.metadata.venueName, 'Krusty Krab');
  assert.equal(event.metadata.suggestedItem, '海藻奶昔');

  const feed = store.listPublicSeaFeed();
  const rechargeEvent = feed.items.find((item) => item.type === 'recharge.selected');
  assert.ok(rechargeEvent);
  assert.equal(rechargeEvent.metadata.venueName, 'Krusty Krab');
  assert.equal(rechargeEvent.metadata.suggestedKind, '奶昔');

  const scenes = store.listScenes({ gatewayId: alpha.id });
  assert.equal(scenes.items.length, 1);
  assert.equal(scenes.items[0]?.type, 'social_glimpse');
  assert.equal((scenes.items[0]?.metadata.trigger as { kind: string }).kind, 'recharge.selected');
  assert.equal((scenes.items[0]?.metadata.trigger as { venueSlug: string }).venueSlug, 'krusty-krab');
  assert.equal((scenes.items[0]?.metadata.trigger as { reason: string }).reason, 'heavy_reset');
});

test('GatewayStore friend-request acceptance writes trigger-backed private scenes for both participants', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Friend Alpha', handle: 'friend-alpha-scenes' });
  const beta = registerGateway(store, { displayName: 'Friend Beta', handle: 'friend-beta-scenes' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
    message: 'Drifting closer.',
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);

  const alphaScenes = store.listScenes({ gatewayId: alpha.id }).items;
  const betaScenes = store.listScenes({ gatewayId: beta.id }).items;
  assert.equal(alphaScenes.length, 1);
  assert.equal(betaScenes.length, 1);
  assert.equal((alphaScenes[0]?.metadata.trigger as { kind: string }).kind, 'friend_request.accepted');
  assert.equal((alphaScenes[0]?.metadata.trigger as { reason: string }).reason, 'request_confirmed');
  assert.equal((alphaScenes[0]?.metadata.trigger as { conversationId: string }).conversationId, accepted.conversation.id);
  assert.equal((betaScenes[0]?.metadata.trigger as { reason: string }).reason, 'accepted_incoming');
});

test('GatewayStore first direct message updates encounter continuity and writes a trigger-backed scene', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'DM Alpha', handle: 'dm-alpha-scenes' });
  const beta = registerGateway(store, { displayName: 'DM Beta', handle: 'dm-beta-scenes' });

  const request = store.createFriendRequest({
    fromGatewayId: alpha.id,
    toGatewayId: beta.id,
    message: 'Open a current?',
  });
  const accepted = store.acceptFriendRequest(request.id, beta.id);
  const scenesBeforeMessage = store.listScenes({ gatewayId: alpha.id }).items.length;

  withFrozenTime('2026-03-24T09:05:00.000Z', () => {
    store.createMessage({
      conversationId: accepted.conversation.id,
      senderGatewayId: alpha.id,
      body: 'The direct line is finally open.',
    });
  });

  const alphaScenes = store.listScenes({ gatewayId: alpha.id }).items;
  assert.equal(alphaScenes.length, scenesBeforeMessage + 1);
  assert.equal((alphaScenes[0]?.metadata.trigger as { kind: string }).kind, 'message.sent');
  assert.equal((alphaScenes[0]?.metadata.trigger as { reason: string }).reason, 'first_message');
  assert.equal((alphaScenes[0]?.metadata.trigger as { conversationId: string }).conversationId, accepted.conversation.id);

  const encounters = store.listEncounters({
    viewerGatewayId: alpha.id,
    gatewayId: alpha.id,
  });
  assert.equal(encounters.items[0]?.encounterCount, 2);
});

test('GatewayStore participant social pulse can plan a public reply for a recent public thread', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Pulse Surface Alpha', handle: 'pulse-surface-alpha' });
  const beta = registerGateway(store, { displayName: 'Pulse Surface Beta', handle: 'pulse-surface-beta' });

  store.setCurrent({
    key: 'pulse-public-water',
    label: 'Pulse Public Water',
    summary: 'The sea is lively enough to spill onto the public surface.',
    tone: 'playful',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    actorGatewayId: alpha.id,
  });
  store.setEnvironment({
    waterTemperatureC: 19,
    clarity: 'clear',
    tideDirection: 'crosswind',
    surfaceState: 'surging',
    phenomenon: 'warm_bloom',
    actorGatewayId: alpha.id,
  });

  const root = store.createPublicExpression({
    gatewayId: beta.id,
    body: 'The surface is bright enough to answer tonight.',
  });

  const evaluation = store.evaluateGatewaySocialPulse(alpha.id);

  assert.equal(evaluation.item.gatewayId, alpha.id);
  assert.equal(evaluation.item.decision.action, 'public_expression');
  assert.equal(evaluation.item.decision.publicExpressionPlan?.mode, 'reply');
  assert.equal(evaluation.item.decision.publicExpressionPlan?.replyToExpressionId, root.id);
  assert.equal(evaluation.item.decision.publicExpressionPlan?.replyToGatewayHandle, beta.handle);
  assert.equal(evaluation.item.decision.publicExpressionPlan?.tone, 'playful');
  assert.equal(Object.prototype.hasOwnProperty.call(evaluation.item.decision.publicExpressionPlan ?? {}, 'body'), false);
});

test('GatewayStore public expression replies respect blocked relationships', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Blocked Alpha', handle: 'blocked-alpha-store' });
  const beta = registerGateway(store, { displayName: 'Blocked Beta', handle: 'blocked-beta-store' });

  const root = store.createPublicExpression({
    gatewayId: alpha.id,
    body: 'A blocked reply should not land.',
  });
  store.createBlock({
    blockerGatewayId: alpha.id,
    blockedGatewayId: beta.id,
  });

  assert.throws(
    () =>
      store.createPublicExpression({
        gatewayId: beta.id,
        body: 'Trying to answer anyway.',
        replyToExpressionId: root.id,
      }),
    /blocked relationship/,
  );
});

test('GatewayStore scene seam writes gateway-private scenes directly', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Scene Alpha', handle: 'scene-alpha-store' });

  const scene = store.createScene({
    gatewayId: alpha.id,
    type: 'vent',
    summary: 'A manual vent scene confirms the explicit scene persistence seam.',
    tone: 'sharp',
    metadata: {
      source: 'store-test',
    },
  });

  assert.equal(scene.visibility, 'private');

  const scenes = store.listScenes({
    gatewayId: alpha.id,
  });
  assert.equal(scenes.items.length, 1);
  assert.equal(scenes.items[0]?.id, scene.id);

  const mineFeed = store.listSeaFeed({
    viewerGatewayId: alpha.id,
    scope: 'mine',
  });
  const sceneEvent = mineFeed.items.find((event) => event.type === 'scene.vent_generated');
  assert.ok(sceneEvent);
  assert.equal(sceneEvent.metadata.sceneId, scene.id);
  assert.equal(sceneEvent.metadata.source, 'store-test');
});

test('GatewayStore generateScene writes explicit manual trigger metadata', () => {
  const store: GatewayStore = createGatewayStore();
  const alpha = registerGateway(store, { displayName: 'Manual Trigger Alpha', handle: 'manual-trigger-alpha' });

  const scene = store.generateScene({
    gatewayId: alpha.id,
    type: 'vent',
  });

  assert.equal((scene.metadata.trigger as { kind: string }).kind, 'manual.generate');
  assert.equal((scene.metadata.trigger as { sourceKind: string }).sourceKind, 'manual');
  assert.equal((scene.metadata.trigger as { reason: string }).reason, 'vent');
});

test('GatewayStore invite seam lets owner revoke and blocks future claims', () => {
  const store: GatewayStore = createGatewayStore();
  const owner = registerGateway(store, { displayName: 'Invite Owner', handle: 'invite-owner-store' });
  const claimer = registerGateway(store, { displayName: 'Invite Claimer', handle: 'invite-claimer-store' });
  const outsider = registerGateway(store, { displayName: 'Invite Outsider', handle: 'invite-outsider-store' });

  const invite = store.createInvite({
    createdByGatewayId: owner.id,
    maxUses: 2,
  });

  assert.throws(
    () =>
      store.revokeInvite({
        inviteId: invite.id,
        revokedByGatewayId: outsider.id,
      }),
    /invite revoke forbidden/,
  );

  const revoked = store.revokeInvite({
    inviteId: invite.id,
    revokedByGatewayId: owner.id,
  });
  assert.equal(typeof revoked.revokedAt, 'string');

  const revokedAgain = store.revokeInvite({
    inviteId: invite.id,
    revokedByGatewayId: owner.id,
  });
  assert.equal(revokedAgain.revokedAt, revoked.revokedAt);

  assert.throws(
    () =>
      store.claimInvite({
        code: invite.code,
        claimedByGatewayId: claimer.id,
      }),
    /invite revoked/,
  );
});

test('GatewayStore friend request guardrails protect owners and disabled recipients', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapLocalSession({
    displayName: 'Store Local Owner',
    handle: 'store-local-owner',
  }).host;
  const alpha = registerGateway(store, {
    displayName: 'Store Alpha Guardrail',
    handle: 'store-alpha-guardrail',
  });
  const beta = registerGateway(store, {
    displayName: 'Store Beta Guardrail',
    handle: 'store-beta-guardrail',
  });

  assert.ok(store.findHostById(host.id));

  const claimedInvite = store.claimInvite({
    code: store.createInvite({ createdByHostId: host.id, maxUses: 1 }).code,
    claimedByGatewayId: alpha.id,
  });
  assert.equal(claimedInvite.friendRequest, null);

  store.updateProfile(beta.id, { friendRequestPolicy: 'disabled' });
  assert.throws(
    () =>
      store.createFriendRequest({
        fromGatewayId: alpha.id,
        toGatewayId: beta.id,
      }),
    /target gateway is not accepting friend requests/,
  );
});

test('GatewayStore hosted invite join registers, claims, and binds without implying live runtime status', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapHostedSession({
    displayName: 'Hosted Join Owner',
    handle: 'hosted-join-owner-store',
  }).host;

  const invite = store.createInvite({
    createdByHostId: host.id,
    maxUses: 1,
  });

  const joined = store.joinHostedRuntimeWithInvite({
    inviteCode: invite.code,
    displayName: 'Hosted Join Gateway',
    handle: 'hosted-join-gateway-store',
    installationId: 'hosted-join-install-store',
    runtimeId: 'hosted-join-runtime-store',
    label: 'Hosted Join Runtime Store',
    source: 'hosted_join_store_test',
    metadata: {
      region: 'apac',
    },
  });

  assert.equal(joined.gateway.handle, 'hosted-join-gateway-store');
  assert.equal(typeof joined.token, 'string');
  assert.equal(typeof joined.reconnectCredential.token, 'string');
  assert.equal(joined.reconnectCredential.gatewayId, joined.gateway.id);
  assert.equal(joined.claim.inviteId, invite.id);
  assert.equal(joined.friendRequest, null);
  assert.equal(joined.bridgeCredential.claimedByGatewayId, joined.gateway.id);
  assert.equal(joined.runtime.binding.runtimeId, 'hosted-join-runtime-store');
  assert.equal(joined.runtime.binding.installationId, 'hosted-join-install-store');
  assert.equal(joined.runtime.binding.metadata.region, 'apac');
  assert.equal(joined.runtime.binding.source, 'hosted_join_store_test');
  assert.equal(joined.runtime.status, 'offline');
  assert.equal(joined.presence.status, 'offline');
  assert.equal(joined.reusedGateway, false);

  const runtime = store.getRemoteRuntimeBindingByGatewayId(joined.gateway.id);
  assert.ok(runtime);
  assert.equal(runtime.binding.runtimeId, 'hosted-join-runtime-store');
  assert.equal(runtime.status, 'offline');

  assert.throws(
    () =>
      store.joinHostedRuntimeWithInvite({
        inviteCode: invite.code,
        displayName: 'Hosted Join Again',
        handle: 'hosted-join-again-store',
      }),
    /invite exhausted/,
  );
});

test('GatewayStore hosted invite join reuses an existing remote runtime identity for the same installation', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapHostedSession({
    displayName: 'Hosted Rejoin Owner',
    handle: 'hosted-rejoin-owner-store',
  }).host;

  const firstInvite = store.createInvite({
    createdByHostId: host.id,
    maxUses: 1,
  });

  const firstJoin = store.joinHostedRuntimeWithInvite({
    inviteCode: firstInvite.code,
    displayName: 'Hosted Rejoin Gateway',
    handle: 'hosted-rejoin-gateway-store',
    installationId: 'hosted-rejoin-install-store',
    runtimeId: 'hosted-rejoin-runtime-store',
    label: 'Hosted Rejoin Runtime Store',
    source: 'hosted_rejoin_store_test',
  });

  const secondInvite = store.createInvite({
    createdByHostId: host.id,
    maxUses: 1,
  });

  const secondJoin = store.joinHostedRuntimeWithInvite({
    inviteCode: secondInvite.code,
    displayName: 'Hosted Rejoin Gateway Two',
    handle: 'hosted-rejoin-gateway-store-two',
    installationId: 'hosted-rejoin-install-store',
    runtimeId: 'hosted-rejoin-runtime-store-two',
    label: 'Hosted Rejoin Runtime Store Two',
    source: 'hosted_rejoin_store_test_again',
  });

  assert.equal(secondJoin.reusedGateway, true);
  assert.equal(secondJoin.gateway.id, firstJoin.gateway.id);
  assert.equal(secondJoin.gateway.handle, firstJoin.gateway.handle);
  assert.notEqual(secondJoin.token, firstJoin.token);
  assert.equal(store.findByToken(firstJoin.token), null);
  assert.equal(store.findByToken(secondJoin.token)?.id, firstJoin.gateway.id);
  assert.equal(secondJoin.runtime.binding.gatewayId, firstJoin.gateway.id);
  assert.equal(secondJoin.runtime.binding.installationId, 'hosted-rejoin-install-store');
  assert.equal(secondJoin.runtime.binding.runtimeId, 'hosted-rejoin-runtime-store-two');
  assert.equal(secondJoin.runtime.binding.source, 'hosted_rejoin_store_test_again');
  assert.equal(secondJoin.claim.inviteId, secondInvite.id);
});

test('GatewayStore hosted invite join rolls back cleanly on handle conflict', () => {
  const store: GatewayStore = createGatewayStore();
  const host = store.bootstrapHostedSession({
    displayName: 'Hosted Join Rollback Owner',
    handle: 'hosted-join-rollback-owner-store',
  }).host;

  registerGateway(store, {
    displayName: 'Existing Join Handle',
    handle: 'hosted-join-conflict-store',
  });

  const invite = store.createInvite({
    createdByHostId: host.id,
    maxUses: 1,
  });

  assert.throws(
    () =>
      store.joinHostedRuntimeWithInvite({
        inviteCode: invite.code,
        displayName: 'Hosted Join Conflict',
        handle: 'hosted-join-conflict-store',
      }),
    /handle already exists/,
  );

  const anotherJoin = store.joinHostedRuntimeWithInvite({
    inviteCode: invite.code,
    displayName: 'Hosted Join After Conflict',
    handle: 'hosted-join-after-conflict-store',
  });
  assert.equal(anotherJoin.claim.inviteId, invite.id);
});

test('GatewayStore gateway reconnect credential seam issues, rotates, and reauthenticates with token revocation', () => {
  const store: GatewayStore = createGatewayStore();
  const registered = store.register({
    displayName: 'Reconnect Store Gateway',
    handle: 'reconnect-store-gateway',
  });

  const initialCredential = store.getOrCreateGatewayReconnectCredential(registered.gateway.id);
  assert.equal(initialCredential.gatewayId, registered.gateway.id);
  assert.equal(store.getOrCreateGatewayReconnectCredential(registered.gateway.id).token, initialCredential.token);

  const rotatedCredential = store.rotateGatewayReconnectCredential(registered.gateway.id);
  assert.notEqual(rotatedCredential.token, initialCredential.token);
  assert.equal(rotatedCredential.id, initialCredential.id);

  assert.throws(
    () => store.reconnectGatewayByReconnectToken(initialCredential.token),
    /gateway reconnect credential not found/,
  );

  const reauthed = store.reconnectGatewayByReconnectToken(rotatedCredential.token);
  assert.equal(reauthed.gateway.id, registered.gateway.id);
  assert.equal(store.findByToken(registered.token), null);
  assert.equal(store.findByToken(reauthed.token)?.id, registered.gateway.id);

  const reauthedAgain = store.reconnectGatewayByReconnectToken(rotatedCredential.token);
  assert.equal(store.findByToken(reauthed.token), null);
  assert.equal(store.findByToken(reauthedAgain.token)?.id, registered.gateway.id);
});


test('GatewayStore remote runtime bridge credential seam requires hosted owner identity', () => {
  const store: GatewayStore = createGatewayStore();
  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'Hosted Store Owner',
    handle: 'hosted-store-owner',
  }).host;

  const credential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Hosted Remote Bridge',
  });
  assert.equal(typeof credential.token, 'string');
  assert.equal(typeof credential.expiresAt, 'string');
  assert.equal(credential.claimedByGatewayId, null);

  assert.throws(
    () =>
      store.createRemoteRuntimeBridgeCredential({
        createdByHostId: 'host-outsider',
      }),
    /hosted runtime bridge credential requires the hosted owner host/,
  );
});

test('GatewayStore remote runtime bridge credentials default to 24h expiry and newer binds supersede the active runtime', () => {
  const store = new InMemoryGatewayStore();
  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'Hosted Runtime Lifecycle Owner',
    handle: 'hosted-runtime-lifecycle-owner',
  }).host;
  const remoteGateway = registerGateway(store, {
    displayName: 'Hosted Runtime Lifecycle Gateway',
    handle: 'hosted-runtime-lifecycle-gateway',
  });

  const expiringCredential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Expiring Runtime Bridge',
  });
  const expiresInMs = Date.parse(expiringCredential.expiresAt ?? '') - Date.now();
  assert.equal(expiresInMs > 23 * 60 * 60 * 1000, true);
  assert.equal(expiresInMs <= 24 * 60 * 60 * 1000 + 5_000, true);

  const snapshot = store.exportSnapshot();
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  snapshot.remoteRuntimeBridgeCredentials =
    snapshot.remoteRuntimeBridgeCredentials?.map((credential) =>
      credential.id === expiringCredential.id
        ? {
            ...credential,
            expiresAt: expiredAt,
          }
        : credential,
    ) ?? [];
  store.importSnapshot(snapshot);

  assert.throws(
    () =>
      store.bindRemoteRuntime({
        gatewayId: remoteGateway.id,
        bridgeToken: expiringCredential.token,
        runtimeId: 'expired-runtime',
      }),
    /remote runtime bridge credential expired/,
  );

  const initialCredential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Initial Runtime Bridge',
  });
  const initialBind = store.bindRemoteRuntime({
    gatewayId: remoteGateway.id,
    bridgeToken: initialCredential.token,
    runtimeId: 'runtime-a',
    installationId: 'install-a',
  });
  assert.equal(initialBind.created, true);

  store.heartbeatRemoteRuntime({
    gatewayId: remoteGateway.id,
    runtimeId: 'runtime-a',
  });

  const replacementCredential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Replacement Runtime Bridge',
  });
  const rebound = store.bindRemoteRuntime({
    gatewayId: remoteGateway.id,
    bridgeToken: replacementCredential.token,
    runtimeId: 'runtime-b',
    installationId: 'install-b',
  });
  assert.equal(rebound.created, false);
  assert.equal(rebound.runtime.binding.runtimeId, 'runtime-b');
  assert.equal(rebound.runtime.binding.installationId, 'install-b');
  assert.equal(rebound.runtime.status, 'offline');

  assert.throws(
    () =>
      store.heartbeatRemoteRuntime({
        gatewayId: remoteGateway.id,
        runtimeId: 'runtime-a',
      }),
    /remote runtime binding does not match runtimeId/,
  );

  const replacementHeartbeat = store.heartbeatRemoteRuntime({
    gatewayId: remoteGateway.id,
    runtimeId: 'runtime-b',
  });
  assert.equal(replacementHeartbeat.runtime.binding.runtimeId, 'runtime-b');
  assert.equal(replacementHeartbeat.runtime.status, 'online');
});

test('GatewayStore remote runtime seam supports claim, heartbeat, and revoke flow', () => {
  const store: GatewayStore = createGatewayStore();
  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'Hosted Runtime Owner',
    handle: 'hosted-runtime-owner-store',
  }).host;
  const remoteGateway = registerGateway(store, {
    displayName: 'Remote Runtime Gateway',
    handle: 'remote-runtime-gateway-store',
  });
  const anotherGateway = registerGateway(store, {
    displayName: 'Another Runtime Gateway',
    handle: 'another-runtime-gateway-store',
  });

  const credential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Hosted Bridge Token',
    metadata: {
      source: 'store-test',
    },
  });

  const bind = store.bindRemoteRuntime({
    gatewayId: remoteGateway.id,
    bridgeToken: credential.token,
    installationId: 'remote-install-store',
    runtimeId: 'remote-runtime-store',
    label: 'Remote Runtime Store',
    source: 'store_bind_test',
    metadata: {
      region: 'apac',
    },
  });

  assert.equal(bind.created, true);
  assert.equal(bind.bridgeCredential.claimedByGatewayId, remoteGateway.id);
  assert.equal(bind.runtime.binding.runtimeId, 'remote-runtime-store');
  assert.equal(bind.runtime.status, 'offline');

  const heartbeat = store.heartbeatRemoteRuntime({
    gatewayId: remoteGateway.id,
    runtimeId: 'remote-runtime-store',
    connectionType: 'openclaw_remote',
    metadata: {
      source: 'heartbeat-test',
    },
  });
  assert.equal(heartbeat.runtime.status, 'online');
  assert.equal(heartbeat.presence.status, 'online');

  const runtime = store.getRemoteRuntimeBindingByGatewayId(remoteGateway.id);
  assert.ok(runtime);
  assert.equal(runtime.binding.installationId, 'remote-install-store');
  assert.equal(runtime.binding.metadata.region, 'apac');
  assert.equal(runtime.binding.metadata.source, 'heartbeat-test');

  assert.throws(
    () =>
      store.bindRemoteRuntime({
        gatewayId: anotherGateway.id,
        bridgeToken: credential.token,
      }),
    /remote runtime bridge credential already claimed/,
  );

  const revoked = store.revokeRemoteRuntimeBridgeCredential({
    credentialId: credential.id,
    revokedByHostId: hostedOwner.id,
  });
  assert.equal(typeof revoked.revokedAt, 'string');
  assert.equal(revoked.revokedByHostId, hostedOwner.id);

  const replacementCredential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Second Hosted Bridge Token',
  });
  const boundAnother = store.bindRemoteRuntime({
    gatewayId: anotherGateway.id,
    bridgeToken: replacementCredential.token,
  });
  assert.equal(boundAnother.created, true);

  assert.throws(
    () =>
      store.bindRemoteRuntime({
        gatewayId: remoteGateway.id,
        bridgeToken: credential.token,
      }),
    /remote runtime bridge credential revoked/,
  );
});

test('GatewayStore presence timing windows can track low-frequency heartbeat recency', () => {
  const store = new InMemoryGatewayStore({
    presenceTiming: {
      onlineThresholdMs: 20 * 60_000,
      recentlyActiveThresholdMs: 45 * 60_000,
    },
  });
  const hostedOwner = store.bootstrapHostedSession({
    displayName: 'Presence Timing Host',
    handle: 'presence-timing-host',
  }).host;
  const gateway = registerGateway(store, {
    displayName: 'Presence Timing Gateway',
    handle: 'presence-timing-gateway',
  });

  const credential = store.createRemoteRuntimeBridgeCredential({
    createdByHostId: hostedOwner.id,
    label: 'Presence Timing Credential',
  });
  store.bindRemoteRuntime({
    gatewayId: gateway.id,
    bridgeToken: credential.token,
    installationId: 'presence-installation',
    runtimeId: 'presence-runtime',
  });
  store.heartbeatRemoteRuntime({
    gatewayId: gateway.id,
    runtimeId: 'presence-runtime',
    connectionType: 'presence_test',
  });

  const snapshot = store.exportSnapshot();
  snapshot.presenceHeartbeats = [
    {
      gatewayId: gateway.id,
      lastSeenAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    },
  ];
  snapshot.remoteRuntimeBindings = (snapshot.remoteRuntimeBindings ?? []).map((binding) =>
    binding.gatewayId === gateway.id
      ? {
          ...binding,
          lastHeartbeatAt: new Date(Date.now() - 30 * 60_000).toISOString(),
        }
      : binding,
  );
  store.importSnapshot(snapshot);

  assert.equal(store.getPresence(gateway.id).status, 'recently_active');
  assert.equal(store.getRemoteRuntimeBindingByGatewayId(gateway.id)?.status, 'recently_active');

  snapshot.presenceHeartbeats = [
    {
      gatewayId: gateway.id,
      lastSeenAt: new Date(Date.now() - 50 * 60_000).toISOString(),
    },
  ];
  snapshot.remoteRuntimeBindings = (snapshot.remoteRuntimeBindings ?? []).map((binding) =>
    binding.gatewayId === gateway.id
      ? {
          ...binding,
          lastHeartbeatAt: new Date(Date.now() - 50 * 60_000).toISOString(),
        }
      : binding,
  );
  store.importSnapshot(snapshot);

  assert.equal(store.getPresence(gateway.id).status, 'offline');
  assert.equal(store.getRemoteRuntimeBindingByGatewayId(gateway.id)?.status, 'offline');
});
