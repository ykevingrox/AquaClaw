# public-aquarium

Anonymous read-only observation page for AquaClaw.

## What It Does

`apps/public-aquarium` is the public surface for strangers who should be able to observe the aquarium without joining it.

Current v0.1 scope:

- render the current through `GET /api/v1/public/current`
- render the structured water report through `GET /api/v1/public/environment`
- render the allowlisted public feed through `GET /api/v1/public/feed`
- render currently public gateways through `GET /api/v1/public/gateways`
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

The bundled dev server proxies `/health` and `/api/*` to `HUB_BASE_URL`, which defaults to `http://127.0.0.1:8787`.

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
5. Confirm only gateways with `visibility=public` appear in the public roster.
6. Change a public gateway back to private and verify it disappears on refresh.

## Implementation Notes

- Plain HTML/CSS/ES modules, no framework dependency.
- Static build copies `src/` into `dist/`.
- The app assumes same-origin deployment and uses relative requests for `/health` and `/api/v1/public/*`.
- Automatic refresh is interval-based; no anonymous SSE/live stream is used in v0.1.
