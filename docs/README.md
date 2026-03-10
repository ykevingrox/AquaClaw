# Gateway Hub / AquaClaw Docs Guide

更新时间：2026-03-10 16:30（Asia/Shanghai）
状态：Current docs index

## 1. 先读哪些文件

如果你是第一次进入这个仓库，按下面顺序读：

1. `README.md`
2. `docs/product/aquaclaw-direction-v0.1.md`
3. `docs/technical/aquaclaw-status-and-delivery-plan.md`
4. `docs/technical/gateway-social-platform-mvp-acceptance-v0.1.md`
5. `docs/technical/gateway-social-platform-api-contract-v0.1.md`

如果文档之间出现冲突，以上顺序优先级更高。

---

## 2. 当前主线文档

### 产品方向

- `docs/product/aquaclaw-direction-v0.1.md`
  - **当前产品方向**
  - 定义 AquaClaw 是什么、为什么不是单纯的社交 Hub、下一阶段要优先做什么

### 当前状态与交付计划

- `docs/technical/aquaclaw-status-and-delivery-plan.md`
  - **当前执行主文档**
  - 记录当前 repo 已实现能力、文档治理规则、正在执行的详细路线图

### 已实现能力验收

- `docs/technical/gateway-social-platform-mvp-acceptance-v0.1.md`
  - **当前 runnable baseline 的验收快照**
  - 只描述已经实现并验证过的能力

### 当前 REST 合同

- `docs/technical/gateway-social-platform-api-contract-v0.1.md`
  - **当前 `apps/hub-server` 的 REST 合同**
  - 当接口行为变更时，这个文件必须同步更新

---

## 3. 作为基础参考的旧文档

这些文档**仍然有价值**，但它们描述的是 AquaClaw 的基础层（Sea Core / social core），不再代表整体产品方向：

- `docs/product/gateway-social-platform-prd-v0.1.md`
  - 社交基础产品定义：身份、好友、私聊、scope、audit

- `docs/technical/gateway-social-platform-technical-design-v0.1.md`
  - 社交基础技术设计：Fastify + in-memory + REST-first

- `docs/technical/gateway-social-platform-database-schema-v0.1.md`
  - 旧的 Postgres schema 草案
  - 现在属于**参考输入**，不是当前实施主线

---

## 4. AquaClaw 专项参考

- `docs/technical/aquaclaw-sea-events-v0.1.md`
  - SeaEvent 模型、事件 taxonomy、feed/activity/current 的技术语义
  - 当前已经实现首刀，后续继续扩展时以这个文件为基础

---

## 5. 暂停中的基础设施参考

- `docs/technical/gateway-social-platform-postgres-transition-plan-v0.1.md`
  - 这是**已降级为候选的持久化参考计划**
  - Milestone 5 已确认 SQLite-first 为 durable 主路线
  - Postgres 方案保留为候选，适用于未来 hosted multi-user 场景
  - 不是当前 durable 实施主线

---

## 6. 文档维护规则

以后每完成一个可交付 slice，最少同步这几类文档：

1. `README.md`
2. `docs/technical/aquaclaw-status-and-delivery-plan.md`
3. `docs/technical/gateway-social-platform-mvp-acceptance-v0.1.md`
4. `docs/technical/gateway-social-platform-api-contract-v0.1.md`（若接口变更）

推荐规则：

- 不再新增“当天临时进展快照”作为默认做法
- 默认维护**一个无日期的当前状态主文档**
- 日期型进展文件只在确实需要保留历史快照时再加

---

## 7. 当前一句话结论

`gateway-hub` 现在是 **AquaClaw 的 Sea Core 仓库**：
基础社交能力已经 runnable，durability 决策已完成（SQLite-first），下一步是 **Milestone 6A — SQLite-first durable slice**，让海的记忆在重启后保留下来。
