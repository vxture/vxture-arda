# arda 数据架构 · 数据集成 schema（arda-data-220-integration）

> 状态：详细设计（第 2 层 · 板块 schema；跟随业务需求演进，变更须同步 SoT 与本文件）
> 层：第 2 层 · 板块 schema · integration（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（本文件只是其可读导览，字段名 / 类型 / 索引以 schema 为准）
> 上游：[`data-100`](arda-data-100-architecture.md) §5 领域模型；横切 [`data-130`](arda-data-130-encryption.md)（connectionConfig 应用层加密）；业务面对应 [`biz-220`](arda-biz-220-integration.md)

---

## 1. 板块概述

`integration`（数据集成）板块把外部系统接入 arda：**登记数据源 + 拉取 schema/元数据 + 维持保鲜**。它是价值链最左端，也承载 arda 领域数据的「更新」语义（`DataSource.lastSyncedAt` 保鲜标记 + `Dataset.refreshFreq` 刷新频率）。对应业务面板块 [`biz-220`](arda-biz-220-integration.md)。

**v1 范围与边界（catalog-first，只登记不搬运）**：

- **在册**：`DataSource` 一张表。仅承载「外部系统的连接登记 + 元数据/schema 拉取」。拉来的元数据落到 `Dataset`（`assets` 板块，见 [`data-210`](arda-data-210-assets.md)），由 `Dataset.dataSourceId` 反指回本板块的 `DataSource`。
- **不做数据搬运**：v1 明确「只登记不搬运」。SoT 中 `DataSource` model 顶部的 `///` 注释即写死这一约束：`v1: registration + schema/metadata pull only - no actual data movement.`。
- **future（保留定义、不建表）**：`Pipeline`（同步/变换定义）、`JobRun`（一次执行记录）。二者在领域目录中明确标 `future`，建表前置 = 真实数据搬运需求驱动（见 §5）。
- **不在本板块**：列级 `Field`（列级 schema）是 `governance` 板块的 `future` 项，见 [`data-230`](arda-data-230-governance.md)，不在此处。

**隔离约定**：`DataSource` 是业务表，带 `workspaceId`（平台/IdP 的 `active_workspace`），且为**普通索引列、非外键**（workspace 生命周期归平台，业务行不依赖本地 `WorkspaceRef` 先存在）。工程细节见横切 [`data-110`](arda-data-110-isolation.md)（隔离模型）。

**本板块表与 biz 对应**：

| 分区 | model | ws? | 状态 | 核心用途 |
|---|---|---|---|---|
| integration | `DataSource` | Y | v1（已建表） | 外部系统登记 + 元数据拉取；不搬数据 |
| integration | `Pipeline` | - | future（不建表） | 同步/变换定义 |
| integration | `JobRun` | - | future（不建表） | 一次执行记录 |

---

## 2. 表定义

### 2.1 DataSource

以下代码块原样照抄 SoT（`portals/app/prisma/schema.prisma` 的 `integration` 段），字段名 / 类型 / 默认值 / 关系 / 索引一字不差：

```prisma
/// v1: registration + schema/metadata pull only - no actual data movement.
model DataSource {
  id              String    @id @default(cuid())
  workspaceId     String
  name            String
  type            String // postgres | s3 | bigquery | rest | file | ...
  connectionConfig Json?   // encrypted at the app layer before persistence
  status          String    @default("connected")
  lastSyncedAt    DateTime?
  createdAt       DateTime  @default(now())

  datasets Dataset[]

  @@index([workspaceId])
}
```

字段说明要点：

| 字段 | 类型 | 可选性 | 默认 | 语义 |
|---|---|---|---|---|
| `id` | `String` | 主键 | `@default(cuid())` | 主键，cuid 生成，`@id`。 |
| `workspaceId` | `String` | 必填 | 无 | 隔离键 = 平台 `active_workspace`。普通索引列、非 FK；所有查询在服务端按 `where: { workspaceId }` 收口。 |
| `name` | `String` | 必填 | 无 | 数据源展示名。**不强制 workspace 内唯一**（无 `@@unique`，理由见 §4）。 |
| `type` | `String` | 必填 | 无 | 数据源类型，自由字符串键。SoT 注释给出取值范围：`postgres | s3 | bigquery | rest | file | ...`。用 `String` 而非 enum，便于新增连接器不改 schema。 |
| `connectionConfig` | `Json?` | 可选 | 无 | 连接配置（连接串 / 凭据 / 桶名等）。**应用层加密后再落库**（SoT 注释：`encrypted at the app layer before persistence`）；明文凭据不入库。加解密封装与密钥管理见横切 [`data-130`](arda-data-130-encryption.md)。 |
| `status` | `String` | 必填 | `@default("connected")` | 连接状态，自由字符串。默认 `connected`。 |
| `lastSyncedAt` | `DateTime?` | 可选 | 无 | 上次元数据同步时间。承载「保鲜」语义；未同步时为 null。 |
| `createdAt` | `DateTime` | 必填 | `@default(now())` | 登记时间。本表**无** `updatedAt`（对比 `Dataset` / `Standard` 有 `@updatedAt`）。 |

> `type` / `status` 均为自由字符串而非 Prisma enum：连接器种类与状态机随产品演进频繁，字符串键避免每次加值都触发 schema 迁移。取值语义以 SoT 行内注释为准，不在 DB 层强约束。

---

## 3. 关系与删除策略

本板块只有一条关系：`DataSource` 1 -- N `Dataset`（一个数据源可拉出多个数据集）。

**关系落点与方向**：外键 `dataSourceId` 落在 **`Dataset` 侧**（`assets` 板块，见 [`data-210`](arda-data-210-assets.md)），指向 `DataSource.id`；`DataSource` 侧仅是反向集合 `datasets Dataset[]`（无 `@relation` 参数、无 `onDelete`）。`Dataset` 侧的相关行（SoT `Dataset` model，原样照抄）：

```prisma
  dataSourceId  String?
  // ...
  source         DataSource?     @relation(fields: [dataSourceId], references: [id], onDelete: SetNull)
```

方向：`Dataset.dataSourceId -> DataSource.id`（`Dataset.source` 为可选，`dataSourceId String?` 可空 -> 数据集允许「无来源」）。

**删除策略：`onDelete: SetNull`（不是 Cascade）**。删除一个 `DataSource` 时，其名下 `Dataset.dataSourceId` 被置空，**数据集本身保留**。设计理由：

- **资产的生命周期长于来源登记**。catalog 是产品核心资产；一次「解除数据源登记」不应连带抹掉已经编目的数据集。数据集去掉来源后退化为「无来源资产」（`dataSourceId = null`），仍可在目录中被治理、被服务引用。
- **对比 Cascade 的板块**：`governance` 侧的 `QualityRule` / `QualityResult` / `LineageEdge` 对 `Dataset` 用 `onDelete: Cascade`（规则/结果/血缘依附于数据集，数据集没了它们无意义）。二者取向相反：**依附型子记录用 Cascade，弱引用的来源指针用 SetNull**。
- **可空性配合**：`dataSourceId String?` 本就可空，SetNull 才有落点；若该 FK 必填，SetNull 会违反非空约束。

---

## 4. 唯一约束与索引

`DataSource` 的索引/约束**仅一条**（原样照抄 SoT）：

```prisma
  @@index([workspaceId])
```

逐条说明与设计理由：

- `@@index([workspaceId])`：每张业务表的基线隔离索引。所有查询按 `workspaceId` 收口，此索引支撑「列某 workspace 下全部数据源」的高频访问。
- **无 `@@unique`**：`DataSource` 没有展示编码 `code`（对比 `Dataset` / `Standard` / `DataService` 都有 `@@unique([workspaceId, code])`），`name` 也**不设唯一约束**。理由：同一 workspace 内允许登记同名/重复来源（例如两套同名 `postgres` 库、或重新登记同一来源），唯一性由业务侧而非 DB 约束裁量。
- **无 `@@id` 复合主键**：单表以 cuid `id` 作主键（对比连接表 `DatasetTag` / `DataServiceDataset` 用 `@@id([...])` 复合主键）。
- **关系的 join 索引落在对端**：支撑「按来源列数据集」的复合索引是 `Dataset` 侧的 `@@index([workspaceId, dataSourceId])`（属 [`data-210`](arda-data-210-assets.md)），本表不重复建。这也印证外键落在 `Dataset` 侧的取向 -- 查询「某 source 有哪些 dataset」走 `Dataset` 表的复合索引，而非扫 `DataSource`。

---

## 5. future 与有意不落库

### 5.1 future：保留定义、不建表

`Pipeline` / `JobRun` 在领域目录与 [`biz-220`](arda-biz-220-integration.md) §4 中明确标 `future`，v1 **不建表**、schema 中无对应 model。建表前置 = 真实数据搬运（ETL/调度）需求驱动，避免提前落表造成配置漂移。

下表为二者的**示意字段**（来源：[`biz-220`](arda-biz-220-integration.md) §4，**非 SoT**，`portals/app/prisma/schema.prisma` 中尚无这两个 model）：

| 实体 | 状态 | 示意字段（非 SoT，仅记录意图） |
|---|---|---|
| `Pipeline` | future | `sourceId` / `targetDatasetId` / `schedule` / `transformConfig` / `enabled`（同步/变换定义） |
| `JobRun` | future | `startedAt` / `finishedAt` / `status` / `rowsProcessed` / `error`（一次执行记录） |

以下为**意图示意**的 TypeScript 形状草图，仅用于说明未来落表时的大致结构，**不是** prisma SoT，落表时以届时的 `schema.prisma` 为准：

```ts
// 示意（future，尚未建模；非 SoT）。真正建表时以 prisma/schema.prisma 为准。
interface Pipeline {
  id: string;
  workspaceId: string;
  sourceId: string;          // -> DataSource.id
  targetDatasetId: string;   // -> Dataset.id
  schedule: string;          // cron 等
  transformConfig: unknown;  // Json
  enabled: boolean;
}

interface JobRun {
  id: string;
  workspaceId: string;
  pipelineId: string;        // -> Pipeline.id
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  rowsProcessed: number;
  error: string | null;
}
```

> 列级 `Field`（列级 schema：类型/可空/分级/位置）同为 `future`，但归 `governance` 板块，见 [`data-230`](arda-data-230-governance.md)，不在本板块。

### 5.2 有意不落库（派生值 / 敏感明文）

- **来源名下的数据集数量**：不落 `DataSource`。它派生自对 `Dataset.dataSourceId` 的 join/聚合（走 `Dataset` 侧的 `@@index([workspaceId, dataSourceId])`），算得出即取，避免与真实数据集数漂移。
- **连接健康 / 同步耗时 / 调用延迟等 telemetry**：v1 不建模。`DataSource` 只保留 `lastSyncedAt` 一个保鲜标记与 `status` 一个粗粒度状态；细粒度时序观测属仪表盘聚合，非本表职责（与 [`data-100`](arda-data-100-architecture.md) §5「有意不落库」一致）。
- **`connectionConfig` 明文**：**永不落库**。表里只存应用层加密后的密文（SoT 注释：`encrypted at the app layer before persistence`）；明文凭据仅存在于加解密边界内。密钥管理、加解密封装、轮换见横切 [`data-130`](arda-data-130-encryption.md)。

---

## 6. 变更规程

1. 改 `portals/app/prisma/schema.prisma`（本板块 = `integration` 段的 `DataSource`；`Dataset.dataSourceId` / `Dataset.source` 关系改动属 `assets`，见 [`data-210`](arda-data-210-assets.md)）。
2. `prisma migrate dev --name <desc>` 生成迁移，产物入 `prisma/migrations/`；部署时容器启动自动 `prisma migrate deploy`（见 [`data-300`](arda-data-300-migration.md) §2）。
3. 同步更新本文件 §2 表定义（字段/默认/注释）与 §3/§4（关系/索引）。
4. 若把 `Pipeline` / `JobRun` 从 future 落为实表，或改变 `DataSource` 的隔离/删除策略，同步更新 [`data-100`](arda-data-100-architecture.md) §5 总览、[`biz-220`](arda-biz-220-integration.md) §4，并在 [`data-300`](arda-data-300-migration.md) 记录迁移。
5. 一切以真源为准：字段名 / 类型 / 默认 / 关系 / 索引若本文件与 `portals/app/prisma/schema.prisma` 不一致，以 SoT 为准并回改本文件。
