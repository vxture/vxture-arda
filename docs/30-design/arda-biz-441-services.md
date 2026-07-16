# 数据服务 功能设计（arda-biz-441-services）

> 状态：功能层 · 功能设计（待评审）
> 模板/看板：[`biz-400`](arda-biz-400-functions.md)；数据模型：[`data-240`](arda-data-240-services.md)；对外契约：[`arda-data-170-platform-agent-support.md`](arda-data-170-platform-agent-support.md)

---

## 1. 功能定义

把可信资产封装为 **API / 查询 / 导出 / 共享**，对外**可用且可观测**；**对外契约不变量**（隔离/权益/分级过滤/审计/配额）在 arda 侧收口。数据价值链出口。

## 2. 贯通链（目标 → 过程 → 结果 → 服务 → 监管）

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| **目标·定义** | 服务规划 / 接口设计 / 共享策略 | `DataService{code, path, method, type(rest_api/query/export/share), level}` | 服务定义 → 供发布 |
| **过程·执行** | 发布/编辑/下线、关联资产、生成密钥 | `DataService` + `DataServiceDataset` + `ApiKey`；**发布校验质量/分级** | 已发布服务 → 供调用 |
| **结果·看** | 服务目录（≠数据目录）、发布状态、调用统计 | `DataService` 列表 + telemetry | — |
| **服务·用（本功能核心）** | 对外被调用取数 | 契约不变量：workspace 隔离 + 权益 + **分级过滤（Sec）** + `ApiKey` + **配额** | 数据出 → 消费方 |
| **监管·审计** | 调用审计、服务变更、配额监测 | `AuditLog{action: service.call/change}` + quota 计量 | 审计/计量 |

## 3. 断链清单

| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `Svc-BL1` | 服务：对外契约不变量未收口 | 分级过滤/ApiKey 校验/调用审计/配额部分未接 | 收口不变量（隔离已有；补分级/密钥/审计/配额） | `biz-435`/`biz-451` |
| `Svc-BL2` | 过程：quality-gate 未接 | 发布不校验资产质量 | 发布/调用校验质量分（对应 Q-BL2） | `biz-433` |
| `Svc-BL3` | 结果：调用统计/监测占位 | telemetry 未建模，统计是展示占位 | telemetry 建模（真实调用统计） | future |
| `Svc-BL4` | 监管：请求量计量点未定 | `api_requests_monthly` 在 arda 计数 vs 平台网关 | 与 `plat`（对接）维度定计量点 | 平台 |
| `Svc-BL5` | 监管：服务/调用审计未接 | ✅ **部分接通**：调用侧 `api/services/[serviceId]` 每次调用落 `AuditLog{action:"service.access"}`（#102）；**服务变更（创建/编辑 `DataService`）仍无 UI/action，尚无从审计** | 服务变更管理落地后补写入 | `biz-451`/admin |

> 服务是**多功能结果的汇出口**：质量（准入）、安全（过滤）、血缘（可溯源）在此对外兑现。`Svc-BL1/BL2` 是"可信数据安全地用出去"的闭合点。

## 4. 数据模型（da delta）

- **已建**：`DataService`、`DataServiceDataset`、`ApiKey`。
- **future**：telemetry（调用统计）。
- **实现要点**：发布 pipeline（选资产→校验质量/分级→发布）；对外响应按分级脱敏（`biz-435`）；调用经 `ApiKey`。

## 5. 依赖

| 依赖 | 用途 | 断链 |
|---|---|---|
| 资产（`biz-421`） | 选可信资产 | — |
| 质量（`biz-433`） | quality-gate 准入 | Svc-BL2 |
| 安全（`biz-435`） | 分级过滤/脱敏 | Svc-BL1 |
| 管理（`biz-451`/admin） | ApiKey、调用审计 | Svc-BL1/BL5 |
| 平台（计量） | 请求量配额 | Svc-BL4 |

## 6. 门控（能力键）

- 发布服务：`arda.services.publish_api`；数据产品/对外共享：`arda.services.data_products`（发布 = `admin`）。
- 配额：`arda.quota.service_endpoints`、`arda.quota.api_requests_monthly`。
