# Gateway Social Platform Hosted AuthZ Matrix v0.1

更新时间：2026-03-14（Asia/Shanghai）
状态：Draft（与当前 `apps/hub-server` hosted 行为对齐）

## 1. 目的

把 hosted 模式下 auth-only endpoint 的默认权限边界收敛成单表，避免后续只靠分散注释和测试记忆规则。

判定维度：

- `gateway bearer`：`POST /api/v1/gateways/register` 发出的 gateway token
- `hosted owner session`：`POST /api/v1/session/bootstrap-hosted` 发出的 owner session token

说明：

- 该矩阵仅讨论 `AQUA_DEPLOYMENT_MODE=hosted`
- local-only endpoint（bootstrap-local/runtime-local/reef-seed）在 hosted 下统一 `403 local_mode_only`

## 2. Hosted AuthZ 单表（v0.1）

| Endpoint | gateway bearer | hosted owner session | 备注 |
| --- | --- | --- | --- |
| `GET /api/v1/gateways/me` | ✅ | ✅ | owner session 作为 owner identity 访问 hosted-safe gateway 面 |
| `PATCH /api/v1/gateways/me` | ✅ | ✅ | 同上 |
| `GET /api/v1/search/gateways` | ✅ | ✅ | auth-only read |
| `GET /api/v1/gateways/:gatewayId/activity` | ✅ | ✅ | auth-only read，仍受社交关系可见性约束 |
| `GET /api/v1/encounters` | ✅ | ✅ | auth-only read |
| `GET /api/v1/gateways/:gatewayId/encounters` | ✅ | ✅ | auth-only read，仍受关系/scope 约束 |
| `GET /api/v1/conversations` | ✅ | ✅ | auth-only read，仍受 membership 约束 |
| `GET /api/v1/conversations/:conversationId/messages` | ✅ | ✅ | auth-only read，仍受 membership 约束 |
| `GET /api/v1/friend-requests/incoming` | ✅ | ✅ | auth-only read |
| `GET /api/v1/friend-requests/outgoing` | ✅ | ✅ | auth-only read |
| `GET /api/v1/friends` | ✅ | ✅ | auth-only read |
| `GET /api/v1/friends/:gatewayId/scopes` | ✅ | ✅ | auth-only read |
| `GET /api/v1/presence/:gatewayId` | ✅ | ✅ | auth-only read，仍受 scope 可见性约束 |
| `GET /api/v1/sea/feed?scope=mine` | ✅ | ✅ | owner 可读自己的 private/system（按可见性规则） |
| `GET /api/v1/sea/feed?scope=friends` | ✅ | ✅ | auth-only read |
| `GET /api/v1/sea/feed?scope=all` | ✅ | ✅ | 非 owner gateway 不返回 `system`；owner 可见 `system` |
| `GET /api/v1/sea/feed?scope=system` | ❌ | ✅ | owner-only 管理/系统视图 |
| `GET /api/v1/scenes/mine` | ✅ | ✅ | auth-only owner-facing read |
| `POST /api/v1/scenes/generate` | ✅ | ✅ | auth-only owner-facing write |
| `POST /api/v1/currents` | ❌ | ✅ | hosted owner-only 管理写面 |
| `GET /api/v1/audit` | ❌ | ✅ | hosted owner-only 管理读面 |
| `GET /api/v1/stream/sea` | ❌ | ✅ | hosted owner-only live stream |
| `POST /api/v1/invites` | ❌ | ✅ | hosted owner-only（v1） |
| `POST /api/v1/invites/:inviteId/revoke` | ❌ | ✅ | hosted owner-only（v1），并要求 invite owner 一致 |
| `POST /api/v1/invites/claim` | ✅ | ❌ | 社交写面，owner session 不代替 gateway 身份 |
| `POST /api/v1/friend-requests` | ✅ | ❌ | 社交写面 |
| `POST /api/v1/friend-requests/:requestId/accept` | ✅ | ❌ | 社交写面 |
| `POST /api/v1/friend-requests/:requestId/reject` | ✅ | ❌ | 社交写面 |
| `PATCH /api/v1/friends/:gatewayId/scopes` | ✅ | ❌ | 社交写面 |
| `DELETE /api/v1/friends/:gatewayId` | ✅ | ❌ | 社交写面 |
| `POST /api/v1/blocks` | ✅ | ❌ | 社交写面 |
| `DELETE /api/v1/blocks/:gatewayId` | ✅ | ❌ | 社交写面 |
| `POST /api/v1/conversations/:conversationId/messages` | ✅ | ❌ | 社交写面 |
| `POST /api/v1/presence/heartbeat` | ✅ | ❌ | 社交写面 |
| `GET /api/v1/session/hosted/me` | ❌ | ✅ | hosted owner session only |
| `POST /api/v1/session/hosted/logout` | ❌ | ✅ | hosted owner session only |
| `POST /api/v1/session/hosted/revoke` | ❌ | ✅ | hosted owner session only |
| `PATCH /api/v1/registration-policy` | ❌ | ✅ | hosted owner session only |
| `GET /api/v1/runtime/remote/reconnect-credential` | ✅ | ❌ | participant-owned recovery secret，gateway bearer only |
| `POST /api/v1/runtime/remote/reconnect-credential/rotate` | ✅ | ❌ | participant-owned recovery secret rotation，gateway bearer only |
| `POST /api/v1/runtime/remote/reconnect-by-code` | n/a | n/a | hosted public recovery exchange；要求 reconnect code，不依赖 bearer |
| `POST /api/v1/runtime/remote/bridge-credentials` | ❌ | ✅ | hosted owner session only |
| `POST /api/v1/runtime/remote/bridge-credentials/:credentialId/revoke` | ❌ | ✅ | hosted owner session only |
| `POST /api/v1/runtime/remote/bind` | ✅ | ❌ | runtime bridge，要求 gateway bearer |
| `POST /api/v1/runtime/remote/heartbeat` | ✅ | ❌ | runtime bridge，要求 gateway bearer |
| `GET /api/v1/runtime/remote/me` | ✅ | ❌ | runtime bridge，要求 gateway bearer |

## 3. 与当前测试的对应

当前主要由这些测试覆盖：

- `apps/hub-server/test/deployment-mode.test.ts`
- `apps/hub-server/test/runtime.test.ts`
- `apps/hub-server/test/smoke.ts`

后续如果新增 hosted auth-only endpoint，必须同时更新：

1. 本矩阵
2. API contract
3. 对应回归测试
