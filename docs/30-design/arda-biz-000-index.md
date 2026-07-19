# arda 业务架构系列 · 索引与编号法（arda-biz-000-index）

> 状态：系列索引（随系列更新）
> 用途：`arda-biz-*`（业务架构）系列总目录 + arda 全局设计文档编号法
> 范围：**仅 arda 数据域**（数据资产/集成/治理/服务/管理）。kb、业务智能体、RAG/向量、LLM 编排属其他产品，不在本系列（见 [`arda-data-170-platform-agent-support.md`](arda-data-170-platform-agent-support.md) §0/§8 与记忆 arda-scope-boundary）
> 数据类型：结构化 + 常规非结构化（文档/图片/表格）；**不含** GIS/三维/IoT 复杂孪生数据（另一产品负责）。详见 [`biz-100`](arda-biz-100-architecture.md) §0

---

## 0. arda 设计文档全局编号法

统一命名：`arda-<维度>-<三位数>-<slug>.md`

- **`arda`** = 产品名（固定前缀）。
- **`<维度>`** = **可读维度简称**（3-4 字母，一眼可辨含义，见下表）。
- **`<三位数>`** = 维度内序号，**百位=层，十位=分组，个位=层内序**，留足插入空间、方便归类与调整：
  - `0xx` 索引 / `1xx` 总体架构 / `2xx` 板块详细 / `3xx` 实施 / **`4xx` 功能设计**。
  - 功能层 `4xx` 的**十位=生命周期层**（`41x` 接入 / `42x` 编目 / `43x` 治理 / `44x` 服务 / `45x` 运营），个位=层内序。

> 用 3 位而非 2 位：功能维度较多（10+），且需按生命周期层归类、便于后续插入调整——**不因编号不足而合并文档**。

### 维度命名空间

| 维度 | 代码 | 说明 | 现有文档（后续可平移改名） |
|---|---|---|---|
| 数据架构 | `data` | 持久层 / schema / 迁移 | [`arda-data-000-index`](arda-data-000-index.md) 系列（`data-100/11x/2xx/300`） |
| **业务架构** | `biz` | 能力全景 / 板块详细 / 实施（**本系列**） | 新建 |
| 权益门控 | `ent` | **arda 侧消费职责**：本地 Resolver/Gate/同步 + 消费契约（不含平台侧订阅/Plan/合并算法设计，见 `ent-000` §0 边界） | [`arda-ent-000-index`](arda-ent-000-index.md) 系列（已完成，`ent-100/110/120/300`） |
| 对接 | `plat` | **arda 侧的 OIDC RP 契约 + 对接需求追踪 + 实施回传**（不含平台侧权益/指令通道内部实现，见 `plat-000` §0 边界） | [`arda-plat-000-index`](arda-plat-000-index.md) 系列（已完成，`plat-100/110/200/300`） |

> `biz`、`data`、`ent`、`plat` 四个系列均已完成。逻辑归属见上表。
>
> 本表只列 **arda 侧维度**。"计量/瀑布扣减"（曾用代号 `mtr`）经核实是 vxture 平台内部算法，不是 arda 要设计或归档的维度，因此不再作为一行出现在此表——arda 只作为消费方调用 `POST /usage/consume`，契约细节见 [`ent-120`](arda-ent-120-consumption-contract.md) §2。

---

## 1. 业务架构（biz）三层结构

> **两层区分（重要）**：
> - **看和组织层**（导航 / 页面归组 / header 九宫 launcher 切功能）——**后续逐步落地**，对应 `biz-100 §1.2`(两轴导航) / `biz-110` / `biz-210..250`。
> - **功能层**（每个功能端到端贯通 + 可实现）——**当前设计重点**，对应 **`biz-4xx`**，与导航解耦。

| 层 | 编号 | 内容 |
|---|---|---|
| **第 1 层 · 总体架构** | `biz-100` | 业务能力全景、能力维度（13）、域划分原则、两轴模型、跨切面、目标态架构 |
| **看和组织 · 功能域详解** | `biz-110` | 应用/用户视角五域梳理、跨域闭环（**导航/组织层，配合九宫后续落地**） |
| **看和组织 · 详细设计** | `biz-210..250` | 按板块（功能域）的技术详细设计（**导航/组织层**） |
| **功能层 · 功能贯通设计** | **`biz-4xx`** | **按功能纵向拉通（目标→过程→结果→服务→监管）+ 断链 + 实现**；与导航解耦 |
| **第 3 层 · 实施计划** | `biz-300` | 现状盘点 → 目标差距 → 分阶段落地；消费 `biz-400` 断链看板 |

## 2. biz 系列看板

| 编号 | 文档 | 层 | 状态 |
|---|---|---|---|
| `biz-000` | [索引与编号法](arda-biz-000-index.md)（本文件） | - | 完成 |
| `biz-100` | [业务能力总体架构](arda-biz-100-architecture.md) | 1 | 完成（待评审） |
| `biz-105` | [能力地图与三层功能域模型](arda-biz-105-capability-map.md) | 1 | 完成 |
| `biz-106` | [15 域 L2 菜单规划与骨架落地](arda-biz-106-domain-menus.md) | 1 | 完成 |
| `biz-107` | [Launcher 归集与域聚合](arda-biz-107-launcher-clustering.md) | 1 | 完成 |
| `biz-110` | [功能域详细梳理（应用/用户视角 · 两轴）](arda-biz-110-domains.md) | 1 | 完成（待评审） |
| `biz-120` | [领域实体与 feature-key 目录（v1）](arda-biz-120-domain-entities-and-feature-keys.md) | 1 | 完成 |
| `biz-210` | [数据资产 详细设计](arda-biz-210-assets.md) | 2 | 待按 biz-110 两轴重排 |
| `biz-220` | [数据集成 详细设计](arda-biz-220-integration.md) | 2 | 完成（待评审） |
| `biz-230` | [数据治理 详细设计](arda-biz-230-governance.md) | 2 | 完成（待评审） |
| `biz-240` | [数据服务 详细设计](arda-biz-240-services.md) | 2 | 完成（待评审） |
| `biz-250` | [管理 详细设计](arda-biz-250-admin.md) | 2 | 完成（待评审） |
| `biz-400` | [功能贯通设计 · 框架与断链看板](arda-biz-400-functions.md) | 功能 | 完成（待评审） |
| `biz-410` | [数据接入 功能设计](arda-biz-410-ingestion.md) | 功能 | 完成（待评审） |
| `biz-421` | [数据资产 功能设计](arda-biz-421-assets.md) | 功能·编目 | 完成（待评审） |
| `biz-422` | [元数据 功能设计](arda-biz-422-metadata.md) | 功能·编目 | 完成（待评审） |
| `biz-431` | [数据标准 功能设计](arda-biz-431-standards.md) | 功能·治理 | 完成（待评审） |
| `biz-432` | [主数据 功能设计](arda-biz-432-master-data.md) | 功能·治理 | 完成（待评审） |
| `biz-433` | [数据质量 功能设计](arda-biz-433-quality.md) | 功能·治理 | 完成（样板 · 待评审） |
| `biz-434` | [数据血缘 功能设计](arda-biz-434-lineage.md) | 功能 | 完成（待评审） |
| `biz-435` | [数据安全 功能设计](arda-biz-435-security.md) | 功能 | 完成（待评审） |
| `biz-441` | [数据服务 功能设计](arda-biz-441-services.md) | 功能 | 完成（待评审） |
| `biz-451` | [数据生命周期 功能设计](arda-biz-451-lifecycle.md) | 功能 | 完成（待评审） |
| `biz-300` | [实施计划](arda-biz-300-implementation.md) | 3 | 完成（待评审） |
| `biz-260` | [商业化/计费模型](arda-biz-260-billing.md) | 2 · 跨切面 | 完成（待平台配置） |

## 3. 板块划分（第 2 层）

沿用 `arda-functional-domains-and-entitlement.md` §2.2 的功能域收敛（`overview` 为恒开落地页，不作独立数据板块）：

| 板块 id | 名称 | 编号 | 含屏幕 | 核心实体 |
|---|---|---|---|---|
| `assets` | 数据资产 | `biz-210` | catalog（+详情） | Dataset / Tag / GlossaryTerm |
| `integration` | 数据集成 | `biz-220` | 数据源、etl | DataSource /（Pipeline·JobRun future） |
| `governance` | 数据治理 | `biz-230` | standards / quality / lineage / security | Standard / QualityRule·Result / LineageEdge / Policy |
| `services` | 数据服务 | `biz-240` | service | DataService |
| `admin` | 管理 | `biz-250` | api keys / audit（待建界面） | ApiKey / AuditLog |

## 4. 阅读顺序

`biz-100`（总体架构） → 关心的 `biz-2xx`（板块） → `biz-300`（落地）。跨维度依赖见各文档头部「上游依据」。
