# AquaClaw Docs Alignment Review — 2026-03-11

更新时间：2026-03-11 14:30（Asia/Shanghai）
范围：
- `gateway-hub/docs`
- `skills/aquaclaw-openclaw-bridge`（AquaClawSkill）

## 1) Review Goal

确认以下风险是否存在：

- 漂移（实现已变，文档未变）
- 未对齐（两个 repo 对同一能力说法冲突）
- 过期（状态/通过数/active next slice 仍停留旧阶段）
- 覆盖不够（关键 hosted/bridge 能力没有在文档中可执行地表达）

## 2) Findings Summary

### A. `gateway-hub/docs`

本次发现并修复了这些对齐点：

1. API contract 未完整覆盖 hosted owner/runtime bridge 路径
   - 已补：hosted owner session endpoints
   - 已补：registration policy endpoint + hosted default (`invite_only`)
   - 已补：remote runtime bridge endpoints + lifecycle v1（24h expiry / one-active-runtime）
   - 已补：hosted auth boundary说明（owner管理 vs gateway社交写）

2. MVP acceptance 状态过期
   - `npm test` 计数已从旧值更新到 `91/91`
   - 新增 acceptance 条目：
     - Hosted owner/gateway boundary lock
     - Remote runtime bridge v1
     - Hosted registration policy v1

3. docs index 的一句话状态滞后
   - `docs/README.md` 已更新到当前阶段描述（含 remote bridge v1 + registration policy v1）

### B. `AquaClawSkill` repo

本次发现并修复了这些对齐点：

1. skill 文档过于 local-only 描述，缺少 hosted remote bridge 验证路径
   - `README.md` 已补 hosted bridge E2E 说明与运行示例
   - `SKILL.md` 的适用场景已补 hosted remote bridge validate
   - `references/bridge-workflow.md` 已补 hosted E2E command

## 3) Current Alignment Status

当前结论：

- 两边文档在“local-first + hosted bridge 渐进增强”这条线上已基本一致
- `gateway-hub` 负责 runtime truth / API truth
- `AquaClawSkill` 负责 OpenClaw-side bridge usage truth
- hosted remote bridge E2E 路径已在两边文档都可找到

## 4) Remaining Gaps (Not blockers)

以下是后续可继续补强，但不阻塞当前开发：

1. 在 `gateway-hub/docs/technical/aquaclaw-status-and-delivery-plan.md` 中增加更短的“最近 3 个里程碑摘要”段，减少阅读成本。
2. 在 skill README 增加“hosted failure troubleshooting”小节（bootstrap key错误、base URL错误、TLS错误）。
3. 给 hosted bridge E2E 增加一个“expected success output snippet”，便于快速人工验收。

## 5) Maintenance Rule (Locked)

后续文档整理遵循：

1. 先 `git status` 确认代码工作区干净（或仅 docs 变更）
2. 先更新 contract / acceptance，再更新 README 索引与操作指南
3. 对同一能力，runtime repo 与 skill repo 必须同步更新
4. 文档变更完成后，提交独立 docs commit，避免和功能代码混杂
