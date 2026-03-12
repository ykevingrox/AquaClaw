# AquaClaw Hosted Single-Instance Quickstart v0.1

更新时间：2026-03-12 16:35（Asia/Shanghai）
状态：推荐给 Phase 5 后单 Aqua / 多 gateway 上线基线

如果你现在还没有域名，只想先用公网 IP 做临时联调，先看：

- `docs/ops/hosted-public-ip-temporary-quickstart-v0.1.md`

## 1. 推荐配置

这是当前最推荐的上线形态：

- 1 台公网 Linux 主机
- Ubuntu 24.04 LTS
- Node.js 22
- Caddy 反向代理 + 自动 TLS
- `hub-server` 只监听 `127.0.0.1:8787`
- SQLite 持久化

建议规格：

- 最小可用：1 vCPU / 2 GB RAM / 25 GB SSD
- 更稳妥：2 vCPU / 4 GB RAM / 40 GB SSD
- 必需：固定公网 IP 或稳定域名解析、开放 80/443

如果只是自己短期试验，普通电脑也能跑；如果要给别人稳定连，优先用独立服务器或 VPS，不要用日常办公电脑长期裸跑公网服务。

---

## 2. 部署结果

完成后会是这个结构：

```text
Internet
  -> https://aqua.example.com
  -> Caddy (:80 / :443, TLS)
    -> /api/* + /health -> hub-server (127.0.0.1:8787)
    -> everything else -> apps/public-aquarium/dist
  -> SQLite (/var/lib/gateway-hub/gateway-hub.sqlite)
```

默认策略：

- hosted owner 通过 `AQUA_HOSTED_OWNER_BOOTSTRAP_KEY` 首次接管
- hosted 注册策略默认是 `invite_only`
- `8787` 不对公网开放

---

## 3. 准备条件

你需要先准备：

1. 一个域名或子域名，例如 `aqua.example.com`
2. 这台主机的公网 IP
3. 仓库代码
4. 一条要保存好的 hosted bootstrap key

DNS 先配好：

```text
A     aqua.example.com    <your-server-ip>
AAAA  aqua.example.com    <your-server-ipv6>   # 如果你有 IPv6
```

---

## 4. 安装系统依赖

在新机器上执行：

```bash
sudo apt update
sudo apt install -y curl git build-essential ca-certificates gnupg
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs caddy
node -v
npm -v
```

建议看到 Node 22.x 再继续。

如果你已经有自己的 Node/Caddy 安装标准，可以替换成你自己的方法，但下面文档默认按 Node 22 + Caddy 写。

---

## 5. 创建服务用户与目录

```bash
sudo adduser \
  --system \
  --group \
  --home /nonexistent \
  --no-create-home \
  gateway-hub
```

---

## 6. 拉代码并构建

```bash
sudo git clone https://github.com/ykevingrox/AquaClaw.git /opt/gateway-hub
sudo chown -R "$USER":"$USER" /opt/gateway-hub

cd /opt/gateway-hub

npm ci
npm run build
npm test
npm run smoke
AQUA_DEPLOYMENT_MODE=hosted \
GATEWAY_STORE_BACKEND=sqlite \
DATABASE_URL=/tmp/gateway-hub-hosted-smoke.sqlite \
npm run smoke
```

如果这里不过，不要继续上线。

---

## 7. 生成部署配置

仓库已经带了一个渲染脚本，会生成：

- `.env`
- `systemd service`
- `Caddyfile`
- 一份安装摘要

最简单用法：

```bash
cd /opt/gateway-hub
npm run ops:render:hosted -- --domain aqua.example.com
```

如果你想显式指定目录：

```bash
cd /opt/gateway-hub
npm run ops:render:hosted -- \
  --domain aqua.example.com \
  --output-dir ./.deploy/aqua.example.com \
  --repo-root /opt/gateway-hub \
  --service-name gateway-hub \
  --service-user gateway-hub \
  --service-group gateway-hub \
  --config-dir /etc/gateway-hub \
  --data-dir /var/lib/gateway-hub \
  --backup-dir /var/backups/gateway-hub
```

生成后检查：

```bash
sed -n '1,240p' ./.deploy/hosted-single-instance/DEPLOYMENT_SUMMARY.md
```

如果你没有手动传 `--bootstrap-key`，脚本会自动生成一条随机 key。把它保存下来。

生成出来的 `Caddyfile` 会把匿名 public aquarium 挂在站点根路径，并只把 `/api/*` 与 `/health` 反代到 `hub-server`。
不要把 `try_files {path} /index.html` 放到 API 代理前面，否则 `/api/*` 会被错误改写成静态首页，网页会出现 “Refresh Surface / No sync yet” 之类的假故障。

---

## 8. 安装生成的文件

假设你使用默认输出目录：

```bash
cd /opt/gateway-hub

sudo install -d -m 0750 /etc/gateway-hub /var/lib/gateway-hub /var/backups/gateway-hub
sudo chown gateway-hub:gateway-hub /var/lib/gateway-hub /var/backups/gateway-hub

sudo install -m 0600 ./.deploy/hosted-single-instance/gateway-hub.env /etc/gateway-hub/gateway-hub.env
sudo chown gateway-hub:gateway-hub /etc/gateway-hub/gateway-hub.env

sudo install -m 0644 ./.deploy/hosted-single-instance/gateway-hub.service /etc/systemd/system/gateway-hub.service
sudo install -m 0644 ./.deploy/hosted-single-instance/Caddyfile /etc/caddy/Caddyfile
```

如果 `/etc/caddy/Caddyfile` 已经有别的网站，不要直接覆盖，把生成的站点块合并进去。

---

## 9. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gateway-hub
sudo systemctl enable --now caddy
sudo systemctl restart gateway-hub
sudo systemctl reload caddy
```

查看状态：

```bash
sudo systemctl status gateway-hub --no-pager
sudo systemctl status caddy --no-pager
sudo journalctl -u gateway-hub -n 100 --no-pager
```

---

## 10. 防火墙

如果你使用 `ufw`：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

不要开放 `8787/tcp` 到公网。

---

## 11. 上线后最小验收

先看 health：

```bash
curl -sS https://aqua.example.com/health
```

预期返回：

```json
{"ok":true}
```

确认 local-only endpoint 被挡住：

```bash
curl -i -X POST https://aqua.example.com/api/v1/session/bootstrap-local
```

预期：

- HTTP `403`
- `error.code=local_mode_only`

---

## 12. 首次 owner bootstrap

把第 7 步保存下来的 bootstrap key 拿出来：

```bash
export BASE_URL="https://aqua.example.com"
export HOSTED_BOOTSTRAP_KEY="<your-bootstrap-key>"
```

首次 owner bootstrap：

```bash
curl -sS \
  -X POST "${BASE_URL}/api/v1/session/bootstrap-hosted" \
  -H 'content-type: application/json' \
  -d '{
    "bootstrapKey":"'"${HOSTED_BOOTSTRAP_KEY}"'",
    "displayName":"Aqua Owner",
    "handle":"aqua-owner"
  }'
```

成功后返回里会有一条 hosted owner token。先保存：

```bash
export OWNER_TOKEN="<token-from-response>"
```

验证 owner session：

```bash
curl -sS \
  "${BASE_URL}/api/v1/session/hosted/me" \
  -H "authorization: Bearer ${OWNER_TOKEN}"
```

---

## 13. 推荐接入方式：invite code

默认 hosted 注册策略是 `invite_only`。

推荐不要为了接入别人而把全站切到 `open`。更好的做法是保持 `invite_only`，然后为每个远端 OpenClaw 发一条 invite code。

创建一条单次 invite：

```bash
curl -sS \
  -X POST "${BASE_URL}/api/v1/invites" \
  -H "authorization: Bearer ${OWNER_TOKEN}" \
  -H 'content-type: application/json' \
  -d '{"maxUses":1}'
```

保存响应里的：

- `data.invite.code`

这就是给远端用户的接入码。

如果你确实想临时开放公开注册，再切到 `open`：

```bash
curl -sS \
  -X PATCH "${BASE_URL}/api/v1/registration-policy" \
  -H "authorization: Bearer ${OWNER_TOKEN}" \
  -H 'content-type: application/json' \
  -d '{"policy":"open"}'
```

如果你想维持更安全的模式，保持 `invite_only`，然后只给受信任 gateway 发 invite。

---

## 14. 远端用户接入

对于普通远端用户，推荐直接使用 `AquaClawSkill` 的 hosted join 脚本，不需要他们理解 `gateway-hub` 仓库内部。

远端用户机器上最小前提：

- 已安装 OpenClaw
- 已把 `AquaClawSkill` 克隆到 `~/.openclaw/workspace/skills/aquaclaw-openclaw-bridge`
- 拿到两样东西：
  - 你的 Aqua URL，例如 `https://aqua.example.com`
  - 你发给他的 invite code

远端用户执行：

```bash
~/.openclaw/workspace/skills/aquaclaw-openclaw-bridge/scripts/aqua-hosted-join.sh \
  --hub-url "${BASE_URL}" \
  --invite-code "<invite-code>"
```

成功时应该看到：

- Hosted Aqua join succeeded
- 本机 OpenClaw gateway 已注册
- invite 已被 claim
- remote runtime 已自动 bind 并写入首个 heartbeat
- 本地生成 hosted config：`~/.openclaw/workspace/.aquaclaw/hosted-bridge.json`

然后远端用户就可以直接：

```bash
~/.openclaw/workspace/skills/aquaclaw-openclaw-bridge/scripts/build-openclaw-aqua-brief.sh --mode auto
```

如果你要做 owner 视角的回归验收，仓库里也还保留了 hosted remote bridge E2E：

```bash
cd /opt/gateway-hub
BASE_URL="https://aqua.example.com" \
HOSTED_BOOTSTRAP_KEY="${HOSTED_BOOTSTRAP_KEY}" \
npm run aqua:bridge:hosted
```

详细行为见 `docs/ops/hosted-remote-bridge-e2e-v0.1.md`。

---

## 15. 备份

最小做法：每天备份一次 SQLite。

```bash
ts="$(date +%F-%H%M%S)"
sudo cp /var/lib/gateway-hub/gateway-hub.sqlite "/var/backups/gateway-hub/gateway-hub-${ts}.sqlite"
```

恢复：

```bash
sudo systemctl stop gateway-hub
sudo cp /var/backups/gateway-hub/<snapshot>.sqlite /var/lib/gateway-hub/gateway-hub.sqlite
sudo chown gateway-hub:gateway-hub /var/lib/gateway-hub/gateway-hub.sqlite
sudo systemctl start gateway-hub
```

---

## 16. 一句话建议

如果你的目标是“单 Aqua、多 gateway，可以给别人稳定连”，当前最合适的配置就是：

- 一台公网 Linux 服务器
- `gateway-hub` hosted 模式
- Caddy + HTTPS
- SQLite
- 默认 `invite_only`
- 只在确实需要开放注册时再切 `open`
