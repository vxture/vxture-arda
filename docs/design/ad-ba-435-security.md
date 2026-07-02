# 数据安全 功能设计（ad-ba-435-security）

> 状态：功能层 · 功能设计（待评审）
> 模板/看板：[`ba-400`](ad-ba-400-functions.md)；数据模型：[`arda-data-architecture-schema.md`](arda-data-architecture-schema.md) §4.3（`Policy`）+ `Dataset.classification`

---

## 1. 功能定义

给数据**分级**、**脱敏/加密**、**访问控制**；**分级随数据流出**（对外按分级脱敏，agent-support §3.2）。治理域。

## 2. 贯通链（目标 → 过程 → 结果 → 服务 → 监管）

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| **目标·定义** | 分级体系 / 合规目标 / 脱敏策略 | `Policy{type(access/masking/retention/classification), scope, config}`、`AssetLevel` | 策略 → 供执行 |
| **过程·执行** | 分类（打分级）、配脱敏/加密/访问策略、共享审批 | `Dataset.classification` + `Policy` CRUD + 审批 | 策略 → 供服务过滤 |
| **结果·看** | 分级分布、敏感标识、策略覆盖 | 聚合 classification + Policy 覆盖 | 分级 → 画像结果面（`ba-421`） |
| **服务·用** | 安全过滤服务（对外按分级脱敏/裁剪） | 服务响应按 `classification`+`Policy(masking)` 脱敏（`ba-441`） | — |
| **监管·审计** | 访问审计、策略变更、脱敏执行留痕 | `AuditLog{action: access / policy.change}` | 审计流水 |

## 3. 断链清单

| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `Sec-BL1` | 服务：脱敏/加密执行缺 | `Policy(masking)` 只是规则，无执行器在服务/查询层生效 | 脱敏执行器（服务响应/查询时应用） | `ba-441` |
| `Sec-BL2` | 服务：对外分级过滤未接 | `DataService` 响应不按 classification 脱敏 | 对外契约收口（分级过滤） | `ba-441` |
| `Sec-BL3` | 监管：访问审计未接 | 对外/敏感访问不落 `AuditLog` | 补访问审计写入 | `ba-451`/admin |
| `Sec-BL4` | 过程：共享审批流未接 | 资产权限申请表单已建、未接审批（`ba-210`） | 落审批流（与标准/生命周期审批一致） | — |
| `Sec-BL5` | 过程：自动分类缺 | PII/自动识别未实现（手动分级） | 自动分类（`arda.governance.classification`） | — |

> 关键 = `Sec-BL1/BL2`（脱敏与对外过滤真生效）：分级若不影响对外输出，就只是"标签"，安全没闭环。

## 4. 数据模型（da delta）

- **已建**：`Policy`、`Dataset.classification`（`AssetLevel`）。
- **实现要点**：脱敏执行器（读 Policy→改服务响应）；`connectionConfig` 等加密（与 `ba-410` 共）；无结构大改。

## 5. 依赖

| 依赖 | 用途 | 断链 |
|---|---|---|
| 资产（`ba-421`） | 分级挂 Dataset、画像 | — |
| 服务（`ba-441`） | 分级过滤/脱敏对外 | Sec-BL1/BL2 |
| 审计（`ba-451`/admin） | 访问审计 | Sec-BL3 |
| 集成（`ba-410`） | connectionConfig 加密 | — |

## 6. 门控（能力键）

- 配策略/脱敏/访问：`arda.governance.policies`（写 = `admin`）。
- 分类/自动分类：`arda.governance.classification`。
- 看分级（画像）：`arda.assets.catalog` baseline（只读）。
