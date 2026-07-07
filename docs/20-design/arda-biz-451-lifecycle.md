# 数据生命周期 功能设计（arda-biz-451-lifecycle）

> 状态：功能层 · 功能设计（待评审）
> 模板/看板：[`biz-400`](arda-biz-400-functions.md)；数据模型：`Policy(type=retention)` + `AuditLog`（da §4.3/§4.5）；wipe：[`ADR §5.1`](../ADR-entitlement-and-workspace.md)、[`arda-data-arch-workplan.md`](arda-data-arch-workplan.md) §2

---

## 1. 功能定义

管数据的**留存、归档、销毁**（含平台 `wipe`）；到期处置 + 可审。**规则在治理域、执行/审计在管理域**（`biz-100` §1 跨域维度）。

## 2. 贯通链（目标 → 过程 → 结果 → 服务 → 监管）

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| **目标·定义** | 留存/归档/销毁策略 | `Policy{type=retention, config}` + `arda.quota.history_retention_days` | 策略 → 供执行 |
| **过程·执行** | 到期归档/销毁；平台 `wipe`（软删 + 延迟硬删） | 生命周期执行器 + **软删标记**（`deletedAt`）；`wipe` 走平台指令通道 | 处置动作 → 供留痕 |
| **结果·看** | 留存状态、待销毁清单、归档记录 | 聚合 retention 状态 | — |
| **服务·用** | 过期数据下线（影响服务可用性） | 服务/画像过滤已销毁/归档数据 | — |
| **监管·审计** | 归档/销毁/wipe 审计（幂等防重放） | `AuditLog{action: lifecycle.*, idempotencyKey}` | 审计流水 |

## 3. 断链清单

| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `Lc-BL1` | 过程：销毁/归档执行缺 | retention `Policy` 只是规则，无到期执行器 | 建到期扫描 + 归档/销毁执行 | — |
| `Lc-BL2` | 过程：`wipe` 未实现 | 平台指令通道未接（`workplan §2`） | 内部端点 + 鉴权 + 幂等 + 软删/延迟硬删 | `plat`（平台） |
| `Lc-BL3` | 过程：软删列缺 | schema 无 `deletedAt`，软删无处落 | **软删 schema 决策**（多表加 `deletedAt`） | da（迁移决策） |
| `Lc-BL4` | 监管：生命周期审计未接 | `AuditLog.idempotencyKey` 已建、无写入 | 补写入点（幂等） | admin |

> 关键 = `Lc-BL3`（软删 schema 决策）是 `Lc-BL1/BL2` 的前置：没有软删列，wipe 的"软删+延迟硬删"无处落。这是本功能唯一需要 schema 决策的点。

## 4. 数据模型（da delta）

- **已建**：`Policy(type=retention)`、`AuditLog{idempotencyKey @unique}`。
- **delta（Lc-BL3）**：相关业务表加 `deletedAt DateTime?`（软删）——**跨多表的 schema 决策**，需单列迁移（见 workplan §2.4）。
- **实现要点**：到期扫描/执行器；`wipe` 幂等（`idempotencyKey`）；软删过滤（查询默认排除 `deletedAt`）。

## 5. 依赖

| 依赖 | 用途 | 断链 |
|---|---|---|
| 治理（`biz-435` 策略） | retention 规则 | — |
| 管理/admin | 执行 + 审计 | Lc-BL4 |
| 平台指令通道（`plat`） | wipe 下发 | Lc-BL2 |
| da（软删迁移） | deletedAt | Lc-BL3 |

## 6. 门控（能力键）

- **权限为主**（`owner`/`admin`）：归档/销毁是不可逆或高风险动作。
- retention 规则：`arda.governance.policies`（治理侧）。
- 配额：`arda.quota.history_retention_days`。
