# 资产与元数据 功能设计（ad-ba-42-assets-metadata）

> 状态：功能层 · 功能设计（待评审）
> 模板/看板：[`ba-40`](ad-ba-40-functions.md)；数据模型：[`arda-data-architecture-schema.md`](arda-data-architecture-schema.md) §4.1

---

## 1. 功能定义

把数据编目为**可发现、有口径、有负责人、有分级**的资产；**元数据是资产画像的底座**，画像页汇聚各功能的结果面（`ba-11` 资产域）。

## 2. 贯通链（目标 → 过程 → 结果 → 服务 → 监管）

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| **目标·定义** | 编目体系 / 分类 facet（domain/team）/ 术语 | `Dataset` 结构、`GlossaryTerm`、`Tag` | 编目模型 → 供录入 |
| **过程·执行** | 编目（登记/编辑元数据）、打标、维护术语 | `Dataset`/`Tag`/`DatasetTag`/`GlossaryTerm` CRUD | 资产 → 供发现/画像 |
| **结果·看** | 目录（列表/卡片/搜索）、**资产画像**、有多少/容量画像 | 目录查询 + 画像**聚合各功能结果面**（质量/血缘/安全/主数据/标准） | 画像 → 供服务选资产、供消费发现 |
| **服务·用** | 目录/元数据供发现；画像供服务发布选资产 | 目录对外（`ba-48`）；画像读取 | — |
| **监管·审计** | 元数据/分级变更审计 | `AuditLog{action: asset.change}` | 审计流水 |

## 3. 断链清单

| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `A-BL1` | 结果：画像"结果面聚合"未装配 | 画像要聚合质量/血缘/安全/主数据/标准，各功能结果环未接 | 画像聚合装配（随各功能结果环接通逐步点亮） | Q/L/Sec/M/S 各功能 |
| `A-BL2` | 过程：术语表/标签独立管理缺 | `Tag`/`GlossaryTerm` 有表，标签仅卡片内联、术语无界面 | 建术语/标签管理路径 | — |
| `A-BL3` | 结果：高级/语义搜索缺 | 仅基础搜索/筛选 | 实现 `advanced_search` | — |
| `A-BL4` | 结果：有多少/容量画像缺 | 存储占用未聚合展示 | 聚合 `sizeBytes` + 配额 | 存储 |
| `A-BL5` | 目标：列级 Field 缺 | 列级 schema 未建模（画像 schema tab 用 demo） | `Field`（future，列级治理驱动） | future |

> 画像聚合（`A-BL1`）是资产域"一页看全可信度"打动点的实现核心——它**依赖各治理功能的结果环先接通**，是跨功能装配。

## 4. 数据模型（da delta）

- **已建**：`Dataset`、`Tag`/`DatasetTag`、`GlossaryTerm`。
- **future**：`Field`（列级）。
- **派生（不落库）**：质量分、订阅数、容量汇总。
- **实现要点**：画像=聚合视图（读多功能实体）；`code` ws 内唯一。

## 5. 依赖

| 依赖 | 用途 | 断链 |
|---|---|---|
| 接入（`ba-41`） | 生成 Dataset | 上游 |
| 质量/血缘/安全/主数据/标准 | 画像结果面 | A-BL1 |
| 服务（`ba-48`） | 目录对外发现 | — |
| 审计（`ba-49`/admin） | 资产变更审计 | — |

## 6. 门控（能力键）

- 浏览目录：`arda.assets.catalog`（**baseline**，域可见性基准）。
- 编辑元数据：`arda.assets.edit_metadata`；术语：`arda.assets.glossary`；高级搜索：`arda.assets.advanced_search`；批量：`arda.assets.bulk_ops`（写操作，`editor+`）。
- 配额：`arda.quota.datasets`、`arda.quota.storage_bytes`。
