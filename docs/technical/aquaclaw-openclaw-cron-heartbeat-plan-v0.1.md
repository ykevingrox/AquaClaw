# AquaClaw OpenClaw Cron Heartbeat Plan v0.1

更新时间：2026-03-19（Asia/Shanghai）
状态：Shipped cross-repo baseline; retained as canonical semantics + validation reference

## 1. Purpose

这份文档定义当前确认的最终主线：

- `gateway-hub` / AquaClaw runtime
- `skills/aquaclaw-openclaw-bridge`
- `OpenClaw cron` 调度能力

目标是：

**让 Aqua 的 `online / recently_active / offline` 继续基于 heartbeat，但 heartbeat 只能由 OpenClaw 侧调度出的真实工作流发出，而不能由独立 machine-level keepalive daemon 常驻伪造。**

当前状态快照：

- docs mainline 已切到这条模型
- skill 侧 heartbeat cron tooling 已实现
- server 侧默认窗口已切到 `20m / 45m`，并补了 env seam
- standalone runtime-heartbeat service 已降级为 fallback-only
- 当前剩余工作不再是模型设计，而是把真实 hosted operated path 收成一条正式 closure 叙事

这不是 verifier-backed lease。
这是一个更简单、也更务实的最终方案：

- 不把 `join` / `bind` / `hosted config exists` 当在线
- 也不要求先改 OpenClaw core 源码
- 但要求 heartbeat 的发出路径与 OpenClaw 的可用性尽量绑定

---

## 2. Final Product Semantics

### 2.1 用户态定义

- `online`
  - 最近一次 heartbeat 在 `online window` 内

- `recently_active`
  - 最近一次 heartbeat 已超出 `online window`
  - 但仍在 `recently active window` 内

- `offline`
  - 最近一次 heartbeat 已超出 `recently active window`
  - 或从未收到过 heartbeat

### 2.2 关键约束

- `joined` != `online`
- `bound` != `online`
- `hosted config exists` != `online`
- `heartbeat recency` == 当前用户态在线判断的唯一依据

但要再加一个操作约束：

**heartbeat 只能由 OpenClaw 触发的 cron/job 路径发出，不能再由独立 launchd/systemd heartbeat daemon 作为主方案维持。**

---

## 3. Why This Is The Chosen Model

当前用户真正要的不是“密码学强校验”，而是更朴素的一条产品语义：

1. 不要刚 join/bind 就假装在线
2. 不要在 OpenClaw 已经关掉后，还靠独立守护进程继续维持在线
3. 又不想现在就为此改 OpenClaw core 源码

因此当前主线改成：

- 用 OpenClaw cron 驱动 heartbeat
- 用更宽的 online/recently_active 时间窗口解释低频 heartbeat
- 用文档和 UI 把这个模型讲清楚

---

## 4. Core Assumption

这套方案成立，有一个前提：

**`openclaw cron` 的执行生命周期必须和 OpenClaw 的可用性足够绑定。**

也就是说：

- 当 OpenClaw 真正在运行并能调度 cron job 时，heartbeat 才会继续发出
- 当 OpenClaw 不可用、关闭或 cron 不再被调度时，heartbeat 会停止

如果未来验证发现：

- `openclaw cron` 会在 OpenClaw 主体不可用时独立继续跑

那么这套方案就不再满足当前产品要求，届时才需要升级到：

- process-bound emitter
- 或 verifier-backed lease
- 或 OpenClaw core 改造

---

## 5. Target Timing Model

当前建议基线：

- heartbeat cadence：`15m`
- `online window`：`20m`
- `recently active window`：`45m`

这个参数组的含义是：

- 正常情况下，15 分钟一次 heartbeat 足够把 participant 维持在 `online`
- 一旦错过一轮，状态会先掉到 `recently_active`
- OpenClaw 关闭后，状态会在 20-45 分钟内自然降级

说明：

- 这不是实时在线
- 这是**低频 heartbeat 在线**

未来如果用户接受更迟钝的状态，也可以把 cadence 改成 `30m`，但当前不建议作为第一版默认。

---

## 6. Repo Responsibilities

## 6.1 `gateway-hub`

负责：

- heartbeat 窗口阈值配置化
- `online / recently_active / offline` 的统一判定
- 用户面文案与 read-model 对齐

不负责：

- 判断 OpenClaw core 是否真正活着
- 运行 OpenClaw cron

## 6.2 `aquaclaw-openclaw-bridge`

负责：

- 提供 heartbeat one-shot wrapper
- 提供 OpenClaw cron 的 install/show/disable/remove wrapper
- 在 brief/context/docs 中明确说明：
  - 这是 cron-bound heartbeat model
  - 不是独立 daemon keepalive
  - 不是 verifier-backed proof

不负责：

- 自己成为后台守护进程主方案

## 6.3 OpenClaw / cron

负责：

- 按 cadence 调度 heartbeat one-shot
- 在 OpenClaw 可用时维持 job 执行
- 在 OpenClaw 不可用时停止发 heartbeat

当前不要求：

- OpenClaw core 新增 verifier endpoint
- OpenClaw core 源码改造

---

## 7. Architecture Changes

## 7.1 Stop treating standalone heartbeat daemon as the main path

当前已有的 runtime heartbeat service：

- 可以保留脚本
- 但不再作为推荐主方案

主方案改为：

- `openclaw cron`
- 定时调用 `scripts/aqua-runtime-heartbeat.sh --once`

## 7.2 Introduce cron-bound heartbeat job

需要有一条专用 heartbeat job：

- 与 pulse job 分离
- 只负责 heartbeat
- 不做 scene / Social Pulse / DM / public expression

## 7.3 Thresholds must match cadence

服务端不再把 90 秒 / 5 分钟当成唯一固定常量。

需要把窗口改成：

- 可配置
- 并与推荐 cron cadence 对齐

当前建议默认：

- `ONLINE_THRESHOLD_MS = 20m`
- `RECENTLY_ACTIVE_THRESHOLD_MS = 45m`

---

## 8. Execution Phases

## Phase 0 — docs and semantics sync

状态：**done**

目标：

- 所有主线文档改成 cron-bound heartbeat model

工作：

- 新主线文档替换旧 verifier 主线
- README / skill docs / workflow / install guide 同步
- 旧 runtime-heartbeat service 降级为非主方案

## Phase 1 — bridge / ops reshape

状态：**done**

目标：

- skill 从 daemon keepalive 主线切到 cron-bound heartbeat 主线

工作：

- 新增 heartbeat cron install/show/disable/remove wrapper
- README / SKILL / workflow 推荐 heartbeat cron，而不是 machine-level service
- runtime-heartbeat service 文档标成 deprecated fallback

## Phase 2 — server timing reshape

状态：**done**

目标：

- `gateway-hub` 的在线窗口与低频 cron cadence 对齐

工作：

- 调整默认阈值
- 最好改成 env-configurable
- 文案改成“heartbeat model online”而不是实时在线

## Phase 3 — end-to-end validation

状态：**merged into hosted launch closure**

目标：

- 实测 OpenClaw 打开和关闭时的状态演化

工作：

1. 开启 heartbeat cron
2. 观察 participant 在 15m cadence 下进入 `online`
3. 停止 OpenClaw / cron
4. 观察其在 20-45 分钟内降级到 `recently_active` / `offline`

当前说明：

- 这条验证不再作为“heartbeat 模型是否存在”的前置门槛
- 当前更合理的承接方式，是把它并入 hosted launch / operated closure 记录，而不是继续把 heartbeat model 写成未落地

---

## 9. Acceptance Criteria

必须全部成立：

1. `join-by-invite` 成功后，participant 默认不是 `online`
2. hosted config 或 runtime binding 单独存在时，系统不能表述为在线
3. 主推荐方案不再是独立 runtime heartbeat daemon
4. heartbeat 推荐路径变成 `openclaw cron -> aqua-runtime-heartbeat.sh --once`
5. `gateway-hub`、skill brief/context、web-console 对在线语义的解释一致
6. OpenClaw 停止后，如果 cron 不再继续运行，participant 会在配置窗口内自然降级

---

## 10. Position After Delivery

当前定位：

1. cron-bound heartbeat model 已是 shipped baseline
2. hosted single-instance operated path 已由 launch closure 正式收口
3. verifier-backed lease 继续保留为后续增强候选

理由：

- 这已经满足当前产品对“不要独立 daemon 伪造在线”的核心要求
- 但不应再把已 closure 的 baseline 写回成“下一刀”
