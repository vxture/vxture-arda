# arda 数据架构 · 索引与性能约定（arda-data-120-indexing）

> 状态：权威设计（横切工程，索引/唯一约束以 SoT 逐字为准，随 SoT 演进）
> 层：第 1 层 · 横切工程（索引与性能，`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（本文件只是其可读导览，全部 `@@index` / `@@unique` / `@@id` / `@unique` 以 SoT 为准）
> 上游：总体设计见 [`data-100`](arda-data-100-architecture.md)；相关横切 `data-110`（隔离，索引前缀的语义依据）；板块落点见 `data-210..260`（逐表字段级设计）与业务面 [`biz-230`](arda-biz-230-governance.md)；迁移与现状见 [`data-300`](arda-data-300-migration.md)

---

## 1. 主题与约束概述

本文件是持久层「索引与性能」的横切约定，回答三个工程问题：**建了哪些索引/唯一约束、为什么这样建、应用层查询如何配合命中它们**。它承接原 schema 详细设计的「索引一览」，逐表与 SoT（`portals/app/prisma/schema.prisma`）核对，并补上复合列序、聚合查询、`BigInt` 计数等工程细节。

**边界（不越界）**：

- 本文件只谈**索引、唯一约束、主键、以及为命中它们的查询范式**。字段语义 / 关系 / 删除策略见各板块 schema（`data-210..260`）；`workspaceId` 取值链路与强制过滤的语义见 `data-110`（隔离）；派生值「为何不落库」的产品判断见 [`data-100`](arda-data-100-architecture.md) §5，本文件只谈其**对聚合查询与索引的影响**。

**五条核心约定**（下文逐条展开）：

1. **workspace 前缀原则**：每张业务表至少 `@@index([workspaceId])`；热点复合索引一律以 `workspaceId` 作为最左列（等值锚点），选择性/排序列排其后。
2. **唯一性一律 workspace 内收敛**：展示编码 `code` / `name` / `term` 的唯一约束都加 `workspaceId` 前缀（`@@unique([workspaceId, code])`），使不同 workspace 可复用同一编码。
3. **四处全局唯一例外**：`ApiKey.hashedKey`、`AuditLog.idempotencyKey`、`LineageEdge([upstreamDatasetId, downstreamDatasetId])`、`TemplateVersion([templateId, version])` 不带 `workspaceId`，是有意的全局唯一（安全 / 幂等 / 关系去重 / 全局模板）。
4. **派生值不落库 -> 聚合逐 scope**：质量总分、订阅数等派生值不建列、不建索引；它们由 `groupBy` / 聚合在查询期算出，每次都必须带 `where: { workspaceId }`，命中 `workspaceId` 前缀的复合索引。
5. **计数用 `BigInt`、不建范围索引**：`Dataset.rowCountEst` / `Dataset.sizeBytes` 是 `BigInt?`（Postgres `bigint`），v1 无按大小排序/过滤需求，故不索引；但跨 JS 序列化边界需显式转换。

**联结表**（`DatasetTag` / `DataServiceDataset`）用复合 `@@id` 充当主键兼唯一索引，另加 `@@index([workspaceId])` 辅助隔离过滤。

---

## 2. 规则与范式

### 2.1 schema 层：复合索引的列序原则

Postgres 的 btree 复合索引 `(a, b)` 可服务：对 `a` 的等值/范围、对 `(a, b)` 的联合过滤、以及在 `a` 被等值固定后对 `b` 的排序/范围；但**不能**单独服务只过滤 `b` 的谓词。据此，本 schema 把 `workspaceId`（永远等值命中的隔离锚）放最左，把实际选择列或排序列放其右：

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
}
```

- `@@index([workspaceId, domain])` 服务目录「按主题域筛选/分组」：`where: { workspaceId, domain }` 与 `groupBy(["domain"], where: { workspaceId })` 均可命中最左前缀。
- `@@index([workspaceId, dataSourceId])` 服务「某数据源下的资产列表」，同时覆盖 `dataSourceId` 这个 FK 列的查找（Postgres 不会为外键自动建索引，须显式建）。
- `@@index([workspaceId])` 是最基础的隔离过滤索引，兜底一切只按 workspace 收口的列表查询。

时间线场景把排序列放最右：

```prisma
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

- `@@index([workspaceId, createdAt])` 服务「某 workspace 的审计流按时间倒序翻页」：`where: { workspaceId }, orderBy: { createdAt: "desc" }`，`workspaceId` 等值固定后 `createdAt` 有序，索引即可满足排序，避免 filesort。

### 2.2 唯一性收敛与四处全局例外

**收敛规则**：所有面向用户的展示编码，唯一约束一律加 `workspaceId` 前缀，使编码是「workspace 内唯一」而非全局唯一。落点：`Dataset` / `QualityRule` / `Standard` / `DataService` 的 `@@unique([workspaceId, code])`；`Tag` 的 `@@unique([workspaceId, name])`；`GlossaryTerm` 的 `@@unique([workspaceId, term])`。这些复合唯一索引同时是各自「按 code/name/term 精确查」的最佳查找路径。

**四处全局例外**（有意不带 `workspaceId`）：

```prisma
model ApiKey {
  // ...
  hashedKey     String    @unique
  // ...
}
```
`ApiKey.hashedKey` -- 密钥校验发生在鉴权早期、尚未解析 workspace 上下文，必须能仅凭哈希做全局 O(1) 查找；且密钥本就应全局不可碰撞。

```prisma
model AuditLog {
  // ...
  idempotencyKey String?  @unique
  // ...
}
```
`AuditLog.idempotencyKey` -- 承载平台指令（seed / wipe / invalidate，见 ADR §5.1）的幂等防重放键，去重语义是全局的（同一指令投递多次只落一条），故不能按 workspace 收敛。可空：仅平台指令类审计携带，普通活动审计为 `null`（`@unique` 在 Postgres 允许多个 `NULL`，不冲突）。

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
`LineageEdge([upstreamDatasetId, downstreamDatasetId])` -- 血缘边的去重键。两个 dataset id 都是全局唯一 cuid，且都是 workspace 内的 `Dataset`（`onDelete: Cascade`），因此这条全局唯一在实践中等价于 workspace 内唯一，不加 `workspaceId` 前缀也不会跨 workspace 误撞。该复合唯一同时充当「按上游 dataset 查下游」的查找索引（最左列 `upstreamDatasetId`）。

```prisma
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
`TemplateVersion([templateId, version])` -- `SeedTemplate` / `TemplateVersion` 是全局只读、平台策展的示例数据模板，**不带 `workspaceId`**（唯一不做 workspace 隔离的板块，见 [`data-000`](arda-data-000-index.md) §3），故版本唯一天然是全局的。

### 2.3 应用层查询范式（命中索引 + 逐 scope 聚合）

服务端一律以复合过滤收口，客户端组件不直连数据库：

```ts
// (app)/catalog/data.ts -- 单条读取：复合过滤，命中 (workspaceId, ...) 索引，防跨 workspace
export async function getCatalogAsset(workspaceId: string, id: string) {
  return prisma.dataset.findFirst({ where: { workspaceId, id } });
}

// 精确按展示编码查：命中 @@unique([workspaceId, code])
export async function getAssetByCode(workspaceId: string, code: string) {
  return prisma.dataset.findUnique({ where: { workspaceId_code: { workspaceId, code } } });
}
```

派生值不落库 -> 聚合在查询期算出，且**每个聚合都必须带 `where: { workspaceId }`**（逐 scope），命中 `workspaceId` 前缀索引：

```ts
// (app)/dashboard/data.ts -- 按主题域分组计数：命中 @@index([workspaceId, domain])
prisma.dataset.groupBy({ by: ["domain"], where: { workspaceId }, _count: { _all: true } });

// 某数据集的质量总分：由 QualityResult 聚合得出（不落 Dataset 表），按 datasetId 收口
prisma.qualityResult.aggregate({ where: { workspaceId, datasetId }, _avg: { score: true } });
```

`BigInt` 计数字段跨序列化边界需显式转换（`JSON.stringify` 不支持 `BigInt`）：

```ts
// server component -> client 边界：BigInt? 需转成 number/string 再传出
const size = dataset.sizeBytes === null ? null : Number(dataset.sizeBytes);
```

---

## 3. 逐表 / 逐字段落点

### 3.1 全表索引 / 唯一 / 主键一览（与 SoT 逐字一致）

按 `schema.prisma` 分段顺序，覆盖全部 17 个 model：

| 板块 | model | 主键 `@id` / `@@id` | 唯一 `@@unique` / `@unique` | 二级索引 `@@index` |
|---|---|---|---|---|
| assets | `Dataset` | `id @id @default(cuid())` | `@@unique([workspaceId, code])` | `@@index([workspaceId])`、`@@index([workspaceId, dataSourceId])`、`@@index([workspaceId, domain])` |
| assets | `Tag` | `id @id @default(cuid())` | `@@unique([workspaceId, name])` | `@@index([workspaceId])` |
| assets | `DatasetTag` | `@@id([datasetId, tagId])` | -（复合主键即唯一） | `@@index([workspaceId])` |
| assets | `GlossaryTerm` | `id @id @default(cuid())` | `@@unique([workspaceId, term])` | `@@index([workspaceId])` |
| integration | `DataSource` | `id @id @default(cuid())` | - | `@@index([workspaceId])` |
| governance | `Policy` | `id @id @default(cuid())` | - | `@@index([workspaceId])` |
| governance | `QualityRule` | `id @id @default(cuid())` | `@@unique([workspaceId, code])` | `@@index([workspaceId])`、`@@index([datasetId])` |
| governance | `QualityResult` | `id @id @default(cuid())` | - | `@@index([workspaceId])`、`@@index([ruleId])`、`@@index([datasetId])` |
| governance | `Standard` | `id @id @default(cuid())` | `@@unique([workspaceId, code])` | `@@index([workspaceId])` |
| governance | `LineageEdge` | `id @id @default(cuid())` | `@@unique([upstreamDatasetId, downstreamDatasetId])` | `@@index([workspaceId])` |
| services | `DataService` | `id @id @default(cuid())` | `@@unique([workspaceId, code])` | `@@index([workspaceId])` |
| services | `DataServiceDataset` | `@@id([dataServiceId, datasetId])` | -（复合主键即唯一） | `@@index([workspaceId])` |
| admin | `ApiKey` | `id @id @default(cuid())` | `hashedKey String @unique`（全局） | `@@index([workspaceId])` |
| admin | `AuditLog` | `id @id @default(cuid())` | `idempotencyKey String? @unique`（全局，可空） | `@@index([workspaceId])`、`@@index([workspaceId, createdAt])` |
| infrastructure | `WorkspaceRef` | `id @id`（= 平台 `active_workspace`，无 cuid） | - | `@@index([orgId])` |
| infrastructure | `SeedTemplate` | `id @id @default(cuid())` | - | -（无二级索引） |
| infrastructure | `TemplateVersion` | `id @id @default(cuid())` | `@@unique([templateId, version])`（全局） | -（复合唯一即查找索引） |

> 说明：`@@unique` 与 `@@id` 在 Postgres 都物化为唯一 btree 索引，可被等值/最左前缀查询命中；`@id` 是主键索引。`SeedTemplate` 只有主键、无二级索引与唯一约束（仅 `id` + `name` + `createdAt` + `versions` 关系）。

### 3.2 复合索引热点（逐条）

| 复合索引 | 所在表 | 服务的查询 | 最左前缀命中面 |
|---|---|---|---|
| `@@index([workspaceId, dataSourceId])` | `Dataset` | 某数据源下的资产列表；`dataSourceId` FK 查找 | `{workspaceId}`、`{workspaceId, dataSourceId}` |
| `@@index([workspaceId, domain])` | `Dataset` | 目录按主题域筛选 / 仪表盘按 domain 分组计数 | `{workspaceId}`、`{workspaceId, domain}`、按 domain 排序 |
| `@@index([workspaceId, createdAt])` | `AuditLog` | 审计流按时间倒序翻页 | `{workspaceId}` + 按 createdAt 有序 |
| `@@unique([workspaceId, code])` | `Dataset` / `QualityRule` / `Standard` / `DataService` | 按展示编码精确查 + 唯一性约束 | `{workspaceId}`、`{workspaceId, code}` |
| `@@unique([upstreamDatasetId, downstreamDatasetId])` | `LineageEdge` | 血缘边去重 + 按上游查下游 | `{upstreamDatasetId}`、联合 |

> 注意最左前缀语义：`@@index([workspaceId, domain])` 已覆盖仅按 `workspaceId` 的过滤，故不需另建单列 `workspaceId` 索引即可服务该场景;但 schema 仍保留独立 `@@index([workspaceId])` 作为语义清晰的兜底（几乎所有列表查询都以它收口）。

### 3.3 唯一约束逐条（workspace 内 vs 全局）

- **workspace 内收敛**（8 处）：`Dataset.@@unique([workspaceId, code])`、`Tag.@@unique([workspaceId, name])`、`GlossaryTerm.@@unique([workspaceId, term])`、`QualityRule.@@unique([workspaceId, code])`、`Standard.@@unique([workspaceId, code])`、`DataService.@@unique([workspaceId, code])`，以及联结表复合主键 `DatasetTag.@@id([datasetId, tagId])` / `DataServiceDataset.@@id([dataServiceId, datasetId])`（因两侧 id 均为 workspace 内 `Dataset`/`Tag`/`DataService`，实效即 workspace 内唯一）。
- **全局唯一例外**（4 处，见 §2.2）：`ApiKey.hashedKey`（安全查找）、`AuditLog.idempotencyKey`（幂等去重，可空）、`LineageEdge([upstreamDatasetId, downstreamDatasetId])`（边去重）、`TemplateVersion([templateId, version])`（全局模板版本）。

### 3.4 派生值不落库 -> 聚合查询的落点

[`data-100`](arda-data-100-architecture.md) §5「有意不落库」在索引层的直接后果：**没有对应列，也就没有对应索引，值只能在查询期由聚合算出**。

- `Dataset` 的**质量总分**：无 `qualityScore` 列，由 `QualityResult` 聚合得出。按 dataset 收口命中 `QualityResult.@@index([datasetId])`；按 workspace 汇总命中 `@@index([workspaceId])`。
- `Dataset` 的**订阅数**：无列，由订阅 join 派生，算不出时 UI 显示 `-`。
- **仪表盘按 domain 的分布**：`groupBy(["domain"], where: { workspaceId })` 命中 `Dataset.@@index([workspaceId, domain])`;这是复合索引最左前缀直接服务聚合的范例。
- **通用铁律**：每个 `groupBy` / `aggregate` / `count` 都必须带 `where: { workspaceId }`，否则既跨 workspace 泄漏，又无法命中 `workspaceId` 前缀索引而退化为全表扫描。

### 3.5 `BigInt` 计数字段

仅 `Dataset` 两列：

```prisma
  rowCountEst   BigInt?
  sizeBytes     BigInt?
```

- 类型：Postgres `bigint`（int8），可空。承载估算行数与字节体积，量级可能超过 32 位。
- **不索引**：v1 无「按体积排序 / 阈值过滤」的产品需求，故不建范围索引；若未来出现「按大小 Top-N」需求，再评估 `@@index([workspaceId, sizeBytes])` 一类复合范围索引（`workspaceId` 等值 + `sizeBytes` 有序）。
- **序列化边界**：Prisma 将其映射为 JS `BigInt` 原生类型，`JSON.stringify` 直接抛错;从 server component 传向 client 前须显式转 `Number`/`string`（见 §2.3）。

---

## 4. 现状与目标态

（差距与演进详见 [`data-300`](arda-data-300-migration.md)；此处只列与索引/性能相关的部分。）

### 4.1 已实现

- §3.1 表中全部 `@@index` / `@@unique` / `@@id` 均已随迁移 `0001`~`0005` 落库（`Dataset` 的 `@@unique([workspaceId, code])` 与 `@@index([workspaceId, domain])` 由 `0002_catalog_fields` 引入，见 [`data-300`](arda-data-300-migration.md) §1）。当前 schema 版本 `0005_service_fields`（v1，catalog-first）。
- workspace 前缀原则、唯一性收敛、四处全局例外均已在 SoT 中定型。

### 4.2 现状观察与待评估（非缺陷，随需求驱动）

- **反向关系无专用索引**：Postgres 不为外键自动建索引，且复合索引只服务最左前缀，因此下列「第二列」方向的查询目前走扫描 -- `LineageEdge` 按 `downstreamDatasetId` 反查上游（唯一键最左是 `upstreamDatasetId`）、`DatasetTag` 按 `tagId` 反查、`DataServiceDataset` 按 `datasetId` 反查、`ApiKey` 按 `dataServiceId` 反查（`dataServiceId` 仅有 FK 无索引）。v1 数据量小可接受;若这些反向遍历成为热点，再补对应单列/复合索引。
- **质量结果时序**：`QualityResult` 无 `@@index([workspaceId, runAt])`;若仪表盘要「按时间窗聚合质量趋势」，可参照 `AuditLog.@@index([workspaceId, createdAt])` 补一条。
- **聚合无物化**：派生值全部查询期实时算（见 §3.4），无物化视图 / 缓存表;Redis 仅作会话/令牌，不做数据缓存（[`data-100`](arda-data-100-architecture.md) §2）。数据量增大后若聚合变慢，属需要时再引入的优化，不是当前目标。

### 4.3 目标态

保持「可推导优于可存储」（[`data-100`](arda-data-100-architecture.md) §1）：索引服务于**过滤 + 精确查 + 排序 + 聚合命中**，而非为派生值预建冗余列与索引。新增热点先加复合索引（`workspaceId` 前缀），仅在实测聚合瓶颈时才考虑物化。

---

## 5. 变更规程

索引与唯一约束的唯一真源是 `portals/app/prisma/schema.prisma`，任何变更须从改 schema 开始：

1. 在 `portals/app/prisma/schema.prisma` 增删 `@@index` / `@@unique` / `@@id` / `@unique`。
2. `prisma migrate dev --name <desc>` 生成迁移，产物入 `prisma/migrations/`（部署时容器启动 `prisma migrate deploy` 应用，见 [`data-300`](arda-data-300-migration.md) §2）。
3. 同步本文件 §3.1 一览表与相关热点说明;并同步对应板块 `data-210..260`。
4. 若新增复合索引，核对应用层查询是否以 `workspaceId` 前缀 + 正确列序命中（§2.1）;若新增唯一约束，明确它是 workspace 内收敛还是全局例外（§2.2 / §3.3）。
5. 迁移在各栈的应用方式、现状 vs 目标态见 [`data-300`](arda-data-300-migration.md)。
