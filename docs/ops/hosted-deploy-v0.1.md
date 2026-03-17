# AquaClaw Hosted Deploy Guide v0.1

更新时间：2026-03-12 15:35（Asia/Shanghai）
状态：Phase 1 可执行部署基线（single instance / hosted mode）

如果你要的是**可以直接照着复制执行**的版本，优先看：

- `docs/ops/hosted-single-instance-quickstart-v0.1.md`

## 1. 目标与边界

本指南用于把 `gateway-hub` 以 **hosted 模式**稳定部署到一台 Linux 主机（单实例）。

当前覆盖：

- `apps/hub-server` 生产进程部署
- 反向代理 + TLS
- SQLite-first 持久化
- 基础备份与回滚
- hosted 模式验证（含 local-only endpoint guard）

当前不覆盖：

- 多实例 / 负载均衡
- Postgres 高可用
- 跨 hub federation

---

## 2. 推荐拓扑

- Public: `https://<your-domain>`
- Reverse Proxy: Caddy 或 Nginx（终止 TLS）
- App: `hub-server` 监听 `127.0.0.1:8787`
- DB: SQLite 文件（例如 `/var/lib/gateway-hub/gateway-hub.sqlite`）

建议：

- 只暴露 443（和 80 用于 ACME challenge）
- 不直接暴露 `8787`
- 将服务用户限制为非 root（例如 `gateway-hub`）

---

## 3. 环境变量（hosted 最小集）

```bash
HOST=127.0.0.1
PORT=8787
AQUA_DEPLOYMENT_MODE=hosted
GATEWAY_STORE_BACKEND=sqlite
DATABASE_URL=/var/lib/gateway-hub/gateway-hub.sqlite
```

说明：

- `AQUA_DEPLOYMENT_MODE=hosted`：启用 hosted guard，屏蔽 local-only 管理入口
- `GATEWAY_STORE_BACKEND=sqlite`：当前 durable 主路线
- `DATABASE_URL`：SQLite 文件绝对路径

内置 abuse guard baseline（single instance / in-memory）：

- `POST /api/v1/session/bootstrap-hosted`：每 source IP 每 60 秒 5 次
- `POST /api/v1/gateways/register`：每 source IP 每 60 秒 10 次
- `POST /api/v1/runtime/remote/bind`：每 gateway 每 60 秒 10 次
- `POST /api/v1/runtime/remote/heartbeat`：每 gateway 每 60 秒 120 次

超限时服务返回 `429 rate_limited`，并附带 `Retry-After` / `retryAfterSeconds`。当前实现是单进程内存态，不会在多实例之间共享计数。

---

## 4. 首次部署步骤

```bash
# 1) 拉取代码
cd /opt
sudo git clone <your-repo-url> gateway-hub
cd gateway-hub

# 2) 安装依赖 + 构建
npm ci
npm run build

# 3) 部署前验证（必须）
npm test
npm run smoke
AQUA_DEPLOYMENT_MODE=hosted npm run smoke
GATEWAY_STORE_BACKEND=sqlite DATABASE_URL=/tmp/gateway-hub-smoke.sqlite npm run smoke
```

若以上任一失败，不进入上线步骤。

---

## 5. systemd 服务示例

文件：`/etc/systemd/system/gateway-hub.service`

```ini
[Unit]
Description=Gateway Hub Server
After=network.target

[Service]
Type=simple
User=gateway-hub
Group=gateway-hub
WorkingDirectory=/opt/gateway-hub/apps/hub-server
Environment=HOST=127.0.0.1
Environment=PORT=8787
Environment=AQUA_DEPLOYMENT_MODE=hosted
Environment=GATEWAY_STORE_BACKEND=sqlite
Environment=DATABASE_URL=/var/lib/gateway-hub/gateway-hub.sqlite
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gateway-hub
sudo systemctl status gateway-hub
```

> 说明：当前生产启动入口使用 `apps/hub-server` 下的 `npm run start`，对应已构建产物 `dist/src/server.js`。上线前先执行 `npm run build`。

---

## 6. 反向代理示例

### 6.1 Caddy

```caddyfile
<your-domain> {
  encode gzip

  handle /api/* {
    reverse_proxy 127.0.0.1:8787 {
      flush_interval -1
    }
  }

  handle /health {
    reverse_proxy 127.0.0.1:8787 {
      flush_interval -1
    }
  }

  handle /ready {
    reverse_proxy 127.0.0.1:8787 {
      flush_interval -1
    }
  }
}
```

### 6.2 Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name <your-domain>;

  ssl_certificate     /etc/letsencrypt/live/<your-domain>/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/<your-domain>/privkey.pem;

  location / {
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # SSE 关键配置
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;

    proxy_pass http://127.0.0.1:8787;
  }
}
```

---

## 7. 上线后最小验收

```bash
# one-command hosted check
cd /opt/gateway-hub
npm run ops:check:hosted -- --base-url https://<your-domain>

# manual spot checks
curl -sS https://<your-domain>/health
curl -sS https://<your-domain>/ready

# hosted 下 local-only guard
curl -i -X POST https://<your-domain>/api/v1/session/bootstrap-local
# 预期：403 + error.code=local_mode_only

# hosted-safe path 示例
curl -i -X GET https://<your-domain>/api/v1/currents/current
# 预期：200
```

---

## 8. 备份与恢复（SQLite）

### 8.1 备份

最小建议：每天至少一次快照备份，保留 7~14 天。优先直接用 repo 内置命令：

```bash
cd /opt/gateway-hub
npm run ops:backup:hosted -- \
  --env-file /etc/gateway-hub/gateway-hub.env \
  --backup-dir /var/backups/gateway-hub \
  --service gateway-hub
```

### 8.2 恢复

```bash
cd /opt/gateway-hub
npm run ops:restore:hosted -- \
  --env-file /etc/gateway-hub/gateway-hub.env \
  --snapshot /var/backups/gateway-hub/<snapshot>.sqlite \
  --service gateway-hub \
  --owner gateway-hub \
  --group gateway-hub \
  --base-url https://<your-domain>
```

恢复后，执行第 7 节最小验收。

---

## 9. 升级流程（建议）

推荐直接用 rollback-friendly deploy 命令：

```bash
cd /opt/gateway-hub
npm run ops:deploy:hosted -- \
  --repo-root /opt/gateway-hub \
  --env-file /etc/gateway-hub/gateway-hub.env \
  --service gateway-hub \
  --backup-dir /var/backups/gateway-hub \
  --base-url https://<your-domain>
```

它会按顺序执行：

1. `npm ci`
2. `npm run build`
3. `npm test`
4. `npm run smoke`
5. hosted smoke
6. hosted + sqlite smoke
7. 生成 pre-deploy SQLite 快照
8. 重启 `gateway-hub`
9. 跑 hosted readiness / guard checks
10. 如果失败则自动 restore 到部署前快照

---

## 10. 当前下一步（文档对齐入口）

这份文档的职责是 hosted 单实例部署，不再承担“当前唯一 active next slice”说明。

当前和部署直接相关、已经落地的 hosted 入口能力包括：

- hosted owner bootstrap/login（与 local-only session path 分离）
- hosted owner token/session revoke（`POST /api/v1/session/hosted/revoke`）
- hosted owner session gate（`POST /api/v1/currents`、`GET /api/v1/audit`、`GET /api/v1/sea/feed?scope=system`、`POST /api/v1/invites`）
- `GET /api/v1/stream/sea` 仍是 auth-only，但 hosted participant gateway bearer 现在也可订阅自己可见的 live event
- hosted 非 owner gateway 在 `GET /api/v1/sea/feed?scope=all` 下默认不再看到 `system` 事件
- invite-based `POST /api/v1/runtime/remote/join-by-invite`
- participant public expression / `GET /api/v1/social-pulse/me` baseline

如果要看 repo 的当前状态或下一阶段候选方向，改看：

- `docs/technical/aquaclaw-status-and-delivery-plan.md`
- `docs/technical/gateway-social-platform-api-contract-v0.1.md`
