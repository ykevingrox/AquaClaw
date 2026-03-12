# web-console

Session-first aquarium console for AquaClaw.

## What It Does

Milestone 7 turned `apps/web-console` into a local-first observation deck. Milestone 8 adds local owner bootstrap + console auth, Milestone 9 layers local runtime visibility on top of that foundation, Milestone 10 removes manual refresh as the default viewing path, Milestone 11 adds the first narrow write-capable owner command deck, and Milestone 12 adds local reef seeding plus sandbox labeling:

- one-click local owner bootstrap/connect
- local runtime status card with one-click bind
- live current/feed/activity delivery over the sea stream
- reconnect + replay support with manual refresh fallback
- narrow write actions for profile update, scene generation, invite creation, local reef seeding, and current setting
- structured environment control for water temperature, clarity, tide, surface state, and a limited phenomenon template
- encounter summaries with sandbox badges
- private scene history with sandbox badges

The console still keeps the surface intentionally narrow. It now owns local session bootstrap/connect, live read synchronization, safe owner write actions, and deterministic sandbox reef seeding, while broader social/operator flows remain deferred.

## Run

Fastest local loop from the repo root:

```bash
npm run dev:aquarium
```

That launcher starts both services, bootstraps or reconnects the stable local owner session, binds the local runtime, heartbeats it so the runtime card shows as alive, seeds the local reef, and opens the browser with the local session preloaded.

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
3. Open the console with an empty token field and click `Enter Aquarium`.
4. Verify the console bootstraps a stable local owner session automatically and renders the profile card, current card, environment card, runtime panel, command deck, sea feed, activity panel, encounters, and scenes without errors.
5. If the runtime panel shows `Bind Local Runtime`, click it and verify the runtime summary appears with status, source, and last heartbeat details.
6. Use the command deck to update the profile and verify the observer profile card refreshes without errors.
7. Use the command deck to generate a scene and create an invite; verify the scene ledger updates and the invite code is shown in the deck.
8. Use the reef control in the command deck and verify the result card shows the deterministic sandbox summary.
9. Confirm the feed, activity, encounters, and scene list now show sandbox badges for reef-seeded data without clicking `Refresh Read Surface`.
10. Use the command deck to set a new current and verify the current card + feed update without clicking `Refresh Read Surface`.
11. Use the command deck to set a new environment and verify the environment card + feed update without clicking `Refresh Read Surface`.
12. Refresh the page and verify the same local owner identity reconnects without manual token copy, the runtime summary still loads, and live updates resume.
13. Click `Forget Auth`, then verify the local session is cleared and the next `Enter Aquarium` call reconnects cleanly.
14. Optional dev fallback check: register a gateway through the API, paste its bearer token into the console, and verify manual bearer-token reads still work while runtime binding and reef seeding stay local-session-only.

## Implementation Notes

- Plain HTML/CSS/ES modules, no framework dependency.
- Static build copies `src/` into `dist/`.
- Local dev/preview server is a small Node server with same-origin API proxying to avoid CORS problems during local use.
- Console state (`apiOrigin`, auth mode, token, feed scope, activity target) is persisted in browser `localStorage`.
- The console also accepts one-shot boot query params (`aquaclawToken`, `aquaclawAuthMode`, `aquaclawFeedScope`, `aquaclawAutostart`, etc.); they are consumed on load, copied into local state, and stripped from the URL immediately.
- Leaving the token field blank triggers `POST /api/v1/session/bootstrap-local`; local-session mode can also read and bind `/api/v1/runtime/local`.
- local-session mode is also required for `POST /api/v1/local/reef/seed`.
- Pasted tokens remain the manual dev fallback path for general reads, but runtime binding endpoints intentionally require the local owner session path.
- The command deck reuses the existing REST write surfaces rather than inventing a separate console-only API, including the local reef seed endpoint and the structured environment write path.
- Live delivery intentionally uses `fetch` + SSE parsing instead of browser `EventSource`, because the console must continue sending bearer/local-session auth headers.
