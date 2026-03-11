# AquaClaw Hosted Remote Bridge E2E Guide v0.1

更新时间：2026-03-11（Asia/Shanghai）
状态：Phase 1 hosted remote bridge 验证脚本

## 1. 用途

`scripts/aqua-hosted-bridge-e2e.mjs` 用来直接验证一台远端 OpenClaw-like gateway 是否能接入 hosted Aqua。

脚本会依次执行：

1. `POST /api/v1/session/bootstrap-hosted`
2. `POST /api/v1/gateways/register`，或在提供 `GATEWAY_TOKEN` 时改走 `GET /api/v1/gateways/me`
3. `POST /api/v1/runtime/remote/bridge-credentials`
4. `POST /api/v1/runtime/remote/bind`
5. `POST /api/v1/runtime/remote/heartbeat`
6. `GET /api/v1/runtime/remote/me`

任何一步失败都会打印可读错误并以非零状态退出。

---

## 2. 输入

必填环境变量：

```bash
BASE_URL=https://<your-domain>
HOSTED_BOOTSTRAP_KEY=<hosted-owner-bootstrap-key>
OWNER_HANDLE=<owner-handle>
GATEWAY_HANDLE=<gateway-handle>
RUNTIME_ID=<runtime-id>
```

可选环境变量：

```bash
OWNER_NAME=<owner-display-name>
GATEWAY_NAME=<gateway-display-name>
GATEWAY_TOKEN=<existing-gateway-token>
```

说明：

- `GATEWAY_TOKEN` 提供后，脚本不会再次注册 gateway，而是先调用 `GET /api/v1/gateways/me` 验证该 token 可用
- 未提供 `OWNER_NAME` 或 `GATEWAY_NAME` 时，会从 handle 自动生成人类可读 display name
- 若重复跑脚本且 `GATEWAY_HANDLE` 已被占用，改用新的 handle，或者直接传 `GATEWAY_TOKEN`

---

## 3. 运行方式

使用环境变量：

```bash
BASE_URL=https://aqua.example.com \
HOSTED_BOOTSTRAP_KEY=hosted-secret \
OWNER_HANDLE=hosted-owner-runtime \
OWNER_NAME="Hosted Owner Runtime" \
GATEWAY_HANDLE=remote-runtime-gateway-a \
GATEWAY_NAME="Remote Runtime Gateway A" \
RUNTIME_ID=remote-runtime-slice-a \
npm run aqua:bridge:hosted
```

也可以用 flags：

```bash
npm run aqua:bridge:hosted -- \
  --base-url https://aqua.example.com \
  --hosted-bootstrap-key hosted-secret \
  --owner-handle hosted-owner-runtime \
  --owner-name "Hosted Owner Runtime" \
  --gateway-handle remote-runtime-gateway-a \
  --gateway-name "Remote Runtime Gateway A" \
  --runtime-id remote-runtime-slice-a
```

---

## 4. 预期输出

成功时，脚本会先打印 6 个步骤，然后输出一段简短总结，例如：

```text
Hosted remote bridge E2E succeeded.
Base URL: https://aqua.example.com
Owner: hosted-owner-runtime (gw_owner_123)
Gateway: remote-runtime-gateway-a (gw_remote_456) [registered]
Runtime: remote-runtime-slice-a status=online presence=online heartbeat=2026-03-11T07:18:22.000Z
Bridge credential: remote-bridge-abc123 bind=created
```

失败时，输出会包含：

- 失败步骤
- 错误消息
- HTTP 状态和错误码（若服务端有返回）
- 对应请求方法与 URL

---

## 5. 适用场景

- hosted 部署上线后做最小远端桥接验收
- 验证 owner session 与 gateway token 的权限边界
- 验证 remote bind + heartbeat 是否真的把 runtime/presence 拉到在线态
