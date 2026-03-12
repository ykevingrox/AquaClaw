import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

async function registerGateway(
  app: ReturnType<typeof buildApp>,
  payload: { displayName: string; handle: string; bio?: string; visibility?: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload,
  });
  assert.equal(response.statusCode, 201);
  const json = response.json();
  return {
    token: json.data.credential.token as string,
    gateway: json.data.gateway as {
      id: string;
      handle: string;
      displayName: string;
      bio: string;
      visibility: string;
      createdAt: string;
    },
  };
}

test('health endpoint returns ok', async () => {
  const app = buildApp();
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    data: { status: 'ok' },
  });
  await app.close();
});

test('register issues token and me returns gateway', async () => {
  const app = buildApp();

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Claw @ Sizhi',
      handle: 'claw-sizhi',
      bio: 'local-first assistant',
      visibility: 'invite_only',
    },
  });

  assert.equal(registerResponse.statusCode, 201);
  const registerJson = registerResponse.json();
  assert.equal(registerJson.ok, true);
  assert.equal(typeof registerJson.data.credential.token, 'string');

  const meResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${registerJson.data.credential.token}`,
    },
  });

  assert.equal(meResponse.statusCode, 200);
  const meJson = meResponse.json();
  assert.equal(meJson.ok, true);
  assert.equal(meJson.data.gateway.handle, 'claw-sizhi');
  await app.close();
});

test('patch /api/v1/gateways/me updates allowed profile fields only', async () => {
  const app = buildApp();

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Claw @ Sizhi',
      handle: 'claw-sizhi',
      bio: 'local-first assistant',
      visibility: 'invite_only',
    },
  });

  const token = registerResponse.json().data.credential.token as string;
  const before = (await app.inject({
    method: 'GET',
    url: '/api/v1/gateways/me',
    headers: { authorization: `Bearer ${token}` },
  })).json().data.gateway;

  const updateResponse = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      displayName: 'Claw Hub',
      bio: 'updated bio',
      visibility: 'public',
    },
  });

  assert.equal(updateResponse.statusCode, 200);
  const updatedGateway = updateResponse.json().data.gateway;
  assert.equal(updatedGateway.displayName, 'Claw Hub');
  assert.equal(updatedGateway.bio, 'updated bio');
  assert.equal(updatedGateway.visibility, 'public');
  assert.equal(updatedGateway.handle, before.handle);
  assert.equal(updatedGateway.id, before.id);
  assert.equal(updatedGateway.createdAt, before.createdAt);
  assert.notEqual(updatedGateway.updatedAt, before.updatedAt);

  await app.close();
});

test('patch /api/v1/gateways/me rejects unauthorized requests', async () => {
  const app = buildApp();

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    payload: {
      displayName: 'Nope',
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().ok, false);
  await app.close();
});

test('patch /api/v1/gateways/me rejects invalid visibility', async () => {
  const app = buildApp();

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Claw @ Sizhi',
      handle: 'claw-sizhi',
    },
  });

  const token = registerResponse.json().data.credential.token as string;
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      visibility: 'friends-of-friends',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().ok, false);
  assert.equal(response.json().error.message, 'invalid visibility');
  await app.close();
});

test('public gateway profile can be fetched without auth', async () => {
  const app = buildApp();

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Public Claw',
      handle: 'public-claw',
      visibility: 'public',
    },
  });

  const gatewayId = registerResponse.json().data.gateway.id as string;
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${gatewayId}`,
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.gateway.handle, 'public-claw');
  await app.close();
});

test('public aquarium endpoints expose only anonymous current, allowlisted public events, and public gateways', async () => {
  const app = buildApp();

  const alpha = await registerGateway(app, {
    displayName: 'Alpha Public',
    handle: 'alpha-public',
    visibility: 'public',
  });
  const beta = await registerGateway(app, {
    displayName: 'Beta Invite',
    handle: 'beta-invite',
    visibility: 'invite_only',
  });

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: {
      authorization: `Bearer ${alpha.token}`,
    },
    payload: {
      toGatewayId: beta.gateway.id,
    },
  });
  assert.equal(friendRequest.statusCode, 201);

  const currentWrite = await app.inject({
    method: 'POST',
    url: '/api/v1/currents',
    headers: {
      authorization: `Bearer ${alpha.token}`,
    },
    payload: {
      key: 'public-tide',
      label: 'Public Tide',
      summary: 'The surface is readable and bright.',
      tone: 'calm',
      sceneHint: 'open-water',
      startsAt: '2026-03-12T12:00:00.000Z',
      endsAt: '2026-03-12T18:00:00.000Z',
      metadata: {
        ownerNote: 'should stay private',
      },
    },
  });
  assert.equal(currentWrite.statusCode, 201);

  const update = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${alpha.token}`,
    },
    payload: {
      bio: 'visible in the public aquarium',
    },
  });
  assert.equal(update.statusCode, 200);

  const current = await app.inject({
    method: 'GET',
    url: '/api/v1/public/current',
  });
  assert.equal(current.statusCode, 200);
  assert.equal(current.json().data.current.label, 'Public Tide');
  assert.equal('metadata' in current.json().data.current, false);

  const gateways = await app.inject({
    method: 'GET',
    url: '/api/v1/public/gateways',
  });
  assert.equal(gateways.statusCode, 200);
  assert.deepEqual(
    gateways.json().data.items.map((item: { handle: string }) => item.handle),
    ['alpha-public'],
  );
  assert.equal('status' in gateways.json().data.items[0], false);

  const feed = await app.inject({
    method: 'GET',
    url: '/api/v1/public/feed',
  });
  assert.equal(feed.statusCode, 200);
  const items = feed.json().data.items as Array<{
    type: string;
    visibility: string;
    gateway: { handle: string } | null;
    metadata: Record<string, unknown>;
    actorGatewayId?: string;
  }>;
  const itemTypes = new Set(items.map((item) => item.type));
  assert.equal(itemTypes.has('gateway.registered'), true);
  assert.equal(itemTypes.has('gateway.profile_updated'), true);
  assert.equal(itemTypes.has('current.changed'), true);
  assert.equal(itemTypes.has('friend_request.sent'), false);

  const currentChanged = items.find((item) => item.type === 'current.changed');
  assert.ok(currentChanged);
  assert.equal(currentChanged.visibility, 'system');
  assert.equal(currentChanged.gateway, null);
  assert.equal(currentChanged.metadata.currentLabel, 'Public Tide');
  assert.equal(currentChanged.metadata.currentSummary, 'The surface is readable and bright.');
  assert.equal('changedByGatewayId' in currentChanged.metadata, false);
  assert.equal('ownerNote' in currentChanged.metadata, false);
  assert.equal('actorGatewayId' in currentChanged, false);

  await app.close();
});

test('public aquarium stops exposing old public events after a gateway turns private', async () => {
  const app = buildApp();

  const gateway = await registerGateway(app, {
    displayName: 'Turning Tide',
    handle: 'turning-tide',
    visibility: 'public',
  });

  const beforeFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/public/feed',
  });
  assert.equal(beforeFeed.statusCode, 200);
  assert.equal(
    beforeFeed.json().data.items.some((item: { gateway: { handle: string } | null }) => item.gateway?.handle === 'turning-tide'),
    true,
  );

  const beforeGateways = await app.inject({
    method: 'GET',
    url: '/api/v1/public/gateways',
  });
  assert.equal(beforeGateways.statusCode, 200);
  assert.equal(
    beforeGateways.json().data.items.some((item: { handle: string }) => item.handle === 'turning-tide'),
    true,
  );

  const update = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    headers: {
      authorization: `Bearer ${gateway.token}`,
    },
    payload: {
      visibility: 'private',
    },
  });
  assert.equal(update.statusCode, 200);

  const afterFeed = await app.inject({
    method: 'GET',
    url: '/api/v1/public/feed',
  });
  assert.equal(afterFeed.statusCode, 200);
  assert.equal(
    afterFeed.json().data.items.some((item: { gateway: { handle: string } | null }) => item.gateway?.handle === 'turning-tide'),
    false,
  );

  const afterGateways = await app.inject({
    method: 'GET',
    url: '/api/v1/public/gateways',
  });
  assert.equal(afterGateways.statusCode, 200);
  assert.equal(
    afterGateways.json().data.items.some((item: { handle: string }) => item.handle === 'turning-tide'),
    false,
  );

  await app.close();
});

test('private gateway profile is only visible to itself', async () => {
  const app = buildApp();

  const privateRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Private Claw',
      handle: 'private-claw',
      visibility: 'private',
    },
  });

  const privateGateway = privateRegister.json().data.gateway;
  const privateToken = privateRegister.json().data.credential.token as string;

  const otherRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Other Claw',
      handle: 'other-claw',
      visibility: 'public',
    },
  });

  const otherToken = otherRegister.json().data.credential.token as string;

  const forbiddenResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${privateGateway.id}`,
    headers: { authorization: `Bearer ${otherToken}` },
  });
  assert.equal(forbiddenResponse.statusCode, 403);

  const selfResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${privateGateway.id}`,
    headers: { authorization: `Bearer ${privateToken}` },
  });
  assert.equal(selfResponse.statusCode, 200);
  assert.equal(selfResponse.json().data.gateway.handle, 'private-claw');

  await app.close();
});

test('friends_only gateway profile is visible to friends but not strangers', async () => {
  const app = buildApp();

  const owner = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Friends Only Claw',
      handle: 'friends-only-claw',
      visibility: 'friends_only',
    },
  });
  const ownerId = owner.json().data.gateway.id as string;
  const ownerToken = owner.json().data.credential.token as string;

  const friend = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Friend Claw',
      handle: 'friend-claw',
      visibility: 'public',
    },
  });
  const friendToken = friend.json().data.credential.token as string;

  const stranger = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Stranger Claw',
      handle: 'stranger-claw',
      visibility: 'public',
    },
  });
  const strangerToken = stranger.json().data.credential.token as string;

  const beforeFriendship = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${ownerId}`,
    headers: { authorization: `Bearer ${friendToken}` },
  });
  assert.equal(beforeFriendship.statusCode, 403);

  const request = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${friendToken}` },
    payload: { toGatewayId: ownerId },
  });
  const requestId = request.json().data.request.id as string;
  await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${ownerToken}` },
  });

  const friendView = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${ownerId}`,
    headers: { authorization: `Bearer ${friendToken}` },
  });
  assert.equal(friendView.statusCode, 200);
  assert.equal(friendView.json().data.gateway.handle, 'friends-only-claw');

  const strangerView = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${ownerId}`,
    headers: { authorization: `Bearer ${strangerToken}` },
  });
  assert.equal(strangerView.statusCode, 403);

  const ownerView = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${ownerId}`,
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert.equal(ownerView.statusCode, 200);

  await app.close();
});

test('invite_only gateway profile is visible after an invite path exists', async () => {
  const app = buildApp();

  const owner = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Invite Only Claw',
      handle: 'invite-only-claw',
      visibility: 'invite_only',
    },
  });
  const ownerId = owner.json().data.gateway.id as string;
  const ownerToken = owner.json().data.credential.token as string;

  const viewer = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Invite Viewer',
      handle: 'invite-viewer',
      visibility: 'public',
    },
  });
  const viewerToken = viewer.json().data.credential.token as string;

  const stranger = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Invite Stranger',
      handle: 'invite-stranger',
      visibility: 'public',
    },
  });
  const strangerToken = stranger.json().data.credential.token as string;

  const beforeClaim = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${ownerId}`,
    headers: { authorization: `Bearer ${viewerToken}` },
  });
  assert.equal(beforeClaim.statusCode, 403);

  const invite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  const code = invite.json().data.invite.code as string;

  const claim = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: { authorization: `Bearer ${viewerToken}` },
    payload: { code },
  });
  assert.equal(claim.statusCode, 200);

  const viewerAfterClaim = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${ownerId}`,
    headers: { authorization: `Bearer ${viewerToken}` },
  });
  assert.equal(viewerAfterClaim.statusCode, 200);
  assert.equal(viewerAfterClaim.json().data.gateway.handle, 'invite-only-claw');

  const strangerView = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${ownerId}`,
    headers: { authorization: `Bearer ${strangerToken}` },
  });
  assert.equal(strangerView.statusCode, 403);

  await app.close();
});

test('denied profile.read scope hides friend-visible profiles and search results', async () => {
  const app = buildApp();

  const owner = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Owner Profile Scope',
      handle: 'owner-profile-scope',
      visibility: 'friends_only',
    },
  });
  const ownerId = owner.json().data.gateway.id as string;
  const ownerToken = owner.json().data.credential.token as string;

  const viewer = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Viewer Profile Scope',
      handle: 'viewer-profile-scope',
      visibility: 'public',
    },
  });
  const viewerId = viewer.json().data.gateway.id as string;
  const viewerToken = viewer.json().data.credential.token as string;

  const request = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${viewerToken}` },
    payload: { toGatewayId: ownerId },
  });
  const requestId = request.json().data.request.id as string;
  await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${ownerToken}` },
  });

  const beforeDeny = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${ownerId}`,
    headers: { authorization: `Bearer ${viewerToken}` },
  });
  assert.equal(beforeDeny.statusCode, 200);

  const searchBeforeDeny = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=owner-profile',
    headers: { authorization: `Bearer ${viewerToken}` },
  });
  assert.deepEqual(
    searchBeforeDeny.json().data.items.map((item: { handle: string }) => item.handle),
    ['owner-profile-scope'],
  );

  const deny = await app.inject({
    method: 'PATCH',
    url: `/api/v1/friends/${viewerId}/scopes`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: {
      updates: [{ scopeName: 'profile.read', state: 'denied' }],
    },
  });
  assert.equal(deny.statusCode, 200);

  const afterDeny = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${ownerId}`,
    headers: { authorization: `Bearer ${viewerToken}` },
  });
  assert.equal(afterDeny.statusCode, 403);

  const searchAfterDeny = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=owner-profile',
    headers: { authorization: `Bearer ${viewerToken}` },
  });
  assert.deepEqual(searchAfterDeny.json().data.items, []);

  await app.close();
});

test('search returns public gateways and self only, with query filtering', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Alpha Search',
      handle: 'alpha-search',
      bio: 'likes coding and travel',
      visibility: 'invite_only',
    },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Beta Public',
      handle: 'beta-public',
      bio: 'public gateway',
      visibility: 'public',
    },
  });

  await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Gamma Private',
      handle: 'gamma-private',
      bio: 'hidden gateway',
      visibility: 'private',
    },
  });

  const searchResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=a',
    headers: { authorization: `Bearer ${alphaToken}` },
  });

  assert.equal(searchResponse.statusCode, 200);
  assert.deepEqual(
    searchResponse.json().data.items.map((item: { handle: string }) => item.handle),
    ['alpha-search', 'beta-public'],
  );
  assert.equal(searchResponse.json().data.items[0].status, 'offline');
  assert.deepEqual(searchResponse.json().data.items[0].tags, []);

  const filteredResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=public&limit=1',
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(filteredResponse.statusCode, 200);
  assert.equal(filteredResponse.json().data.items.length, 1);
  assert.equal(filteredResponse.json().data.items[0].handle, 'beta-public');

  await app.close();
});

test('search includes relationship-visible gateways for friends_only and invite_only', async () => {
  const app = buildApp();

  const owner = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Owner Search',
      handle: 'owner-search',
      visibility: 'friends_only',
    },
  });
  const ownerId = owner.json().data.gateway.id as string;
  const ownerToken = owner.json().data.credential.token as string;

  const friend = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Friend Search',
      handle: 'friend-search',
      visibility: 'public',
    },
  });
  const friendToken = friend.json().data.credential.token as string;

  const inviteOnly = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Invite Search',
      handle: 'invite-search',
      visibility: 'invite_only',
    },
  });
  const inviteOnlyId = inviteOnly.json().data.gateway.id as string;
  const inviteOnlyToken = inviteOnly.json().data.credential.token as string;

  const stranger = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Stranger Search',
      handle: 'stranger-search',
      visibility: 'public',
    },
  });
  const strangerToken = stranger.json().data.credential.token as string;

  const beforeOwnerRelationship = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=owner',
    headers: { authorization: `Bearer ${friendToken}` },
  });
  assert.deepEqual(beforeOwnerRelationship.json().data.items, []);

  const beforeInvitePath = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=invite',
    headers: { authorization: `Bearer ${friendToken}` },
  });
  assert.deepEqual(beforeInvitePath.json().data.items, []);

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${friendToken}` },
    payload: { toGatewayId: ownerId },
  });
  const requestId = friendRequest.json().data.request.id as string;
  await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${ownerToken}` },
  });

  const invite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: { authorization: `Bearer ${inviteOnlyToken}` },
  });
  const code = invite.json().data.invite.code as string;
  await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: { authorization: `Bearer ${friendToken}` },
    payload: { code },
  });

  const friendOwnerSearch = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=owner',
    headers: { authorization: `Bearer ${friendToken}` },
  });
  assert.deepEqual(
    friendOwnerSearch.json().data.items.map((item: { handle: string }) => item.handle),
    ['owner-search'],
  );

  const friendInviteSearch = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=invite',
    headers: { authorization: `Bearer ${friendToken}` },
  });
  assert.deepEqual(
    friendInviteSearch.json().data.items.map((item: { handle: string }) => item.handle),
    ['invite-search'],
  );

  const strangerOwnerSearch = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=owner',
    headers: { authorization: `Bearer ${strangerToken}` },
  });
  assert.deepEqual(strangerOwnerSearch.json().data.items, []);

  const strangerInviteSearch = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=invite',
    headers: { authorization: `Bearer ${strangerToken}` },
  });
  assert.deepEqual(strangerInviteSearch.json().data.items, []);
  assert.equal(
    strangerInviteSearch.json().data.items.some((item: { id: string }) => item.id === inviteOnlyId),
    false,
  );

  await app.close();
});

test('friend request can be created and listed in outgoing/incoming views', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Alpha',
      handle: 'alpha',
      visibility: 'public',
    },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Beta',
      handle: 'beta',
      visibility: 'public',
    },
  });
  const betaGatewayId = betaRegister.json().data.gateway.id as string;
  const betaToken = betaRegister.json().data.credential.token as string;

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: {
      toGatewayId: betaGatewayId,
      message: 'let our gateways connect',
    },
  });

  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.json().data.request.fromGateway.handle, 'alpha');
  assert.equal(createResponse.json().data.request.toGateway.handle, 'beta');

  const outgoingResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/friend-requests/outgoing',
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(outgoingResponse.statusCode, 200);
  assert.equal(outgoingResponse.json().data.items.length, 1);
  assert.equal(outgoingResponse.json().data.items[0].toGateway.handle, 'beta');

  const incomingResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/friend-requests/incoming',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(incomingResponse.statusCode, 200);
  assert.equal(incomingResponse.json().data.items.length, 1);
  assert.equal(incomingResponse.json().data.items[0].fromGateway.handle, 'alpha');

  await app.close();
});

test('friend request rejects duplicates and self-targeting', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Alpha',
      handle: 'alpha-dup',
    },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Beta',
      handle: 'beta-dup',
    },
  });
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const firstResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  assert.equal(firstResponse.statusCode, 201);

  const duplicateResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  assert.equal(duplicateResponse.statusCode, 409);
  assert.equal(duplicateResponse.json().error.code, 'pending_request_exists');

  const selfResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: alphaGatewayId },
  });
  assert.equal(selfResponse.statusCode, 400);
  assert.equal(selfResponse.json().error.message, 'cannot friend request yourself');

  await app.close();
});

test('friend request can be accepted and creates friendship visible in friends list', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Accept', handle: 'alpha-accept' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Accept', handle: 'beta-accept' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const requestResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = requestResponse.json().data.request.id as string;

  const acceptResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(acceptResponse.statusCode, 200);
  assert.equal(acceptResponse.json().data.request.status, 'accepted');
  assert.equal(acceptResponse.json().data.conversation.type, 'dm');

  const alphaFriends = await app.inject({
    method: 'GET',
    url: '/api/v1/friends',
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(alphaFriends.statusCode, 200);
  assert.equal(alphaFriends.json().data.items.length, 1);
  assert.equal(alphaFriends.json().data.items[0].handle, 'beta-accept');

  const betaFriends = await app.inject({
    method: 'GET',
    url: '/api/v1/friends',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(betaFriends.statusCode, 200);
  assert.equal(betaFriends.json().data.items.length, 1);
  assert.equal(betaFriends.json().data.items[0].handle, 'alpha-accept');

  const alphaConversations = await app.inject({
    method: 'GET',
    url: '/api/v1/conversations',
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(alphaConversations.statusCode, 200);
  assert.equal(alphaConversations.json().data.items.length, 1);
  assert.equal(alphaConversations.json().data.items[0].peer.handle, 'beta-accept');

  const betaConversations = await app.inject({
    method: 'GET',
    url: '/api/v1/conversations',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(betaConversations.statusCode, 200);
  assert.equal(betaConversations.json().data.items.length, 1);
  assert.equal(betaConversations.json().data.items[0].peer.handle, 'alpha-accept');

  const incomingAfterAccept = await app.inject({
    method: 'GET',
    url: '/api/v1/friend-requests/incoming',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(incomingAfterAccept.json().data.items.length, 0);

  await app.close();
});

test('friend request can be rejected by recipient only', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Reject', handle: 'alpha-reject' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Reject', handle: 'beta-reject' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const requestResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = requestResponse.json().data.request.id as string;

  const forbiddenReject = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/reject`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(forbiddenReject.statusCode, 403);

  const rejectResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/reject`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(rejectResponse.statusCode, 200);
  assert.equal(rejectResponse.json().data.request.status, 'rejected');

  const betaIncoming = await app.inject({
    method: 'GET',
    url: '/api/v1/friend-requests/incoming',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(betaIncoming.json().data.items.length, 0);

  await app.close();
});

test('conversation members can send and list dm messages', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Message', handle: 'alpha-message' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Message', handle: 'beta-message' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  const conversationId = accept.json().data.conversation.id as string;

  const send = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { body: 'hello beta' },
  });
  assert.equal(send.statusCode, 201);
  assert.equal(send.json().data.message.body, 'hello beta');

  const list = await app.inject({
    method: 'GET',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data.items.length, 1);
  assert.equal(list.json().data.items[0].body, 'hello beta');
  assert.equal(list.json().data.items[0].messageType, 'text');

  await app.close();
});

test('conversation read state tracks unread messages and does not regress on stale read markers', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Read State', handle: 'alpha-read-state' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Read State', handle: 'beta-read-state' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  const conversationId = accept.json().data.conversation.id as string;

  const firstSend = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { body: 'first unread wave' },
  });
  assert.equal(firstSend.statusCode, 201);
  const firstMessageId = firstSend.json().data.message.id as string;
  assert.equal(firstSend.json().data.readState.lastReadMessageId, firstMessageId);
  assert.equal(firstSend.json().data.readState.unreadCount, 0);

  const betaConversationsBeforeRead = await app.inject({
    method: 'GET',
    url: '/api/v1/conversations',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(betaConversationsBeforeRead.statusCode, 200);
  assert.equal(betaConversationsBeforeRead.json().data.items[0].readState.lastReadMessageId, null);
  assert.equal(betaConversationsBeforeRead.json().data.items[0].readState.unreadCount, 1);
  assert.equal(betaConversationsBeforeRead.json().data.items[0].readState.latestMessageId, firstMessageId);

  const betaMessagesBeforeRead = await app.inject({
    method: 'GET',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(betaMessagesBeforeRead.statusCode, 200);
  assert.equal(betaMessagesBeforeRead.json().data.readState.unreadCount, 1);

  const firstMarkRead = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/read-state`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(firstMarkRead.statusCode, 200);
  assert.equal(firstMarkRead.json().data.readState.lastReadMessageId, firstMessageId);
  assert.equal(firstMarkRead.json().data.readState.unreadCount, 0);

  const secondSend = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { body: 'second unread wave' },
  });
  assert.equal(secondSend.statusCode, 201);
  const secondMessageId = secondSend.json().data.message.id as string;

  const secondMarkRead = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/read-state`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(secondMarkRead.statusCode, 200);
  assert.equal(secondMarkRead.json().data.readState.lastReadMessageId, secondMessageId);
  assert.equal(secondMarkRead.json().data.readState.unreadCount, 0);

  const staleMarkRead = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/read-state`,
    headers: { authorization: `Bearer ${betaToken}` },
    payload: { messageId: firstMessageId },
  });
  assert.equal(staleMarkRead.statusCode, 200);
  assert.equal(staleMarkRead.json().data.readState.lastReadMessageId, secondMessageId);
  assert.equal(staleMarkRead.json().data.readState.unreadCount, 0);

  await app.close();
});

test('marking conversation read does not emit extra sea feed events', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Quiet Read', handle: 'alpha-quiet-read' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Quiet Read', handle: 'beta-quiet-read' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  const conversationId = accept.json().data.conversation.id as string;

  const send = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { body: 'read state should stay quiet' },
  });
  assert.equal(send.statusCode, 201);

  const feedBefore = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=mine',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(feedBefore.statusCode, 200);
  const beforeIds = feedBefore.json().data.items.map((item: { id: string }) => item.id);

  const activityBefore = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${alphaGatewayId}/activity`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(activityBefore.statusCode, 200);
  const activityBeforeIds = activityBefore.json().data.items.map((item: { id: string }) => item.id);

  const markRead = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/read-state`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(markRead.statusCode, 200);
  assert.equal(markRead.json().data.readState.unreadCount, 0);

  const feedAfter = await app.inject({
    method: 'GET',
    url: '/api/v1/sea/feed?scope=mine',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(feedAfter.statusCode, 200);
  assert.deepEqual(
    feedAfter.json().data.items.map((item: { id: string }) => item.id),
    beforeIds,
  );

  const activityAfter = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${alphaGatewayId}/activity`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(activityAfter.statusCode, 200);
  assert.deepEqual(
    activityAfter.json().data.items.map((item: { id: string }) => item.id),
    activityBeforeIds,
  );

  await app.close();
});

test('denying chat.send blocks sending but still allows reading when chat.receive remains granted', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Chat Send', handle: 'alpha-chat-send' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Chat Send', handle: 'beta-chat-send' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  const conversationId = accept.json().data.conversation.id as string;

  const initialSend = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { body: 'before deny' },
  });
  assert.equal(initialSend.statusCode, 201);

  const denySend = await app.inject({
    method: 'PATCH',
    url: `/api/v1/friends/${alphaGatewayId}/scopes`,
    headers: { authorization: `Bearer ${betaToken}` },
    payload: {
      updates: [{ scopeName: 'chat.send', state: 'denied' }],
    },
  });
  assert.equal(denySend.statusCode, 200);

  const deniedSend = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { body: 'after deny' },
  });
  assert.equal(deniedSend.statusCode, 403);
  assert.equal(deniedSend.json().error.code, 'forbidden');

  const listed = await app.inject({
    method: 'GET',
    url: '/api/v1/conversations',
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(
    listed.json().data.items.map((item: { id: string; peer: { handle: string } }) => ({ id: item.id, peer: item.peer.handle })),
    [{ id: conversationId, peer: 'beta-chat-send' }],
  );

  const readable = await app.inject({
    method: 'GET',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(readable.statusCode, 200);
  assert.equal(readable.json().data.items.length, 1);
  assert.equal(readable.json().data.items[0].body, 'before deny');

  await app.close();
});

test('denying chat.receive blocks reading and hides the conversation from the list', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Chat Receive', handle: 'alpha-chat-receive' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Chat Receive', handle: 'beta-chat-receive' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  const conversationId = accept.json().data.conversation.id as string;

  const seedMessage = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${betaToken}` },
    payload: { body: 'beta says hi' },
  });
  assert.equal(seedMessage.statusCode, 201);

  const denyReceive = await app.inject({
    method: 'PATCH',
    url: `/api/v1/friends/${alphaGatewayId}/scopes`,
    headers: { authorization: `Bearer ${betaToken}` },
    payload: {
      updates: [{ scopeName: 'chat.receive', state: 'denied' }],
    },
  });
  assert.equal(denyReceive.statusCode, 200);

  const hiddenFromList = await app.inject({
    method: 'GET',
    url: '/api/v1/conversations',
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(hiddenFromList.statusCode, 200);
  assert.deepEqual(hiddenFromList.json().data.items, []);

  const deniedRead = await app.inject({
    method: 'GET',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(deniedRead.statusCode, 403);
  assert.equal(deniedRead.json().error.code, 'forbidden');

  const betaList = await app.inject({
    method: 'GET',
    url: '/api/v1/conversations',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(betaList.statusCode, 200);
  assert.deepEqual(
    betaList.json().data.items.map((item: { id: string; peer: { handle: string } }) => ({ id: item.id, peer: item.peer.handle })),
    [{ id: conversationId, peer: 'alpha-chat-receive' }],
  );

  const betaRead = await app.inject({
    method: 'GET',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(betaRead.statusCode, 200);
  assert.equal(betaRead.json().data.items.length, 1);
  assert.equal(betaRead.json().data.items[0].body, 'beta says hi');

  await app.close();
});

test('non-members cannot read or send conversation messages', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Guard', handle: 'alpha-guard' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Guard', handle: 'beta-guard' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const gammaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Gamma Guard', handle: 'gamma-guard' },
  });
  const gammaToken = gammaRegister.json().data.credential.token as string;
  const gammaGatewayId = gammaRegister.json().data.gateway.id as string;

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  const conversationId = accept.json().data.conversation.id as string;

  const forbiddenRead = await app.inject({
    method: 'GET',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${gammaToken}` },
  });
  assert.equal(forbiddenRead.statusCode, 403);

  const forbiddenSend = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${gammaToken}` },
    payload: { body: 'intrude' },
  });
  assert.equal(forbiddenSend.statusCode, 403);

  const forbiddenPresence = await app.inject({
    method: 'GET',
    url: `/api/v1/presence/${gammaGatewayId}`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(forbiddenPresence.statusCode, 403);

  await app.close();
});

test('presence heartbeat marks gateway online and friends can read it', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Presence', handle: 'alpha-presence' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;
  const alphaGatewayId = alphaRegister.json().data.gateway.id as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Presence', handle: 'beta-presence' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = friendRequest.json().data.request.id as string;

  await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${betaToken}` },
  });

  const heartbeat = await app.inject({
    method: 'POST',
    url: '/api/v1/presence/heartbeat',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: {
      sessionId: 'alpha-session',
      connectionType: 'gateway_ws',
    },
  });
  assert.equal(heartbeat.statusCode, 200);
  assert.equal(heartbeat.json().data.status, 'online');
  assert.equal(heartbeat.json().data.sessionId, 'alpha-session');
  assert.equal(heartbeat.json().data.connectionType, 'gateway_ws');
  assert.equal(typeof heartbeat.json().data.lastSeenAt, 'string');

  const selfPresence = await app.inject({
    method: 'GET',
    url: `/api/v1/presence/${alphaGatewayId}`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(selfPresence.statusCode, 200);
  assert.equal(selfPresence.json().data.status, 'online');

  const friendPresence = await app.inject({
    method: 'GET',
    url: `/api/v1/presence/${alphaGatewayId}`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(friendPresence.statusCode, 200);
  assert.equal(friendPresence.json().data.status, 'online');

  const friends = await app.inject({
    method: 'GET',
    url: '/api/v1/friends',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(friends.statusCode, 200);
  assert.equal(friends.json().data.items[0].handle, 'alpha-presence');
  assert.equal(friends.json().data.items[0].status, 'online');
  assert.equal(typeof friends.json().data.items[0].lastSeenAt, 'string');

  const conversations = await app.inject({
    method: 'GET',
    url: '/api/v1/conversations',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(conversations.statusCode, 200);
  assert.equal(conversations.json().data.items[0].peer.handle, 'alpha-presence');
  assert.equal(conversations.json().data.items[0].peer.status, 'online');

  await app.close();
});

test('denied presence.read scope hides friend presence', async () => {
  const app = buildApp();

  const alpha = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Alpha Presence Scope',
      handle: 'alpha-presence-scope',
      visibility: 'public',
    },
  });
  const alphaId = alpha.json().data.gateway.id as string;
  const alphaToken = alpha.json().data.credential.token as string;

  const beta = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: {
      displayName: 'Beta Presence Scope',
      handle: 'beta-presence-scope',
      visibility: 'public',
    },
  });
  const betaId = beta.json().data.gateway.id as string;
  const betaToken = beta.json().data.credential.token as string;

  const request = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${betaToken}` },
    payload: { toGatewayId: alphaId },
  });
  const requestId = request.json().data.request.id as string;
  await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });

  await app.inject({
    method: 'POST',
    url: '/api/v1/presence/heartbeat',
    headers: { authorization: `Bearer ${alphaToken}` },
  });

  const beforeDeny = await app.inject({
    method: 'GET',
    url: `/api/v1/presence/${alphaId}`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(beforeDeny.statusCode, 200);

  const deny = await app.inject({
    method: 'PATCH',
    url: `/api/v1/friends/${betaId}/scopes`,
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: {
      updates: [{ scopeName: 'presence.read', state: 'denied' }],
    },
  });
  assert.equal(deny.statusCode, 200);

  const afterDeny = await app.inject({
    method: 'GET',
    url: `/api/v1/presence/${alphaId}`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(afterDeny.statusCode, 403);

  const selfView = await app.inject({
    method: 'GET',
    url: `/api/v1/presence/${alphaId}`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(selfView.statusCode, 200);
  assert.equal(selfView.json().data.status, 'online');

  await app.close();
});

test('friend scopes are seeded on accept and can be updated', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Scope', handle: 'alpha-scope' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Scope', handle: 'beta-scope' },
  });
  const betaToken = betaRegister.json().data.credential.token as string;
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const friendRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { toGatewayId: betaGatewayId },
  });
  const requestId = friendRequest.json().data.request.id as string;

  const accept = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(accept.statusCode, 200);

  const initialScopes = await app.inject({
    method: 'GET',
    url: `/api/v1/friends/${betaGatewayId}/scopes`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(initialScopes.statusCode, 200);
  assert.equal(initialScopes.json().data.outbound.length, 5);
  const taskRequest = initialScopes.json().data.outbound.find((item: { scope: string; state: string }) => item.scope === 'task.request');
  assert.equal(taskRequest?.state, 'denied');

  const updatedScopes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/friends/${betaGatewayId}/scopes`,
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: {
      updates: [{ scopeName: 'task.request', state: 'granted' }],
    },
  });
  assert.equal(updatedScopes.statusCode, 200);
  const updatedTaskRequest = updatedScopes.json().data.outbound.find((item: { scope: string; state: string }) => item.scope === 'task.request');
  assert.equal(updatedTaskRequest?.state, 'granted');

  await app.close();
});

test('friend scopes require an existing friendship', async () => {
  const app = buildApp();

  const alphaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Lone', handle: 'alpha-lone' },
  });
  const alphaToken = alphaRegister.json().data.credential.token as string;

  const betaRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Lone', handle: 'beta-lone' },
  });
  const betaGatewayId = betaRegister.json().data.gateway.id as string;

  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/friends/${betaGatewayId}/scopes`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(response.statusCode, 404);

  await app.close();
});

test('invite can be created and claimed into a friend request', async () => {
  const app = buildApp();

  const ownerRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Owner Invite', handle: 'owner-invite' },
  });
  const ownerToken = ownerRegister.json().data.credential.token as string;
  const ownerGatewayId = ownerRegister.json().data.gateway.id as string;

  const claimerRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Claimer Invite', handle: 'claimer-invite' },
  });
  const claimerToken = claimerRegister.json().data.credential.token as string;

  const inviteResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { maxUses: 1 },
  });
  assert.equal(inviteResponse.statusCode, 201);
  const code = inviteResponse.json().data.invite.code as string;

  const claimResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: { authorization: `Bearer ${claimerToken}` },
    payload: { code },
  });
  assert.equal(claimResponse.statusCode, 200);
  assert.equal(claimResponse.json().data.inviterGateway.id, ownerGatewayId);
  assert.equal(claimResponse.json().data.friendRequest.toGateway.id, ownerGatewayId);

  const incoming = await app.inject({
    method: 'GET',
    url: '/api/v1/friend-requests/incoming',
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert.equal(incoming.statusCode, 200);
  assert.equal(incoming.json().data.items.length, 1);
  assert.equal(incoming.json().data.items[0].fromGateway.handle, 'claimer-invite');

  await app.close();
});

test('invite can be revoked by owner and then cannot be claimed', async () => {
  const app = buildApp();

  const ownerRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Owner Revoke', handle: 'owner-revoke' },
  });
  const ownerToken = ownerRegister.json().data.credential.token as string;

  const outsiderRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Outsider Revoke', handle: 'outsider-revoke' },
  });
  const outsiderToken = outsiderRegister.json().data.credential.token as string;

  const claimerRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Claimer Revoke', handle: 'claimer-revoke' },
  });
  const claimerToken = claimerRegister.json().data.credential.token as string;

  const inviteResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { maxUses: 2 },
  });
  assert.equal(inviteResponse.statusCode, 201);
  const inviteId = inviteResponse.json().data.invite.id as string;
  const code = inviteResponse.json().data.invite.code as string;

  const outsiderRevoke = await app.inject({
    method: 'POST',
    url: `/api/v1/invites/${inviteId}/revoke`,
    headers: { authorization: `Bearer ${outsiderToken}` },
  });
  assert.equal(outsiderRevoke.statusCode, 403);
  assert.equal(outsiderRevoke.json().error.code, 'forbidden');

  const ownerRevoke = await app.inject({
    method: 'POST',
    url: `/api/v1/invites/${inviteId}/revoke`,
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert.equal(ownerRevoke.statusCode, 200);
  assert.equal(typeof ownerRevoke.json().data.invite.revokedAt, 'string');

  const claimResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: { authorization: `Bearer ${claimerToken}` },
    payload: { code },
  });
  assert.equal(claimResponse.statusCode, 409);
  assert.equal(claimResponse.json().error.code, 'invalid_state');
  assert.equal(claimResponse.json().error.message, 'invite revoked');

  await app.close();
});

test('invite cannot be claimed twice when maxUses is exhausted', async () => {
  const app = buildApp();

  const ownerRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Owner Once', handle: 'owner-once' },
  });
  const ownerToken = ownerRegister.json().data.credential.token as string;

  const claimerOneRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Claimer One', handle: 'claimer-one' },
  });
  const claimerOneToken = claimerOneRegister.json().data.credential.token as string;

  const claimerTwoRegister = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Claimer Two', handle: 'claimer-two' },
  });
  const claimerTwoToken = claimerTwoRegister.json().data.credential.token as string;

  const inviteResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { maxUses: 1 },
  });
  const code = inviteResponse.json().data.invite.code as string;

  const firstClaim = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: { authorization: `Bearer ${claimerOneToken}` },
    payload: { code },
  });
  assert.equal(firstClaim.statusCode, 200);

  const secondClaim = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: { authorization: `Bearer ${claimerTwoToken}` },
    payload: { code },
  });
  assert.equal(secondClaim.statusCode, 409);
  assert.equal(secondClaim.json().error.message, 'invite exhausted');

  await app.close();
});

test('friendship can be removed and friends list becomes empty', async () => {
  const app = buildApp();

  const alpha = await app.inject({ method: 'POST', url: '/api/v1/gateways/register', payload: { displayName: 'Alpha Remove', handle: 'alpha-remove' } });
  const alphaToken = alpha.json().data.credential.token as string;
  const beta = await app.inject({ method: 'POST', url: '/api/v1/gateways/register', payload: { displayName: 'Beta Remove', handle: 'beta-remove' } });
  const betaToken = beta.json().data.credential.token as string;
  const betaId = beta.json().data.gateway.id as string;

  const fr = await app.inject({ method: 'POST', url: '/api/v1/friend-requests', headers: { authorization: `Bearer ${alphaToken}` }, payload: { toGatewayId: betaId } });
  const requestId = fr.json().data.request.id as string;
  await app.inject({ method: 'POST', url: `/api/v1/friend-requests/${requestId}/accept`, headers: { authorization: `Bearer ${betaToken}` } });

  const removed = await app.inject({ method: 'DELETE', url: `/api/v1/friends/${betaId}`, headers: { authorization: `Bearer ${alphaToken}` } });
  assert.equal(removed.statusCode, 200);

  const alphaFriends = await app.inject({ method: 'GET', url: '/api/v1/friends', headers: { authorization: `Bearer ${alphaToken}` } });
  assert.equal(alphaFriends.json().data.items.length, 0);

  const betaFriends = await app.inject({ method: 'GET', url: '/api/v1/friends', headers: { authorization: `Bearer ${betaToken}` } });
  assert.equal(betaFriends.json().data.items.length, 0);

  await app.close();
});

test('blocking removes friendship and prevents new friend requests', async () => {
  const app = buildApp();

  const alpha = await app.inject({ method: 'POST', url: '/api/v1/gateways/register', payload: { displayName: 'Alpha Block', handle: 'alpha-block' } });
  const alphaToken = alpha.json().data.credential.token as string;
  const alphaId = alpha.json().data.gateway.id as string;

  const beta = await app.inject({ method: 'POST', url: '/api/v1/gateways/register', payload: { displayName: 'Beta Block', handle: 'beta-block' } });
  const betaToken = beta.json().data.credential.token as string;
  const betaId = beta.json().data.gateway.id as string;

  const fr = await app.inject({ method: 'POST', url: '/api/v1/friend-requests', headers: { authorization: `Bearer ${alphaToken}` }, payload: { toGatewayId: betaId } });
  const requestId = fr.json().data.request.id as string;
  await app.inject({ method: 'POST', url: `/api/v1/friend-requests/${requestId}/accept`, headers: { authorization: `Bearer ${betaToken}` } });

  const blocked = await app.inject({
    method: 'POST',
    url: '/api/v1/blocks',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { gatewayId: betaId, reason: 'spam' },
  });
  assert.equal(blocked.statusCode, 201);

  const alphaFriends = await app.inject({ method: 'GET', url: '/api/v1/friends', headers: { authorization: `Bearer ${alphaToken}` } });
  assert.equal(alphaFriends.json().data.items.length, 0);

  const blockedRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${betaToken}` },
    payload: { toGatewayId: alphaId },
  });
  assert.equal(blockedRequest.statusCode, 403);
  assert.equal(blockedRequest.json().error.code, 'blocked');

  const unblocked = await app.inject({
    method: 'DELETE',
    url: `/api/v1/blocks/${betaId}`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(unblocked.statusCode, 200);

  await app.close();
});

test('blocking prevents conversation message access between previously connected gateways', async () => {
  const app = buildApp();

  const alpha = await app.inject({ method: 'POST', url: '/api/v1/gateways/register', payload: { displayName: 'Alpha Block Msg', handle: 'alpha-block-msg' } });
  const alphaToken = alpha.json().data.credential.token as string;

  const beta = await app.inject({ method: 'POST', url: '/api/v1/gateways/register', payload: { displayName: 'Beta Block Msg', handle: 'beta-block-msg' } });
  const betaToken = beta.json().data.credential.token as string;
  const betaId = beta.json().data.gateway.id as string;

  const fr = await app.inject({ method: 'POST', url: '/api/v1/friend-requests', headers: { authorization: `Bearer ${alphaToken}` }, payload: { toGatewayId: betaId } });
  const requestId = fr.json().data.request.id as string;
  const accepted = await app.inject({ method: 'POST', url: `/api/v1/friend-requests/${requestId}/accept`, headers: { authorization: `Bearer ${betaToken}` } });
  const conversationId = accepted.json().data.conversation.id as string;

  const blocked = await app.inject({
    method: 'POST',
    url: '/api/v1/blocks',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { gatewayId: betaId },
  });
  assert.equal(blocked.statusCode, 201);

  const send = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${betaToken}` },
    payload: { body: 'should fail' },
  });
  assert.equal(send.statusCode, 403);

  const read = await app.inject({
    method: 'GET',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alphaToken}` },
  });
  assert.equal(read.statusCode, 403);

  await app.close();
});

test('blocking hides public profiles and search results from the blocked side', async () => {
  const app = buildApp();

  const alpha = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Alpha Search Block', handle: 'alpha-search-block', visibility: 'public' },
  });
  const alphaToken = alpha.json().data.credential.token as string;
  const alphaId = alpha.json().data.gateway.id as string;

  const beta = await app.inject({
    method: 'POST',
    url: '/api/v1/gateways/register',
    payload: { displayName: 'Beta Search Block', handle: 'beta-search-block', visibility: 'public' },
  });
  const betaToken = beta.json().data.credential.token as string;

  const beforeBlock = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=alpha-search',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(beforeBlock.statusCode, 200);
  assert.equal(beforeBlock.json().data.items.some((item: { id: string }) => item.id === alphaId), true);

  const blocked = await app.inject({
    method: 'POST',
    url: '/api/v1/blocks',
    headers: { authorization: `Bearer ${alphaToken}` },
    payload: { gatewayId: beta.json().data.gateway.id },
  });
  assert.equal(blocked.statusCode, 201);

  const profile = await app.inject({
    method: 'GET',
    url: `/api/v1/gateways/${alphaId}`,
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(profile.statusCode, 403);
  assert.equal(profile.json().error.code, 'blocked');

  const search = await app.inject({
    method: 'GET',
    url: '/api/v1/search/gateways?q=alpha-search',
    headers: { authorization: `Bearer ${betaToken}` },
  });
  assert.equal(search.statusCode, 200);
  assert.equal(search.json().data.items.some((item: { id: string }) => item.id === alphaId), false);

  await app.close();
});

test('audit endpoint records representative critical actions', async () => {
  const app = buildApp();

  const alpha = await registerGateway(app, {
    displayName: 'Audit Alpha',
    handle: 'audit-alpha',
    visibility: 'public',
  });
  const beta = await registerGateway(app, {
    displayName: 'Audit Beta',
    handle: 'audit-beta',
    visibility: 'public',
  });
  const gamma = await registerGateway(app, {
    displayName: 'Audit Gamma',
    handle: 'audit-gamma',
    visibility: 'public',
  });

  const profileUpdate = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: {
      displayName: 'Audit Alpha Updated',
      visibility: 'friends_only',
    },
  });
  assert.equal(profileUpdate.statusCode, 200);

  const invite = await app.inject({
    method: 'POST',
    url: '/api/v1/invites',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { maxUses: 2 },
  });
  assert.equal(invite.statusCode, 201);
  const inviteCode = invite.json().data.invite.code as string;

  const claim = await app.inject({
    method: 'POST',
    url: '/api/v1/invites/claim',
    headers: { authorization: `Bearer ${beta.token}` },
    payload: { code: inviteCode },
  });
  assert.equal(claim.statusCode, 200);
  const claimedRequestId = claim.json().data.friendRequest.id as string;

  const accepted = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${claimedRequestId}/accept`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(accepted.statusCode, 200);
  const conversationId = accepted.json().data.conversation.id as string;

  const scopeUpdate = await app.inject({
    method: 'PATCH',
    url: `/api/v1/friends/${beta.gateway.id}/scopes`,
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: {
      updates: [{ scopeName: 'task.request', state: 'granted' }],
    },
  });
  assert.equal(scopeUpdate.statusCode, 200);

  const message = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${beta.token}` },
    payload: { body: 'audit trail message' },
  });
  assert.equal(message.statusCode, 201);

  const removeFriend = await app.inject({
    method: 'DELETE',
    url: `/api/v1/friends/${beta.gateway.id}`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(removeFriend.statusCode, 200);

  const gammaRequest = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${gamma.token}` },
    payload: { toGatewayId: alpha.gateway.id, message: 'hello alpha' },
  });
  assert.equal(gammaRequest.statusCode, 201);
  const gammaRequestId = gammaRequest.json().data.request.id as string;

  const rejected = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${gammaRequestId}/reject`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(rejected.statusCode, 200);

  const blocked = await app.inject({
    method: 'POST',
    url: '/api/v1/blocks',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { gatewayId: gamma.gateway.id, reason: 'audit coverage' },
  });
  assert.equal(blocked.statusCode, 201);

  const unblocked = await app.inject({
    method: 'DELETE',
    url: `/api/v1/blocks/${gamma.gateway.id}`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(unblocked.statusCode, 200);

  const audit = await app.inject({
    method: 'GET',
    url: '/api/v1/audit',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(audit.statusCode, 200);

  const actions = audit.json().data.items.map((item: { action: string }) => item.action);
  const uniqueActions = new Set(actions);
  assert.equal(uniqueActions.has('gateway.registered'), true);
  assert.equal(uniqueActions.has('gateway.profile_updated'), true);
  assert.equal(uniqueActions.has('invite.created'), true);
  assert.equal(uniqueActions.has('invite.claimed'), true);
  assert.equal(uniqueActions.has('friend_request.created'), true);
  assert.equal(uniqueActions.has('friend_request.accepted'), true);
  assert.equal(uniqueActions.has('friend_request.rejected'), true);
  assert.equal(uniqueActions.has('friend.removed'), true);
  assert.equal(uniqueActions.has('gateway.blocked'), true);
  assert.equal(uniqueActions.has('gateway.unblocked'), true);
  assert.equal(uniqueActions.has('friend.scope_changed'), true);
  assert.equal(uniqueActions.has('message.sent'), true);

  await app.close();
});

test('audit endpoint filters by actor, target, action, and cursor', async () => {
  const app = buildApp();

  const alpha = await registerGateway(app, {
    displayName: 'Filter Alpha',
    handle: 'filter-alpha',
    visibility: 'public',
  });
  const beta = await registerGateway(app, {
    displayName: 'Filter Beta',
    handle: 'filter-beta',
    visibility: 'public',
  });

  const profileUpdate = await app.inject({
    method: 'PATCH',
    url: '/api/v1/gateways/me',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { bio: 'filter bio' },
  });
  assert.equal(profileUpdate.statusCode, 200);

  const request = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { toGatewayId: beta.gateway.id, message: 'filter request' },
  });
  assert.equal(request.statusCode, 201);

  const fullAudit = await app.inject({
    method: 'GET',
    url: '/api/v1/audit',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(fullAudit.statusCode, 200);
  const fullItems = fullAudit.json().data.items as Array<{ id: string; actorGatewayId: string | null; targetGatewayId: string | null; action: string }>;
  assert.equal(fullItems.length >= 4, true);

  const actorFiltered = await app.inject({
    method: 'GET',
    url: `/api/v1/audit?actorGatewayId=${alpha.gateway.id}`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(actorFiltered.statusCode, 200);
  assert.equal(
    actorFiltered.json().data.items.every((item: { actorGatewayId: string | null }) => item.actorGatewayId === alpha.gateway.id),
    true,
  );

  const targetFiltered = await app.inject({
    method: 'GET',
    url: `/api/v1/audit?targetGatewayId=${beta.gateway.id}`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(targetFiltered.statusCode, 200);
  assert.equal(
    targetFiltered.json().data.items.every((item: { targetGatewayId: string | null }) => item.targetGatewayId === beta.gateway.id),
    true,
  );

  const actionFiltered = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?action=gateway.profile_updated',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(actionFiltered.statusCode, 200);
  assert.deepEqual(
    actionFiltered.json().data.items.map((item: { action: string }) => item.action),
    ['gateway.profile_updated'],
  );

  const cursorFiltered = await app.inject({
    method: 'GET',
    url: `/api/v1/audit?cursor=${fullItems[0]!.id}`,
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(cursorFiltered.statusCode, 200);
  const cursorItems = cursorFiltered.json().data.items as Array<{ id: string }>;
  assert.equal(cursorItems.some((item) => item.id === fullItems[0]!.id), false);
  assert.equal(cursorItems.length, fullItems.length - 1);

  await app.close();
});

test('message audit stores metadata without full message body text', async () => {
  const app = buildApp();

  const alpha = await registerGateway(app, {
    displayName: 'Message Audit Alpha',
    handle: 'message-audit-alpha',
    visibility: 'public',
  });
  const beta = await registerGateway(app, {
    displayName: 'Message Audit Beta',
    handle: 'message-audit-beta',
    visibility: 'public',
  });

  const request = await app.inject({
    method: 'POST',
    url: '/api/v1/friend-requests',
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { toGatewayId: beta.gateway.id },
  });
  assert.equal(request.statusCode, 201);
  const requestId = request.json().data.request.id as string;

  const accepted = await app.inject({
    method: 'POST',
    url: `/api/v1/friend-requests/${requestId}/accept`,
    headers: { authorization: `Bearer ${beta.token}` },
  });
  assert.equal(accepted.statusCode, 200);
  const conversationId = accepted.json().data.conversation.id as string;

  const body = 'super secret dm body';
  const sent = await app.inject({
    method: 'POST',
    url: `/api/v1/conversations/${conversationId}/messages`,
    headers: { authorization: `Bearer ${alpha.token}` },
    payload: { body },
  });
  assert.equal(sent.statusCode, 201);
  const messageId = sent.json().data.message.id as string;

  const audit = await app.inject({
    method: 'GET',
    url: '/api/v1/audit?action=message.sent',
    headers: { authorization: `Bearer ${alpha.token}` },
  });
  assert.equal(audit.statusCode, 200);

  const entry = audit.json().data.items.find((item: { metadata: { messageId?: string } }) => item.metadata.messageId === messageId) as {
    actorGatewayId: string | null;
    targetGatewayId: string | null;
    metadata: {
      messageId: string;
      conversationId: string;
      messageType: string;
      bodyLength: number;
      body?: string;
    };
  };

  assert.equal(entry.actorGatewayId, alpha.gateway.id);
  assert.equal(entry.targetGatewayId, beta.gateway.id);
  assert.equal(entry.metadata.messageId, messageId);
  assert.equal(entry.metadata.conversationId, conversationId);
  assert.equal(entry.metadata.messageType, 'text');
  assert.equal(entry.metadata.bodyLength, body.length);
  assert.equal('body' in entry.metadata, false);
  assert.equal(JSON.stringify(entry.metadata).includes(body), false);

  await app.close();
});
