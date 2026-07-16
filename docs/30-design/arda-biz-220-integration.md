# 数据集成 板块详细设计（arda-biz-220-integration）

> 状态：第 2 层 · 详细设计（待评审）· 板块 `integration`
> 上游：[`biz-100`](arda-biz-100-architecture.md)、[`arda-biz-120-domain-entities-and-feature-keys.md`](arda-biz-120-domain-entities-and-feature-keys.md) §2.2/§3、[`data-220`](arda-data-220-integration.md)
> 跨切面见 `biz-100` §3

---

## 1. 板块定位

把外部系统接入 arda：**登记数据源 + 拉取 schema/元数据 + 保持数据更新（保鲜）**（v1）；**数据搬运/管道/调度**为 `future`。是价值链最左端（`biz-100` §2），也承载 arda 六件事里的**「更新」**（`DataSource.lastSyncedAt` + `Dataset.refreshFreq`，未来 `scheduling`）。

**数据源类型范围**（`biz-100` §0）：结构化源（`postgres`/`bigquery`/`s3`/`rest`/`file` 等）与常规非结构化文件源（文档/图片/表格）。**不含** GIS/三维/IoT 孪生数据的专用接入（空间/时序孪生连接器属另一产品）。

## 2. 现状

| 能力 | 现状 | 证据 |
|---|---|---|
| 外部数据源登记 | **仅建表，无界面**（登记/连接配置无 UI 入口） | `DataSource` 模型 |
| 任务编排（ETL） | **静态 seed**，非 DB 支撑 | `(app)/etl/`（`Pipeline`/`JobRun` 为 future、未建表） |

> 本板块是当前**"有模型/占位、缺真实能力"最明显**的一块。

## 3. 目标能力（feature-key）

| 键 | 能力 | 状态 |
|---|---|---|
| `arda.integration.sources_basic` | 登记基础数据源（file/db） | v1 |
| `arda.integration.sources_premium` | 高级连接器（数仓/SaaS） | v1 |
| `arda.integration.pipelines` | 构建管道/变换 | future |
| `arda.integration.scheduling` | 定时同步 | future |
| `arda.integration.realtime` | 流式/CDC | future |

配额：`arda.quota.data_sources`（登记数）、`arda.quota.pipeline_runs_monthly`（future）。

## 4. 数据模型（delta）

| 实体 | 状态 | 关键点 |
|---|---|---|
| `DataSource` | v1（已建） | `type`(postgres/s3/bigquery/rest/file/...)、`connectionConfig`(**应用层加密**)、`status`、`lastSyncedAt` |
| `Pipeline` | **future** | 同步/变换定义（`sourceId/targetDatasetId/schedule/transformConfig/enabled`） |
| `JobRun` | **future** | 一次执行记录（`startedAt/finishedAt/status/rowsProcessed/error`） |

> v1 明确"只登记不搬运"：`DataSource` 拉元数据、生成 `Dataset`，不落 `Pipeline/JobRun`。建表前置 = 真实数据搬运需求。

## 5. 屏幕/交互

- **新增**：数据源登记/连接配置界面（当前完全缺失）——`type` 选择、`connectionConfig` 表单（敏感值加密写入）、连接测试、元数据拉取。
- **etl 屏**：v1 保持占位/静态，标注"管道为 future"；避免让静态 seed 冒充真实调度（与 `future` 占位文案一致，见 domain-entities §0）。

## 6. 门控（两轴）

- **订阅**：`sources_basic` 基线；`sources_premium` 增值；`pipelines/scheduling/realtime` 为 future → 展示"开发中"占位（非"升级"）。
- **权限**：登记/改连接配置属敏感写（含凭据），建议 `admin+`（连接串是攻击面）。

## 7. 待办

1. 建**数据源登记界面**（最大界面缺口）+ `connectionConfig` 加密读写封装。
2. 元数据拉取 → 自动生成/更新 `Dataset` 的链路。
3. `Pipeline/JobRun` 待数据搬运需求驱动再建表（与 `future` 键一并放开）。
