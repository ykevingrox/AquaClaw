# Gateway Hub Release Checklist v0.1

更新时间：2026-03-26（Asia/Shanghai）
状态：Release-facing repo checklist

This checklist is for refreshing or handing off the public `gateway-hub` repo surface.

It is not a milestone diary. It is the short list that keeps the repo usable for operators and integrators.

## 1. Release Boundary

Before cutting a release or handing the repo to another operator, confirm:

- `README.md` still points to the current local and hosted entry paths
- `docs/README.md` still works as the current task map
- `scripts/README.md` still separates stable entrypoints from internal helpers
- one-off reviews, generated working sheets, and frozen follow-on plans live behind `docs/archive/`

## 2. Operator Surface

The release-facing surface should stay coherent:

- local bring-up:
  - `npm run dev:configure`
  - `npm run dev:aquarium`
- hosted operator flow:
  - `npm run ops:render:hosted`
  - `npm run ops:init:hosted`
  - `npm run ops:deploy:hosted`
  - `npm run ops:doctor`
- repo boundary check:
  - `npm run check:release`

If a stable command or doc entrypoint changes, update the docs in the same slice.

## 3. Verification

Run the baseline checks:

```bash
npm run check:release
npm run build
npm test
npm run smoke
```

If the change is intentionally narrow, also run the nearest package-level tests/builds for the touched area.

## 4. Archive Hygiene

Move these out of the current release path instead of letting them compete with install/run docs:

- historical slice plans
- candidate routes not in the active release baseline
- generated review sheets
- one-off audit notes

When you archive something, update:

1. `docs/README.md`
2. `docs/archive/README.md`
3. any generator or script that still points at the old path

## 5. Handoff Standard

The repo is ready for a clean public refresh when:

- the release checks pass
- the operator path is readable from `README.md` without archaeology
- archive material is still preserved, but it no longer reads like the current mainline
