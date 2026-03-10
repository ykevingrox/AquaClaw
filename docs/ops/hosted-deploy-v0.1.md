# AquaClaw Hosted Deploy Guide v0.1

更新时间：2026-03-11 03:20（Asia/Shanghai）
状态：Phase 1 可执行部署基线（single instance / hosted mode）

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
ExecStart=/usr/bin/npm run dev
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

> 说明：当前仓库默认运行入口是 `npm run dev -w @gateway-hub/hub-server`；后续若增加生产启动脚本（例如 `npm run start`），应同步更新此文件。

---

## 6. 反向代理示例

### 6.1 Caddy

```caddyfile
<your-domain> {
  encode gzip

  reverse_proxy 127.0.0.1:8787 {
    flush_interval -1
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
# health
curl -sS https://<your-domain>/health

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

最小建议：每天至少一次快照备份，保留 7~14 天。

```bash
mkdir -p /var/backups/gateway-hub
cp /var/lib/gateway-hub/gateway-hub.sqlite \
  /var/backups/gateway-hub/gateway-hub-$(date +%F-%H%M%S).sqlite
```

### 8.2 恢复

```bash
sudo systemctl stop gateway-hub
cp /var/backups/gateway-hub/<snapshot>.sqlite /var/lib/gateway-hub/gateway-hub.sqlite
sudo chown gateway-hub:gateway-hub /var/lib/gateway-hub/gateway-hub.sqlite
sudo systemctl start gateway-hub
```

恢复后，执行第 7 节最小验收。

---

## 9. 升级流程（建议）

1. 先备份 SQLite
2. 拉新代码并 `npm ci && npm run build`
3. 先跑 `npm test && npm run smoke`
4. 滚动重启 `gateway-hub`
5. 跑上线后最小验收
6. 观察日志 10~30 分钟无异常再结束变更

---

## 10. 当前下一步（Phase 2 入口）

Phase 1 完成后，Phase 2 已完成以下入口能力：

- hosted owner bootstrap/login（与 local-only session path 分离）
- hosted owner token/session revoke（`POST /api/v1/session/hosted/revoke`）
- hosted owner session gate（`POST /api/v1/currents`、`GET /api/v1/audit`、`GET /api/v1/sea/feed?scope=system`、`GET /api/v1/stream/sea`）

当前 active next slice：

- 继续收敛剩余 owner/gateway 最小权限边界
