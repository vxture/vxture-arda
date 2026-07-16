# arda 数据架构 · 基建 schema（非用户业务数据）（arda-data-260-infrastructure）

> 状态：权威设计（较稳定演进；变更须同步 `portals/app/prisma/schema.prisma` 与本文件）
> 层：第 2 层 · 板块 schema · infrastructure 基建（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（`infrastructure` 段，字段名/类型/索引以 schema 文件为准；本文件只是其可读导览）
> 上游：总体设计见 [`data-100`](arda-data-100-architecture.md)；隔离横切见 [`data-110`](arda-data-110-isolation.md)；本板块**无对应 biz 板块**（见 [`data-000`](arda-data-000-index.md) §3），最近的接触面是 admin 审计 [`data-250`](arda-data-250-admin.md)（seed/wipe 落 `AuditLog`）；模板/指令语义见 [ADR](decisions/ADR-001-entitlement-and-workspace.md) §4（模板 seed）/ §5（平台指令）

---

## 1. 板块概述

### 1.1 本板块承载什么

`infrastructure` 是持久层**独有**的板块：它不是任何用户业务能力，因此在 [`arda-biz-*`](arda-biz-000-index.md) 里**没有对应板块**。它只装两类"支撑数据"：

1. **隔离锚（`WorkspaceRef`）** —— 平台 workspace 在 arda 本地的一份最小镜像。它给整个 schema 的 `workspaceId` 隔离键提供一个可落地的引用点，但**不拥有** workspace 生命周期（create/clone/delete 全归平台/IdP，见 [ADR](decisions/ADR-001-entitlement-and-workspace.md) §3.6）。
2. **全局样例模板（`SeedTemplate` / `TemplateVersion`）** —— 只读、版本化的示例数据模板，供平台下发 `seed` 指令时克隆进新 workspace（[ADR](decisions/ADR-001-entitlement-and-workspace.md) §4）。它们是全库**唯一不带 `workspaceId` 的表**，因为模板是平台/运营侧统一策展的公共物，不属于任何单一 workspace。

### 1.2 为何独立于业务面（无对应 biz 板块）

其余板块（assets / integration / governance / services / admin）都描述"用户在 arda 里做的事"，每张表都带 `workspaceId` 并被服务端强制过滤（见 [`data-100`](arda-data-100-architecture.md) §4、[`data-110`](arda-data-110-isolation.md)）。`infrastructure` 三张表**都不满足**这个范式，所以刻意拎出来单列：

- `WorkspaceRef` 的隔离键就是它自己的 `id`（`id` = 平台 `active_workspace`），它**是**锚点，而不是被 `workspaceId` 过滤的业务行 -> 因此**没有** `workspaceId` 列、也没有 `@@index([workspaceId])`。
- `SeedTemplate` / `TemplateVersion` 是**跨 workspace 全局共享**的，压根没有 `workspaceId` 概念 -> 不隔离、不按 workspace 过滤。

一句话：`biz` 面回答"用户能做什么"，`infrastructure` 面回答"多租户隔离与首启填充靠什么支撑"。二者天然不对齐，故 `data-260` 是本系列里唯一没有 `biz-2X0` 镜像的板块。

### 1.3 v1 范围与边界

| 属性 | 取值 |
|---|---|
| 含表 | `WorkspaceRef`、`SeedTemplate`、`TemplateVersion`（共 3 张） |
| 带 `workspaceId`? | 全部**否**（本板块的定义性特征） |
| 对应 biz 板块 | 无（见 [`data-000`](arda-data-000-index.md) §3） |
| 枚举 | 无（本板块不引用 `AssetLevel` / `QualityStatus`） |
| 关系 | 仅 `SeedTemplate` 1:N `TemplateVersion`（板块内部）；`WorkspaceRef` 与业务表**无 FK** |
| 不建表（future/边界） | 平台侧 Org / workspace 生命周期 / Subscription（arda 不建，见 [`data-100`](arda-data-100-architecture.md) §6）；per-workspace seed 执行台账（走 `AuditLog`，见 §5） |

边界重申（[`data-100`](arda-data-100-architecture.md) §6）：`WorkspaceRef` **只是镜像**，不是 workspace 生命周期的所有者；订阅 / 权益 / 计费一律不落 arda 库。

---

## 2. 表定义

以下三个 model 逐字照抄 SoT `portals/app/prisma/schema.prisma` 的 `infrastructure` 段（注释一并保留）。

### 2.1 WorkspaceRef — 隔离锚（平台 workspace 本地镜像）

```prisma
/// Local mirror of a platform workspace, used purely as the isolation anchor.
/// arda does NOT own workspace lifecycle (create/clone/delete = platform).
model WorkspaceRef {
  id         String   @id // = platform/IdP active_workspace
  orgId      String
  seedStatus String? // platform marker: needs sample-data fill (ADR section 4)
  createdAt  DateTime @default(now())

  @@index([orgId])
}
```

字段说明：

- `id String @id` —— 主键**直接**是平台/IdP 的 `active_workspace` 值（不透明 claim），**不是** `@default(cuid())`。这一点与其它所有表不同：其它表 `id` 是 arda 自铸的 cuid，而 `WorkspaceRef.id` 由平台注入。它同时充当整个 schema 的 `workspaceId` 隔离键的语义来源（见 [`data-100`](arda-data-100-architecture.md) §4）。
- `orgId String` —— 必填。该 workspace 所属的 Org（平台 `active_org`）。用于按 org 聚合/列举 workspace 的镜像，故建了 `@@index([orgId])`（见 §4）。
- `seedStatus String?` —— 可选。平台侧标记位，表示该 workspace"需要示例数据填充"（[ADR](decisions/ADR-001-entitlement-and-workspace.md) §4）。用户首次进入 arda 时读取该标记，触发模板克隆，完成后清除/更新该标记。它是**字符串标记**而非枚举/布尔，取值语义由平台约定（例如 `needs`/空），arda 不在 schema 层锁死取值。
- `createdAt DateTime @default(now())` —— 本地镜像行的创建时间（arda 侧首次登记该 workspace 的时刻），非 workspace 在平台的真实创建时间。

> 注意：本表**没有** `workspaceId` 列，也**没有** `@@index([workspaceId])` —— 它本身就是隔离锚，`id` 即 workspace 标识。

### 2.2 SeedTemplate — 全局样例数据模板（只读、版本化）

```prisma
/// Read-only, versioned sample-data templates (global, platform/ops-curated).
/// NOT workspace-scoped.
model SeedTemplate {
  id        String            @id @default(cuid())
  name      String
  createdAt DateTime          @default(now())
  versions  TemplateVersion[]
}
```

字段说明：

- `id String @id @default(cuid())` —— arda 自铸 cuid 主键（与业务表一致）。
- `name String` —— 必填。模板显示名（例如"标准示例目录"）。schema 层**未**对 `name` 加唯一约束（无 `@@unique`），去重/命名规范由应用层与运营策展流程约束。
- `createdAt DateTime @default(now())` —— 模板登记时间。
- `versions TemplateVersion[]` —— 关系字段（非物理列），指向该模板的全部版本（1:N，见 §3）。

本表**全局共享，非 workspace 隔离**：无 `workspaceId`、无按 workspace 的索引；它是平台/运营侧统一策展的公共资产。

### 2.3 TemplateVersion — 模板的一个版本（含 manifest）

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

字段说明：

- `id String @id @default(cuid())` —— arda 自铸 cuid 主键。
- `templateId String` —— 必填外键列，指向所属 `SeedTemplate.id`（关系见 §3）。
- `version String` —— 必填。版本标识（字符串，例如 `1.0.0`/`v2`；schema 不限定格式）。与 `templateId` 组成复合唯一键（见 §4），保证"同一模板下版本号唯一"。
- `manifest Json` —— 必填 `Json`（**非可选**，注意没有 `?`）。承载该版本要克隆进 workspace 的示例数据清单/内容描述（例如示例数据集、样例项目等的结构化定义）。以 `Json` 落库，避免为模板内容单独铺一套物理表；克隆时由应用层解释 `manifest` 并写出为目标 workspace 的**普通业务行**。
- `createdAt DateTime @default(now())` —— 该版本创建时间。
- `template SeedTemplate @relation(...)` —— 指回父模板的关系字段（见 §3）。

同样**全局共享、非 workspace 隔离**。

---

## 3. 关系与删除策略

本板块只有一条板块内关系，外加一条"刻意不存在"的关系边界。

### 3.1 SeedTemplate 1:N TemplateVersion（`onDelete: Cascade`）

```prisma
// TemplateVersion 侧持有外键与删除策略：
template SeedTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
// SeedTemplate 侧为反向集合：
versions  TemplateVersion[]
```

- **方向**：`TemplateVersion.templateId -> SeedTemplate.id`。外键与 `@relation` 落在**子侧**（`TemplateVersion`），父侧（`SeedTemplate.versions`）是反向集合，不落物理列。
- **`onDelete: Cascade`（理由）**：`TemplateVersion` 是 `SeedTemplate` 的**从属版本**，脱离父模板没有独立意义；删除模板时其所有版本随之物理删除，符合"版本是模板的组成部分"的聚合根语义。因这是运营侧策展的全局静态数据、无跨 workspace 引用，级联删除安全、无孤儿风险。
- 对比本板块之外的 `SetNull`（如 assets 的 `Dataset.source`、admin 的 `ApiKey.service`）：那些是"可选归属、父没了子仍要活着"的弱关联，故解绑而非删子。这里 `TemplateVersion` 与父是强从属，故用 `Cascade`。

### 3.2 WorkspaceRef 与业务表：刻意无 FK

`WorkspaceRef` **不被**任何业务表以外键引用，业务表的 `workspaceId` 列也**不是**指向 `WorkspaceRef.id` 的 FK（见 [`data-100`](arda-data-100-architecture.md) §4、SoT 顶部注释）。设计理由：

- workspace 生命周期归平台，业务行**不能依赖本地 `WorkspaceRef` 先存在** —— 若设为 FK，则平台先创建 workspace、arda 尚未登记镜像时写业务数据会被外键挡下，制造时序耦合。
- 因此 `workspaceId` 是**普通索引列**，隔离靠服务端 `where: { workspaceId }` 强制过滤兜底，而非数据库外键。`WorkspaceRef` 仅作 org 归属登记与 `seedStatus` 标记的落点，不承担引用完整性职责。

---

## 4. 唯一约束与索引

逐条列出本板块三表的 `@@id` / `@@unique` / `@@index`：

| 表 | 约束/索引 | 说明与理由 |
|---|---|---|
| `WorkspaceRef` | `@id` on `id` | 主键即平台 `active_workspace`；隔离锚身份键，天然全局唯一。 |
| `WorkspaceRef` | `@@index([orgId])` | 支撑"按 org 列举/聚合其下 workspace 镜像"。**这是本表唯一的二级索引** —— 无 `@@index([workspaceId])`（本表就是锚点，不需要也没有该列）。 |
| `SeedTemplate` | `@id` on `id`（cuid） | 唯一主键；本表**无**任何二级索引与唯一约束（`name` 未加唯一）。 |
| `TemplateVersion` | `@id` on `id`（cuid） | 唯一主键。 |
| `TemplateVersion` | `@@unique([templateId, version])` | "同一模板下版本号唯一"；防止一个 `SeedTemplate` 挂两条同名版本。该复合唯一键同时为按 `templateId` 的查询提供前缀索引能力，故本表未再单列 `@@index([templateId])`。 |

要点：

- 本板块**没有任何** `@@index([workspaceId])` 或 `@@unique([workspaceId, ...])` —— 与其它五个板块的隔离范式（见 [`data-110`](arda-data-110-isolation.md) / [`data-100`](arda-data-100-architecture.md) §4）形成鲜明对照，这正是"基建 schema"独立成板块的直接体现。
- `WorkspaceRef` 唯一的二级索引是 `@@index([orgId])`；`TemplateVersion` 唯一的约束是复合唯一 `@@unique([templateId, version])`；`SeedTemplate` 只有主键。

---

## 5. future 与有意不落库

本板块刻意保持极简，以下内容**有意不建表 / 不落列**：

### 5.1 平台侧概念：不建镜像表

- **Org / workspace 生命周期（create/clone/delete）**：平台/IdP 所有；arda 只保留 `WorkspaceRef` 这份最小镜像（`id` + `orgId` + `seedStatus`），**不复制** workspace 的名称、成员、状态机等生命周期数据（[ADR](decisions/ADR-001-entitlement-and-workspace.md) §3.6、[`data-100`](arda-data-100-architecture.md) §6）。
- **Subscription / 权益 / 计费**：平台是 SoT，arda **不建镜像表**，走 token claim 或未来的只读端点实时拉取（[`data-100`](arda-data-100-architecture.md) §5-§6）。`WorkspaceRef` 里也**不冗余** tier/state 字段。

### 5.2 seed 执行台账：不单独建表，走 AuditLog

`seedStatus` 只是"是否需要填充"的**标记位**，不是执行历史。模板克隆（seed）/ 删除（wipe）这类平台指令的**执行记录**不在本板块建专表，而是落到 admin 板块的 `AuditLog`（带 `idempotencyKey` 幂等防重放，见 [`data-250`](arda-data-250-admin.md) 与 [ADR](decisions/ADR-001-entitlement-and-workspace.md) §5）。这样避免为一次性运维动作再铺一套时序表。

### 5.3 模板内容：以 manifest 承载，不铺物理表

`TemplateVersion.manifest Json` 内联承载模板要克隆的示例数据定义，**不**为模板内容单独建"示例数据集/示例项目"等物理表。克隆时应用层解释 `manifest`，把内容**写成目标 workspace 的普通业务行**（assets/governance/... 各板块的表），而非在本板块留下 per-workspace 的模板副本。

- **future（copy-on-write）**：[ADR](decisions/ADR-001-entitlement-and-workspace.md) §4 指出填充"先全量克隆、后按需 copy-on-write"。COW 落地时如需模板行与 workspace 行的引用关系，将在届时评估是否新增结构；v1 **不预建**该关系，保持 `SeedTemplate` / `TemplateVersion` 为纯只读全局模板。

### 5.4 派生值：不落库

- `WorkspaceRef` 不存"该 workspace 的资产数/成员数/最近活跃时间"等派生统计 —— 与 [`data-100`](arda-data-100-architecture.md) §5"可推导优于可存储"一致，此类值按需从各业务表聚合，避免刷新一致性与配置漂移问题。

---

## 6. 变更规程

1. 改 `portals/app/prisma/schema.prisma` 的 `infrastructure` 段（本板块的**唯一真源**）。
2. `prisma migrate dev --name <desc>` 生成迁移，产物入 `portals/app/prisma/migrations/`。
3. 同步更新本文件对应表定义（字段/关系/索引变化），逐字与 SoT 对齐。
4. 若新增/删除表或改变隔离方式（尤其是给本板块任何表引入 `workspaceId`），同步更新 [`data-100`](arda-data-100-architecture.md) §5 总览与 [`data-000`](arda-data-000-index.md) §3 板块划分表。
5. 迁移在部署环境的应用方式、当前迭代目标见 [`data-300`](arda-data-300-migration.md)。
