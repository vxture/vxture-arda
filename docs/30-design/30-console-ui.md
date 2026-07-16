# arda 控制台 UI 设计规范（console-ui v1）

> 状态：设计定稿（权威 UI 规范，与 Claude Design 源对齐）
> 范围：arda（智能数据中台）整个控制台的信息架构、外壳、组件与每屏布局
> 用途：作为实现的唯一 UI 真相；当「实现与设计有差距」时，以本文件 + 设计源为准修正实现

---

## 0. 设计源（Source of Truth）

UI 设计源是 Claude Design 项目，**本规范从该源蒸馏而来**；需要像素级细节时回源。

| 项 | 值 |
|---|---|
| Claude Design 项目 | `vxture-data-arda` |
| projectId | `1e8574d8-50fb-4b32-887e-0d9c410d0bda` |
| 入口文件 | `data-arda.html`（加载 `vx/app/*.jsx`） |
| 设计源构成 | `vx/app/`：`main.jsx`(路由/外壳装配) · `shell.jsx`(Header/Sidebar/Assistant/Drawer) · `ui.jsx`(组件原子+图表) · `dashboard.jsx` · `catalog.jsx` · `quality.jsx`(含 Lineage) · `screens.jsx`(Standards/Security/Service/ETL) · `data.js`(mock 数据) |
| 样式 | `vx/app/app.css` · `vx/_shell.css` · `vx/colors_and_type.css` · `vx/tokens-*.css` |
| 截图参考 | 项目内 `screenshots/`（nav、launcher、user panel、tenant、level、slots 等） |
| 再获取方式 | DesignSync MCP：`get_file {projectId, path}`（先 `/design-login`）。详见 [[console-ui-framework]] memory。 |

**废弃参考**：`城市数据中台.html` / `data-arda.html` 内的「城市治理」主题（公安/规划/人口/法人/交通…）**仅作布局参考**。内容必须泛化为**通用智能数据平台**（见 §2）。

---

## 1. 产品定位与外壳总览

arda = **智能数据中台**，一个数据资产 / 治理 / 服务的控制台。外壳是经典三段式：

```
┌──────────────────────────── Header (vxh) ────────────────────────────┐
│ launcher  logo+品牌+plan标签 | 分割 | 预留     [搜索]    Varda 帮助 告警 设置 用户 │
├────────────┬─────────────────────────────────────────┬───────────────┤
│            │                                          │               │
│  Sidebar   │            content-scroll                │   Assistant   │
│ (rail+nav  │         (PageHeader + 屏内容)             │   (Varda,     │
│  +footer)  │                                          │  narrow/wide/ │
│            │                                          │   full)       │
└────────────┴─────────────────────────────────────────┴───────────────┘
   Drawer (notifications/settings) 为 fixed 抽屉覆盖，不占内容区
   TweaksPanel 为设计态调参面板（实现态对应用户「偏好设置」）
```

根容器 class：`app`，叠加状态 `vela-open`（助手展开）、`nav-collapsed`（导航收起）。

---

## 2. 泛化规则（城市主题 -> 通用平台）

设计源用城市治理 mock 演示布局；实现必须做以下语义替换，**不沿用任何城市/政务专有数据**：

| 设计源（废弃主题） | 实现（通用语义） |
|---|---|
| 城市数据中台 / 市大数据局·城运中心 | 智能数据中台 / 工作区名（来自 `active_workspace`） |
| 主题域：人口/法人/空间地理/电子证照/信用/交通… | 通用 domain：业务域/数据集分类（产品自定义） |
| 归属部门：公安/规划/交通/市监… | team / owner（通用归属） |
| 分级：公开/内部/敏感/核心（`levelMeta`） | classification 分级（通用：public/internal/sensitive/core 可保留，文案通用化） |
| 城市治理域已授权（助手脚注） | 当前 workspace · 已授权 |

i18n：实现提供 en-US + zh-CN 两套文案（设计源仅 zh）。

---

## 3. 信息架构（IA）

### 3.1 左侧导航 `NAV`（三组 8 项）

| 分组 | 项 key | 标题 | 图标 |
|---|---|---|---|
| 概览 | `dashboard` | 数据总览 | `ph-gauge` |
| 资产治理 | `catalog` | 资产目录 | `ph-stack` |
| 资产治理 | `standards` | 数据标准 | `ph-ruler` |
| 资产治理 | `quality` | 数据质量 | `ph-seal-check` |
| 资产治理 | `lineage` | 数据血缘 | `ph-tree-structure` |
| 资产治理 | `security` | 数据安全 | `ph-lock-key` |
| 共享应用 | `service` | 数据服务 | `ph-broadcast` |
| 共享应用 | `etl` | 数据开发 | `ph-flow-arrow` |

### 3.2 功能域 `BOARDS`（launcher 面板 + Header 当前域名）

launcher（九宫格 `ph-dots-nine`）展开后是**功能域切换器**，每个域映射到一组屏 + 一个 home：

| 域 id | 名称 | home | 含屏 |
|---|---|---|---|
| `asset` | 数据资产域 | `dashboard` | dashboard, catalog |
| `integrate` | 数据集成域 | `etl` | etl |
| `govern` | 数据治理域 | `standards` | standards, quality, security |
| `analyze` | 数据分析域 | `lineage` | lineage |
| `serve` | 数据服务域 | `service` | service |

Sidebar 顶部 `side-domain` 显示「当前 route 所属 board」的名称。launcher 面板有两种形态：`vxh-board-list`（功能域，单产品内）与 `vxh-applauncher`（应用中心九宫格，跨产品/已订阅应用 —— 对接 vxture 平台 apps 时用）。

---

## 4. Header（`vxh`）—— 11 个分区

从左到右（源 `shell.jsx` Header）：

1. **功能切换** `vxh-launcher`（`ph-dots-nine`）-> 弹出 `vxh-board-list` / `vxh-applauncher`。
2. **logo** `vxh-logo`（白色 logo）。
3. **产品名 + plan 标签** `vxh-brand-name` + `vxh-brand-tag is-<plan>`。设计源演示值为旧 4 档（team），**实现按 ADR 五档** `PLAN_TAGS = {free:FREE, starter:STARTER, pro:PRO, business:BIZ, enterprise:ENT}`（见 §4.2 与 [[entitlement-direction]]）。
4. **分割线** `vxh-divider`。
5. **预留外链槽** `vxh-extslot`（一级外部链接预留）。
6. **弹性留白**（grid 弹性列）。
7. **全局搜索** `vxh-search`（`⌘K`，placeholder「搜索数据资产、服务、标准…」）。
8. **Varda 智能体入口** `vxh-agent`（动态 gif 图标，toggle 助手面板）。
9. **系统操作组** `vxh-group`：帮助 `ph-question` | 告警 `ph-bell`(badge 数) | 设置 `ph-gear-six`。
11. **用户头像 + 用户面板** `vxh-user` -> `vxh-user-panel`。

### 4.1 用户面板 `vxh-user-panel`（源关键设计，实现易缺）

- **头部**：大头像 + 用户名 + 实名认证徽标 `vxh-verify`（`ph-seal-check`）+ 手机号/email（缺失态 `is-missing`）。
- **等级行** `vxh-level-row`：`vxh-lvslots` 四个奖章槽（角色、用户等级 L*、两个待解锁），用户等级与订阅档位是**两个独立维度**（见 §4.2）。
- **账户块** `vxh-acct-block`：个人信息 / 租户管理（均跳转 console/平台）。
- **偏好设置** `vxh-prefs`（4 个 `vxh-seg` 段控）：语言(简中/English) · 主题(跟随系统/亮/暗) · 密度(紧凑/默认/宽松) · 字号(小/默认/大)。
- **底部操作**：切换用户 `ph-user-switch` / 退出登录 `ph-sign-out`（danger）。

### 4.2 两个独立维度：订阅档位 vs 用户等级

- **订阅档位（plan / tier）**：商业权益，显示为品牌旁 plan 标签。来自平台权益（见 [[entitlement-direction]]）。
- **用户等级 `USER_LEVELS`（5 级）**：账号成长/角色，1 普通用户 / 2 认证用户 / 3 高级用户 / 4 管理员 / 5 超级管理员，图标色阶递进（`lv1`..`lv5`）。**不要把这两者混为一谈。**

---

## 5. Sidebar（`sidebar`，可 `is-collapsed`）

- **side-rail**：折叠/展开按钮 `rail-toggle`（`ph-text-outdent`/`ph-text-indent`）；展开态显示当前功能域名 `side-domain`；菜单>10 项时显示「收起全部分组」`side-collapse-all`。
- **side-nav**：按 `NAV` 分组渲染 `nav-section`，分组标题可折叠（`nav-section-trigger` + caret），项 `nav-item`（active 高亮）。折叠态用 `nav-section-rail` 竖向 rail。
- **side-foot**：合规态势卡 `side-foot-card`（图标 + 标题 + 进度条 `sfc-bar` + 文案，如「分级分类覆盖率 96.8%」）。

---

## 6. Varda 助手（`assistant`）—— 设计一等公民

> 设计名 Vela，实现名 **Varda**。它是右侧常驻 AI 面板，不是可有可无的附属。

- 三态：`narrow`（默认窄）| `wide`（加宽，触发导航自动收起）| `full`（全屏）。Header 头按钮在三态间切换（`ph-arrow-line-left/right`、`ph-corners-out/in`）。
- **结构**：`vela-hd`（sparkle 标 + 标题「Varda 数据助手」+ 模型徽标 `vela-mb` 显示 `claude-sonnet-4-5` + tools 计数 + 加宽/全屏/关闭按钮）、`vela-body`（消息流）、`vela-ft`（输入框 + 发送 + 模型脚注）。
- **消息类型**：`user` 气泡、`ai` 气泡（可带 `suggest` 快捷追问）、`tool` 工具调用块 `vela-tool`（工具名 + 入参 + 结果 + 耗时 ms）。体现「自然语言取数 / 解读质量指标 / 检索资产 + 工具调用」的产品意图。
- 模型徽标按 [[claude-api]] 用最新 Claude 模型 id（设计写的 `sonnet-4-5` 为占位，实现按当时最新）。

---

## 7. Drawer（抽屉）+ TweaksPanel（偏好）

- **Drawer** `drawer-layer`：fixed 覆盖右侧。两类：`notifications`（消息中心，`dn-item` 列表，按 level 着色，点击跳到对应屏）、`settings`（系统设置 KV 列表）。告警入口在 Header `ph-bell`。
- **TweaksPanel**（设计态调参）：密度(comfy/compact) · 资产展示(card/table) · 暗色 · 嵌入 Varda。**实现态**把这些并入用户面板「偏好设置」（§4.1）+ 资产目录视图切换（§9.2）。

---

## 8. 组件原子（`ui.jsx`）

实现须以 `@vxture/design-system` 原语承载这些；DS 缺口用 DS atom + token-only CSS 组合（受 `09-check-ds-usage.py --strict` 约束，禁止裸色值/重定义 DS 类）。

| 组件 | 关键 props | 用途 |
|---|---|---|
| `PageHeader` | eyebrow, title, desc, actions, tabs/activeTab/onTab, badge | 每屏页头（eyebrow + 大标题 + 描述 + 右侧操作 + 可选 tab 行） |
| `Btn` | variant(default/secondary/link), size, icon | 按钮（default=主，secondary=次，link=文字） |
| `LevelBadge` | level | 分级 pill（public/internal/sensitive/core，带 dot） |
| `QualityBadge` | score | 质量分 pill（按分段着色） |
| `DeptTag` | id | 归属标签（dot + 名称）—— 泛化为 team/owner 标签 |
| `MetricCard` | eyebrow, value, unit, delta, deltaDir(up/down), icon, accent, spark, ai | 指标卡（delta 向上绿/向下红；ai 变体 sparkle） |
| `AreaChart` | data, height, color, labels | 面积折线图（token-only SVG） |
| `Sparkline` | data, color | 迷你走势 |
| `HBars` | data[{label,value,color}] | 横向条形（部门/分类贡献） |
| `Donut` | data[{label,value,color}] | 环形分布（中心总数 + 图例百分比） |
| `Radar` | data[{name,score}] | 雷达图（六维质量） |
| `Ring` | score, color, label | 进度环（质量总分等） |

布局类：`metric-grid`(/`--4`) · `dash-cols`(/`--b`)/`dash-main`/`dash-side` · `card`(/`no-pad`/`chart-card`)/`card-hd`(/`--pad`)/`card-title`/`card-sub` · `vx-table`（行 `row-click`，单元 `cell-asset`/`cell-asset-name`/`cell-asset-code`/`num`/`mono`/`dim`/`cell-caret`） · `pill`/`dim-tag`/`tag`/`chip`。

> 实现注记：当前实现用 gate-safe 类名（`con-card`/`vxh-*` 等，避免与 DS 拥有的 `card`/`metric-card` 冲突）。本规范用设计源原始类名描述结构；实现按 DS-usage gate 重命名，但**布局与层级须一一对应**。

---

## 9. 各屏布局

### 9.1 数据总览 `dashboard`（驾驶舱，主屏）
- PageHeader：eyebrow=品牌, 标题「数据资产驾驶舱」, 操作=近30天/刷新/导出报告。
- 指标行 `metric-grid` 4 卡：资产总量 / 归集数据量 / 服务调用今日 / 分级合规率。
- 主两栏 `dash-cols`：左 `dash-main`(资产增长趋势 AreaChart + 各业务域贡献 HBars)，右 `dash-side`(主题域分布 Donut + 质量总分 mini：Ring + 4 维条)。
- 底部 `dash-cols--b`：热门资产 `vx-table`（点击进 catalog 详情）+ 治理告警 `alerts-card`（4 条，按 level，点击跳屏）。

### 9.2 资产目录 `catalog`（list + detail）
- list：PageHeader（注册资产/新建数据集）+ 业务域 chips `domain-strip`（全部+各域计数）+ 过滤条 `filterbar`（搜索 + 分级/部门/频率 chip + 计数）+ 视图切换 card/table。
  - 卡片 `asset-grid`/`asset-card`：域图标 + LevelBadge + 名称 + code + 描述 + DeptTag + 底部(行数/字段/订阅/QualityBadge)。
  - 表格 `AssetTable`：资产/主题域/归属/分级/数据量/频率/质量/订阅。
- detail `AssetDetail`：面包屑 `crumb` + 详情页头（域图标大标题 + LevelBadge + code 行 + 操作：查看血缘/收藏/申请使用）+ tabs(字段结构/数据预览/质量/血缘/权限申请) + `detail-stats` 6 格 + 两栏(主区 tab 内容 + 侧栏 资产信息 KV `kv` + 标签 `tag-card`)。
  - tab 字段结构：`vx-table` 字段名(PK 标)/中文名/类型/分级/关联标准。
  - tab 数据预览：脱敏样例 `mono-table` + 动态脱敏 pill。
  - tab 质量：Radar + 维度条。
  - tab 权限申请：`form-grid` 表单（使用场景/字段范围/使用说明/期限/调用方式）+ 提交审批。

### 9.3 数据标准 `standards`
- PageHeader（规范文档/新建标准）+ 4 指标(数据元/代码集/标准引用/待评审) + 标准库表（名称/类型 `dim-tag`/参照规范 mono/条目/引用/状态 pill）+ 行内搜索。

### 9.4 数据质量 `quality`
- PageHeader（规则库/发起稽核）+ 4 指标(质量总分/稽核规则/发现问题/待整改) + 两栏(质量得分趋势 AreaChart + 六维质量 Radar) + 稽核规则执行表（规则/对象/维度/分级/通过率 `pass-cell` 进度/问题数/趋势 `trend-ico`）。

### 9.5 数据血缘 `lineage`
- PageHeader（影响分析/全屏）+ 工具条 `lineage-toolbar`（分析对象 chip + 类型图例）+ 画布 `lineage-canvas`（自定义 SVG 有向图：5 列 source/job/table/api/app，节点 `ln-node`，core 高亮，贝塞尔连线）+ 底部 `lineage-foot` 4 个 `info-chip`(上游/加工/下游影响/影响评估 warn)。
- 注：血缘的多类型 source/job/table/api/app 图无 v1 schema 直接映射，保持自定义 SVG + 静态/半静态。

### 9.6 数据安全 `security`
- PageHeader（分级模板/发起分类）+ 4 指标(分级覆盖率/脱敏规则/核心资产/越权拦截) + 两栏(分级分类分布 Donut + 共享授权申请表 LevelBadge + 状态 pill) + 分级强调条 `level-strip`（4 个 `level-card` 顶边按级着色）。

### 9.7 数据服务 `service`
- PageHeader（API 文档/发布服务）+ 4 指标(在线服务/今日调用/平均 P99/SLA) + 服务卡网格 `service-grid`/`service-card`：method 标签(GET 绿/POST 蓝) + 状态 pill(运行中/审核中/已暂停) + 名称 + path mono + 描述 + 域 tag + LevelBadge + 4 统计(调用/P99/SLA/订阅)。

### 9.8 数据开发 `etl`
- PageHeader（任务编排/新建任务）+ 4 指标(调度任务/今日成功率/实时管道/处理量) + 调度任务运维表 + `seg-tabs`(全部/运行中/异常)：任务/数据源/目标/状态 pill(成功/运行/告警/失败)/处理量/耗时/调度/行操作(运行/日志)。

---

## 10. 设计 token / 配色

- 配色用 DS token：`--vx-color-brand-*` / `info` / `success` / `warning` / `danger` / `ai` / `ai-cyan` / `spark` / `gray` 及对应 `-surface`。分级色：public=success / internal=info / sensitive=warning / core=danger。
- 字体 FunnelDisplay（DS 提供）。
- 图表全部 token-only SVG（无第三方图表库），随暗色模式自适应（`--primary`/`--border`/`--fg`/`--bg` 等）。
- 暗色：根 `.dark` 切换。

---

## 11. 实现对齐清单（差距修正用）

实现与设计对齐时逐项核对（详见 §4–§9）。已知**易缺/易偏**项（实现重点优化方向）：

1. **Varda 助手三态面板**（§6）—— 设计一等公民，勿停留在「入口按钮」。
2. **用户面板**（§4.1）—— 等级奖章槽 + 4 段偏好（语言/主题/密度/字号）+ 实名认证 + 租户管理入口。
3. **launcher 功能域/应用中心双形态**（§3.2）+ Sidebar 当前域名 + 合规态势 footer。
4. **plan 标签 vs 用户等级**两维度并存（§4.2）。
5. **每屏布局层级**与设计 1:1（§9），含 lineage 自定义 SVG 图、service 卡片网格、security level-strip、catalog 卡/表双视图 + 详情 5 tab。
6. **泛化**（§2）：通用语义替换，双语文案。
7. **token-only 图表 + 暗色自适应**（§10），DS-usage gate 严格通过。

> 数据来源：设计源为静态 mock；实现按 [[entitlement-direction]] 与领域 schema（`arda-biz-120-domain-entities-and-feature-keys.md`）接 DB / 平台权益。UI 结构以本规范为准，数据以产品后端为准。
