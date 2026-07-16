# arda 能力地图与三层功能域模型 (arda-biz-105-capability-map)

> 状态: 第 1 层 . 总体设计 (待评审)
> 范围: 在 `biz-100`/`biz-110` 已批准的两轴模型基础上, 采纳一份 DCMM/DAMA-DMBOK 对齐的
> L1 功能域地图作为控制台 IA (导航/菜单), 并说明它与既有 5-域门控模型的关系
> 上游: [`biz-100`](arda-biz-100-architecture.md) SS1 (两轴模型, 5 域门控),
> [`biz-110`](arda-biz-110-domains.md) (5 域详解),
> [`arda-biz-120-domain-entities-and-feature-keys.md`](arda-biz-120-domain-entities-and-feature-keys.md) (能力键目录)

---

## 0. 背景与决策

`biz-100` SS1.1 明确论证过"域越多, 门控矩阵越复杂", 因此把**门控 (gating)** domain
数量刻意压到 5 个 (`assets/integration/governance/services/admin`), 能力粒度靠**能力键**
(`arda.<group>.<capability>`) 而非新增域来区分。这个结论在 2026-07 依然成立, 本文件
**不推翻它**。

本文件解决的是另一件事: 控制台**导航/菜单 (IA)** 一直只有 6 个"功能域看板"
(`BOARDS`), 且看板切换只是跳转到不同首页, 侧边栏菜单其实是全局共享的一份
`NAV`, 并未随域变化 - 达不到"域即独立工作场"的产品体验, 也无法承载一份对外
可讲、对齐 DCMM/DAMA 的完整能力地图 (利于方案/招投标/验收场景)。

**关键解耦**: 代码里 `SCREEN_FEATURES` 把"屏幕"直接映射到"能力键", 从未要求
"导航域"与"能力键的 group 前缀"一致。所以可以让 **L1 导航域** (面向用户/对外叙事,
可以更细) 与 **门控能力键的 group** (面向工程, 保持粗粒度以内) 彻底解耦:

- **L1 域** (nav, 本文件新增) = 15 个 (1 个总览 + 14 个业务域), 对外叙事/菜单结构。
- **L2 能力** (gating, 沿用 `capability.ts`) = `arda.<group>.<capability>` 键,
  目标 80-120 个, group 前缀仍是 `assets/integration/governance/services/admin`
  或新增的 `planning/architecture/engineering/operations` (只在真正需要独立
  定价/门控时才新增 group, 遵循 `biz-100` "先键后域"原则)。
- **L3 功能** = 具体屏幕/交互, 目标 400-600 个, 按优先级逐步建, 本轮只建**占位壳**。

## 1. 采纳的 L1 域 (15 个, 含总览)

| # | 域 id | 中文 | 本轮状态 | 复用/新增屏幕 | 能力键 (group 不变的沿用既有 group) |
|---|---|---|---|---|---|
| 0 | overview | 总览 | 既有 | `/dashboard` | 不门控 |
| 1 | planning | 数据规划 | **新占位** | `/planning` | `arda.planning.workbench` (future) |
| 2 | architecture | 数据架构 | **新占位** | `/architecture` | `arda.architecture.workbench` (future) |
| 3 | standards | 数据标准 | 既有, 拆分独立成域 | `/standards` | `arda.governance.standards` |
| 4 | metadata | 元数据 | 既有屏幕挪入 | `/lineage` (血缘分析/影响分析) | `arda.governance.lineage` |
| 5 | integration | 数据集成 | 既有 | `/sources` | `arda.integration.sources_basic/premium` |
| 6 | engineering | 数据开发 | 既有屏幕挪入 | `/etl` | 暂不新增门控键 (见 SS3) |
| 7 | governance | 数据治理 (组织/流程) | **新占位** | `/governance` | `arda.governance.workbench` (future) |
| 8 | quality | 数据质量 | 既有, 拆分独立成域 | `/quality` | `arda.governance.quality_rules` |
| 9 | masterdata | 主数据 | **新占位**, 键早已存在 | `/masterdata` | `arda.governance.master_data` (PRO, 非 future) |
| 10 | assets | 数据资产 | 既有, 业务入口 | `/catalog`, `/catalog/[id]`, `/glossary` | `arda.assets.*` |
| 11 | services | 数据服务 | 既有 | `/service` | `arda.services.*` |
| 12 | security | 数据安全 | 既有, 拆分独立成域 | `/security` | `arda.governance.policies`/`classification` |
| 13 | operations | 数据运营 | **新占位** | `/operations` | `arda.operations.dashboard` (future) |
| 14 | admin | 系统管理 | 既有, 范围收窄 (见 SS2) | `/apikeys`, `/audit` | `arda.admin.*` |

原 6 个看板 (`asset/integrate/govern/analyze/serve/admin`) 与上表的映射: `govern`
(原捆绑标准+质量+安全) 拆成 `standards`/`quality`/`security` 三个独立域;
`analyze` (原血缘单列) 并入 `metadata`; `integrate` 分裂为 `integration` (接入) 与
`engineering` (开发, 原 `etl` 屏幕); 其余不变。**每个域现在拥有自己独立的
`BOARD_NAV` 菜单**, 切换看板会整体切换侧边栏, 不再是共享一份全局 `NAV`。

## 2. Administration 域的平台边界 (重要澄清)

用户提供的能力地图里, "系统管理"包含组织/租户/用户/角色/菜单/字典/参数/
License/插件/系统配置。其中**组织/租户/用户/角色/License 属于 vxture 平台
(accounts.vxture.com / OIDC)**, 不是 arda 的职责 - 见 `biz-100` SS0 与仓库
CLAUDE.md ("arda 是 OIDC relying party, 不建身份/账号/计费/席位能力")。

本轮 `admin` 域**保持仓库既有范围不变**: 只有 API Key 管理与审计日志 (arda 自有
数据)。字典/参数如未来确有 arda 本地需求 (如枚举型参考值), 可作为该域的 L2 占位
补充; 组织/租户/用户/角色/License **不在 arda 内建**, 建议以"跳转至 vxture 平台
管理控制台"的深链接呈现, 而非在 arda 里假建一套重复的身份管理界面。

## 3. 能力键同步 (v1)

本轮在 `capability.ts` 新增 4 个 **future** 键 (定义但未建, 门控返回不可用,
UI 走"敬请期待"而非升级提示): `arda.planning.workbench`,
`arda.architecture.workbench`, `arda.governance.workbench`,
`arda.operations.dashboard`。均已加入 `FUTURE_FEATURE_KEYS`, 尚未分配给任何档位。

修复了一处既有死代码: `isFutureFeature()` 此前定义了但从未被 UI 消费,
导致 future 键的锁定屏幕本应显示"敬请期待", 实际却渲染一个目标档位为空的
"升级"卡片。已在 `UpgradePanel` 里接上这个判断。

`arda.governance.master_data` 键此前已存在且已分配 PRO 档位, 只是没有对应
屏幕 - 本轮新增 `/masterdata` 占位屏幕补上这个入口, 门控行为不变
(PRO 以下访问显示既有的升级卡片, 非"敬请期待")。

`etl` (数据开发域首页) 本轮**只搬迁看板归属, 不改变门控** - 之前未在
`SCREEN_FEATURES` 登记 (不门控), 继续保持不门控, 避免无意造成降档回归。是否
要为"数据开发"设计独立能力键与档位, 留给产品决策 (再决定时遵循"先键后域"惯例,
先在 `arda-biz-120-domain-entities-and-feature-keys.md` SS3.1 登记键, 再落到
`capability.ts`)。

> 待办: 上述 4 个新 future 键与 `arda.governance.master_data` 的屏幕映射变更,
> 应在下次修订 `arda-biz-120-domain-entities-and-feature-keys.md` SS3.1 时补录, 保持"键目录
> 的唯一权威源"约定 (该文件的编辑规则第 1 条)。

## 4. 生命周期横轴 (二级导航, 本轮不建)

用户提出的生命周期轴 (规划->设计->接入->开发->存储->治理->服务->运营->归档)
与 `biz-100` SS1.2 已有的"能力 x 阶段矩阵" (目标/过程/结果/服务/监管) 是同一类
东西的更细粒度版本: **纵向能力专题**, 跨域拉通一条能力的端到端视图 (质量经理看
质量、安全官看安全、主数据 steward 看主数据), 二级导航/过滤, 不新增数据实体。

本轮不实现这条二级导航 - 先把 15 个 L1 域的独立菜单与占位页立住 (L1), 能力专题
视图放到下一阶段, 与 L2/L3 的实际能力建设一起排期。

## 5. 本轮范围 (L1 占位, L2/L3 后续按优先级建)

已交付: 15 域独立菜单 (`nav-config.ts` 的 `BOARDS`/`BOARD_NAV`)、5 个新占位域
的路由+`ScreenGate`+`DomainRoadmap` 占位页 (`ui/placeholder.tsx`)、每个占位域的
L2 路线图 chips (`DOMAIN_ROADMAP`, 中英文案已配)、上述能力键同步。

未交付 (后续轮次, 按优先级排): 每个域的真实 L2/L3 功能建设; 纵向能力专题二级
导航; `admin` 域的平台深链接占位; `arda-biz-120-domain-entities-and-feature-keys.md` 的键目录
补录。
