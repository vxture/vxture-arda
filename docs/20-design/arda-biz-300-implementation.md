# 实施计划（arda-biz-300-implementation）

> 状态：第 3 层 · 实施计划（待评审）
> 范围：把 `biz-100`/`biz-2xx` 的目标态**从现状落地**的分阶段路线、依赖、迁移与风险
> 上游：本系列 `biz-100`/`biz-2xx`/`biz-4xx`；现状证据 [`arda-functional-domains-and-entitlement.md`](arda-functional-domains-and-entitlement.md) §0、[`data-300`](arda-data-300-migration.md)

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

**地基现状（已就绪，可依赖）**：数据层（arch）Prisma+Postgres 已落地（`0001~0005`）；workspace 隔离范式、`SeedTemplate` 首次进入填充、entitlement 五档/`none` 对齐均已就位或在途 PR。

> **两个视角**：本 §1 是**板块/屏幕视角**（看得到什么）；**功能贯通视角**（每个功能哪一环断了）见 [`biz-400`](arda-biz-400-functions.md) §3 断链看板——实施主线 A 按其逐条排期。

---

## 2. 两条实施主线（正交）

实施 = 两件事，正交并行：

| 主线 | 目标 | 来源（backlog） |
|---|---|---|
| **A · 功能贯通** | 让每个数据功能**端到端能用** | [`biz-400`](arda-biz-400-functions.md) §3 **断链看板**（接通断链 = 实施） |
| **B · 门控地基** | 让平台按**订阅/权限**门控 | functional-domains §5-7（两轴门控） |

> A 让功能"能用"，B 让功能"该谁用"。都要做：A 是用户价值，B 是安全边界。本文按此两线排期；断链编号（`I-BL1`/`Q-BL1`…）逐条见各 `biz-4xx` §3。

---

## 3. 分阶段落地路线

> 原则：**门控地基（B）与关键界面/执行器先行**（否则功能没门控=裸奔、没执行器=断链）；再沿断链**关键路径**打通功能贯通（A）；共性断链一处补；破坏性/schema 决策最后；future 按需。

### 阶段 0 · 地基（最高优先，两块并行）
- **B 门控地基**：扩 `Subscription` 加 `features[]/quota{}`（functional-domains §5.1）；域级二元开关 + 路由级布局校验 `(app)/<板块>/layout.tsx`；消费 `session.roles`（先 `admin`，`biz-250`）。依赖 `ent` 权益实时拉取，未就绪用 claim 过渡。
- **关键界面/执行器缺口**（功能贯通前置）：数据源登记界面（`I-BL1`，`biz-410`）；admin 界面（审计写入落点，`biz-250`）。
- **验收**：平台配一条订阅 → 板块即时可见/隐藏；`viewer` 看不到 admin。

### 阶段 1 · 功能贯通关键路径（A，`biz-400` §3）
沿断链关键路径把价值链打通：
- `I-BL1` 接入生成资产 → `Q-BL1`+`Q-BL2` 质量真跑 + 卡服务准入 → `L-BL1` 血缘接库 → `Sec-BL1`+`Sec-BL2` 脱敏 + 对外分级过滤 → `Svc-BL1` 对外契约收口。
- **验收**：一份数据 接入→治理(质量/分级)→画像可信→发布为服务，**端到端跑通**（`biz-110` §3 价值闭环）。

### 阶段 2 · 共性断链（一处补、多功能受益）
- **审计写入**统一封装：`Q-BL3`/`Sec-BL3`/`Svc-BL5`/`Lc-BL4`/`S-BL4`/`M-BL4`/`L-BL4`/`MD-BL6`。
- **调度**（scheduling）：质量跑批 `Q-BL1`、接入同步 `I-BL2`、血缘采集 `L-BL2`。
- **画像结果面聚合** `A-BL1`（随各功能结果环接通逐步点亮）、元数据策展 `MD-BL1/BL3`。

### 阶段 3 · schema 决策 + 破坏性
- `Lc-BL3` 软删 schema 决策（多表加 `deletedAt`）→ `Lc-BL2` `wipe`（平台指令通道，`plat` 维度）。
- `S-BL1` 符合性关联、`M-BL1` 金记录标记（轻量迁移）。

### 阶段 4 · future（按真实需求驱动）
- `Pipeline/JobRun`（`I-BL2` 数据搬运）、`Field` 列级（`MD-BL2`/`A-BL5`）、telemetry（`Svc-BL3`）、重型 MDM（`M-BL2`）——**建表/建引擎前置 = 真实业务需求**，不提前建。

---

## 4. 依赖与迁移

- **依赖 en/plat 维度**：阶段 0 的权益 `features/quota` 需平台只读端点与 claim 契约（`plat` 对接维度）；未就绪前用过渡方案，不阻塞界面阶段。
- **依赖 arch 维度**：新界面（数据源/术语/admin）多为**已建表**，界面阶段基本不需新迁移；`future`（E）才涉及新表。
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
- 平台侧依赖（权益端点/角色词表/指令通道）见 [`vxture-platform-integration-requirements.md`](../60-workplan/vxture-platform-integration-requirements.md)（`plat` 维度）。
