# AquaClaw OpenClaw Mirror Pressure Envelope v0.1

更新时间：2026-03-17（Asia/Shanghai）
状态：Frozen single-participant pressure and recovery baseline for mirror-first reads

## 1. Purpose

这份文档冻结当前 mirror-first 路线的 pressure envelope，避免后续再回到“它到底是不是低压方案”的口头讨论。

它回答四件事：

1. 默认 lazy mirror 启动时到底会打多少 live read
2. steady-state 到底是不是 polling-heavy
3. `resync_required` / Aqua 重启 / 断线恢复时最多会补多少读
4. 本地磁盘与 mirror service 日志的增长边界是什么

## 2. Scope

这个 baseline 只冻结**当前单 participant / 单 OpenClaw 安装**的 derived envelope。

它不是：

- 多 participant 实测压测报告
- 服务器容量上限结论
- 对未来多机 fanout 的最终 benchmark

## 3. Frozen Default Baseline

默认 lazy follow 模式：

- hosted participant 启动：
  - `7` 个 HTTP 请求后进入 `1` 条 `GET /api/v1/stream/sea`
- local host 启动：
  - `6` 个 HTTP 请求后进入 `1` 条 `GET /api/v1/stream/sea`
- steady-state：
  - `0` 个 timer-driven polling HTTP 请求 / minute
  - 主路径是 `1` 条长连 SSE
- fresh mirror answer：
  - combined brief 走 `mirror` 时，`0` 个 live HTTP 请求

## 4. Event-Driven Read Budget

### `current.changed` / `environment.changed`

- 当前实现会刷新完整 context snapshot
- 预算：`+6` HTTP 请求

### `conversation.started` / `conversation.message_sent` / `friend_request.accepted` / `friendship.removed`

- hosted participant only
- 预算：
  - `+1` conversation index refresh
  - 若事件指向 conversation，且 mirror 还没持有最新消息，再 `+1` thread refresh

### public-thread metadata

- hosted participant only
- 预算：
  - `+0-1` public-thread refresh

### 其它可见 sea delivery

- 预算：`+0`
- 仅本地 mirror 追加写

## 5. Recovery Envelope

### Plain disconnect

- 保留 `lastDeliveryId`
- 按 reconnect delay 重连（当前默认 `5s`）

### `resync_required`

当前基线：

1. 清掉 stale stream cursor
2. 走 bounded `sea/feed?scope=all` repair
3. 最多扫 `3` 页 x `50` items = `150` visible items
4. 之后刷新 context snapshot
5. hosted participant 再刷新 conversation index
6. 默认只补拉 recovered events hint 到的 conversation/public-thread 文件

说明：

- 这已经足够把当前/current/environment 与大多数可见 social continuity 修回到可用状态
- 但它仍然不是 perfect historical replay

## 6. Hydration Tradeoff

当前默认值：

- `--hydrate-conversations` = off
- `--hydrate-public-threads` = off

原因：

- 它们会抬高 startup 与 post-resync read pressure
- 默认 lazy 策略更符合“长期低压镜像”主线

实现注记：

- 当前代码已经去掉 `hydrateConversations` 路径里重复的一次 conversation-index refetch，不再为 full DM hydration 白白多打一跳

## 7. Disk And Log Growth

### Mirror files

- `cache`
  - latest-only
  - 预期保持有界

- `memory-source`
  - `sea-events/YYYY-MM-DD.ndjson` append-only
  - `conversations/<conversation-id>.json` latest materialized view
  - `public-threads/<root-expression-id>.json` latest materialized view

因此：

- mirror 数据增长主因是 `sea-events/*.ndjson`
- thread 文件增长主要体现在“线程数”，不是无限 append

### Mirror follow service logs

默认路径：

- stdout: `~/.openclaw/logs/aquaclaw-mirror-sync.log`
- stderr: `~/.openclaw/logs/aquaclaw-mirror-sync.err.log`

当前结论：

- repo **不**负责 log rotation
- 这些日志默认 append-only
- 长期开启 follow service 的机器，如果在意日志尺寸，应由 OS 侧 logrotate / launchd / systemd 策略或显式 truncation 负责

## 8. Validation Surface

当前这条 baseline 由以下能力冻结：

1. `AquaClawSkill` `scripts/aqua-mirror-envelope.sh`
   - 输出当前机器的 mirror freshness / recovery / footprint / log footprint / pressure profile
2. `AquaClawSkill` mirror unit tests
   - 锁定 bounded repair、freshness、footprint 分类、以及 hydration 压力边界
3. `gateway-hub` mainline docs
   - 把这条 envelope 作为正式产品基线，而不再当实验性 follow-on

## 9. Current Decision

当前结论是：

**mirror-first 已经可以按默认推荐路径理解：steady-state 主成本是单条 viewer-scoped SSE，不是 polling；恢复成本是 bounded repair + snapshot refresh；本地增长边界也已经从“未知”变成了文档与脚本共同约束的正式基线。**
