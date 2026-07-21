# arda 数据架构 · 数据资产 schema（arda-data-210-assets）

> 状态：详细设计（可据此建库；随业务演进，变更须同步 `portals/app/prisma/schema.prisma` 与本文件）
> 层：第 2 层 · 板块 schema（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（本文件仅为其可读导览，字段名/类型/默认/关系/索引以 schema 文件逐字为准）
> 上游：总体设计见 [`data-100`](arda-data-100-architecture.md)；横切约束见 `data-110`（隔离）/ `data-120`（索引）；业务面对应 [`biz-210`](arda-biz-210-assets.md)

---

## 1. 板块概述

### 1.1 本板块承载什么

assets 是 catalog-first 的核心板块：把「本 workspace 有哪些数据资产」登记成可检索、可分级、可打标签、可挂治理的目录条目。它是整个 schema 的引用中心 - 集成（DataSource）、治理（QualityRule/QualityResult/LineageEdge/Policy/Standard）、服务（DataService）都围绕 `Dataset` 展开。

本板块含四张表（均带 `workspaceId` 隔离键）。前三张纯按 workspace 自隔离；`GlossaryTerm` 因支持 `platform` 归属，隔离是显式轴 `workspaceId = NULL`（NULL=平台全局）+ `workspaceId = self OR workspaceId IS NULL` 叠加读（见 §1.4），非纯 self-only 过滤：

| 表 | ws 隔离 | 用途 |
|---|---|---|
| `Dataset` | self-only | 核心数据资产条目（目录主体） |
| `Tag` | self-only | 标签定义（可复用的分类色签） |
| `DatasetTag` | self-only | `Dataset` <-> `Tag` 的 M:N 连接表 |
| `GlossaryTerm` | self + `workspaceId IS NULL` 叠加 | 业务术语表（词条 + 释义 + steward；`scope` 见 §1.4） |

### 1.2 v1 范围与边界

v1 只做资产的登记与元数据：展示名、技术 slug、主题域/团队 facet、刷新频率、资产类型、物理位置、体量估算、负责人、安全分级、标签、术语。边界：

- 外部系统连接（`DataSource`）属 integration 板块 -> `data-220`；`Dataset` 只通过 `dataSourceId` 弱引用它，不在本板块定义 `DataSource`。
- 质量规则/结果、血缘、标准、策略属 governance 板块 -> [`data-230`](arda-data-230-governance.md)；`Dataset` 是这些表的被引用端，其反向关系字段在本文件仅说明删除影响面（见 §3）。
- 数据服务（`DataService`）属 services 板块 -> `data-240`；`Dataset` 经 `DataServiceDataset` 与之 M:N 关联。
- 列级 `Field`（列级 schema）是 `future`，v1 不建表（见 §5.1）；v1 的资产分级停在 dataset 级（`classification`）。
- 派生值（质量总分、订阅数）有意不落 `Dataset` 表（见 §5.2）。

对应业务面板块：[`biz-210`](arda-biz-210-assets.md)（同一板块的业务能力视角）。

### 1.3 共享枚举 AssetLevel

`Dataset.classification` 引用定义在 schema 顶部的共享枚举 `AssetLevel`（该枚举亦被 governance/services 板块的 `level` 字段复用，非本板块独有，此处仅为解释 `classification` 取值而引）：

```prisma
enum AssetLevel {
  public
  internal
  sensitive
  core
}
```

取值按敏感度递增：`public` < `internal` < `sensitive` < `core`。`Dataset.classification` 默认 `internal`。

### 1.4 数据归属层 AssetScope 与属主/溯源轴 ownerApp

本板块新增两处多租户/共享语义（属主/可见性/升格/共享的完整模型见 [`data-150`](arda-data-150-multiagent-sharing.md)）：

**共享枚举 `AssetScope`（数据归属层）** - 定义在 schema 顶部（亦被 governance 板块的 `Standard.scope` 复用，非本板块独有，此处仅为解释 `GlossaryTerm.scope` 取值而引），本板块由 `GlossaryTerm.scope` 引用：

```prisma
enum AssetScope {
  workspace
  platform
}
```

- `workspace`：租户自有，隔离在本 workspace 内、仅对该 workspace 内的多个 agent 共享（默认值）。
- `platform`：arda 运营策展的全局参考数据（通过的数据标准、行政区划码表、币种码），对**所有** workspace 只读共享。平台行用显式轴 `workspaceId = NULL`（NULL=平台全局，`workspaceId` 是普通列非 FK，无需先有 `WorkspaceRef` 行；`scope=platform` 与之由 CHECK 一致）；租户读取经 `workspaceId = self OR workspaceId IS NULL` 叠加；写 `platform` 行需运营/平台角色，租户用户不可写。升格流为 workspace-draft -> ops-approve -> platform-published。

**属主/溯源轴 `Dataset.ownerApp`（非隔离）** - `String?`，标记 workspace 内**产出**该资产的 agent/app。agent 与 workspace 是 N-N（每个 agent 横跨多 workspace，每个 workspace 内可有多个 agent）；`ownerApp` 是归属 + 溯源标记，**不是**隔离轴（隔离仍由 `workspaceId` 兜底），作用是让同一 workspace 内的多个 agent 经 arda 共享数据时保留「谁产出的」为一等信息。它与消费方标记（`ApiKey.consumerApp`）、发布方标记（`DataService.ownerApp` / 可见性 `DataService.visibility`）同属一套属主轴，各字段的完整语义见 [`data-150`](arda-data-150-multiagent-sharing.md)。

---

## 2. 表定义

以下 prisma 代码块原样照抄 SoT（`portals/app/prisma/schema.prisma`），字段名/类型/默认/关系/索引一字不差。

### 2.1 Dataset - 核心数据资产

```prisma
model Dataset {
  id            String      @id @default(cuid())
  workspaceId   String
  dataSourceId  String?
  name          String
  // Technical slug shown in the catalog (e.g. dw_customer_master).
  code          String
  description   String?
  // Catalog facets: subject domain + owning team (free-form keys). Quality score
  // and subscriber count are deliberately NOT stored - they are derived later
  // (QualityResult aggregate / subscription join) and shown as "-" until then.
  domain        String?
  team          String?
  refreshFreq   String? // realtime | daily | weekly | monthly
  type          String // table | view | file | stream
  location      String?
  rowCountEst   BigInt?
  sizeBytes     BigInt?
  ownerUserId   String?
  // Producing agent/app within the workspace (attribution + provenance; NOT an
  // isolation axis - workspaceId is). Lets multiple agents in one workspace share
  // via arda while keeping "who produced this" first-class.
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

字段说明：

- `id` `String @id @default(cuid())`：cuid 主键。
- `workspaceId` `String`：隔离键（= 平台/IdP `active_workspace`），普通索引列、**无 FK**（workspace 生命周期归平台，业务行不依赖本地 `WorkspaceRef` 先存在，见 `data-110`）。
- `dataSourceId` `String?`：可选，指向 `DataSource.id`；可空表示该资产尚未登记来源系统。
- `name` `String`：必填，展示名。
- `code` `String`：必填，技术 slug（如 `dw_customer_master`），workspace 内唯一（见 §4）。
- `description` `String?`：可选描述。
- `domain` `String?`：可选，主题域 facet（自由键，产品定义），是 dashboard faceting 的分组维度。
- `team` `String?`：可选，归属团队 facet（自由键）。
- `refreshFreq` `String?`：可选，刷新频率；语义取值 `realtime | daily | weekly | monthly`（注释约定，DB 层为自由 `String`，非 enum）。
- `type` `String`：必填，资产类型；语义取值 `table | view | file | stream`（注释约定，DB 层为自由 `String`，非 enum）。
- `location` `String?`：可选，物理位置/路径。
- `rowCountEst` `BigInt?`：可选，行数估算（大整数）。
- `sizeBytes` `BigInt?`：可选，字节数（大整数）。
- `ownerUserId` `String?`：可选，负责人用户 id；身份归 IdP，此处只存 id 引用、无本地 FK。
- `ownerApp` `String?`：可选，标记 workspace 内**产出**该资产的 agent/app（属主 + 溯源标记）。这是归属/溯源轴，**不是**隔离轴（隔离仍由 `workspaceId` 兜底）；作用是让同一 workspace 内的多个 agent 经 arda 共享数据时保留「谁产出的」为一等信息（见 §1.4 与 [`data-150`](arda-data-150-multiagent-sharing.md)）。
- `classification` `AssetLevel @default(internal)`：安全分级，枚举 `AssetLevel`，默认 `internal`（取值见 §1.3）。
- `createdAt` `DateTime @default(now())` / `updatedAt` `DateTime @updatedAt`：创建/更新时间戳，`updatedAt` 由 Prisma 自动维护。
- 关系字段（`source` / `tags` / `qualityRules` / `qualityResults` / `lineageOut` / `lineageIn` / `services`）：见 §3。

> 注：`refreshFreq` / `type` 的取值集是注释级约定，数据库层是自由 `String`；若未来取值稳定，可升级为 enum（届时需迁移）。

### 2.2 Tag - 标签定义

```prisma
model Tag {
  id          String       @id @default(cuid())
  workspaceId String
  name        String
  color       String?
  datasets    DatasetTag[]

  @@unique([workspaceId, name])
  @@index([workspaceId])
}
```

字段说明：

- `id` `String @id @default(cuid())`：cuid 主键。
- `workspaceId` `String`：隔离键，普通索引列、无 FK。
- `name` `String`：必填，标签名，workspace 内唯一（见 §4）。
- `color` `String?`：可选，展示色（如色值/主题键）。
- `datasets` `DatasetTag[]`：反向关系，经连接表关联到多个 `Dataset`（见 §3）。

### 2.3 DatasetTag - M:N 连接表

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
```

字段说明：

- `datasetId` `String` / `tagId` `String`：连接两端外键，组成复合主键 `@@id([datasetId, tagId])`；本表无独立 `id` 列。
- `workspaceId` `String`：隔离键；在连接表上**冗余保存**，供按 workspace 强制过滤时免 join（见 §4 说明）。
- `dataset` / `tag`：分别指向 `Dataset` / `Tag`，`onDelete: Cascade`（见 §3）。

### 2.4 GlossaryTerm - 业务术语表

```prisma
model GlossaryTerm {
  id            String  @id @default(cuid())
  workspaceId   String
  term          String
  definition    String
  stewardUserId String?
  // platform = ops-approved global glossary shared to all workspaces
  // (workspaceId NULL); workspace = tenant-local term.
  scope         AssetScope @default(workspace)

  @@unique([workspaceId, term])
  @@index([workspaceId])
}
```

字段说明：

- `id` `String @id @default(cuid())`：cuid 主键。
- `workspaceId` `String`：隔离键，普通索引列、无 FK。
- `term` `String`：必填，术语词条，workspace 内唯一（见 §4）。
- `definition` `String`：必填，术语释义。
- `stewardUserId` `String?`：可选，术语 steward 用户 id（身份归 IdP，只存 id 引用、无本地 FK）。
- `scope` `AssetScope @default(workspace)`：数据归属层，枚举 `AssetScope`，默认 `workspace`（租户本地术语）。`platform` 表示 arda 运营策展、对所有 workspace 只读共享的全局术语表（平台行用显式轴 `workspaceId = NULL`）。取值与升格语义见 §1.4 与 [`data-150`](arda-data-150-multiagent-sharing.md)。
- 本表独立存在，无关系字段。

---

## 3. 关系与删除策略

本板块涉及的显式 relation 与 `onDelete` 语义：

| relation（定义端） | 方向 | onDelete | 语义 |
|---|---|---|---|
| `Dataset.source` | `Dataset.dataSourceId` -> `DataSource.id` | `SetNull` | 删除 `DataSource` 时，其关联 `Dataset` 的 `dataSourceId` 置 NULL，资产本身保留 |
| `DatasetTag.dataset` | `DatasetTag.datasetId` -> `Dataset.id` | `Cascade` | 删除 `Dataset` 时，连带删除其全部连接行 |
| `DatasetTag.tag` | `DatasetTag.tagId` -> `Tag.id` | `Cascade` | 删除 `Tag` 时，连带删除其全部连接行 |

反向关系（无独立 `onDelete`，级联行为定义在对端）：

- `Dataset.tags` <-> `DatasetTag`（本板块，Cascade，见上）。
- `Dataset.qualityRules` / `Dataset.qualityResults` / `Dataset.lineageOut` / `Dataset.lineageIn`：对端在 governance 板块（`QualityRule` / `QualityResult` / `LineageEdge`），其指向 `Dataset` 的关系均为 `onDelete: Cascade`。即删除一个 `Dataset` 会级联清除其质量规则/结果与上下游血缘边。详见 [`data-230`](arda-data-230-governance.md)。
- `Dataset.services`：对端 `DataServiceDataset`（services 板块）指向 `Dataset` 亦为 `Cascade`；删除 `Dataset` 连带清除服务关联行。详见 `data-240`。
- `Tag.datasets`：反向关系，级联由 `DatasetTag.tag` 承担。
- `GlossaryTerm`：无关系，删除不牵连任何表。

> 本处仅说明 `Dataset` 作为**被引用端**的删除影响面；governance/services 各对端表的完整定义在各自板块文档，本文件不重复其字段。

### 3.1 设计取舍：SetNull vs Cascade

- **`SetNull`（弱引用、被引用方是可选上下文）**：`Dataset -> DataSource`。来源登记是可选元数据，一个资产可以脱离来源系统独立存在（甚至先建目录条目、后补来源）。删除来源不应连带清除资产，只断开引用（`dataSourceId` 置 NULL）。这也要求 `dataSourceId` 必须可空（`String?`），与 `SetNull` 自洽。
- **`Cascade`（连接/从属行，脱离主体即无意义）**：`DatasetTag` 的两端。连接行没有独立语义，任一端点（`Dataset` 或 `Tag`）消失后该链接即为孤儿，级联删除连接行避免悬挂关联。governance/services 对 `Dataset` 的引用同理 - 规则/结果/血缘/服务关联都从属于具体 `Dataset`，主体删除即随之清理。

---

## 4. 唯一约束与索引

逐条列出本板块四表的 `@@id` / `@@unique` / `@@index` 及其理由。

**Dataset**

- `@@unique([workspaceId, code])`：`code`（技术 slug）仅在 workspace 内唯一（非全局唯一），支撑目录内 slug 不撞车 + 按 `(workspaceId, code)` 精确定位。
- `@@index([workspaceId])`：所有列表/强制过滤查询（`where: { workspaceId }`）的基础索引。
- `@@index([workspaceId, dataSourceId])`：按来源筛选资产（如来源详情页反查「这个数据源下有哪些数据集」）。
- `@@index([workspaceId, domain])`：按主题域分组/faceting（如 dashboard 的 `groupBy(["domain"])`）。
- `@@index([workspaceId, ownerApp])`：按属主 agent/app 反查资产（如「这个 agent 在本 workspace 产出了哪些数据集」），支撑 [`data-150`](arda-data-150-multiagent-sharing.md) 的属主/溯源视图。

**Tag**

- `@@unique([workspaceId, name])`：标签名 workspace 内唯一。
- `@@index([workspaceId])`：基础隔离索引。

**DatasetTag**

- `@@id([datasetId, tagId])`：自然复合主键，保证同一 `(dataset, tag)` 不重复关联；本表无独立 `id` 列。
- `@@index([workspaceId])`：供按 workspace 扫描/过滤连接表（`workspaceId` 冗余在连接表上，使 workspace 过滤免 join `Dataset`/`Tag`）。

> 说明：复合主键**不含** `workspaceId`。`(datasetId, tagId)` 本身即全局唯一自然键，而 `datasetId`/`tagId` 均在各自 workspace 内产生的 cuid，故不存在跨 workspace 误连的风险；`workspaceId` 列只为过滤性能而冗余，不参与唯一性。

**GlossaryTerm**

- `@@unique([workspaceId, term])`：术语词条 workspace 内唯一。
- `@@index([workspaceId])`：基础隔离索引。

> 通用范式（见 `data-120`）：每张业务表至少一条 `@@index([workspaceId])`；展示编码（`code`/`name`/`term`）的唯一性一律加 `workspaceId` 前缀（workspace 内唯一而非全局）；热点查询叠加复合索引（如 `Dataset` 的 `[workspaceId, dataSourceId]` / `[workspaceId, domain]`）。

---

## 5. future 与有意不落库

### 5.1 future（保留定义，不建表）

- **列级 `Field`**（列级 schema：每列的类型/可空/分级/位置）：是 `Dataset` 向列粒度的自然延伸，v1 明确标记 `future`，不提前建表（见领域实体目录与 `schema.prisma` 头部 scope 注释）。因此 v1 的资产分级只到 dataset 级（`Dataset.classification`），尚无列级分级；血缘也只到 dataset 级（`LineageEdge`，governance 板块）。

### 5.2 有意不落 Dataset 表的派生值

`schema.prisma` 中 `Dataset` 的注释明确：质量总分与订阅数**不落此表**，而是运行时派生：

- **质量总分**：派生自 `QualityResult` 聚合（governance 板块），不在 `Dataset` 冗余存储。
- **订阅数**：派生自订阅 join（订阅行在平台侧，arda 不建镜像表），不在 `Dataset` 冗余存储。

理由（对应 `data-100` §5 与设计目标「可推导优于可存储」）：派生值落库会引入刷新一致性与配置漂移问题；算不出/暂无数据来源时 UI 显示 `"-"`。质量口径与聚合规则见 [`biz-230`](arda-biz-230-governance.md)。

> 对比澄清：`rowCountEst` / `sizeBytes` 是**估算元数据**（由采集/登记一次性写入的静态估值），属可存储字段，故落库；它们与「实时派生的质量总分」性质不同，不在「有意不落库」之列。

---

## 变更规程

字段名/类型/默认/关系/索引一律以真源 `portals/app/prisma/schema.prisma` 为准；本文档仅为其可读导览，与之冲突时以 schema 文件为准。

1. 改 `portals/app/prisma/schema.prisma`（真源）。
2. `prisma migrate dev --name <desc>` 生成迁移，产物入 `portals/app/prisma/migrations/`（部署时的迁移执行方式见 [`data-300`](arda-data-300-migration.md)）。
3. 同步更新本文件对应的表定义 / 字段说明 / 索引条目。
4. 若新增/删除表或改变隔离方式，同步更新 [`data-100`](arda-data-100-architecture.md) §5 领域模型总览与 [`data-000`](arda-data-000-index.md) 系列看板。
5. 若涉及跨板块引用（来源/治理/服务对 `Dataset` 的关系），一并核对 [`data-230`](arda-data-230-governance.md) 与 `data-220` / `data-240`。
