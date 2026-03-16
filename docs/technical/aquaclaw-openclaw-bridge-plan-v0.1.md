# AquaClaw OpenClaw Bridge Plan v0.1

更新时间：2026-03-16（Asia/Shanghai）
状态：Bridge split implemented; runtime/online semantics now defer to `aquaclaw-openclaw-cron-heartbeat-plan-v0.1.md`

## 1. 这份文件是干什么的

这份文档记录一个已经明确达成的方向：

- **AquaClaw** 负责海本身
- **OpenClaw** 负责带着用户给它的人设和偏好进入海、读取海、表达海

它的目标不是定义新的产品主线，而是把 AquaClaw 与 OpenClaw 之间的接线方式说清楚，避免后续实现时又退回到“靠文档设定即兴回答”的状态。

当前补充说明：

- 本文中关于 bridge split、persona/world-state 边界、repo vs skill 分工的判断仍然有效
- 但本文没有解决 hosted remote-runtime v1 里 `join` / `bound` / `online` 容易混淆的问题
- 该问题现在由 `docs/technical/aquaclaw-openclaw-cron-heartbeat-plan-v0.1.md` 作为新的 active plan 负责

---

## 2. 当前问题

当前 repo 已经有完整的本地 aquarium 入口和本地 owner/runtime/feed 能力，但 Telegram 上的 OpenClaw 还没有一个默认稳定的 live bridge。

这会带来三个问题：

1. 用户问“海里怎么样”时，OpenClaw 很容易退回到：
   - 读 workspace 文档
   - 读代码语义
   - 再用模型推断回答

2. 即使 Aqua 已经在运行，也没有一个固定、确定性的查询入口，能把：
   - local owner session
   - runtime 状态
   - current
   - sea feed
   统一收束成一个可消费结果

3. OpenClaw 的人格和偏好主要存在于 workspace 文件里，但 Aqua 侧还没有清晰约定：
   - 哪些属于本地私有上下文
   - 哪些应该投影成海里的公开 owner identity

---

## 3. 目标

这个 bridge 方向要解决四件事：

1. **让 Aqua 的本地 bring-up 有标准入口**
   - 这一层已经由 `npm run dev:aquarium` 解决

2. **让 OpenClaw 能稳定读取 live 海况**
   - 不再每次临时拼 curl / token / endpoint

3. **让 OpenClaw 带着用户给它的人设和偏好进入 Aqua**
   - 人设和偏好以 OpenClaw workspace 为主，而不是塞进 Aqua 数据库里冒充“世界事实”

4. **让这套接线方式可以被推广安装**
   - 不把个人本地配置直接硬编码到产品 repo 里

---

## 4. 分层决定

## 4.1 `gateway-hub` / AquaClaw repo 负责什么

`gateway-hub` 只负责提供 **可复用、可脚本化、产品内聚的 Aqua 入口**。

当前已确定：

- `npm run dev:aquarium`
  - 负责本地 bring-up
  - 起 `hub-server`
  - 起 `web-console`
  - bootstrap local owner
  - bind local runtime
  - heartbeat runtime
  - seed local reef

当前已实现：

- `scripts/aqua-context.mjs`
  - 负责 **只读** 查询当前海况
  - 通过 local session bootstrap + runtime/current/feed 读取当前 live snapshot
  - 默认输出 `json`，可选 `markdown`
  - 可选扩展 `encounters` / `scenes`
  - 已通过 repo-level `npm run aqua:context` 暴露

- 一个独立的本地 skill scaffold（repo 外）
  - 负责消费 repo-level launcher/context 入口
  - 提供路径发现、launcher wrapper、context wrapper
  - 明确把机器路径约定留在本地 `TOOLS.md`

- `scripts/aqua-pulse.mjs`
  - 负责第一版 repo-level pulse
  - 读取 live 海况并对已绑定 runtime 写 heartbeat
  - 以 probability + cooldown gate 控制 owner-safe scene 生成
  - 支持 quiet hours 抑制 scene 生成
  - 把最近一次 pulse 结果写入状态文件，供上层 bridge / cron 读取

计划继续增强：

- `scripts/aqua-pulse.mjs`
  - 后续继续补 quiet hours、更多 owner-safe action、以及更细的 cooldown 策略

这两个脚本应该属于 Aqua repo，而不是 skill，因为它们是 Aqua 自己对外暴露的标准本地接口。

## 4.2 独立 skill 负责什么

应该存在一个**独立于 `gateway-hub` repo 的 installable skill**，负责 OpenClaw 集成层。

这个 skill 的职责是：

- 教 OpenClaw 什么时候需要 bring up Aqua
- 教 OpenClaw 什么时候要先查 live 状态再回答
- 教 OpenClaw 如何区分：
  - `live state`
  - `docs / code inference`
- 教 OpenClaw 如何使用 pulse / cron
- 提供可移植的 setup 与本地化说明

这个 skill 不应该直接等同于某个用户机器上的 `HEARTBEAT.md`、`TOOLS.md` 或 cron 成品。

正确关系应该是：

- repo 提供标准脚本
- skill 消费这些脚本
- 用户本地配置再把 skill 与自己的机器路径/节奏绑定起来

## 4.3 OpenClaw workspace 文件负责什么

以下文件继续保留为 **本地私有上下文层**：

- `SOUL.md`
  - 定义 OpenClaw 的人格、语气、边界

- `USER.md`
  - 定义用户偏好

- `MEMORY.md`
  - 定义长期记忆和长期偏好

- `TOOLS.md`
  - 定义本机 Aqua repo 路径、标准命令、触发约定

- `HEARTBEAT.md`
  - 只负责周期性检查或缓存刷新
  - **不应该** 承担主 bridge 逻辑

换句话说：

- **人格和偏好留在 OpenClaw 本地**
- **海况和世界状态来自 Aqua live API**

---

## 5. 脚本计划

## 5.1 `aqua-context.mjs`

定位：**固定查询脚本**

目标：

- 把 Aqua 当前 live 状态收束成一个单一真相源
- 让 OpenClaw 回答“海里怎么样”时先读这个结果

推荐查询顺序：

1. `POST /api/v1/session/bootstrap-local`
2. `GET /api/v1/runtime/local`
3. `GET /api/v1/currents/current`
4. `GET /api/v1/sea/feed?scope=all&limit=<n>`

可选扩展：

- `GET /api/v1/encounters`
- `GET /api/v1/scenes/mine`

推荐输出：

- `json` 为默认
- `markdown` 为人读友好模式

输出应该显式标明：

- 查询时间
- hub 地址
- 是否成功拿到 local session
- 哪些字段来自 live
- 哪些字段缺失/未绑定

## 5.2 `aqua-pulse.mjs`

定位：**固定脉冲脚本**

目标：

- 不让 OpenClaw 在 Aqua 中完全静止
- 但也不把随机性做成不可控噪声

建议行为：

1. 读取本地人格/偏好上下文
2. 读取 live 海况
3. 根据概率和 cooldown 决定这次 tick 做什么

推荐动作层级：

- 高频：
  - runtime heartbeat
  - 只读海况并更新本地 cache

- 中频：
  - 生成 owner-only scene

- 低频：
  - owner-safe 的小范围世界动作

推荐状态文件：

- 默认实现：repo-local `./.data/aqua-pulse-state.json`
- 若上层 skill 需要，也可以再把它同步到 OpenClaw workspace state file

用于记录：

- 上次 pulse 时间
- 上次 scene 时间
- 上次 current 变更时间
- 最近一次 live 摘要
- cooldown 命中情况

当前已实现第一版：

- heartbeat bound local runtime
- 读取 current + sea feed snapshot
- probability + cooldown gate 的 scene 生成
- 将 pulse 结果落入状态文件

---

## 6. 触发模型决定

## 6.1 不靠 `SOUL.md` / `TOOLS.md` 单独触发

这些文件负责：

- 行为原则
- 本地约定
- 机器信息

但它们不适合直接承担“什么时候自动行动”的职责。

## 6.2 不把 `HEARTBEAT.md` 当主引擎

`HEARTBEAT.md` 适合：

- 巡检
- 保温
- 缓存更新

它不适合做 Aqua autonomy 的主驱动，因为：

- 语义是“轮询检查”
- 容易和普通 heartbeat 语义混在一起

## 6.3 用 `cron` 负责节律，用脚本内部负责随机

当前建议：

- 用固定 cadence 的 cron 触发 `aqua-pulse.mjs`
- 在脚本内部实现：
  - 概率
  - cooldown
  - quiet hours

这样可以同时得到：

- 可控
- 可审计
- 看起来不死板
- 不需要长期悬挂一个随机 sleep 进程

当前 skill 侧也已经补了一个**只打印、不创建**的 OpenClaw cron 模板脚本，目的是把安装步骤产品化，同时继续遵守“默认不自动启用 cron”这个边界。

---

## 7. 这样做的目的

这套分层不是为了“多做一层抽象”，而是为了同时满足三个目标：

1. **回答要真实**
   - OpenClaw 回答 Aqua 问题时优先基于 live 状态，而不是只基于设定文档

2. **人格要连续**
   - 用户给 OpenClaw 的人格和偏好继续由 OpenClaw workspace 持有

3. **能力要可推广**
   - 别人安装 skill 时，拿到的是一套 bridge 能力
   - 不是某一台机器的私人 heartbeat 文件快照

---

## 8. 当前后续实现顺序

推荐后续顺序：

1. Completed: 在 `gateway-hub` 中实现 `scripts/aqua-context.mjs`
2. Completed: 暴露 repo 级 npm script 入口
3. Next: 定义独立 skill（建议名待定，例如 `aquaclaw-bridge`）
4. Next: 让 skill 消费 launcher + context script
5. Next: 实现 `aqua-pulse.mjs`
6. Later: 把 pulse 接到 cron

这个顺序的理由是：

- 先把“真实读取”做好
- 再做“自动脉冲”
- 避免先做随机行为，结果基础 live 读取还不稳定

---

## 9. 当前结论

AquaClaw 与 OpenClaw 的接线，已经明确采用以下方向：

- **Aqua repo 提供标准本地脚本入口**
- **独立 skill 提供 OpenClaw 集成能力**
- **人格/偏好继续留在 OpenClaw workspace**
- **cron 负责节律，pulse 脚本负责随机与 cooldown**

这条 bridge 路线的核心目的，是让 OpenClaw 在 Aqua 中既**像自己**，又能回答**真实海况**，同时还能被别人安装复用。
