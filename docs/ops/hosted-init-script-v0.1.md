# AquaClaw Hosted Init Script v0.1

更新时间：2026-03-16（Asia/Shanghai）
状态：Current fresh-host init guide

## 1. Purpose

`npm run ops:init:hosted` 是当前推荐的**fresh hosted 单实例初始化入口**。

它解决的问题是：

- quickstart 里的步骤已经足够清晰，但还是偏手工
- fresh host 上最常见的流程其实是固定的
- repo 已经有 render/check/deploy/backup/restore 积木，但缺少一个把这些积木串起来的 first-run 脚本

这个脚本的目标不是替代所有高级运维，而是收口“第一次把单实例 AquaClaw 正确跑起来”的主路径。

---

## 2. Intended Host Shape

当前脚本面向的目标机器是：

- 单台 Linux 主机
- 已经安装好 Node.js 22、npm、systemd、Caddy
- 已经把 repo clone 到机器上
- 这是一个**单用途或近似单用途**的 AquaClaw host

它最适合：

- 新 VPS
- 新云主机
- 干净的家庭服务器节点

它不优先针对：

- 已经承载多站点、且有复杂自定义 Caddyfile 的机器
- 多实例 / 多节点 / 负载均衡
- Postgres 或 federation 路径

---

## 3. Fastest Path

```bash
cd /opt/gateway-hub
npm run ops:init:hosted -- --domain aqua.example.com
```

脚本完成后，再执行：

```bash
npm run ops:bootstrap:hosted -- \
  --base-url https://aqua.example.com \
  --env-file /etc/gateway-hub/gateway-hub.env
```

然后用 doctor 再检查一遍：

```bash
npm run ops:doctor -- \
  --mode hosted \
  --env-file /etc/gateway-hub/gateway-hub.env \
  --base-url https://aqua.example.com
```

---

## 4. What The Script Does

默认情况下，这个脚本会按顺序做：

1. `npm ci`
2. `npm run build`
3. `npm test`
4. `npm run smoke`
5. hosted smoke
6. hosted + sqlite smoke
7. 调用 `scripts/render-hosted-single-instance.sh`
8. 创建 system user / group（如果还没有）
9. 安装 env file
10. 安装 systemd unit
11. 安装 Caddyfile
12. `systemctl daemon-reload`
13. 启动 / 重启 `gateway-hub`
14. 启动 / reload `caddy`
15. 跑 `npm run ops:check:hosted`

最后它会打印：

- env file 位置
- service file 位置
- Caddyfile 位置
- generated bootstrap key
- 下一步 owner bootstrap 命令

---

## 5. Safety Boundary

### 5.1 Caddyfile overwrite policy

这个脚本默认**不会静默覆盖**一个看起来已经被认真使用的 `/etc/caddy/Caddyfile`。

当前行为：

- 如果目标 Caddyfile 不存在：直接安装
- 如果目标 Caddyfile 是 repo 生成的同内容：直接安装/更新
- 如果目标 Caddyfile 看起来像默认 “Hello, world!” 示例：允许替换
- 其他情况：拒绝覆盖，并要求你显式传 `--overwrite-caddyfile`

这条边界是故意的，因为多站点机器最容易在这里踩坑。

### 5.2 服务用户

如果 `gateway-hub` system user / group 不存在，脚本会创建它。

### 5.3 权限

脚本需要系统级安装权限。

也就是说：

- 你要么直接用 root
- 要么当前用户需要 `sudo`

---

## 6. Common Commands

### 6.1 Standard fresh-host init

```bash
npm run ops:init:hosted -- --domain aqua.example.com
```

### 6.2 Explicit paths

```bash
npm run ops:init:hosted -- \
  --domain aqua.example.com \
  --repo-root /opt/gateway-hub \
  --config-dir /etc/gateway-hub \
  --data-dir /var/lib/gateway-hub \
  --backup-dir /var/backups/gateway-hub
```

### 6.3 Reuse an explicit bootstrap key

```bash
npm run ops:init:hosted -- \
  --domain aqua.example.com \
  --bootstrap-key your-secret-bootstrap-key
```

### 6.4 Skip Caddy install because you will merge config manually

```bash
npm run ops:init:hosted -- \
  --domain aqua.example.com \
  --skip-caddy-install \
  --skip-check
```

### 6.5 Force overwrite of an existing Caddyfile

```bash
npm run ops:init:hosted -- \
  --domain aqua.example.com \
  --overwrite-caddyfile
```

### 6.6 Install files but do not start services yet

```bash
npm run ops:init:hosted -- \
  --domain aqua.example.com \
  --skip-start
```

---

## 7. Important Flags

- `--domain`
  - 必填；同时驱动 render 和默认 `https://<domain>` check URL

- `--base-url`
  - 覆盖默认的 check URL

- `--skip-caddy-install`
  - 只安装 app 侧，不安装或 reload Caddyfile

- `--overwrite-caddyfile`
  - 允许覆盖一个非默认的 `/etc/caddy/Caddyfile`

- `--skip-npm-ci`
- `--skip-build`
- `--skip-tests`
- `--skip-local-smoke`
- `--skip-hosted-smoke`
- `--skip-hosted-sqlite-smoke`
  - 让你在已经验证过 repo 的前提下，缩短初始化时间

- `--skip-start`
  - 只安装，不启动服务

- `--skip-check`
  - 跳过最后的 hosted HTTP check

---

## 8. Outputs

默认生成/安装的关键路径：

- generated env: `./.deploy/hosted-single-instance/gateway-hub.env`
- installed env: `/etc/gateway-hub/gateway-hub.env`
- installed service: `/etc/systemd/system/gateway-hub.service`
- installed caddy: `/etc/caddy/Caddyfile`
- sqlite db: `/var/lib/gateway-hub/gateway-hub.sqlite`

---

## 9. What It Does Not Do

这个脚本不会：

- 安装 Node.js / Caddy 系统包
- 自动修改 DNS
- 帮你申请域名
- 做多站点 Caddy merge 策略
- 替代后续升级用的 `ops:deploy:hosted`

也就是说，它是**first install** 脚本，不是长期 deploy pipeline 的替代品。

---

## 10. After Init

初始化完成后，推荐顺序：

1. `npm run ops:bootstrap:hosted -- --base-url ... --env-file ...`
2. `npm run ops:doctor -- --mode hosted --env-file ... --base-url ...`
3. 之后日常运维再使用：
   - `ops:check:hosted`
   - `ops:backup:hosted`
   - `ops:restore:hosted`
   - `ops:deploy:hosted`

---

## 11. When To Fall Back To The Manual Quickstart

如果你满足下面任一情况，建议退回手工 quickstart：

- 这台机器已经承载多个站点
- 你不想让脚本碰 `/etc/caddy/Caddyfile`
- 你有自己的 systemd/Caddy 模板体系
- 你要做非标准目录布局

这时请改看：

- `docs/ops/hosted-single-instance-quickstart-v0.1.md`
- `docs/ops/hosted-deploy-v0.1.md`
