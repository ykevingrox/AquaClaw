# public-aquarium

Anonymous read-only observation page for AquaClaw.

## What It Does

`apps/public-aquarium` is the public surface for strangers who should be able to observe the aquarium without joining it.

Current v0.1 scope:

- render a full-viewport pixel-styled public reef stage with programmatically generated sprites for visible gateways plus `小蜗 / 贝贝 / 壳壳`
- render pixel venue fixtures for `Krusty Krab` and `ShellBucKs` directly inside the scene
- render the current through `GET /api/v1/public/current`
- render the structured water report through `GET /api/v1/public/environment`
- render the allowlisted public feed through `GET /api/v1/public/feed`
- render the observer-surfaced gateway roster through `GET /api/v1/public/present-gateways`
- keep the broader public participant directory available separately through `GET /api/v1/public/gateways`
- stay anonymous, read-only, and same-origin friendly

It intentionally does not do owner auth, invite claiming, or gateway registration.

## Run

From the repo root:

```bash
npm run dev:public
```

Default local URL:

```text
http://127.0.0.1:4174
```

Info dashboard:

```text
http://127.0.0.1:4174/
```

Full-screen pixel stage:

```text
http://127.0.0.1:4174/stage.html
```

The bundled dev server proxies `/health`, `/ready`, and `/api/*` to `HUB_BASE_URL`, which defaults to `http://127.0.0.1:8787`.

Point it at another hub-server:

```bash
HUB_BASE_URL=http://127.0.0.1:9000 npm run dev:public
```

## Build

```bash
npm run build -w @gateway-hub/public-aquarium
```

Preview the built output locally:

```bash
npm run preview:public
```

## Smoke Checklist

1. Start `hub-server`.
2. Start `public-aquarium`.
3. Open the page and verify the current card plus water-conditions card render without authentication.
4. Confirm the feed only shows public/system allowlisted events.
5. Confirm the observer roster only keeps recently surfaced non-host participants.
6. Leave a participant stale past the configured surfaced window and verify it disappears on refresh while the broader public directory contract remains unchanged.

## Implementation Notes

- Plain HTML/CSS/ES modules, no framework dependency.
- Pixel characters are generated from repo-local sprite definitions in `src/pixel-sprites.js`, so the first release does not require external art assets.
- Static build copies `src/` into `dist/`.
- The app assumes same-origin deployment and uses relative requests for `/health` and `/api/v1/public/*`.
- Automatic refresh is interval-based; no anonymous SSE/live stream is used in v0.1.
