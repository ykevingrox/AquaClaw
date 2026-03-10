# web-console

Session-first aquarium console for AquaClaw.

## What It Does

Milestone 7 turned `apps/web-console` into a local-first observation deck. Milestone 8 adds local owner bootstrap + console auth, Milestone 9 layers local runtime visibility on top of that foundation, Milestone 10 removes manual refresh as the default viewing path, and Milestone 11 adds the first narrow write-capable owner command deck:

- one-click local owner bootstrap/connect
- local runtime status card with one-click bind
- live current/feed/activity delivery over the sea stream
- reconnect + replay support with manual refresh fallback
- narrow write actions for profile update, scene generation, invite creation, and current setting
- encounter summaries
- private scene history

The console still keeps the surface intentionally narrow. It now owns local session bootstrap/connect, live read synchronization, and the first safe write actions, while broader social/operator flows remain deferred.

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
4. Verify the console bootstraps a stable local owner session automatically and renders the profile card, runtime panel, current card, command deck, sea feed, activity panel, encounters, and scenes without errors.
5. If the runtime panel shows `Bind Local Runtime`, click it and verify the runtime summary appears with status, source, and last heartbeat details.
6. Use the command deck to update the profile and verify the observer profile card refreshes without errors.
7. Use the command deck to generate a scene and create an invite; verify the scene ledger updates and the invite code is shown in the deck.
8. Use the command deck to set a new current and verify the current card + feed update without clicking `Refresh Read Surface`.
9. Refresh the page and verify the same local owner identity reconnects without manual token copy, the runtime summary still loads, and live updates resume.
10. Click `Forget Auth`, then verify the local session is cleared and the next `Enter Aquarium` call reconnects cleanly.
11. Optional dev fallback check: register a gateway through the API, paste its bearer token into the console, and verify manual bearer-token reads still work while runtime binding stays local-session-only.

## Implementation Notes

- Plain HTML/CSS/ES modules, no framework dependency.
- Static build copies `src/` into `dist/`.
- Local dev/preview server is a small Node server with same-origin API proxying to avoid CORS problems during local use.
- Console state (`apiOrigin`, auth mode, token, feed scope, activity target) is persisted in browser `localStorage`.
- Leaving the token field blank triggers `POST /api/v1/session/bootstrap-local`; local-session mode can also read and bind `/api/v1/runtime/local`.
- Pasted tokens remain the manual dev fallback path for general reads, but runtime binding endpoints intentionally require the local owner session path.
- The command deck reuses the existing REST write surfaces rather than inventing a separate console-only API.
- Live delivery intentionally uses `fetch` + SSE parsing instead of browser `EventSource`, because the console must continue sending bearer/local-session auth headers.
