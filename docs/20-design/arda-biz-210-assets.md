# 数据资产 板块详细设计（arda-biz-210-assets）

> 状态：第 2 层 · 详细设计（待评审）· 板块 `assets`
> 上游：[`biz-100`](arda-biz-100-architecture.md)（总体架构）、[`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md) §2.1/§3、[`data-210`](arda-data-210-assets.md)
> 跨切面（隔离/两轴门控/治理即信任/对外契约）见 `biz-100` §3，本文不重述

---

## 1. 板块定位

把企业数据登记为**可发现、有口径、有负责人、有分级**的资产目录（catalog）——数据价值链的起点（`biz-100` §2）。

**资产类型范围**（`biz-100` §0）：结构化（`table`/`view`/`stream`）+ 常规非结构化文件（文档/图片/表格，`type=file`）。**不含** GIS/三维/IoT 复杂孪生资产。文档/图片作为**资产**编目（元数据/分级/服务化），其 RAG/检索属其他产品。

## 2. 现状（证据基准 origin/develop）

| 能力 | 现状 | 证据 |
|---|---|---|
| 资产目录（列表/卡片 + 域筛选 + 搜索） | DB 支撑 | `(app)/catalog/`（`Dataset`） |
| 资产详情（结构/预览/质量/血缘入口/权限申请表单） | DB 支撑 + 申请表单已实现（未接审批流） | `(app)/catalog/[id]/asset-detail.tsx` |
| 标签、业务术语表 | **仅建表，无独立界面**（标签只在卡片内联） | `Tag`/`GlossaryTerm` 模型 |

## 3. 目标能力（feature-key）

| 键 | 能力 | 说明 |
|---|---|---|
| `arda.assets.catalog` | 浏览/搜索目录（**基线**，域可见性基准） | 恒为该板块最低键 |
| `arda.assets.edit_metadata` | 编辑描述/标签/分级 | 写操作，权限维度可加限 |
| `arda.assets.glossary` | 业务术语表 | 需补独立界面 |
| `arda.assets.advanced_search` | 保存/语义/高级搜索 | 增值 |
| `arda.assets.bulk_ops` | 批量打标/分类 | 增值，写操作 |

## 4. 数据模型（delta，schema 以 arch 维度为准）

| 实体 | 状态 | 关键点 |
|---|---|---|
| `Dataset` | v1（已建） | `code`(ws 内唯一)/`domain`/`team`/`classification`(AssetLevel)/`refreshFreq`；质量总分与订阅数**不落库**（派生） |
| `Tag` / `DatasetTag` | v1（已建） | `name` ws 内唯一；M:N |
| `GlossaryTerm` | v1（已建） | `term` ws 内唯一 |
| `Field`（列级） | **future** | 列级 schema（类型/可空/分级/位置）；列级治理/血缘落地时再建，**不提前建表** |

> 本板块基本无 schema 新增，缺口在**界面**（glossary、tag 独立管理）而非数据模型。

## 5. 屏幕/交互 + 对外契约

- **屏幕**：catalog（列表/卡片双视图、facet 筛选、搜索）→ 资产详情（结构 tab、预览、质量、血缘入口、权限申请）。**新增**：术语表界面、标签管理界面。
- **对外契约**：目录/元数据是对外消费方（含智能体）"发现有哪些可信数据"的入口（`biz-100` §3.4）；详情页的分级/质量/血缘构成可信度信号。

## 6. 门控（两轴，机制见 `biz-100` §3.2）

- **订阅**：域基线 = `arda.assets.catalog`；`edit_metadata`/`bulk_ops`/`advanced_search` 按档开放。
- **权限**：浏览类全员（订阅内）；编辑元数据/批量操作建议 `editor+`（避免 viewer 改口径）。

## 7. 待办

1. 建**术语表**独立界面（`arda.assets.glossary`）。
2. 建**标签管理**界面（现仅内联）。
3. 资产详情"权限申请表单"接**审批流**（现未接）——审批流归属待定（arda 内 vs 平台）。
4. `Field`（列级）待"列级治理/血缘"真实需求驱动再建（与 `biz-230` 血缘对齐）。
