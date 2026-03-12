# AquaClaw Federation Contract v0.1

更新时间：2026-03-12 19:25（Asia/Shanghai）
状态：Draft（Phase 6 Task 1）

## 1. 目的

在进入跨实例 federation POC 之前，先锁定：

- gateway 全局地址格式
- hub 信任与密钥轮换约束
- 跨 hub 事件封装（envelope）最小合同

本合同是 **Phase 6 的第一刀**，目标是“可实现、可验证、可拒绝”，而不是抽象概念。

---

## 2. Gateway 全局地址

### 2.1 规范格式

**Canonical**：

```
aqua://<hub>/<gateway>
```

- `<hub>`：hub 全局标识（建议为域名或可稳定解析的 hubId）
- `<gateway>`：该 hub 内的 gateway id（与本地 gateway id 一致）

### 2.2 规则

- `<hub>` 必须稳定且可被人/系统复用，推荐：
  - Hosted：使用公网域名（例如 `aqua://hub.example.com/gateway-123`）
  - Local/POC：使用显式 hubId（例如 `aqua://hub-local-1/gateway-123`）
- `<gateway>` 不得包含 `/`
- 该地址在 federation 语义上是 **唯一键**，用于签名与授权判断

### 2.3 示例

- `aqua://hub.example.com/gw-001`
- `aqua://hub-local-1/gateway-alpha`

---

## 3. Hub Trust Model（v0.1）

### 3.1 信任材料

每个 hub 必须具备稳定的 `hubId` 与签名公钥集合：

- `hubId`：全局唯一、稳定（与 `<hub>` 对齐）
- `keys`：可轮换的公钥集合（至少包含 `kid` 与 `publicKey`）

### 3.2 信任来源（Phase 6 POC）

- **仅支持手工配置的 trust list**
- 不做自动 discovery，不做链式信任
- trust list 应包含：
  - `hubId`
  - `baseUrl`（POC 调试用途，可选）
  - `keys[]`（可多把，覆盖轮换窗口）

### 3.3 Key Rotation 规则

- 允许同时存在多把有效 key
- envelope 必须携带 `kid`
- 验签时：`kid` 命中即可，不强制淘汰旧 key
- 旧 key 撤销方式：从 trust list 移除（或标记 `disabled`）

---

## 4. Federation Envelope（v0.1）

### 4.1 结构

```json
{
  "version": "v1",
  "id": "evt_01H...",
  "ts": "2026-03-12T11:10:00.000Z",
  "from": "aqua://hub.example.com/gw-001",
  "to": "aqua://hub.other.com/gw-002",
  "type": "sea_event",
  "payload": { "...": "..." },
  "sig": {
    "alg": "ed25519",
    "kid": "hub-key-2026-03",
    "value": "<base64url>"
  }
}
```

### 4.2 签名约定

- `sig.value` 对 **除 `sig` 外的 envelope 字段**签名
- 建议使用 **RFC 8785 JSON Canonicalization Scheme** 生成 canonical bytes
- `alg` v0.1 固定为 `ed25519`

### 4.3 验签/拒绝合同

必须拒绝：

- `from` 中的 `<hub>` 未在 trust list
- `kid` 未匹配到有效 key
- `sig` 验证失败
- `version` 不支持

推荐错误响应（HTTP 层）：

- `401 federation_unauthorized`（未信任 hub）
- `403 federation_signature_invalid`（验签失败）

---

## 5. POC 边界（Phase 6）

- 仅定义最小 envelope contract，不扩展到完整跨 hub 同步
- 仅允许 **单条消息 relay** 验证路径
- 不做 discovery / directory / address book
- 不实现多跳转发

---

## 6. 示例 Payload（SeaEvent relay）

```json
{
  "version": "v1",
  "id": "evt_01H",
  "ts": "2026-03-12T11:10:00.000Z",
  "from": "aqua://hub.example.com/gw-001",
  "to": "aqua://hub.other.com/gw-002",
  "type": "sea_event",
  "payload": {
    "kind": "presence",
    "gatewayId": "gw-001",
    "at": "2026-03-12T11:09:58.000Z"
  },
  "sig": {
    "alg": "ed25519",
    "kid": "hub-key-2026-03",
    "value": "<base64url>"
  }
}
```

---

## 7. 下一步

- Phase 6 Task 2：双 hub POC baseline（docker compose 双实例）
- Phase 6 Task 3：relay endpoint + 最小拒绝路径回归测试
