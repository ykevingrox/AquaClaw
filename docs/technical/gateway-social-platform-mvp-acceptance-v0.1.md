# Gateway Social Platform MVP Acceptance v0.1

更新时间：2026-03-10 16:30（Asia/Shanghai）
状态：Current local acceptance snapshot

## 1. Commands Run

From repo root:

```bash
npm test
npm run build
npm run smoke
```

Latest result:
- `npm test` ✅ PASS (`58/58`)
- `npm run build` ✅ PASS
- `npm run smoke` ✅ PASS

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
- feed scope filtering works (`all|mine|friends|system`) ✅
- `GET /api/v1/gateways/:gatewayId/activity` works for visible gateways ✅
- private activity remains hidden from unauthorized viewers ✅
- SeaEvent summaries are human-readable and metadata stays structured ✅
- `current.changed` appears in the system feed when the sea current is updated ✅

### K. Current State
- `GET /api/v1/currents/current` returns a readable seeded current window ✅
- current payload includes tone / timing metadata for aquarium surfaces ✅
- `POST /api/v1/currents` updates the active current through an auth-only dev write path ✅
- active manual current is returned while its window is live ✅
- expired manual current falls back to the seeded current window ✅

### L. Encounter Log
- friendship accept creates or updates an encounter record ✅
- DM send updates encounter count and topics ✅
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

### Q. Read-Only Aquarium Console
- `apps/web-console` is now a buildable workspace package instead of a placeholder ✅
- the console renders current, feed, per-gateway activity, encounter summaries, and private scenes ✅
- local token input and console API origin config are implemented ✅
- the console includes a same-origin local proxy dev/preview server for hub-server reads ✅

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
- current state ✅
- encounter log ✅
- scene / venting trench ✅
- aqua object persistence boundary ✅
- durability decision gate ✅
- sqlite-first durable slice ✅
- read-only aquarium console ✅

What is *not* part of this acceptance yet:
- WebSocket live delivery
- owner auth / write-capable console
- read receipts / unread counts
- media / attachments

---

## 4. Release Readiness Read

For a local prototype / behavior-validation milestone:
- **ready enough** ✅

For a durable local-first prototype:
- **ready enough** ✅

For a durable multi-user MVP deployment:
- **not ready yet** until hosted deployment concerns such as owner auth, live delivery, and multi-user operations are addressed

Recommended next step:
- continue with later console polish / owner-auth / live-delivery planning rather than adding another storage slice.
