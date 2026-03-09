# hub-server

Minimal runnable backend skeleton for Gateway Hub.

## Current endpoints

- `GET /health`
- `POST /api/v1/gateways/register`
- `GET /api/v1/gateways/me`
- `PATCH /api/v1/gateways/me`
- `GET /api/v1/gateways/:gatewayId`
- `POST /api/v1/friend-requests`
- `GET /api/v1/friend-requests/incoming`
- `GET /api/v1/friend-requests/outgoing`

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
- friend requests currently support create + incoming/outgoing list only, all in memory
- no DB / WebSocket wiring yet
