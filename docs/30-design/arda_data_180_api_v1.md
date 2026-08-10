# arda 数据架构 · 对外 API v1 约定（arda_data_180_api_v1）

> 状态：权威设计 · 已落地（只读面 + 写操作 v1；身份透传与工具清单见 §6 路线）
> 层：arda 数据域 · 横切工程（对外消费接口面）
> 机器可读契约：`portals/app/openapi/arda-v1.yaml`（OpenAPI 3.1，与代码同 PR 演进；本文是约定的可读版）
> 上游/兄弟：消费契约总纲 [`data-170`](arda-data-170-platform-agent-support.md)；隔离 [`data-110`](arda-data-110-isolation.md)；审计 [`data-140`](arda-data-140-audit.md)；服务板块 [`data-240`](arda-data-240-services.md)；权益 [`ent-120`](arda-ent-120-consumption-contract.md)
> 实现落点：`portals/app/app/api/v1/**`（路由）、`portals/app/app/lib/api/**`（横切基建）、`portals/app/app/lib/reads/**`（领域读函数）

---

## 0. 范围与定位

本文钉死 arda 对外 HTTP API（`/api/v1`）的**通用约定**：认证链、错误模型、分页、限流、版本纪律。它是 [`data-170`](arda-data-170-platform-agent-support.md) 目标契约的第一段落地——只读元数据面（catalog / quality / lineage）。

定位（与统一入口的分工）：**arda 出稳定的 HTTP API + OpenAPI 契约；统一入口（RunOS）薄封装为 MCP 工具面**。契约归 arda 所有，协议震荡由入口层消化。数据字节的取用仍走 DataService 网关（`/api/services/{id}`，[`biz-441`](arda-biz-441-services.md)），本面只出**编目元数据与治理派生值**，不搬内容字节。

## 1. 认证链（每请求，顺序固定，fail-closed）

实现：`lib/api/auth.ts`。

| 步 | 检查 | 失败 |
|---|---|---|
| 1 | `x-arda-api-key` -> sha256 -> `ApiKey`（`revoked` 拒绝） | 401 `missing_api_key` / `invalid_api_key` |
| 2 | 按 key 限流（§4） | 429 `rate_limited` |
| 3 | key 的 `scopes` 含端点要求的 scope | 403 `insufficient_scope` |
| 4 | workspace 擦除收口（Lc-BL3） | 410 `workspace_wiped` |
| 5 | 权益：`hasDataAccess`（单独订阅 active/trialing/overdue **或** bundled，[`data-170`](arda-data-170-platform-agent-support.md) §2②） | 403 `entitlement_required` |

不变量：

- **workspace 归属永远来自 key**（`ApiKey.workspaceId`），调用方不能自选或伪造（[`data-110`](arda-data-110-isolation.md)）。
- **scope 是 fail-closed 白名单**：词表在 `lib/api/scopes.ts`（读:`catalog:read` / `quality:read` / `lineage:read`；写:`catalog:write` / `lineage:write` / `access:write`）。存量空 `scopes` 的 key 只能继续用 DataService 网关，不能进 `/api/v1`。
- 权益解析走既有 resolver（stale-on-error 降级为无权益），门控天然 fail-closed；tier/权益**永不来自凭证本身**（生产 token 零商业字段的既有裁定）。
- **写操作走数据取用门，不叠加产品 UI capability 矩阵**：`canUseFeature` 要求单独订阅 + tier，bundled-only workspace（tier=null）永远不过——但 [`data-170`](arda-data-170-platform-agent-support.md) §0/§3 明确 agent 可作为属主在 workspace 内产出/发布数据，这正是 bundled 场景。故 API 面统一以 `hasDataAccess` 收口（与 §2② 两门原则一致：产品 UI 门要求单独订阅，数据面接受 bundled）。若商业上要给 API 面单独分层，待 [`biz-260`](arda-biz-260-billing.md) 定义 API 专属键/指标后再加。
- 写操作沿用既有配额与业务不变量：dataset 注册受 `datasetMax` 配额（超限 403 `quota_exceeded`，不静默）；血缘写入拒绝环（DAG）与重复边；`ownerApp` 溯源一律来自凭证的 `consumerApp`，**不接受请求体指定**。
- `lastUsedAt` 每 key 每 60s 最多写一次（活性标记，best-effort）。

## 2. 错误模型（RFC 9457 problem+json）

实现：`lib/api/problem.ts`。所有非 2xx 响应体为 `application/problem+json`：

```json
{ "type": "https://arda.vxture.com/problems/<code>", "title": "...", "status": 403, "code": "insufficient_scope", "detail": "..." }
```

- **`code` 是稳定机读标识**（snake_case，延续网关既有词表：`not_found` / `workspace_wiped` 等）；`type` 由其派生，允许不可解引用（RFC 9457 许可）。
- 词表增改只做加法；语义变更 = 破坏性变更（§5）。
- 参数校验失败 -> 400 `invalid_parameter`（detail 列出全部 issue，不静默取默认值）；游标损坏 -> 400 `invalid_cursor`。

## 3. 分页（cursor-based）

实现:`lib/api/pagination.ts`。列表端点统一 `limit`（1-100，默认 20，越界回落默认）+ `cursor`（不透明 token，回传上页 `nextCursor`）；响应统一 `{ data: [...], nextCursor: string | null }`。排序固定为稳定复合序（尾键 = 唯一 id），Prisma 原生 cursor 分页，无 offset 漂移。**不用 offset 分页**（深页拖垮 Postgres，agent 重试是常态）。

## 4. 限流（保护性,per-key）

实现：`lib/api/rate-limit.ts`。固定窗口每分钟（`API_RATE_LIMIT_PER_MINUTE`，默认 120），Redis `apirl:*` 键族。超限 429 + `Retry-After` / `RateLimit-*` 头。**限流是过载保护，不是授权**——Redis 不可用时 fail-open（记日志放行），授权链（§1）不受影响。商业配额（按 tier 计量计费）是另一层，走 [`biz-260`](arda-biz-260-billing.md) 的计量体系，本面 v1 不计量（§6）。

## 4b. 写操作幂等（Idempotency-Key）

实现：`lib/api/idempotency.ts` + `lib/audit.ts`。agent 重试是常态，所有 POST 接受可选 `Idempotency-Key` 头（可打印 ASCII，1-180 字符）：

- 创建事务把审计行**连同幂等键**一并写入，落在 `AuditLog.idempotencyKey @unique` 上（[`data-140`](arda-data-140-audit.md) §2.1 范式一的 API 面应用）——存储层唯一约束就是防重放，无运行时状态。
- 客户端键入库前按 workspace 命名空间化（`api:<ws>:<key>`）：列是全局唯一，但幂等是 per-caller 契约，两个 workspace 撞同键不得互相干扰。
- 重放：唯一冲突 -> 回查原审计行 -> 按 `target` 取回原资源 -> 200 + `idempotency-replayed: true` 头返回原结果。
- 同键复用于**不同操作**（或原资源已消失）-> 409 `idempotency_conflict`。
- 审计写入统一走 `lib/audit.ts` 的 `writeAudit`（单写入点；存量 action 文件的 25 处内联写入迁移为独立机械 PR）。

## 5. 版本与演进纪律

- 路径版本 `/api/v1`；v1 内**只做加法**（新增可选字段/新端点）。
- 破坏性变更（删字段/改语义/改错误码语义）开 `/api/v2`，弃用端点回 `Deprecation`/`Sunset` 头并给迁移窗口。
- OpenAPI 文件与实现同 PR 演进，漂移即 bug。

## 6. v1 端点与后续路线

只读端点（scope / 路由 / 读函数）：

| 端点 | scope | 说明 |
|---|---|---|
| `GET /api/v1/datasets` | `catalog:read` | 目录列表（租户 + 平台参考只读叠加；q/domain/classification/type 过滤） |
| `GET /api/v1/datasets/{id}` | `catalog:read` | 资产画像（source/tags/standards/services + 质量派生摘要 + 血缘度数） |
| `GET /api/v1/quality-rules` | `quality:read` | 质量规则（纯租户数据，无平台叠加） |
| `GET /api/v1/quality-results` | `quality:read` | 质检运行结果（runAt 倒序） |
| `GET /api/v1/lineage` | `lineage:read` | 数据集级血缘边表 + 名称映射（500 边上限，`truncated` 显式上报） |

写端点（全部支持 `Idempotency-Key`，§4b）：

| 端点 | scope | 说明 |
|---|---|---|
| `POST /api/v1/datasets` | `catalog:write` | agent 注册其产出的数据集（`ownerApp` = 凭证 `consumerApp`；受 `datasetMax` 配额；重复 code 409） |
| `POST /api/v1/lineage` | `lineage:write` | 声明一条血缘边（双端必须是本 workspace 租户资产；拒环 409 `cycle_detected`；重复边 409） |
| `POST /api/v1/access-requests` | `access:write` | 提交访问申请，落入审批中心 `pending`；审批决策仍是人在产品 UI 完成 |

已定但**有意不做**的（记录决策，防止误读为遗漏）：

- **元数据读不逐次落审计**：`AuditLog` 审计的是数据取用与变更（[`data-140`](arda-data-140-audit.md)）；目录列表逐次落审计会灌满审计表。数据字节出口（DataService 网关）保持逐次审计不变。
- **读不计量**：`service.api.call` 是 DataService 取用的计费指标，编目元数据读不挪用该指标；API 面计量待 [`biz-260`](arda-biz-260-billing.md) 定义专属指标后接入。

后续（第三步及机械收尾）：token exchange 身份透传（RFC 8693，替代/并行 ApiKey）、`.well-known/vxture-tools` 工具清单填充（面向任务的粗粒度工具，非 CRUD 镜像）、存量审计写入点迁移到 `writeAudit`、apikeys UI 的 scope 选择器。

## 变更规程

- 字段/枚举以 `portals/app/prisma/schema.prisma` 逐字为准；响应形状变更先改 `openapi/arda-v1.yaml` 再改实现，同 PR 落地。
- 认证链顺序（§1）与错误词表（§2）是对外承诺，改动按 §5 版本纪律走。
- 每接通一条 [`data-170`](arda-data-170-platform-agent-support.md) §6 的链路，同步更新该表与 [`data-300`](arda-data-300-migration.md)。
