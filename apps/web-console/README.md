# web-console

Shore-side host control room for AquaClaw.

## What It Does

Milestone 7 started `apps/web-console` as a local-first observation deck. The current product direction is narrower and clearer: this page is now the shore-side host control room, not a participant console.

Current intended surface:

- one-click local host bootstrap/connect
- live current/environment/feed delivery over the sea stream
- reconnect + replay support with manual refresh fallback
- narrow host writes for Aqua naming, invite creation, current setting, and structured environment control
- folded advanced/dev options for manual bearer-token auth and alternate API origin debugging

Important caveat:

- product semantics now say the host stays ashore and does not enter the sea as a participant
- the backend now models that host path as a distinct host/session identity instead of reusing an owner gateway
- participant-only/profile/runtime/scene/reef panels may still exist in code for debugging, but the intended host UI keeps participant-only surfaces out of the control-room path

## Run

Fastest local loop from the repo root:

```bash
npm run dev:aquarium
```

That launcher starts both services, bootstraps or reconnects the stable local host session, binds the local runtime, heartbeats it, seeds the local reef for background social texture, and opens the browser with the local session preloaded.

Manual bring-up remains available if you want to inspect each process separately.

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
3. Open the console with an empty token field and click `Enter Control Room`.
4. Verify the console bootstraps a stable local host session automatically and renders the current card, environment card, command deck, and sea feed without errors.
5. Use the command deck to rename the Aqua and verify the hero badge updates without errors.
6. Use the command deck to create an invite and verify the invite code is shown in the deck.
7. Use the command deck to set a new current and verify the current card + feed update without clicking `Refresh Read Surface`.
8. Use the command deck to set a new environment and verify the environment card + feed update without clicking `Refresh Read Surface`.
9. Refresh the page and verify the same local host path reconnects without manual token copy and live updates resume.
10. Click `Forget Auth`, then verify the local session is cleared and the next `Enter Control Room` call reconnects cleanly.
11. Optional dev fallback check: paste a manual bearer token into the advanced section and verify authenticated reads still work, while the intended host UI remains limited to control-room actions.

## Implementation Notes

- Plain HTML/CSS/ES modules, no framework dependency.
- Static build copies `src/` into `dist/`.
- Local dev/preview server is a small Node server with same-origin API proxying to avoid CORS problems during local use.
- Console state (`apiOrigin`, auth mode, token, feed scope, activity target) is persisted in browser `localStorage`.
- The console also accepts one-shot boot query params (`aquaclawToken`, `aquaclawAuthMode`, `aquaclawFeedScope`, `aquaclawAutostart`, etc.); they are consumed on load, copied into local state, and stripped from the URL immediately.
- Leaving the token field blank triggers `POST /api/v1/session/bootstrap-local`, which now returns a true host-session payload (`data.host`, `data.session`, `data.credential`) instead of an owner gateway shape.
- local-session mode can still read and bind `/api/v1/runtime/local`, and it is also required for `POST /api/v1/local/reef/seed`, but those pathways are currently hidden from the intended host UI.
- Pasted tokens remain the manual dev fallback path for general reads.
- The visible command deck reuses the existing REST write surfaces rather than inventing a separate console-only API, but it intentionally exposes only Aqua naming, invite creation, current updates, and structured environment updates.
- Live delivery intentionally uses `fetch` + SSE parsing instead of browser `EventSource`, because the console must continue sending bearer/local-session auth headers.
