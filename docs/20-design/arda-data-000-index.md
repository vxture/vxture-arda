# arda 数据架构系列 · 索引与编号法（arda-data-000-index）

> 状态：系列索引（随系列更新）
> 用途：`arda-data-*`（数据架构维度）系列总目录 + 与全局编号法的对齐
> 范围：arda 数据域的**持久层** —— 库/客户端配置、schema、workspace 隔离、索引、加密、审计、迁移。**业务能力**设计见 [`arda-biz-*`](arda-biz-000-index.md)；权益门控见 `ent` 维度。
> 上游依据：全局编号法见 [`biz-000`](arda-biz-000-index.md) §0；数据域实体规范见 [`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md)；实现真源见 `portals/app/prisma/schema.prisma`

---

## 0. 维度与编号法

本系列维度代码 = **`data`**（数据架构：持久层 / schema / 迁移）。沿用 [`biz-000`](arda-biz-000-index.md) §0 的全局命名法：

```
arda-<维度>-<三位数>-<slug>.md
```

`<三位数>` 百位=层 / 十位=分组 / 个位=层内序：

- **`0xx`** 索引 / **`1xx`** 总体 + 横切工程主题 / **`2xx`** 板块 schema / **`3xx`** 迁移与实施。
- **板块（`2xx`）的十位与 biz 对齐**：`210 assets` / `220 integration` / `230 governance` / `240 services` / `250 admin` / `260 infrastructure`。因此 `biz-2XX` 与 `data-2XX` 天然互指（同一板块，业务面 vs 持久面）。
- 横切主题（隔离 / 索引 / 加密 / 审计）不是业务功能，归为总体架构层的十位分组 `11x..14x`，不设 `4xx` 功能层。

---

## 1. 三层结构

| 层 | 编号 | 内容 |
|---|---|---|
| **第 1 层 · 总体架构** | `data-100` | 定位与边界、设计目标、技术栈、运行时拓扑、领域模型全景、arda 不落的表 |
| **第 1 层 · 横切工程** | `data-110..150` | workspace 隔离模型 / 索引与性能 / 加密与密钥 / 审计与幂等 / 多-agent 归属与共享（跨板块的持久层约束） |
| **第 2 层 · 板块 schema** | `data-210..260` | 按板块的表结构：字段、关系、删除策略、唯一键与索引、派生字段边界 |
| **第 3 层 · 迁移与实施** | `data-300` | 迁移时间线、部署执行、现状 vs 目标、待办、与既有文档的漂移 |

---

## 2. data 系列看板

| 编号 | 文档 | 层 | 内容来源 | 状态 |
|---|---|---|---|---|
| `data-000` | [索引与编号法](arda-data-000-index.md)（本文件） | - | 新建 | 完成 |
| `data-100` | 数据架构总体 | 1 总体 | 平移 `arda-data-architecture.md` | 完成 |
| `data-110` | workspace 隔离模型（核心约束） | 1 横切 | 抽自 architecture §4 + schema §3 | 完成 |
| `data-120` | 索引与性能约定 | 1 横切 | 抽自 schema §5 | 完成 |
| `data-130` | 加密与密钥（连接串 / 敏感字段 / API Key 哈希） | 1 横切 | 新建（散落汇总） | 完成 |
| `data-140` | 审计与幂等（AuditLog / idempotencyKey 工程） | 1 横切 | 新建 | 完成 |
| `data-150` | 多-agent 数据归属与共享（租户模型 / 三层 scope / ownerApp / 共享契约） | 1 横切 | 新建 | 完成 |
| `data-210` | 数据资产 schema | 2 板块 | 拆自 schema §4.1 | 完成 |
| `data-220` | 数据集成 schema | 2 板块 | 拆自 schema §4.2 | 完成 |
| `data-230` | 数据治理 schema | 2 板块 | 拆自 schema §4.3 | 完成 |
| `data-240` | 数据服务 schema | 2 板块 | 拆自 schema §4.4 | 完成 |
| `data-250` | 管理 schema | 2 板块 | 拆自 schema §4.5 | 完成 |
| `data-260` | 基建 schema（非业务数据） | 2 板块 | 拆自 schema §4.6 | 完成 |
| `data-300` | 迁移与实施 | 3 实施 | 平移 `arda-data-architecture-migration.md` | 完成 |

---

## 3. 板块划分（第 2 层）— 与 `schema.prisma` 六段对齐

沿用 `portals/app/prisma/schema.prisma` 的注释分段，板块编号十位与 [`biz-000`](arda-biz-000-index.md) §3 对齐：

| 板块 id | 名称 | 编号 | 核心表 | 对应 biz |
|---|---|---|---|---|
| `assets` | 数据资产 | `data-210` | Dataset / Tag / DatasetTag / GlossaryTerm | `biz-210` |
| `integration` | 数据集成 | `data-220` | DataSource（v1 仅登记，不做数据搬运） | `biz-220` |
| `governance` | 数据治理 | `data-230` | Policy / QualityRule / QualityResult / Standard / LineageEdge | `biz-230` |
| `services` | 数据服务 | `data-240` | DataService / DataServiceDataset | `biz-240` |
| `admin` | 管理 | `data-250` | ApiKey / AuditLog | `biz-250` |
| `infrastructure` | 基建（非用户业务数据） | `data-260` | WorkspaceRef / SeedTemplate / TemplateVersion | （无 biz 对应；隔离锚点 + 全局模板） |

> `infrastructure` 段是持久层独有：`biz` 侧没有对应板块，因它不是用户业务能力，而是隔离锚点（`WorkspaceRef`）与全局样例模板（`SeedTemplate`，唯一不带 `workspaceId` 的表）。

---

## 4. 迁移映射（本轮：旧 3 文档 -> data 编号）

现有 3 个非正式文档并入本系列编号，删除旧文件名并更新反向链接：

| 旧文件 | 去向 |
|---|---|
| `arda-data-architecture.md` | `data-100`（主体）+ 抽出 `data-110`（隔离模型 §4） |
| `arda-data-architecture-schema.md` | 拆入 `data-210..260`（表详细 §4.1-4.6）+ 抽出 `data-120`（索引 §5） |
| `arda-data-architecture-migration.md` | `data-300` |

**反向链接更新范围**：全库 19 个文件引用旧文件名（`biz` 全系列 + 3 个旧文档自身）。改名时统一替换；并把 [`biz-000`](arda-biz-000-index.md) §0 维度命名空间表中「数据架构」一行的代码由 `arch` 更正为 `data`、既有文档列更新为本系列编号。

---

## 5. 阅读顺序

`data-100`（总体架构） -> 关心的 `data-2xx`（板块 schema） -> `data-300`（迁移与落地）。跨板块的持久层约束（隔离 / 索引 / 加密 / 审计 / 多-agent 共享）见 `data-11x..15x`。跨维度依赖见各文档头部「上游依据」。
