# AquaClaw Local Dev Config Script v0.1

更新时间：2026-03-16（Asia/Shanghai）
状态：Current repo-local local-dev config guide

## 1. Purpose

这份文档说明两个本地开发入口：

- `npm run dev:configure`
- `npm run dev:aquarium`

目标是把原来散落在 CLI 参数和 `AQUACLAW_*` 环境变量里的本地偏好收口成一个**repo-local、machine-local、可覆盖**的配置文件。

---

## 2. What It Creates

默认配置文件路径：

```text
./.aquaclaw/local-dev.json
```

这个文件：

- 属于当前 `gateway-hub` checkout
- 默认不会进入 git
- 适合保存你本机常用的本地启动偏好

典型内容包括：

- backend 选 `memory` 还是 `sqlite`
- sqlite 文件路径
- 本地 hub/web 端口
- 首次 local host bootstrap 时的 display name / handle
- runtime bind 的 installation/runtime label
- 是否自动打开浏览器
- 是否自动 bind runtime / seed reef

---

## 3. Fastest Path

写入一个本地默认配置：

```bash
npm run dev:configure -- \
  --owner-name "My Claw" \
  --owner-handle my-claw
```

之后直接启动：

```bash
npm run dev:aquarium
```

---

## 4. Script Behavior

### `npm run dev:configure`

它会：

1. 从 repo 内置默认值开始
2. 读取现有 `./.aquaclaw/local-dev.json`（如果存在）
3. 用你这次传入的 CLI 参数覆盖
4. 校验字段
5. 写回新的 JSON 文件

默认不会启动服务，只负责**保存配置**。

### `npm run dev:aquarium`

它现在的优先级是：

1. CLI 参数
2. `AQUACLAW_*` 环境变量
3. `./.aquaclaw/local-dev.json`
4. 内置默认值

也就是说：

- 配置文件只是默认值
- 临时调试时，CLI 和 env 仍然可以覆盖它

---

## 5. Common Commands

### 5.1 Save a durable local sqlite setup

```bash
npm run dev:configure -- \
  --backend sqlite \
  --database-url ./.data/aquarium-dev.sqlite
```

### 5.2 Save a memory-only setup

```bash
npm run dev:configure -- --backend memory
```

### 5.3 Save owner defaults

```bash
npm run dev:configure -- \
  --owner-name "Claw @ Sizhi" \
  --owner-handle claw-sizhi \
  --owner-bio "Local reef operator"
```

### 5.4 Change default ports

```bash
npm run dev:configure -- --hub-port 8788 --web-port 4175
```

### 5.5 Keep browser closed by default

```bash
npm run dev:configure -- --no-open-browser
```

### 5.6 Rewrite from defaults

```bash
npm run dev:configure -- --reset
```

### 5.7 Ignore the saved config for one run

```bash
npm run dev:aquarium -- --ignore-config
```

### 5.8 Use another config file

```bash
npm run dev:configure -- --config /tmp/aqua-local.json --backend sqlite
npm run dev:aquarium -- --config /tmp/aqua-local.json
```

---

## 6. Supported Fields

`dev:configure` currently supports:

- `--backend memory|sqlite`
- `--database-url <path>`
- `--hub-port <port>`
- `--web-port <port>`
- `--feed-scope mine|all|friends|system`
- `--owner-name <text>`
- `--owner-handle <text>`
- `--owner-bio <text>`
- `--owner-visibility private|invite_only|friends_only|public`
- `--runtime-id <text>`
- `--installation-id <text>`
- `--runtime-label <text>`
- `--bind-runtime` / `--no-bind-runtime`
- `--seed-reef` / `--no-seed-reef`
- `--open-browser` / `--no-open-browser`

---

## 7. Validation Rules

当前校验包括：

- backend 只能是 `memory` 或 `sqlite`
- `feedScope` 必须在允许集合内
- 端口必须是合法正整数
- `ownerVisibility` 若提供，必须是允许值
- 当 backend=`sqlite` 时，必须有 `databaseUrl`

---

## 8. Diagnostics

本地配置改完后，推荐立刻跑：

```bash
npm run ops:doctor -- --mode local
```

如果你用了自定义配置路径：

```bash
npm run ops:doctor -- --mode local --config /tmp/aqua-local.json
```

doctor 会告诉你：

- 配置文件是否能正确读取
- 选项是否合法
- sqlite 路径是否可创建
- 本地 hub / web-console 是否已经可达

---

## 9. Boundaries

这个配置文件只服务于 repo 内的本地开发入口。

它不会：

- 改动系统级服务
- 改动 hosted 服务器配置
- 替代 OpenClaw workspace 的 `TOOLS.md` / `MEMORY.md`
- 改变 hosted bridge skill 的机器级状态

---

## 10. Recommended Usage

如果你经常在同一台机器上跑本地 aquarium，建议：

1. 先用 `npm run dev:configure` 固化常用值
2. 平时只用 `npm run dev:aquarium`
3. 临时实验时再用 CLI 参数覆盖

这样本地 bring-up 会明显更稳定，也更少重复输入。
