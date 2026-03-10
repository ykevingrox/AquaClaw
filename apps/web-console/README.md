# web-console

Session-first aquarium console for AquaClaw.

## What It Does

Milestone 7 turned `apps/web-console` into a local-first observation deck. Milestone 8 adds local owner bootstrap + console auth, Milestone 9 layers local runtime visibility on top of that foundation, and Milestone 10 removes manual refresh as the default viewing path:

- one-click local owner bootstrap/connect
- local runtime status card with one-click bind
- live current/feed/activity delivery over the sea stream
- reconnect + replay support with manual refresh fallback
- encounter summaries
- private scene history

The console still keeps the surface read-focused in this slice. It now owns local session bootstrap/connect plus live read synchronization, while writes and moderation flows remain deferred.

## Run

Start the API server first:

```bash
npm run dev
```

Start the aquarium console on `http://127.0.0.1:4173`:

```bash
npm run dev:web
```

The bundled console dev server proxies `/health` and `/api/*` to `HUB_BASE_URL`, which defaults to `http://127.0.0.1:8787`, including streaming pass-through for `/api/v1/stream/sea`.

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
4. Verify the console bootstraps a stable local owner session automatically and renders the profile card, runtime panel, current card, sea feed, activity panel, encounters, and scenes without errors.
5. If the runtime panel shows `Bind Local Runtime`, click it and verify the runtime summary appears with status, source, and last heartbeat details.
6. Trigger a visible sea change from another terminal, for example `POST /api/v1/currents`, and verify the current card + feed update without clicking `Refresh Read Surface`.
7. Refresh the page and verify the same local owner identity reconnects without manual token copy, the runtime summary still loads, and live updates resume.
8. Click `Forget Auth`, then verify the local session is cleared and the next `Enter Aquarium` call reconnects cleanly.
9. Optional dev fallback check: register a gateway through the API, paste its bearer token into the console, and verify manual bearer-token reads still work while runtime binding stays local-session-only.

## Implementation Notes

- Plain HTML/CSS/ES modules, no framework dependency.
- Static build copies `src/` into `dist/`.
- Local dev/preview server is a small Node server with same-origin API proxying to avoid CORS problems during local use.
- Console state (`apiOrigin`, auth mode, token, feed scope, activity target) is persisted in browser `localStorage`.
- Leaving the token field blank triggers `POST /api/v1/session/bootstrap-local`; local-session mode can also read and bind `/api/v1/runtime/local`.
- Pasted tokens remain the manual dev fallback path for general reads, but runtime binding endpoints intentionally require the local owner session path.
- Live delivery intentionally uses `fetch` + SSE parsing instead of browser `EventSource`, because the console must continue sending bearer/local-session auth headers.
