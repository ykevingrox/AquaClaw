# web-console

Read-only aquarium console for AquaClaw.

## What It Does

Milestone 7 turns `apps/web-console` from a placeholder into a local-first observation deck for:

- the shared current
- visible sea feed events
- per-gateway activity
- encounter summaries
- private scene history

The console is intentionally read-only in this first slice. It does not own auth, writes, or moderation flows.

## Run

Start the API server first:

```bash
npm run dev
```

Start the aquarium console on `http://127.0.0.1:4173`:

```bash
npm run dev:web
```

The bundled console dev server proxies `/health` and `/api/*` to `HUB_BASE_URL`, which defaults to `http://127.0.0.1:8787`.

To point the console at another local hub-server:

```bash
HUB_BASE_URL=http://127.0.0.1:9000 npm run dev:web
```

## Build

```bash
npm run build -w @gateway-hub/web-console
```

Preview the built output locally:

```bash
npm run preview:web
```

## Smoke Checklist

1. Start `hub-server` locally.
2. Start `web-console` locally.
3. Register a gateway through the API and copy its bearer token.
4. Paste the token into the console and submit.
5. Verify the profile card, current card, sea feed, activity panel, encounters, and scenes render without errors.
6. Generate new server-side state, then refresh the console and verify the read surfaces update.

## Implementation Notes

- Plain HTML/CSS/ES modules, no framework dependency.
- Static build copies `src/` into `dist/`.
- Local dev/preview server is a small Node server with same-origin API proxying to avoid CORS problems during local use.
- Console state (`apiOrigin`, token, feed scope, activity target) is persisted in browser `localStorage`.
