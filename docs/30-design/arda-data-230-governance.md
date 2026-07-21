# arda 数据架构 · 数据治理 schema（arda-data-230-governance）

> 状态：权威设计（板块 schema，随 SoT 演进）
> 层：第 2 层 · 板块 schema（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（governance 段）；本文件只是其可读导览，字段/类型/索引以 SoT 为准
> 上游：总体设计见 [`data-100`](arda-data-100-architecture.md)；横切约束见 `data-110`（隔离）/ `data-120`（索引）/ `data-140`（审计）/ [`data-150`](arda-data-150-multiagent-sharing.md)（多智能体共享与数据归属层）；业务面见 [`biz-230`](arda-biz-230-governance.md)；迁移与现状见 [`data-300`](arda-data-300-migration.md)

---

## 1. 板块概述

治理板块把「已编目的数据资产」升级为「可信的数据资产」：给资产挂上**策略、质量规则与结果、数据标准、数据集级血缘**。它是持久面对 [`biz-230`](arda-biz-230-governance.md)（业务面「治理即信任」）的落点，与 `assets`（[`data-210`](arda-data-210-assets.md)）板块的 `Dataset` 强关联。

**本板块承载的表（v1）**：

| 表 | 用途 | 关键约束 |
|---|---|---|
| `Policy` | 治理策略（访问 / 脱敏 / 留存 / 分级） | 无 dataset FK，靠 `scope` + `config` 表达作用域 |
| `QualityRule` | 稽核规则（挂在单个 `Dataset` 上） | `@@unique([workspaceId, code])`，`onDelete: Cascade` |
| `QualityResult` | 一次质量检查的执行结果 | 双 FK（rule + dataset），均 `Cascade` |
| `Standard` | 数据标准（代码集 / 数据元） | `@@unique([workspaceId, code])`，独立表无 dataset FK |
| `LineageEdge` | 数据集级血缘边（有向） | `@@unique([upstreamDatasetId, downstreamDatasetId])`，双 FK `Cascade` |

**v1 范围与边界**：

- **只做数据集级治理**。质量、血缘、标准都以 `Dataset` 为最小治理单元，不下探到列。
- **列级 `Field` 是 `future`，不建表**（列级 schema：类型 / 可空 / 分级 / 位置），见 §5。
- **血缘只建数据集之间的有向边**（`LineageEdge`），不建作业 / 任务实体；`jobId` 只是可选的外部作业标识（字符串），不是本地 FK。
- **平台 / IdP 拥有的概念不落库**（Org、workspace 生命周期、订阅、成员、计费）；每个业务实体只带 `workspaceId` 隔离键。
- **枚举**：`QualityResult.status` 使用 `QualityStatus`，`Standard.scope` 使用 `AssetScope`（数据归属层 `workspace | platform`，与 `GlossaryTerm.scope` 同枚举，见 [`data-150`](arda-data-150-multiagent-sharing.md)）；其余带受控取值的字段（如 `Policy.type` / `Policy.scope`、`Standard.type` / `Standard.status`）是自由文本 `String`（配 `@default` 与注释枚举，见 §2）。

对应业务板块：[`biz-230`](arda-biz-230-governance.md)（十位对齐，见 [`data-000`](arda-data-000-index.md) §3）。

---

## 2. 表定义

以下 prisma 代码块原样照抄 SoT（`portals/app/prisma/schema.prisma` 的 governance 段），字段名 / 类型 / 默认 / 关系 / 索引一字不差。

### 2.0 枚举 QualityStatus 与 AssetScope

两个枚举都定义在 SoT 文件头部的 enum 段（非 governance 段），但为本板块所用，先列出。

`QualityResult.status` 依赖 `QualityStatus`：

```prisma
/// Outcome of a single quality check run.
enum QualityStatus {
  pass
  warn
  fail
}
```

- 单次质量检查的判定结果，取值 `pass | warn | fail`。
- 仅 `QualityResult.status` 引用；`QualityRule.severity` 是另一维度（自由文本，见下）。

`Standard.scope` 依赖 `AssetScope`（数据归属层，与 `GlossaryTerm.scope` 同枚举，见 [`data-150`](arda-data-150-multiagent-sharing.md)）：

```prisma
/// Data ownership scope. `workspace` = tenant-owned, isolated to and shared only
/// within its workspace (across the agents present in that workspace). `platform`
/// = arda-ops-curated global reference data (approved standards, admin-division
/// code tables, currency codes), read-only to ALL workspaces. Platform rows carry
/// workspaceId = NULL (NULL = platform-global) together with scope = platform
/// (workspaceId is a plain column, not a FK, so no WorkspaceRef row is required;
/// the two are tied by a CHECK); a tenant read overlays them via
/// workspaceId = self OR workspaceId IS NULL. Writing a `platform` row requires the
/// ops/platform role, never a tenant user. See docs/30-design/arda-data-150-multiagent-sharing.md.
enum AssetScope {
  workspace
  platform
}
```

- 数据归属层，取值 `workspace | platform`。
- 仅 `Standard.scope`（本板块）引用；语义与索引读路径详见 §2.4 与 [`data-150`](arda-data-150-multiagent-sharing.md)。

### 2.1 Policy

```prisma
model Policy {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  type        String // access | masking | retention | classification
  scope       String // dataset | tag | source
  config      Json?
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@index([workspaceId])
}
```

字段说明：

- `id`：主键，`cuid()` 生成。
- `workspaceId`：隔离键（普通索引列，非 FK），等于平台 `active_workspace`。
- `name`：策略显示名，必填。
- `type`：策略类型，自由文本 `String`；语义取值 `access | masking | retention | classification`（访问 / 脱敏 / 留存 / 分级）。**留存类**（`type=retention`）承载数据生命周期规则，见 [`biz-230`](arda-biz-230-governance.md)。
- `scope`：作用域类型，自由文本 `String`；语义取值 `dataset | tag | source`。具体作用对象靠 `config` 表达，而非硬 FK -> 让一条策略可以覆盖「一组资产 / 一类标签 / 一个数据源」。
- `config`：可选 `Json`，承载策略参数（如脱敏字段、访问角色、留存天数等）。
- `enabled`：是否启用，默认 `true`。
- `createdAt`：创建时间，默认 `now()`；本表无 `updatedAt`。

> `Policy` 有意不建 `datasetId` FK：作用域是多形态的（dataset / tag / source），用 `scope` + `config` 表达比多张关联表更贴合「一条规则覆盖一批对象」的治理语义。

### 2.2 QualityRule

```prisma
model QualityRule {
  id          String   @id @default(cuid())
  workspaceId String
  datasetId   String
  code        String // display id, e.g. Q-201
  name        String
  dimension   String // quality dimension key: completeness | accuracy | ...
  type        String // not_null | unique | range | freshness | ...
  config      Json?
  severity    String   @default("warning")
  enabled     Boolean  @default(true)

  dataset Dataset         @relation(fields: [datasetId], references: [id], onDelete: Cascade)
  results QualityResult[]

  @@unique([workspaceId, code])
  @@index([workspaceId])
  @@index([datasetId])
}
```

字段说明：

- `id`：主键，`cuid()`。
- `workspaceId`：隔离键（普通索引列）。
- `datasetId`：所属数据集，**必填**（非可选）；关联 `Dataset`，`onDelete: Cascade`。规则永远挂在一个具体数据集上。
- `code`：展示 id（如 `Q-201`），workspace 内唯一（见 §4）。
- `name`：规则显示名，必填。
- `dimension`：质量维度键，自由文本；语义取值 `completeness | accuracy | ...`（完整性 / 准确性 / ...）。
- `type`：规则类型，自由文本；语义取值 `not_null | unique | range | freshness | ...`。
- `config`：可选 `Json`，规则参数（阈值、列名、区间等）。
- `severity`：严重级别，默认 `"warning"`（自由文本，非枚举）。区别于运行结果的 `QualityStatus`：`severity` 是规则本身的告警等级配置，`status` 是某次运行的判定。
- `enabled`：是否启用，默认 `true`。

关系：

- `dataset`：多对一 -> `Dataset`（`fields: [datasetId]`，`onDelete: Cascade`）。
- `results`：一对多 -> `QualityResult[]`（反向侧，规则的历次执行结果）。

### 2.3 QualityResult

```prisma
model QualityResult {
  id          String        @id @default(cuid())
  workspaceId String
  ruleId      String
  datasetId   String
  runAt       DateTime      @default(now())
  status      QualityStatus
  score       Float? // pass rate %
  issues      Int           @default(0)
  details     Json?

  rule    QualityRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  dataset Dataset     @relation(fields: [datasetId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([ruleId])
  @@index([datasetId])
}
```

字段说明：

- `id`：主键，`cuid()`。
- `workspaceId`：隔离键（普通索引列）。
- `ruleId`：产生该结果的规则，**必填**；关联 `QualityRule`，`onDelete: Cascade`。
- `datasetId`：被检查的数据集，**必填**；关联 `Dataset`，`onDelete: Cascade`。这里冗余存 `datasetId`（本可经 `rule.datasetId` 推出）是为了直接按数据集查结果时避免 join，见 §4。
- `runAt`：运行时间，默认 `now()`。
- `status`：结果判定，`QualityStatus` 枚举（`pass | warn | fail`），**必填无默认**。
- `score`：可选 `Float`，通过率百分比（`pass rate %`）。
- `issues`：问题条数，默认 `0`。
- `details`：可选 `Json`，明细（失败样本 / 分列统计等）。

关系：

- `rule`：多对一 -> `QualityRule`（`fields: [ruleId]`，`onDelete: Cascade`）。
- `dataset`：多对一 -> `Dataset`（`fields: [datasetId]`，`onDelete: Cascade`）。

### 2.4 Standard

```prisma
/// Data standard: a code set or data element reference (metadata governance).
model Standard {
  id          String   @id @default(cuid())
  workspaceId String
  code        String // e.g. STD-001
  name        String
  type        String // code-set | data-element
  ref         String // reference spec (e.g. ISO 3166-1)
  items       Int      @default(0)
  usage       Int      @default(0)
  status      String   @default("draft") // published | draft | review
  // platform = ops-approved global reference (e.g. code sets like admin-division
  // codes), read-only to all workspaces (workspaceId NULL); workspace
  // = tenant-local draft. Promotion workspace->platform is an ops action.
  scope       AssetScope @default(workspace)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([workspaceId, code])
  @@index([workspaceId])
}
```

字段说明：

- `id`：主键，`cuid()`。
- `workspaceId`：隔离键（普通索引列）。
- `code`：标准编码（如 `STD-001`），workspace 内唯一（见 §4）。
- `name`：标准显示名，必填。
- `type`：标准类型，自由文本；语义取值 `code-set | data-element`（代码集 / 数据元）。
- `ref`：参照规范，必填 `String`（如 `ISO 3166-1`）。
- `items`：条目数，默认 `0`。
- `usage`：被引用次数，默认 `0`。
- `status`：发布状态，默认 `"draft"`（自由文本）；语义取值 `published | draft | review`。
- `scope`：数据归属层，`AssetScope` 枚举，默认 `workspace`。取值：
  - `workspace`（默认）= 租户本地草稿：由某个 workspace 产出、隔离在该 workspace 内（叠加 `workspaceId` force-filter），只对本 workspace 可见。
  - `platform` = 运营（arda-ops）通过的全局参考数据：如代码集 / 行政区划码表 / 币种码等**单一权威**的参照物，全平台**只读共享**。平台行用显式轴 `workspaceId=NULL`（NULL=平台全局，`workspaceId` 是普通列非 FK，无需 `WorkspaceRef` 行；`scope=platform` 与之由 CHECK 一致），租户读经 `workspaceId = self OR workspaceId IS NULL` 叠加取得；写平台行只允许 ops / 平台角色，**永不**由租户用户写。
  - **升格流**：一条标准从租户草稿升为全局参考走 `workspace-draft -> ops-approve -> platform-published`（租户起草 -> 运营审核 -> 平台发布）；进入 `platform` 层只经此运营升格路径（跨 workspace 授权访问是另一条点对点机制，见 [`data-160`](arda-data-160-cross-workspace-authorization.md)，不使数据进入平台层）。详见 [`data-150`](arda-data-150-multiagent-sharing.md)。
- `createdAt`：创建时间，默认 `now()`。
- `updatedAt`：更新时间，`@updatedAt` 自动维护。

> `Standard` 是独立元数据表，**无 dataset FK**：数据标准（代码集 / 数据元）是可被多处引用的参照物，与主数据同属治理域（见 [`biz-230`](arda-biz-230-governance.md) 关于参考数据与主数据的归属）。
>
> `scope` 是**数据归属轴**（`AssetScope`，与 `GlossaryTerm.scope` 同枚举），不是隔离轴，隔离仍由 `workspaceId` force-filter 兜底。`platform` 承载 arda 运营策展的全局只读参考（运营改一次全平台生效），`workspace` 承载租户草稿；两者靠显式轴 `workspaceId=NULL`（NULL=平台全局）+ `workspaceId = self OR workspaceId IS NULL` 叠加读区分。三层归属与共享模型（arda 作 broker、内容字节从不在 arda 静置、跨 workspace 不流动）详见 [`data-150`](arda-data-150-multiagent-sharing.md)。

### 2.5 LineageEdge

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

字段说明：

- `id`：主键，`cuid()`。
- `workspaceId`：隔离键（普通索引列）。
- `upstreamDatasetId`：上游数据集 id，**必填**；关联 `Dataset`，命名关系 `LineageUpstream`，`onDelete: Cascade`。
- `downstreamDatasetId`：下游数据集 id，**必填**；关联 `Dataset`，命名关系 `LineageDownstream`，`onDelete: Cascade`。
- `transform`：可选 `String`，边上的变换描述（如 SQL / 变换说明）。
- `jobId`：可选 `String`，外部作业标识；**不是本地 FK**（v1 不建 `Pipeline` / `JobRun`，见 [`data-220`](arda-data-220-integration.md) 与 §5）。

关系（一条边 = 一个有向 `upstream -> downstream`）：

- `upstream`：多对一 -> `Dataset`（命名关系 `LineageUpstream`，`fields: [upstreamDatasetId]`，`onDelete: Cascade`）。
- `downstream`：多对一 -> `Dataset`（命名关系 `LineageDownstream`，`fields: [downstreamDatasetId]`，`onDelete: Cascade`）。

因为一个 `Dataset` 同时可作为多条边的上游或下游，需要**两个命名关系**来消歧（Prisma 要求同一对 model 间的多重关系显式命名）。在 `Dataset` 侧（`assets` 板块，SoT 定义）对应两个反向集合：

```prisma
lineageOut LineageEdge[] @relation("LineageUpstream")
lineageIn  LineageEdge[] @relation("LineageDownstream")
```

- `Dataset.lineageOut`（关系名 `LineageUpstream`）= 本数据集**作为上游**的边（流向下游消费者）。
- `Dataset.lineageIn`（关系名 `LineageDownstream`）= 本数据集**作为下游**的边（来自上游来源）。

---

## 3. 关系与删除策略

本板块所有 relation 均指向 `Dataset` 或本板块内的 `QualityRule`，删除策略只有 `Cascade` 一种（无 `SetNull`），设计理由如下。

| 关系 | 方向 | onDelete | 理由 |
|---|---|---|---|
| `QualityRule.dataset -> Dataset` | 规则 -> 数据集（N:1） | `Cascade` | 规则依附于具体数据集，数据集删除后规则失去意义，随删。 |
| `QualityRule.results -> QualityResult` | 规则 -> 结果（1:N，反向） | 由 `QualityResult.rule` 侧 `Cascade` 承载 | 规则删除，其历史结果一并清除。 |
| `QualityResult.rule -> QualityRule` | 结果 -> 规则（N:1） | `Cascade` | 结果是规则的一次执行快照，规则不存则结果无所依。 |
| `QualityResult.dataset -> Dataset` | 结果 -> 数据集（N:1） | `Cascade` | 数据集删除，其质量历史随删。 |
| `LineageEdge.upstream -> Dataset` | 边 -> 上游数据集（N:1，`LineageUpstream`） | `Cascade` | 端点数据集删除后，血缘边不再有意义，随删。 |
| `LineageEdge.downstream -> Dataset` | 边 -> 下游数据集（N:1，`LineageDownstream`） | `Cascade` | 同上，任一端点删除即删边。 |

设计理由（Cascade vs SetNull）：

- **本板块一律 `Cascade`**：`QualityRule` / `QualityResult` / `LineageEdge` 都是**依附实体**，脱离其 `Dataset`（或规则）后没有独立存在的价值，因此端点删除即随删，避免悬挂的孤儿治理记录。
- **对比 `SetNull` 的用法**：在 SoT 其它板块，`Dataset.source -> DataSource`、`ApiKey.service -> DataService` 用 `SetNull`，因为**主记录可以在关联被删后独立存活**（数据集仍是有效资产、密钥仍可作废）。治理板块没有这种「关联可空、主体独立」的实体，故全用 `Cascade`。
- **`Policy` 无 relation**：作用域靠 `scope` + `config` 表达（软引用），因此没有级联删除；策略的生命周期独立于任何数据集。
- **`Standard` 无 relation**：数据标准是独立参照物，删除数据集不影响标准；标准的引用计数 `usage` 是应用层维护的计数，不是 FK。

---

## 4. 唯一约束与索引

逐条列出本板块的 `@@id` / `@@unique` / `@@index` 及建立理由。

### 4.1 Policy

- `@@index([workspaceId])`：隔离键索引，所有查询按 workspace 收口的最低要求。
- 主键：`id @id @default(cuid())`。无 workspace 内 code 唯一（策略无 `code` 字段）。

### 4.2 QualityRule

- `@@unique([workspaceId, code])`：`code`（如 `Q-201`）在 workspace 内唯一，展示 id 不能重复，同时提供按 code 精确查规则的唯一索引。
- `@@index([workspaceId])`：隔离键索引。
- `@@index([datasetId])`：按数据集拉取其全部规则（详情页「该数据集的质量规则」）的热点路径。
- 主键：`id @id @default(cuid())`。

### 4.3 QualityResult

- `@@index([workspaceId])`：隔离键索引。
- `@@index([ruleId])`：按规则查历次结果（规则趋势 / 最近一次结果）。
- `@@index([datasetId])`：按数据集查全部质量结果，**这就是冗余存 `datasetId` 的收益**：避免每次都经 `QualityRule` join 才能按数据集聚合质量。
- 主键：`id @id @default(cuid())`。无唯一约束，同一规则可对同一数据集多次运行，结果天然多行。

### 4.4 Standard

- `@@unique([workspaceId, code])`：`code`（如 `STD-001`）在 workspace 内唯一。
- `@@index([workspaceId])`：隔离键索引。
- 主键：`id @id @default(cuid())`。

### 4.5 LineageEdge

- `@@unique([upstreamDatasetId, downstreamDatasetId])`：**一对上下游数据集之间至多一条边**，同一 `upstream -> downstream` 不重复建边（去重血缘图）。注意此唯一键**不含 `workspaceId`**：`upstreamDatasetId` / `downstreamDatasetId` 都是 `Dataset` 主键（`cuid`，全局唯一），两个端点已隐含同一 workspace，无需再把隔离键并入唯一键。
- `@@index([workspaceId])`：隔离键索引，按 workspace 拉整张血缘图。
- 主键：`id @id @default(cuid())`。

> 索引通用约定见 [`data-120`](arda-data-120-indexing.md)：每个业务实体至少 `@@index([workspaceId])`，热点查询叠加复合 / 二级索引；workspace 内业务唯一用 `@@unique([workspaceId, <key>])` 而非全局唯一。

---

## 5. future 与有意不落库

### 5.1 保留定义、不建表（future）

- **列级 `Field`**（列级 schema：类型 / 可空 / 分级 / 位置）：v1 治理停在**数据集级**。列级血缘、列级质量、列级分级都推迟到 `Field` 落库之后，届时 `QualityRule` / `LineageEdge` 可下探到列。当前保留定义、不建表（与 SoT 文件头注释「column-level Field are `future` and are NOT modeled here」一致）。
- **`Pipeline` / `JobRun`**（集成板块的数据搬运与执行记录）：属 `integration`（[`data-220`](arda-data-220-integration.md)）的 future，但与治理相关的是，`LineageEdge.jobId` 目前只是一个**可选的外部作业标识字符串**，等 `JobRun` 落库后可升级为真实 FK。在此之前 `jobId` 不建关系、不建索引。

### 5.2 派生值不落库

治理板块坚持「可推导优于可存储」（见 [`data-100`](arda-data-100-architecture.md) §1）：

- **`Dataset` 的质量总分**：不落 `Dataset` 表，而是从 `QualityResult` 聚合派生（最近一次 / 加权），算不出时 UI 显示 `-`。落库会造成规则改动后的刷新一致性问题（配置漂移）。
- **`Standard.items` / `Standard.usage`**：是**计数缓存字段**（`Int @default(0)`），由应用层写入维护，不是从关联表实时聚合的 FK 派生，注意区分：它们**在表内**，但语义上是「被引用次数 / 条目数」的物化计数，不建关联表来实时算。
- **血缘图的传递闭包 / 影响分析**：不物化落库，按需从 `LineageEdge` 的有向边实时遍历（`lineageOut` / `lineageIn`）。
- **质量趋势 / 告警时序**：客户端展示聚合，v1 未建 telemetry / timeseries 表。

---

## 变更规程

本文件是 `portals/app/prisma/schema.prisma`（governance 段）的**可读导览**，不是真源。

- **真源**：任何字段 / 类型 / 默认 / 关系 / 索引 / 枚举的权威定义只在 `portals/app/prisma/schema.prisma`。本文与 SoT 冲突时，以 SoT 为准。
- **改动顺序**：先改 `schema.prisma` -> 生成 / 提交对应 `portals/app/prisma/migrations/` 迁移（见 [`data-300`](arda-data-300-migration.md) §1）-> 再回来同步本文的 prisma 代码块与字段说明（逐字核对）。
- **不得在本文虚构**：本文所有 prisma 代码块均为 SoT 原样照抄；新增 model / 字段 / 索引先落 SoT 再录本文。
- **跨文档一致性**：本板块与业务面 [`biz-230`](arda-biz-230-governance.md) 十位对齐；总体全景见 [`data-100`](arda-data-100-architecture.md) §5；索引约定见 [`data-120`](arda-data-120-indexing.md)。
