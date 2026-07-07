# arda 数据架构 · 数据服务 schema（arda-data-240-services）

> 状态：权威设计（较稳定演进）· 第 2 层 · 板块 `services`
> 层：第 2 层 · 板块 schema（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（`// --------------------------------------------------------------- services ----` 段）；本文件只是其可读导览，字段/类型/默认/关系/索引以 schema 为准，二者冲突以 schema 为准。
> 上游：总体设计见 [`data-100`](arda-data-100-architecture.md)；横切约束见 `data-110`（workspace 隔离）/ `data-120`（索引与性能）/ `data-130`（加密与密钥）；迁移执行见 [`data-300`](arda-data-300-migration.md)；对应业务面板块见 [`biz-240`](arda-biz-240-services.md)。

---

## 1. 板块概述

### 1.1 本板块承载什么

`services` 板块把已被治理、已可信的数据资产**封装为对外可消费的数据服务**（REST API / 查询 / 导出 / 共享），是数据价值链最右端，也是 arda **对外（含被智能体消费）的主契约**。它回答的问题是：某个 `Dataset` 以什么 `path` / `method` 暴露、属于哪个 `domain`、安全分级如何、当前是否在线（`status`），以及这个服务背后**由哪些 Dataset 支撑**。

在持久层，本板块只落两张表：

- `DataService`：一个数据服务的登记与元数据主体（display 编码、路径、方法、分级、状态等）。
- `DataServiceDataset`：`DataService` 与 `Dataset` 之间的显式 M:N 连接表（一个服务可支撑于多个数据集，一个数据集可被多个服务复用）。

### 1.2 v1 范围与边界

- **v1 只做登记与元数据**：`DataService` 描述"有这样一个服务、指向哪些资产、什么状态"，不在本层承载实际的请求转发 / 网关执行 / 限流计量。运行态调用量、告警、时序 telemetry **不落库**（见 §5）。
- **配置以 `config Json?` 兜底**：方法 / 路径 / 分级 / 类型是结构化列，其余服务特定参数（如查询模板、导出格式、共享目标）放入 `config`，保持 schema 稳定、避免为每类服务加列。
- **对外契约边界**：本文件描述**持久层结构**；对外 API 的语义契约（请求/响应、鉴权流程、智能体支持）不在此，见 `biz-240` 与对外契约文档。

### 1.3 含哪些表 / 对应哪个 biz 板块

| 表 | 角色 | ws 隔离 | 主键 |
|---|---|---|---|
| `DataService` | 数据服务主体 | 是（`workspaceId` 列） | `id`（cuid） |
| `DataServiceDataset` | `DataService` <-> `Dataset` M:N 连接表 | 是（`workspaceId` 列） | 复合 `@@id([dataServiceId, datasetId])` |

板块编号十位与业务面对齐（`data-000` §3）：`services` 段对应 [`biz-240`](arda-biz-240-services.md)（业务能力 vs 持久结构，同一板块两个面）。

> 归属澄清：`ApiKey`（服务密钥）在 schema 中通过 `dataServiceId` 关联到 `DataService`，且 `DataService.apiKeys` 是其反向关系字段；但 `ApiKey` 模型本身归 **admin** 板块，其表定义/字段/索引见 [`data-250`](arda-data-250-admin.md)，不在本篇展开。本篇只照抄 `DataService` 上的反向关系字段。

---

## 2. 表定义

以下 prisma 代码块**逐字照抄** SoT（`portals/app/prisma/schema.prisma`），字段名 / 类型 / 默认值 / 关系 / 约束一字不差。行内 `//` 注释亦为 SoT 原文。

### 2.1 `DataService`

```prisma
model DataService {
  id          String     @id @default(cuid())
  workspaceId String
  code        String // display id, e.g. API-1042
  name        String
  path        String // e.g. /api/v2/customer/verify
  method      String     @default("GET") // GET | POST
  description String?
  domain      String?
  level       AssetLevel @default(internal)
  type        String // rest_api | query | export | share
  config      Json?
  status      String     @default("draft") // draft | running | review | paused
  ownerApp    String?    // publishing agent/app within the workspace
  visibility  String     @default("workspace") // workspace = shared to all agents in the workspace; owner = private to the owner app
  publishedAt DateTime?
  createdAt   DateTime   @default(now())

  datasets DataServiceDataset[]
  apiKeys  ApiKey[]

  @@unique([workspaceId, code])
  @@index([workspaceId])
}
```

字段说明要点：

| 字段 | 类型 | 可选性 | 默认 | 语义 / 取值 |
|---|---|---|---|---|
| `id` | `String` | 必填（主键） | `cuid()` | 系统主键，非人读；对外 display 用 `code`。 |
| `workspaceId` | `String` | 必填 | 无 | 隔离键，等于平台 `active_workspace`；**普通索引列，非外键**（见 `data-110`）。 |
| `code` | `String` | 必填 | 无 | display 编码，如 `API-1042`；workspace 内唯一（见 §4）。 |
| `name` | `String` | 必填 | 无 | 人读服务名。 |
| `path` | `String` | 必填 | 无 | 对外暴露路径，如 `/api/v2/customer/verify`。 |
| `method` | `String` | 必填 | `"GET"` | HTTP 方法；注释枚举取值 `GET | POST`（存 String，非 DB 枚举）。 |
| `description` | `String?` | 可选 | 无 | 服务描述。 |
| `domain` | `String?` | 可选 | 无 | 主题域 facet（自由文本键），用于目录分组/筛选。 |
| `level` | `AssetLevel` | 必填 | `internal` | 安全分级，DB 枚举 `AssetLevel { public | internal | sensitive | core }`。 |
| `type` | `String` | 必填 | 无 | 服务类型；注释枚举取值 `rest_api | query | export | share`（存 String）。 |
| `config` | `Json?` | 可选 | 无 | 服务特定参数兜底（查询模板 / 导出格式 / 共享目标等）。 |
| `status` | `String` | 必填 | `"draft"` | 生命周期状态；取值 `draft | running | review | paused`，默认 `draft`。 |
| `ownerApp` | `String?` | 可选 | 无 | 发布方 agent 标记：workspace 内发布/持有该服务的 agent/app 身份，用于归属与溯源（非隔离键，隔离仍由 `workspaceId` 兜底）。跨 workspace 永不流动，参见 [`data-150`](arda-data-150-multiagent-sharing.md)。 |
| `visibility` | `String` | 必填 | `"workspace"` | 可见性；取值 `workspace`（对 workspace 内所有 agent 共享）| `owner`（仅属主 `ownerApp` 私有），默认 `workspace`（存 String，非 DB 枚举）。多 agent 共享模型见 [`data-150`](arda-data-150-multiagent-sharing.md)。 |
| `publishedAt` | `DateTime?` | 可选 | 无 | 发布时间；未发布为空。 |
| `createdAt` | `DateTime` | 必填 | `now()` | 创建时间。 |

关系字段（非物理列，Prisma 关系视图）：

- `datasets DataServiceDataset[]`：到连接表的一对多，经连接表展开为对 `Dataset` 的 M:N。
- `apiKeys ApiKey[]`：`ApiKey` 侧的反向关系（`ApiKey` 定义在 admin 板块，见 [`data-250`](arda-data-250-admin.md)）。

### 2.2 `DataServiceDataset`

```prisma
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

字段说明要点：

| 字段 | 类型 | 可选性 | 默认 | 语义 |
|---|---|---|---|---|
| `dataServiceId` | `String` | 必填（复合主键之一 + FK） | 无 | 指向 `DataService.id`。 |
| `datasetId` | `String` | 必填（复合主键之一 + FK） | 无 | 指向 `Dataset.id`。 |
| `workspaceId` | `String` | 必填 | 无 | 隔离键冗余列，令连接表可独立按 workspace 过滤/索引，无需 join 回父表。 |

- 无独立 `id` 列：主键即 `(dataServiceId, datasetId)` 复合主键（见 §4）。
- `service` / `dataset` 为关系字段，物理列是上面的两个外键列。

### 2.3 注记：`status` 取值集合

`DataService.status` 取值集合为 `draft | running | review | paused`，默认 `draft`。（历史上 SoT 行内注释曾漏列 `draft`，已于 2026-07-03 修正为 `// draft | running | review | paused`，与默认值一致；本篇 §2.1 已同步。）

---

## 3. 关系与删除策略

### 3.1 关系拓扑

```
DataService 1 ---- * DataServiceDataset * ---- 1 Dataset      (M:N, explicit join table)
DataService 1 ---- * ApiKey                                   (reverse field only; ApiKey belongs to data-250)
```

- `DataService` 与 `Dataset` 之间**没有直接外键**，一律经 `DataServiceDataset` 连接表：一个服务可绑定多个数据集，一个数据集可被多个服务复用。
- 连接表两侧的关系方向：`DataServiceDataset.service -> DataService.id`、`DataServiceDataset.dataset -> Dataset.id`（`Dataset` 侧的反向字段为 `Dataset.services DataServiceDataset[]`，定义在 assets 板块 [`data-210`](arda-data-210-assets.md)）。

### 3.2 onDelete 语义与设计理由

| 关系 | onDelete | 理由 |
|---|---|---|
| `DataServiceDataset.service -> DataService` | `Cascade` | 服务被删时，其"服务-数据集"绑定是纯从属关系，无独立意义，随父级级联删除，避免悬挂连接行。 |
| `DataServiceDataset.dataset -> Dataset` | `Cascade` | 数据集被删时，指向它的绑定行同样无意义（服务已失去这条支撑资产），级联清除。 |

- 连接表两侧都用 `Cascade`：连接行是**纯关联事实**，不携带需要保留的独立状态，任一端父行消失后该关联即失效，级联删除是正确语义（对照：`ApiKey.service -> DataService` 用 `SetNull`，因为密钥是**独立生命周期**实体，服务删掉后密钥记录仍需保留/审计，故置空而非级联 -- 该关系归 [`data-250`](arda-data-250-admin.md)）。
- 判据小结：**从属关联行用 `Cascade`，独立实体的外键用 `SetNull`**。本板块唯二外键均属前者。

---

## 4. 唯一约束与索引

逐条列出本板块的 `@@id` / `@@unique` / `@@index` 及其建立理由。

### 4.1 `DataService`

| 约束 | 定义 | 理由 |
|---|---|---|
| 主键 | `id @id @default(cuid())` | 系统单列主键，稳定、不依赖业务字段。 |
| 唯一 | `@@unique([workspaceId, code])` | display 编码 `code` 在 **workspace 内唯一**（非全局），与全 schema 的"业务唯一性一律 workspace 内唯一"约束一致（`data-100` §4）；同时作为 upsert / 幂等定位键。 |
| 索引 | `@@index([workspaceId])` | 强制 workspace 过滤的基础索引；所有列表/查询按 `where: { workspaceId }` 收口。 |

### 4.2 `DataServiceDataset`

| 约束 | 定义 | 理由 |
|---|---|---|
| 复合主键 | `@@id([dataServiceId, datasetId])` | 连接表无代理主键；`(service, dataset)` 对天然唯一，复合主键既定义唯一性又提供以 `dataServiceId` 前缀的高效"某服务的全部数据集"查询。 |
| 索引 | `@@index([workspaceId])` | 令连接表可独立按 workspace 过滤/裁剪，无需 join 回父表；与全 schema"每实体至少 `@@index([workspaceId])`"约定一致。 |

> 反向查询提示：复合主键前缀是 `dataServiceId`，故"按服务列数据集"走主键索引；若需高频"按数据集列服务"（以 `datasetId` 为前导），当前无对应复合索引，依赖 `datasetId` 的独立可过滤性 -- v1 未新增该索引（见 §5 演进）。

---

## 5. future 与有意不落库

### 5.1 有意不落库的派生 / 运行态数据

本板块只存服务的**登记与静态元数据**，以下一律不建列、不建表（与 `data-100` §5"可推导优于可存储"一致）：

- **调用量 / QPS / 延迟 / 错误率**：服务运行态 telemetry，v1 未建模时序表，由客户端聚合展示或后续接入独立观测栈，不落业务库。
- **告警 / 健康状态**：派生自上述运行指标，不冗余存储。
- **订阅方 / 消费者计数**：如需展示由关联查询求值，不在 `DataService` 上落计数列（对照 `Dataset` 的订阅数亦为派生，`data-100` §5）。
- `publishedAt` 之外的生命周期时间线（暂停时间 / 复审时间等）：v1 不落，必要时经 `AuditLog`（admin，[`data-250`](arda-data-250-admin.md)）追溯。

### 5.2 有意不建表 / 保留定义的实体

- **服务网关执行态**（限流桶、配额计数、路由缓存）：不属持久业务数据，属运行时/缓存层，v1 不建表；Redis 只做会话/令牌，不做此类数据缓存（`data-100` §2）。
- **`ApiKey`（服务密钥）**：模型存在，但归 admin 板块，见 [`data-250`](arda-data-250-admin.md)；本篇仅保留 `DataService.apiKeys` 反向关系字段。

### 5.3 已知可演进点

- **`method` / `type` / `status` / `visibility` 的 DB 枚举化**：当前存 `String` + 行内注释约束（`method`、`type`、`status`、`visibility`），未提升为 Postgres 枚举；若取值集合稳定且需 DB 侧强约束，可后续引入枚举（对照 `level` 已用 `AssetLevel` 枚举）。
- **`(datasetId, ...)` 前导的连接表索引**：如"按数据集反查服务"成为热点，可加复合索引；v1 未加（见 §4.2 提示）。

---

## 变更规程

- **唯一真源**：`portals/app/prisma/schema.prisma`（`// --------------------------------------------------------------- services ----` 段的 `DataService` / `DataServiceDataset`）。本文件是其可读导览，**不得**先于 schema 变更；任何字段/类型/默认/关系/索引改动先落 SoT，再回写本文件与 [`data-000`](arda-data-000-index.md) 看板。
- **迁移**：schema 变更须随附 `portals/app/prisma/migrations/` 下的迁移，部署时容器启动自动 `prisma migrate deploy`（见 [`data-300`](arda-data-300-migration.md) §1）。
- **一致性核对**：本篇与 SoT 冲突时以 SoT 为准；发现漂移应回改 SoT 或在本篇显式标注（如 §2.3 记录的 `status` 注释修正）。
- **横切约束**：workspace 隔离、索引与性能、加密与密钥等跨板块规则见 `data-110` / `data-120` / `data-130`，本篇不重复定义。
