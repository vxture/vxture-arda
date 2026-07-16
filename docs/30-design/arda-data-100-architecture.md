# arda 数据架构 · 总体架构（arda-data-100-architecture）

> 状态：权威设计（较稳定演进）
> 层：第 1 层 · 总体架构（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（字段名 / 类型 / 索引以此为准）；本文为总体总览，字段级下钻见板块 schema `data-210..260`
> 范围：arda 产品侧**业务领域数据**的持久层 —— 定位、目标、约束、总体模型
> 下钻：字段级表设计见 `data-210..260`（板块 schema，见 [`data-000`](arda-data-000-index.md) §2 看板）；横切约束见 [`data-110`](arda-data-110-isolation.md)（隔离）/ [`data-120`](arda-data-120-indexing.md)（索引）；多 agent 归属与共享模型见 [`data-150`](arda-data-150-multiagent-sharing.md)；迁移与现状见 [`data-300`](arda-data-300-migration.md)
> 上游依据：[`ADR-001-entitlement-and-workspace.md`](decisions/ADR-001-entitlement-and-workspace.md)（§1.7 SoR 分工、§4 模板、§5 指令、§8 落地清单）、[`arda-biz-120-domain-entities-and-feature-keys.md`](arda-biz-120-domain-entities-and-feature-keys.md)（领域实体目录 v1）

---

## 0. 定位与边界（先读）

arda 的持久层**只为领域业务数据存在**，不承载身份 / 订阅 / 计费。数据所有权边界（ADR §1.7）：

| 归属 | 内容 | 落在哪 |
|---|---|---|
| **产品侧（arda）** | 数据资产 / 元数据 / 治理 / 服务等业务数据 | **arda 自己的 Postgres** |
| 平台侧（vxture） | 订阅 / 权益 / 计费 / 授权、Org 与 workspace 生命周期 | vxture 平台，arda **不建表** |
| 身份层（IdP） | 账号、`active_org` / `active_workspace` | accounts.vxture.com（OIDC claim） |

两侧仅通过两个契约耦合：**`workspaceId` 隔离键** + **`(workspace, product=arda)` 订阅行**（订阅行在平台侧，见 [`40-entitlement.md`](40-entitlement.md) 与 [平台对接要求](../70-workplan/20-vxture-platform-integration-requirements.md)）。

> 净结论：引入持久层的真正驱动力是**领域数据**（而非权益）。权益走 token claim / 未来实时拉取，**arda 侧不落 Subscription 镜像表**（详见 §5）。

**三层数据归属**（arda 持久层内部的归属分层，正交于上表的 SoR 分工）：

| 层 | scope | 内容 | 隔离/共享 |
|---|---|---|---|
| **平台层** | `scope=platform` | arda 运营策展的全局参考（通过的数据标准、行政区划码表、币种码） | 全平台**只读**共享；仅运营/平台角色可写；平台行用保留哨兵 `workspaceId="__platform__"`（普通列非 FK），租户读叠加 `workspaceId IN (self, "__platform__")` |
| **租户层** | `scope=workspace` | 租户 / agent 所产的业务数据 | 隔离在 workspace 内；workspace 内跨多个 agent 共享 |
| **agent 私有** | - | agent 运行态 / 草稿 / 会话 / 向量 / RAG | **完全不进 arda** |

隔离主轴始终是 `workspaceId`（见 §4；**org = 硬隔离，workspace = 默认软隔离**，owner 裁定 2026-07-13）；`AssetScope` 与 `ownerApp` / `visibility` 是**归属与可见性轴**，不替代隔离。跨 workspace 默认不流动；唯一例外 = 同 org 内资源级显式授权（`WorkspaceGrant`，见 [`data-160`](arda-data-160-cross-workspace-authorization.md)）。归属轴、三段共享流（发现 -> 取用 -> 回流升格）与升格流（workspace-draft -> ops-approve -> platform-published）的完整语义见 [`data-150`](arda-data-150-multiagent-sharing.md)。

---

## 1. 设计目标

1. **单一产品数据面**：一套 schema、一套 Postgres 服务，按 `workspaceId` 做多租户隔离，而非按环境（beta/prod）拆库。
2. **不越权持有平台数据**：不建 Subscription / Org / workspace 生命周期表；这些只读取（token claim 或未来的平台端点）。
3. **catalog-first，渐进扩展**：v1 只做（资产目录 + 元数据 + 治理）；集成的数据搬运（Pipeline/JobRun）与列级治理（Field）明确标记 `future`，保留定义、不提前建表。
4. **可推导优于可存储**：能从其他表算出的值（质量总分、订阅数、时序/telemetry）不落库，避免配置漂移与刷新一致性问题。
5. **平台指令可安全执行**：接收平台 `seed / wipe / invalidate` 指令的能力（幂等、审计）是一等设计目标，而非事后补丁。

---

## 2. 技术栈（总览）

| 组件 | 取值 |
|---|---|
| ORM | Prisma 7（Rust-free：queryCompiler + driver adapter） |
| 数据库 | PostgreSQL 16 |
| 驱动适配器 | `@prisma/adapter-pg`（node-postgres） |
| 客户端实例 | 单例（`app/lib/db.ts`，`globalThis` 复用，避免连接耗尽） |
| Redis 角色 | 仅会话 / 令牌（`authreq` / `rpsess` / `rptok` / `sid`），**不做数据缓存** |

字段级 / 生成配置 / 连接串细节见板块 schema `data-210..260` 与横切 [`data-120`](arda-data-120-indexing.md)。

---

## 3. 运行时拓扑（总览）

一镜像、两栈（beta/prod）、每栈三服务，**运行态不共享**：

```
   arda-app (stateless Next.js)
      |- REDIS_URL    -> arda-redis  (sessions/tokens)
      `- DATABASE_URL -> arda-db     (domain business data, Postgres 16)
```

- 每栈独立数据目录（prod `/srv/md0/arda/data`、beta `/srv/md1/arda-beta/data`），两栈的 `.env` / 数据目录**绝不互指**。
- 部署细节（compose 服务定义、启动迁移方式、备份）见 [`data-300`](arda-data-300-migration.md) §3。

---

## 4. workspace 隔离模型（核心约束）

隔离键 = `workspaceId`（= 平台 / IdP 的 `active_workspace`），贯穿整个 schema：每个业务实体带 `workspaceId`、服务端查询强制 `where: { workspaceId }` 收口、业务唯一性一律 workspace 内唯一、每表至少 `@@index([workspaceId])`。

> 工程细节（取值链路、强制过滤代码范式、复合索引、org/workspace 切换免重认证、哪些表不带 `workspaceId`）见 [`data-110`](arda-data-110-isolation.md)。

---

## 5. 领域数据模型（总览：所有表）

按导航分区（assets / integration / governance / services / admin / infra）。完整字段/索引见各板块 schema（`data-210..260`）；这里只列**表与其核心用途 + 关键字段**。

**枚举**：`AssetLevel { public | internal | sensitive | core }`、`QualityStatus { pass | warn | fail }`、`AssetScope { workspace | platform }`（数据归属层：`workspace` 租户所有 / `platform` arda 运营策展的全局参考、全平台只读，见 §0 三层归属）。

| 分区 | 表 | ws? | 核心用途 | 关键字段 |
|---|---|---|---|---|
| assets | **Dataset** | Y | 核心数据资产 | `code`（ws 内唯一）、`domain`/`team`/`refreshFreq`、`classification`、`ownerApp`（产出 agent，属主+溯源，非隔离轴；`@@index([workspaceId, ownerApp])`） |
| assets | **Tag** / **DatasetTag** | Y | 标签 + M:N 关联 | `name`（ws 内唯一） |
| assets | **GlossaryTerm** | Y | 业务术语表 | `term`（ws 内唯一）、`definition`、`scope`（AssetScope，可升格为平台全局术语） |
| integration | **DataSource** | Y | 外部系统登记 + 元数据拉取（v1 不搬数据） | `type`、`connectionConfig`（应用层加密） |
| governance | **Policy** | Y | 访问 / 脱敏 / 留存 / 分级规则 | `type`、`scope` |
| governance | **QualityRule** / **QualityResult** | Y | 稽核规则 + 结果 | `dimension`、`status`（QualityStatus）、`score` |
| governance | **Standard** | Y | 数据标准（代码集/数据元） | `type`、`ref`、`status`、`scope`（AssetScope，`platform`=运营通过的全局码表如行政区划码） |
| governance | **LineageEdge** | Y | 数据集级血缘 | `upstreamDatasetId` -> `downstreamDatasetId` |
| services | **DataService** / **DataServiceDataset** | Y | 数据服务（API）+ 与 Dataset 的 M:N | `method`、`status`、`level`、`ownerApp`（发布 agent）、`visibility`（`workspace`=对 ws 内所有 agent 共享 / `owner`=仅属主私有） |
| admin | **ApiKey** | Y | 服务密钥（存哈希） | `hashedKey`（全局唯一）、`scopes`、`revoked`、`consumerApp`（消费方 agent 身份，用于审计+策略） |
| admin | **AuditLog** | Y | 活动 + 平台指令审计 | `idempotencyKey`（全局唯一，幂等防重放） |
| infra | **WorkspaceRef** | - | 平台 workspace 的本地镜像（隔离锚，非生命周期所有者） | `id` = 平台 `active_workspace`、`seedStatus` |
| infra | **SeedTemplate** / **TemplateVersion** | - | 全局只读版本化示例数据模板 | `manifest`（Json） |

**有意不落库**（避免配置漂移 / 尚无数据来源）：
- `Dataset` 的**质量总分**与**订阅数** —— 派生自 `QualityResult` 聚合 / 订阅 join，算不出时 UI 显示 `-`。
- 仪表盘的增长趋势 / 调用量 / 告警 —— 客户端展示聚合（telemetry/timeseries v1 未建模）。

**v1 有意不建模**（`future`，见领域目录）：列级 `Field`、集成的 `Pipeline` / `JobRun`。

> 多租户 / 多 agent 归属与共享轴（`AssetScope`、`Dataset.ownerApp`、`DataService.ownerApp` / `visibility`、`ApiKey.consumerApp`）均为向后兼容加列（可空或带默认），其完整语义、三段共享流（发现 -> 取用 -> 回流升格）与 arda 作为 broker/中介的定位见 [`data-150`](arda-data-150-multiagent-sharing.md)；此处仅登记字段存在与用途。

---

## 6. 边界：arda 不落的表

| 概念 | 实际来源 | arda 是否建表 |
|---|---|---|
| 订阅 state / tier / had_trial | OIDC token 的 `arda` claim | **否**（直接从 claim 求值） |
| Subscription（按 workspace x product） | vxture 平台（唯一 SoT） | **否** |
| Org / workspace 生命周期 | 平台 | **否**（仅 `WorkspaceRef` 镜像） |
| 计费 / 授权 | 平台 | **否** |

目标态（ADR §3.5）：tier 由 token claim 迁移为**平台只读端点实时拉取 + Redis 短 TTL 缓存 + invalidate 失效通知**，仍**不建镜像表**。当前实现状态见 [`data-300`](arda-data-300-migration.md)。

---

## 7. 文档导航

| 需要什么 | 看哪个文件 |
|---|---|
| 目标 / 约束 / 总体模型（本文件） | `data-100`（本文件） |
| workspace 隔离工程细节 | [`data-110`](arda-data-110-isolation.md) |
| 索引与性能约定 | [`data-120`](arda-data-120-indexing.md) |
| 多 agent 归属 / 共享模型（AssetScope、ownerApp、visibility、consumerApp、三段共享流） | [`data-150`](arda-data-150-multiagent-sharing.md) |
| 每张表的完整字段 / 索引 / 可据此建库的详细设计 | `data-210..260`（板块 schema） |
| 迁移时间线、现状 vs 目标态、演进路线 | [`data-300`](arda-data-300-migration.md) |
