# arda 数据架构 · 多-agent 数据归属与共享架构（arda-data-150-multiagent-sharing）

> 状态：权威设计（横切架构决策 + 模型；随 SoT 演进）
> 层：第 1 层 · 横切架构决策（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引 §1）
> 唯一 SoT：`portals/app/prisma/schema.prisma`（enum / 字段名 / 类型 / 默认值 / 索引以此为准；本文件只是其可读导览与决策沉淀）
> 上游：总体约束见 [`data-100`](arda-data-100-architecture.md) §4-6；隔离硬约束见 [`data-110`](arda-data-110-isolation.md)；受影响板块 schema 见 [`data-210`](arda-data-210-assets.md)（Dataset/GlossaryTerm）/ [`data-230`](arda-data-230-governance.md)（Standard）/ [`data-240`](arda-data-240-services.md)（DataService）/ [`data-250`](arda-data-250-admin.md)（ApiKey）/ [`data-260`](arda-data-260-infrastructure.md)（SeedTemplate）

---

## 1. 定位与背景

arda 的第一性场景已从「单租户内一个团队编目自己的数据」演进为**多个 agent 消费同一个 arda**：一个 workspace 内可能同时运行多个 agent（各自产出/发布数据），而单个 agent 又可能横跨多个 workspace 服务不同租户。数据由此变得**异构**（不同 agent 的数据结构、口径、质量各异）、**多产权**（同一 workspace 内需要区分「谁产出的」），并同时提出两个看似矛盾的诉求：

- **共享**：workspace 内多个 agent 要能互相发现、取用彼此的数据，而不是各自为政的数据孤岛。
- **治理**：共享必须可审计、可鉴权、可脱敏、可配额，且**绝不能击穿租户隔离**。

本篇是 `data` 系列第 1 层的横切**架构决策 + 模型**文档，沉淀「多-agent 数据归属与共享」的全部决策。它回答四个问题：数据**归谁**（三层归属）、**隔在哪**（workspace 硬轴）、**怎么共享**（发现 -> 取用 -> 回流 三段流）、**软治理轴如何叠加**（ownerApp / visibility / scope / consumerApp）。所有字段以 `portals/app/prisma/schema.prisma` 为准，本轮 schema 已按这些决策落地（均为向后兼容的加列）。

> 一句话定位：**org 是硬隔离边界，workspace 是默认软隔离边界，agent 是软治理轴；arda 只做元数据中介与网关，内容字节从不在 arda 静置，跨 workspace 默认不流动。**
>
> **【2026-07-13 修订】**本文件的「跨 workspace 永不流动 / 无 share-grant 原语」（原 D8）已被 owner 裁定**取代**：同 org 内可经资源级显式授权（`WorkspaceGrant`）跨 workspace 访问，权益不随授权流动，见 [`data-160`](arda-data-160-cross-workspace-authorization.md)。本文件下文的"永不流动"字样一律按"默认不流动，data-160 授权例外"理解；workspace 内多 agent 共享模型（本文件主体）不受影响。

---

## 2. 租户模型（workspace 隔离边界 + agent N-N）

隔离键仍是 `workspaceId`（= 平台/IdP 的 `active_workspace`），行级强制过滤不变（见 [`data-110`](arda-data-110-isolation.md)）。在此硬边界之上，引入 agent 作为**产权/消费方**维度：

- **workspace = 默认软隔离边界（org = 硬边界）**：一切业务行带 `workspaceId`，服务端 `where: { workspaceId }` 收口。跨 workspace 的数据可见性默认为零；唯一例外 = 同 org 内资源级显式授权（[`data-160`](arda-data-160-cross-workspace-authorization.md)）。
- **agent <-> workspace 是 N-N**：每个 agent 自身多租户、可横跨多个 workspace；每个 workspace 内可有多个 agent。
- **workspace 内多 agent 共享**：同一 workspace 内的多个 agent，通过 arda 互相发现与取用数据（受软治理轴约束），共享面止于 workspace 边界。

ASCII 拓扑（platform 只读层叠加在每个 workspace 之上；agent-2 同时在 A、B，体现 N-N；数据永不越 workspace 墙）：

```
                     platform 全局参考层  (AssetScope = platform)
              approved standards / admin-division codes / currency codes
                 workspaceId = "__platform__" (哨兵, 只读, 单一权威)
                                    |
             read overlay:  workspaceId IN (self, "__platform__")
             +----------------------+----------------------+
             |                                             |
   +-------------------------------+       +-------------------------------+
   |  workspace A  (硬隔离边界)     |       |  workspace B  (硬隔离边界)     |
   |  workspaceId = ws_A           |       |  workspaceId = ws_B           |
   |                               |       |                               |
   |   [agent-1]     [agent-2]-----|--///--|-----[agent-2]     [agent-3]   |
   |       \           /           |  墙   |        \            /         |
   |    arda 内共享(发现/取用)      |       |     arda 内共享(发现/取用)     |
   +-------------------------------+       +-------------------------------+

   agent-2 横跨 A、B (N-N)，但其在 A 产出的数据对 B 不可见：
   ///  = workspace 墙，数据默认不跨越 (跨越仅经 data-160 的显式 WorkspaceGrant，同 org 内)。
```

要点：agent-2 在 A、B 两个 workspace 内是**两条互不可见的产权线**。「agent 多租户」指的是同一 agent 身份被复用于多个 workspace，而**不是**它能把 A 的数据带到 B。跨 workspace 隔离由 `workspaceId` 兜底，与 agent 维度正交。

---

## 3. 三层数据归属

按「数据归谁、落在哪」把所有数据分成三层。前两层进 arda（受 `workspaceId` 隔离），第三层完全不进 arda。

| 层 | 归属 | 落点 | 可见性 | 谁可写 |
|---|---|---|---|---|
| **平台层** | arda 运营策展的全局参考数据 | arda（`scope=platform`，哨兵 `workspaceId="__platform__"`） | 全平台**只读**共享（叠加进每个 workspace 读） | 仅 ops/平台角色 |
| **租户层** | 租户/agent 产出的业务数据 | arda（`scope=workspace`，真实 `workspaceId`） | 隔离在 workspace 内，**workspace 内跨多 agent 共享** | workspace 内的 agent/用户 |
| **agent 私有** | 运行态/草稿/会话/向量/RAG 索引 | **不进 arda**（留在 agent 自身） | 仅该 agent | agent 自身 |

**平台层**是全局参考：通过评审的数据标准、行政区划码表、币种码 - 全平台单一权威、在位只读，运营改一次全平台生效。**租户层**是绝大多数业务数据：某 workspace 内某 agent 编目/发布的 Dataset、DataService 等，隔离在本 workspace，但本 workspace 内的其它 agent 可共享。**agent 私有**是 agent 的运行内部件（对话上下文、临时草稿、向量库、RAG 中间态），arda 不承载 - 它们既非需治理的资产，也不需要跨 agent 共享。

**可套用判定规则**（新数据进来时按此归层）：

```
这份数据是什么?
|
+- 是 arda 运营策展、需全平台单一权威、在位只读的参考数据(标准/码表/币种)?
|     -> 平台层:  scope=platform, workspaceId="__platform__", 仅 ops 可写
|
+- 是租户/agent 产出、需在 workspace 内被(其它)agent 发现或取用的业务资产?
|     -> 租户层:  scope=workspace, 真实 workspaceId, workspace 内共享
|
+- 是 agent 的运行态/草稿/会话/向量/RAG 等私有中间态?
      -> 不进 arda:  留在 agent 自身, arda 不建表、不承载
```

判定的两条硬边界：(1) **跨 workspace 需要共享 != 进平台层**。平台层只容纳 arda 运营亲自策展、全平台统一的权威参考；租户自己想跨 workspace 复用不构成进平台层的理由（跨 workspace 本就不流动，见 §5）。(2) **agent 私有态永不「顺手」进 arda**：只有需要被治理或被(其它 agent)取用的资产才编目进 arda。

---

## 4. 平台全局参考层设计

平台层是本轮唯一在隔离硬轴之外「向上叠加」的机制，需谨慎设计。它由四件事构成：`AssetScope` 枚举、`"__platform__"` 哨兵行、读叠加、ops 写角色门与升格流。

### 4.1 AssetScope 枚举与哨兵行

真源 `portals/app/prisma/schema.prisma`（原样）：

```prisma
enum AssetScope {
  workspace
  platform
}
```

`scope=platform` 的行用**保留哨兵** `workspaceId = "__platform__"` 落库。关键点：`workspaceId` 是普通索引列、**非外键**（见 [`data-110`](arda-data-110-isolation.md) §1），因此哨兵值不需要先存在一条 `WorkspaceRef` 行 - 它只是一个不与任何真实 workspace 撞车的保留字符串。schema 顶部 `AssetScope` 的注释即锁定此设计（SoT L41-52）：`platform` = arda-ops-curated 全局参考、对**所有** workspace 只读，`workspace` = 租户自有、隔离在本 workspace 内并只在其 agent 之间共享。

### 4.2 读叠加：workspaceId IN (self, "__platform__")

租户读取带 `scope` 的资产时，把过滤从「等于自己」放宽为「自己**或**平台哨兵」：

```
// 平台层资产的租户读路径 (概念式)
where: { workspaceId: { in: [session.workspaceId, "__platform__"] } }
```

这样每个 workspace 都能读到全平台统一的那份平台层参考，而写路径仍严格 `workspaceId = self`（租户无法写哨兵行）。**注意适用范围**：读叠加只对承载 `scope` 的表启用（本轮为 `GlossaryTerm`、`Standard`，见 §7）；其余业务表不引入哨兵、不放宽读过滤，隔离语义完全不变。

### 4.3 ops 写角色门

写 `scope=platform` 的行**只允许** ops/平台角色，永不允许租户用户。租户对平台层的能力是纯只读消费。这道门是平台层「单一权威、在位只读、运营改一次全平台生效」语义的保证 - 任何租户都不能污染或分叉全平台共享的那一份。

### 4.4 升格流：workspace-draft -> ops-approve -> platform-published

租户层数据要成为平台层参考，须走一条**升格流**，而非租户直接写平台：

```
[租户草稿]                 [运营评审]                  [平台发布]
scope=workspace     ->     ops-approve       ->      scope=platform
真实 workspaceId          (仅 ops 可执行)           workspaceId="__platform__"
```

举例：某 workspace 内沉淀出一套成熟的数据标准（`Standard`, `scope=workspace`, `status=draft/review`），经运营评审通过后，由 ops 升格为 `scope=platform` 的全平台标准；此后全平台只读共享，运营在这一份上维护。行政区划**码表**同理，作为全局参考 `Standard`（`scope=platform`）建立。这条流把「谁能定义全平台权威」牢牢收在 ops 手里，与 §4.3 的写门同源。

---

## 5. 共享模型（发现 -> 取用 -> 回流）

arda 在共享中的角色是 **broker/中介**：它持有的是**元数据与网关配置**，内容字节**从不在 arda 静置**。共享是一条三段流。

```
  (1) 发现 Discovery          (2) 取用 Consumption            (3) 回流 Promotion
  编目 Dataset(元数据)   ->   DataService 网关 + 鉴权/策略   ->   升格进平台层
  ownerApp 标注产出者        ApiKey/consumerApp 认证              workspace-draft
                             Policy access/masking                -> ops-approve
                             AuditLog + 配额                       -> platform-published
                             活代理/下推到属主 agent 的 API 端点
                                    |
                             内容字节: agent 端点 --(直达)--> 消费方
                             arda 只在旁路: 鉴权/策略/审计/计量, 不经手字节
```

- **(1) 发现**：agent 把可共享的数据以 **`Dataset`（仅元数据）** 编目进 arda，`Dataset.ownerApp` 标注产出它的 agent（产权 + 溯源）。workspace 内其它 agent 由此发现可用数据。arda 存的是目录条目，不是数据本身。
- **(2) 取用**：消费经 **`DataService` 网关**。网关职责：以 `ApiKey`（`consumerApp` = 消费方 agent 身份）**认证**；按 `Policy` 施加 **access/masking** 策略；写 **`AuditLog`**；执行**配额**。取用时 arda **活代理/下推**到属主 agent 的 API 端点 - 内容字节在属主 agent 端点与消费方之间直达，arda 只在旁路做鉴权、策略、审计、计量，**不经手、不静置字节**。
- **(3) 回流**：workspace 内成熟的数据可经 §4.4 的升格流上升为平台层参考（`draft -> approve -> published`）。

**两条不可逾越的边界**：

1. **跨 workspace 默认不流动**：本文件的共享三段流（agent 维度）**不含** share-grant——共享面止于 workspace 内的多个 agent。~~不存在「把 A workspace 的 Dataset 授权给 B workspace」的机制~~ **已取代（2026-07-13，owner 裁定）**：跨 workspace 的数据需求经**另一条独立机制**满足——同 org 内资源级 `WorkspaceGrant`（[`data-160`](arda-data-160-cross-workspace-authorization.md)），它不经过本节的 agent 共享流，也不放宽默认 force-filter。
2. **内容字节不入 arda**：arda 是编目 + 网关，不是数据湖。取用永远代理/下推到属主 agent 的端点，字节不落 arda。

---

## 6. 隔离与属主轴（硬轴 vs 软治理轴）

把「隔离」和「产权/可见性」拆成两组正交的轴，避免用软治理轴去承担隔离职责。

| 轴 | 字段 | 性质 | 作用 |
|---|---|---|---|
| **隔离主轴（不变；org 硬 / workspace 默认软）** | `workspaceId` | 强制行级过滤（默认路径），普通列非 FK | 隔离边界；一切安全性兜底于此（跨 ws 仅经 [`data-160`](arda-data-160-cross-workspace-authorization.md) 显式授权） |
| 软治理轴：产出/溯源 | `Dataset.ownerApp` / `DataService.ownerApp` | 可空标注 | workspace 内标记「哪个 agent 产出/发布」，产权 + 溯源 |
| 软治理轴：可见性 | `DataService.visibility` | 默认 `workspace` | `workspace` = 对 workspace 内所有 agent 共享；`owner` = 仅属主私有 |
| 软治理轴：归层 | `GlossaryTerm.scope` / `Standard.scope` | `AssetScope`，默认 `workspace` | 区分租户层 vs 平台层 |
| 软治理轴：消费身份 | `ApiKey.consumerApp` | 可空标注 | 消费方 agent 身份，用于审计 + 策略 |

**核心原则**：软治理轴**不是隔离机制**。`ownerApp`、`visibility`、`consumerApp` 决定的是「workspace 内谁产出、对谁可见、谁在消费」，它们细化 workspace **内部**的产权与共享粒度；一旦这些轴出现 bug 或被绕过，**`workspaceId` 硬轴仍然兜底**保证不跨租户泄露。安全边界永远是 `workspaceId`，软治理轴只在其内做产权治理。`visibility=owner` 是 workspace 内的私有降级（连本 workspace 的其它 agent 也不共享），不改变、也无法击穿 workspace 隔离。

---

## 7. schema 映射

本轮落地的字段（真源 `portals/app/prisma/schema.prisma`，逐字照抄相关片段；均为加列，可空或带默认，向后兼容）。

**AssetScope 枚举**（SoT L49-52）：

```prisma
enum AssetScope {
  workspace
  platform
}
```

**Dataset.ownerApp + 复合索引**（SoT L74-96，节选相关行）：

```prisma
model Dataset {
  // ...
  ownerUserId   String?
  // Producing agent/app within the workspace (attribution + provenance; NOT an
  // isolation axis - workspaceId is). Lets multiple agents in one workspace share
  // via arda while keeping "who produced this" first-class.
  ownerApp      String?
  // ...
  @@index([workspaceId, ownerApp])
}
```

**GlossaryTerm.scope**（SoT L121-133，节选）：

```prisma
model GlossaryTerm {
  // ...
  // platform = ops-approved global glossary shared to all workspaces (sentinel
  // workspaceId "__platform__"); workspace = tenant-local term.
  scope         AssetScope @default(workspace)
  // ...
}
```

**Standard.scope**（SoT L208-227，节选）：

```prisma
model Standard {
  // ...
  status      String   @default("draft") // published | draft | review
  // platform = ops-approved global reference (e.g. code sets like admin-division
  // codes), read-only to all workspaces via the "__platform__" sentinel; workspace
  // = tenant-local draft. Promotion workspace->platform is an ops action.
  scope       AssetScope @default(workspace)
  // ...
}
```

**DataService.ownerApp / visibility**（SoT L246-269，节选）：

```prisma
model DataService {
  // ...
  status      String     @default("draft") // draft | running | review | paused
  ownerApp    String?    // publishing agent/app within the workspace
  visibility  String     @default("workspace") // workspace = shared to all agents in the workspace; owner = private to the owner app
  // ...
}
```

**ApiKey.consumerApp**（SoT L285-300，节选）：

```prisma
model ApiKey {
  // ...
  name          String
  consumerApp   String?   // the agent/app this key authenticates as (consumer identity for audit + policy)
  hashedKey     String    @unique
  // ...
}
```

映射对照表：

| 决策面 | 字段 | 类型/默认 | 板块文档 |
|---|---|---|---|
| 归属枚举 | `AssetScope { workspace, platform }` | enum | [`data-210`](arda-data-210-assets.md) / [`data-230`](arda-data-230-governance.md) |
| 数据集产权/溯源 | `Dataset.ownerApp` | `String?`，`@@index([workspaceId, ownerApp])` | [`data-210`](arda-data-210-assets.md) |
| 术语归层 | `GlossaryTerm.scope` | `AssetScope @default(workspace)` | [`data-210`](arda-data-210-assets.md) |
| 标准归层 | `Standard.scope` | `AssetScope @default(workspace)` | [`data-230`](arda-data-230-governance.md) |
| 服务发布者 | `DataService.ownerApp` | `String?` | [`data-240`](arda-data-240-services.md) |
| 服务可见性 | `DataService.visibility` | `String @default("workspace")` | [`data-240`](arda-data-240-services.md) |
| 消费方身份 | `ApiKey.consumerApp` | `String?` | [`data-250`](arda-data-250-admin.md) |

---

## 8. 边界与关联

厘清本设计**不**覆盖的相邻概念，避免混淆。

- **GIS 几何在 arda 之外**：地图/GIS 几何、3D、IoT 孪生**不进 arda**（scope 排除）。它们由另一个平台级产品持有；arda/agent 经服务调用取用几何。**唯一例外**：行政区划**码表**（代码 + 名称层级，非几何）作为全局参考 `Standard`（`scope=platform`）进 arda。即「码表进、几何不进」。
- **SeedTemplate 是不同维度，严禁与平台层混淆**：`SeedTemplate` 是**租户样例 bootstrap** - onboarding 时**一次性拷入**新 workspace，拷后归租户各持一份、各自演化（见 [`data-260`](arda-data-260-infrastructure.md)）。它与平台层（Tier P 全局参考：在位只读、单一权威、运营改一次全平台生效）是**正交的两个维度**：前者是「拷贝分发、拷后属租户」，后者是「在位共享、恒属平台」。切勿把「全局只读模板」等同于「全局只读参考」。
- **未来待建（runtime，非本轮 schema）**：本轮只落地归属/共享的**数据模型加列**。以下执行态尚未建：`DataService` 网关执行、`Policy` masking 引擎、`AuditLog` 写入点、`ApiKey` 铸造/校验、配额（quota）。列级 `Field`（列级脱敏的前置）仍为 `future`（见 [`data-100`](arda-data-100-architecture.md) §5）。这些是 §5 三段流的运行时落地，届时另立文档。

---

## 9. 决策记录

- **D1**：workspace = 隔离边界（org 硬 / workspace 默认软，2026-07-13 起语义见 D14），`workspaceId` 行级强制过滤不变；一切安全性兜底于此。
- **D2**：agent 与 workspace 是 N-N - 每个 agent 自身多租户、横跨多 workspace，每个 workspace 内可有多个 agent。
- **D3**：三层数据归属 - 平台层（`scope=platform`）/ 租户层（`scope=workspace`）/ agent 私有（运行态/草稿/会话/向量/RAG，完全不进 arda）。
- **D4**：平台层用保留哨兵 `workspaceId="__platform__"`（普通列非 FK，无需 WorkspaceRef 行），租户读叠加 `workspaceId IN (self, "__platform__")`，写 `scope=platform` 仅 ops/平台角色。
- **D5**：平台层经升格流 `workspace-draft -> ops-approve -> platform-published` 产生，租户不得直写平台层。
- **D6**：arda 是 broker/中介，内容字节从不在 arda 静置；取用永远活代理/下推到属主 agent 的 API 端点。
- **D7**：共享是三段流 - 发现（编目 `Dataset`）-> 取用（`DataService` 网关 + `ApiKey`/`consumerApp` 认证 + `Policy` access/masking + `AuditLog` + 配额）-> 回流升格。
- **D8**：~~跨 workspace 永不流动 - 无 share-grant 原语（有意被设计掉，最大简化）；共享面止于 workspace 内多 agent。~~ **已取代（2026-07-13，owner 裁定，见 [`data-160`](arda-data-160-cross-workspace-authorization.md) 与 D14）**。
- **D14**（取代 D8）：跨 workspace **默认**不流动；同 org 内可经资源级显式授权（`WorkspaceGrant`，workspace -> workspace，先 `DataService` 后 `Dataset`）跨 workspace 只读访问。org 为硬边界（grant 绝不跨 org）；权益不随授权流动（门控/配额按消费方 active workspace 自己的订阅求值）；授权读路径走独立 grant-join helper，不放宽 [`data-110`](arda-data-110-isolation.md) 默认 force-filter。本文件的 agent 共享流（workspace 内）与该机制正交。
- **D9**：属主/可见性轴是软治理轴非隔离轴 - `Dataset.ownerApp` / `DataService.ownerApp`（产出/溯源）、`DataService.visibility`（`workspace` 共享 / `owner` 私有）、`GlossaryTerm.scope` / `Standard.scope`（归层）、`ApiKey.consumerApp`（消费身份）；隔离由 `workspaceId` 兜底。
- **D10**：地图/GIS 几何不进 arda（scope 排除 GIS/3D/IoT 孪生），由外部平台级产品持有经服务调用；仅行政区划**码表**（代码 + 名称层级）作为全局参考 `Standard`（`scope=platform`）进 arda。
- **D11**：`SeedTemplate`（租户样例 bootstrap，onboarding 一次性拷入、拷后归租户各一份）与 Tier P 全局参考（在位只读、单一权威、运营改一次全平台生效）是**不同维度**，严禁混淆。
- **D12**：schema 已落地（真源 `portals/app/prisma/schema.prisma`）：`enum AssetScope`、`Dataset.ownerApp` + `@@index([workspaceId, ownerApp])`、`GlossaryTerm.scope`、`Standard.scope`、`DataService.ownerApp` + `DataService.visibility`、`ApiKey.consumerApp`；均为加列（可空/带默认），向后兼容。
- **D13**：未来待建的 runtime（`DataService` 网关执行、`Policy` masking 引擎、`AuditLog` 写入点、`ApiKey` 铸造/校验、配额）与列级 `Field` 不在本轮 schema 范围，届时另立文档。

---

## 变更规程

1. 真源永远是 `portals/app/prisma/schema.prisma`；本文件是其可读导览与决策沉淀，任何 enum / 字段 / 默认值 / 索引以 SoT 为准。
2. 调整归属/共享模型（新增 `scope`/`ownerApp`/`visibility`/`consumerApp` 的承载表、改哨兵语义、改读叠加范围）时：先改 SoT，再同步本文件 §6-7 与对应板块 schema（[`data-210`](arda-data-210-assets.md) / [`data-230`](arda-data-230-governance.md) / [`data-240`](arda-data-240-services.md) / [`data-250`](arda-data-250-admin.md)）。
3. 隔离硬轴（`workspaceId`）的任何改动一律回到 [`data-110`](arda-data-110-isolation.md)，本文件不复制其规则、只引用。
4. 运行时落地（网关执行 / masking / 审计写入 / ApiKey 铸造校验 / 配额 / 列级 `Field`）成熟时另立文档，并在此 §8「未来待建」处补链。
5. 决策增删改（§9 的 D1..Dn）须保留编号连续与一句话粒度，重大反转应在 [`decisions/00-index.md`](decisions/00-index.md) 留痕并回链本文件。
