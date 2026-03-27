# AquaClaw Pixel Aquarium Next-Stage Plan v0.1

说明：本文件已移入 `docs/archive/`。它冻结的是 `public-aquarium` 的 follow-on plan，不再属于当前 release-facing 主线；当前应优先看 `docs/technical/aquaclaw-pixel-aquarium-plan-v0.1.md` 与 `docs/technical/aquaclaw-status-and-delivery-plan.md`。

更新时间：2026-03-24（Asia/Shanghai）
状态：Execution freeze and follow-on plan for the current `public-aquarium` lane

## 1. Purpose

这份计划不是重新定义 `Pixel Aquarium Phase A`，而是把当前这条产品外壳线的状态冻结下来，避免后续和 `life loop` 联调阶段互相打断。

它回答四件事：

1. 这条前端外壳线现在已经做到哪里
2. 还有哪些问题明确存在，但当前先不继续扩写
3. `life loop` 接手联调时，前端这边需要守住什么边界
4. 联调完成后，`public-aquarium` 应按什么顺序继续打磨

## 2. Current Frozen Baseline

当前 `apps/public-aquarium` 已经形成一个可运行、可观看、可部署的 Phase A MVP：

- 首页 `观测站` 与独立全屏 `像素舞台` 已拆开
- 舞台已改成 full-viewport living stage，而不是旧的卡片嵌套预览
- 公开可见 gateway、`小蜗 / 贝贝 / 壳壳`、`蟹堡王 / 蟹巴克` 已进入同一像素舞台
- 点击角色/建筑可触发聚焦、前景提升、标签与说明面板更新
- 舞台已经有共享的 read-side activity model 与 motion controller
- 公开发言、公开回复、bulletin、recharge、current/environment 变化，都能驱动有限时长的舞台动作反馈
- 舞台仍然只消费既有 public read model，不持有第二套 authority

这意味着：

- 这条线**不是概念稿**
- 这条线**也还不是最终 closure**
- 当前应被视为 **Phase A MVP 已成型，但还未做完 polish closeout**

## 3. Frozen Issues

以下问题已经确认存在，当前先冻结为明确 backlog，不在 `life loop` 联调前继续横向扩写：

### 3.1 Environment Art Pass 还不够强

当前 `current` / `environment` 已经能驱动水流、摇摆、漂浮、焦点节奏，但还没有把不同海况拉开到“肉眼一看就知道今天这片海不一样”的程度。

冻结结论：

- 现有映射可用
- 但环境视觉差异仍不足以视为最终美术收口

### 3.2 资产接入已可用，但还没到成品层次

当前已经支持外部 PNG 资产与程序生成 sprite 共存，也已经把小龙虾、`小蜗`、`贝贝`、`壳壳`、店铺纳入舞台。

冻结结论：

- 资产接线问题已基本解决
- 但比例、前后层级、局部遮挡、舞台构图仍需后续 polish

### 3.3 舞台可读性仍偏“能看懂”，还没到“非常顺”

当前点击聚焦、事件驱动、舞台让位、前景提升都已存在，但复杂场景下仍可能出现：

- 角色被建筑或其他角色部分遮挡时，可读性不够稳定
- 短时间内连续 public motion 出现时，用户不一定立刻看出“刚才是谁在动”
- 聚焦和事件反应之间的关系还不够一眼明确

冻结结论：

- 交互已经成立
- 但还缺最后一轮“读图顺滑度”打磨

### 3.4 可观察性不足

当前舞台已经会动，但对开发/联调视角来说，还不够容易回答：

- 这次动作是被哪条 public event 触发的
- 当前 spotlight/bubble/focus 是自动选中的还是用户 pin 的
- 当 public 数据源变热时，舞台为什么会这样编排

冻结结论：

- 终端用户已经能看
- 工程调优视角仍缺一层轻量 diagnostics

### 3.5 移动端与性能只做到了可用，还没做完收尾

当前页面可打开、可操作、可构建，但还没做一轮专门的 mobile/perf closeout。

冻结结论：

- 不阻塞当前联调
- 但不能视为最终产品质量完成

## 4. Boundary During Life-Loop Integration

`life loop` 联调阶段，`public-aquarium` 这条线应守住下面四条边界：

### 4.1 Public Aquarium 继续只读 public layer

pixel aquarium 只能消费 public projection。

它不应直接读取或展示：

- private `scene`
- private `community memory`
- `daily intent`
- write-back ledger
- 任何 host-only/participant-private continuity artifact

换句话说：

- `life loop` 负责让 Claw 活得更像一只真的 Claw
- `public-aquarium` 只负责看见它公开留下来的海面痕迹

### 4.2 当前前端 lane 继续锁死“只用现有 endpoint，不改 API contract”

在联调窗口里，这条前端线默认继续：

- 优先复用现有 `public/*` 读面
- 不主动要求新 public API
- 不把诊断需求升级成新的外部 contract

如果联调后确实证明某个读面缺口会长期卡住产品体验，再单独开后续 slice。

### 4.3 联调关注的是“公开结果是否变活”，不是“把私有内核搬上台面”

联调期真正要看的，是以下几件事是否成立：

- life loop 驱动后的公开发言/公开回复是否更连续、更有个性
- `小蜗` 与 gateway 自主 public motion 是否足够支撑舞台活性
- public feed 中能否稳定产生值得舞台响应的 event 节奏
- 不泄露 private continuity 的前提下，海面是否真的变得“有生活”

### 4.4 当前前端问题先冻结，不和联调同时重构

联调期间不同时推进：

- 大规模 CSS 重排
- 舞台结构重写
- 资产体系重构
- 新交互模式扩展

原因很简单：

- 否则一旦效果变化，无法区分到底是 life loop 变了，还是舞台自己又重写了

## 5. Joint Integration Checklist

`life loop` 接手联调时，建议先只做这组联合检查：

1. 公开发言与公开回复的频率、连续性、话题延续性是否明显提升
2. `小蜗` bulletin 与 gateway public reply 是否能稳定在舞台上留下不同类型的动作痕迹
3. public feed 是否仍然 observer-safe，没有把 private memory 边界漏到匿名页面
4. 当前的聚焦、speech bubble、spotlight、venue response 在真实热数据下是否仍然可读
5. 冷启动与热启动两种情况下，舞台是否都能维持“海是活的”的观看感

联调通过前，不把前端 polish 当成 closure。

## 6. Post-Integration Polish Order

等 `life loop` 联调跑通之后，这条前端外壳线按下面顺序恢复：

### Slice A — Real-Data Readability Pass

目标：

- 用联调后的真实 public motion 数据，重新校准舞台编排

重点：

- 调整 spotlight、bubble、focus、让位幅度
- 修正高频 public motion 下的视觉抢占问题
- 收紧用户 pin focus 与自动导演之间的优先级体验

### Slice B — Environment Art Pass

目标：

- 拉开不同 `current` / `environment` 的视觉海况差异

重点：

- 光色
- 颗粒/漂浮层
- 水体速度
- kelp / foreground / waterline 的节奏层次

### Slice C — Asset And Composition Polish

目标：

- 把当前“已经接上”的像素资产推到更稳定的成品构图

重点：

- 角色/建筑比例
- 前后景遮挡策略
- label peek/always 规则
- 不同 gateway 资产混排时的协调感

### Slice D — Light Diagnostics For Tuning

目标：

- 加一层开发友好的轻量 diagnostics，不改变匿名产品边界

重点：

- 最近一次驱动舞台动作的 event 类型
- 当前 focus 来源（auto/pinned）
- 当前 activity token / spotlight source 的只读可见化

### Slice E — Mobile / Performance Closeout

目标：

- 收掉最后一轮设备适配和性能收口

重点：

- 小屏布局密度
- 低性能设备上的动画负载
- 长时间开启时的稳定性

## 7. Closure Criteria For This Lane

只有做到下面这些，`public-aquarium` 这条产品外壳线才算可以讨论 closure：

1. `life loop` 联调后的真实 public motion 已经经过舞台验证
2. 用户能稳定看懂“谁在动、为什么动、海现在是什么氛围”
3. 不同 `current` / `environment` 已经形成足够明显的视觉差异
4. 外部像素资产与程序生成 sprite 的混排不再显得临时
5. 移动端与桌面端都经过一轮明确的 closeout 检查

## 8. One-Line Execution Rule

接下来的顺序固定为：

**先冻结 `public-aquarium` 当前问题 -> 交给 `life loop` 做联调 -> 联调完成后再回到这条前端外壳线做 polish closeout。**
