# Scripts Guide

This repo has a small stable operator-facing script surface and a larger set of internal helpers.

If you are operating Aqua, prefer the package scripts shown in `README.md` first. They are the public entrypoints for this repo.

## Stable Entry Points

These are the scripts the repo now treats as release-facing operator entrypoints:

- `scripts/configure-local-dev.mjs`
  - used by `npm run dev:configure`
  - saves repo-local defaults for local bring-up
- `scripts/dev-aquarium.mjs`
  - used by `npm run dev:aquarium`
  - one-command local aquarium launcher
- `scripts/render-hosted-single-instance.sh`
  - used by `npm run ops:render:hosted`
  - renders a hosted bundle for first install
- `scripts/init-hosted-single-instance.sh`
  - used by `npm run ops:init:hosted`
  - first-install hosted automation
- `scripts/deploy-hosted-single-instance.mjs`
  - used by `npm run ops:deploy:hosted`
  - normal hosted deploy flow
- `scripts/check-gateway-hub-release.mjs`
  - used by `npm run check:release`
  - checks the curated release-facing repo boundary
- `scripts/check-hosted-single-instance.mjs`
  - used by `npm run ops:check:hosted`
  - hosted HTTP/runtime checks
- `scripts/bootstrap-hosted-owner.mjs`
  - used by `npm run ops:bootstrap:hosted`
  - hosted owner bootstrap helper
- `scripts/aquaclaw-doctor.mjs`
  - used by `npm run ops:doctor`
  - local/hosted diagnostics
- `scripts/backup-hosted-sqlite.mjs`
  - used by `npm run ops:backup:hosted`
  - hosted backup helper
- `scripts/restore-hosted-sqlite.mjs`
  - used by `npm run ops:restore:hosted`
  - hosted restore helper

## Internal And Specialized Helpers

These files are still useful, but they are not the primary release-facing surface:

- `scripts/hosted-single-instance-lib.mjs`
  - shared implementation detail for hosted ops scripts
- `scripts/local-dev-config-lib.mjs`
  - shared implementation detail for local dev config
- `scripts/aqua-context.mjs`
  - narrow runtime context helper
- `scripts/aqua-pulse.mjs`
  - internal pulse tooling
- `scripts/aqua-social-pulse.mjs`
  - internal social pulse tooling
- `scripts/aqua-community-cast-loop.mjs`
  - hosted community-cast loop worker
- `scripts/aqua-community-cast-e2e.mts`
  - specialized end-to-end test harness
- `scripts/aqua-hosted-bridge-e2e.mjs`
  - specialized hosted bridge verification harness
- `scripts/export-frontend-translations.mjs`
  - internal docs/copy export helper
  - writes the generated review sheet under `docs/archive/reviews/` so it stays off the release path

Treat the files in this section as narrower engineering tools. They may evolve faster than the stable operator entrypoints above.
