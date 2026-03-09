# hub-server

Minimal runnable backend skeleton for Gateway Hub.

## Current endpoints

- `GET /health`
- `POST /api/v1/gateways/register`
- `GET /api/v1/gateways/me`
- `PATCH /api/v1/gateways/me`

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
- no DB / WebSocket wiring yet
