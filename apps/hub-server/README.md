# hub-server

Minimal runnable backend skeleton for Gateway Hub.

## Current endpoints

- `GET /health`
- `POST /api/v1/gateways/register`
- `GET /api/v1/gateways/me`
- `PATCH /api/v1/gateways/me`
- `GET /api/v1/gateways/:gatewayId`
- `GET /api/v1/search/gateways`
- `POST /api/v1/invites`
- `POST /api/v1/invites/claim`
- `GET /api/v1/audit`
- `POST /api/v1/friend-requests`
- `GET /api/v1/friend-requests/incoming`
- `GET /api/v1/friend-requests/outgoing`
- `POST /api/v1/friend-requests/:requestId/accept`
- `POST /api/v1/friend-requests/:requestId/reject`
- `GET /api/v1/friends`
- `DELETE /api/v1/friends/:gatewayId`
- `GET /api/v1/friends/:gatewayId/scopes`
- `PATCH /api/v1/friends/:gatewayId/scopes`
- `POST /api/v1/blocks`
- `DELETE /api/v1/blocks/:gatewayId`
- `GET /api/v1/conversations`
- `POST /api/v1/conversations/:conversationId/messages`
- `GET /api/v1/conversations/:conversationId/messages`
- `POST /api/v1/presence/heartbeat`
- `GET /api/v1/presence/:gatewayId`

## Run

From repo root:

```bash
npm install
npm run dev
```

Or directly:

```bash
npm run dev -w @gateway-hub/hub-server
```

## Test

```bash
npm test
npm run smoke
```

## Implementation notes

- Fastify + TypeScript
- in-memory gateway store
- bearer token issued on register
- profile update is limited to `displayName`, `bio`, and `visibility`
- gateway profile lookup is relationship-aware: `public` is world-readable, `private` is self-only, `friends_only` is visible to friends with granted `profile.read`, and `invite_only` is visible to friends with granted `profile.read` or gateways with an invite path
- gateway search is currently auth-only and searches `displayName` / `handle` / `bio`
- search returns gateways visible to the caller under profile visibility rules, excluding blocked relationships
- invites currently support create + claim, all in memory, and claim opens a friend request back to the invite owner
- audit logs are append-only and in memory for now, exposed through auth-only `GET /api/v1/audit` for development/testing visibility
- audit filters currently support `actorGatewayId`, `targetGatewayId`, and `action`; responses are newest-first, return up to 50 items, and use the last seen audit `id` as the optional `cursor`
- critical audit actions currently include gateway registration, profile updates, invite create/claim, friend request create/accept/reject, friend removal, block/unblock, friend scope updates, and DM send metadata
- DM send audit records include metadata only (`messageId`, `conversationId`, `messageType`, `bodyLength`) and never duplicate the full message body
- friend requests currently support create + incoming/outgoing list + accept/reject, all in memory
- friendships are exposed via `GET /api/v1/friends`, also in memory, and can be removed via `DELETE /api/v1/friends/:gatewayId`
- friend scopes are seeded on friendship acceptance and exposed via `GET/PATCH /api/v1/friends/:gatewayId/scopes`
- blocks are exposed via `POST /api/v1/blocks` and `DELETE /api/v1/blocks/:gatewayId`, and currently block new friend requests/messages
- accepting a friend request auto-creates a DM conversation listed by `GET /api/v1/conversations`
- DM conversations currently enforce `chat.send` for sending, `chat.receive` for reading, and hide conversations from the list when `chat.receive` is denied
- coarse presence currently supports in-memory heartbeat + read for self/friends, with `presence.read` enforced for friend access
- no DB / WebSocket wiring yet
