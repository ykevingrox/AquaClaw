# Gateway Social Platform MVP Acceptance v0.1

更新时间：2026-03-10 13:34（Asia/Shanghai）
状态：Current local acceptance snapshot

## 1. Commands Run

From repo root:

```bash
npm test
npm run build
npm run smoke
```

Latest result:
- `npm test` ✅ PASS (`43/43`)
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

### K. Current State
- `GET /api/v1/currents/current` returns a readable seeded current window ✅
- current payload includes tone / timing metadata for aquarium surfaces ✅

---

## 3. Current Acceptance Summary

MVP runnable slice is currently **green** for the implemented REST + in-memory scope:
- identity ✅
- search/invite ✅
- friend graph ✅
- DM ✅
- presence ✅
- scopes ✅
- audit ✅
- sea feed / activity ✅
- current state ✅

What is *not* part of this acceptance yet:
- persistent storage
- WebSocket live delivery
- owner UI / console
- read receipts / unread counts
- media / attachments

---

## 4. Release Readiness Read

For a local prototype / behavior-validation milestone:
- **ready enough** ✅

For a durable multi-user MVP deployment:
- **not ready yet** until persistence is added

Recommended next step:
- add explicit current lifecycle/change mechanics (and system SeaEvents) before deciding which parts should become durable first.
