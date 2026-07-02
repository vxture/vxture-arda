# arda 业务架构系列 · 索引与编号法（ad-ba-00-index）

> 状态：系列索引（随系列更新）
> 用途：`ad-ba-*`（业务架构）系列总目录 + arda 全局设计文档编号法
> 范围：**仅 arda 数据域**（数据资产/集成/治理/服务/管理）。kb、业务智能体、RAG/向量、LLM 编排属其他产品，不在本系列（见 [`arda-data-platform-agent-support.md`](arda-data-platform-agent-support.md) §0/§8 与记忆 arda-scope-boundary）

---

## 0. arda 设计文档全局编号法

统一命名：`ad-<维度>-<两位数>-<slug>.md`

- **`ad`** = 产品简写（arda）。
- **`<维度>`** = 两字母维度命名空间（见下表）。
- **`<两位数>`** = 维度内序号，**十位=层**：`0` 索引 / `1` 总体 / `2` 详细（个位=板块序） / `3` 实施。板块序留间隔，便于插入。

### 维度命名空间

| 维度 | 代码 | 说明 | 现有文档（后续可平移改名） |
|---|---|---|---|
| 数据架构 | `da` | 持久层 / schema / 迁移（**已完成**） | `arda-data-architecture{,-schema,-migration}.md` |
| **业务架构** | `ba` | 能力全景 / 板块详细 / 实施（**本系列**） | 新建 |
| 权益门控 | `en` | 订阅 / feature-key / 两轴门控 | `ADR-11`、`entitlement.md`、`arda-functional-domains-and-entitlement.md` |
| 对接 | `if` | 平台 / IdP 契约 | `vxture-platform-integration-requirements.md`、`identity-app-integration-standard.md` |
| 计量 | `me` | 用量 / 配额 / 瀑布扣减 | 现嵌于 `ADR-11 §11.5-11.7` |

> 本轮先落地 `ba` 系列；`da/en/if/me` 先规划槽位，既有文档暂不改名（改名涉及跨文档链接更新，另行迁移）。逻辑归属见上表。

---

## 1. 业务架构（ba）三层结构

| 层 | 编号 | 内容 |
|---|---|---|
| **第 1 层 · 总体架构** | `ba-10` | 业务能力全景、板块划分、价值链、跨切面（隔离/两轴门控/治理即信任/对外契约）、目标态架构 |
| **第 2 层 · 详细设计** | `ba-21..25` | 按板块分拆，每板块一份 |
| **第 3 层 · 实施计划** | `ba-30` | 现状盘点 → 目标差距 → 分阶段落地、迁移与风险 |

## 2. ba 系列看板

| 编号 | 文档 | 层 | 状态 |
|---|---|---|---|
| `ba-00` | [索引与编号法](ad-ba-00-index.md)（本文件） | - | 完成 |
| `ba-10` | [业务能力总体架构](ad-ba-10-architecture.md) | 1 | 完成（待评审） |
| `ba-21` | [数据资产 详细设计](ad-ba-21-assets.md) | 2 | 完成（待评审） |
| `ba-22` | [数据集成 详细设计](ad-ba-22-integration.md) | 2 | 完成（待评审） |
| `ba-23` | [数据治理 详细设计](ad-ba-23-governance.md) | 2 | 完成（待评审） |
| `ba-24` | [数据服务 详细设计](ad-ba-24-services.md) | 2 | 完成（待评审） |
| `ba-25` | [管理 详细设计](ad-ba-25-admin.md) | 2 | 完成（待评审） |
| `ba-30` | [实施计划](ad-ba-30-implementation.md) | 3 | 完成（待评审） |

## 3. 板块划分（第 2 层）

沿用 [`arda-functional-domains-and-entitlement.md`](arda-functional-domains-and-entitlement.md) §2.2 的功能域收敛（`overview` 为恒开落地页，不作独立数据板块）：

| 板块 id | 名称 | 编号 | 含屏幕 | 核心实体 |
|---|---|---|---|---|
| `assets` | 数据资产 | `ba-21` | catalog（+详情） | Dataset / Tag / GlossaryTerm |
| `integration` | 数据集成 | `ba-22` | 数据源、etl | DataSource /（Pipeline·JobRun future） |
| `governance` | 数据治理 | `ba-23` | standards / quality / lineage / security | Standard / QualityRule·Result / LineageEdge / Policy |
| `services` | 数据服务 | `ba-24` | service | DataService |
| `admin` | 管理 | `ba-25` | api keys / audit（待建界面） | ApiKey / AuditLog |

## 4. 阅读顺序

`ba-10`（总体架构） → 关心的 `ba-2x`（板块） → `ba-30`（落地）。跨维度依赖见各文档头部「上游依据」。
