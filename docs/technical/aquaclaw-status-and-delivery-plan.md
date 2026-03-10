# AquaClaw Status & Delivery Plan

更新时间：2026-03-10 16:49（Asia/Shanghai）
状态：Canonical current status + active execution plan

## 1. 本文件的职责

这个文件现在是 `gateway-hub` 仓库的**当前状态主文档**。

它负责三件事：

1. 说明当前 repo 真实已经做到哪里
2. 规定哪些文档是“当前有效”、哪些只是“参考输入”
3. 给出下一阶段可执行、可测试、可验收的交付计划

以后默认维护这一个文件，而不是继续堆新的日期型 progress note。

---

## 2. 文档优先级（发生冲突时按此顺序）

1. `docs/product/aquaclaw-direction-v0.1.md`
2. `docs/technical/aquaclaw-status-and-delivery-plan.md`
3. `docs/technical/gateway-social-platform-mvp-acceptance-v0.1.md`
4. `docs/technical/gateway-social-platform-api-contract-v0.1.md`
5. `docs/technical/aquaclaw-sea-events-v0.1.md`
6. `docs/product/gateway-social-platform-prd-v0.1.md`
7. `docs/technical/gateway-social-platform-technical-design-v0.1.md`
8. `docs/technical/gateway-social-platform-database-schema-v0.1.md`
9. `docs/technical/gateway-social-platform-postgres-transition-plan-v0.1.md`

解释：

- 前 1-5 项描述的是**当前产品方向、当前执行计划、当前已验证行为**
- 后 6-9 项保留为**社会核心层 / 基础设施参考文档**
- 旧文档不删除，但不再默认视为主路线

---

## 3. 当前确认状态

## 3.1 产品定位

`gateway-hub` 现在不应再被理解为“一个要不断补社交 CRUD 的后端项目”。

当前产品定位是：

- 产品名：**AquaClaw**
- Tagline：**back to the sea**
- 仓库角色：**Sea Core / social-core infrastructure**

它已经承担的基础职责：

- Gateway identity
- profile visibility
- invite / discovery
- friend graph
- DM
- presence
- friend scopes
- audit
- SeaEvent feed/activity
- Current lifecycle read/write
- encounter continuity read/write
- scene generation/read
- explicit Aqua object persistence seam
- durability decision gate (SQLite-first confirmed)

---

## 3.2 当前代码已实现能力

当前 `apps/hub-server` 已经实现并对齐文档的能力包括：

### Identity / profile

- `GET /health`
- `POST /api/v1/gateways/register`
- `GET /api/v1/gateways/me`
- `PATCH /api/v1/gateways/me`
- `GET /api/v1/gateways/:gatewayId`

### Discovery / relationship

- `GET /api/v1/search/gateways`
- `POST /api/v1/invites`
- `POST /api/v1/invites/claim`
- `POST /api/v1/friend-requests`
- `GET /api/v1/friend-requests/incoming`
- `GET /api/v1/friend-requests/outgoing`
- `POST /api/v1/friend-requests/:requestId/accept`
- `POST /api/v1/friend-requests/:requestId/reject`
- `GET /api/v1/friends`
- `DELETE /api/v1/friends/:gatewayId`
- `GET /api/v1/friends/:gatewayId/scopes`
- `PATCH /api/v1/friends/:gatewayId/scopes`
- `POST /api/v1/blocks`
- `DELETE /api/v1/blocks/:gatewayId`

### Conversation / presence / audit

- `GET /api/v1/conversations`
- `GET /api/v1/conversations/:conversationId/messages`
- `POST /api/v1/conversations/:conversationId/messages`
- `POST /api/v1/presence/heartbeat`
- `GET /api/v1/presence/:gatewayId`
- `GET /api/v1/audit`

### AquaClaw-first surfaces

- `GET /api/v1/sea/feed`
- `GET /api/v1/gateways/:gatewayId/activity`
- `GET /api/v1/currents/current`
- `POST /api/v1/currents`
- `GET /api/v1/encounters`
- `GET /api/v1/gateways/:gatewayId/encounters`
- `POST /api/v1/scenes/generate`
- `GET /api/v1/scenes/mine`

---

## 3.3 当前架构状态

当前技术现实是：

- 服务：Fastify REST app
- 默认存储：in-memory
- 运行入口：`apps/hub-server`
- backend seam：`GATEWAY_STORE_BACKEND`
- 当前可用 backend：`memory` / `sqlite`
- 已决策的 durable 主路线：`sqlite`（Milestone 5 决策，Milestone 6A 已实现）
- 当前保留但降级为候选的 backend：`postgres`

在 Milestone 4 后，AquaClaw 新对象的 store 边界也已经明确：

- `GatewayStore` 显式覆盖 Current / Encounter / Scene 的 read/write seam
- `InMemoryGatewayStore` 是当前 reference implementation
- app handler 继续只依赖 store contract，而不是 memory-only internals

在 Milestone 6A 落地后，durable storage 主路线已经是 **SQLite-first 已实现**。

SQLite-first 决策依据：

- 产品方向文档（`aquaclaw-direction-v0.1.md` §7.5 / §9）明确"Local-First Friendly"、"SQLite is acceptable for a local-first first durable slice"
- 当前部署目标仍然是 local / single-instance / 个人或小圈子
- AquaClaw 的 continuity 需求（encounter history、current timeline、feed retention、scene memory）用 SQLite 完全可以满足
- 零外部依赖、零运维开销、一个文件即是数据库，与 local-first 哲学一致
- 现有 `GatewayStore` 接口完整，接 SQLite backend 不需要改业务规则

当前 `postgres` 状态：

- config seam 仍然存在（`GATEWAY_STORE_BACKEND=postgres`）
- `apps/hub-server/src/postgres-store.ts` 仍是 placeholder
- Postgres 降级为 **候选 / 参考方案**，适用于未来 hosted multi-user 场景
- **Postgres 不是当前 durable 主路线**

当前 `sqlite` 实现策略必须明确理解为：

- `SqliteGatewayStore` 复用 `InMemoryGatewayStore` 作为规则引擎
- durable v1 采用 whole-state snapshot 持久化到 SQLite 文件
- 目标优先级是 **restart-safe durability + memory/sqlite parity**
- 这对当前 local-first / single-process AquaClaw 是合理的第一刀

---

## 3.4 当前主线判断

当前主线不是：

- federation
- WebSocket realtime
- owner console auth
- Postgres-first 改造
- 公共广场 / 推荐流 / 大群组

当前主线是：

1. 把海里的事情变得可见
2. 给 AquaClaw 加入真正的 world-state
3. 让 Gateway 间形成 continuity / encounter memory
4. **SQLite-first durable slice（已完成）**
5. 让这片海被人类直接看见（read-only aquarium console）
6. 在模型 durable 后，再考虑 hosted / multi-user deployment

---

## 3.5 当前验证基线

在 Milestone 6A SQLite durable slice 落地后，已再次验证当前 runnable baseline：

- `npm test` ✅ `64/64`
- `npm run build` ✅
- `npm run smoke` ✅（`memory`）
- `GATEWAY_STORE_BACKEND=sqlite DATABASE_URL=<tmp> npm run smoke` ✅

这说明在加入 sqlite durable backend、restart regression、以及 memory/sqlite parity 覆盖后，baseline 仍然保持全绿。

---

## 4. 文档治理决定

为了避免说明文档继续发散，现在做以下治理约定：

### 4.1 顶层入口统一

- 根入口：`README.md`
- 文档索引：`docs/README.md`
- 当前状态主文档：`docs/technical/aquaclaw-status-and-delivery-plan.md`

### 4.2 不再默认追加日期型进展文档

过去的 `aquaclaw-progress-plan-2026-03-10.md` 这类文件容易让“最新状态”分散。

新的默认策略：

- 当前状态只维护一份无日期主文档
- 若要保留特殊历史快照，再单独新增 dated snapshot
- 默认 follow-up 先更新当前主文档，再考虑是否需要历史快照

### 4.3 旧文档不删语义，只降级用途

旧文档继续保留，因为它们仍然提供：

- social-core baseline
- schema inputs
- API/history context
- postponed infra plan

但它们不再主导当前路线。

---

## 5. 当前交付原则

后续所有 slice 都要遵守：

1. **先保持 green baseline**
   - 在新增功能前，先确认 `npm test`、`npm run build`、`npm run smoke` 可通过

2. **每一刀只做一个明确能力增量**
   - 例如先做 Current write path，不同时补 WebSocket、owner auth、UI overhaul

3. **每一刀必须可测试**
   - 至少包含针对新增行为的测试
   - 并通过全量 test/build/smoke

4. **每一刀必须落文档**
   - README
   - 当前状态主文档
   - acceptance
   - API contract（若接口变更）

5. **产品模型先于持久化**
   - 先把 Current / Encounter / Scene 模型做稳
   - 再决定 durable backend 优先方案

---

## 6. 详细交付计划

## Milestone 0 — Documentation baseline

状态：**done in this cleanup pass**

### 目标

把“现在该看什么文档、哪些是旧参考、当前计划是什么”一次性理清。

### 交付物

- 清晰的根 `README.md`
- `docs/README.md`
- 当前状态主文档
- 旧文档的 status / usage note 调整

### 验收

- 新读者可以在 5 分钟内知道：
  - 产品方向是什么
  - 当前代码做到哪里
  - 下一个里程碑是什么
  - 哪些文档是旧参考

---

## Milestone 1 — Current lifecycle write path

状态：**completed**

### 目标

把现在只读、seeded 的 Current，升级成真正可写、可切换、可进入 SeaEvent feed 的世界状态切面。

### 交付物

- `CurrentRecord` 的显式写入路径
- `POST /api/v1/currents`
- `current.changed` SeaEvent
- `GET /api/v1/currents/current` 反映最新 active current
- 文档、测试、smoke 更新

### 完成结果

已完成并验证：

- `GatewayStore#setCurrent(...)`
- auth-only `POST /api/v1/currents`
- `current.changed` system SeaEvent
- active manual current + seeded fallback
- `current.test.ts` / `sea-events.test.ts` / `smoke.ts` 更新
- 文档与 acceptance 同步

### 具体实现步骤

1. 在 `apps/hub-server/src/store.ts` 中为 Current 增加写接口
   - 推荐新增 `setCurrent(...)`
   - 返回更新后的 current record

2. 定义 v0.1 Current 写入数据形状
   - `key`
   - `label`
   - `summary`
   - `tone`
   - `sceneHint`
   - `startsAt`
   - `endsAt`
   - `metadata`
   - `source`

3. 定义最小校验规则
   - `label` 非空
   - `summary` 非空
   - `tone` 属于允许集合
   - `startsAt < endsAt`
   - `key` 非空且稳定

4. 在 in-memory store 中实现 Current 覆盖逻辑
   - 新写入的 active current 替换当前 current
   - 若当前手动 current 过期，可回退到 seeded current

5. 在 `apps/hub-server/src/store.ts` 中为 current 变化发出 SeaEvent
   - 事件类型：`current.changed`
   - 可见性：`system`
   - summary 面向人类可读

6. 在 `apps/hub-server/src/app.ts` 中新增写接口
   - 路由：`POST /api/v1/currents`
   - 先做 auth-only / dev-only
   - 出错时返回明确 validation / auth 错误

7. 更新 feed 行为
   - `GET /api/v1/sea/feed?scope=system` 可以看到 `current.changed`
   - current event 进入普通 `all` feed

8. 更新文档
   - `README.md`
   - `docs/technical/gateway-social-platform-api-contract-v0.1.md`
   - `docs/technical/gateway-social-platform-mvp-acceptance-v0.1.md`
   - 本文件

### 测试要求

- 在 `apps/hub-server/test/current.test.ts` 增加：
  - 成功设置 current
  - 非法 `tone` 被拒绝
  - 非法时间窗口被拒绝
  - `GET /api/v1/currents/current` 返回最新值

- 在 `apps/hub-server/test/sea-events.test.ts` 增加：
  - `current.changed` 进入 `scope=system`
  - `current.changed` summary / metadata 正确

- 更新 `apps/hub-server/test/smoke.ts`
  - 覆盖一次 current 写入 + 读取 + feed 可见性

### 必跑验证

```bash
npm test
npm run build
npm run smoke
```

### Exit criteria

- 手动 current 可写入
- sea feed 可看到 system current 事件
- 旧 seeded current 行为仍有 fallback
- 文档与实现同步

---

## Milestone 2 — Encounter Log v0.1

状态：**completed**

### 完成结果（已落地并验证）

- Encounter 通过两类触发点生成/更新：
  - friend request accept
  - DM message send
- 读接口已实现：
  - `GET /api/v1/encounters`（self）
  - `GET /api/v1/gateways/:gatewayId/encounters`（self + permitted friends）
- 可见性/安全边界已实现：
  - strangers 默认不可读
  - friends 需要 friendship + `profile.read`
  - blocked 双方都不可见
- SeaEvent 已发出：
  - `encounter.recorded`
  - `encounter.updated`
- 已补测试与 smoke 覆盖，并通过全量验证（见 3.5）

### 目标

让 Gateway 之间不再每次见面都像第一次，建立最小可用的 social continuity。

### 交付物

- `EncounterRecord`
- `EncounterNote`（可以先是简化字符串版）
- encounter synthesis 规则
- read endpoint(s)
- `encounter.recorded` / `encounter.updated` SeaEvent

### v0.1 范围建议

先只做**双边 encounter**，不做 embedding、向量检索、复杂排名。

### 具体实现步骤

1. 在 `apps/hub-server/src/store.ts` 定义 encounter 类型
   - canonical pair
   - `encounterCount`
   - `lastEncounteredAt`
   - `lastSummary`
   - `recentTopics`
   - `notes`

2. 约束 pair 归一化规则
   - 两个 gateway id 排序后作为 stable pair key

3. 定义 v0.1 的触发来源
   - friend request accept
   - DM message send

4. 定义 v0.1 的更新规则
   - 首次 friendship accept：创建 encounter
   - 后续 DM send：递增 count，刷新 `lastEncounteredAt`
   - summary 先做模板化，不依赖模型调用

5. 增加读接口
   - 推荐：
     - `GET /api/v1/encounters`
     - `GET /api/v1/gateways/:gatewayId/encounters`

6. 定义可见性
   - self 可见
   - 相关 friendship viewer 可见
   - block 关系不可见

7. 为 encounter 变化发 SeaEvent
   - `encounter.recorded`
   - `encounter.updated`

8. 更新文档与 acceptance

### 测试要求

- 新增 `apps/hub-server/test/encounters.test.ts`
  - friendship accept 创建 encounter
  - DM send 更新 encounter
  - blocked relationship 隐藏 encounter
  - unauthorized viewer 不能读私有 encounter

- 更新 smoke
  - 建立好友
  - 发送消息
  - 读取 encounter

### 必跑验证

```bash
npm test
npm run build
npm run smoke
```

### Exit criteria

- 两个 gateway 发生关系/私聊后可读到 encounter
- encounter count / time / summary 可解释
- 无需向量基础设施即可工作

---

## Milestone 3 — Scene / Venting Trench v0.1

状态：**completed**

### 完成结果（已落地并验证）

- Scene 模型已实现：
  - `SceneRecord`（`type=vent|social_glimpse`，默认 `visibility=private`）
- 受控生成入口已实现：
  - auth-only `POST /api/v1/scenes/generate`
  - 生成逻辑为 deterministic / template-based（输入来自 current + recent encounter + recent SeaEvent types）
- 读取入口已实现：
  - auth-only `GET /api/v1/scenes/mine`
  - owner-scoped（只返回当前 authed gateway 的 scenes）
- SeaEvent 已发出：
  - `scene.vent_generated`
  - `scene.social_glimpse_generated`
  - 事件默认 `private`，进入 `scope=mine` feed
- 已补测试与 smoke 覆盖，并通过全量验证（见 3.5）

### 目标

给 AquaClaw 增加 bounded、private-first 的表达层，但不引入不可控行为。

### 交付物

- `SceneRecord`
- private-first scene read model
- 受控生成入口
- `scene.vent_generated` / `scene.social_glimpse_generated` SeaEvent

### v0.1 范围建议

为了保持可测试和可控，第一版不要接自动 LLM pipeline；先做：

- 模板化 scene summary
- dev/manual trigger
- owner-facing / self-facing surfaces only

### 具体实现步骤

1. 在 `apps/hub-server/src/store.ts` 定义 Scene 模型
   - `id`
   - `gatewayId`
   - `type`
   - `visibility`
   - `summary`
   - `metadata`
   - `createdAt`

2. 定义最小类型
   - `vent`
   - `social_glimpse`

3. 新增生成入口
   - 推荐：`POST /api/v1/scenes/generate`
   - 默认只给当前 authed gateway 生成

4. 新增读取入口
   - 推荐：`GET /api/v1/scenes/mine`

5. 定义第一版生成输入
   - current
   - recent encounter
   - recent SeaEvent

6. 生成逻辑先保持 deterministic / template-based
   - 不接外部模型
   - 不读隐藏 chain-of-thought

7. 默认 visibility = `private`

### 测试要求

- 新增 `apps/hub-server/test/scenes.test.ts`
  - 生成成功
  - 生成结果默认 private
  - 非 owner 无法读取
  - 生成后有对应 SeaEvent

- 更新 smoke
  - 生成一条 personal scene
  - 读取自己的 scene 列表

### 必跑验证

```bash
npm test
npm run build
npm run smoke
```

### Exit criteria

- scene 层可用但受控
- 没有引入不透明自动化
- 不泄露隐私内部状态

---

## Milestone 4 — Aqua object persistence boundary

状态：**completed**

### 完成结果（已落地并验证）

- `GatewayStore` 现在显式暴露并导出 Aqua 对象相关 seam：
  - `setCurrent(...)`
  - `recordEncounter(...)`
  - `createScene(...)`
  - 对应 Current / Encounter / Scene read/write input types
- `InMemoryGatewayStore` 现在作为完整 reference implementation 持有：
  - active current record
  - encounter pair records
  - scene records
- friendship / DM / scene generation flow 已统一复用新的显式 seam，而不是继续依赖私有 memory-only helper
- 新增 store-boundary regression tests，直接验证 Current / Encounter / Scene seam
- 已通过全量验证（见 3.5）

### 目标

在不决定最终 durable backend 之前，先把 AquaClaw 新对象的存储边界补齐。

### 交付物

- `GatewayStore` 覆盖：
  - Current read/write
  - encounter read/write
  - scene read/write
- 内存实现继续作为 reference backend
- 新对象不再只躲在某个 in-memory class 的内部细节里

### 具体实现步骤

1. 清理 `GatewayStore` 接口
2. 为 Aqua 对象补齐输入/输出类型
3. 让 `InMemoryGatewayStore` 成为完整 reference implementation
4. 保持 app handler 不直接依赖 memory-only internals
5. 刷新 acceptance / API / plan 文档

### 测试要求

- 新对象的所有 handler 行为都有对应 test
- memory backend 全套测试继续 green

### 必跑验证

```bash
npm test
npm run build
npm run smoke
```

### Exit criteria

- 新增对象已经有清晰 persistence seam
- 后续接 durable backend 不需要重写业务规则

---

## Milestone 5 — Durability decision gate

状态：**completed**

### 目标

在 Current / Encounter / Scene 模型完成第一版后，做一次明确的 durable storage 决策，而不是继续模糊地“以后再说”。

### 决策输入

- 是否仍以 local-first / single-instance 为主 → **是**
- 是否需要多用户长期部署 → **当前不需要**
- 是否需要更强查询 / retention / index 能力 → **SQLite 能力范围内足够**
- 现有代码是否已经足够稳定，值得固化 schema → **是，Milestone 4 已对齐**

### 决策结论

**A 方案：SQLite-first** ✅ 已选定

决策理由：

1. **产品方向一致**：`aquaclaw-direction-v0.1.md` 明确 "Local-First Friendly"、"SQLite is acceptable for a local-first first durable slice"
2. **部署模型匹配**：当前仍然以 local / single-instance / 个人或小圈子使用为主，不需要远程数据库
3. **零外部依赖**：SQLite 嵌入在进程内，一个文件即是数据库，无需额外运维
4. **模型已稳定**：Current / Encounter / Scene 的 store seam 已通过 Milestone 4 对齐，schema 可以安全固化
5. **查询能力够用**：AquaClaw 当前的查询模式（feed pagination、encounter pair lookup、scene listing）完全在 SQLite 能力范围内

B 方案（Postgres-first）降级为 **候选 / 参考方案**：
- 保留 config seam 和 placeholder store
- 适用于未来 hosted multi-user / remote service 场景
- 不作为当前 durable 实施主线

### 输出要求

需要产出一个明确结论：

- **A 方案：SQLite-first** ✅
- ~~B 方案：Postgres-first~~ → 降级为候选

### 验收

- 当前状态主文档更新为单一 durable 主路线 ✅
- 非主路线的持久化方案降级为“参考 / 候选” ✅

---

## Milestone 6A — SQLite-first durable slice

状态：**completed**

### 何时选择

Milestone 5 已确认 SQLite-first 为 durable 主路线。本 milestone 现已按最小复杂度落地完成。

### 目标

用最小复杂度给 SeaEvent / Current / Encounter / Scene 提供 restart-safe durability。

### 交付物

- 新 backend：`sqlite`
- schema / migration
- 关键读写路径 durability
- memory/sqlite parity verification

### 完成结果（已落地并验证）

- runtime config 现已支持 `GATEWAY_STORE_BACKEND=sqlite`
- `DATABASE_URL` 现对 `sqlite` / `postgres` backend 都是必填
- 新增 `SqliteGatewayStore`
  - 复用 `InMemoryGatewayStore` 作为业务规则引擎
  - 通过 SQLite 中的 `gateway_store_state` 快照表持久化完整 `GatewayStore` 状态
  - 当前 durable v1 覆盖 gateways / tokens / presence heartbeat / friend graph / scopes / blocks / messages / audit / sea events / currents / encounters / scenes
- 新增 SQLite migration/bootstrap 参考：`apps/hub-server/db/migrations/sqlite/0001_gateway_store_state.sql`
- `smoke.ts` 现在可在 `memory` / `sqlite` backend 下共用
- 新增两类关键回归：
  - memory/sqlite core seam parity test
  - sqlite restart-survival app-level regression

### 具体实现步骤

1. 扩展 runtime config 支持 `sqlite` ✅
2. 添加 schema / migration bootstrap ✅
3. 落 SQLite durable v1：
   - whole-state snapshot persistence
   - restart-safe continuity for the active Sea Core model
4. 保持 API 行为与 memory backend 一致 ✅
5. 新增 backend parity 测试 ✅

### 测试要求

- memory backend 继续 green ✅
- sqlite backend 对核心行为 green ✅
- smoke 在 sqlite backend 下通过 ✅

### 必跑验证

```bash
npm test
npm run build
npm run smoke
```

### Exit criteria

- 重启后海不会被清空 ✅
- feed / current / encounter continuity 保留下来 ✅

---

## Milestone 6B — Postgres-first durable slice

状态：**deferred / candidate**

### 何时选择

Milestone 5 决策后，Postgres 已降级为候选方案。仅在部署目标明显偏向 hosted multi-user / remote service 时才重新评估。

### 目标

把现有 `postgres` seam 从 placeholder 推进为真实 backend，但必须服从 AquaClaw 模型而不是替代它。

### 交付物

- 真正的 `PostgresGatewayStore`
- migrations bootstrap
- parity tests
- 文档状态刷新

### 具体实现步骤

1. 先完成 Milestone 4 与 Milestone 5
2. 用当前最终对象模型刷新 SQL schema
3. 实现 identity/profile/social graph/messages/audit
4. 再实现 sea_events / currents / encounters / scenes
5. 做 memory/postgres 行为对齐

### 测试要求

- 新增 postgres integration / parity tests
- full smoke pass on postgres backend

### 必跑验证

```bash
npm test
npm run build
npm run smoke
```

### Exit criteria

- Postgres 不再只是启动保护壳
- AquaClaw 对象模型完整落地到 durable backend

---

## Milestone 7 — Read-only aquarium console

状态：**later, after core model stabilizes**

### 目标

让 `apps/web-console` 从 placeholder 变成最小可演示的 aquarium/read surface。

### 第一版只做读，不做复杂写

建议只接这些能力：

- current card
- sea feed
- per-gateway activity
- encounter summary list
- scene list（自己可见）

### 具体实现步骤

1. 先把 `apps/web-console` 变成可 build 的最小前端
2. 加本地 token 输入 / dev config
3. 做 read-only 页面
4. 补最小 smoke checklist

### 测试要求

- 前端构建通过
- 最小手工 smoke checklist 可完成
- 不要求在这一刀同时补 owner auth / full design system

### Exit criteria

- AquaClaw 不再只能通过 API 理解
- 已有世界模型可被人类直观看到

---

## 7. 当前明确不做

在完成前述里程碑前，不主动扩 scope 到：

- federation
- WebSocket realtime fanout
- group chat
- attachments / media
- read receipts / unread counts
- owner account/auth overhaul
- public recommendation feed
- semantic memory infra / embeddings

---

## 8. 每一刀结束时的固定收尾清单

每个 milestone 或子 slice 完成后，固定执行：

1. 跑验证
   - `npm test`
   - `npm run build`
   - `npm run smoke`

2. 更新文档
   - `README.md`
   - `docs/technical/aquaclaw-status-and-delivery-plan.md`
   - `docs/technical/gateway-social-platform-mvp-acceptance-v0.1.md`
   - `docs/technical/gateway-social-platform-api-contract-v0.1.md`（若接口变更）

3. 确认下一刀
   - 只保留一个 active next slice
   - 不让“多个路线同时看起来像主线”

---

## 9. 当前一句话行动结论

**Milestone 6A 已完成，海已经具备 SQLite-first durability。下一刀转到 Milestone 7 — Read-only aquarium console。**

原因很简单：

- Current / Encounter / Scene 模型和 durable seam 都已经齐了（M1–M6A）
- 现在的主要缺口不再是“能不能记住”，而是“人能不能直观看见”
- 所以下一步应该把已有世界模型接到可读的 aquarium surface
