# arda 领域实体与 feature-key 目录（v1）

> 状态：设计定稿（已批准）· 范围：arda 产品的领域数据模型与门控能力目录
> 上游：`docs/30-design/decisions/ADR-001-entitlement-and-workspace.md`（订阅权益 + workspace 隔离 + 模板填充）
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
- **能力键归属（2026-07-13 修订）**：feature-key 的「键」与「每档开放哪些键」**均由产品（arda）定义**——本文件的键目录 + [`ent-110`](arda-ent-110-local-implementation.md) §2a 的能力矩阵，全部在 arda 仓内、版本化；平台不配置、不下发功能键（`capabilities` 已从 C2 移除）。**配额数值**（上限 `limits` + 消耗池 `quota_pools`）仍由平台订阅配置下发。~~arda 不硬编码「档位 → 功能」映射~~ 已取代：档位→功能映射就在 arda 的能力矩阵里，改矩阵 = 产品发版。
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
| **Standard** | v1 | 数据标准：代码集 / 数据元参照（元数据治理） | `code, name, type(code-set\|data-element), ref, items, usage, status(published\|draft\|review)` | - |

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
| `arda.governance.standards` | v1 | 数据标准管理（代码集 / 数据元 / 参考数据） |
| `arda.governance.master_data` | v1 | 主数据 / 金记录治理（MDM，轻量） |
| `arda.governance.policies` | v1 | 访问 / 脱敏 / 留存策略 |
| `arda.governance.classification` | v1 | 自动 / PII 分类 |
| `arda.governance.lineage` | v1 | 血缘图（数据集级） |
| `arda.governance.quality_rules` | v1 | 质量规则 + 检查 |
| `arda.services.publish_api` | v1 | 发布数据服务 / API |
| `arda.services.data_products` | v1 | 数据产品 / 对外共享 |
| `arda.admin.api_keys` | v1 | API key 管理 |
| `arda.admin.audit_log` | v1 | 查看 / 导出审计日志 |
| `arda.planning.workbench` | future | 数据规划域占位（战略 / 管理体系 / 成熟度评估等，见 `biz-105` §1） |
| `arda.architecture.workbench` | future | 数据架构域占位（企业架构 / 数据模型 / 指标体系等） |
| `arda.governance.workbench` | future | 数据治理域占位（组织 / 责任人 / 审批流程 / 问题管理，与既有 `arda.governance.*` 管控键并存，见下方说明） |
| `arda.operations.dashboard` | future | 数据运营域占位（运行 / 资源 / 任务监控，运营分析） |

> 已移除：`arda.admin.advanced_security`（SSO / 高级安全属身份层，归平台 / IdP）。
> 新增（2026-07-13，源自 [`data-160`](arda-data-160-cross-workspace-authorization.md)）：`arda.services.cross_workspace_share`。
> **档位分配的 SoT = `portals/app/app/entitlement/capability.ts`（能力矩阵，2026-07-13 起）**：本表只维护键目录与语义；每档开放哪些键以代码矩阵为准（free 基线 3 键，starter/pro/business 累进，enterprise 差异在配额而非键）。
> 新增（2026-07-02，源自业务架构功能设计 `biz-431`/`biz-432`）：`arda.governance.standards`、`arda.governance.master_data`。键由 arda 定义；每档开放与否~~由平台订阅配置下发~~ **由 arda 能力矩阵自持（2026-07-13 修订，见 §1 归属条目）**。
> 新增（2026-07-15，源自 [`biz-105`](arda-biz-105-capability-map.md)，采纳 DCMM/DAMA 对齐的 15 导航域后补录）：`arda.planning.workbench`、`arda.architecture.workbench`、`arda.governance.workbench`、`arda.operations.dashboard`，均为 `future`（已加入 `capability.ts` 的 `FUTURE_FEATURE_KEYS`，未分配给任何档位）。`arda.governance.workbench` 是"治理组织/流程"这一新导航域的占位键，与既有 `arda.governance.standards/master_data/policies/classification/lineage/quality_rules`（治理域内已上线的管控键）并存，不是替代关系——`governance` group 前缀现在同时承载"已上线的管控能力"与"占位的组织/流程能力"，符合 §1 "多维度可归同一 group、按键区分粒度"的既定原则。数据开发域（`etl` 屏幕）本轮**未新增能力键、维持未门控**，见 `biz-105` §3。

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

## 4. 导航分区映射（2026-07-15 修订：15 导航域，见 `biz-105`）

**导航域与门控 group 已解耦**（`biz-105` §0）：`SCREEN_FEATURES` 把屏幕直接映射到
能力键，不要求"导航域 id"等于"能力键的 group 前缀"。下表的「导航域」是控制台
15 个功能域看板（`nav-config.ts` 的 `BOARDS`，每个域有自己独立的侧边栏菜单）；
「门控 group」仍是 §1 定义的 5 个（`assets/integration/governance/services/admin`），**未变**。

| 导航域 | 门控 group | v1 屏幕 | 备注 |
|---|---|---|---|
| 总览 overview | （无门控，恒显） | dashboard | 驾驶舱 |
| 数据规划 planning | - | planning | **future · 占位**（新增） |
| 数据架构 architecture | - | architecture | **future · 占位**（新增） |
| 数据标准 standards | governance | standards | 原"治理"域拆出 |
| 元数据 metadata | governance | lineage | 血缘 / 影响分析；原"分析域"并入 |
| 数据集成 integration | integration | sources | |
| 数据开发 engineering | - | etl | 未门控（原"集成"域拆出，见 §3.1 说明） |
| 数据治理 governance | - | governance | **future · 占位**（新增，组织 / 流程，非 §3.1 管控键） |
| 数据质量 quality | governance | quality | 原"治理"域拆出 |
| 主数据 masterdata | governance | masterdata | PRO；键早已存在，本轮补屏幕 |
| 数据资产 assets | assets | catalog（+ 资产详情）, glossary | 业务入口 |
| 数据服务 services | services | service | |
| 数据安全 security | governance | security | 原"治理"域拆出 |
| 数据运营 operations | - | operations | **future · 占位**（新增） |
| 管理 admin | admin | api keys, audit log | 角色锁定；范围收窄，见 `biz-105` §2 |

完整的域拆分理由、L1/L2/L3 三层模型、生命周期横轴（二级导航，暂缓）与
Administration 域的平台边界澄清，见 [`biz-105`](arda-biz-105-capability-map.md)；
`biz-110` 的 §2 五域详解也已同步修订。

---

## 5. 与 §8 的衔接

- **§8.0–8.2（schema 落地）**：仅为 **v1 实体**（§2 标 v1 / 基础设施）建表与迁移；`future` 实体保留定义、不建表。
- **§8.4（门控重设计，2026-07-13 修订）**：`EntitlementGate` 按「当前 workspace × product=arda」消费平台下发的商业事实（status/tier/limits/quota_pools），功能键在本地能力矩阵求值；对 `future` 键展示占位。
- **权益来源**：实时拉取 + 缓存 + 失效通知（ADR §3.5），arda 不建订阅镜像表。
