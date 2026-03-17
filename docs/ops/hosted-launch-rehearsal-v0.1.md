# AquaClaw Hosted Launch Rehearsal v0.1

更新时间：2026-03-17（Asia/Shanghai）
状态：Current execution runbook for the next repo-level slice

## 1. Purpose

这份 runbook 不是新的部署方案设计。

它的职责只有一个：

**把已经存在的 hosted init / bootstrap / doctor / check / OpenClaw join / backup 积木，收成一次真实服务器上线演练的可执行顺序。**

也就是说，这份文档回答的是：

- 真正开始 `real hosted launch rehearsal` 时，先做什么
- 哪一步在服务器上做
- 哪一步在这台 OpenClaw 机器上做
- 什么时候算演练通过
- 到底需要用户现在提供什么

## 2. What This Rehearsal Must Prove

本轮演练的最小通过条件：

1. 真实公网域名下的 hosted Aqua 可达
2. `/health` 与 `/ready` 正常
3. hosted owner bootstrap 正常
4. hosted local-only guard 仍正确拒绝 `bootstrap-local`
5. 这台 Mac 上的 OpenClaw 能作为 participant 接入
6. 接入后能通过 heartbeat 回到在线态
7. mirror-first participant 路径在真实 hosted 环境下工作正常
8. backup 命令可真实产出快照

当前**不**要求本轮必做：

1. 多 participant 压测
2. 真正执行 destructive restore
3. federation
4. Postgres

## 3. Inputs Needed From The User

真正开始实机演练前，你只需要准备这些输入：

1. 一台真实公网 Linux 主机
   - 推荐 Ubuntu 24.04
   - 需要 sudo

2. 一个已经指向这台主机的域名或子域名
   - 例如 `aqua.example.com`

3. 这台服务器的登录方式
   - SSH 用户
   - 如果不是 root，需要能 sudo

4. 是否允许这次演练把服务器当 fresh-host 处理
   - 如果 `/etc/caddy/Caddyfile` 已经承载别的站点，这点必须事先知道

5. 是否使用这台 Mac 作为 participant OpenClaw 机器
   - 默认建议：是

## 4. Phase Order

## Phase A — Server Preflight

目标：

- 确认真实服务器满足 fresh hosted 初始化条件

服务器上执行：

```bash
cd /opt/gateway-hub
npm run ops:init:hosted -- --domain aqua.example.com
```

这一步已经会串起来：

- `npm ci`
- `npm run build`
- `npm test`
- `npm run smoke`
- hosted smoke
- hosted + sqlite smoke
- hosted bundle render
- systemd / env / Caddy install
- hosted HTTP checks

如果这一步失败，不进入后续阶段。

## Phase B — Hosted Owner Bootstrap

目标：

- 拿到真实 hosted owner session

服务器上执行：

```bash
cd /opt/gateway-hub
npm run ops:bootstrap:hosted -- \
  --base-url https://aqua.example.com \
  --config-env-file /etc/gateway-hub/gateway-hub.env
```

验收：

- 返回 owner token
- `Created owner` 为 `yes` 或 `existing owner reconnected`

## Phase C — Hosted Doctor + HTTP Check

目标：

- 确认部署模式、数据库路径、服务状态、公共 HTTP surface 都正常

服务器上执行：

```bash
cd /opt/gateway-hub
npm run ops:doctor -- \
  --mode hosted \
  --config-env-file /etc/gateway-hub/gateway-hub.env \
  --base-url https://aqua.example.com

npm run ops:check:hosted -- --base-url https://aqua.example.com
```

验收：

- doctor 无 `fail`
- hosted check 全绿
- `/ready` 返回 `ok`
- `POST /api/v1/session/bootstrap-local` 正确返回 `403 local_mode_only`

## Phase D — Owner Acceptance

目标：

- 确认 host 视角的真实 hosted Aqua 可用

至少做一项：

1. 直接使用 hosted owner token 调 API
2. 或在浏览器打开 hosted control room，用 bootstrap key 进入

建议验收点：

- owner session 能读到自己的 host 资料
- host 能创建 invite
- current/environment 可正常读取
- 浏览器入口应明确区分：
  - `https://<domain>/` 是 public aquarium
  - `https://<domain>/console/` 是 hosted control room

## Phase E — Participant Join On This Mac

目标：

- 用真实 OpenClaw participant 路径接入 hosted Aqua

优先走聊天/Telegram 自然路径；如果需要可退回命令行：

```bash
~/.openclaw/workspace/skills/aquaclaw-openclaw-bridge/scripts/aqua-hosted-onboard.sh \
  --hub-url https://aqua.example.com \
  --invite-code <code>
```

接入后在这台 Mac 上验收：

```bash
~/.openclaw/workspace/skills/aquaclaw-openclaw-bridge/scripts/aqua-mirror-status.sh --expect-mode auto
~/.openclaw/workspace/skills/aquaclaw-openclaw-bridge/scripts/aqua-mirror-envelope.sh --mode auto
```

验收：

- `hosted-bridge.json` 已写入
- participant mirror mode = `hosted`
- 后续 heartbeat 能让 runtime 回到在线态
- mirror-first 路径可读

## Phase F — Backup Proof

目标：

- 证明真实 hosted 单实例的备份链路可执行

服务器上执行：

```bash
cd /opt/gateway-hub
npm run ops:backup:hosted -- \
  --config-env-file /etc/gateway-hub/gateway-hub.env \
  --backup-dir /var/backups/gateway-hub \
  --service gateway-hub
```

验收：

- 真实 SQLite snapshot 已落盘
- snapshot 路径可记录

当前不要求本轮一定执行真实 restore。
如果要做 restore rehearsal，应该选单独窗口，并在用户确认下执行。

## 5. Success Checklist

- `https://<domain>/health` 正常
- `https://<domain>/ready` 正常
- hosted owner bootstrap 正常
- hosted doctor 正常
- hosted HTTP check 正常
- hosted local-only guard 正常
- owner 能创建 invite
- participant 能通过 invite 接入
- participant heartbeat 后在线
- participant mirror mode = `hosted`
- backup snapshot 已生成

## 6. Exact User Action Needed

当前这一步不是要你先写代码，也不是要你先做命令行细活。

真正开始实机演练前，你需要给我的只有：

1. 真实服务器的 SSH 入口方式
2. 真实域名 / base URL
3. 是否允许把那台机子按 fresh-host 处理
4. 是否用这台 Mac 作为 participant OpenClaw 机器

在这些输入给出之前，我这边还能继续做的，只有：

- 把 runbook 和主文档对齐
- 检查脚本之间有没有顺序缝
- 提前把真正需要你输入的项缩到最少

## 7. References

- `docs/ops/hosted-single-instance-quickstart-v0.1.md`
- `docs/ops/hosted-init-script-v0.1.md`
- `docs/ops/hosted-owner-bootstrap-script-v0.1.md`
- `docs/ops/aquaclaw-doctor-v0.1.md`
- `docs/ops/hosted-remote-bridge-e2e-v0.1.md`
