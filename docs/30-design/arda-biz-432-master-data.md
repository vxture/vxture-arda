# 主数据 功能设计（arda-biz-432-master-data）

> 状态：功能层 · 功能设计（待评审）
> 模板/看板：[`biz-400`](arda-biz-400-functions.md)；归属与深度决策：[`biz-100`](arda-biz-100-architecture.md) §1、[`biz-230`](arda-biz-230-governance.md)
> 同族：[`biz-431 数据标准`](arda-biz-431-standards.md)（DAMA「参考与主数据」；`biz-100` §1.1「数据定义」对）

---

## 1. 功能定义

把核心业务实体（客户 / 产品 / 供应商等）维护为**权威金记录（MDM）**。**轻量优先**（金记录标注 + steward + 质量 + 主数据服务，复用现有模型）；**重型引擎（匹配/合并/survivorship）深度待定**（`biz-100` §1）。治理域。

## 2. 贯通链（目标 → 过程 → 结果 → 服务 → 监管）

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| **目标·定义** | 定主数据模型 / 权威源 / 金记录标准 | （轻量）`Dataset` 标记主数据 + `ownerUserId`(steward) + 关联 `Standard` | 金记录定义 → 供治理 |
| **过程·执行** | 标金记录、指派 steward、（轻量）匹配/合并/去重、质量规则 | `Dataset` 主数据标记 + `QualityRule`；（重型 match/merge 待定） | 金记录 → 供画像/服务 |
| **结果·看** | 金记录清单、主数据健康、权威源标识 | 筛选主数据 `Dataset` + 聚合质量 | 金记录 → 画像（`biz-421`）、主数据服务 |
| **服务·用** | 主数据服务（金记录对外 API，高价值） | `DataService`（`biz-441`）发布 | — |
| **监管·审计** | 主数据变更 / 合并审计 | `AuditLog{action: master.change/merge}` | 审计流水 |

## 3. 断链清单

| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `M-BL1` | 目标：金记录标记未建模 | `Dataset` 无主数据标识（`core` ≠ 主数据） | 加轻量标记 `Dataset.isMaster`/`masterDomain` | da |
| `M-BL2` | 过程：匹配/合并/survivorship 缺 | 重型 MDM 未实现，**深度待定** | 先轻量；重型待产品决策 | 决策 |
| `M-BL3` | 服务：主数据服务未接 | 金记录未发布为服务 | 经 `biz-441` 发布 | `biz-441` |
| `M-BL4` | 监管：主数据审计未接 | 变更/合并不落审计 | 补写入点 | `biz-451`/admin |

> 原则（`biz-230` §7）：**先做轻量，决策前不建 MDM 专用实体**。

## 4. 数据模型（da delta）

- **轻量 delta（M-BL1）**：`Dataset.isMaster Boolean?` / `masterDomain String?`（金记录标注）——单列迁移。
- **重型（不建，待定）**：匹配/合并/survivorship 专用实体——深度决策前不建。
- **复用**：`ownerUserId`(steward)、`QualityRule`、`Standard`（`biz-431`）。

## 5. 依赖

| 依赖 | 用途 | 断链 |
|---|---|---|
| 资产（`biz-421`） | 金记录标注、画像 | M-BL1 |
| 标准（`biz-431`）/质量（`biz-433`） | 主数据标准/质量 | — |
| 服务（`biz-441`） | 主数据服务 | M-BL3 |
| 审计（`biz-451`/admin） | 主数据审计 | M-BL4 |

## 6. 门控（能力键）

- 主数据管理：`arda.governance.master_data`（**提议键**，需补入目录，见 `biz-400` §4）；写 = `admin`/`steward`。
- 看金记录：`arda.assets.catalog` baseline（画像只读）。
