# 元数据 功能设计（arda-biz-422-metadata）

> 状态：功能层 · 功能设计（待评审）
> 模板/看板：[`biz-400`](arda-biz-400-functions.md)；数据模型：`GlossaryTerm`/`Tag`（业务元数据）、`Field`(future，技术元数据)、`Dataset` 描述字段
> 与 [`biz-421 数据资产`](arda-biz-421-assets.md) 是**两个维度**：资产 = 对象；元数据 = **描述（关于数据的数据）**。元数据是**横切底座**——不只描述资产，也描述源/服务/标准。

---

## 1. 功能定义

采集、策展、检索**"关于数据的数据"**，让数据**可理解、可发现、语义统一**。三类：
- **技术元数据**：schema / 字段 / 类型 / 物理位置（`Field` future、从 `DataSource` 拉取）。
- **业务元数据**：术语 / 标签 / 业务定义 / 主题（`GlossaryTerm` / `Tag`）。
- **操作元数据**：新鲜度 / 统计 / 质量分引用（多为派生）。

## 2. 贯通链（目标 → 过程 → 结果 → 服务 → 监管）

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| **目标·定义** | 元数据模型 / 术语体系 / 采什么元数据 | 字段模型（`Field` future）+ `GlossaryTerm`/`Tag` 体系 | 元数据模型 → 供采集 |
| **过程·执行** | 采集（harvest：自动拉 schema）、策展（补业务上下文/术语/标签）、维护 | 从 `DataSource` 拉技术元数据；`GlossaryTerm`/`Tag`/`Field` CRUD | 元数据 → 供理解/检索 |
| **结果·看** | 元数据视图（字段结构/术语/标签）、元数据完整度、语义检索 | 画像的元数据 tab + 高级/语义搜索 | 元数据 → 资产画像（`biz-421`）、发现 |
| **服务·用** | 元数据驱动发现（语义/高级搜索）、元数据对外（供消费方理解数据） | `advanced_search`；元数据 API | — |
| **监管·审计** | 元数据变更审计、元数据质量 | `AuditLog{action: metadata.change}` | 审计流水 |

## 3. 断链清单

| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `MD-BL1` | 过程：技术元数据采集缺 | 未从源自动拉 schema/字段 | 从 `DataSource` harvest schema → `Field`/`Dataset` | `biz-410`(I-BL1) |
| `MD-BL2` | 目标：列级 `Field` 未建模 | 技术元数据到列级缺（画像 schema tab 用 demo） | `Field`（future，列级治理驱动） | future |
| `MD-BL3` | 过程：术语/标签管理界面缺 | `GlossaryTerm`/`Tag` 有表，标签仅卡片内联、术语无界面 | 建术语/标签管理路径 | — |
| `MD-BL4` | 服务：语义/高级搜索缺 | 仅基础搜索 | 实现 `advanced_search`（元数据驱动） | — |
| `MD-BL5` | 结果：元数据完整度度量缺 | 无元数据质量/完整度指标 | 元数据完整度评分（派生） | — |
| `MD-BL6` | 监管：元数据审计未接 | 变更不落审计 | 补写入点 | `biz-451`/admin |

> 关键 = `MD-BL1/BL3`（技术元数据能自动采、业务元数据能策展）：元数据是资产画像"可理解"的底座，也是语义检索的基础。

## 4. 数据模型（da delta）

- **已建**：`GlossaryTerm`、`Tag`/`DatasetTag`（业务元数据）；`Dataset` 描述字段。
- **future**：`Field`（列级技术元数据：类型/可空/分级/位置）。
- **横切性**：元数据描述 `Dataset`，未来亦可描述 `DataSource`/`DataService`/`Standard`——是底座层。
- **实现要点**：harvest（源→技术元数据）；策展（业务上下文）；元数据驱动检索。

## 5. 依赖

| 依赖 | 用途 | 断链 |
|---|---|---|
| 接入（`biz-410`） | 技术元数据来源（拉 schema） | MD-BL1 |
| 数据资产（`biz-421`） | 元数据挂在资产上、进画像 | — |
| 服务（`biz-441`） | 元数据/参考对外 | — |
| 审计（`biz-451`/admin） | 元数据审计 | MD-BL6 |

## 6. 门控（能力键 · 复用现有）

- 编辑元数据：`arda.assets.edit_metadata`；术语：`arda.assets.glossary`；语义/高级搜索：`arda.assets.advanced_search`（写/增值，`editor+`）。
- 看元数据（画像）：`arda.assets.catalog` baseline（只读）。

> 元数据功能**复用现有 `arda.assets.*` 键**，无需新增键。
