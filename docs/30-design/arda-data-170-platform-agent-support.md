# arda 数据架构 · arda 数据平台对 agent 的支撑契约（arda-data-platform-agent-support）

> 状态：权威设计 · 对外契约 spec（目标态契约；多数不变量的执行链路尚未实现，见 §6）
> 层：arda 数据域 · 对外消费契约（`data` 系列命名 spec，见 [`data-000`](arda-data-000-index.md) 索引）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（涉及的字段/枚举/默认值以 SoT 逐字为准；本文只是消费契约的可读约定，不新增 SoT 中不存在的字段）
> 上游/兄弟：总体 [`data-100`](arda-data-100-architecture.md)；多智能体共享与数据归属层 [`data-150`](arda-data-150-multiagent-sharing.md)；服务板块 [`data-240`](arda-data-240-services.md)；管理板块 [`data-250`](arda-data-250-admin.md)；治理板块 [`data-230`](arda-data-230-governance.md)；现状 [`data-300`](arda-data-300-migration.md)；业务面消费者 [`biz-100`](arda-biz-100-architecture.md) / [`biz-240`](arda-biz-240-services.md) / [`biz-435`](arda-biz-435-security.md)

---

## 0. 范围与定位（先读）

本文是 arda 作为**数据平台**对外的**消费契约**：钉死「一个跨 workspace 多租户的 agent 如何从 arda 取用数据，以及 arda 中介层在取用路径上必须强制的不变量」。它是若干业务文档（[`biz-100`](arda-biz-100-architecture.md)、[`biz-240`](arda-biz-240-services.md)、[`biz-434`](arda-biz-434-lineage.md)、[`biz-435`](arda-biz-435-security.md)、[`biz-441`](arda-biz-441-services.md)、[`biz-000`](arda-biz-000-index.md)）引用的对外契约锚点。

**两侧角色**

| 角色 | 是什么 | 职责边界 |
|---|---|---|
| **arda** | 数据域 provider | 数据资产**编目**（`Dataset`）、治理（分级/策略/质量/血缘）、对外**服务网关**（`DataService` + `ApiKey`）、审计（`AuditLog`）。arda 是数据的 **broker/中介** |
| **agent** | 消费方 | 在某个 workspace 上下文里，经 arda 的服务端点发现与取用数据；也可作为**属主**在 workspace 内产出/发布数据 |

**arda 明确不做**（属其他产品与 agent 自身，绝不进 arda）：

- **kb / RAG / 向量检索 / LLM 编排 / 会话**：知识库、检索增强、embedding、对话与推理编排是其它产品的职责。
- **agent 私有运行态 / 草稿 / 会话 / 向量 / RAG 语料**：完全不进 arda 持久层。
- **内容字节静置**：arda 是中介，**数据内容字节从不在 arda 静置**。取用是活代理/下推到属主 agent 的 API 端点（见 §1），arda 侧只持有**编目元数据 + 治理 + 审计**。

**租户模型（隔离前提，详见 [`data-110`](arda-data-110-isolation.md) / [`data-150`](arda-data-150-multiagent-sharing.md)）**

- `org` = **硬隔离边界**（绝不跨）；`workspace` = **默认软隔离边界**（`workspaceId` 行级 force-filter，全 schema 不变量；owner 裁定 2026-07-13）。
- `agent` 与 `workspace` 是 **N-N**：每个 agent 自身多租户、横跨多个 workspace；每个 workspace 内可有多个 agent，经 arda 在 **workspace 内**互相共享数据。
- **跨 workspace 默认不流动**：agent 共享面止于同一 workspace 内。跨 workspace 访问仅经同 org 内资源级显式授权（`WorkspaceGrant`，见 [`data-160`](arda-data-160-cross-workspace-authorization.md)），与 agent 共享流正交。

**三段流（概览，全模型见 [`data-150`](arda-data-150-multiagent-sharing.md)）**

> **发现**（编目 `Dataset`）
> -> **取用**（`DataService` 网关 + `ApiKey`/consumerApp 认证 + Policy access/masking + AuditLog + 配额）
> -> **回流升格**（workspace-draft -> ops-approve -> platform-published，只对全局参考数据）

---

## 1. 消费契约（agent 如何取用）

### 1.1 取用入口：DataService 端点

agent 不直连 arda 的库，也不直接读 `Dataset` 表；一切取用经 `DataService`（数据服务，见 [`data-240`](arda-data-240-services.md)）暴露的端点。SoT 关键字段（逐字）：

```prisma
model DataService {
  id          String     @id @default(cuid())
  workspaceId String
  code        String // display id, e.g. API-1042
  name        String
  path        String // e.g. /api/v2/customer/verify
  method      String     @default("GET") // GET | POST
  // ...
  level       AssetLevel @default(internal)
  type        String // rest_api | query | export | share
  // ...
  status      String     @default("draft") // draft | running | review | paused
  ownerApp    String?    // publishing agent/app within the workspace
  visibility  String     @default("workspace") // workspace = shared to all agents in the workspace; owner = private to the owner app
  // ...
  datasets DataServiceDataset[]
  apiKeys  ApiKey[]
}
```

- 端点由 `path` + `method`（`GET | POST`）标识；`type` 取 `rest_api | query | export | share`。
- 服务背后关联的数据集经 `DataServiceDataset`（M:N）挂接，但 **arda 只中介、不搬运字节**：取用在目标态是活代理/下推到属主 agent 的 API 端点，arda 承担认证、策略、审计、配额，不缓存内容。
- 只有 `status` 为可服务态（如 `running`）且对调用方**可见**（§3 的 `visibility`）的服务才可被取用。

### 1.2 认证：ApiKey（hashedKey + scopes + consumerApp）

调用方持 `ApiKey` 认证。SoT 关键字段（逐字）：

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
  // ...
}
```

- **`hashedKey`（全局唯一）**：库里只存哈希，不存明文；铸造时下发一次明文，之后只按哈希校验。
- **`scopes`**：该 key 的作用域集合，界定其可调用哪些服务/操作。
- **`consumerApp`**：这把 key 认证成的**消费方 agent 身份**，是审计（`AuditLog.actor`）与策略（`Policy`）评估的一等输入。
- **`revoked`**：撤销标志；已撤销的 key 一律拒绝。
- key 绑定到 `dataServiceId`（可空）与 `workspaceId`，取用请求因此天然带上 workspace 与服务上下文。

### 1.3 请求上下文与响应形状

- **请求必带 workspace 上下文**：取用请求解析出的 `workspaceId`（来自 key 绑定 / 平台上下文）是后续所有不变量（§2）的收口键，agent 不能自选或伪造。
- **消费方身份**：`consumerApp` 从 `ApiKey.consumerApp` 取得，贯穿策略评估与审计落点。
- **响应形状（目标态）**：响应体为按策略过滤/脱敏后的数据，并**承接分级与来源** - 即响应需携带数据的分级（`AssetLevel`）与来源（血缘 `LineageEdge` / `ownerApp`）标识，使消费方 agent 继续沿数据传递分级与溯源。响应如何在头/字段上承载分级与来源属**待确认**项（与 [`biz-240`](arda-biz-240-services.md) 的开放问题同源），落地时在本节补充；SoT 目前不含专门的响应形状字段，本节不虚构。

---

## 2. 不变量（invariants，中介层必须强制）

以下五条是 arda 中介层在**每一次取用路径**上必须成立的门控不变量。它们是 arda 的差异化控制面（对内标注可信度，对外按分级脱敏、随数据传递来源，见 [`biz-100`](arda-biz-100-architecture.md)）。当前多数为**目标态**（执行链路未建，见 §6）。

**① workspace 隔离（force-filter）**

- 服务端一切查询强制 `where: { workspaceId }` 收口（隔离主约束，见 [`data-110`](arda-data-110-isolation.md)）。取用只能命中请求上下文里的 `workspaceId`。
- **跨 workspace 默认不流动**：一个 workspace 的服务默认不可被另一 workspace 的调用方取用；唯一例外 = 同 org 内对该服务的显式 `WorkspaceGrant`（[`data-160`](arda-data-160-cross-workspace-authorization.md)；grant 校验在网关处执行，源 ws 的 Policy 照常施加）。隔离底线不因 `ownerApp` / `visibility`（§3，属主/可见性轴，非隔离轴）而松动。

**② entitlement 校验**

- 取用前校验 `(workspace, product=arda)` 的订阅/权益。权益是**平台侧唯一 SoT**，arda **不建镜像表**，从 token claim 或平台只读端点 live 求值（见 [`data-100`](arda-data-100-architecture.md) §6 边界表）。
- **有效 arda 权益的两种来源，取用路径一视同仁**（`ADR-11` §11.3 就高合并）：
  - **单独订阅（standalone）**：workspace 直接订阅 arda（任一档），既得产品 UI 又得数据取用。
  - **附带（bundled，旧称 standard）**：workspace **未单独订阅 arda**，但其订阅的某 agent Plan 含一个 `component_role=bundled` 的 arda 组件（product_220 §2）——arda 从**后台**支撑该 agent 的数据取用，**不提供 arda 产品 UI**。这正是"agent 需要数据支持"的场景：C2 对该 workspace 返回 **`bundled: true`**（布尔，正交于 tier；tier 仍五档|null），取用闸门放行。bundled 组件**独立配额**、当前 ≈ free、**`member.max=0`**（后台无人类席位）。权威模型见 `product_220` + `plat-210`。
- **无任何 arda 权益**（既无单独订阅、也无附带）的 workspace（C2 `status=none`），其服务不可被取用。
- 换言之：**产品 UI 门控要求单独订阅（active）；数据取用门控接受 bundled 或单独订阅**——两条门的权益管理模式一致，只是 bundled 不解锁 UI。

**③ Policy access + masking（egress 脱敏）**

- 取用经 `Policy` 评估：`access` 决定放行/拒绝，`masking` 决定**出口脱敏**。SoT：`Policy.type // access | masking | retention | classification`，`Policy.scope // dataset | tag | source`，规则参数在 `Policy.config`（Json）。
- **分级随数据流出**：数据的 `AssetLevel { public | internal | sensitive | core }`（`Dataset.classification` / `DataService.level`）在出口决定脱敏强度，并随响应传递给消费方（承接分级，见 §1.3 与 [`biz-435`](arda-biz-435-security.md)）。
- **列级脱敏是前置未来**：列级 `Field` 与列级 masking 未建模（`future`），当前策略与分级止于数据集/服务级。

**④ AuditLog（每次访问落审计）**

- 每次取用落一行 `AuditLog`。SoT：`actor String // a user id or "platform"`，`action`，`target`，`idempotencyKey String? @unique`，`metadata Json?`。
- **actor 语义**：取用场景 `actor` 取消费方 agent 身份（即 `ApiKey.consumerApp`）；平台自身发起的动作取字面量 `"platform"`。
- 审计去关系化、幂等键全局唯一，工程语义见 [`data-140`](arda-data-140-audit.md)。

**⑤ 配额 / quota**

- 取用受配额约束（按 workspace / consumerApp / 服务的调用量与速率）。**SoT 当前无配额表/字段**，属目标态运行时（见 §6），本文不虚构其存储形状。

---

## 3. 数据归属与可见性（三层 scope + 属主/可见性轴）

隔离由 `workspaceId` 兜底（§2①）；在隔离之上，归属与可见性是**溯源 + 共享范围**轴，不是隔离轴。

### 3.1 三层数据归属

| 层 | scope | 内容 | 谁可写 | 谁可读 |
|---|---|---|---|---|
| **平台层** | `scope=platform` | arda 运营策展的全局参考（通过的数据标准、行政区划码表、币种码、全局术语） | 仅运营/平台角色 | 全平台只读共享（§4） |
| **租户层** | `scope=workspace` | 租户/agent 产出的数据，隔离在 workspace 内 | workspace 内的 agent/用户 | workspace 内跨多个 agent 共享 |
| **agent 私有** | 不进 arda | 运行态/草稿/会话/向量/RAG | agent 自身 | 不适用（arda 不持有） |

SoT 归属枚举（逐字）：

```prisma
enum AssetScope {
  workspace
  platform
}
```

`GlossaryTerm.scope` 与 `Standard.scope` 均为 `AssetScope @default(workspace)`（见 [`data-230`](arda-data-230-governance.md)）。

### 3.2 属主与可见性（溯源，非隔离）

- **`ownerApp`（溯源）**：`Dataset.ownerApp` / `DataService.ownerApp` 标记 **workspace 内产出/发布该资产的 agent/app 身份**，是归属 + 溯源，**不是隔离键**（隔离仍由 `workspaceId` 兜底）。它让同一 workspace 内多个 agent 经 arda 共享，同时保住「谁产出了这个」为一等信息。`Dataset` 配 `@@index([workspaceId, ownerApp])` 支撑按属主检索。
- **`DataService.visibility`（共享范围）**：`String @default("workspace")`，取值 `workspace`（对 workspace 内**所有 agent** 共享）| `owner`（仅属主 `ownerApp` 私有）。这是 workspace **内部**的可见性收窄，不越 workspace 边界。
- **`ApiKey.consumerApp`（消费方身份）**：取用方 agent 身份，用于审计（§2④）与策略（§2③）评估。

> 三轴合看：`workspaceId` = 能不能进（硬隔离）；`visibility` = workspace 内谁能看；`ownerApp` / `consumerApp` = 谁产出 / 谁消费（溯源与审计）。全模型见 [`data-150`](arda-data-150-multiagent-sharing.md)。

---

## 4. 平台全局参考的消费（scope=platform）

平台层是 arda 运营策展、**全平台只读共享**的全局参考数据（数据标准、行政区划码表、币种码、全局术语）。

- **在位只读、单一权威**：运营改一次，全平台生效。承载表如 `Standard`（`scope=platform`，如 ISO 3166 类代码集）、`GlossaryTerm`（`scope=platform` 的全局术语）。
- **平台全局行 workspaceId**：平台行用显式轴 `workspaceId = NULL`（NULL=平台全局）。`workspaceId` 是**普通索引列、非 FK**，平台行无需先有 `WorkspaceRef` 行即可存在（见 [`data-110`](arda-data-110-isolation.md)）。
- **只读叠加**：租户读取时叠加 `workspaceId = self OR workspaceId IS NULL` - 既拿到本 workspace 的租户数据，又拿到平台全局参考，且平台行对租户只读。
- **写权限**：写 `scope=platform` 行需要运营/平台角色，**永不由租户用户**发起。
- **升格流**：一条数据从租户草稿升为全局参考走 `workspace-draft -> ops-approve -> platform-published`（租户起草 -> 运营审核 -> 平台发布）；这是数据进入 `platform` 层的**唯一路径**——跨 workspace 授权（[`data-160`](arda-data-160-cross-workspace-authorization.md)）是点对点访问，不使数据进入平台层。

**辨析：SeedTemplate ≠ Tier-P 全局参考（严禁混淆）**

| 维度 | Tier-P 全局参考（`scope=platform`） | SeedTemplate（租户样例 bootstrap） |
|---|---|---|
| 语义 | 在位只读、单一权威，运营改一次全平台生效 | onboarding 时**一次性拷入**新 workspace，拷后归租户**各一份** |
| 归属 | 平台层，`workspaceId=NULL` | 拷贝后是 `scope=workspace` 的租户数据 |
| 表 | `Standard` / `GlossaryTerm`（`scope=platform`） | `SeedTemplate` / `TemplateVersion`（见 [`data-260`](arda-data-260-infrastructure.md)） |

二者是**不同维度**：全局参考是共享的单一权威，样例模板是拷贝出的租户副本。

---

## 5. 外部平台服务（地图/GIS 等，arda 不持几何）

arda 的 scope **排除** GIS / 3D / IoT 孪生的**几何数据**：

- **几何不进 arda**：地图/GIS 的几何由**另一平台级产品**持有；arda 与 agent 经**服务调用**取用，arda 不落几何字节。
- **仅可编目指针**：arda 可对外部数据集/服务做**编目**（`Dataset` / `DataService` 记录名称、位置、指针、分级等元数据），内容仍在外部产品；这与「不静置内容字节」的中介定位一致。
- **行政区划码表例外**：只有行政区划的**码表**（代码 + 名称层级，非几何）进 arda，建为全局参考（`Standard`，`scope=platform`，见 §4）。
- **两种取用路径**：agent 可**直接调**外部服务，或**经 arda 中介**（用 `DataService` 下推到外部端点，从而复用 §2 的认证/策略/审计/配额不变量）。

---

## 6. 现状 vs 目标（本 spec 是目标契约）

本 spec 描述的是**目标态对外契约**。当前 schema 已备**字段/枚举**，但取用路径上的**执行链路多数未建**。现状交叉 [`data-300`](arda-data-300-migration.md)。

| 不变量 / 能力 | schema 落点（已建） | 执行链路（现状） |
|---|---|---|
| DataService 网关取用 | `DataService`（path/method/type/status/visibility）、`DataServiceDataset` | **未建**（无网关执行/下推） |
| ApiKey 认证 | `ApiKey`（`hashedKey @unique`、`scopes`、`consumerApp`、`revoked`） | **未建**（无铸造/校验调用点） |
| Policy access | `Policy.type=access` | **未建**（无评估引擎） |
| Policy masking（egress 脱敏） | `Policy.type=masking`、`AssetLevel` 分级 | **未建**（无 masking 引擎；列级 `Field` 仍 `future`） |
| AuditLog（每次访问落审计） | `AuditLog`（`actor` / `idempotencyKey @unique`） | **未建**（表在，无写入调用点，见 [`data-140`](arda-data-140-audit.md) §4） |
| entitlement 校验 | 无表（平台 SoT，claim/端点 live 读） | **部分**（门控读 claim；实时端点为目标态，[`data-100`](arda-data-100-architecture.md) §6） |
| 配额 / quota | **无字段/表** | **未建**（目标态运行时） |
| 三层 scope / 归属 / 可见性 | `AssetScope`、`*.scope`、`ownerApp`、`visibility`、`consumerApp` | 字段已备；策略/审计据其求值待建 |

**一句话定性**：字段层（scope / ownerApp / visibility / consumerApp / hashedKey / AuditLog / idempotencyKey / Policy）**已就位**；缺的是**网关执行、Policy 评估与 masking 引擎、ApiKey 铸造与校验、AuditLog 写入点、配额**。本文是这些链路落地时必须满足的目标契约。

---

## 变更规程

- **真源在 SoT。** 本文涉及的任何字段、类型、默认值、枚举（`AssetScope`、`AssetLevel`、`DataService.visibility`、`ApiKey.consumerApp`、`*.ownerApp`、`*.scope`、`AuditLog.actor` 等）一律以 `portals/app/prisma/schema.prisma` 逐字为准；改 schema 后回填本文，保持一致。
- **本文是契约，不是表结构。** 逐字段结构说明在板块 schema（[`data-240`](arda-data-240-services.md) 服务 / [`data-250`](arda-data-250-admin.md) 管理 / [`data-230`](arda-data-230-governance.md) 治理）；共享与归属模型在 [`data-150`](arda-data-150-multiagent-sharing.md)；本文只承载对外消费契约与不变量。
- **不虚构。** 未建的运行时（网关/masking 引擎/审计写入/配额/列级 `Field`）不在 SoT 造字段；§1.3 的响应形状与 §2⑤ 的配额为目标态占位，落地时依 SoT 补齐。
- **现状随链路更新。** §6 与 [`data-300`](arda-data-300-migration.md) 同源；每接通一条链路，两处一并更新。
