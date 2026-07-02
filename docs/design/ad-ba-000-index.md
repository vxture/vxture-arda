# arda 业务架构系列 · 索引与编号法（ad-ba-000-index）

> 状态：系列索引（随系列更新）
> 用途：`ad-ba-*`（业务架构）系列总目录 + arda 全局设计文档编号法
> 范围：**仅 arda 数据域**（数据资产/集成/治理/服务/管理）。kb、业务智能体、RAG/向量、LLM 编排属其他产品，不在本系列（见 [`arda-data-platform-agent-support.md`](arda-data-platform-agent-support.md) §0/§8 与记忆 arda-scope-boundary）
> 数据类型：结构化 + 常规非结构化（文档/图片/表格）；**不含** GIS/三维/IoT 复杂孪生数据（另一产品负责）。详见 [`ba-100`](ad-ba-100-architecture.md) §0

---

## 0. arda 设计文档全局编号法

统一命名：`ad-<维度>-<三位数>-<slug>.md`

- **`ad`** = 产品简写（arda）。
- **`<维度>`** = 两字母维度命名空间（见下表）。
- **`<三位数>`** = 维度内序号，**百位=层，十位=分组，个位=层内序**，留足插入空间、方便归类与调整：
  - `0xx` 索引 / `1xx` 总体架构 / `2xx` 板块详细 / `3xx` 实施 / **`4xx` 功能设计**。
  - 功能层 `4xx` 的**十位=生命周期层**（`41x` 接入 / `42x` 编目 / `43x` 治理 / `44x` 服务 / `45x` 运营），个位=层内序。

> 用 3 位而非 2 位：功能维度较多（10+），且需按生命周期层归类、便于后续插入调整——**不因编号不足而合并文档**。

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

> **两层区分（重要）**：
> - **看和组织层**（导航 / 页面归组 / header 九宫 launcher 切功能）——**后续逐步落地**，对应 `ba-100 §1.2`(两轴导航) / `ba-110` / `ba-210..250`。
> - **功能层**（每个功能端到端贯通 + 可实现）——**当前设计重点**，对应 **`ba-4xx`**，与导航解耦。

| 层 | 编号 | 内容 |
|---|---|---|
| **第 1 层 · 总体架构** | `ba-100` | 业务能力全景、能力维度（13）、域划分原则、两轴模型、跨切面、目标态架构 |
| **看和组织 · 功能域详解** | `ba-110` | 应用/用户视角五域梳理、跨域闭环（**导航/组织层，配合九宫后续落地**） |
| **看和组织 · 详细设计** | `ba-210..250` | 按板块（功能域）的技术详细设计（**导航/组织层**） |
| **功能层 · 功能贯通设计** | **`ba-4xx`** | **按功能纵向拉通（目标→过程→结果→服务→监管）+ 断链 + 实现**；与导航解耦 |
| **第 3 层 · 实施计划** | `ba-300` | 现状盘点 → 目标差距 → 分阶段落地；消费 `ba-400` 断链看板 |

## 2. ba 系列看板

| 编号 | 文档 | 层 | 状态 |
|---|---|---|---|
| `ba-000` | [索引与编号法](ad-ba-000-index.md)（本文件） | - | 完成 |
| `ba-100` | [业务能力总体架构](ad-ba-100-architecture.md) | 1 | 完成（待评审） |
| `ba-110` | [功能域详细梳理（应用/用户视角 · 两轴）](ad-ba-110-domains.md) | 1 | 完成（待评审） |
| `ba-210` | [数据资产 详细设计](ad-ba-210-assets.md) | 2 | 待按 ba-110 两轴重排 |
| `ba-220` | [数据集成 详细设计](ad-ba-220-integration.md) | 2 | 完成（待评审） |
| `ba-230` | [数据治理 详细设计](ad-ba-230-governance.md) | 2 | 完成（待评审） |
| `ba-240` | [数据服务 详细设计](ad-ba-240-services.md) | 2 | 完成（待评审） |
| `ba-250` | [管理 详细设计](ad-ba-250-admin.md) | 2 | 完成（待评审） |
| `ba-400` | [功能贯通设计 · 框架与断链看板](ad-ba-400-functions.md) | 功能 | 完成（待评审） |
| `ba-410` | [数据接入 功能设计](ad-ba-410-ingestion.md) | 功能 | 完成（待评审） |
| `ba-421` | [数据资产 功能设计](ad-ba-421-assets.md) | 功能·编目 | 完成（待评审） |
| `ba-422` | [元数据 功能设计](ad-ba-422-metadata.md) | 功能·编目 | 完成（待评审） |
| `ba-431` | [数据标准 功能设计](ad-ba-431-standards.md) | 功能·治理 | 完成（待评审） |
| `ba-432` | [主数据 功能设计](ad-ba-432-master-data.md) | 功能·治理 | 完成（待评审） |
| `ba-433` | [数据质量 功能设计](ad-ba-433-quality.md) | 功能·治理 | 完成（样板 · 待评审） |
| `ba-434` | [数据血缘 功能设计](ad-ba-434-lineage.md) | 功能 | 完成（待评审） |
| `ba-435` | [数据安全 功能设计](ad-ba-435-security.md) | 功能 | 完成（待评审） |
| `ba-441` | [数据服务 功能设计](ad-ba-441-services.md) | 功能 | 完成（待评审） |
| `ba-451` | [数据生命周期 功能设计](ad-ba-451-lifecycle.md) | 功能 | 完成（待评审） |
| `ba-300` | [实施计划](ad-ba-300-implementation.md) | 3 | 完成（待评审） |

## 3. 板块划分（第 2 层）

沿用 [`arda-functional-domains-and-entitlement.md`](arda-functional-domains-and-entitlement.md) §2.2 的功能域收敛（`overview` 为恒开落地页，不作独立数据板块）：

| 板块 id | 名称 | 编号 | 含屏幕 | 核心实体 |
|---|---|---|---|---|
| `assets` | 数据资产 | `ba-210` | catalog（+详情） | Dataset / Tag / GlossaryTerm |
| `integration` | 数据集成 | `ba-220` | 数据源、etl | DataSource /（Pipeline·JobRun future） |
| `governance` | 数据治理 | `ba-230` | standards / quality / lineage / security | Standard / QualityRule·Result / LineageEdge / Policy |
| `services` | 数据服务 | `ba-240` | service | DataService |
| `admin` | 管理 | `ba-250` | api keys / audit（待建界面） | ApiKey / AuditLog |

## 4. 阅读顺序

`ba-100`（总体架构） → 关心的 `ba-2xx`（板块） → `ba-300`（落地）。跨维度依赖见各文档头部「上游依据」。
