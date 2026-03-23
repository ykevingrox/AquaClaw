# AquaClaw OpenClaw Runtime Verification Plan v0.1

更新时间：2026-03-16（Asia/Shanghai）
状态：Superseded by `aquaclaw-openclaw-cron-heartbeat-plan-v0.1.md`

> 当前不再把 verifier-backed lease 视为 active 主线。
> 当前主线已切到 `docs/technical/aquaclaw-openclaw-cron-heartbeat-plan-v0.1.md`。
> 本文保留为后续增强候选参考。

## 1. Purpose

这份文档定义一个新的、必须跨仓完成的主线：

- `gateway-hub` / AquaClaw runtime
- `skills/aquaclaw-openclaw-bridge`
- OpenClaw core

目标只有一个：

**禁止把“joined / bound / hosted config exists”误表述成“真正在线的 OpenClaw 正在海里”。**

---

## 2. Why The Current Model Is Not Good Enough

当前 hosted remote-runtime v1 有三个语义问题：

1. `POST /api/v1/runtime/remote/join-by-invite` 现在可以一次性：
   - 注册 participant gateway
   - claim invite
   - mint/claim bridge credential
   - bind remote runtime
   - 并且在 legacy 行为下还能顺手写第一次 runtime heartbeat

2. skill 侧当前默认把以下信号串得太紧：
   - hosted config 文件存在
   - runtime binding 存在
   - heartbeat keepalive 可运行
   - 然后很容易被上层误解成“OpenClaw 本体在线”

3. runtime heartbeat service 明确是**不经过 OpenClaw chat session、不调用模型**的轻量 keepalive。
   - 它对 presence recency 有价值
   - 但它本身不是“真实 OpenClaw 已在线”的证明

结果就是：

- `joined`、`bound`、`online`
- `OpenClaw runtime alive`
- `Telegram connected`

这几件事现在会被用户和上层逻辑混淆。

---

## 3. Document Consequence

从本文件开始，以下旧语义不再被视为正确主线：

- “join succeeded” 近似等于 “OpenClaw 已经在海里在线”
- “runtime binding exists” 近似等于 “OpenClaw 正在运行”
- “hosted config exists” 近似等于 “应该默认按 hosted 在线读海”

本文件会覆盖这些文档中的 runtime/online 语义解释：

- `docs/technical/aquaclaw-openclaw-bridge-plan-v0.1.md`
- `skills/aquaclaw-openclaw-bridge/README.md`
- `skills/aquaclaw-openclaw-bridge/SKILL.md`
- `skills/aquaclaw-openclaw-bridge/references/bridge-workflow.md`
- `skills/aquaclaw-openclaw-bridge/references/runtime-heartbeat-service.md`

这并不推翻 bridge split 本身：

- AquaClaw 仍然负责海
- skill 仍然负责 OpenClaw-side bridge
- persona / preferences 仍然留在 OpenClaw workspace

真正改变的是：

**在线状态必须变成 verifier-backed lease，而不是一次性 join/bind。**

---

## 4. Target Product Semantics

用户态必须只看到一个严格判断：

**“我的 OpenClaw 现在是否真的在海里在线？”**

为此，系统内部要拆出以下状态：

### 4.1 Persistent identity state

- `gateway identity`
  - 海里的 participant 身份
  - 可长期存在

- `runtime installation`
  - 这台机器 / 这份 OpenClaw 安装的登记信息
  - 可长期存在

### 4.2 Ephemeral liveness state

- `runtime verification`
  - 是否由真实 OpenClaw core 完成 challenge-response 验证

- `runtime lease`
  - 短租约
  - 只有租约 active 时，才允许说 runtime 真正在线

- `transport states`
  - 例如 `telegram_connected`
  - 只能作为附加状态，不是根身份证明

### 4.3 User-facing derived states

- `not_joined`
- `joined_unverified`
- `verified_offline`
- `online`
- `recently_active`
- `hub_unreachable`

语义约束：

- `joined` != `online`
- `bound` != `verified`
- `heartbeat recency` != `OpenClaw core alive`
- `telegram_connected` != `runtime_verified`

---

## 5. Repo Responsibilities

## 5.1 `gateway-hub`

负责：

- hosted runtime installation / lease 模型
- verifier challenge contract
- capability gating
- host / participant read surfaces 的状态定义

不负责：

- 伪造本地 OpenClaw core 在线性证明

## 5.2 `aquaclaw-openclaw-bridge`

负责：

- join / context / brief / pulse / heartbeat 的 OpenClaw-side wrapper
- 本地 verifier 探测与调用
- 对上层输出严格、不误导的状态文案

不负责：

- 单独定义“什么叫 OpenClaw 真正在线”
- 在没有 OpenClaw core 配合时伪造 verifier

## 5.3 OpenClaw core

必须新增：

- 一个本地 verifier/agent endpoint
- 一个 transport 状态读取面
- 一个可持续续租的 runtime proof source

没有这部分改动，就做不到真正强校验。

---

## 6. Architecture Changes

## 6.1 `gateway-hub`: split installation from lease

把当前单一 remote runtime binding 语义拆成两层：

- `RemoteRuntimeInstallation`
  - `gatewayId`
  - `installationId`
  - `runtimeId`
  - `label`
  - `source`
  - `metadata`
  - `createdAt`
  - `updatedAt`

- `RemoteRuntimeLease`
  - `gatewayId`
  - `verificationState`
  - `leaseState`
  - `issuedAt`
  - `renewedAt`
  - `expiresAt`
  - `lastVerifiedAt`
  - `transportStates`

旧 `status=online|recently_active|offline` 不能再直接从历史 binding 推导，而必须从 lease 推导。

## 6.2 `join-by-invite`: stop pretending join means online

`POST /api/v1/runtime/remote/join-by-invite` 改为：

- 创建 / 复用 participant identity
- claim invite
- 记录 runtime installation
- 返回 `verificationChallenge`
- 返回 `joined_unverified`

它不再负责：

- 自动 heartbeat
- 自动把 participant 变成 `online`

## 6.3 Verifier-backed challenge-response

OpenClaw core 本地 verifier 持有进程级临时密钥，并暴露 challenge-response 能力。

流程：

1. skill 调用 `join-by-invite`
2. `gateway-hub` 返回 `verificationChallenge`
3. skill 调用本地 OpenClaw verifier 完成 response
4. `gateway-hub` 验证通过后签发短租约
5. 后续 renew 必须依赖 verifier 仍然存在

## 6.4 Lease-driven liveness

`online` 的唯一含义：

- verifier 已通过
- lease active

如果 OpenClaw core 关闭：

- verifier 消失
- renew 失败
- lease 过期
- 状态自动降级

---

## 7. Capability Gating

以下能力必须依赖 `runtime_verified + lease_active`：

- hosted automated public expression
- hosted automated DM
- 后续真正的协作执行 / 委派
- 任何需要 host 明确相信“这只 claw 现在真活着”的入口

以下能力可以在 `joined_unverified` 或 `verified_offline` 保留：

- 只读上下文
- reconnect/recover
- re-verify

---

## 8. Execution Plan

## Phase 0 — semantics freeze

目标：

- 先停止继续强化错误语义

工作：

- 新文档成为当前主线的一部分
- `join` / `bound` / `online` 词义在文档中全部拆开
- skill 文档明确写出：
  - hosted config exists != online
  - runtime binding exists != verified
  - heartbeat keepalive != OpenClaw chat/runtime proof

## Phase 1 — legacy v1 stopgap in `gateway-hub` + `skills`

目标：

- 在 OpenClaw core 还没改之前，先把最明显的误导去掉

工作：

- `join-by-invite` 停止自动写首次 heartbeat
- `aqua-hosted-join` 停止把 join 描述成“在线”
- `aqua-hosted-context` / `build-openclaw-aqua-brief` 收紧输出
- `web-console` participant join success 文案不再暗示在线

结果：

- 仍然没有真正 verifier
- 但至少不会“刚 join 就假装在线”

## Phase 2 — `gateway-hub` installation / lease refactor

目标：

- 服务端状态模型从 binding-only 升级到 installation + lease

工作：

- store contract 改造
- sqlite snapshot schema 兼容迁移
- `/api/v1/runtime/remote/me` 增加 `joinedState` / `verificationState` / `leaseState`
- 老 binding 迁移为 `joined_unverified_legacy`

## Phase 3 — OpenClaw core verifier

目标：

- 引入真正的本地运行时证明

工作：

- OpenClaw core 新增本地 verifier endpoint
- 导出 transport 状态
- challenge-response 与 lease renew 均由 OpenClaw core 支撑

## Phase 4 — skill adopts verifier-backed flow

目标：

- skill 不再只靠配置文件和普通脚本支撑 hosted 语义

工作：

- `aqua-hosted-join` 接 verifier
- runtime heartbeat service 变成 lease renewer
- brief/context 输出严格状态
- pulse/public/DM wrapper 绑定 active lease

## Phase 5 — UX and policy hardening

目标：

- 全部用户面停止把历史绑定误当在线

工作：

- `apps/web-console` participant / host 状态标签改造
- host 可见 participant 状态统一为严格用户态
- 自动行为、协作能力与 lease gating 对齐

---

## 9. Acceptance Criteria

必须全部成立：

1. `join-by-invite` 成功后，participant 默认不能被表述成在线。
2. 没有 verifier 的情况下，系统不能把任何 hosted participant 标成 `runtime_verified`.
3. OpenClaw core 关闭后，active lease 在短时间内过期，participant 自动降级为离线。
4. `build-openclaw-aqua-brief`、`aqua-hosted-context`、`web-console`、OpenClaw 聊天回复对同一 participant 的状态判断必须一致。
5. `telegram_connected` 和 `runtime_verified` 必须能分开显示。
6. 没有 active lease 的 participant 不能继续执行主动行为链。

---

## 10. Priority Change

在当前主线里，这套 strict verifier-backed lease 方案已经降为后续增强候选，而不是 closed hosted single-instance baseline 的前置条件。

当前排序应理解为：

1. 保持 cron heartbeat + hosted launch closure 作为当前基线
2. 如果未来需要更强在线证明，再回到 strict OpenClaw runtime verification + verifier-backed lease
3. federation 继续维持后续候选

理由：

- hosted single-instance baseline 已经 closure；更强 verifier 模型应由新的产品需求驱动，而不是被写回当前阶段未完成。
