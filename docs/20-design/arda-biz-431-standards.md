# 数据标准 功能设计（arda-biz-431-standards）

> 状态：功能层 · 功能设计（待评审）
> 模板/看板：[`biz-400`](arda-biz-400-functions.md)；数据模型：[`data-230`](arda-data-230-governance.md)（`Standard`）
> 同族：[`biz-432 主数据`](arda-biz-432-master-data.md)（DAMA「参考与主数据」；`biz-100` §1.1「数据定义」对）

---

## 1. 功能定义

定义、发布、维护**数据标准**（代码集 / 数据元 / 参考数据），统一口径；参考数据可对外查询。治理域。

## 2. 贯通链（目标 → 过程 → 结果 → 服务 → 监管）

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| **目标·定义** | 定标准 / 数据元 / 参考值 | `Standard{type(code-set/data-element), ref, status(draft/review/published)}` | 标准 → 供落标/引用 |
| **过程·执行** | 落标、评审（draft→review→published）、术语关联 | `Standard` CRUD + status 流转；落标 = 资产符合性标注 | 已发布标准 → 供符合性/约束 |
| **结果·看** | 标准库、**符合性**（哪些资产符合哪些标准）、usage | `Standard` 列表 + 符合性关联 | 符合性 → 画像结果面（`biz-421`） |
| **服务·用** | 标准作为约束（质量/服务引用）；参考数据对外查询 | 质量规则引用标准；参考数据发布为服务（`biz-441`） | — |
| **监管·审计** | 标准变更 / 发布审计 | `AuditLog{action: standard.publish/change}` | 审计流水 |

## 3. 断链清单

| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `S-BL1` | 结果：符合性（资产↔标准）未建模 | `Standard.usage` 只是数字，无资产关联 | 加 `StandardBinding(datasetId↔standardId)` | da、`biz-421` |
| `S-BL2` | 过程：评审流缺 | `status` 是字段，无流程/审批 | 落评审流 | — |
| `S-BL3` | 服务：参考数据对外查询缺 | code-set 未作为服务对外 | 参考数据发布为查询服务 | `biz-441` |
| `S-BL4` | 监管：标准审计未接 | 变更/发布不落审计 | 补写入点 | `biz-451`/admin |

## 4. 数据模型（da delta）

- **已建**：`Standard`（v1）。
- **delta（S-BL1）**：`StandardBinding{workspaceId, datasetId, standardId}`（承载符合性）——待真实需求驱动。
- **实现要点**：`status` 流转 + 评审；参考数据（code-set）可作为服务数据源。

## 5. 依赖

| 依赖 | 用途 | 断链 |
|---|---|---|
| 资产（`biz-421`） | 符合性标注、画像展示 | S-BL1 |
| 质量（`biz-433`） | 质量规则引用标准 | — |
| 服务（`biz-441`） | 参考数据对外 | S-BL3 |
| 审计（`biz-451`/admin） | 标准审计 | S-BL4 |

## 6. 门控（能力键）

- 标准管理：`arda.governance.standards`（**提议键**，domain-entities §3.1 未列，需补入目录，见 `biz-400` §4）；写 = `admin`/`steward`。
- 看标准/符合性：`arda.assets.catalog` baseline（画像只读）。
