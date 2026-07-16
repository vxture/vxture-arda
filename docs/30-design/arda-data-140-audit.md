# arda 数据架构 · 审计与幂等（arda-data-140-audit）

> 状态：权威设计（横切工程约束，随 SoT 演进）
> 层：第 1 层 · 横切工程 · 审计与幂等（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（`AuditLog` 结构以 SoT 逐字为准；本文件只是其可读导览）
> 上游：总体设计见 [`data-100`](arda-data-100-architecture.md)；相关横切 `data-130`（加密与密钥）；承载表的板块 schema 见 [`data-250`](arda-data-250-admin.md)（admin 段）；指令通道来源 [ADR](decisions/ADR-001-entitlement-and-workspace.md) §5.1；对应业务面 [`biz-250`](arda-biz-250-admin.md)；现状交叉 [`data-300`](arda-data-300-migration.md) §4.3

---

## 1. 主题与约束概述

「审计与幂等」是一条横切持久层的工程约束，落点是**唯一一张表** `AuditLog`（admin 段，见 [`data-250`](arda-data-250-admin.md)）。它把两个相互缠绕的关注点收在同一张表上：

1. **审计（audit）**：记录 workspace 内的活动流水与平台指令。SoT 模型上的 `///` 文档注释即原文声明了这一职责：`Activity + platform-command audit (seed/wipe/invalidate, ADR section 5.1)`。
2. **幂等（idempotency）**：以 `idempotencyKey`（全局唯一）在存储层拒绝重放，保证「同一平台指令至多执行一次」。

**本主题的硬约束**

- **平台指令必须落审计**：平台下发的 `seed / wipe / invalidate`（ADR §5.1）每一条都必须写入一行 `AuditLog`。审计不是事后补丁，而是指令通道「服务间签名 + 幂等 + 软删 + 审计」四要素之一（ADR §5.1、[`data-100`](arda-data-100-architecture.md) §1 设计目标 5）。
- **幂等靠存储层唯一约束兜底**：`idempotencyKey String? @unique` 是**全局唯一**（不带 `workspaceId` 前缀）。有值时全局唯一，重放时第二次写入命中唯一冲突即被拒绝；为 null 时（Postgres 下 NULL 不参与唯一约束）允许任意多行，供无需幂等的普通活动日志使用。
- **审计表去关系化**：`AuditLog` 刻意不声明任何 `@relation` / 外键。`actor` 与 `target` 是字符串快照而非关系列，使被引用对象（用户 / 数据集 / 服务）被删除后审计仍完整留存（删除策略理由见 [`data-250`](arda-data-250-admin.md) §3）。
- **按时间检索走复合索引**：`@@index([workspaceId, createdAt])` 支撑「workspace 内按时间倒序翻页 / 按时间范围检索」这一核心访问模式，避免全表扫描后再排序。

**边界（本文只谈什么）**

- 本文是审计 / 幂等的**工程语义**（写入范式、幂等短路、按时间查询、现状与目标态）。`AuditLog` 的**表结构层**逐字段说明见板块 schema [`data-250`](arda-data-250-admin.md) §2.2 / §4。
- 不谈密钥哈希与敏感字段加密（属横切 `data-130`）。不谈订阅 / 权益 / 计费（平台与 IdP 所有，arda 不建表，见 [`data-100`](arda-data-100-architecture.md) §6）。
- **审计类 telemetry 不入 `AuditLog`**：「谁看过 / 调用量 / 增长趋势」等聚合展示是客户端 telemetry，v1 未建模、不落库（与 [`data-100`](arda-data-100-architecture.md) §5「有意不落库」一致）。

**现状（一句话）**：`AuditLog` 表与 `idempotencyKey` 全局唯一约束**已建**，但**尚无写入调用点**，服务间鉴权与 wipe 执行链路也未实现（交叉 [`data-300`](arda-data-300-migration.md) §4.3）。

---

## 2. 规则与范式

### 2.1 schema 层约束（SoT 原样）

以下 prisma 代码块原样照抄 SoT（`portals/app/prisma/schema.prisma` 的 admin 段），字段名 / 类型 / 默认值 / 关系 / 索引一字不差：

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

约束要点（均为本主题所依赖）：

- `idempotencyKey String? @unique`：字段级、**全局唯一且可空**的幂等键。这是本表唯一偏离「workspace 内唯一」惯例（如 `@@unique([workspaceId, code])`）的地方 - 幂等键必须跨 workspace 唯一，平台指令的重放才能在任意 workspace 上下文被单键识别并拒绝。
- `@@index([workspaceId, createdAt])`：本表唯一的复合索引，专为审计时间线的排序 / 范围查询而建。
- `@@index([workspaceId])`：通用隔离查询索引（每个业务表至少一条，见 [`data-100`](arda-data-100-architecture.md) §4）。
- **无 `@relation`、无外键**：`actor` / `target` 是字符串引用，不建 FK，不配级联；审计不随源对象删除而丢失。
- `createdAt DateTime @default(now())`：事件时间，同时是复合索引里的排序键。

### 2.2 应用层代码范式

> 以下为**目标态范式**（现状未接入，见 §4），仅使用 SoT 已有字段（`workspaceId` / `actor` / `action` / `target` / `idempotencyKey` / `metadata`），不虚构任何字段或枚举。`prisma` 为 `app/lib/db.ts` 导出的单例。

**范式一：平台指令写审计 + 幂等短路。** 每个平台指令处理器（`seed` / `wipe` / `invalidate`）在执行破坏性副作用**之前**先经此写审计；`idempotencyKey` 唯一冲突即视为「已处理过」，幂等短路、不重复执行：

```ts
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/app/lib/db";

// 平台指令载荷（ADR section 5.1）：workspaceId + 操作类型 + 幂等键（+ 元数据）。
async function recordPlatformCommand(cmd: {
  workspaceId: string;
  action: string;            // seed | wipe | invalidate
  target?: string;
  idempotencyKey: string;    // 平台指令必带，全局唯一
  metadata?: Prisma.InputJsonValue;
}): Promise<{ firstTime: boolean }> {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: cmd.workspaceId,
        actor: "platform",     // 平台自身发起，字面量 "platform"
        action: cmd.action,
        target: cmd.target,
        idempotencyKey: cmd.idempotencyKey,
        metadata: cmd.metadata,
      },
    });
    return { firstTime: true };   // 首次落审计，调用方随后执行副作用
  } catch (e) {
    // idempotencyKey 唯一冲突 (P2002) = 指令已审计过 -> 幂等拒绝，不重复执行。
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { firstTime: false };
    }
    throw e;
  }
}
```

**范式二：普通活动审计（无幂等键）。** 用户活动写审计时 `actor` 取用户 id，`idempotencyKey` 省略（Postgres 下多行 NULL 不冲突，无需幂等）：

```ts
// actor = 用户 id；不传 idempotencyKey（活动日志无需防重放）。
await prisma.auditLog.create({
  data: {
    workspaceId,
    actor: userId,
    action: "dataset.update",
    target: datasetId,
  },
});
```

**范式三：按时间倒序翻页（命中复合索引）。** 审计时间线查询按 `workspaceId` 收口、按 `createdAt` 倒序，走 `@@index([workspaceId, createdAt])`：

```ts
// (app)/admin/audit/data.ts - 服务端强制按 workspaceId 过滤，客户端不直连 DB。
export async function listAudit(workspaceId: string, take = 50) {
  return prisma.auditLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },   // 命中 @@index([workspaceId, createdAt])
    take,
  });
}
```

---

## 3. 逐表 / 逐字段落点

本主题只落在一张表：`AuditLog`。下表逐字段标注其在「审计 / 幂等」主题中的角色（字段名 / 类型 / 默认 / 约束与 SoT 逐字一致）：

| 字段 / 约束 | 类型与修饰 | 主题落点 |
|---|---|---|
| `id` | `String @id @default(cuid())` | 主键（通用） |
| `workspaceId` | `String` | 隔离键（通用，普通索引列，非外键） |
| `actor` | `String`（`// a user id or "platform"`） | **审计**：发起者，取用户 id 或字面量 `"platform"` |
| `action` | `String` | **审计**：动作名（如 `seed` / `wipe` / `invalidate` 或用户活动动作） |
| `target` | `String?` | **审计**：动作目标引用（字符串快照，可空，无 FK） |
| `idempotencyKey` | `String? @unique` | **幂等**：全局唯一防重放键，可空（NULL 不参与唯一约束） |
| `metadata` | `Json?` | **审计**：结构化附加上下文，可空 |
| `createdAt` | `DateTime @default(now())` | **审计**：事件时间，兼作排序键 |
| `@@index([workspaceId])` | 索引 | 通用隔离查询 |
| `@@index([workspaceId, createdAt])` | 复合索引 | **审计**：按时间倒序翻页 / 范围检索 |
| `@unique` on `idempotencyKey` | 字段级唯一 | **幂等**：全局唯一（跨 workspace），存储层防重放 |

说明：

- 平台 `wipe` 指令按 `workspaceId` 清理的是**其它** workspace 隔离业务表（assets / integration / governance / services / admin 各表）的数据，但**审计本身只落 `AuditLog` 一行** - 指令是什么、作用于哪个 workspace、幂等键为何，都由这一行承载，被清理的业务表不参与审计建模。
- 本表**无枚举**：`actor` / `action` / `target` 均为自由 `String`，SoT 未定义审计动作枚举，本文不虚构。`action` 的取值集合规范化（若需要）属未来工程，不在本表结构范围内。

---

## 4. 现状与目标态

本节与 [`data-300`](arda-data-300-migration.md) §4.3「平台指令通道（seed / wipe / invalidate）：schema 已备，执行链路未接」对齐；此处从审计 / 幂等视角展开：

| 项 | 现状 | 目标态（ADR §5.1） |
|---|---|---|
| 幂等键 | `AuditLog.idempotencyKey`（全局唯一）**已建** | 平台指令按此键防重放（唯一冲突即幂等拒绝） |
| 审计写入 | `AuditLog` 表**已建，尚无写入调用点** | 每条平台指令必须落一行审计（§2.1 范式一） |
| 按时间查询 | `@@index([workspaceId, createdAt])` **已建** | 审计时间线倒序翻页 / 范围检索走此索引（§2.2 范式三） |
| 服务间鉴权 | 未实现 | 服务间签名（API key / 服务 JWT / mTLS，待与平台确定） |
| wipe 执行 | 未实现 | 按 `workspaceId` 软删 + 延迟 N 天硬删，全过程落审计 |

**差距定性**：这是当前 schema 与实际能力**差距最大**的一块 - 表结构（`AuditLog` + `idempotencyKey` 唯一 + 时间复合索引）已经就位，缺的是**内部端点、服务间鉴权与写入调用点**（[`data-300`](arda-data-300-migration.md) §4.3、§5 待办 3）。

**落地要点（不新增表，仅接链路）**：

1. 平台指令内部端点接入 §2.1 范式一：先写审计（带 `idempotencyKey`）再执行副作用，唯一冲突则幂等短路。
2. `wipe` 采用软删 + 延迟硬删（ADR §5.1），为平台误发 / 被攻破留挽回窗口；软删与硬删两个阶段均各落一行审计。
3. `invalidate` 与 `seed` / `wipe` 共用同一条已鉴权的服务间通道（ADR §3.5 / §5.1），三者写审计的范式一致。
4. 幂等的运行时工程细节（重放窗口、`idempotencyKey` 生成约定、过期清理策略）随链路落地时在本文补充；当前存储层已由 `@unique` 兜底，不依赖运行时状态即可防重放。

---

## 变更规程

- **真源在 SoT。** 本文件是 `portals/app/prisma/schema.prisma`（`AuditLog` 模型）的可读导览，不是权威定义。`AuditLog` 的任何字段、类型、默认值、唯一键或索引变更，一律先改 `portals/app/prisma/schema.prisma`，再回填本文，保持逐字一致。
- **表结构层不在本文改。** `AuditLog` 逐字段的结构说明与删除策略记入板块 schema [`data-250`](arda-data-250-admin.md)；本文只承载审计 / 幂等的横切工程语义。
- **迁移随 schema 走。** 结构变更通过 `prisma migrate` 新增迁移落地，时间线登记见 [`data-300`](arda-data-300-migration.md) §1。
- **现状随链路更新。** §4 的现状 vs 目标态与 [`data-300`](arda-data-300-migration.md) §4.3 同源，指令通道落地时两处一并更新。
- **不得虚构。** 本文不新增 SoT 中不存在的字段 / 索引 / 枚举；§2 的 ts 范式仅为目标态示例，非现存调用点。
