# 架构设计说明：订阅权益模型 + workspace 隔离 + 模板填充

> 状态：设计定稿 v2（五项承重决策已闭合，与 arda 代码现状对齐）
> 范围：arda（及同类产品）的用户分层、订阅权益与体验数据策略
> 用途：作为 AI coding（Claude Code / Codex）的实现输入

---

## 0. 与代码现状的前置说明（务必先读）

经核对 arda 当前状态：**arda 目前没有数据层**（Redis-only，仅存 session/token，无 Prisma / 无 DB），且 tier 当前来自 **OIDC token claim**。

两点关键澄清，决定数据层的真实形态：

1. **权益不需要在 arda 建表。** vxture 平台是订阅/权益的唯一 SoT，arda 采用「实时拉取 + 缓存 + 失效通知」获取权益（见 §3.5），**不落 Subscription 镜像表**。权益在 arda 侧退回为「类 claim 的轻量只读」。
2. **arda 数据层的真正驱动力是领域业务数据，不是权益。** vxture-console 只管订阅/付费/授权/账单；**所有业务数据（数据源、数据集、AI 写作项目/上下文、模板 seed 内容等）都在产品端（arda/ardb/…）**。因此引入 DB 的前置依赖是「先定义 arda 的领域数据模型」（见 §4 与 §9），而非权益。

> 净结论：arda 仍需引入持久层，但它服务于领域业务数据；权益只搭便车式地通过实时通道获取，不增加表。

---

## 1. 背景与决策

用户侧只存在一个生产系统（prod / arda）。"公测 vs 正式"的差异不用部署环境表达，而用**订阅状态（state）+ 权益档位（tier）**表达。原 `beta-arda` 部署环境**彻底降级为内部预发布与对外演示**，最终用户不接触，"beta" 一词不进入任何用户面向的数据模型。

**租户与权益层级**

- **Org**：组织容器，聚合成员。不直接持有权益。
- **Workspace**：隔离容器，是数据隔离的最小单位（隔离键 = `workspaceId`）。常态下 org : workspace = 1 : 1，多 workspace 为特殊场景的扩展，数据模型与门控**必须按 1 : N 设计**。
  **【2026-07-13 owner 裁定修正】**隔离分两级：**org（tenant）= 硬隔离**（绝不跨）；**workspace = 默认软隔离**——业务数据默认按 `workspaceId` 强过滤，但同 org 内可经显式授权跨 workspace 访问（资源级 `WorkspaceGrant`，见 [`data-160`](../arda-data-160-cross-workspace-authorization.md)）。**订阅权益不受此影响**：权益归属 workspace 并严格隔离，授权访问不携带、不合并权益（门控/配额永远按消费方 active workspace 自己的订阅求值）。
- **Subscription**：权益/订阅的承载单位，粒度 = **(workspace, product)**。同一 workspace 下不同产品可各自订阅不同档位（如 arda=free、forge=pro、raven=enterprise）。

**核心原则**

1. 一个 IdP、一个账号、一个生产 OIDC client（arda）。身份层不因分层/版本变化而改动。
2. 数据始终落在可靠的 prod 级存储。分层是状态标记，不是物理隔离。
3. "公测满意 → 升级正式" = 一次**订阅状态/档位变更**，数据**原地延续、零迁移、零重新登录**。
4. 不满意 → workspace 业务数据删除（由平台触发，arda 静默执行），不涉及跨环境搬运。
5. 沿用既有隔离：所有业务数据查询强制按 `workspaceId` 过滤，本设计不破坏此约束。
6. **workspace 的创建/克隆/删除归 vxture 平台**；arda 不拥有 workspace 生命周期，只镜像并响应平台指令。
7. **数据所有权边界（SoR 分工）**：vxture-console 只持有订阅 / 付费 / 授权 / 账单；**业务数据全部在产品端（arda/ardb/…）**。两侧仅通过「workspaceId 隔离键」+「(workspace,product) 订阅行」两个契约耦合，互不持有对方的数据。

---

## 2. 两个独立机制

| 机制 | 解决的问题 | 落点 |
|---|---|---|
| 订阅权益（state × tier，按产品） | 公测/正式的功能、配额、SLA 差异；平滑升级 | Subscription 条目 + feature 门控 |
| 模板数据填充 | 用户不想灌自己数据，想用平台预置数据体验 | arda 侧把模板数据克隆进 workspace |

二者正交，但在"升级时数据延续"这一点上自然衔接：体验阶段为 `state=trial`，满意后转 `subscribed` / 调整 tier，其内数据（含基于预置数据的衍生创作）平滑延续。

---

## 3. 订阅权益模型（state × tier，按产品）

### 3.1 两个正交的轴

- **state（订阅生命周期状态）**：回答"该订阅处于什么阶段"。
  `state = trial | subscribed | expired | none`
  - `none`：无订阅关系（注册了但未订阅、未试用）。
  - `trial`：试用中。
  - `subscribed`：正式订阅。
  - `expired`：订阅过期 → 能力回落 free（不删数据）。
- **tier（权益档位）**：回答"享受哪一档功能与配额"。
  `tier = free | starter | pro | business | enterprise`
  - `free` 是最低档，不进入 state；过期（expired）即回落 free。

组合示例：
- `state=none + tier=free`：未订阅，享 free 档。
- `state=trial + tier=pro`：试用中，临时给 pro（平台按需配置 pro / business）。
- `state=subscribed + tier=business`：正式订阅 business。
- `state=expired + tier=free`：过期，能力跌回 free，数据保留。

> **"公测体验"= `state=trial` + 平台配给的某个 tier**，不新增 `tier=beta`。`beta` 仅为内部部署环境名，与用户数据模型无关。

### 3.2 权益挂载粒度 = (workspace, product)

权益不是挂在 workspace 上的单一值，而是挂在 **(workspace, product)** 组合上。同一 workspace 内，每个产品有独立的 state + tier。

### 3.3 数据模型（示意，按 arda 实际 schema 适配）

```
Org {
  id
  // 成员、组织元数据；不持有权益
}

Workspace {
  id
  orgId          // 所属 org
  // 隔离容器；业务数据按 workspaceId 隔离
  seedStatus?    // 平台标记：是否需要示例数据填充（见 §4）
}

Subscription {
  id
  workspaceId    // 所属 workspace
  product        // arda | forge | anlan | raven ...
  state          // trial | subscribed | expired | none
  tier           // free | starter | pro | business | enterprise
  features       // string[] 或关联：开放的功能键
  quota          // 配额（AI 调用额度、存储上限等）
  // (workspaceId, product) 唯一：同一 workspace 同一产品仅一条
}
```

> 上述 `Subscription` 实体**存在于 vxture 平台侧**（平台是 SoT）。arda **不建此表**，而是通过实时通道（§3.5）查询自己产品那一行：`workspaceId=active_workspace AND product=arda`，无需知道其他产品的订阅。arda 数据层因此只为领域业务数据存在。

### 3.4 门控点（feature gating）

门控始终以"当前 workspace × 当前产品"为单位：

- **前端**：按当前订阅的 `features` 渲染功能入口可见性。
- **BFF**：按当前订阅的 `state` / `tier` / `features` 做授权与配额校验（不可信前端，服务端必须二次校验）。
- 配额（quota）在 AI Gateway 等计量点按当前订阅 tier 生效。
- ~~门控对所有档位一视同仁，无 free 特例：free 只是「features 较短、quota 较低」的一条普通订阅，门控统一为「按 features/quota 渲染与放行」，不是「未订阅就挡墙」。~~
  **已推翻（2026-07-03，决策 A）**：正确规则是——**订阅状态为 `none`（无任何订阅）时，free 档功能也不可用**，门控仍是二元墙（`status !== "active"` 一律拒绝），而非按 features/quota 逐项渲染放行。`free` tier 只在 `expired`/`none` 两种非活跃状态下作为占位值出现，从未单独触发放行。权威结论见 [`ent-100`](../arda-ent-100-architecture.md) §1.4、[`ent-110`](../arda-ent-110-local-implementation.md) §2。

**features/quota 的归属划分（重要）**：

- **features 的「键」（有哪些可门控的功能）由产品（arda）定义**——只有产品知道自己有什么功能。
- ~~**每档开放哪些 features、配额多少，由平台的订阅产品配置**——这是商业/计费决策，随套餐调整。~~
- ~~arda 门控时**只消费平台下发的「当前订阅 features 列表 + quota」，不在 arda 硬编码「档位→功能」映射**（否则改套餐就要发版）。~~
  **已取代（2026-07-13，owner 裁定：松耦合分权）**：**能力与配额拆开归属**——「每档开放哪些 features」= 产品特性，**由产品在本仓能力矩阵中完全自定义**（改档位内容 = 产品发版，是所有权归位而非缺陷）；「配额」（上限数字 + 消耗池）= 套餐销售策略，**仍由平台定义与统一管理**（workspace 级、跨产品兼容，如 storage、ai.credit）。平台不再配置/下发任何功能键，C2 契约的 `capabilities` 字段整体移除。权威表述见 [`ent-100`](../arda-ent-100-architecture.md) §0、[`ent-110`](../arda-ent-110-local-implementation.md) §2a、[`ent-120`](../arda-ent-120-consumption-contract.md) v2。

**上下文切换（org / workspace）一律不重新登录**：

- 所有上下文切换（用户多租户/org 切换、多 workspace 切换）都是**应用内动作**：切换 → 按新上下文重查授权权益 → 重新求值门控 + 重载该上下文业务数据。**重查，而非重认证。**
- 常态（org:workspace = 1:1）下用户无切换器，active_workspace 登录时确定即可；切换器仅为多 workspace/多 org 的扩展场景提供。
- 因权益走实时拉取（§3.5），「重新求值」天然等于「按新 workspaceId 再拉一次」，切换成本低，不惊动 IdP。

### 3.5 权益来源与同步（关键改造）

现状是 tier 从 OIDC token claim 读取；本设计要求**改为以平台下发的订阅数据为准**：

- **平台是订阅的 source of truth**。vxture 平台维护 (workspace, product) 的订阅与计费。
- 弃用以 token claim 作为 tier 来源；`arda:subscription` scope/claim 变为冗余，逐步废弃。
- 计费（第三方或平台自建）→ 写入平台订阅 → 经下方通道反映到 arda。前端与 IdP 不直接读计费状态。

**同步通道（已定稿）：实时拉取 + 缓存 + 失效通知**

- **拉取为主**：arda 需要门控时，按 `active_workspace + product=arda` 向平台的只读权益端点查询，得到 state/tier/features/quota，写入短 TTL 缓存（Redis）。arda **不落 Subscription 镜像表**（守住「平台是 SoT、产品不存订阅」边界，避免配置漂移类问题）。
- **失效通知保证实时生效**：因业务要求「付费/开通即时可用」，仅靠 TTL 不够（窗口内有延迟）。平台在权益变更时，向 arda 推送一条 **invalidate(workspaceId, product)** 通知，arda 收到即失效缓存并在下次访问时重新拉取 → 升级**秒级生效**。
- 该 invalidate 通知与 §5 的平台→arda 指令（seed/wipe）**共用同一条已鉴权的服务间通道**，不单独新建。

> 净效果：平台保持唯一 SoT，arda 对权益无状态、无镜像表，同时满足实时生效要求。

---

## 4. 模板数据填充（示例数据体验）

### 4.1 职责划分

- **容器（workspace）由 vxture 平台创建/克隆/删除**；arda 不发起、不铸造 workspace ID，沿用平台/IdP 的 `active_workspace` 作隔离键。
- **内容（示例业务数据）由 arda 填充**：平台创建 workspace 并标记"需要示例数据"（如 `seedStatus`）；**用户首次进入 arda 时，arda 检测该标记，提示并把模板业务数据克隆进该 workspace**。

### 4.2 设计

- arda 侧维护一个或多个**模板（template / seed）**：只读、版本化，内含精选预置数据（示例 AI 写作项目、样例数据集等）。
- 触发点 = 用户首次进入 + 平台标记；克隆动作在 arda 内完成，写入正确的 `workspaceId`。
- 用户在自己的 workspace 内自由操作，不影响模板与其他用户。
- 满意 → 订阅状态/档位变更，数据延续；不满意 → **平台触发删除，arda 静默清理该 workspace 业务数据**。

> **不要用"共享体验 workspace + 加成员"方案**：多用户共用一个 workspace 破坏隔离，且互相可见/可改。每个体验用户必须有独立 workspace（由平台保证）。

### 4.3 关键流程

**示例数据填充（arda 侧）**
1. 用户首次进入 arda，读取当前 workspace 的 `seedStatus` 标记。
2. 若需填充，提示用户；确认后校验模板版本。
3. 将模板业务数据克隆进当前 workspace（写入正确 `workspaceId`）。
4. 清除/更新 `seedStatus`，进入体验。

**升级（满意 → 付费）**
1. 平台侧完成订阅变更（计费 → 平台订阅）。
2. 平台下发新订阅 → arda 更新当前 (workspace, product) 的 state/tier/features/quota。
3. 门控重新求值，功能切换。数据原地不动。

**删除（不满意 / 不保留）**
1. 平台侧触发删除。
2. arda 收到指令，按 `workspaceId` 静默清理该 workspace 全部业务数据（遵守数据保留与合规策略）。
3. 身份、org、workspace 容器的去留由平台决定；arda 只负责业务数据清理。

### 4.4 克隆成本权衡（实现时决策）

- **轻量预置**（少量结构化种子数据）：直接全量复制。
- **重量预置**（大量 AI 写作上下文、向量库、文件附件）：考虑**写时复制（copy-on-write）**——初始只引用只读模板，用户产生增量时才落副本，避免全量复制开销。

---

## 5. workspace 归属边界（与 IdP / 平台的关系）

- IdP 提供 `active_org` / `active_workspace`（不透明 claim）。
- **vxture 平台拥有 workspace 生命周期**（创建/克隆/删除）与 (workspace, product) 权益。
- **arda 是镜像方 + 执行方**：本地维护 workspace 记录（用于业务数据隔离）、按平台下发的订阅做门控、按平台指令静默清理数据。
- arda **不**主动创建/克隆/删除 workspace，**不**自己铸造 workspace ID。

这一边界使 arda 不必承担 workspace 生命周期复杂度，避免与 IdP 的 `active_workspace` 语义冲突。

### 5.1 平台 → arda 指令通道与信任模型（已定稿，初期从简）

平台向 arda 下发的指令很少且明确：**seed（填充示例数据）/ wipe（删除业务数据）/ invalidate（失效权益缓存）**。该通道能触发破坏性操作，必须鉴权。初期设计从简，由 AI coding 结合实际落地确认：

- **服务间认证，非用户 token**：平台以自身凭证调用 arda 内部端点。复用既有 admin 安全思路（Cloudflare/edge 层 + NestJS 服务 JWT 验签，或 mTLS），不引入新机制。
- **指令载荷**：`workspaceId + 操作类型 + 幂等键 + 时间戳/nonce`；arda 校验签名、校验幂等（防重放）、写审计日志。
- **wipe 用软删 + 延迟硬删**：破坏性删除先标记、延迟 N 天再物理清理，为平台误发/被攻破留挽回窗口（契合「强业务、要稳」的定位）。
- invalidate 与 seed/wipe 共用此通道（见 §3.5）。

> 初期不追求复杂信任体系：先做到「服务间签名 + 幂等 + 软删 + 审计」四点即可，后续按需加固。

---

## 6. beta-arda 部署环境的新定位

- 用途：**内部预发布（团队/内部人员集成测试）+ 对外演示（demo）**。
- 最终用户**不经此路径**。用户面向的"公测" = 生产内 `state=trial`。
- 由此消除：跨环境数据迁移、"新增版本是否要动 IdP"、beta/prod 会话与登出不一致等历史痛点。
- 身份侧仍保持每环境独立 OIDC client（arda / arda-beta），用于受众隔离与登出分发；这是**内部环境**的安全边界，保留不合并。beta-arda 的登出同步问题（Bug B）降级为内部卫生，不阻塞用户。

---

## 7. 全景图

```
身份层：   一个 IdP、一个账号、一个生产 client（arda）
              │
平台侧：    vxture 平台拥有 org / workspace 生命周期 + (workspace,product) 订阅
              │ 下发权益 / 下发删除指令
              ▼
arda 侧：   镜像 workspace（按 workspaceId 隔离业务数据）+ 按订阅门控 + 填充示例数据
              │
   ┌──────────┴───────────┐
权益维度（按 workspace×product）   数据来源
state×tier：                       ┌─ 用户自带数据 → 空白 workspace
trial → subscribed（原地，零迁移）  └─ 想用预置数据 → 平台建 workspace+标记 → arda 首次进入填充
expired → 回落 free（不删数据）       │
   │                                 │
   └──── 满意则变更订阅，数据全程延续；不满意则平台触发删除、arda 静默清理 ────┘
```

---

## 8. 实现清单（交给 AI coding 的任务分解）

> **排序闸门**：写任何 schema 前，先定义 arda 的**领域数据模型**（数据源/数据集/AI 写作项目等）——它才是 DB 与模板 seed 的真前置；权益不建表，不构成前置。

0. **（前置）定义领域数据模型**：明确 arda 业务核心实体（data source / dataset / project / AI 写作上下文等）。模板 seed 内容依赖此定义。
1. **引入持久层（服务领域数据）**：Prisma + Postgres 服务（如 `arda-db`），更新 docker-compose、部署栈、`06-check-deploy-contracts.py`（当前仅 app+redis）、per-stack 数据目录与备份。**权益不在此建表。**
2. **业务数据模型 + workspace 隔离**：领域实体均带 `workspaceId`，强过滤；workspace 本地记录仅用于隔离（镜像平台，不持有生命周期）。
3. **权益来源改造（无表）**：`EntitlementResolver` 从读 token claim 改为「实时拉取 + Redis 缓存」按 `active_workspace + product=arda` 查平台权益端点；弃用 `arda:subscription` claim；更新集成标准文档。枚举锁定：`state=trial|subscribed|expired|none`，`tier=free|starter|pro|business|enterprise`。
4. **门控**：`EntitlementGate` **保留二元墙**（`status !== "active"` 一律拒绝，见 §3.4 已推翻的旧表述与决策 A），按「当前 workspace×产品」求值；features 键由 arda 定义，~~档位映射由平台下发~~ **档位映射也归 arda 本地能力矩阵（2026-07-13 取代，见 §3.4 修正注）**。
5. **同步通道**：实时拉取端点 + 短 TTL 缓存 + 平台 `invalidate(workspaceId,product)` 失效通知（秒级生效）；与指令通道共用。
6. **平台→arda 指令通道**：服务间签名鉴权 + 幂等 + 审计；承载 seed / wipe / invalidate。
7. **上下文切换**：org/workspace 切换为应用内动作，重查权益 + 重载业务数据，不重新登录；常态无切换器，多上下文为扩展。
8. **模板填充**：arda 侧 seed 模板（只读、版本化，依赖步骤 0）+ 首次进入检测 `seedStatus` + 克隆（先全量，后按需 copy-on-write）。
9. **删除执行**：接收平台 wipe 指令 → 按 `workspaceId` 软删 + 延迟硬删。
10. **环境定位调整**：beta-arda 从用户路径移除，EnvGuard 用户文案与部署文档同步更新。

---

## 9. 已定稿决策摘要

- **同步通道**：实时拉取 + 缓存 + 失效通知；要求**秒级生效**（付费/开通即时可用）。arda 不建权益镜像表。
- **数据所有权边界**：平台仅订阅/付费/授权/账单；业务数据全在产品端。
- **features/quota 归属**：features 键由产品定义，~~档位→功能映射由平台配置下发~~ **档位→功能映射由产品能力矩阵自持；配额（上限+消耗池）由平台定义与统一管理（2026-07-13 取代，见 §3.4 修正注）**。
- **指令通道鉴权**：服务间签名 + 幂等 + 软删 + 审计，初期从简，AI coding 结合实际确认。
- **上下文切换**：org/workspace 切换一律应用内重查，不重新登录。

## 10. 待确认（非阻塞，实现时细化）

- **领域数据模型的具体形态**（步骤 0）→ DB 与模板 seed 的真前置，建议优先起草。
- **预置数据规模与形态** → 决定克隆走全量复制还是 copy-on-write（§4.4）。
- **各 tier 的 features/quota 清单**（五档能力矩阵）→ 门控配置的数据结构（键由产品定义）。
- **计费来源**（第三方 vs 平台自建）→ 平台侧订阅写入契约（arda 不直接对接计费）。
- **指令通道的具体凭证形式**（服务 JWT vs mTLS）→ 由 AI coding 结合现有 admin 安全栈确认。
