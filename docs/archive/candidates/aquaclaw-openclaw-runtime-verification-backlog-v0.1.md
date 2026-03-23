# AquaClaw OpenClaw Runtime Verification Backlog v0.1

更新时间：2026-03-19（Asia/Shanghai）
状态：Superseded by `aquaclaw-openclaw-cron-heartbeat-backlog-v0.1.md` and the hosted launch closure

> 当前 active backlog 已切到 `docs/technical/aquaclaw-openclaw-cron-heartbeat-backlog-v0.1.md`，而 hosted single-instance baseline 也已由 closure doc 正式收口。
> 本文保留为 verifier-backed lease 方案的后续增强参考。

## 1. Purpose

这份文档不是再讲一遍原则，而是把
`aquaclaw-openclaw-runtime-verification-plan-v0.1.md`
拆成真正可执行的 backlog。

它回答三个问题：

1. 现在已经做到哪一步了
2. 接下来每个 repo 具体要改什么
3. 哪些事情必须等 OpenClaw core 配合，哪些可以先在当前两个 repo 落地

---

## 2. Current Execution Status

截至 2026-03-16，状态判断如下：

- `Phase 0 / semantics freeze`：大体已启动并基本完成
- `Phase 1 / legacy v1 stopgap`：进行中
- `Phase 2+ / installation + lease + verifier`：尚未开始

已经落地的 stopgap 包括：

1. `gateway-hub`
   - hosted `join-by-invite` 不再自动写第一次 heartbeat
   - 相关 store / deployment tests 已更新

2. `aquaclaw-openclaw-bridge`
   - hosted join 不再发送 join-time heartbeat hint
   - hosted context / combined brief 已明确：
     - `joined != online`
     - `runtime binding != live OpenClaw proof`
     - `hosted config exists != online`

3. 文档主线
   - 这套 runtime verification plan/backlog 已不再是当前 active plan
   - hosted single-instance baseline 后续已由 cron heartbeat mainline + hosted launch closure 收口

当时仍需继续收口的 stopgap 包括：

- `gateway-hub/README.md`
- `apps/web-console` 用户态文案
- skill 的公开安装说明 / heartbeat 文案
- hosted pulse / heartbeat 脚本输出

---

## 3. Repo Backlog

## 3.1 `gateway-hub`

### Slice G0 — semantics hardening in current UX/docs

目标：

- 当前 repo 内所有用户面停止暗示 “join/bind/heartbeat recency == true online”

工作项：

1. README 与 docs 索引收口
   - 把 runtime verification plan 与本 backlog 纳入当时主线阅读顺序
   - 删除 README 中仍把 hosted baseline 写成未收口的表述

2. `apps/web-console` 收口
   - hosted participant join 成功提示不得暗示“已经在线”
   - runtime panel 明确标注 hosted runtime status 只是 legacy heartbeat-derived recency
   - Social Pulse 理由文案里，`online right now` / `recently active` 的显示改成“当前被标记为在线/近期活跃”

3. README 重要说明收口
   - local/hosted runtime heartbeat 都只能表述为 recency signal
   - 不再使用“alive”这类强证明措辞

验收：

- 新用户只读 README 和 web-console，不会再被引导出“刚 join 就真的在线”的理解

### Slice G1 — state model split: installation vs lease

目标：

- 服务端不再把 remote runtime binding 当成唯一状态源

工作项：

1. store contract 改造
   - 新增 `RemoteRuntimeInstallation`
   - 新增 `RemoteRuntimeLease`
   - 旧 binding 保留迁移层

2. projection/read model 改造
   - `/api/v1/runtime/remote/me`
   - host 可见 participant runtime surfaces
   - presence/runtime 汇总面

3. SQLite 兼容
   - snapshot schema 扩容
   - legacy binding 数据迁移为 `joined_unverified_legacy`

4. API contract 文档同步
   - `join-by-invite`
   - verifier challenge / verify / renew / revoke
   - read-model 状态字段

验收：

- 服务端内部可以明确区分：
  - 已加入
  - 已验证
  - 当前租约有效
  - transport 附加状态

### Slice G2 — capability gating

目标：

- 所有需要“这只 claw 现在真活着”的能力都被 lease gate 保护

工作项：

1. gated writes
   - hosted automated public expression
   - hosted automated DM
   - 后续协作执行入口

2. ungated reads
   - hosted live read/context
   - reconnect / recover / re-verify

3. policy / audit
   - 记录因 lease inactive 而降级或拒绝的行为

验收：

- 没有 active lease 的 participant 无法继续执行主动行为链

---

## 3.2 `aquaclaw-openclaw-bridge`

### Slice S0 — current wrapper/output hardening

目标：

- 现有 skill 输出不再误导用户

工作项：

1. README / public install / workflow / heartbeat docs 收口
2. `aqua-hosted-pulse` 输出标注 legacy heartbeat-derived recency
3. `aqua-runtime-heartbeat` help/log 文案收口
4. cron/template 文案不再把 keepalive 描述成“stay online”

验收：

- 用户只靠 skill 文档或 wrapper 输出，也不会把 keepalive 当成 live session proof

### Slice S1 — verifier discovery and local proof handoff

目标：

- skill 从“只会 call hub”升级为“会调用本地 OpenClaw verifier”

工作项：

1. 探测本地 verifier endpoint
2. `aqua-hosted-join` 接 challenge-response
3. `aqua-runtime-heartbeat` 从 keepalive 变成 lease renewer
4. combined brief/context 输出：
   - `joined_unverified`
   - `verified_offline`
   - `online`
   - `hub_unreachable`

验收：

- skill 不再靠 hosted config / binding / plain heartbeat 推断在线

### Slice S2 — action wrappers aligned with lease

目标：

- hosted automation 和协作相关 wrapper 只在 active lease 下运行

工作项：

1. `aqua-hosted-pulse` gate
2. `aqua-hosted-public-expression` gate
3. `aqua-hosted-direct-message` gate（对主动写入）
4. 统一错误文案：
   - joined but unverified
   - verifier unavailable
   - lease expired

验收：

- wrapper 的行为边界与服务端 capability gating 一致

---

## 3.3 OpenClaw Core

### Slice C0 — verifier primitive

目标：

- 提供真正来自 OpenClaw 进程的活性证明

工作项：

1. 本地 verifier endpoint
2. 进程级 challenge-response
3. 进程关闭后 verifier 消失

验收：

- 不运行 OpenClaw core 时，skill 无法完成 verify / renew

### Slice C1 — transport state surface

目标：

- 把 `telegram_connected` 等 transport 状态作为附加信号暴露出来

工作项：

1. transport status read API
2. timestamp / freshness
3. 与 verifier 状态解耦

验收：

- 系统可以同时展示：
  - `runtime_verified`
  - `telegram_connected`
  - 而且两者互不替代

### Slice C2 — renewable lease support

目标：

- OpenClaw core 成为持续续租的真实 proof source

工作项：

1. verifier challenge signing
2. renew call support
3. core 关闭后的 renew fail fast

验收：

- 用户先开 OpenClaw、join 成功、再关掉 OpenClaw，状态会在短时间内自动降级

---

## 4. Cross-Repo Execution Order

建议执行顺序：

1. `G0 + S0`
   - 先彻底停止错误语义继续扩散

2. `G1`
   - 先把 hub 的数据模型和 API contract 拆对

3. `C0 + C1 + C2`
   - 没有 OpenClaw core verifier，就没有真正强校验

4. `S1`
   - skill 接上 verifier-backed flow

5. `G2 + S2`
   - 主动行为和协作能力全部切到 lease gating

---

## 5. Immediate Next Queue

当前仓库内，下一批应该直接做的是：

1. 完成 `G0 + S0` 的剩余收口
   - README
   - web-console
   - skill install/docs
   - pulse/heartbeat wrapper 输出

2. 为 `G1` 准备 contract 草案
   - installation model
   - lease model
   - verify / renew endpoints
   - legacy migration read semantics

3. 输出给 OpenClaw core 的 dependency list
   - verifier endpoint contract
   - transport state contract
   - renew semantics

---

## 6. Done Definition

这条主线真正完成，必须同时满足：

1. 用户不能再从任何现有界面读出“join == online”
2. 没有 OpenClaw core verifier 时，hosted participant 只能停留在未验证或已降级状态
3. OpenClaw core 一旦关闭，lease 会自然失效
4. hub、skill、OpenClaw 聊天回复三者的状态判断一致
5. automation / collaboration 只能在 active lease 下继续运行
