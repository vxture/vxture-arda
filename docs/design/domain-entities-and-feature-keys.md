# arda 领域实体与 feature-key 目录（v1）

> 状态：设计定稿（已批准）· 范围：arda 产品的领域数据模型与门控能力目录
> 上游：`docs/ADR-entitlement-and-workspace.md`（订阅权益 + workspace 隔离 + 模板填充）
> 下游：本文件是 §8.0–8.2（领域 schema 落地）与 §8.4（门控重设计）的直接输入
> 用途：作为 AI coding（Claude Code / Codex）的实现输入

---

## 0. 前置说明

- 产品名：**智能数据中台**（arda）。早期原型 `城市数据中台 / data-arda.html` 仅作布局参考，**内容需按通用智能数据平台重新设计**，不沿用任何城市/政务专有数据。
- arda 是 **数据资产 / 治理平台**。本目录只涵盖数据资产与治理能力，**不掺任何身份 / 账号 / 计费 / 席位能力**——那些归 vxture 平台与 IdP（见 ADR §1.7 数据所有权边界）。
- **v1 = catalog-first**：只做「资产目录 + 元数据 + 治理」。集成（数据搬运）与列级治理留待后续。

---

## 1. 全局约定

- **隔离键**：所有领域实体均带 `workspaceId`，查询强制按其过滤（ADR 原则 #5）。下表省略不再重复。
- **所有权边界**：下列均为 **arda 自有业务数据**。平台 / IdP 持有、本目录**不建模**的：`Org`、workspace 生命周期、`Subscription`、成员 / 角色 / 席位、计费、SSO / 高级账号安全。
- **命名规范**：能力键 `arda.<group>.<capability>`（布尔）；配额键 `arda.quota.<name>`（数值）。`group` 映射导航分区：`assets / integration / governance / services / admin`。
- **能力键归属**：feature-key 的「键」由产品（arda）定义；「每档开放哪些键 + 配额数值」由平台订阅配置下发（ADR §3.4）。arda 不硬编码「档位 → 功能」映射。
- **future 约定**：标 `future` 的实体与 feature-key **保留定义、不删不隐藏**。前端对其入口统一渲染「正在开发中，敬请期待」占位；门控对 `future` 键**视为未开放 → 展示占位，而非报错**。

---

## 2. Part A — 领域实体

### 2.1 数据资产（assets）

| 实体 | 状态 | 用途 | 关键字段 | 关系 |
|---|---|---|---|---|
| **Dataset** | v1 | 核心已编目资产 | `name, type(table\|view\|file\|stream), location, rowCountEst, sizeBytes, ownerUserId, classification, updatedAt` | ← DataSource；→ QualityResult, LineageEdge |
| **Tag** | v1 | 自由标签 | `name, color` | M:N Dataset |
| **GlossaryTerm** | v1 | 业务术语表 | `term, definition, stewardUserId` | M:N Dataset |
| **Field** | future | 列级 schema（列级治理 / 血缘时再加） | `name, dataType, nullable, description, classification, position` | → Dataset |

> v1 治理粒度到 **数据集级**；暂不建 Field（列级）。

### 2.2 集成（integration）

| 实体 | 状态 | 用途 | 关键字段 | 关系 |
|---|---|---|---|---|
| **DataSource** | v1（仅登记） | 登记外部系统连接 + 拉取 schema / 元数据，**不做实际数据搬运** | `name, type(postgres\|s3\|bigquery\|rest\|file\|...), connectionConfig(encrypted), status, lastSyncedAt` | → Dataset |
| **Pipeline** | future | 同步 / 变换定义 | `name, sourceId, targetDatasetId, schedule, transformConfig, enabled` | ← DataSource；→ JobRun |
| **JobRun** | future | 一次管道执行 | `pipelineId, startedAt, finishedAt, status, rowsProcessed, error` | ← Pipeline |

### 2.3 治理（governance，数据集级）

| 实体 | 状态 | 用途 | 关键字段 | 关系 |
|---|---|---|---|---|
| **Policy** | v1 | 访问 / 脱敏 / 留存 / 分级规则 | `name, type, scope(dataset\|tag\|source), config, enabled` | M:N Dataset（via scope） |
| **QualityRule** | v1 | 数据质量检查定义（数据集级） | `datasetId, type(not_null\|unique\|range\|freshness\|...), config, severity, enabled` | → Dataset |
| **QualityResult** | v1 | 一次检查结果 | `ruleId, datasetId, runAt, status(pass\|warn\|fail), score, details` | ← QualityRule |
| **LineageEdge** | v1 | 上游→下游链接（数据集级） | `upstreamDatasetId, downstreamDatasetId, transform, jobId?` | Dataset↔Dataset |

> 质量总分 = QualityResult 聚合；治理覆盖率 = 被 Policy 覆盖的 Dataset 占比。

### 2.4 服务（services）

| 实体 | 状态 | 用途 | 关键字段 | 关系 |
|---|---|---|---|---|
| **DataService** | v1 | 将数据资产封装为 API / 端点 / 导出 | `name, datasetIds[], type(rest_api\|query\|export\|share), config, status, publishedAt` | M:N Dataset |

### 2.5 管理（admin）

| 实体 | 状态 | 用途 | 关键字段 | 关系 |
|---|---|---|---|---|
| **ApiKey** | v1 | 调用 DataService 的凭证 | `name, hashedKey, scopes[], lastUsedAt, revoked` | → DataService |
| **AuditLog** | v1 | 活动 + 平台指令审计（ADR §5.1） | `actorUserId\|"platform", action, target, idempotencyKey, timestamp, metadata` | 横切 |

### 2.6 基础设施（非用户面向，ADR 要求）

| 实体 | 状态 | 用途 | 说明 |
|---|---|---|---|
| **WorkspaceRef** | v1 | 平台 workspace 的本地镜像，用于隔离 | `id(=active_workspace), orgId, seedStatus`；**不持有生命周期**（ADR §5） |
| **SeedTemplate / TemplateVersion** | v1 | 只读、版本化的示例数据内容（ADR §4.2） | **非** workspace 隔离——全局、平台 / 运营策展 |

---

## 3. Part B — feature-key 目录

### 3.1 能力键（布尔）

| 键 | 状态 | 门控 |
|---|---|---|
| `arda.assets.catalog` | v1 | 浏览 / 搜索目录（基线） |
| `arda.assets.edit_metadata` | v1 | 编辑描述 / 标签 / 分级 |
| `arda.assets.glossary` | v1 | 业务术语表 |
| `arda.assets.advanced_search` | v1 | 保存 / 语义 / 高级搜索 |
| `arda.assets.bulk_ops` | v1 | 批量打标 / 分类 |
| `arda.integration.sources_basic` | v1 | 登记基础数据源（file / db） |
| `arda.integration.sources_premium` | v1 | 高级连接器（数仓 / SaaS） |
| `arda.integration.pipelines` | future | 构建管道 / 变换 |
| `arda.integration.scheduling` | future | 定时同步 |
| `arda.integration.realtime` | future | 流式 / CDC |
| `arda.governance.policies` | v1 | 访问 / 脱敏 / 留存策略 |
| `arda.governance.classification` | v1 | 自动 / PII 分类 |
| `arda.governance.lineage` | v1 | 血缘图（数据集级） |
| `arda.governance.quality_rules` | v1 | 质量规则 + 检查 |
| `arda.services.publish_api` | v1 | 发布数据服务 / API |
| `arda.services.data_products` | v1 | 数据产品 / 对外共享 |
| `arda.admin.api_keys` | v1 | API key 管理 |
| `arda.admin.audit_log` | v1 | 查看 / 导出审计日志 |

> 已移除：`arda.admin.advanced_security`（SSO / 高级安全属身份层，归平台 / IdP）。

### 3.2 配额键（数值）

| 键 | 状态 | 限制 |
|---|---|---|
| `arda.quota.data_sources` | v1 | 登记数据源数 |
| `arda.quota.datasets` | v1 | 编目数据集数 |
| `arda.quota.storage_bytes` | v1 | 管理存储上限 |
| `arda.quota.ai_calls_monthly` | v1 | AI 调用 / 月（见 §3.3） |
| `arda.quota.quality_checks_monthly` | v1 | 质量检查 / 月 |
| `arda.quota.service_endpoints` | v1 | 已发布服务数 |
| `arda.quota.api_requests_monthly` | v1 | 数据服务请求量 |
| `arda.quota.history_retention_days` | v1 | 审计 / 版本留存 |
| `arda.quota.pipeline_runs_monthly` | future | 管道运行 / 月 |

> 已移除：`arda.quota.members`（席位 / 成员归平台订阅层，违反 §1.7）；重复的 `arda.quota.pipeline_runs_monthly`（仅保留一条，标 future）。

### 3.3 AI 配额对接（已确认）

- `arda.quota.ai_calls_monthly` 走共享 **AI Gateway（`@vxture/service-ai-gateway`）**。
- 配额归集到 **workspace 订阅**，在 AI Gateway 计量点**按订阅生效**。
- arda 不自建 AI 计量；只在调用处携带 workspace / product 上下文。

---

## 4. 导航分区映射（采纳设计 IA）

| 导航分区 | group | v1 屏幕 | 备注 |
|---|---|---|---|
| 概览 | （无门控，恒显） | dashboard | 驾驶舱 |
| 资产 | assets | catalog（+ 资产详情） | |
| 治理 | governance | standards, quality, lineage, security | 数据集级 |
| 服务 | services | service | |
| 集成 | integration | （etl 等） | **future · 占位** |
| 管理 | admin | api keys, audit log | |

---

## 5. 与 §8 的衔接

- **§8.0–8.2（schema 落地）**：仅为 **v1 实体**（§2 标 v1 / 基础设施）建表与迁移；`future` 实体保留定义、不建表。
- **§8.4（门控重设计）**：`EntitlementGate` 按「当前 workspace × product=arda」消费平台下发的 features / quota；对 `future` 键展示占位。
- **权益来源**：实时拉取 + 缓存 + 失效通知（ADR §3.5），arda 不建订阅镜像表。
