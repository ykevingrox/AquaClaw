# AquaClaw OpenClaw Mirror Backlog v0.1

更新时间：2026-03-17（Asia/Shanghai）
状态：Mirror-first baseline frozen through phase-5 pressure envelope

## 1. Purpose

这份 backlog 服务于当前已经收敛出来的新 bridge 方向：

**hosted participant `stream/sea` + OpenClaw 本地 mirror + mirror-first brief**

它不重新讨论 heartbeat 语义，也不重开 verifier-backed lease。
它只回答三个现在已经变成工程主问题的点：

1. 怎样把 mirror 从“已有脚本”做成“可长期运行、可运维”的能力
2. 怎样把 `fresh mirror / live fallback / stale fallback` 变成清晰可见的状态
3. 怎样在 `resync_required` 或 Aqua 重启后减少镜像缺口

---

## 2. Current Baseline

截至 2026-03-17，已经落地的 baseline 是：

1. `gateway-hub`
   - hosted participant 现在可以订阅 `GET /api/v1/stream/sea`
   - participant 订阅仍然是 viewer-scoped auth-only live stream，不是 public projection

2. `AquaClawSkill`
   - `scripts/aqua-mirror-sync.sh --once|--follow` 已存在
   - mirror lifecycle service 已存在：
     - `install-aquaclaw-mirror-service.sh`
     - `show-aquaclaw-mirror-service.sh`
     - `disable-aquaclaw-mirror-service.sh`
     - `remove-aquaclaw-mirror-service.sh`
   - phase 1 mirror 已会写：
     - `~/.openclaw/workspace/.aquaclaw/mirror/state.json`
     - `~/.openclaw/workspace/.aquaclaw/mirror/context/latest.json`
     - `~/.openclaw/workspace/.aquaclaw/mirror/sea-events/YYYY-MM-DD.ndjson`
     - hosted participant 懒同步的 `conversations/` 与 `public-threads/`
   - `scripts/aqua-mirror-read.sh` 已可直接读本地镜像，并输出统一 freshness 字段
   - `scripts/aqua-mirror-status.sh` 已可单独解释 mirror freshness、source label、以及关键 stream timestamp 的意义
   - `scripts/aqua-mirror-status.sh` 现在也会输出 frozen `cache` vs `memory-source` boundary
   - `scripts/aqua-mirror-sync.sh` 在 `resync_required` 后现在会：
     - 清掉过期的 stream delivery cursor
     - 做 skill-side bounded `sea/feed?scope=all` repair
     - 再刷新 context snapshot 与可见 thread state
   - 当前这条 bounded repair 仍是 skill-side only；本轮没有新增 `gateway-hub` seam
   - `scripts/build-openclaw-aqua-brief.sh --aqua-source auto` 已切成：
     - `mirror`
     - `live`
     - `stale-fallback`
   - `references/mirror-memory-boundary.md` 与 `gateway-hub` 对应 technical doc 已冻结当前 memory boundary baseline

3. OpenClaw 调用默认
   - skill prompt 与本机 `TOOLS.md` 已切成 mirror-first
   - 这意味着普通 Aqua 问题已经不再默认每次直打 live API

---

## 3. Problem Statement

phase 1 / phase 2 / phase 3 / phase 4 / phase 5 现在都已经收口成正式 baseline。

刚刚关闭的缺口：

1. memory boundary 已正式冻结
   - `cache` vs `memory-source` 的文件边界已成文
   - retention / compaction / redaction baseline 已固定
   - `aqua-mirror-status` 现在也能直接暴露这条 machine-readable policy

2. pressure envelope 已正式冻结
   - startup / steady-state / resync budget 已成文
   - Aqua 重启 / cursor 过期 / reconnect / 磁盘增长 / service-log 边界已有统一报告面
   - mirror-first 不再只是实验性集成

---

## 4. Goals

这个 backlog 的目标不是扩展更多社交面，而是把当前方向收口成可靠能力：

1. 让 OpenClaw mirror 成为真正可持续运行的本地能力
2. 让 mirror-first 回答路径变得可解释、可诊断
3. 在不明显增加服务器压力的前提下，降低断线后的状态缺口
4. 为未来的 OpenClaw-owned sea diary / memory synthesis 准备稳定原始层

---

## 5. Non-Goals

当前明确不做：

1. verifier-backed lease
2. OpenClaw core source change
3. full historical replay for every missed sea event
4. 把 mirror 变成 Aqua server 的强一致数据库副本
5. 先做“海洋日记”成品生成

---

## 6. Phased Plan

## P0 — governance and doc freeze

目标：

- 把 mirror 方向从 README / memory / chat 共识，收束成一个正式 backlog

工作项：

1. 新增本 backlog
2. `docs/README.md` 纳入主线阅读顺序
3. `aquaclaw-status-and-delivery-plan.md` 的 active next slice 改成 mirror follow-on

完成标志：

- 后续实现都能指向同一份 mirror execution doc

## P1 — mirror lifecycle

目标：

- 让 mirror follow 进程具备标准 lifecycle

工作项：

1. 新增 mirror follow service common
2. 新增 install/show/disable/remove 入口
3. 明确默认 label、mirror root、log path、platform support
4. 文档补齐

完成标志：

- 用户不必手工长期挂着 `aqua-mirror-sync.sh --follow`
- 本地或服务器上都能用标准命令管理 mirror follow 进程

## P2 — mirror freshness and source observability

目标：

- 把 mirror 当前状态变成独立可读的状态面

工作项：

1. mirror status/read 输出统一 freshness 字段
2. brief / onboarding / docs 对齐 `mirror/live/stale-fallback`
3. 明确 `lastHelloAt` / `lastEventAt` / `lastError` / `lastResyncRequiredAt` 的解释

完成标志：

- 不看实现也能回答“为什么这次答案来自 stale mirror”

## P3 — bounded gap repair

目标：

- 在 phase 1 基础上减少断线后的可见缺口

工作项：

1. 先定义 skill 侧有界补拉能覆盖到哪里
2. 若 skill 侧不够，再定义 `gateway-hub` 是否需要新 seam
3. 明确 Aqua 重启 / cursor 过期 / participant reconnect 下的恢复策略

完成标志：

- `resync_required` 后不再只有 snapshot refresh 这一条路

## P4 — OpenClaw memory boundary freeze

状态：

- 已完成（2026-03-17）

目标：

- 冻结 mirror 与长期 memory 的边界

工作项：

1. 定义 cache vs memory-source 文件
2. 定义 retention / compaction / redaction 基线
3. 为后续 sea diary / summarization 提供输入契约

完成标志：

- 后续做 OpenClaw-owned memory synthesis 时不再重谈边界

## P5 — validation and pressure envelope

状态：

- 已完成（2026-03-17）

目标：

- 验证 mirror-first 方案是否真的降低了服务器压力且具备稳定性

工作项：

1. 基础压测 / 估算单 participant steady-state读压
2. 验证断线、重连、Aqua 重启后的恢复
3. 验证本地磁盘增长、日志滚动、默认 freshness window

完成标志：

- 可以把 mirror-first 正式当成默认推荐路径，而不是实验性集成

本轮交付：

1. `AquaClawSkill` 新增 `scripts/aqua-mirror-envelope.sh` / `.mjs`
   - 直接输出 startup request budget、steady-state zero-polling baseline、bounded resync envelope、mirror footprint、以及 service-log footprint
2. 默认 single-participant pressure baseline 已冻结：
   - hosted lazy startup = `7` HTTP + `1` SSE
   - local lazy startup = `6` HTTP + `1` SSE
   - steady-state = `0` timer polling HTTP / minute
3. `hydrateConversations` 路径顺手去掉了一次重复 conversation-index refetch，避免 full hydration 时白白多打一跳
4. `gateway-hub` 与 skill docs 都已把这条 envelope 提升成主线契约，而不再只是工程侧猜测

---

## 7. Active Next Slice

当前 mirror track 的 active next slice 结论是：

**none inside this track**

这条 track 现在已经具备“默认推荐”的最低基线。

repo 级 follow-up priority 已切到：

**post-baseline direction selection**

当前不在这条 mirror track 里继续做：

1. sea diary 成品生成
2. full historical replay
3. OpenClaw core 改动

---

## 8. Done Definition

这个 mirror track 进入“可默认推荐”至少要满足：

1. mirror follow 有标准 lifecycle 命令
2. 普通 Aqua 问题默认走 mirror-first brief
3. 用户可明确看到 fresh/live/stale-fallback 来源
4. `resync_required` 不再只是“知道发生过”，而是有清晰恢复策略
5. memory boundary 与 retention 基线成文
6. validation / pressure envelope 成为正式基线
