# 数据接入 功能设计（arda-biz-410-ingestion）

> 状态：功能层 · 功能设计（待评审）
> 模板/看板：[`biz-400`](arda-biz-400-functions.md)；数据模型：[`data-220`](arda-data-220-integration.md)；门控：[`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md) §3

---

## 1. 功能定义

把外部系统接入 arda：**登记数据源 → 拉取 schema/元数据 → 生成资产 → 保持更新（保鲜）**。v1 只登记不搬运，管道/调度为 future。

## 2. 贯通链（目标 → 过程 → 结果 → 服务 → 监管）

| 环 | 做什么 | 靠什么实现 | 接下一环 |
|---|---|---|---|
| **目标·定义** | 接入规划 / 源清单 / 连接配置 | `DataSource{type(postgres/s3/rest/file/...), connectionConfig(应用层加密), status}` | 源定义 → 供连接/拉取 |
| **过程·执行** | 登记、连接测试、拉元数据、同步 | 登记 + 连接器读 schema → 生成/更新 `Dataset`；`lastSyncedAt` | 元数据 → 生成资产（`biz-421`） |
| **结果·看** | 数据源列表 / 连接状态 / 更新健康度 / 新鲜度 | `DataSource.status`/`lastSyncedAt`；入湖后资产画像出现 | 资产 → 供治理/服务 |
| **服务·用** | 接入产出（资产）供下游（治理/服务/消费）使用 | 生成的 `Dataset` 进入价值链 | — |
| **监管·审计** | 连接配置变更、同步失败告警 | `AuditLog{action: source.change / sync.fail}` | 审计流水 |

## 3. 断链清单

| 编号 | 断链（环） | 现状 | 接通方案 | 依赖 |
|---|---|---|---|---|
| `I-BL1` | 过程：登记→拉元数据→生成 Dataset 执行链缺 | `DataSource` 有表无写入路径；元数据映射未实现 | 建登记 + 连接测试 + 拉元数据 → upsert `Dataset` 的执行链 | `biz-421` |
| `I-BL2` | 过程：保鲜/周期同步缺 | `refreshFreq` 仅声明，无真实周期同步 | 先支持手动同步；周期化接 scheduling（future） | future |
| `I-BL3` | 目标：连接凭据加密封装缺 | `connectionConfig` 应用层加密，schema 不强制 | 统一加密读写封装（勿散落手工加解密） | `biz-435` |
| `I-BL4` | 监管：接入审计未接 | 连接变更/同步失败不落 `AuditLog` | 补写入点 | `biz-451`/admin |

> 本功能"贯通"的关键 = `I-BL1`（登记能真生成资产）。这是价值链起点，断了后面全空。

## 4. 数据模型（da delta）

- **已建**：`DataSource`（v1，仅登记）。
- **future（不建）**：`Pipeline`（同步/变换）、`JobRun`（执行记录）——数据搬运需求驱动再建。
- **实现要点**：`connectionConfig` 加密封装；元数据→`Dataset` 的字段映射；`status`/`lastSyncedAt` 维护。

## 5. 依赖

| 依赖 | 用途 | 断链 |
|---|---|---|
| 资产（`biz-421`） | 生成/更新 Dataset | I-BL1 |
| scheduling（future） | 周期同步 | I-BL2（先手动解耦） |
| 安全（`biz-435`） | connectionConfig 加密 | I-BL3 |
| 审计（`biz-451`/admin） | 接入审计 | I-BL4 |

## 6. 门控（能力键）

- 登记基础源：`arda.integration.sources_basic`；高级连接器：`arda.integration.sources_premium`（写操作，`admin` 角色——连接串是攻击面）。
- `pipelines`/`scheduling`/`realtime` = future → 占位。
- 配额：`arda.quota.data_sources`。
