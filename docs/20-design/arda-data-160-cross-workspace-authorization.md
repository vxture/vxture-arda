# arda 数据架构 · 跨 workspace 授权访问模型（一页纸）（arda-data-160-cross-workspace-authorization）

> 状态：定稿 v1（owner 认可五条裁定，2026-07-13；G0 文档对齐已完成，G1 待实施）
> 层：第 1 层 · 横切架构决策（`data` 系列）
> 背景：owner 裁定（2026-07-13）——**org（tenant）= 硬隔离；workspace = 默认软隔离，同 org 内可授权跨访问；订阅权益归属 workspace 且严格隔离**。
> 本文**正式取代** [`data-150`](arda-data-150-multiagent-sharing.md) 决策 D8 的绝对表述（"跨 workspace 永不流动、无 share-grant 原语"）——收敛为：**默认不流动；仅经显式授权流动；授权止于 org 内**。
> 上游：[`data-110`](arda-data-110-isolation.md)（隔离范式）、[`data-150`](arda-data-150-multiagent-sharing.md)（共享三段流）、ADR-11 §11.1a（WorkspaceMembership）

---

## 1. 五条裁定（模型骨架）

| # | 决策点 | 裁定 | 理由 |
|---|---|---|---|
| 1 | 硬边界 | **org**。任何 grant 的授出方与受益方 workspace 必须同 org，跨 org 一律拒绝 | owner 裁定；org = tenant 墙 |
| 2 | 授予单位 | **workspace -> workspace**（非 user 级）。受益方 workspace 的成员经其 WorkspaceMembership 间接受益 | 与隔离/权益主轴一致，避免 user 级授权矩阵爆炸 |
| 3 | 粒度 | **资源级**（单个 `DataService` / `Dataset`），不做整 workspace 全量授权 | 整 ws 授权 = 事实上合并两个 ws，风险大、不可审计 |
| 4 | 权益 | **权益不随授权流动**。门控与配额永远按 active workspace 自己的 `(workspace, product)` 订阅求值；跨 ws 消费的 quota 记在**消费方** workspace | owner 裁定：订阅权益属于 workspace 并隔离 |
| 5 | 载体（SoR） | **arda 本地表 `WorkspaceGrant`**。业务数据的授权 = 业务数据域 = arda SoR；平台不感知、不新增契约 | 守住 SoR 边界（平台只管订阅/身份/workspace 生命周期） |

## 2. 数据模型（schema 草案）

```prisma
model WorkspaceGrant {
  id                 String    @id @default(cuid())
  workspaceId        String    // 授出方(源) workspace —— 行归属源 ws，沿用 data-110 隔离范式
  granteeWorkspaceId String    // 受益方 workspace（服务端校验与源同 org）
  resourceType       String    // data_service | dataset
  resourceId         String
  access             String    @default("read")   // 起步仅 read；write = future
  grantedBy          String    // 授权人 userId（源 ws 的 admin）
  expiresAt          DateTime?
  revokedAt          DateTime? // 软删/撤销，不物理删（审计留痕）

  createdAt          DateTime  @default(now())

  @@unique([workspaceId, granteeWorkspaceId, resourceType, resourceId])
  @@index([workspaceId])
  @@index([granteeWorkspaceId, resourceType])
}
```

- **同 org 校验**：创建时经 `WorkspaceRef.orgId` 比对两侧；镜像行缺失则**保守拒绝**（等平台 provisioning 补齐）。
- **授权人**：源 workspace 的 `WorkspaceMembership.role=admin`；org owner/admin 可撤销本 org 内任意 grant。

## 3. 读路径语义（对 data-110 范式的最小冲击）

**默认查询完全不变**（软隔离 = 默认仍强制 `where: { workspaceId }`；`__platform__` 叠加照旧）。跨 ws 访问不扩大默认 IN 列表，而是走**独立的 grant join 入口**：

- 消费方 UI 新增"共享给我的"视图：`WorkspaceGrant.findMany({ where: { granteeWorkspaceId: self, revokedAt: null } })` -> 按 `(resourceType, resourceId)` 二次取源行。
- 该二次取值收敛在**单一 helper**（同 `__platform__` 叠加的收敛原则），普通数据访问代码永远看不到别的 workspaceId。

**安全不变量**：源 workspace 的分级/脱敏 `Policy` 照常执行（消费方拿到的是过滤后的视图）；`AuditLog` **双写**（源 ws 记"被谁取用"、消费方 ws 记"取用了什么"）；grant 可撤销、可过期。

## 4. 门控与商业化

- 新能力键 `arda.services.cross_workspace_share`（授出动作门控；入 arda 本地能力矩阵，2026-07-13 起平台不配置功能键）——跨 ws 共享可作为付费档能力（哪档开放由 arda 矩阵定义）。
- 受益方双闸：**自己 ws 的订阅 features**（能不能用该功能域）AND **grant 的 access**（能不能碰这个资源）。

## 5. 分阶段

| 阶段 | 内容 |
|---|---|
| G0 | 本页评审定稿；`data-150` D8 / `data-110` / `biz-100` §3.1 / ADR 隔离表述同步修订 |
| G1 | `WorkspaceGrant` 表 + `DataService` 级授予/撤销 + 消费方"共享给我的服务"入口 + 双写审计 |
| G2 | `Dataset` 级只读目录发现（跨 ws 资产可被编目发现） |
| future | `access=write`、整 workspace 级授权（均需真实需求驱动，不提前建） |

> **对 biz-300 阶段 0 的影响**：门控地基的查询过滤器**不需要**为 grant 改写（默认路径不变），可与 G1 并行；唯一前置是本页 §1 的五条裁定先定稿。
