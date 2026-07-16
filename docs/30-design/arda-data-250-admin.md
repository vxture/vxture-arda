# arda 数据架构 · 管理 schema（arda-data-250-admin）

> 状态：权威设计（板块 schema，字段/类型/索引以 SoT 为准，随 SoT 演进）
> 层：第 2 层 · 板块 schema（admin 管理，`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（admin 段，本文件只是其可读导览，字段以 SoT 逐字为准）
> 上游：总体设计见 [`data-100`](arda-data-100-architecture.md)；横切见 [`data-130`](arda-data-130-encryption.md)（密钥哈希存储）/ [`data-140`](arda-data-140-audit.md)（审计与幂等）；对应业务面 [`biz-250`](arda-biz-250-admin.md)

---

## 1. 板块概述

admin 板块承载 arda 自己的安全与运维控制面数据，只有两张表：`ApiKey`（对外数据服务的访问密钥）与 `AuditLog`（活动 + 平台指令审计）。它对应 schema 注释里的 `admin` 段（`portals/app/prisma/schema.prisma` 的 `admin` 分区），业务面对齐 [`biz-250`](arda-biz-250-admin.md)。

**本板块承载什么**

- `ApiKey`：调用数据服务（`DataService`，见 [`data-240`](arda-data-240-services.md)）时的凭据。库里**只存哈希**（`hashedKey`），不存明文；携带 `scopes` 作用域、`revoked` 撤销标志、`lastUsedAt` 观测时间，以及 `consumerApp` 消费方 agent 溯源标记（见 [`data-150`](arda-data-150-multiagent-sharing.md)）。
- `AuditLog`：workspace 内的活动流水与平台指令审计。以 `idempotencyKey` 做**全局唯一幂等**，承载 ADR section 5.1 的平台指令（seed/wipe/invalidate）防重放。

**v1 范围与边界**

- 范围内：上述两表的全部字段、关系、唯一键与索引，均按 SoT 落地。两表都带 `workspaceId` 隔离键（普通索引列，非外键，隔离模型见 [`data-100`](arda-data-100-architecture.md) section 4）。
- 明确不在本板块：身份 / 订阅 / 计费 / 授权（平台与 IdP 所有，arda 不建表，见 [`data-100`](arda-data-100-architecture.md) section 6）。密钥的哈希算法与存储细节属横切 [`data-130`](arda-data-130-encryption.md)；审计的幂等工程（重放窗口、清理、TTL）属横切 [`data-140`](arda-data-140-audit.md)。本文只描述**表结构层**的约束。

**与其它板块的耦合**

- `ApiKey` 通过可选外键 `dataServiceId` 反指 services 板块的 `DataService`（[`data-240`](arda-data-240-services.md)）；`DataService` 侧持有反向关系 `apiKeys ApiKey[]`。密钥也可不绑定任何服务（`dataServiceId` 为 null，见 section 3）。
- `AuditLog` 不建任何外键：`actor` / `target` 是字符串引用而非关系列（见 section 3 的删除策略理由）。

---

## 2. 表定义

以下 prisma 代码块原样照抄 SoT（`portals/app/prisma/schema.prisma` 的 admin 段），字段名 / 类型 / 默认值 / 关系 / 索引一字不差。

### 2.1 ApiKey

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
```

字段说明要点：

- `id`：主键，`@default(cuid())` 生成的字符串 id。
- `workspaceId`：隔离键，必填。普通索引列，非外键（业务行不依赖本地 `WorkspaceRef` 先存在）。
- `dataServiceId`：可选外键（`String?`）指向 `DataService.id`。为 null 表示这是一把 workspace 级密钥，不绑定到单个数据服务。
- `name`：密钥展示名，必填，不唯一（仅用于人读标识，唯一性由 `hashedKey` 保证）。
- `consumerApp`：`String?`，本密钥认证为哪个**消费方 agent/app** 的身份标记（消费方 agent id）。它不是隔离键（隔离仍由 `workspaceId` 兜底），而是**消费方溯源轴**：请求携带的裸密钥经 `hashedKey` 命中后，`consumerApp` 标明「这次调用是 workspace 内哪个 agent 发起的」。两个用途：(1) 写 `AuditLog` 时作归因，把调用行为记到具体消费方 agent 名下（交叉 [`data-140`](arda-data-140-audit.md)）；(2) 供 `DataService` 网关按消费方身份做 Policy 的 access/masking 判定。为 null 表示未标注消费方（如 workspace 级通用密钥或历史遗留密钥，向后兼容加列）。多 agent 属主/消费方轴的整体模型见 [`data-150`](arda-data-150-multiagent-sharing.md)。
- `hashedKey`：`String @unique`，**全局唯一**（跨 workspace 唯一，见 section 4）。库中仅存哈希，明文只在创建时一次性返回、不落库（交叉 [`data-130`](arda-data-130-encryption.md)）。
- `scopes`：`String[]`（Postgres `text[]` 数组），作用域 / 能力标签列表。v1 在 schema 层不约束取值集合（自由标签，见 section 5）。
- `lastUsedAt`：`DateTime?`，最近一次使用时间。null 表示从未使用；是 best-effort 观测值，按调用异步回写（见 section 5）。
- `revoked`：`Boolean @default(false)`，撤销标志。撤销是软状态（置 true 而非物理删除），保留记录以便审计与后续清理。
- `createdAt`：`DateTime @default(now())`，创建时间。

### 2.2 AuditLog

```prisma
/// Activity + platform-command audit (seed/wipe/invalidate, ADR section 5.1).
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

字段说明要点（模型上的 `///` 文档注释为 SoT 原文，标明本表承载 ADR section 5.1 的平台指令审计）：

- `id`：主键，`@default(cuid())`。
- `workspaceId`：隔离键，必填。普通索引列，非外键。
- `actor`：必填字符串。取值为发起者的用户 id，或字面量 `"platform"`（平台自身发起的指令）。
- `action`：必填字符串，动作名（例如平台指令 seed / wipe / invalidate，或用户活动动作）。
- `target`：`String?`，动作作用的目标对象引用，可空。
- `idempotencyKey`：`String?  @unique`，**全局唯一且可空**的幂等键。有值时全局唯一，用于平台指令的幂等防重放；为 null 表示普通活动日志（无需幂等，见 section 4 对可空唯一的说明）。工程细节交叉 [`data-140`](arda-data-140-audit.md)。
- `metadata`：`Json?`，结构化附加上下文，可空。
- `createdAt`：`DateTime @default(now())`，事件时间，也是审计翻页排序键（见 section 4）。

---

## 3. 关系与删除策略

本板块只有一条关系边，位于 `ApiKey`；`AuditLog` 刻意无关系。

**ApiKey.service -> DataService（`onDelete: SetNull`）**

- 方向：`ApiKey.dataServiceId`（可选）指向 `DataService.id`，反向为 `DataService.apiKeys`（services 板块 [`data-240`](arda-data-240-services.md) 持有）。
- 删除语义：`onDelete: SetNull`。删除一个数据服务时，其下密钥不被连带删除，而是把 `dataServiceId` 置空，密钥变为「未绑定服务」状态并保留。
- 设计理由：密钥是有独立生命周期与安全语义的实体。级联删除会抹掉可撤销 / 可审计的凭据记录，制造安全盲区；SetNull 让密钥在服务消失后仍可被显式撤销、审计与清理。这与 assets 板块 `Dataset.source` 对 `DataSource` 的 `SetNull`（软解绑而非级联）取同一原则。对比之下，关系表（如 `DataServiceDataset`）用 `Cascade` 是因为它本身没有独立语义，父级消失后连接行即无意义，可随父删除。

**AuditLog：无关系、无外键（有意）**

- `AuditLog` 不声明任何 `@relation`。`actor` 与 `target` 是字符串引用（id 快照或 `"platform"`），而非指向实体的外键。
- 设计理由：审计记录必须在被引用对象（用户、数据集、服务等）被删除后仍然完整留存。若把 `actor` / `target` 建成外键并配级联，删除源对象就会连带抹掉历史，违背审计的本质。因此审计表刻意「去关系化」，靠 `workspaceId` 平坦落盘，用字符串快照承接引用。

---

## 4. 唯一约束与索引

逐条列出本板块的 `@@unique` / `@@index` 及字段级 `@unique`、`@id`，并说明为何这样建。

**ApiKey**

- `id String @id`：单列主键（cuid）。无 `@@id` 复合主键。
- `hashedKey String @unique`：字段级、**全局唯一**（不含 `workspaceId`，跨 workspace 唯一）。理由：密钥校验按哈希直查，请求携带的是裸密钥、此刻还没有 workspace 上下文，必须能靠哈希单键 O(1) 命中并解析出所属 workspace；全局唯一同时排除跨 workspace 的哈希碰撞。这是 admin 板块唯一一处刻意偏离「workspace 内唯一」惯例的地方。
- `@@index([workspaceId])`：支撑管理页按 workspace 列出密钥的过滤。
- 说明：`dataServiceId` 无独立索引；按服务筛密钥的路径经 `workspaceId` 索引再过滤（v1 密钥量小，无需额外索引；若成为热点可后续追加）。

**AuditLog**

- `id String @id`：单列主键（cuid）。无 `@@id` 复合主键。
- `idempotencyKey String? @unique`：字段级、**全局唯一且可空**。Postgres 下 NULL 不参与唯一约束，因此允许任意多行 `idempotencyKey = null`（普通活动日志不需要幂等）；一旦有值即全局唯一，平台指令重放时第二次写入命中唯一冲突即被幂等拒绝，从存储层保证「同一指令至多执行一次」。工程语义交叉 [`data-140`](arda-data-140-audit.md)。
- `@@index([workspaceId])`：支撑按 workspace 查审计。
- `@@index([workspaceId, createdAt])`：审计的核心访问模式是「workspace 内按时间倒序翻页 / 按时间范围检索」，该复合索引让 `(workspaceId, createdAt)` 上的排序与范围查询走索引，避免全表扫描后再排序。这是本板块唯一的复合索引，专为审计时间线查询而建。

---

## 5. future 与有意不落库

保留定义不建表、以及派生 / 非持久值不落库的部分：

- **API Key 明文：不落库。** 库里只有 `hashedKey`；明文仅在创建响应中一次性返回，之后不可再取。哈希算法 / 加盐 / 存储规范属横切 [`data-130`](arda-data-130-encryption.md)。
- **`ApiKey.lastUsedAt`：观测值，非强一致。** 按调用 best-effort 异步回写，可能滞后；它不是可从其它表推导的派生列，但也不作为强一致真源看待，仅用于密钥轮换 / 闲置回收判据。
- **`ApiKey.scopes` 的作用域字典：future。** v1 在 schema 层是自由 `String[]` 标签，不建作用域枚举 / 引用表；作用域取值集合的规范化留待后续。
- **审计类 telemetry：不进 `AuditLog`。** 「谁看过 / 调用量 / 增长趋势」等聚合展示是客户端 telemetry，v1 未建模，不落库（与 [`data-100`](arda-data-100-architecture.md) section 5 的「有意不落库」一致）。
- **`AuditLog` 的 actor / target 实体化：future。** actor / target 是字符串快照，刻意不建 FK 与镜像实体表（见 section 3）。将来若要富化展示（如显示用户名），走平台 / IdP 只读拉取，不在本库建镜像表。
- **平台指令幂等的运行时工程：见横切。** 重放窗口、过期清理、`idempotencyKey` 生成约定等不在本表结构范围内，见 [`data-140`](arda-data-140-audit.md)。

---

## 变更规程

- **真源在 SoT。** 本文件是 `portals/app/prisma/schema.prisma`（admin 段）的可读导览，不是权威定义。任何 `ApiKey` / `AuditLog` 的字段、类型、默认值、关系、唯一键或索引变更，一律先改 `portals/app/prisma/schema.prisma`，再回填本文，保持逐字一致。
- **迁移随 schema 走。** admin 两表的结构变更通过 `prisma migrate` 新增迁移落地，时间线登记见 [`data-300`](arda-data-300-migration.md) section 1；不得脱离迁移直接改本文描述的结构。
- **横切约束不在本文改。** 密钥哈希存储改动记入 [`data-130`](arda-data-130-encryption.md)，审计 / 幂等工程改动记入 [`data-140`](arda-data-140-audit.md)；本文只反映表结构层。
- **不得虚构。** 本文不新增 SoT 中不存在的字段 / 索引 / 枚举。
