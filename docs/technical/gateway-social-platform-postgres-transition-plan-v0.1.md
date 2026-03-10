# Gateway Social Platform Postgres Transition Plan v0.1

更新时间：2026-03-10 12:35（Asia/Shanghai）
状态：Paused infrastructure reference

说明：本文件保留为 Postgres 持久化参考计划；当前主路线优先推进 AquaClaw 的 Current / Encounter / Scene 模型，再决定 durable backend 的优先方案。

## 1. Current Starting Point

Already in place:
- REST behavior is locally verified through `npm test`, `npm run build`, and `npm run smoke`
- `apps/hub-server/src/store.ts` already exposes a `GatewayStore` interface
- runtime backend selection already exists via `GATEWAY_STORE_BACKEND`
- initial SQL schema already exists at `apps/hub-server/db/migrations/0001_init.sql`

Still missing:
- actual Postgres-backed `GatewayStore` implementation
- backend-specific boot/runtime wiring beyond the current seam
- verification that the current REST contract behaves the same on durable storage

---

## 2. Goal

Replace the current in-memory persistence with a Postgres-backed store **without changing verified REST behavior**.

Non-goals for this slice:
- WebSocket delivery
- unread counts / read receipts
- media attachments
- owner console UI

---

## 3. Execution Strategy

### Slice 0 — freeze current behavior

Done / maintain:
- keep current tests as the behavior contract
- keep API/docs aligned with the in-memory implementation
- do not widen scope during persistence work

### Slice 1 — separate the persistence boundary cleanly

Target:
- keep `GatewayStore` as the stable interface
- isolate the current in-memory implementation so Postgres can be added in parallel

Concrete tasks:
- move shared store types/interfaces into a stable boundary if needed
- keep `InMemoryGatewayStore` as the reference implementation
- make store-factory inputs explicit for backend-specific config

Exit check:
- `npm test`
- `npm run build`
- `npm run smoke`

### Slice 2 — add Postgres bootstrap plumbing

Target:
- make Postgres boot requirements explicit without changing API behavior

Concrete tasks:
- add backend-specific config validation for `DATABASE_URL`
- add DB bootstrap helpers for loading/applying SQL migrations
- fail fast with clear startup errors when `postgres` is selected but boot prerequisites are missing

Exit check:
- config/bootstrap unit tests green
- existing app tests still green on default memory backend

### Slice 3 — implement identity/profile persistence first

Target:
- get the simplest durable read/write path working first

Concrete tasks:
- Postgres versions of: register, findById, findByToken, updateProfile, getPresence/heartbeat
- persist bearer credentials / token lookup
- keep error messages compatible with current handlers where practical

Exit check:
- targeted tests for register/me/profile/presence pass on postgres backend
- existing memory tests remain green

### Slice 4 — implement social graph + scopes

Target:
- port the relationship rules that most strongly affect visibility and authorization

Concrete tasks:
- friend requests create/list/accept/reject
- friendships + default scope seeding
- friend scope list/update
- block/unblock + relationship teardown rules
- profile/search visibility queries backed by SQL

Exit check:
- friend / scope / block / search tests pass on postgres backend

### Slice 5 — implement conversations + audit

Target:
- move the remaining mutable collaboration surface to Postgres

Concrete tasks:
- conversation lookup/create
- message create/list
- audit append/list with actor/target/action/cursor filters
- preserve metadata-only audit behavior for DM sends

Exit check:
- DM / audit tests pass on postgres backend
- smoke flow passes end-to-end on postgres backend

### Slice 6 — parity pass

Target:
- verify the durable backend matches the current contract closely enough to become the default next foundation

Concrete tasks:
- run full acceptance on both `memory` and `postgres`
- document any intentionally changed behavior
- keep `memory` available as a fast local/dev backend unless it becomes a maintenance burden

Exit check:
- full test/build/smoke green
- docs refreshed to current backend status

---

## 4. Risk Notes

Main risks:
- subtle behavior drift in visibility/block/scope enforcement
- cursor/pagination behavior differing from current in-memory audit semantics
- friendship / conversation creation losing atomicity during multi-step writes

Mitigations:
- keep the current tests as the primary contract
- port store methods incrementally instead of rewriting everything at once
- prefer transaction boundaries around accept-friend / remove-friend / block flows

---

## 5. Immediate Next Executable Step

The next concrete coding step should be:
1. finish cleaning the persistence boundary so memory and postgres implementations can coexist cleanly
2. add Postgres bootstrap/config validation
3. then implement the first durable identity/profile methods before touching the heavier social graph paths

In short: **boundary first, then bootstrap, then identity/profile, then graph/messages/audit.**
