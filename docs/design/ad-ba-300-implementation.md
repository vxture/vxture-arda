# 实施计划（ad-ba-300-implementation）

> 状态：第 3 层 · 实施计划（待评审）
> 范围：把 `ba-100`/`ba-2xx` 的目标态**从现状落地**的分阶段路线、依赖、迁移与风险
> 上游：本系列 `ba-100`/`ba-2xx`/`ba-4xx`；现状证据 [`arda-functional-domains-and-entitlement.md`](arda-functional-domains-and-entitlement.md) §0、[`arda-data-architecture-migration.md`](arda-data-architecture-migration.md)

---

## 1. 现状盘点（一屏看清）

8 个屏幕 / 5 板块的真实成色（证据基准 origin/develop）：

| 板块 | 屏幕 | 数据支撑 | 界面 | 缺口 |
|---|---|---|---|---|
| assets | catalog(+详情) | ✅ DB | ✅ | 术语表/标签独立界面缺；审批流未接 |
| integration | 数据源 | ✅ 表 | ❌ **无界面** | 登记界面完全缺 |
| integration | etl | ❌ 静态 seed | ⚠️ 占位 | 管道 future |
| governance | standards/quality/security | ✅ DB | ✅ | 共享审批未接 |
| governance | lineage | ⚠️ 表在、UI 未接库 | ⚠️ 静态 | 血缘 UI 接库 |
| services | service | ✅ DB | ✅ | 对外契约不变量未收口 |
| admin | api keys / audit | ✅ 表 | ❌ **零界面** | 界面从零建；审计写入点稀疏 |

**跨切面现状（最大空白）**：门控只有整站二元（`EntitlementGate`：有 active 订阅→全放行）；**无板块级、无能力键级、无配额级、权限维度(`roles`)完全未消费**（functional-domains §0.2/§0.3）。`Subscription` 类型还没有 `features/quota` 字段。

**地基现状（已就绪，可依赖）**：数据层（da）Prisma+Postgres 已落地（`0001~0005`）；workspace 隔离范式、`SeedTemplate` 首次进入填充、entitlement 五档/`none` 对齐均已就位或在途 PR。

---

## 2. 目标态差距（按优先级归类）

| 类别 | 差距 | 涉及 |
|---|---|---|
| **A. 门控地基** | 无两轴门控；`Subscription` 缺 `features/quota`；`roles` 未消费 | 跨全板块（`ba-100` §3.2、functional-domains §5） |
| **B. 界面缺口** | 数据源登记、术语表/标签、admin(keys/audit) 无界面 | `ba-220/21/25` |
| **C. 接库缺口** | 血缘 UI 走静态 seed | `ba-230` |
| **D. 对外契约** | services 对外不变量（分级过滤/审计/配额）未收口 | `ba-240`、agent-support |
| **E. future** | pipelines/scheduling/realtime、`Field` 列级、telemetry | `ba-220/23/24` |

---

## 3. 分阶段落地路线

> 原则：**先补门控地基（A），再补界面（B/C），再收口对外（D），future（E）按需**。门控是安全边界，界面是体验，顺序不能反（否则界面建好却无板块级门控，等于裸奔）。

### 阶段 0 · 门控地基（最高优先，跨板块）
- 扩 `Subscription` 类型加 `features[] / quota{}`（functional-domains §5.1）。
- 接**域级二元开关**（`arda.<板块>.baseline`）+ **路由级布局校验** `(app)/<板块>/layout.tsx`（functional-domains §4.2）。
- 消费 `session.roles`，先落 `admin` 板块的权限门控（风险最低、收益直观）。
- 依赖：`en` 维度权益实时拉取（平台只读端点）——未就绪前用 claim 携带的 features/quota 过渡。
- **验收**：平台配一条订阅 → 某板块即时可见/隐藏；`viewer` 看不到 admin。

### 阶段 1 · 补界面缺口（B）
- 建**数据源登记界面**（`ba-220`）+ `connectionConfig` 加密封装。
- 建 **admin：API Key 管理 + 审计日志查看**（`ba-250`）。
- 建**术语表/标签管理**（`ba-210`）。

### 阶段 2 · 血缘接库（C）
- lineage 屏从静态 seed 改读 `LineageEdge`（数据集级图，`ba-230`）。

### 阶段 3 · 对外契约收口（D）
- services 发布/调用路径补齐对外不变量：分级过滤、`ApiKey` 校验、`AuditLog` 写入、`api_requests_monthly` 配额（`ba-240` §5、agent-support §3.2）。
- 补齐 `AuditLog` 写入点（对外取数/敏感写/平台指令）。

### 阶段 4 · future（E，按真实需求驱动）
- `Pipeline/JobRun`（数据搬运）、`Field`（列级治理/血缘）、telemetry（真实调用统计）——**建表前置 = 真实业务需求**，不提前建。

---

## 4. 依赖与迁移

- **依赖 en/if 维度**：阶段 0 的权益 `features/quota` 需平台只读端点与 claim 契约（`if` 对接维度）；未就绪前用过渡方案，不阻塞界面阶段。
- **依赖 da 维度**：新界面（数据源/术语/admin）多为**已建表**，界面阶段基本不需新迁移；`future`（E）才涉及新表。
- **无破坏性迁移**：本计划以"补界面 + 接门控 + 接库"为主，不改现有 v1 schema 结构。

## 5. 风险

| 风险 | 缓解 |
|---|---|
| 只做界面不做门控 → 裸奔 | 阶段 0 先行，界面阶段的每个写操作必过 `canUseFeature`/`checkQuota` |
| 权限词表未定 → 门控落不了地 | `roles` 实际取值需平台/IdP 确认（functional-domains §8）；先用保守默认（admin 域限 owner/admin） |
| `connectionConfig` 漏加密 | 统一加密读写封装，不散落手工加解密（data-arch §4.1 已提示） |
| 静态 seed 冒充真实数据（etl/lineage） | `future` 占位文案与"未开通/无权限"区分（domain-entities §0、functional-domains §6） |

## 6. 与既有 workplan 的衔接

- 本计划的"门控地基"= functional-domains §7 实施路线的落地视图；两者一致，本文按**板块交付**重新编排。
- 平台侧依赖（权益端点/角色词表/指令通道）见 [`vxture-platform-integration-requirements.md`](../workplan/vxture-platform-integration-requirements.md)（`if` 维度）。
