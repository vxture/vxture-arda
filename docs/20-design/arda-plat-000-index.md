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
| `plat-300` | 迁移追踪：现状阻塞 + 平台待确认清单 + 验收判据 | 3 | `vxture-platform-integration-requirements.md` §0、§6、§7（含 §3.1 版本冲突标注）| 完成 |

> `plat-200`（实施回传）及各回函均为**面向平台的交付/往来文件**，已集中至 `docs/70-reply/`，见 §3.1。

### 3.1 面向平台的回复/回传（集中于 `docs/70-reply/`）

面向 vxture 平台的**回传（handoff）与回函（reply）都是往来交付件**——结论最终沉淀回契约/追踪文档后即可归档；因此**不放 `20-design/`，集中在 `docs/70-reply/`**，文件名末尾带**时间标记（YYMMDDHHMM）**便于按签发时间排序。

| 件 | 主题 | 文件（`docs/70-reply/`）| 状态 |
|---|---|---|---|
| 回传（原 plat-200）| arda 实施回传：C1/C2/C3/L0 落地方式 + 端点清单 + DB schema + 双方待办 | `arda-plat-200-impl-handoff-2607120135.md` | v1.2（2026-07-12 按平台 `arda_302` 更正两处过时状态）|
| 回函 02（原 plat-210）| 对 `product_220` 采纳 + 四增补（status 4 态 / ai.credit 保留+共享 / 跨产品超冲 / 组合语义）| `arda-plat-210-catalog-reply-2607120135.md` | 平台已裁定（`arda_302` §2，全部采纳/确认）|
| 回函 03（原 plat-220）| C1/C2/C3 路径边界与 S2S 内网化；请平台给内网 auth-bff 地址 + webhook 源 | `arda-plat-220-boundary-reply-2607120135.md` | 平台已裁定（`arda_302` §3，内网 base 已给）|
| 回函 04（原 plat-230，提案）| 跨产品通信 mesh 优化（两类分级 / 会话互验 / tailnet 寻址 / token exchange / 控制数据面分离）| `arda-plat-230-mesh-optimization-reply-2607120135.md` | 平台已采纳，定稿 vxture 仓 `product_230` v1.0 |
| 回函 05（plat-240）| 对平台回函 `arda_302` §2.1 新开放项的回复：`had_trial` 载体三选一，推荐方案①（C2 信封加布尔）| `arda-plat-240-had-trial-reply-2607121733.md` | **已被回函 06 撤回**（2026-07-13，问题被边界规则整体消解）|
| 回函 06（新，plat-250）| 权益契约收缩（松耦合定稿）：C2 信封 v2（删 `capabilities`、加 `limits`+时间戳）+ 契约演进边界规则 + `arda` claim 整体退役 + 平台服务边界建议 | `arda-plat-250-loose-coupling-reply-2607132030.md` | 待平台确认 |

> 正文中出现的 `plat-200/210/220/230/240` 为**概念标签**（对应上表），文件实体在 `docs/70-reply/`。平台侧回函 `arda_302_reply-02`（vxture 仓 `docs/product/arda/`）对回函 02/03/04 逐项裁定，详见 `arda-plat-300-tracking.md` §2c。

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
