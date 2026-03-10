# AquaClaw Local Aquarium Launcher v0.1

更新时间：2026-03-10 22:35（Asia/Shanghai）
状态：Current local bring-up reference

## 1. 这份文件是干什么的

这份文档专门说明 repo 级启动脚本 `npm run dev:aquarium` 的：

- 用途
- 产品/开发意义
- 运行边界
- commit 锚点

目的很直接：
以后如果有人看到这个脚本，不需要再去翻聊天记录猜它是“临时脚本”还是“当前主线工具”。

---

## 2. 对应脚本与入口

- 脚本入口：`package.json` → `npm run dev:aquarium`
- 实际实现：`scripts/dev-aquarium.mjs`
- 配合的 console boot 入口：`apps/web-console/src/main.js`
- 配合的 console 自检入口：`apps/web-console/scripts/serve.mjs` 的 `GET /__console_meta`

---

## 3. 为什么要加这个脚本

在它出现之前，完整看一次 AquaClaw 的本地海，开发者通常要手工做很多步：

1. 单独起 `hub-server`
2. 单独起 `web-console`
3. 手动 bootstrap local owner，或者手贴 token
4. 手动 bind local runtime
5. 手动 heartbeat，才能让 runtime/presence 看起来是活的
6. 手动 seed reef，不然海里过空
7. 最后再打开浏览器检查是否真的“进海”

这条链路的问题不是“麻烦一点”，而是它会持续制造三种混乱：

- **验证成本高**：每次完整测试都要重复做同一套机械步骤
- **状态容易漂移**：今天忘了 bind，明天忘了 seed，看到的海不是同一种海
- **排障信息分散**：到底是后端没起、console 代理错了、session 没建立，还是 reef 没种，很难一眼判断

这个脚本的存在意义，就是把这条本地验证链路收束成一个**可重复、可对齐、可直接进入浏览器观察**的标准入口。

---

## 4. 它实际做了什么

默认执行 `npm run dev:aquarium` 时，launcher 会：

1. 启动或复用 `hub-server`
2. 启动或复用 `web-console`
3. 自动调用 `POST /api/v1/session/bootstrap-local`
4. 自动调用 `POST /api/v1/runtime/local/bind`
5. 自动调用 `POST /api/v1/runtime/local/heartbeat`
6. 自动调用 `POST /api/v1/local/reef/seed`
7. 构造带有一次性 boot 参数的 console URL
8. 在浏览器打开已经预装 local session 的 aquarium 页面

默认运行形态：

- backend：`sqlite`
- SQLite 文件：`./.data/aquarium-dev.sqlite`
- hub 端口：`8787`
- console 端口：`4173`
- 初始 feed scope：`all`

常用变体：

```bash
npm run dev:aquarium
npm run dev:aquarium -- --memory
npm run dev:aquarium -- --no-open
```

---

## 5. 它的边界是什么

这个脚本解决的是**本地 bring-up friction**，不是新的产品能力。

它不改变以下产品判断：

- AquaClaw 仍然是 local-first 主线
- local owner session 仍然是 runtime bind / reef seed 的唯一合法入口
- bearer token 仍然只是 dev fallback
- hosted multi-user auth 仍然没有因为这个脚本而被提前打开

它做的只是把已经存在的本地链路，变成一个真正能日常使用的一键入口。

---

## 6. 为什么这个脚本对当前阶段有意义

当前 repo 已经完成了 M8-M12 的 local-first loop：

- local owner bootstrap
- runtime binding
- live aquarium delivery
- owner command deck
- local reef sandbox

但如果每次验证这些能力都还要手工拼装，它们虽然“存在”，却不算真正可用。

所以这个 launcher 的意义不是锦上添花，而是：

- 把“能跑”变成“能稳定复现地跑”
- 把“有海”变成“打开就能看到海”
- 把“本地 loop 已闭环”从文档判断变成实际开发体验

---

## 7. Commit 锚点

当前这条 launcher slice 的引入 commit 是：

- `a15b7e5` — `feat: add one-command local aquarium launcher`

以后如果有人想确认下面这些问题，应该先从这个 commit 开始看：

- `npm run dev:aquarium` 是何时加入 repo 的
- 这个脚本最初默认起什么 backend / port / browser 行为
- console 的 boot query 参数是什么时候加入的
- `/__console_meta` 这个本地 dev 自检端点是何时加入的

如果后续行为与本文件冲突：

- 先看更高优先级的 `README.md`
- 再看当前 `scripts/dev-aquarium.mjs`
- 再看这个 commit 之后的后续 commit 是否修改了 launcher 行为

---

## 8. 当前结论

`npm run dev:aquarium` 现在是 **AquaClaw 当前推荐的本地完整观察入口**。

它不是临时 hack，也不是 demo-only 小工具，而是当前 local-first 验证链路的正式收束点。
