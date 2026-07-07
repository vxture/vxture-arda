# arda 平台对接系列 · 索引与编号法（arda-plat-000-index）

> 状态：系列索引（3 篇正文已完成，版本冲突与 scope 名残留已修正）
> 用途：`arda-plat-*`（对接维度）系列总目录 —— arda 作为 OIDC relying party 对 vxture 平台/IdP 的身份契约 + 对接需求追踪
> 范围：仅 **arda 独有、未被其它系列覆盖**的内容——OIDC RP 契约本身（client 注册/endpoints/PKCE/back-channel logout/session cookie）+ 对平台的书面对接需求追踪。
> **明确不含（已由其它系列覆盖，本系列只交叉引用）**：workspace/org 上下文 claim 的取值链路与隔离机制（[`data-110`](arda-data-110-isolation.md)）、平台指令通道的签名/幂等/审计（[`data-140`](arda-data-140-audit.md)）、模板/示例数据填充（[`data-260`](arda-data-260-infrastructure.md)）、权益端点消费契约（[`ent-120`](arda-ent-120-consumption-contract.md)）。
> 上游依据：[`biz-000`](arda-biz-000-index.md) §0 全局编号法；源材料见 §4

---

## 0. 两个必须先处理的真实问题

### 0.1 版本冲突：`vxture-platform-integration-requirements.md` §3.1 的权益端点契约已过期

该文档 §3.1 描述的响应格式是**扁平结构**：

```json
{ "workspaceId": "ws_123", "product": "arda", "state": "subscribed", "tier": "pro",
  "features": [...], "quota": {...}, "updatedAt": "..." }
```

而 [`ent-120`](arda-ent-120-consumption-contract.md) §1（来自 `ADR-11` §11.7，权威版本）的契约是**分层结构**：

```json
{ "workspace_id": "...", "product": "arda",
  "capabilities": { "data.tier": "pro", "features": [...] },
  "quota_pools": [ { "metric": "...", "limit": ..., "remaining": ..., "priority": ... } ] }
```

这是同一类问题（`entitlement.md` vs `ADR-11` 的版本分裂）在 `plat` 维度的重演——`vxture-platform-integration-requirements.md` 写于 `ADR-11`（多 Plan/Product 合并、配额池瀑布）定稿**之前**，尚未升级。`plat-300`（本系列迁移追踪文档）会显式标注此为**已知需更新项**，而不是重新设计一套契约；契约以 `ent-120`/`ADR-11` §11.7 为准。

### 0.2 残留：`identity-app-integration-standard.md` 的 scope 名过期

该文档第 35/68 行仍写 `arda:subscription` 为当前 scope，但真实代码（`auth/lib/config.ts:113`）已是 `openid profile email phone arda`——与之前在 `modules.md` 修正的是同一处漂移。且该文档自己引用的 `vxture-platform-integration-requirements.md` §2.3 已经说明"`arda:subscription` 逐步退役、过渡期仍发 `arda` claim"——两份文档之间也没对齐。授权 `plat-110` 时一并修正。

---

## 1. 维度与编号法

维度代码 = `plat`（对接）。沿用 [`biz-000`](arda-biz-000-index.md) §0 全局命名法：`arda-plat-<三位数>-<slug>.md`。

---

## 2. 两层结构（比 `ent` 更扁——大量内容交叉引用其它系列）

| 层 | 编号 | 内容 |
|---|---|---|
| **第 1 层 · 总体** | `plat-100` | 三通道全景（身份 A / 权益 B / 指令 C）+ 两个耦合契约（`workspaceId` / 订阅行）+ SoR 边界 |
| **第 1 层 · OIDC 契约** | `plat-110` | client 注册、endpoints、PKCE 流程、back-channel logout、session cookie、`MOCK_AUTH`——arda 独有内容，唯一详细展开的一层 |
| **第 3 层 · 迁移追踪** | `plat-300` | 现状阻塞（§0）+ 平台侧待确认清单（10项）+ 打通验收判据（6项）——这是"活的"对接进度文档，随平台回复更新 |

> 没有 `2xx` 板块层——对接不是按业务板块划分的能力，跟 `ent` 系列同理。

---

## 3. plat 系列看板

| 编号 | 文档 | 层 | 内容来源 | 状态 |
|---|---|---|---|---|
| `plat-000` | 索引与编号法（本文件） | - | 新建 | 完成 |
| `plat-100` | 总体：三通道全景 + 耦合契约 + SoR 边界 | 1 | `vxture-platform-integration-requirements.md` §0-1 | 完成 |
| `plat-110` | OIDC RP 契约：client 注册/endpoints/PKCE/back-channel logout/session cookie/MOCK_AUTH | 1 | `identity-app-integration-standard.md` 全文（含 scope 名修正）| 完成 |
| `plat-200` | **arda 实施回传**：C1/C2/C3/L0 落地方式 + 端点清单 + DB schema + 双方待办（面向 vxture 平台团队）| 2 | 本次实施 | 完成 |
| `plat-210` | **arda 回函 02**：对平台 `product_220`（目录/权益/资源模型）的采纳 + 四项增补提案（status 4 态 / ai.credit 保留+共享 / 跨产品超冲 / 组合语义）| 2 | 对 product_220 回应 | 完成（待平台确认）|
| `plat-300` | 迁移追踪：现状阻塞 + 平台待确认清单 + 验收判据 | 3 | `vxture-platform-integration-requirements.md` §0、§6、§7（含 §3.1 版本冲突标注）| 完成 |

---

## 4. 源材料映射表

| 源文档 | 路径 | 贡献给 | 已知问题 |
|---|---|---|---|
| `identity-app-integration-standard.md` | `docs/20-design/identity-app-integration-standard.md` | `plat-110` | scope 名残留 `arda:subscription`——**已修正**（2026-07-03，原文件本体与 `plat-110` 同步更新为 `openid profile email phone arda`）|
| `vxture-platform-integration-requirements.md` | `docs/60-workplan/vxture-platform-integration-requirements.md` | `plat-100`/`plat-300` | §3.1 权益端点契约已被 `ADR-11`/`ent-120` 取代——**已标注**（2026-07-03，原文件本体加"本节格式已过期"提示，指向 `ent-120`）|

---

## 5. 与其它系列的边界（避免重复设计）

| 内容 | 归属 | plat 系列如何处理 |
|---|---|---|
| workspace/org 上下文 claim 取值链路 | [`data-110`](arda-data-110-isolation.md) | `plat-100` 只提"token 须携带 active_org/active_workspace"这一要求本身，取值链路细节交叉引用 |
| 权益端点契约细节（字段/响应形状）| [`ent-120`](arda-ent-120-consumption-contract.md) | `plat-100` 只在全景图里提"通道 B"存在，不重复契约细节；`plat-300` 标注旧版契约已过期 |
| 平台指令通道签名/幂等/审计 | [`data-140`](arda-data-140-audit.md) | `plat-100` 只提"通道 C"存在，工程细节交叉引用 |
| 模板/示例数据填充 | [`data-260`](arda-data-260-infrastructure.md)/[`data-300`](arda-data-300-migration.md) | 不重复 |
| 权益两轴模型（state/tier）现状与目标 | [`ent-100`](arda-ent-100-architecture.md) | 不重复，只交叉引用 |

---

## 6. 落地情况

3 篇正文已授权完成：[`plat-100`](arda-plat-100-architecture.md)（总体）、[`plat-110`](arda-plat-110-oidc-contract.md)（OIDC 契约，对代码真源逐项核对）、[`plat-300`](arda-plat-300-tracking.md)（迁移追踪）。§0 的两个已知问题均已处理：

1. **scope 名残留**：`identity-app-integration-standard.md` 本体与 `plat-110` 已同步修正为 `openid profile email phone arda`（真源：`auth/lib/config.ts`）。
2. **通道 B 版本冲突**：采用"保留旧 JSON + 显式标注已过期"的方式（而非删除），在 `vxture-platform-integration-requirements.md` §3.1 原地加了"本节格式已过期"提示并指向 [`ent-120`](arda-ent-120-consumption-contract.md)；`plat-300` §2 同步记录。

核对代码真源时还发现一处此前任何文档都未记录的机制：`appOrigin` 派生自注册的 `redirectUri` 而非请求 host，专门用来防止内部 bind 地址（如 `0.0.0.0:3230`）泄漏进跳转 `Location` header——与 `fix-01.md` 记录的生产登录 bug 背景相关，见 [`plat-110`](arda-plat-110-oidc-contract.md) §3.1。
