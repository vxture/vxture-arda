# arda 数据架构 · 加密与密钥（arda-data-130-encryption）

> 状态：横切工程（net-new；汇总散落于各板块的加密/密钥约束，随 schema 演进）
> 层：第 1 层 · 横切工程 · 加密与密钥（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引 §1）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（本文件只是其可读导览，字段名/类型/默认/索引以 schema 文件为准）
> 上游：[`data-100`](arda-data-100-architecture.md)（总体架构）；相关横切 `data-110`（隔离）/ `data-120`（索引）/ [`data-140`](arda-data-140-audit.md)（审计与幂等）；对应板块 [`biz-220`](arda-biz-220-integration.md)（集成）/ [`biz-230`](arda-biz-230-governance.md)（治理）/ [`biz-250`](arda-biz-250-admin.md)（管理）；安全规范 [`security.md`](../10-specs/security.md)

---

## 1. 主题与约束概述

本文汇总 arda 持久层里与**加密、哈希、敏感分级、运行时 secrets** 相关的约束。这些约束在 SoT 中不是集中的一段，而是散落在 `DataSource` / `ApiKey` / `Policy` 三处字段与两个枚举值上；本文把它们收口成一份可执行的工程契约。

范围边界（本文只谈加密与密钥，不复述完整表设计）：

- **应用层加密（at the app layer）**：`DataSource.connectionConfig` 的敏感连接信息在写库前由应用层加密，DB 永不见明文。
- **单向哈希（one-way hash）**：`ApiKey` 只落 `hashedKey`（全局唯一），明文密钥不落库、不回显。
- **敏感分级与脱敏**：`AssetLevel`（`public` / `internal` / `sensitive` / `core`）对资产分级，`Policy.type == "masking"` 承载脱敏规则。
- **运行时 secrets 不入 Git**：连接串、client secret、包读令牌走 `.env` 运行时值，`.env.example` 只是占位 schema。
- **服务间鉴权（平台指令通道）尚未实现**：指向 [`data-140`](arda-data-140-audit.md)（审计/幂等）与 [`data-300`](arda-data-300-migration.md) §4.3（现状差距）。

关键原则：**SoT 里没有独立的 `iv` / `keyId` / `salt` 列**。加密的落点是既有的 `Json?` / `String` 列本身（密文与其元数据整体序列化进同一个值），密钥管理留在应用层与 `.env`，不为加密新增 schema 字段。本文严格只描述 SoT 已有字段，不虚构加密列。

---

## 2. 规则与范式（schema 层约束 + 应用层代码范式）

### 2.1 连接配置：写库前加密（DataSource.connectionConfig）

Schema 层约束（SoT 原样）：

```prisma
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

`connectionConfig` 是**可空 `Json?`**：密文（含算法、iv、密文体）整体序列化进这一个 Json 值，没有旁路列。写路径范式（拟实现，尚未接线，见 §4）：

```ts
// integration 写路径范式：connectionConfig 落库前在应用层对称加密，读回后解密。
// SoT 只有一列 connectionConfig Json?（无独立 iv/keyId 列），密文及其元数据整体
// 序列化进这一个 Json 值 -> DB 永不见明文。
type SealedSecret = { v: number; alg: string; iv: string; ct: string };

async function createDataSource(workspaceId: string, input: DataSourceInput) {
  const sealed: SealedSecret = seal(input.connectionConfig); // app 层加密，密钥来自 .env
  return prisma.dataSource.create({
    data: {
      workspaceId,
      name: input.name,
      type: input.type,
      connectionConfig: sealed as Prisma.InputJsonValue,
    },
  });
}

// 读路径：取出 Json -> unseal -> 仅在服务端内存使用，绝不回传浏览器。
```

约束：

- 明文连接信息（口令、token、私钥）**不得**以任何形式进入 `connectionConfig` 的 Json 明文，也不得写入 `name` / `type` 等旁列。
- 解密仅发生在服务端；`connectionConfig` 不进入任何客户端组件的返回值（与 [`data-110`](arda-data-110-isolation.md) 的"客户端不直连数据库"同源约束）。
- 加密密钥本身走 `.env` 运行时值（见 §3.4），不落库、不入 Git。

### 2.2 API 密钥：只存哈希（ApiKey.hashedKey）

Schema 层约束（SoT 原样）：

```prisma
model ApiKey {
  id            String    @id @default(cuid())
  workspaceId   String
  dataServiceId String?
  name          String
  hashedKey     String    @unique
  scopes        String[]
  lastUsedAt    DateTime?
  revoked       Boolean   @default(false)
  createdAt     DateTime  @default(now())

  service DataService? @relation(fields: [dataServiceId], references: [id], onDelete: SetNull)

  @@index([workspaceId])
}
```

约束要点：

- `hashedKey String @unique`：**全局唯一**（不带 `workspaceId` 前缀），因为校验时是拿入站密钥现算哈希去点查，天然按哈希空间去重。这是本 schema 里少数几个非 workspace 前缀的唯一约束之一（与 `AuditLog.idempotencyKey` 同类）。
- 明文密钥只在**铸造那一刻**返回一次，`ApiKey` 表里没有存明文的列 -> 之后任何界面都无法再回显，只能撤销重发。
- `scopes String[]`：授权范围（Postgres 原生数组列），校验通过后据此裁剪能力。
- `revoked Boolean @default(false)`：撤销是**软失效**（置位而非删行），保留审计与 `lastUsedAt` 轨迹；`onDelete: SetNull` 让所属 `DataService` 删除时密钥行仍在、只断关联。

代码范式（拟实现，尚未接线，见 §4）：

```ts
// admin 写路径范式：密钥只在铸造时明文返回一次，落库只存 hashedKey。
import { createHash, randomBytes } from "node:crypto";

async function mintApiKey(
  workspaceId: string,
  dataServiceId: string | null,
  name: string,
  scopes: string[],
) {
  const plaintext = "ak_" + base64url(randomBytes(32)); // 仅此一次可见
  const hashedKey = createHash("sha256").update(plaintext).digest("hex");
  await prisma.apiKey.create({
    data: { workspaceId, dataServiceId, name, hashedKey, scopes },
  });
  return plaintext; // 交给调用方展示一次；DB 里没有它
}

// 校验：入站密钥现算哈希 -> 按全局唯一 hashedKey 点查 -> 查 revoked/scopes。
// 因 hashedKey 全局唯一，findUnique 不需要 workspaceId；取回后再读 row.workspaceId。
async function verifyApiKey(presented: string) {
  const hashedKey = createHash("sha256").update(presented).digest("hex");
  const key = await prisma.apiKey.findUnique({ where: { hashedKey } });
  if (!key || key.revoked) return null;
  return key; // 携带 workspaceId + scopes，供下游按 [`data-110`](arda-data-110-isolation.md) 强制过滤
}
```

> `createHash("sha256")` / `randomBytes` / `base64url` 与仓库既有的 `app/auth/lib/pkce.ts`（OIDC PKCE 层）同一套 `node:crypto` 原语；密钥哈希应复用同一实现风格，避免各处自造。

### 2.3 敏感分级与脱敏（AssetLevel + Policy.type == "masking"）

分级枚举（SoT 原样）：

```prisma
/// Security classification of an asset (dataset-level in v1).
enum AssetLevel {
  public
  internal
  sensitive
  core
}
```

分级落在两个字段（SoT 原样摘录）：

```prisma
model Dataset {
  // ... 完整定义见 data-210
  classification AssetLevel @default(internal)
  // ...
}

model DataService {
  // ... 完整定义见 data-240
  level       AssetLevel @default(internal)
  // ...
}
```

脱敏策略载体（SoT 原样）：

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

分级与脱敏的关系：

- `AssetLevel` 是**有序敏感级**：`public < internal < sensitive < core`；`internal` 是 `Dataset.classification` 与 `DataService.level` 的默认。
- `Policy.type` 是自由字符串，注释枚举 `access | masking | retention | classification`；其中 **`type == "masking"`** 的策略专门承载脱敏规则，具体掩码列/方式存在 `config Json?` 里。
- `Policy.scope`（`dataset | tag | source`）决定这条 masking 策略作用于哪一类目标；`enabled` 为总开关。
- 判定链路（范式）：资产的 `classification` / `level` 越高（`sensitive` / `core`），越需要在导出/服务响应前套用匹配的 `masking` 策略。

读路径范式（拟实现，脱敏执行引擎尚未接线，见 §4）：

```ts
// governance 读路径范式：按资产分级 + masking 策略决定字段可见性。
const maskingPolicies = await prisma.policy.findMany({
  where: { workspaceId, type: "masking", enabled: true },
});
// sensitive/core 资产在导出或数据服务响应前，按 masking policy 的 config 掩码字段。
// 分级本身不加密数据，它是"该不该脱敏/该不该放行"的判定输入。
```

> 注意区分：`AssetLevel` / `masking` 是**访问期脱敏**（谁能看到什么），`connectionConfig` 加密与 `hashedKey` 哈希是**存储期保护**（DB 落地形态）。两者正交，均在本文范围内。

---

## 3. 逐表 / 逐字段落点

### 3.1 加密/哈希字段总表（与 SoT 逐字对齐）

| 表.字段 | SoT 类型/约束 | 加密/密钥落点 |
|---|---|---|
| `DataSource.connectionConfig` | `Json?` | 应用层加密后落库；密文与元数据整体在这一个 Json 值内，无独立 iv/keyId 列；DB 无明文 |
| `ApiKey.hashedKey` | `String @unique` | 仅存单向哈希（sha256 风格）；**全局唯一**，非 workspace 前缀；明文密钥不落库、不回显 |
| `ApiKey.scopes` | `String[]` | 授权范围（非密文）；校验通过后据此裁剪能力 |
| `ApiKey.revoked` | `Boolean @default(false)` | 撤销位（软失效，不删行）；置位即拒绝校验 |
| `ApiKey.lastUsedAt` | `DateTime?` | 使用轨迹（非密文）；供审计与陈旧密钥回收 |
| `ApiKey.dataServiceId` -> `service` | `String?` + `@relation(... onDelete: SetNull)` | 服务删除时断关联、保留密钥行与审计 |
| `Dataset.classification` | `AssetLevel @default(internal)` | 资产级敏感分级；masking/放行判定输入 |
| `DataService.level` | `AssetLevel @default(internal)` | 数据服务敏感分级；同上 |
| `Policy.type` | `String`（`access\|masking\|retention\|classification`） | `"masking"` 承载脱敏规则 |
| `Policy.scope` | `String`（`dataset\|tag\|source`） | masking 策略作用目标 |
| `Policy.config` | `Json?` | 具体掩码列/方式（脱敏规则体） |
| `Policy.enabled` | `Boolean @default(true)` | 策略总开关 |

> 未列入本表的字段（如 `Dataset.location`、`DataService.path`）**不承载密文**：SoT 没有把它们标为加密，本文也不追加加密语义。加密落点仅限上表。

### 3.2 分级枚举取值（AssetLevel）

| 值 | 语义（敏感度递增） | 默认落点 |
|---|---|---|
| `public` | 可公开 | - |
| `internal` | 内部（**默认**） | `Dataset.classification` / `DataService.level` 的 `@default(internal)` |
| `sensitive` | 敏感（触发脱敏考量） | - |
| `core` | 核心（最严） | - |

### 3.3 关联板块中的密钥/密文位置

| 板块（见 [`data-000`](arda-data-000-index.md) §3） | 表 | 本文关注点 |
|---|---|---|
| `integration`（[`data-220`](arda-data-220-integration.md) / [`biz-220`](arda-biz-220-integration.md)） | `DataSource` | `connectionConfig` 加密落库 |
| `governance`（[`data-230`](arda-data-230-governance.md) / [`biz-230`](arda-biz-230-governance.md)） | `Policy` | `type == "masking"` 脱敏；分级判定 |
| `services`（[`data-240`](arda-data-240-services.md)） | `DataService` | `level` 敏感分级 |
| `admin`（[`data-250`](arda-data-250-admin.md) / [`biz-250`](arda-biz-250-admin.md)） | `ApiKey` | `hashedKey` 哈希、`scopes`、`revoked` |
| `assets`（[`data-210`](arda-data-210-assets.md)） | `Dataset` | `classification` 敏感分级 |

### 3.4 运行时 secrets：不落 schema、不入 Git

连接串与凭据**不是** schema 字段，而是 `.env` 运行时值。SoT（`prisma/schema.prisma`）里的 `datasource db { provider = "postgresql" }` 不含内联连接串；连接信息由环境变量注入（见 [`data-100`](arda-data-100-architecture.md) §2 与 [`security.md`](../10-specs/security.md) "Secret Management"）。

| Secret（`.env` 键） | 用途 | 位置 / 约束（`.env.example` 为占位 schema） |
|---|---|---|
| `DATABASE_URL` | Prisma pg adapter + `migrate deploy` 的连接串（含库口令） | `.env`（服务器 `<ROOT_DIR>/etc/.env`）；`.env.example` 里是占位 `postgresql://arda:ChangeME@arda-db:5432/arda?schema=public` |
| `POSTGRES_PASSWORD` | Postgres 口令 | 同上；`.env.example` 占位 `ChangeME` |
| `OIDC_CLIENT_SECRET` | OIDC RP client secret（prod 用 `arda`、beta 用 `arda-beta`，各自独立） | 平台 secret manager 注入；`.env.example` 留空；从不 commit |
| `NODE_AUTH_TOKEN` | `@vxture` 私有包读令牌 | `.env` 或 CI secret；`.env.example` 留空 |

约束（来自 `CLAUDE.md` 仓库卫生 + `.env.example` 头注 + [`security.md`](../10-specs/security.md)）：

- `.env` / `.env.bak.*` 一律 git-ignored，并被契约扫描 `scripts/checks/06-check-deploy-contracts.py` 主动跳过；**真实 secret 绝不入 Git**。
- 服务器上 `.env` 位于 `<ROOT_DIR>/etc/.env`，在 rsync 目标之外，首次部署由 CI bootstrap 写入，后续部署不覆盖。
- `.env.example` 只是**可 source 的占位模板**：其中的 `ChangeME` 等值是 schema 说明，不是真值；契约检查还强制 `.env.example` 的值 bash-source 安全（含空格必须加引号）。
- prod 与 beta 是两个 OIDC client（`arda` / `arda-beta`），各带独立 `OIDC_CLIENT_SECRET`，隔离 token audience 与 secret 爆炸半径。

### 3.5 服务间鉴权（平台指令通道）：schema 已备、鉴权未接

平台 `seed / wipe / invalidate` 指令通道的**幂等与审计**落点是 `AuditLog.idempotencyKey`（全局唯一）与 `AuditLog` 表本身（详见 [`data-140`](arda-data-140-audit.md)）。但**服务间鉴权**（平台调用 arda 内部端点时的身份证明）**尚未实现**：

- 目标态（ADR §5.1）：服务间签名，候选为 API key / 服务 JWT / mTLS，具体形态待与平台确定。
- 现状：内部端点与其鉴权层都未落地 -> 见 [`data-300`](arda-data-300-migration.md) §4.3。
- 这与 §2.2 的 `ApiKey`（面向**外部调用方**的数据服务密钥）是两回事：`ApiKey` 是产品对外的服务鉴权；服务间鉴权是**平台 -> arda** 的内部控制面鉴权，后者无对应 schema 表。

---

## 4. 现状与目标态

交叉引用 [`data-300`](arda-data-300-migration.md)（迁移与实施）。当前 schema 版本 `0005_service_fields`：加密/密钥相关的**字段已就位**，但多数**写路径/执行逻辑尚未接线**。仓库中除 `app/auth/lib/pkce.ts`（OIDC PKCE）外，尚无领域侧加密/哈希调用点；`integration` / `security` / `service` 屏当前跑 seed/demo 数据，代码里没有 `prisma.dataSource` / `prisma.apiKey` 的写入调用。

| 能力 | 现状 | 目标态 | 参见 |
|---|---|---|---|
| `connectionConfig` 加密写路径 | 未实现（无 `prisma.dataSource` 写入点；集成屏走 seed/demo） | app 层对称加密 `seal/unseal`，密钥自 `.env` | §2.1 |
| `ApiKey` 铸造/校验 | 未实现（无 `prisma.apiKey` 调用；安全/服务屏 seed/demo） | 铸造一次性明文 + sha256 落 `hashedKey`；入站现算哈希点查 + `revoked`/`scopes` 判定 | §2.2 |
| 分级驱动的 masking 执行 | 字段已建（`classification` / `level` / `Policy(type=masking)`），脱敏执行引擎未接 | 读/导出路径按 `masking` 策略 `config` 掩码 | §2.3 |
| 运行时 secrets 注入 | 已就位（`.env` at `etc/.env`；`.env.example` 占位）；`OIDC_CLIENT_SECRET` 由平台注入 | 维持；无需建表 | §3.4 |
| 服务间鉴权（平台指令通道） | 未实现（内部端点 + 鉴权均未落地） | 服务签名（API key / 服务 JWT / mTLS）+ `AuditLog.idempotencyKey` 防重放 | [`data-140`](arda-data-140-audit.md)、[`data-300`](arda-data-300-migration.md) §4.3 |

> 结论：本文描述的是**契约与落点**（DB 落地形态与代码范式），其中 secrets 注入这一项已达标，其余加密/哈希/脱敏的执行链路是 `data-300` 追踪的待接项。schema 侧不欠字段，欠的是应用层写/读路径。

---

## 变更规程

1. 真源是 `portals/app/prisma/schema.prisma`；任何加密/密钥字段的增删改先改 SoT，再 `prisma migrate dev --name <desc>` 生成迁移。
2. 本文只描述 SoT 已有字段，**不得**为加密新增虚构列（如 `iv` / `keyId` / `salt`）；密文与元数据整体落既有 `Json?` / `String` 列。
3. 若加密算法、密钥来源或哈希算法变化，更新 §2 的代码范式与 §3.1 落点表，并同步 [`data-300`](arda-data-300-migration.md) 的现状/目标差距。
4. 分级枚举 `AssetLevel` 取值变化时，同步 [`data-100`](arda-data-100-architecture.md) §5 的枚举总览与本文 §3.2。
5. secrets 键增删同步 `.env.example`、[`security.md`](../10-specs/security.md) "Secret Management" 与本文 §3.4；真值绝不入 Git。
