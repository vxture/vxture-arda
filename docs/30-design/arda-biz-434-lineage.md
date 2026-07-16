# 数据血缘 功能设计（arda-biz-434-lineage）

> 状态：功能层 · 功能设计（待评审）
> 模板/看板：[`biz-400`](arda-biz-400-functions.md)；数据模型：[`data-230`](arda-data-230-governance.md)（`LineageEdge`）

---

## 1. 功能定义

记录数据集级**来源 → 下游**链接，支撑**溯源**与**影响分析**（改这份数据会影响谁）。治理域。

## 2. 贯通链（目标 → 过程 → 结果 → 服务 → 监管）

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| **目标·定义** | 血缘覆盖目标 / 采集范围 | 采集策略（哪些源/管道采血缘） | 采集范围 → 供采集 |
| **过程·执行** | 采集 / 打标 / 校正血缘 | `LineageEdge{upstreamDatasetId→downstreamDatasetId, transform, jobId}` CRUD / 自动采集 | 血缘边 → 供成图 |
| **结果·看** | 血缘图、影响分析 | 读 `LineageEdge` 成图；上下游遍历 | 血缘图 → 画像结果面（`biz-421`） |
| **服务·用** | 血缘作为可溯源能力（服务/交付引用可回链） | 服务响应携带来源（`biz-441`/agent-support） | — |
| **监管·审计** | 血缘变更审计 | `AuditLog{action: lineage.change}` | 审计流水 |

## 3. 断链清单

| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `L-BL1` | 结果：UI 未接库 | ✅ **已接通（2026-07-14）**：血缘图全量读库——节点 = `DataSource`（源）+ `Dataset`（`LineageEdge` 数据集级血缘）+ `DataService`（服务出口），三类真实实体成图；最长路径分层布局（纯函数，环安全）；主题选择器（?dataset=）；孤立节点裁剪 + 200 节点上限显式提示 | `biz-421` |
| `L-BL2` | 过程：自动采集缺 | ✅ **手动录入已贯通（2026-07-14）**：录边对话框（admin + `arda.governance.lineage`），端点同 workspace 校验、去重、**成环拒绝**（DAG 不变量服务端强制）。自动采集接管道 = future | `biz-410`/future |
| `L-BL3` | 结果：影响分析未实现 | ✅ **已接通（2026-07-14）**：主题数据集的下游闭包遍历——受影响数据集/服务计数 + 名单，随主题实时派生（不落库） | — |
| `L-BL4` | 监管：血缘审计未接 | ✅ **已接通（2026-07-14）**：录边落 `AuditLog{action: lineage.change}`（含上下游名称与变换说明） | `biz-451`/admin |

> 关键 = `L-BL1`（接库）：表已建、UI 是静态，接上即让血缘"活"。

## 4. 数据模型（da delta）

- **已建**：`LineageEdge`（v1，数据集级，`@@unique([upstreamDatasetId, downstreamDatasetId])`）。
- **future**：列级血缘需 `Field`（列级建模驱动）。
- **实现要点**：图遍历（影响分析）；节点 = `Dataset`。

## 5. 依赖

| 依赖 | 用途 | 断链 |
|---|---|---|
| 资产（`biz-421`） | 节点=Dataset、画像血缘图 | L-BL1 |
| 集成（`biz-410`/管道 future） | 自动采集血缘 | L-BL2 |
| 服务（`biz-441`） | 可溯源服务 | — |
| 审计（`biz-451`/admin） | 血缘审计 | L-BL4 |

## 6. 门控（能力键）

- 打标/校正血缘、影响分析：`arda.governance.lineage`（写 = `admin`/`steward`）。
- 看血缘图（画像）：`arda.assets.catalog` baseline（只读）。
