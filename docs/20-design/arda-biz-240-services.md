# 数据服务 板块详细设计（arda-biz-240-services）

> 状态：第 2 层 · 详细设计（待评审）· 板块 `services`
> 上游：[`biz-100`](arda-biz-100-architecture.md)、[`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md) §2.4/§3、[`data-240`](arda-data-240-services.md)、[`arda-data-platform-agent-support.md`](arda-data-platform-agent-support.md)（对外契约）
> 跨切面见 `biz-100` §3

---

## 1. 板块定位

把可信资产**封装为 API/查询/导出/共享**，让数据"可用"——价值链最右端，也是 arda **对外（含被智能体消费）的主契约**（`biz-100` §3.4）。

## 2. 现状

| 能力 | 现状 | 证据 |
|---|---|---|
| 服务/API 目录（发布状态、调用统计） | DB 支撑 | `(app)/service/`（`DataService`） |

> 调用统计为展示聚合（telemetry v1 未建模，派生/占位）。

## 3. 目标能力（feature-key）

| 键 | 能力 |
|---|---|
| `arda.services.publish_api` | 发布数据服务/API |
| `arda.services.data_products` | 数据产品/对外共享 |

配额：`arda.quota.service_endpoints`（已发布服务数）、`arda.quota.api_requests_monthly`（对外请求量）。

## 4. 数据模型（delta）

| 实体 | 状态 | 关键点 |
|---|---|---|
| `DataService` | v1 | `code`(ws 内唯一)、`path`、`method`、`type`(rest_api/query/export/share)、`level`(AssetLevel)、`status`(draft/running/review/paused)、`publishedAt` |
| `DataServiceDataset` | v1 | 与 `Dataset` 的 M:N（服务暴露哪些资产） |
| `ApiKey` | v1（见 `biz-250`） | 调用服务的凭证（存哈希、scoped、可吊销） |

> 无 schema 新增。服务与 `ApiKey`/`AuditLog`（`biz-250`）协同构成对外契约。

## 5. 屏幕/交互 + 对外契约（重点板块）

- **屏幕**：service 目录（发布状态、类型、调用统计）+ 发布/编辑。
- **对外契约不变量**（`biz-100` §3.4、agent-support §3.2）——发布/被调用时必须成立：
  1. **workspace 隔离**：服务只返回本 `workspaceId` 数据。
  2. **权益门控**：发布受 `arda.services.publish_api`；服务数受 `arda.quota.service_endpoints`。
  3. **分级/策略过滤**：响应按 `DataService.level` + 关联 `Dataset.classification` + `Policy` 脱敏。
  4. **凭证与审计**：调用经 `ApiKey`；对外取数落 `AuditLog`（可溯源）。
  5. **配额**：请求量受 `arda.quota.api_requests_monthly`（平台计量，只报数字）。

## 6. 门控（两轴）

- **订阅**：`publish_api` 基线发布能力；`data_products`（对外共享）增值；配额限服务数/请求量。
- **权限**：**发布/下线服务、生成调用凭据**属敏感写，建议 `admin+`；查看目录全员（订阅内）。

## 7. 待办

1. 明确对外响应如何**携带分级/来源**（响应头/字段），使消费方承接分级（agent-support §7 待确认 2）。
2. `arda.quota.api_requests_monthly` 计量点：arda 服务层计数上报 vs 平台网关计量——与 `plat`（对接）维度对齐。
3. 调用统计从占位改为真实 telemetry（需 telemetry 建模，非本板块 v1）。
