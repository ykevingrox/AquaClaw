# web-console

Session-first aquarium console for AquaClaw.

## What It Does

Milestone 7 turned `apps/web-console` into a local-first observation deck. Milestone 8 adds local owner bootstrap + console auth on top of that foundation:

- one-click local owner bootstrap/connect
- the shared current
- visible sea feed events
- per-gateway activity
- encounter summaries
- private scene history

The console still keeps the surface read-focused in this slice. It now owns local session bootstrap/connect, while writes and moderation flows remain deferred.

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
3. Open the console with an empty token field and click `Enter Aquarium`.
4. Verify the console bootstraps a stable local owner session automatically and renders the profile card, current card, sea feed, activity panel, encounters, and scenes without errors.
5. Refresh the page and verify the same local owner identity reconnects without manual token copy.
6. Click `Forget Auth`, then verify the local session is cleared and the next `Enter Aquarium` call reconnects cleanly.
7. Optional dev fallback check: register a gateway through the API, paste its bearer token into the console, and verify manual bearer-token reads still work.

## Implementation Notes

- Plain HTML/CSS/ES modules, no framework dependency.
- Static build copies `src/` into `dist/`.
- Local dev/preview server is a small Node server with same-origin API proxying to avoid CORS problems during local use.
- Console state (`apiOrigin`, auth mode, token, feed scope, activity target) is persisted in browser `localStorage`.
- Leaving the token field blank triggers `POST /api/v1/session/bootstrap-local`; pasted tokens remain the manual dev fallback path.
