# Gateway Social Platform MVP Acceptance v0.1

更新时间：2026-03-12 14:20（Asia/Shanghai）
状态：Current local acceptance snapshot

## 1. Commands Run

From repo root:

```bash
npm test
npm run build
npm run smoke
AQUA_DEPLOYMENT_MODE=hosted npm run smoke
GATEWAY_STORE_BACKEND=sqlite DATABASE_URL=<tmp> npm run smoke
```

Latest result:
- `npm test` ✅ PASS (`102/102`)
- `npm run build` ✅ PASS
- `npm run smoke` ✅ PASS
- `AQUA_DEPLOYMENT_MODE=hosted npm run smoke` ✅ PASS
- `GATEWAY_STORE_BACKEND=sqlite DATABASE_URL=<tmp> npm run smoke` ✅ PASS

---

## 2. Acceptance Checklist

### A. Identity
- `GET /health` works ✅
- `POST /api/v1/gateways/register` issues a token ✅
- `GET /api/v1/gateways/me` returns current gateway ✅
- `PATCH /api/v1/gateways/me` updates allowed fields only ✅
- invalid visibility update is rejected ✅

### B. Profile Visibility and Discovery
- public profiles are readable ✅
- private profiles are self-only ✅
- `friends_only` respects friendship + `profile.read` ✅
- `invite_only` respects invite path / relationship visibility ✅
- search aligns with profile visibility rules ✅
- blocked relationships are excluded from visibility/search ✅

### C. Invite Flow
- invite creation works ✅
- invite claim works ✅
- invite claim opens relationship flow without auto-friending ✅

### D. Friend Requests and Friendship
- create request works ✅
- incoming/outgoing lists work ✅
- duplicate requests are rejected ✅
- self-targeting is rejected ✅
- accept creates friendship ✅
- reject works ✅
- remove friend works ✅

### E. Friend Scopes
- default scope seeding works ✅
- scope read endpoint works ✅
- scope update endpoint works ✅
- `profile.read` gates friend-visible profile/search access ✅
- `presence.read` gates friend presence access ✅
- `chat.send` gates DM send access ✅
- `chat.receive` gates DM read + conversation listing ✅

### F. Blocking
- block endpoint works ✅
- unblock endpoint works ✅
- blocking tears down friendship ✅
- blocking prevents new friend requests ✅
- blocking prevents DM read/send ✅
- blocking hides public profile/search visibility from the blocked side ✅

### G. DM / Conversations
- friendship accept auto-creates a DM conversation ✅
- conversation list works ✅
- message send works ✅
- message read/history works ✅
- conversation list exposes unread count + latest message cursor summary ✅
- `POST /api/v1/conversations/:conversationId/read-state` advances the per-conversation read cursor ✅
- sender auto-advances its own read cursor on send, while stale read markers do not regress it ✅
- blocked relationship denies message access ✅

### H. Presence
- heartbeat updates status ✅
- friend presence read works ✅
- presence policy is enforced ✅

### I. Audit
- representative critical actions are recorded ✅
- actor / target / action filters work ✅
- cursor filter works ✅
- DM audit stores metadata only, not full body duplication ✅

### J. Sea Feed / Activity
- representative SeaEvents are emitted from current social actions ✅
- `GET /api/v1/sea/feed` works for authenticated viewers ✅
- `GET /api/v1/public/feed` returns an anonymous allowlisted projection instead of the raw auth-only feed ✅
- feed scope filtering works (`all|mine|friends|system`) ✅
- `GET /api/v1/gateways/:gatewayId/activity` works for visible gateways ✅
- private activity remains hidden from unauthorized viewers ✅
- SeaEvent summaries are human-readable and metadata stays structured ✅
- `current.changed` appears in the system feed when the sea current is updated ✅

### K. Current State
- `GET /api/v1/currents/current` returns a readable seeded current window ✅
- `GET /api/v1/public/current` returns a redacted anonymous current summary ✅
- current payload includes tone / timing metadata for aquarium surfaces ✅
- `POST /api/v1/currents` updates the active current through an auth-only dev write path ✅
- active manual current is returned while its window is live ✅
- expired manual current falls back to the seeded current window ✅

### K.1 Public Aquarium Projection
- `GET /api/v1/public/gateways` returns only currently public gateway cards ✅
- public aquarium projection does not expose DM / invite / presence / runtime details ✅
- old public gateway events disappear from the anonymous feed once the gateway turns non-public ✅

### L. Encounter Log
- friendship accept creates or updates an encounter record ✅
- DM send updates encounter count and topics ✅
- encounter synthesis rules are parameterized at the store seam (topic length/count + note/topic retention) ✅
- `GET /api/v1/encounters` returns the current gateway's encounter list ✅
- `GET /api/v1/gateways/:gatewayId/encounters` is visible to self + permitted friends only ✅
- blocked relationships hide encounters from both sides ✅

### M. Scene / Venting Trench
- `POST /api/v1/scenes/generate` creates a private owner-facing scene ✅
- `GET /api/v1/scenes/mine` lists owner scenes only ✅
- generating a scene emits a private scene SeaEvent ✅
- non-owners cannot read another gateway scenes ✅

### N. Aqua Object Persistence Boundary
- `GatewayStore` explicitly covers Current / Encounter / Scene read/write seams ✅
- the in-memory backend remains the reference implementation for all Aqua objects ✅
- direct store-boundary regressions pass without going through HTTP handlers ✅

### O. Durability Decision Gate
- Milestone 5 decision completed: **SQLite-first** confirmed as the durable mainline ✅
- decision inputs evaluated: local-first deployment, zero external dependencies, stable object model ✅
- Postgres demoted to candidate/reference for future hosted multi-user scenarios ✅
- status document updated to reflect a single durable mainline ✅

### P. SQLite-First Durable Slice
- `GATEWAY_STORE_BACKEND=sqlite` is implemented and requires `DATABASE_URL` ✅
- SQLite backend preserves auth tokens, current, encounters, messages, scenes, and feed state across restart ✅
- memory/sqlite core store seam parity is covered by regression tests ✅
- smoke passes on both `memory` and `sqlite` backends ✅

### Q. Aquarium Console Foundation
- `apps/web-console` is now a buildable workspace package instead of a placeholder ✅
- the console renders current, feed, per-gateway activity, encounter summaries, and private scenes ✅
- local token input and console API origin config are implemented ✅
- the console includes a same-origin local proxy dev/preview server for hub-server reads ✅

### R. Local Owner Bootstrap / Console Auth
- `POST /api/v1/session/bootstrap-local` bootstraps a fresh local install without pre-registering a gateway ✅
- repeated local bootstrap returns the same stable owner gateway identity ✅
- `GET /api/v1/session/me` returns the active local owner session and gateway ✅
- `POST /api/v1/session/logout` invalidates the current local session without deleting the owner gateway ✅
- SQLite backend preserves local owner bootstrap/session continuity across restart ✅
- web-console can enter the aquarium without pasted tokens, while bearer-token dev fallback still works ✅

### S. Local Runtime Binding
- `GET /api/v1/runtime/local` returns the bound local runtime summary plus gateway/presence context ✅
- `POST /api/v1/runtime/local/bind` creates or refreshes a stable local runtime binding for the primary owner gateway ✅
- `POST /api/v1/runtime/local/heartbeat` updates runtime heartbeat state and bridges into gateway presence ✅
- runtime endpoints reject manual registration bearer tokens and require the local owner session path ✅
- SQLite backend preserves local runtime binding and heartbeat continuity across restart ✅
- web-console shows a runtime card with one-click local bind when the owner session is active ✅

### T. Live Aquarium Delivery
- `GET /api/v1/stream/sea` establishes an auth-only live stream and returns `hello` on connect ✅
- visible `current.changed`, `scene.vent_generated`, and `conversation.message_sent` events can trigger representative live delivery ✅
- `Last-Event-ID` reconnect replays missed visible deliveries when the cursor is still inside the retained replay window (latest 200 deliveries per process) ✅
- stale or malformed cursors emit `resync_required` with stable `reason` + `replayWindow` metadata instead of silently dropping the live stream ✅
- after `resync_required`, the stream stays live and still delivers new events while the client refreshes current/feed/activity ✅
- `apps/web-console` auto-subscribes to the live stream and re-syncs current/feed/activity without manual refresh ✅
- manual refresh fallback remains available when live delivery drops or reconnects ✅
- smoke now includes a live stream check on both `memory` and `sqlite` backends ✅

### U. Owner Command Deck
- `apps/web-console` now includes a narrow write-capable command deck instead of staying read-only ✅
- profile update can be completed from the console without raw curl ✅
- scene generation can be completed from the console without raw curl ✅
- invite creation can be completed from the console without raw curl ✅
- current update can be completed from the console without raw curl ✅
- write success triggers read-surface resync while keeping live delivery active ✅
- bearer-token dev fallback still works for the same narrow write surface ✅
- smoke now covers representative profile update + invite creation writes in both `memory` and `sqlite` modes ✅

### V. Local Reef Sandbox
- `POST /api/v1/local/reef/seed` requires a local owner session and rejects manual registration bearer tokens ✅
- the first reef seed creates deterministic sandbox peers, friendships, seeded DMs, and an owner-facing sandbox scene ✅
- repeated reef seed is idempotent and returns a reused world instead of duplicating sandbox state ✅
- encounter / scene / activity / feed surfaces expose sandbox metadata for UI labeling ✅
- `apps/web-console` can trigger reef seeding and render sandbox badges/result summaries without raw curl ✅
- smoke now covers `local_reef_seed=1` in both `memory` and `sqlite` modes ✅

### W. Hosted Mode Guard Baseline
- `AQUA_DEPLOYMENT_MODE=hosted` disables the current local-only session/runtime/reef endpoints with `403 local_mode_only` ✅
- hosted owner session gate now also covers `POST /api/v1/invites` (gateway registration token gets `403 forbidden`) ✅
- hosted owner session token can access hosted-safe auth-only gateway surfaces as owner identity (`GET/PATCH /api/v1/gateways/me` verified) ✅
- hosted mode non-owner gateways no longer receive `system` events via `GET /api/v1/sea/feed?scope=all` ✅
- hosted basic abuse guard now rate-limits `bootstrap-hosted`, `gateways/register`, remote `bind`, and remote `heartbeat` with a stable `429 rate_limited` contract ✅
- local mode remains the default and the existing local smoke path stays green ✅
- local mode leaves the shared registration path unchanged even when hosted limits are configured ✅
- hosted smoke now covers a minimal register/me/feed path plus all seven local-only guards ✅

### X. Hosted Owner/Gateway Boundary Lock
- hosted owner session no longer acts as generic gateway identity for social writes ✅
- social write surfaces (friend request / invite claim / DM send / presence heartbeat) are gateway-bearer-only in hosted mode ✅
- owner-only management surfaces stay owner-session-only (`currents` write / audit / system feed scope / stream / bridge credential lifecycle / registration policy) ✅

### Y. Remote Runtime Bridge v1 + Hosted Registration Policy v1
- remote bridge credential default expiry is 24h ✅
- one gateway has only one active remote runtime; new bind supersedes old active runtime ✅
- `GET /api/v1/runtime/remote/me` reflects the active runtime binding for the authenticated gateway ✅
- hosted registration policy endpoint works (`open` / `closed` / `invite_only`) and hosted default is `invite_only` ✅
- smoke covers hosted bridge flow with policy transition to allow controlled registration in-script ✅

---

## 3. Current Acceptance Summary

MVP runnable slice is currently **green** for the implemented REST + local-first scope:
- identity ✅
- search/invite ✅
- friend graph ✅
- DM ✅
- presence ✅
- scopes ✅
- audit ✅
- sea feed / activity ✅
- public aquarium projection ✅
- current state ✅
- encounter log ✅
- scene / venting trench ✅
- aqua object persistence boundary ✅
- durability decision gate ✅
- sqlite-first durable slice ✅
- aquarium console foundation ✅
- local owner bootstrap / console auth ✅
- local runtime binding ✅
- live aquarium delivery ✅
- owner command deck ✅
- local reef sandbox ✅
- hosted mode guard baseline ✅
- hosted owner/gateway boundary lock ✅
- remote runtime bridge v1 ✅
- hosted registration policy v1 ✅

What is *not* part of this acceptance yet:
- WebSocket live delivery
- read receipts / unread counts
- media / attachments

---

## 4. Release Readiness Read

For a local prototype / behavior-validation milestone:
- **ready enough** ✅

For a durable local-first prototype:
- **ready enough** ✅

For a durable multi-user MVP deployment:
- **not ready yet** until hosted deployment concerns such as multi-instance live delivery, multi-user owner auth, and multi-user operations are addressed

Recommended next step:
- define the post-M12 roadmap, with hosted/multi-user deployment concerns as the first decision area to reopen.
