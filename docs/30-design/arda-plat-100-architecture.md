# arda 平台对接 · 总体（arda-plat-100-architecture）

> 状态：权威设计（随平台回复更新）
> 层：第 1 层 · 总体（`plat` 系列，见 [`plat-000`](arda-plat-000-index.md) 索引）
> 范围：arda 与 vxture 平台之间的耦合契约全景 + 三条通道地图。**不含**任何通道的内部实现细节——每条通道的细节都指向对应系列，本文件只回答"打通靠什么、去哪查细节"。
> 上游：`20-vxture-platform-integration-requirements.md` §0-1；`ADR-001-entitlement-and-workspace.md` §1.7（SoR 分工）

---

## 1. 两个耦合契约（arda 与平台仅通过这两点耦合）

| 契约 | 内容 | 归属 |
|---|---|---|
| **`workspaceId` 隔离键** | 业务数据全在 arda，按此键强制隔离；平台不持有业务数据 | arda 侧持有，平台侧只提供该键的取值来源（OIDC token 的 `active_workspace` claim）|
| **`(workspace, product=arda)` 订阅行** | 订阅/权益/计费全在平台；arda 不建镜像表 | 平台侧持有，arda 只读消费 |

两侧互不持有对方的数据，这条边界贯穿本系列与 [`data-100`](arda-data-100-architecture.md) §0、[`ent-100`](arda-ent-100-architecture.md) §0。

---

## 2. 三条通道全景

```
        IdP / 平台                              arda
   +------------------+                  +------------------+
   |  accounts.       |  A. OIDC 身份     |                  |
   |  vxture.com      | ---------------> |  arda-app        |
   |  (用户态,登录/登出) |                  |  (OIDC RP)       |
   +------------------+                  |                  |
                                          |                  |
   +------------------+  B. 权益端点(拉取) |                  |
   |  平台权益服务      | <--------------- |                  |
   |  (workspace,      | ---------------> |                  |
   |   product=arda)   |  响应: 权益快照    |                  |
   +------------------+                  |                  |
                                          |                  |
   +------------------+  C. 指令/失效(推送) |                  |
   |  平台指令通道      | ---------------> |  内部指令端点      |
   |  (invalidate/     |                  |  (data-140 审计)  |
   |   seed/wipe)      |                  |                  |
   +------------------+                  +------------------+
```

| 通道 | 方向 | 用途 | 细节见哪 |
|---|---|---|---|
| **A. OIDC 身份** | IdP -> arda（用户态） | 登录、登出、token 内带 org/workspace 上下文 | [`plat-110`](arda-plat-110-oidc-contract.md)（本系列，唯一详细展开的通道）|
| **B. 权益只读端点** | arda -> 平台（服务态，拉取） | 按 `(workspaceId, product=arda)` 查 state/tier/features/quota | [`ent-120`](arda-ent-120-consumption-contract.md) §1（消费契约形状）+ [`ent-100`](arda-ent-100-architecture.md)（两轴模型）|
| **C. 指令/失效通道** | 平台 -> arda（服务态，推送） | `invalidate` / `seed` / `wipe` | [`data-140`](arda-data-140-audit.md)（签名/幂等/审计）+ [`data-260`](arda-data-260-infrastructure.md)（`seed` 对应的模板填充）|

> **通道 B 的一个已知问题**：`20-vxture-platform-integration-requirements.md` §3.1 描述的响应契约是 `ADR-11`（多 Plan/Product 合并模型）定稿**之前**的旧扁平格式，与 [`ent-120`](arda-ent-120-consumption-contract.md) 已经写定的权威契约（`capabilities`/`quota_pools` 分层结构）不一致。以 `ent-120` 为准；旧格式的处理见 [`plat-300`](arda-plat-300-tracking.md) §2。

---

## 3. workspace/org 上下文 claim：本系列只提"要什么"，不重复"怎么取"

arda 要求 IdP 在 token 中下发**不透明**的当前上下文 claim：

- `active_org`：当前组织标识（不透明字符串）。
- `active_workspace`：当前 workspace 标识（不透明字符串）—— **arda 的业务数据隔离键，必需**。

这两个 claim 的取值链路（token -> Redis 会话 -> `getSession().workspaceId` -> 服务端强制过滤）已在 [`data-110`](arda-data-110-isolation.md) 详细设计，本文件不重复。本系列只强调**对平台的要求**本身：

- 这两个 claim 须在 access token（或 BFF 可取到的 userinfo）中稳定存在；常态 `org:workspace = 1:1`，但格式与语义须按 **1:N** 设计（未来多 workspace）。
- arda **不**铸造、不修改 workspace ID，只镜像。
- 上下文切换（org/workspace）是 arda 应用内动作，**不重新走 OIDC**——拿新 `active_workspace` 重新向通道 B 拉权益即可。

---

## 4. SoR 边界重申

arda 是数据域**产品端**，vxture 是身份/订阅/计费**平台**。本系列只记录"arda 需要平台提供什么、arda 对外暴露什么接口去接收"，**不设计平台侧如何实现**这些能力（权益解析算法、订阅数据模型、指令签发逻辑均属平台职责，与 [`ent-000`](arda-ent-000-index.md) §0、[`data-100`](arda-data-100-architecture.md) §0 的边界原则一致）。

---

## 5. 文档导航

| 需要什么 | 看哪个文件 |
|---|---|
| 契约全景、三通道地图（本文件） | `plat-100`（本文件） |
| OIDC RP 契约细节（client/endpoints/PKCE/back-channel logout/session cookie） | [`plat-110`](arda-plat-110-oidc-contract.md) |
| 对接现状、平台待确认清单、验收判据 | [`plat-300`](arda-plat-300-tracking.md) |
| workspace 隔离取值链路细节 | [`data-110`](arda-data-110-isolation.md) |
| 权益端点消费契约细节 | [`ent-120`](arda-ent-120-consumption-contract.md) |
| 指令通道签名/幂等/审计 | [`data-140`](arda-data-140-audit.md) |
