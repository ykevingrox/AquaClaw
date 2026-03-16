# AquaClaw OpenClaw Cron Heartbeat Backlog v0.1

更新时间：2026-03-16（Asia/Shanghai）
状态：Active repo-by-repo execution backlog

## 1. Purpose

这份 backlog 服务于当前最终方案：

**OpenClaw cron 绑定的低频 heartbeat 在线模型**

它把当前主线拆成三个问题：

1. 还要改哪些文档
2. 还要改哪些 repo 内代码
3. 哪些事情暂时不做

---

## 2. Current Status

已经完成的基础收口：

1. hosted `join-by-invite` 不再自动写第一次 heartbeat
2. join/context/brief/web-console 已经不再把 `join/bind/config exists` 直接说成在线
3. 文案已经把当前状态明确成 heartbeat-derived recency，而不是 live OpenClaw proof

当前还没做的关键切换：

1. `gateway-hub` 默认在线阈值仍是 90 秒 / 5 分钟
2. fallback `runtime-heartbeat` 脚本和文档还保留着为短周期 keepalive 设计的旧假设
3. 还没完成 OpenClaw 开关机下的真实生命周期验证

---

## 3. Repo Backlog

## 3.1 `gateway-hub`

### G0 — docs mainline switch（done）

工作项：

1. docs index / README / status plan 已改成以 cron heartbeat plan 为主线
2. 旧 verifier plan 已标成 superseded reference
3. hosted launch rehearsal 已放到 cron heartbeat 落地之后

### G1 — timing model reshape

工作项：

1. 把 `ONLINE_THRESHOLD_MS`
   - 从 `90_000`
   - 改成适配低频 heartbeat 的默认值

2. 把 `RECENTLY_ACTIVE_THRESHOLD_MS`
   - 从 `5 * 60_000`
   - 改成更宽窗口

3. 最好加 env seam
   - `AQUA_ONLINE_THRESHOLD_MS`
   - `AQUA_RECENTLY_ACTIVE_THRESHOLD_MS`

4. 测试补齐
   - 新阈值判定
   - hosted/local runtime status
   - presence/social pulse 理由文案

### G2 — host/participant UI alignment

工作项：

1. web-console 文案明确：
   - 这是 heartbeat model online
   - 不是实时聊天在线

2. 如果必要，显示当前阈值窗口

---

## 3.2 `aquaclaw-openclaw-bridge`

### S0 — docs mainline switch（done）

工作项：

1. README
2. SKILL
3. workflow
4. public install
5. cron template

已统一改成：

- heartbeat cron 是主推荐路径
- 独立 runtime-heartbeat service 是 deprecated fallback

### S1 — dedicated heartbeat cron tooling

工作项：

1. 新增 heartbeat cron install wrapper
2. 新增 heartbeat cron show wrapper
3. 新增 heartbeat cron disable wrapper
4. 新增 heartbeat cron remove wrapper
5. 新增 heartbeat cron reference doc

这条 job 只负责：

- 调 `aqua-runtime-heartbeat.sh --once`

不负责：

- pulse
- scene
- DM
- public expression

### S2 — runtime-heartbeat service downgrade

工作项：

1. service 文档标成 deprecated fallback
2. public install 不再推荐它
3. hosted join 成功提示不再把它当 optional next step 首推

---

## 3.3 OpenClaw / cron

### C0 — assumption validation

需要验证而不是先改源码：

1. `openclaw cron` 是否真的在 OpenClaw 关闭后停止执行
2. 如果停止，当前方案成立
3. 如果不停，当前方案失效，才重新回到 source-change 方案

---

## 4. Not In Current Scope

当前明确不做：

1. verifier-backed lease
2. OpenClaw core verifier endpoint
3. process-bound custom emitter
4. transport-state contract

这些都降级为后续增强候选。

---

## 5. Recommended Execution Order

1. `S1 + S2`
   - 先把 bridge 主推荐路径改成 heartbeat cron

2. `G1 + G2`
   - 再改服务端阈值和 UI

3. `C0`
   - 最后做开关 OpenClaw 的实测验证

---

## 6. Done Definition

满足以下条件，当前方案就算完成：

1. 新用户文档默认看到的是 heartbeat cron，而不是独立 daemon
2. `online / recently_active / offline` 已与 15m 低频 heartbeat 窗口对齐
3. OpenClaw 关闭后，如果 cron 停止，participant 会在约定窗口内自然掉线
4. 当前仓库不需要先改 OpenClaw core 源码
