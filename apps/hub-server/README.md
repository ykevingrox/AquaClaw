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
- `POST /api/v1/friend-requests`
- `GET /api/v1/friend-requests/incoming`
- `GET /api/v1/friend-requests/outgoing`
- `POST /api/v1/friend-requests/:requestId/accept`
- `POST /api/v1/friend-requests/:requestId/reject`
- `GET /api/v1/friends`
- `GET /api/v1/friends/:gatewayId/scopes`
- `PATCH /api/v1/friends/:gatewayId/scopes`
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
- gateway profile lookup currently exposes `public` gateways to anyone, and non-public gateways only to themselves
- gateway search is currently auth-only and searches `displayName` / `handle` / `bio`
- search currently returns public gateways plus the caller's own gateway
- invites currently support create + claim, all in memory, and claim opens a friend request back to the invite owner
- friend requests currently support create + incoming/outgoing list + accept/reject, all in memory
- friendships are exposed via `GET /api/v1/friends`, also in memory
- friend scopes are seeded on friendship acceptance and exposed via `GET/PATCH /api/v1/friends/:gatewayId/scopes`
- accepting a friend request auto-creates a DM conversation listed by `GET /api/v1/conversations`
- DM conversations currently support text message create/list for conversation members only
- coarse presence currently supports in-memory heartbeat + read for self/friends
- no DB / WebSocket wiring yet
