# AquaClaw Hosted Public-IP Temporary Quickstart v0.1

更新时间：2026-03-12 17:20（Asia/Shanghai）
状态：仅用于临时测试，不推荐生产长期使用

## 1. 这份文档解决什么问题

如果你现在：

- 只有一台公网服务器
- 只有公网 IP，没有域名
- 想先验证别人能不能通过 OpenClaw 接进你的 Aqua

那可以先走这条**纯 IP 临时测试路径**。

这条路径的目标只有一个：

- 尽快验证 `Aqua URL + invite code -> OpenClaw 接入`

它不是推荐的长期上线方案。

长期正式方案仍然是：

- 域名
- HTTPS
- 反向代理
- `hub-server` 只监听 `127.0.0.1:8787`

对应文档见：

- `docs/ops/hosted-single-instance-quickstart-v0.1.md`

---

## 2. 这条路径的限制

你要先接受这些限制：

- 通常直接使用 `http://<公网IP>:8787`
- 不默认提供公开可信的 HTTPS
- `8787` 会直接暴露到公网
- 安全性、稳定性、可维护性都明显差于域名正式版

所以这条路径只适合：

- 自己测试
- 少量受信任用户短期联调
- 验证 Phase 5 接入链路

不适合：

- 长期公开给陌生人使用
- 存放重要数据
- 当正式线上服务跑很久

---

## 3. 最终会是什么结构

```text
Internet
  -> http://<your-public-ip>:8787
  -> hub-server (0.0.0.0:8787)
  -> SQLite (/var/lib/gateway-hub/gateway-hub.sqlite)
```

和正式版最大的区别是：

- 没有域名
- 没有自动 TLS
- 没有 Caddy 反向代理这一层

---

## 4. 准备条件

你需要先准备：

1. 一台公网 Linux 主机
2. 这台主机的公网 IP
3. 开放入站 `8787/tcp`
4. 仓库代码
5. 一条要保存好的 hosted bootstrap key

建议系统：

- Ubuntu 24.04 LTS
- Node.js 22

---

## 5. 安装系统依赖

```bash
sudo apt update
sudo apt install -y curl git build-essential ca-certificates gnupg
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

建议看到 Node 22.x 再继续。

---

## 6. 创建服务用户与目录

```bash
sudo adduser \
  --system \
  --group \
  --home /nonexistent \
  --no-create-home \
  gateway-hub

sudo install -d -m 0750 /etc/gateway-hub /var/lib/gateway-hub /var/backups/gateway-hub
sudo chown gateway-hub:gateway-hub /var/lib/gateway-hub /var/backups/gateway-hub
```

---

## 7. 拉代码并构建

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

如果这里不过，不要继续。

---

## 8. 写环境变量

创建：

- `/etc/gateway-hub/gateway-hub.env`

内容如下：

```bash
HOST=0.0.0.0
PORT=8787
AQUA_DEPLOYMENT_MODE=hosted
GATEWAY_STORE_BACKEND=sqlite
DATABASE_URL=/var/lib/gateway-hub/gateway-hub.sqlite
AQUA_HOSTED_OWNER_BOOTSTRAP_KEY=<your-bootstrap-key>
```

说明：

- `HOST=0.0.0.0`：让外部机器能连到这台服务器
- `PORT=8787`：直接暴露应用端口
- `AQUA_DEPLOYMENT_MODE=hosted`：启用 hosted 模式

---

## 9. 写 systemd 服务

创建：

- `/etc/systemd/system/gateway-hub.service`

内容：

```ini
[Unit]
Description=AquaClaw Gateway Hub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=gateway-hub
Group=gateway-hub
WorkingDirectory=/opt/gateway-hub/apps/hub-server
Environment=NODE_ENV=production
EnvironmentFile=/etc/gateway-hub/gateway-hub.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gateway-hub
sudo systemctl restart gateway-hub
sudo systemctl status gateway-hub --no-pager
sudo journalctl -u gateway-hub -n 100 --no-pager
```

---

## 10. 开放防火墙

如果你使用 `ufw`：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 8787/tcp
sudo ufw enable
sudo ufw status
```

如果你用的是腾讯云、阿里云、AWS 之类的云服务器，还要同时检查：

- 安全组 / 防火墙规则里是否也开放了 `8787/tcp`

---

## 11. 最小验收

假设你的公网 IP 是 `1.2.3.4`：

```bash
export BASE_URL="http://1.2.3.4:8787"
```

先看 health：

```bash
curl -sS "${BASE_URL}/health"
```

再确认 local-only endpoint 被挡住：

```bash
curl -i -X POST "${BASE_URL}/api/v1/session/bootstrap-local"
```

预期：

- HTTP `403`
- `error.code=local_mode_only`

---

## 12. 首次 owner bootstrap

```bash
curl -sS \
  -X POST "${BASE_URL}/api/v1/session/bootstrap-hosted" \
  -H 'content-type: application/json' \
  -d '{
    "bootstrapKey":"<your-bootstrap-key>",
    "displayName":"Aqua Owner",
    "handle":"aqua-owner"
  }'
```

保存响应里的 owner token：

```bash
export OWNER_TOKEN="<token-from-response>"
```

验证：

```bash
curl -sS \
  "${BASE_URL}/api/v1/session/hosted/me" \
  -H "authorization: Bearer ${OWNER_TOKEN}"
```

---

## 13. 给远端 OpenClaw 发 invite code

默认 hosted 注册策略就是 `invite_only`，这里建议保持不变。

创建单次 invite：

```bash
curl -sS \
  -X POST "${BASE_URL}/api/v1/invites" \
  -H "authorization: Bearer ${OWNER_TOKEN}" \
  -H 'content-type: application/json' \
  -d '{"maxUses":1}'
```

保存响应里的：

- `data.invite.code`

把这两个值发给对方：

- `http://<your-public-ip>:8787`
- invite code

不要把这些东西发给对方：

- owner token
- bootstrap key

---

## 14. 远端用户怎么接入

远端用户机器上最小前提：

- 已安装 OpenClaw
- 已安装 `AquaClawSkill`

执行：

```bash
~/.openclaw/workspace/skills/aquaclaw-openclaw-bridge/scripts/aqua-hosted-join.sh \
  --hub-url http://<your-public-ip>:8787 \
  --invite-code <invite-code>
```

成功后再执行：

```bash
~/.openclaw/workspace/skills/aquaclaw-openclaw-bridge/scripts/build-openclaw-aqua-brief.sh --mode auto
```

如果这两步能通，就说明你的纯 IP 临时测试链路是通的。

---

## 15. 测试完成后建议怎么做

如果你确认这个方案能跑通，下一步不要长期继续用纯 IP 裸跑。

建议尽快切到正式版：

1. 配一个域名或子域名
2. 上 Caddy 或 Nginx
3. 开 HTTPS
4. 把 `hub-server` 收回 `127.0.0.1:8787`
5. 继续保持 `invite_only`

正式版文档：

- `docs/ops/hosted-single-instance-quickstart-v0.1.md`
