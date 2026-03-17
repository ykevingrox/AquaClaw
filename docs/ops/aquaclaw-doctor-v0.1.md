# AquaClaw Doctor Script v0.1

更新时间：2026-03-16（Asia/Shanghai）
状态：Current local/hosted diagnostics guide

## 1. Purpose

`npm run ops:doctor` 是一个统一诊断入口。

它的目标不是替代所有 smoke test，而是快速回答：

- 我的本地配置是不是合法
- 我的 hosted env 文件是不是缺关键项
- 服务是不是活着
- 基础 HTTP surface 是不是通

---

## 2. Modes

当前支持两个模式：

- `--mode local`
- `--mode hosted`

---

## 3. Local Mode

### 3.1 Fastest path

```bash
npm run ops:doctor -- --mode local
```

### 3.2 What it checks

local 模式会尽量做这些事：

- 读取 `./.aquaclaw/local-dev.json`（如果存在）
- 校验 `dev:aquarium` 相关选项
- 如果 backend=`sqlite`，检查数据库路径是否能创建
- 尝试访问本地 hub `/health`
- 尝试访问本地 web-console `/__console_meta`

### 3.3 Result semantics

local 模式下：

- 配置问题通常是 `fail`
- 本地服务没启动通常只是 `warn`

这是故意的，因为本地 doctor 很多时候是在**启动前**跑的。

### 3.4 Examples

```bash
npm run ops:doctor -- --mode local
npm run ops:doctor -- --mode local --config /tmp/aqua-local.json
npm run ops:doctor -- --mode local --hub-url http://127.0.0.1:9000 --web-url http://127.0.0.1:4175
```

---

## 4. Hosted Mode

### 4.1 Fastest path

```bash
npm run ops:doctor -- \
  --mode hosted \
  --config-env-file /etc/gateway-hub/gateway-hub.env \
  --base-url https://aqua.example.com
```

### 4.2 What it checks

hosted 模式当前会检查：

- env file 是否可读
- `AQUA_DEPLOYMENT_MODE=hosted`
- `GATEWAY_STORE_BACKEND=sqlite`
- `DATABASE_URL` 是否存在且父目录可写/可创建
- `AQUA_HOSTED_OWNER_BOOTSTRAP_KEY` 是否存在
- heartbeat thresholds 是否有效
- `HOST` / `PORT` 是否看起来合理
- systemd service 是否 active
- public HTTP checks：
  - `/health`
  - `/ready`
  - `GET /api/v1/public/current`
  - hosted 下 `bootstrap-local` guard 是否正确返回 `403 local_mode_only`

### 4.3 Examples

```bash
npm run ops:doctor -- \
  --mode hosted \
  --config-env-file /etc/gateway-hub/gateway-hub.env \
  --service gateway-hub \
  --base-url https://aqua.example.com
```

如果你只想看 env 校验，不想跑 HTTP：

```bash
npm run ops:doctor -- \
  --mode hosted \
  --config-env-file /etc/gateway-hub/gateway-hub.env
```

---

## 5. Output Semantics

doctor 会输出三种状态：

- `pass`
- `warn`
- `fail`

退出码规则：

- 有任意 `fail`：退出码 `1`
- 只有 `pass` / `warn`：退出码 `0`

这意味着它可以直接放进 shell 脚本或 CI 风格检查链里。

---

## 6. Typical Usage Order

### Local

建议顺序：

1. `npm run dev:configure`（可选）
2. `npm run ops:doctor -- --mode local`
3. `npm run dev:aquarium`

### Hosted

建议顺序：

1. `npm run ops:init:hosted`
2. `npm run ops:bootstrap:hosted`
3. `npm run ops:doctor -- --mode hosted ...`

---

## 7. What Doctor Does Not Replace

它不会替代：

- `npm test`
- `npm run smoke`
- `npm run ops:check:hosted`
- 完整 deploy / restore 验证

doctor 更像一个快速 triage 入口。

如果你要完整 hosted 上线验收，仍然要配合：

- `docs/ops/hosted-single-instance-quickstart-v0.1.md`
- `npm run ops:check:hosted`
- `npm run ops:deploy:hosted`

---

## 8. Recommended Habit

最实用的用法其实很简单：

- 本地：改完 `dev` 配置先跑一次 doctor
- 服务器：每次首装、改 env、改反代、改权限后都跑一次 doctor

这样很多路径错误、模式错误、目录权限错误都会更早暴露。
