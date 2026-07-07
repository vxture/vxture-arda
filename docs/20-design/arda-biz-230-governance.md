# 数据治理 板块详细设计（arda-biz-230-governance）

> 状态：第 2 层 · 详细设计（待评审）· 板块 `governance`
> 上游：[`biz-100`](arda-biz-100-architecture.md)、[`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md) §2.3/§3、[`data-230`](arda-data-230-governance.md)
> 跨切面见 `biz-100` §3；本板块是"治理即信任"（`biz-100` §3.3）的落点

---

## 1. 板块定位

给资产加**标准 / 质量 / 血缘 / 安全（分级/脱敏/访问）/ 治理策略 / 生命周期（留存）**，把"堆着的数据"变成"可信的数据"——价值链枢纽（`biz-100` §2）。承载 `biz-100` §1 能力维度里治理层的多数维度。合并原 `govern` + `analyze`（血缘归治理，见 functional-domains §2.2）。

> **数据生命周期**：留存规则用 `Policy(type=retention)` + `arda.quota.history_retention_days` 表达（治理侧）；归档/销毁（wipe）的**执行与审计**在 `admin`（`biz-250`）——生命周期是横跨 governance（定规则）与 admin（执行留痕）的维度。
> **主数据归属：治理域，不是资产域。** 理由：(1) 让一份数据成为"主数据"的是**治理动作**（指定权威源 / steward / 匹配去重合并 / 存活规则 / 标准对齐 / 质量），不是编目本身；(2) 与已在治理域的**参考数据（`Standard`）**成对（DAMA"参考与主数据管理"同属一域）；(3) 与质量 / 血缘同构。
> **二元区分**：主数据的**金记录本身是资产**（在 catalog 里是 `Dataset`，资产域可见）；但**"把它治理成权威"是治理域**。资产域管"有哪些数据"，治理域管"哪份是权威、可不可信"——正如数据集是资产、质量规则是治理。
> 落地：轻量=金记录标注 + steward + 质量 + 主数据服务（复用现有模型）；重型 MDM 引擎（匹配 / 合并 / survivorship）深度待定（§7 待办、`biz-100` §1）。域内用能力键 `arda.governance.master_data` 单独开通 / 定价，无需拆独立域。

## 2. 现状

| 能力 | 现状 | 证据 |
|---|---|---|
| 数据标准（代码集/数据元库） | DB 支撑 | `(app)/standards/`（`Standard`） |
| 数据质量（规则+结果+六维评估） | DB 支撑 | `(app)/quality/`（`QualityRule`/`QualityResult`） |
| 数据血缘（图谱） | **静态 seed**（`LineageEdge` 已建表，UI 未接库） | `(app)/lineage/` |
| 数据安全（分级分布+共享审批+脱敏策略） | DB 支撑 | `(app)/security/`（`Policy` + `Dataset.classification`） |

## 3. 目标能力（feature-key）

| 键 | 能力 |
|---|---|
| `arda.governance.policies` | 访问/脱敏/留存策略 |
| `arda.governance.classification` | 自动/PII 分类 |
| `arda.governance.lineage` | 血缘图（数据集级） |
| `arda.governance.quality_rules` | 质量规则 + 检查 |

配额：`arda.quota.quality_checks_monthly`。

> 定价可在域内用 `arda.governance.lineage` 单独差异化（域开、键不开），无需拆独立域（functional-domains §2.2）。

## 4. 数据模型（delta）

| 实体 | 状态 | 关键点 |
|---|---|---|
| `Policy` | v1 | `type`(access/masking/retention/classification)、`scope`(dataset/tag/source)、`config`、`enabled` |
| `QualityRule` | v1 | `datasetId`、`dimension`、`type`(not_null/unique/range/freshness)、`severity` |
| `QualityResult` | v1 | `status`(pass/warn/fail)、`score`、`issues`；**质量总分派生自聚合**（不落库） |
| `Standard` | v1 | `type`(code-set/data-element)、`ref`、`status`(published/draft/review) |
| `LineageEdge` | v1（已建表） | `upstreamDatasetId→downstreamDatasetId`；**UI 未接库** |

> 主要差距是**血缘 UI 未对齐 v1 schema**（多类型节点图 vs `LineageEdge` 数据集级），非缺表。

## 5. 屏幕/交互 + 对外契约

- **屏幕**：standards、quality（含六维评估）、security（分级分布/脱敏策略/共享审批）、lineage（图谱）。
- **对外契约**：本板块产物（分级/质量/血缘）是数据对外可信度的核心信号，被 `biz-100` §3.3/§3.4 用作对外脱敏与溯源依据。

## 6. 门控（两轴）

- **订阅**：四键按档；`lineage` 可作增值键单独控制。
- **权限**：质量/标准/血缘**查看**全员（订阅内，只读）；**新建/改 `Policy`、改分级**建议 `admin+`（`arda.governance.policies` 有单独更高角色门槛，见 functional-domains §5.3）。

## 7. 待办

1. **血缘 UI 接库**：把 lineage 屏从静态 seed 改为读 `LineageEdge`；先做数据集级图，与 v1 schema 对齐（多类型节点留待列级 `Field`）。
2. 质量六维评估的聚合口径固化（派生值，不落库）。
3. `security` 的"共享审批"接审批流（与 `biz-210` 资产权限申请、`biz-240` 对外共享一致的审批设计）。
4. **主数据（MDM）深度决策 + 轻量落地**（`biz-100` §1）：先做轻量（金记录标注/steward/质量/服务）；重型匹配-合并-survivorship 是否 arda 内建，待产品决策——决策前不建 MDM 专用实体。
