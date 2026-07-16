# arda 数据架构 · workspace 隔离模型（核心约束）（arda-data-110-isolation）

> 状态：权威设计（横切工程约束，随 SoT 演进；较稳定）
> 层：第 1 层 · 横切工程（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引 §1）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（字段名 / 类型 / 索引以此为准；本文件只是其可读导览）
> 上游：总体约束速览见 [`data-100`](arda-data-100-architecture.md) §4；相关横切见 `data-120`（索引与性能）/ `data-140`（审计与幂等）/ [`data-150`](arda-data-150-multiagent-sharing.md)（多 agent 共享与属主轴）；板块业务面见 [`biz-210`](arda-biz-210-assets.md) / [`biz-220`](arda-biz-220-integration.md) / [`biz-230`](arda-biz-230-governance.md) / [`biz-240`](arda-biz-240-services.md) / [`biz-250`](arda-biz-250-admin.md)；迁移与现状见 [`data-300`](arda-data-300-migration.md)

---

## 1. 主题与约束概述

arda 是单产品数据面：一套 schema、一套 Postgres，按 `workspaceId` 做多租户隔离，而非按环境（beta/prod）拆库（见 [`data-100`](arda-data-100-architecture.md) §1）。因此「隔离」不是某张表的属性，而是贯穿整个持久层的**强制工程约束**，落在三处：schema 声明层、应用查询层、身份取值链路。本文件把这三处收敛成一份可据以建库、可据以写数据访问代码的工程规范。

**语义分级（owner 裁定 2026-07-13）**：**org（tenant）= 硬隔离**——任何访问绝不跨 org；**workspace = 默认软隔离**——本文件的 force-filter 范式是**默认路径**（且是唯一的常规路径），同 org 内可经显式授权跨 workspace 访问，但授权路径不改写本文件任何规则：它走独立的 grant-join helper，不扩大默认过滤（见 [`data-160`](arda-data-160-cross-workspace-authorization.md) §3）。权益不随授权流动。

**隔离键**：`workspaceId`，等于平台 / IdP 身份声明中的 `active_workspace`。它是 arda 与平台之间两个耦合契约之一（另一个是 `(workspace, product=arda)` 订阅行，在平台侧，不在本仓）。

核心不变量（逐条对应 §2 的规则）：

1. **来源单一**：`workspaceId` 只有一个可信来源 - OIDC 令牌声明 `active_workspace`，经 Redis 会话，由服务端 `getSession().workspaceId` 求值。应用代码不接受来自客户端请求体 / 查询串的 `workspaceId`。
2. **服务端收口**：所有领域实体查询在服务端按 `where: { workspaceId }` 过滤；客户端组件不直连数据库，只接收已 scope 过的视图数据。
3. **schema 层兜底**：每个业务实体都带 `workspaceId`（普通索引列，**非外键**）；业务唯一性一律 workspace 内唯一；每表至少 `@@index([workspaceId])`，热点查询叠加 `workspaceId` 前导的复合索引。
4. **切换免重认证**：org / workspace 切换是应用内动作 - 换 `workspaceId` 重新查询，而非重走 OIDC（ADR §3.4）。

**两个不改变隔离主轴的补充（本轮新增）**：隔离主轴恒为 `workspaceId`，下面两点都**不动它**，只是在其之上 / 之内叠加语义，详见 §2.4 / §2.5：

1. **平台全局参考的只读叠加**（§2.4）：`scope=platform` 的全局参考行（`Standard` / `GlossaryTerm`）用保留哨兵 `workspaceId = "__platform__"`，租户读取时叠加 `workspaceId IN (self, "__platform__")`。这是对上面不变量 2「服务端收口」的**受控放开**（只读、只叠平台哨兵、收敛在单一 helper），不是打开跨租户口子。
2. **`ownerApp` 等是 workspace 内软属主 / 溯源轴，非隔离轴**（§2.5）：隔离永远由 `workspaceId` 兜底；`ownerApp` / `DataService.visibility` / `ApiKey.consumerApp` 只在同一 workspace 内区分产出 / 可见 / 消费的 agent，支撑多 agent 经 arda 共享（见 [`data-150`](arda-data-150-multiagent-sharing.md)）。

**为什么 `workspaceId` 是普通列而不是 FK**：workspace 生命周期归平台所有（create / clone / delete 都在平台侧）。若把 `workspaceId` 建成指向本地 `WorkspaceRef` 的外键，业务行就必须等本地镜像行先存在才能写入，这与「平台先建 workspace、arda 只镜像」的所有权边界冲突。因此 `WorkspaceRef` 只是隔离锚点的本地镜像，业务行不依赖它先存在（见 schema 顶部注释 L10-13）。

---

## 2. 规则与范式

### 2.1 schema 层约束（四条，逐条给 prisma 证据）

**(a) 每个业务实体带 `workspaceId String`，无 FK。** 以 `Dataset` 为代表（SoT 原样）：

```prisma
model Dataset {
  id            String      @id @default(cuid())
  workspaceId   String
  dataSourceId  String?
  name          String
  code          String
  description   String?
  domain        String?
  team          String?
  refreshFreq   String? // realtime | daily | weekly | monthly
  type          String // table | view | file | stream
  location      String?
  rowCountEst   BigInt?
  sizeBytes     BigInt?
  ownerUserId   String?
  ownerApp      String?
  classification AssetLevel @default(internal)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  source         DataSource?     @relation(fields: [dataSourceId], references: [id], onDelete: SetNull)
  tags           DatasetTag[]
  qualityRules   QualityRule[]
  qualityResults QualityResult[]
  lineageOut     LineageEdge[]   @relation("LineageUpstream")
  lineageIn      LineageEdge[]   @relation("LineageDownstream")
  services       DataServiceDataset[]

  @@unique([workspaceId, code])
  @@index([workspaceId])
  @@index([workspaceId, dataSourceId])
  @@index([workspaceId, domain])
  @@index([workspaceId, ownerApp])
}
```

注意：`workspaceId` 只是 `String`，没有 `@relation` 指向 `WorkspaceRef`。表内确实存在 FK（如 `source` 的 `dataSourceId -> DataSource.id`），但**没有一个 FK 指向 workspace**。这是有意的（见 §1 末）。

**(b) 业务唯一性 = workspace 内唯一。** 展示编码 / 名称 / 术语的唯一约束一律以 `workspaceId` 前缀，避免跨 workspace 撞码：

```prisma
@@unique([workspaceId, code])   // Dataset / QualityRule / Standard / DataService
@@unique([workspaceId, name])   // Tag
@@unique([workspaceId, term])   // GlossaryTerm
```

**(c) 每表至少 `@@index([workspaceId])`。** 因为所有查询的第一层过滤都是 `where: { workspaceId }`，这条单列索引是最低保障。

**(d) 热点查询叠加 `workspaceId` 前导复合索引。** 前导列必须是 `workspaceId`，让 workspace 过滤与二级过滤 / 排序同索引命中：

```prisma
@@index([workspaceId, dataSourceId])   // Dataset: filter by data source
@@index([workspaceId, domain])         // Dataset: group/filter by subject domain
@@index([workspaceId, createdAt])      // AuditLog: paginate audit by time
```

> 复合索引的完整清单与选型理由属 [`data-120`](arda-data-120-indexing.md) 的范围；本文件只强调「`workspaceId` 必为前导列」这一隔离维度的约束。

### 2.2 应用层代码范式

**取值链路（单一可信源）。** `workspaceId` 从身份声明流入会话，服务端读取。`portals/app/app/auth/lib/session.ts` 的 `toSession()`（SoT 原样）：

```ts
export function toSession(identity: IdentityClaims): Session {
  return {
    // ...
    tenantId: identity.active_org,
    // ...
    workspaceId: identity.active_workspace,
    workspaceName: identity.active_workspace_name,
    // ...
  };
}
```

即链路为：OIDC claim `active_workspace` -> Redis 会话（`IdentityClaims`）-> `getSession().workspaceId`。`getSession()` 是服务端 helper（`cookies()` -> 不透明 `rpsid` -> Redis 身份），只读取 cookie、从不接受客户端传入的 workspace。

**页面 / 服务端组件：先取会话，再把 `workspaceId` 传给数据访问层。** `portals/app/app/(app)/catalog/page.tsx`（SoT 原样）：

```ts
import { getSession } from "../../auth/lib/session";
import { getCatalogAssets } from "./data";
// ...
  const session = await getSession();
  const assets = session ? await getCatalogAssets(session.workspaceId) : [];
```

无会话即空态（`[]`），绝不无 scope 直查。

**数据访问层：每个查询以 `workspaceId` 收口。** `portals/app/app/(app)/catalog/data.ts`（SoT 原样）- 列表用 `findMany`，单条详情用 `findFirst` 且**复合过滤 `{ workspaceId, id }`**（防止拿到别的 workspace 的行）：

```ts
export async function getCatalogAssets(workspaceId: string): Promise<CatalogAssetView[]> {
  const rows = await prisma.dataset.findMany({ where: { workspaceId }, orderBy: { name: "asc" } });
  return rows.map(toView);
}

export async function getCatalogAsset(workspaceId: string, id: string): Promise<CatalogAssetView | null> {
  const row = await prisma.dataset.findFirst({ where: { workspaceId, id } });
  return row ? toView(row) : null;
}
```

**聚合 / 分组同样逐一 scope。** `portals/app/app/(app)/dashboard/data.ts` - `count` / `aggregate` / `groupBy` 每个都带 `where: { workspaceId }`（SoT 原样）：

```ts
export async function getDashboard(workspaceId: string): Promise<DashboardData> {
  const [total, volumeAgg, byDomain, byTeam, top, qAvg] = await Promise.all([
    prisma.dataset.count({ where: { workspaceId } }),
    prisma.dataset.aggregate({ where: { workspaceId }, _sum: { rowCountEst: true } }),
    prisma.dataset.groupBy({ by: ["domain"], where: { workspaceId }, _count: { _all: true } }),
    prisma.dataset.groupBy({ by: ["team"], where: { workspaceId }, _count: { _all: true } }),
    prisma.dataset.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, code: true, domain: true, classification: true },
    }),
    prisma.qualityResult.aggregate({ where: { workspaceId }, _avg: { score: true } }),
  ]);
  // ...
}
```

**范式约定（写新数据访问代码时的硬性要求）**：

- 每个 Prisma 顶层调用（`findMany` / `findFirst` / `count` / `aggregate` / `groupBy` / `update` / `delete` ...）的 `where` 必须含 `workspaceId`。
- 单条按 `id` 取值时用 `findFirst({ where: { workspaceId, id } })`，不要用 `findUnique({ where: { id } })`（后者绕过 workspace 过滤，会跨租户命中）。
- `workspaceId` 参数只允许来自 `getSession().workspaceId`，不得从 `props` / 请求体 / 查询串透传。
- 客户端组件（`"use client"`）不 import `prisma`；它们只消费服务端已 scope 的返回值。

### 2.3 切换免重认证

org / workspace 切换后，`active_workspace` 变化经令牌刷新重新求值（`session.ts` 的 `resolveIdentity` 在 access token 近过期时以 refresh grant 重新派生 identity，`role/org` 变更即时生效，无需完整重登），随后应用只是**用新的 `workspaceId` 重跑同一批 scoped 查询**。隔离在数据层是纯查询参数切换，不涉及重新走 OIDC 授权码流程（ADR §3.4）。

### 2.4 平台全局参考的只读叠加（对 force-filter 不变量的受控放开）

§2.2 的硬约束是「每个查询的 `where` 必含 `workspaceId`」。唯一被有意放开的口子是**平台层全局参考数据**：arda 运营策展、全平台只读共享的参考集（通过审核的数据标准、行政区划码表、币种码等）。它们由 SoT 的 `AssetScope` 轴标记，行落在保留哨兵 `workspaceId = "__platform__"` 上。

**枚举与承载列（SoT 原样）**：`AssetScope` 只有两个取值；`Standard` 与 `GlossaryTerm` 各带一个 `scope` 列，默认 `workspace`（即租户既有数据默认仍是纯 workspace 隔离，加列向后兼容）：

```prisma
enum AssetScope {
  workspace
  platform
}

model GlossaryTerm {
  // ...
  scope         AssetScope @default(workspace)

  @@unique([workspaceId, term])
  @@index([workspaceId])
}

model Standard {
  // ...
  scope       AssetScope @default(workspace)

  @@unique([workspaceId, code])
  @@index([workspaceId])
}
```

**读取语义（受控放开，收敛在单一 helper）**：对 `Standard` / `GlossaryTerm` 这类可含平台参考的表，租户读取不再是纯 `where: { workspaceId }`，而是叠加平台哨兵：

```ts
// Only relaxation point: read-only, only for tables that may hold platform rows, only overlays the platform sentinel.
where: { workspaceId: { in: [session.workspaceId, "__platform__"] } }
```

这条叠加**必须收敛在一个 workspace-scoped 读 helper 里**，不散落到各处 `findMany`。它守住三条边界：

- **只读**：叠加只用于读；任何写路径的 `where` 仍是纯 `{ workspaceId }`，租户永远写不到 `"__platform__"` 行。
- **只加平台哨兵**：`in` 列表恒为 `[self, "__platform__"]` 两项，绝不出现第三个 workspace。跨 workspace 授权访问（[`data-160`](arda-data-160-cross-workspace-authorization.md)）**不经此叠加**——它走独立的 grant-join helper，绝不通过扩大这个 `in` 列表实现。
- **`"__platform__"` 是普通列值、非 FK**：与 §1 一致，无需先存在 `WorkspaceRef` 行；平台行照常受 `@@unique([workspaceId, code|term])` 约束（在平台命名空间内 code / term 唯一）。

**写入语义**：写 `scope=platform`（`workspaceId="__platform__"`）的行只允许 ops / 平台角色，永不来自租户用户；升格流是 workspace 草稿 -> ops 审核 -> platform 发布（配合 `Standard.status` 的 draft / review / published，治理工程点见 [`data-230`](arda-data-230-governance.md)）。

> 边界重述：这不是把 force-filter 变松，而是给「全平台单一权威、在位只读」的参考数据开一条**白名单式只读叠加**。隔离主轴仍是 `workspaceId`；平台哨兵是它的一个保留取值，不是绕过它。

### 2.5 `ownerApp` / `visibility` / `consumerApp`：workspace 内软轴，非隔离轴

本轮为多 agent 共享新增了属主 / 溯源 / 消费方标记。**它们都不是隔离轴** - 隔离永远且只由 `workspaceId` 兜底；这些列只在**同一个 workspace 内部**区分「谁产出、对谁可见、谁在消费」，让一个 workspace 里的多个 agent 经 arda 共享数据（agent 与 workspace 是 N-N：agent 横跨多 workspace，workspace 内含多 agent；机制详见 [`data-150`](arda-data-150-multiagent-sharing.md)）。

SoT 原样（只列相关新增列）：

```prisma
model Dataset {
  // ...
  ownerApp      String? // Producing agent/app within the workspace (attribution + provenance; NOT an isolation axis - workspaceId is).

  @@index([workspaceId, ownerApp])
}

model DataService {
  // ...
  ownerApp    String?    // publishing agent/app within the workspace
  visibility  String     @default("workspace") // workspace = shared to all agents in the workspace; owner = private to the owner app
}

model ApiKey {
  // ...
  consumerApp   String?   // the agent/app this key authenticates as (consumer identity for audit + policy)
}
```

要点：

- **`Dataset.ownerApp` / `DataService.ownerApp`**：workspace 内标记产出 / 发布该资产的 agent，纯归属 + 溯源。`@@index([workspaceId, ownerApp])` 的前导列仍是 `workspaceId`，让「在 workspace 内按属主 agent 筛」走索引 - 属主只是隔离键之后的二级维度。
- **`DataService.visibility`**：workspace 内的**可见性**而非隔离。`workspace` = 对该 workspace 内所有 agent 共享；`owner` = 仅属主 agent 私有。两种取值都被同一个 `workspaceId` 兜死在 workspace 内，`owner` 只是在隔离之内再收窄可见面。
- **`ApiKey.consumerApp`**：调用方 agent 身份，用于审计 + 策略判定（见 [`data-140`](arda-data-140-audit.md) / [`data-250`](arda-data-250-admin.md)），不参与行级隔离。

> 一句话：`workspaceId` 决定「行属于哪个租户、能不能看见」；`ownerApp` / `visibility` / `consumerApp` 决定「在同一租户内，这行归哪个 agent、对哪些 agent 可见、被哪个 agent 取用」。前者是硬隔离，后者是软属主 - 二者正交，绝不混用。

---

## 3. 逐表 / 逐字段落点

隔离维度在 SoT 全部 17 张表上的落点（与 `portals/app/prisma/schema.prisma` 逐字核对）。`WorkspaceRef` / `SeedTemplate` / `TemplateVersion` 是仅有的 3 张不带 `workspaceId` 的表。

### 3.1 带 `workspaceId` 的业务表（14 张）

| 板块 | model | `workspaceId` | ws 内唯一 | `workspaceId` 索引 | 其它索引 |
|---|---|---|---|---|---|
| assets | `Dataset` | 有（`String`，无 FK） | `@@unique([workspaceId, code])` | `@@index([workspaceId])` | `@@index([workspaceId, dataSourceId])`；`@@index([workspaceId, domain])`；`@@index([workspaceId, ownerApp])` |
| assets | `Tag` | 有 | `@@unique([workspaceId, name])` | `@@index([workspaceId])` | - |
| assets | `DatasetTag` | 有（携带列） | 无（主键 `@@id([datasetId, tagId])`） | `@@index([workspaceId])` | - |
| assets | `GlossaryTerm` | 有 | `@@unique([workspaceId, term])` | `@@index([workspaceId])` | - |
| integration | `DataSource` | 有 | 无 | `@@index([workspaceId])` | - |
| governance | `Policy` | 有 | 无 | `@@index([workspaceId])` | - |
| governance | `QualityRule` | 有 | `@@unique([workspaceId, code])` | `@@index([workspaceId])` | `@@index([datasetId])` |
| governance | `QualityResult` | 有 | 无 | `@@index([workspaceId])` | `@@index([ruleId])`；`@@index([datasetId])` |
| governance | `Standard` | 有 | `@@unique([workspaceId, code])` | `@@index([workspaceId])` | - |
| governance | `LineageEdge` | 有 | `@@unique([upstreamDatasetId, downstreamDatasetId])`（**非 ws 前缀**，见 §3.3） | `@@index([workspaceId])` | - |
| services | `DataService` | 有 | `@@unique([workspaceId, code])` | `@@index([workspaceId])` | - |
| services | `DataServiceDataset` | 有（携带列） | 无（主键 `@@id([dataServiceId, datasetId])`） | `@@index([workspaceId])` | - |
| admin | `ApiKey` | 有 | `hashedKey @unique`（**全局**，见 §3.3） | `@@index([workspaceId])` | - |
| admin | `AuditLog` | 有 | `idempotencyKey @unique`（**全局**，见 §3.3） | `@@index([workspaceId])` | `@@index([workspaceId, createdAt])` |

要点：

- **带 `id` 的业务实体里，`workspaceId` 前置于字段区顶部**（`id` 之后第一位），是刻意的可读约定；两张 join 表（`DatasetTag` / `DataServiceDataset`）无 `id`，`workspaceId` 排在两个 FK 列之后（第 3 位，见 §3.2）。
- **展示码类字段（`code` / `name` / `term`）的唯一性一律 workspace 内唯一**，共 6 张表：`Dataset` / `QualityRule` / `Standard` / `DataService`（`code`）、`Tag`（`name`）、`GlossaryTerm`（`term`）。
- **`workspaceId` 前导复合索引**出现在 `Dataset`（`+dataSourceId` / `+domain` / `+ownerApp`）与 `AuditLog`（`+createdAt`）两表 - 对应目录筛选（含按属主 agent 筛，`+ownerApp` 见 §2.5）与审计翻页等热点；前导列一律是隔离键 `workspaceId`。
- **`scope` / `ownerApp` / `visibility` / `consumerApp` 是本轮新增的非隔离维度**，落点：`GlossaryTerm.scope` / `Standard.scope`（平台只读叠加，§2.4）、`Dataset.ownerApp` / `DataService.ownerApp` / `DataService.visibility` / `ApiKey.consumerApp`（workspace 内软属主，§2.5）。它们都不改变本表的 `workspaceId` 隔离落点。

### 3.2 携带列 vs 前缀唯一：join 表的隔离

`DatasetTag` 与 `DataServiceDataset` 是 M:N join 表。它们的主键是两个 FK 的复合 `@@id`，因此**没有** `@@unique([workspaceId, ...])`；`workspaceId` 是一个**去规范化的携带列**，纯为让 join 表自身也能按 `where: { workspaceId }` 直接过滤 / 建 `@@index([workspaceId])`，无需回连父表。SoT 原样：

```prisma
model DatasetTag {
  datasetId   String
  tagId       String
  workspaceId String

  dataset Dataset @relation(fields: [datasetId], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([datasetId, tagId])
  @@index([workspaceId])
}

model DataServiceDataset {
  dataServiceId String
  datasetId     String
  workspaceId   String

  service DataService @relation(fields: [dataServiceId], references: [id], onDelete: Cascade)
  dataset Dataset     @relation(fields: [datasetId], references: [id], onDelete: Cascade)

  @@id([dataServiceId, datasetId])
  @@index([workspaceId])
}
```

### 3.3 隔离规则的三个「例外」（有意为之，非违规）

以下三处的唯一约束**不**以 `workspaceId` 前缀，但都是安全的，写代码 / 建库时需知其所以然：

1. **`LineageEdge`：`@@unique([upstreamDatasetId, downstreamDatasetId])`**。血缘边没有展示码，其唯一性由「两个数据集 id」决定；`Dataset.id` 是全局唯一 `cuid`，两端数据集必同属一个 workspace，因此这条全局唯一等价于 workspace 内唯一，无需再前缀。查询仍走 `@@index([workspaceId])` 收口。SoT 原样：

```prisma
model LineageEdge {
  id                 String  @id @default(cuid())
  workspaceId        String
  upstreamDatasetId  String
  downstreamDatasetId String
  transform          String?
  jobId              String?

  upstream   Dataset @relation("LineageUpstream", fields: [upstreamDatasetId], references: [id], onDelete: Cascade)
  downstream Dataset @relation("LineageDownstream", fields: [downstreamDatasetId], references: [id], onDelete: Cascade)

  @@unique([upstreamDatasetId, downstreamDatasetId])
  @@index([workspaceId])
}
```

2. **`ApiKey.hashedKey @unique`（全局）**。API key 的哈希必须全局唯一 - 校验时是按 `hashedKey` 反查，不可能先知道 workspace，故唯一性必须是全局。行本身仍带 `workspaceId` 且 `@@index([workspaceId])`。

3. **`AuditLog.idempotencyKey @unique`（全局）**。平台指令（seed / wipe / invalidate）按此键防重放，跨 workspace 全局幂等，故全局唯一（工程细节见 [`data-140`](arda-data-140-audit.md)）。

```prisma
model ApiKey {
  id            String    @id @default(cuid())
  workspaceId   String
  dataServiceId String?
  name          String
  consumerApp   String?   // the agent/app this key authenticates as (consumer identity for audit + policy)
  hashedKey     String    @unique
  scopes        String[]
  lastUsedAt    DateTime?
  revoked       Boolean   @default(false)
  createdAt     DateTime  @default(now())

  service DataService? @relation(fields: [dataServiceId], references: [id], onDelete: SetNull)

  @@index([workspaceId])
}

model AuditLog {
  id             String   @id @default(cuid())
  workspaceId    String
  actor          String // a user id or "platform"
  action         String
  target         String?
  idempotencyKey String?  @unique
  metadata       Json?
  createdAt      DateTime @default(now())

  @@index([workspaceId])
  @@index([workspaceId, createdAt])
}
```

### 3.4 不带 `workspaceId` 的表（3 张，infrastructure 板块）

这 3 张是持久层独有的基建表，不是用户业务数据，故**不参与 `workspaceId` 隔离**（板块详情见 [`data-260`](arda-data-260-infrastructure.md)）。SoT 原样：

```prisma
model WorkspaceRef {
  id         String   @id // = platform/IdP active_workspace
  orgId      String
  seedStatus String? // platform marker: needs sample-data fill (ADR section 4)
  createdAt  DateTime @default(now())

  @@index([orgId])
}

model SeedTemplate {
  id        String            @id @default(cuid())
  name      String
  createdAt DateTime          @default(now())
  versions  TemplateVersion[]
}

model TemplateVersion {
  id         String       @id @default(cuid())
  templateId String
  version    String
  manifest   Json
  createdAt  DateTime     @default(now())

  template SeedTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, version])
}
```

- **`WorkspaceRef`**：隔离锚点本身。它的 `id` **就是** `workspaceId`（= 平台 `active_workspace`），因此没有独立的 `workspaceId` 列，也无 `@@index([workspaceId])`；它按 `orgId` 索引（一个 org 下多个 workspace）。arda 不拥有其生命周期，仅镜像。
- **`SeedTemplate` / `TemplateVersion`**：全局只读、版本化的示例数据模板（平台 / ops 策展），跨所有 workspace 共享，故无 `workspaceId`。`TemplateVersion` 的唯一约束是 `@@unique([templateId, version])`（模板内版本唯一），与 workspace 无关。

---

## 4. 现状与目标态

隔离的**schema 层**（§2.1）与**读路径应用层**（§2.2）已落地并在跑：目录 / 仪表盘 / 质量 / 标准 / 服务等页面均经 `getSession().workspaceId` -> `where: { workspaceId }` 收口。以下是待接部分，交叉引用 [`data-300`](arda-data-300-migration.md)：

| 项 | 现状 | 目标态 | 出处 |
|---|---|---|---|
| `workspaceId` 来源 | 开发期 `dev-login` 注入 `active_workspace: "dev-ws-001"`；生产读 OIDC claim | 平台真实 `active_workspace` claim（未来或改实时端点，但仍以 `workspaceId` 为隔离键） | [`data-300`](arda-data-300-migration.md) §4.2 |
| 真实 workspace 数据 | beta/prod 真实 `workspaceId` 当前空态（seed 硬编码 `dev-ws-001`，仅本地/CI 跑） | 平台标记 `WorkspaceRef.seedStatus` -> 首次进入按 `SeedTemplate` 克隆进真实 `workspaceId` | [`data-300`](arda-data-300-migration.md) §4.1 |
| 按 `workspaceId` 的 wipe | ✅ 已实现（2026-07-14，Lc-BL3 定案：workspace 级锚点软删 `WorkspaceRef.wipedAt`，非逐表 `deletedAt`——不给 force-filter 范式加第四条规则） | 平台 `wipe` 指令按 `workspaceId` 软删 + 延迟硬删（幂等 + 审计） | [`data-300`](arda-data-300-migration.md) §4.3 |
| 写路径 scope 强制 | 目前读路径已全量 scope；写路径（create/update/delete）尚少，靠范式约定（§2.2）人工保证 | 可考虑收敛为统一的 workspace-scoped 数据访问封装，减少漏写 `workspaceId` 的面 | 本文件 §2.2（约定层，未强制到工具） |

> 隔离键本身（`workspaceId = active_workspace`，普通列非 FK）是稳定契约，不随上述迁移变动；变动的只是 `workspaceId` 的**信任源**（claim vs 实时端点）与**数据填充路径**（seed vs 模板克隆）。

---

## 变更规程

1. 真源永远是 `portals/app/prisma/schema.prisma`；本文件只是其可读导览，任何字段 / 索引 / 唯一约束以 SoT 为准。
2. 新增业务表时：加 `workspaceId String`（置于 `id` 之后）、至少 `@@index([workspaceId])`、展示码类唯一性用 `@@unique([workspaceId, <code>])`；热点查询的复合索引以 `workspaceId` 为前导列。默认**不**为 `workspaceId` 建 FK。
3. 新增数据访问代码时：`where` 必含 `workspaceId`，单条取值用 `findFirst({ where: { workspaceId, id } })`，`workspaceId` 仅来自 `getSession().workspaceId`；客户端组件不 import `prisma`。
4. 改动隔离方式（如某表是否带 `workspaceId`、某唯一约束是否 workspace 前缀）须同步更新本文件 §3 表格、[`data-100`](arda-data-100-architecture.md) §4-5 总览、对应板块 schema（[`data-210`](arda-data-210-assets.md)..[`data-260`](arda-data-260-infrastructure.md)）。
5. 平台全局参考（`scope=platform`）：行用哨兵 `workspaceId="__platform__"`，租户**只读**叠加 `workspaceId IN (self, "__platform__")` 且必须收敛在单一读 helper；写 platform 行只允许 ops 角色。改动此叠加规则须同步 §2.4 与 SoT 的 `AssetScope` 注释。
6. `ownerApp` / `DataService.visibility` / `ApiKey.consumerApp` 是 workspace 内软属主 / 可见性 / 消费方轴，**非隔离轴**；新增此类列不得替代或削弱 `workspaceId` force-filter。多 agent 共享语义以 [`data-150`](arda-data-150-multiagent-sharing.md) 为准。
7. 索引选型的完整清单见 [`data-120`](arda-data-120-indexing.md)；审计 / 幂等键工程见 [`data-140`](arda-data-140-audit.md)；迁移执行与现状差距见 [`data-300`](arda-data-300-migration.md)。
8. 跨 workspace 授权访问（同 org 内、资源级 `WorkspaceGrant`）的模型与读路径见 [`data-160`](arda-data-160-cross-workspace-authorization.md)；它不修改本文件的默认范式——任何"为跨 ws 放宽默认过滤"的改动都是违规，跨 ws 读取只允许经 data-160 §3 的 grant-join helper。
