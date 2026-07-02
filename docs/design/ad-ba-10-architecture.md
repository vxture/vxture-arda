# arda 业务能力总体架构（ad-ba-10-architecture）

> 状态：第 1 层 · 总体架构（待评审）
> 范围：arda 数据域的**业务能力全景、板块划分、价值链与跨切面**；不下钻到板块内部（见 `ba-21..25`）
> 上游依据：[`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md)、
> [`arda-functional-domains-and-entitlement.md`](arda-functional-domains-and-entitlement.md)、
> [`arda-data-architecture.md`](arda-data-architecture.md)（da 维度，数据模型以其为准）、
> [`ADR-11`](../ADR-11-subscription-entitlement-design.md)（en 维度，权益）

---

## 0. 定位与边界

arda = vxture 生态里的 **`data` Product = 通用数据平台（数据域）**。它把企业数据**编目→治理→服务化**，产出「可信、受控、可溯源的数据」，供人（控制台用户）与外部消费方（含业务智能体、BI、下游数据产品）使用。

**只做数据域**：kb、业务智能体、RAG/向量、LLM、交付物生成属其他产品（见 `ba-00` §0）。arda 提供数据，不做智能体。

---

## 1. 业务能力全景（capability map）

数据域按 5 个板块组织能力（`overview` 为恒开驾驶舱，非独立板块）：

```
overview(驾驶舱, 恒开)  —— 汇总各板块指标, 不持有独立能力

┌── assets 数据资产 ──────────┐  ┌── integration 数据集成 ───┐
│ 编目 · 元数据 · 标签/术语     │  │ 数据源登记 · (管道/调度 future)│
│ 详情(结构/预览/质量/血缘入口)  │  │ 元数据拉取                   │
└─────────────────────────────┘  └────────────────────────────┘
┌── governance 数据治理 ──────┐  ┌── services 数据服务 ──────┐
│ 标准 · 质量 · 血缘 · 安全策略  │  │ 服务/API 目录 · 发布 · 调用 │
│ 分级 · 脱敏 · 留存            │  │ 数据产品/对外共享            │
└─────────────────────────────┘  └────────────────────────────┘
┌── admin 管理 ───────────────┐
│ API Key · 审计日志            │
└─────────────────────────────┘
```

能力键与配额键目录见 [`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md) §3（`arda.<板块>.<能力>` / `arda.quota.<名>`）；各板块细目见 `ba-21..25`。

---

## 2. 价值链：编目 → 治理 → 服务

arda 的能力不是并列的五块，而是一条**递进的数据价值链**：

```
① 集成/资产: 把外部数据登记、编目为 Dataset(有口径/负责人/分级)
        ↓
② 治理:      给资产加标准/质量/血缘/策略 → 数据"可信"
        ↓
③ 服务:      把可信资产封装为 API/查询/导出 → 数据"可用"
        ↓
④ 消费:      人在控制台用, 或外部(含智能体)经服务契约取用(可溯源)
```

- **越往右越有商业价值**：裸数据源（左）→ 可信数据服务（右）。定价与档位通常沿此链递增（见 `en` 维度）。
- **治理是链条枢纽**：没有 ② 的资产只是"堆着的数据"；②让 arda 区别于普通数据目录——**治理即信任**（见 §3.3）。

---

## 3. 跨切面（所有板块共用的横向机制）

### 3.1 workspace 隔离（硬约束）

隔离键 = `workspaceId`（=平台/IdP `active_workspace`）。所有板块的每个业务实体带 `workspaceId`、查询强制按其过滤、workspace 内唯一。机制见 [`arda-data-architecture.md`](arda-data-architecture.md) §4。**本层不重述，各板块详细设计默认遵守。**

### 3.2 两轴门控（订阅 × 权限）

任何能力的"可用"= **订阅维度**（买了没：`(workspace,product=arda)` 的 feature-key）**AND** **权限维度**（角色够不够：`session.roles`）。三层防御：导航可见性 / 路由布局校验 / 动作与配额校验。机制见 [`arda-functional-domains-and-entitlement.md`](arda-functional-domains-and-entitlement.md) §3-4。**各板块详细设计只声明"用哪些键 + 哪些动作需要更高角色"，不重述机制。**

### 3.3 治理即信任层

分级(`classification`)/策略(`Policy`)/质量(`QualityResult`)/血缘(`LineageEdge`)是数据"可信可溯源"的控制面：对内标注资产可信度，对外（被消费/被智能体取用时）按分级脱敏、随数据传递来源。这是 arda 的差异化，详见 [`arda-data-platform-agent-support.md`](arda-data-platform-agent-support.md) §2。

### 3.4 对外数据契约

数据经 `DataService`(rest_api/query/export/share) + `ApiKey` 对外；对外时门控不变量（隔离/权益/分级过滤/审计/配额）必须在 arda 侧收口。详见 [`arda-data-platform-agent-support.md`](arda-data-platform-agent-support.md) §3。

### 3.5 可推导优于可存储

能从其他表算出的值（质量总分、治理覆盖率、调用量、订阅数）不落库，UI 展示时聚合。避免配置漂移。原则见 [`arda-data-architecture.md`](arda-data-architecture.md) §1。

---

## 4. 目标态架构（能力 → 屏幕 → 数据 → 门控）

```
用户/消费方
   │
   ▼ 会话(AccountGate) + 整站权益(EntitlementGate) + 板块级两轴门控(§3.2)
┌─────────────────────────────────────────────────────────────┐
│ 板块屏幕层  catalog · (etl/sources) · standards/quality/       │
│            lineage/security · service · (admin: keys/audit)    │
├─────────────────────────────────────────────────────────────┤
│ 服务端数据层 (app)/<板块>/data.ts —— 强制 where{workspaceId}    │
├─────────────────────────────────────────────────────────────┤
│ 领域模型 (Prisma/Postgres, da 维度)                            │
│   Dataset/Tag/Glossary · DataSource · Policy/Quality/Standard/ │
│   Lineage · DataService · ApiKey/AuditLog · WorkspaceRef/Seed  │
└─────────────────────────────────────────────────────────────┘
   │ 复用平台服务
   ▼ 身份/隔离(IdP) · 权益/计量(平台, ADR-11) · Redis(会话) · 存储
```

板块内部（屏幕/数据/交互/门控/待办）下钻见第 2 层各文档。

---

## 5. 板块索引（→ 第 2 层）

| 板块 | 编号 | 一句话范围 |
|---|---|---|
| 数据资产 | [`ba-21`](ad-ba-21-assets.md) | 编目、元数据、标签/术语、资产详情 |
| 数据集成 | [`ba-22`](ad-ba-22-integration.md) | 数据源登记（v1）、管道/调度（future） |
| 数据治理 | [`ba-23`](ad-ba-23-governance.md) | 标准、质量、血缘、安全策略、分级 |
| 数据服务 | [`ba-24`](ad-ba-24-services.md) | 服务/API 目录、发布、对外共享 |
| 管理 | [`ba-25`](ad-ba-25-admin.md) | API Key、审计日志 |

落地路径（现状→目标）见第 3 层 [`ba-30`](ad-ba-30-implementation.md)。

---

## 6. 与既有架构的关系

- **da（数据架构）已完成**：本业务架构的数据模型**以 da 维度为准**，不重定义 schema；本层只谈"能力/板块/价值链/门控落点"。
- **en（权益）复用**：门控机制不在本系列发明，引用 `ADR-11` + functional-domains。
- **本系列新增的是"业务视角"**：把已有实体/屏幕组织成能力全景与价值链，指导后续板块详细设计与落地。
