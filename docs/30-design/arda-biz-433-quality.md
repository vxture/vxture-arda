# 数据质量 功能设计（arda-biz-433-quality）

> 状态：功能层 · 功能设计（样板 · 待评审）
> 范围：**数据质量功能的端到端贯通 + 实现**（不涉及导航 / 页面归组，那是看和组织层）
> 模板/看板：[`biz-400`](arda-biz-400-functions.md)；数据模型：[`data-230`](arda-data-230-governance.md)；门控：`arda-functional-domains-and-entitlement.md`

---

## 1. 功能定义

让数据的**可信度可度量、可管、可作为服务准入依据**。核心链：定规则 → 跑质检 → 出分数 → 卡服务 → 留审计。

## 2. 贯通链（目标 → 过程 → 结果 → 服务 → 监管）

| 环 | 做什么 | 靠什么实现（实体/操作） | 接下一环（产出→输入） |
|---|---|---|---|
| **目标·定义** | 定质量维度（六维：完整/准确/有效/唯一/及时/一致）、规则、阈值/严重级 | `QualityRule{datasetId, dimension, type(not_null/unique/range/freshness/...), config, severity, enabled}`；建/改规则操作 | 规则 → 供执行器消费 |
| **过程·执行** | 按规则跑检查（定时/触发/手动） | 质检执行器：读 `QualityRule` → 跑 → 写 `QualityResult{ruleId, datasetId, status(pass/warn/fail), score, issues, runAt, details}` | 结果 → 供聚合 |
| **结果·看** | 单规则结果 + 数据集质量分（聚合）+ 六维评估 + 趋势 | 聚合 `QualityResult` → **质量分派生（不落库）**；在资产画像展示（看和组织层负责摆放） | 质量分 → 供服务准入读取 |
| **服务·用** | 质量作为 `DataService` 准入 / 降权 | 发布/调用前读关联 `Dataset` 质量分，低于阈值则拒绝/告警/标注（quality-gate） | 达标数据 → 对外服务 |
| **监管·审计** | 规则变更、质检失败告警、SLA 违约留痕 | `AuditLog{action: quality.rule.change / quality.alert, target, actor, metadata}` | 审计流水 → 合规/追溯 |

**贯通判据核对**：目标产 `QualityRule` → 过程消费它产 `QualityResult` → 结果聚合成质量分 → 服务读质量分卡准入 → 监管留痕。链路概念完整。**但下面 §3 有三处实现断链。**

## 3. 断链清单（喂 `biz-400` §3 与 `biz-300`）

| 编号 | 断链（哪一环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `Q-BL1` | 过程：无真实调度 | ✅ **已接通（2026-07-14）**：`runWorkspaceChecks` 手动触发——规则按源分组、经连接器**下推 SQL 到源库执行**（not_null/unique/range/freshness/row_count 五型，活库实测；标识符强校验防注入），写 `QualityResult`；无连接器数据集显式跳过并计数；**同时接通首个 C3 consume 触发点**（`quality.check.run` divisible 后报 + 配额预闸）。周期化接 scheduling（future） | `biz-410`/future |
| `Q-BL2` | 服务：准入未接 | ✅ **已接通（2026-07-14）**：`qualityGate` + `publishDataService`——发布前读关联数据集派生质量分（不落库）；关联数据集存在严重级 fail = **拦截发布**（审计 `service.publish_blocked`）；低分/从未质检 = 预警放行（记入发布审计）。调用期拦截/降权 = 后续 | `biz-441` |
| `Q-BL3` | 监管：审计未接 | ✅ **已接通（2026-07-17）**：质检运行 `quality.run`/告警 `quality.alert`、发布 `service.publish`/`service.publish_blocked`、规则 CRUD（`quality.rule.create`/`enable`/`disable`/`delete`）均已落 `AuditLog`；规则创建/启停/删除界面已建（`/quality`） | `biz-451`/admin |
| `Q-BL4` | 目标：阈值/SLA 未显式建模 | `QualityRule` 有 `severity` 无 `threshold` | 先用 `config`（Json）承载阈值/SLA，避免迁移；确有需要再加字段 | da（可选） |

> **本功能"贯通"的真正工作 = 接通 Q-BL1~3**（Q-BL4 是建模优化）。Q-BL1（能真跑）与 Q-BL2（能卡服务）是让质量"活起来"的关键两环。

## 4. 数据模型（实现 · da delta）

- **已建**（da §4.3，无结构大改）：`QualityRule`、`QualityResult`，均带 `workspaceId`、`@@unique([workspaceId, code])`（Rule）。
- **delta（可选，Q-BL4）**：阈值/SLA 先放 `QualityRule.config`（Json）；若要强类型再评估加 `threshold Float?` / `slaConfig Json?`（单列迁移）。
- **派生（不落库）**：数据集质量分 = `QualityResult` 聚合（`biz-100` §3.5 可推导优于可存储）。
- **关键操作**：`createRule / updateRule`、`runChecks(datasetId|ruleId)`（Q-BL1 新增）、`aggregateScore(datasetId)`（结果环）、`qualityGate(dataServiceId)`（Q-BL2 新增）。

## 5. 依赖

| 依赖 | 用途 | 断链 |
|---|---|---|
| 调度（`biz-410` 集成 / scheduling future） | 周期化跑质检 | Q-BL1（先手动触发解耦此依赖） |
| 数据服务（`biz-441`） | 质量准入 quality-gate | Q-BL2 |
| 审计（`biz-451` / admin `AuditLog`） | 变更/告警留痕 | Q-BL3 |
| 资产画像（`biz-421` 结果面展示） | 展示质量分（看和组织层摆位） | 无（展示层） |

## 6. 门控（能力键，不涉及导航）

- 建/改规则、跑质检：`arda.governance.quality_rules`（写操作，`admin`/`steward` 角色）。
- 看质量分（画像）：`arda.assets.catalog` baseline（只读，轻门控）。
- 配额：`arda.quota.quality_checks_monthly`（跑质检次数/月，平台计量）。

> 门控只判"能不能做这个功能动作"，与"这个功能在哪个菜单/页面"（看和组织层）无关。
