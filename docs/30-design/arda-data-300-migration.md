# arda 数据架构 · 迁移与实施（arda-data-300-migration）

> 状态：实时跟踪（随每次迭代更新；这是"现在在哪、要去哪"的文件，不是稳定设计）
> 层：第 3 层 · 迁移与实施（`data` 系列，见 [`data-000`](arda-data-000-index.md) 索引）
> 范围：schema 迁移时间线、部署时的迁移执行方式、当前实现 vs 目标态的差距、文档漂移、演进路线
> 上游：总体设计见 [`data-100`](arda-data-100-architecture.md)；字段级详情见 `data-210..260`（板块 schema）、横切 `data-110`/`data-120`/`data-130`/`data-140`

---

## 1. 迁移时间线（schema 版本）

`portals/app/prisma/migrations/`，部署时容器启动自动 `prisma migrate deploy` 应用。

| 迁移 | 内容 |
|---|---|
| `0001_init` | 全部核心表 + 2 枚举 + FK + 索引（首次建库） |
| `0002_catalog_fields` | `Dataset` 加 `code/description/domain/refreshFreq/team` + `(workspaceId, code)` 唯一 + `[workspaceId, domain]` 索引 |
| `0003_standards` | 新增 `Standard` 表 |
| `0004_quality_fields` | `QualityRule` 加 `code/name/dimension` + 唯一；`QualityResult` 加 `issues` |
| `0005_service_fields` | `DataService` 加 `code/name/path/method/description/domain/level` + 唯一 |
| `0006_multiagent_scope_ownerapp` | 新增枚举 `AssetScope{workspace,platform}`；`GlossaryTerm`/`Standard` 加 `scope`；`Dataset`/`DataService` 加 `ownerApp`；`DataService` 加 `visibility`；`ApiKey` 加 `consumerApp`；新增 `[workspaceId, ownerApp]` 索引（`Dataset`）。支撑多-agent 归属与共享，见 [`data-150`](arda-data-150-multiagent-sharing.md) |

| `0007_provisioning_and_usage` | `WorkspaceRef` 加 `tenantId/plan/status/updatedAt`；新增 `ProvisioningEvent` 表（C3 provisioning 幂等存档）；新增 `UsageRaw` 表（C3 consume 本地缓冲） |

**当前 schema 版本：`0007_provisioning_and_usage`**（v1，catalog + platform integration）。

---

## 2. 部署时的迁移执行

- **容器启动自动迁移**：`docker-entrypoint.sh` 执行 `cd app && prisma migrate deploy`；**失败仅告警、仍启动应用**（`WARN: prisma migrate deploy failed; starting app anyway`）。
  - 风险：迁移失败不会阻断部署，可能导致 schema 与代码不一致却仍对外服务。运维需盯 entrypoint 日志。
  - 待评估（见 §5）：是否收紧为迁移失败即阻断启动。
- **例外：0001-0007 均通过手动 psql 执行**（2026-07-07）：容器内无 `prisma/migrations/` 目录（打包时被排除），自动迁移不可用。已通过 `docker exec -i arda-db psql` 逐库执行完整 SQL bundle。待解决 migrations 目录打包问题后可恢复自动迁移。
- **健康门槛**：compose 中 `arda-app` `depends_on: arda-db { condition: service_healthy }`，DB 健康后才起应用（但这只保证 DB 可连接，不保证迁移成功）。
- **每栈独立执行**：prod 用 `DATABASE_URL=...@arda-db:5432/arda`，beta 用 `...@arda-beta-db:5432/arda`，互不影响。

---

## 3. 运行时拓扑（部署视角）

| 服务 | 镜像 | 端口 | 卷 |
|---|---|---|---|
| `arda-app` | 自有镜像 `arda-app` | `APP_PUBLISH_PORT`（prod 3230 / beta 3231） | 无（无状态） |
| `arda-redis` | `redis:7-alpine` | 内部 | `${DATA_DIR}/redis:/data`（AOF） |
| `arda-db` | `postgres:16-alpine` | 内部 | `${DATA_DIR}/postgres:/var/lib/postgresql/data` |

每栈数据目录：prod `/srv/md0/arda/data`、beta `/srv/md1/arda-beta/data`。

**备份现状**：`deploy/scripts/55-backup-runtime-state.sh` 历史上面向 Redis 目录；**Postgres 数据目录的备份/恢复覆盖情况待确认**（见 §5 待办 —— 这是当前最值得优先核实的运维缺口）。

---

## 4. 现状 vs 目标态

### 4.1 种子数据：dev-only，尚未对接生产填充路径

| 项 | 现状 | 目标态（ADR §4） |
|---|---|---|
| 填充方式 | `prisma/seed.ts` + `npm run db:seed`，硬编码 `SEED_WORKSPACE_ID=dev-ws-001` | 平台建 workspace + 标记 `seedStatus` -> arda 首次进入按 `SeedTemplate` 克隆进真实 `workspaceId` |
| 是否在部署跑 | **否**（仅本地/CI 手动） | 由用户首次进入触发，非部署时机 |
| 结果 | beta/prod 的真实 workspace **当前是空态** | 有数据可视 |
| Schema 就位度 | `WorkspaceRef.seedStatus`、`SeedTemplate`/`TemplateVersion` 已建表 | 克隆执行逻辑待实现 |

**行动项**：要让线上"看得见数据"，需二选一：(a) 手动给真实 `active_workspace` 灌一次 dev-seed 风格的数据；(b) 落地 ADR §4 的模板填充流程。(b) 是正确的长期路径。

### 4.2 权益（entitlement）：已接平台端点（2026-07-07 完成）

| 项 | 现状 |
|---|---|
| 数据来源 | `PlatformEntitlementResolver`：`GET /platform/entitlements?workspace_id=&product=arda`（当 `PLATFORM_API_URL` + `PLATFORM_INTERNAL_AUTH_TOKEN` 均设置时自动启用；否则回落 `MockEntitlementResolver`）|
| 缓存 | 进程内 `Map` 45s TTL（非 Redis；单机短时缓存足够，不需要跨实例一致性）|
| 失效 | `subscription_changed` provisioning 事件 → `invalidateCache(workspaceId)` 立即清除 |
| quota 端点 | `GET /api/entitlement/quota`：返回 `WorkspaceQuota`（capabilities + pools 余量聚合）|
| arda 是否建镜像表 | 否（不建表，信任 C2 响应）|
| 枚举 | `Tier` 五档已对齐；`ArdaState.free->none` 仍待平台 claim 契约先定 |

### 4.3 平台指令通道：provisioning webhook 已实现；seed/wipe 未实现

| 项 | 现状 |
|---|---|
| provisioning webhook | **已实现（2026-07-07）**：`POST /provisioning/webhook`，HMAC-SHA256，4 事件（`tenant.provisioned/deprovisioned/subscription_changed/grant.invalidated`）|
| 幂等键 | `ProvisioningEvent.id`（平台投递 UUID，非 `AuditLog`）|
| usage consume | **已实现（2026-07-07）**：`UsageRaw` 缓冲 + `flushUsage()` → `POST /usage/consume`；4 个 metric |
| seed / wipe | seed = 首次进入填充已实现（`fillWorkspaceIfNeeded`）；**wipe 已实现（2026-07-14）**：`tenant.deprovisioned` -> `WorkspaceRef.wipedAt` 软删（迁移 0008）+ 90 天后 `/api/lifecycle/sweep` 硬删（保留 AuditLog/锚点），复活窗口 = re-provision 清标记 |
| AuditLog 写入 | 尚无调用点（表已建）|

### 4.4 领域扩展：v1 之外的 `future` 实体

| 实体 | 现状 | 影响 |
|---|---|---|
| 列级 `Field` | 未建模（catalog 详情页 `schema` tab 用 demo 静态字段） | 无法做列级治理/血缘 |
| `Pipeline` / `JobRun` | 未建模 | ETL 屏走静态 seed（`(app)/etl/seed.ts`），非真实调度数据 |

这两项在领域目录中明确标 `future`，非遗漏 —— 建表前置是先有真实业务需求驱动（数据搬运 / 列级治理）。

---

## 5. 待办清单（按优先级）

1. **确认 Postgres 备份覆盖**：`55-backup-runtime-state.sh` 是否已含 `${DATA_DIR}/postgres`；若无，先补运维缺口（数据丢失风险 > 功能缺口）。
2. **决定迁移失败的启动策略**：继续「告警仍启动」还是收紧为「阻断启动」。
3. ~~**落地平台指令通道**~~ **已完成（2026-07-07）**：provisioning webhook + usage consume buffer（见 §4.3）。seed/wipe 尚未实现（表已建，逻辑待实现）。
4. ~~**落地权益实时拉取**~~ **已完成（2026-07-07）**：`PlatformEntitlementResolver` + 45s 进程内缓存 + `subscription_changed` 失效（见 §4.2）。
5. **落地模板填充**：`SeedTemplate` 内容策展 + 首次进入检测 `seedStatus` + 克隆逻辑（先全量复制，重量模板可评估 copy-on-write）。
6. **`ArdaState` 枚举对齐**：待平台 claim 契约确认 `free`/`none` 语义后统一修改。
7. **解决 migrations 目录打包问题**：当前容器内无 `prisma/migrations/`，自动迁移不可用；未来迁移需手动执行。评估是否在 Dockerfile 中 COPY prisma/migrations/ 以恢复 `prisma migrate deploy` 自动化。

---

## 6. 与既有文档的漂移（需修正）

数据层是中途引入的，若干文档仍停留在"Redis-only / 两服务"旧态：

| 文档 | 旧述 | 现状 | 处理 |
|---|---|---|---|
| `ADR-001-entitlement-and-workspace.md` §0 | "arda 目前没有数据层（Redis-only，无 Prisma/无 DB）" | 已有 Prisma 7 + Postgres（0001~0007） | **需更新** §0 前置说明 |
| `40-implementation/10-repository.md` | "docker-compose = 两服务（arda-app + arda-redis）"；无 `prisma/`；列旧 IA 路由 | 三服务（+arda-db）；有 `prisma/`；新 IA | **需更新** |
| `30-design/10-architecture.md` | 容器拓扑仅 app+redis；env 表无 `DATABASE_URL` | +arda-db；每栈 `DATABASE_URL` | **需更新** |
| `docker-compose.yml` 顶部注释 | "arda-app + arda-redis ONLY" | 含 arda-db | **已更新（2026-07-07）** |
| `README.md` | 拓扑/stack 缺 Postgres；`arda-app + arda-redis only` | 三服务 + C2/C3 通道 | **已更新（2026-07-07）** |
| `CLAUDE.md` | `arda-app + arda-redis only` | 三服务 | **已更新（2026-07-07）** |

---

## 7. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-06-30 | 首版：盘点 schema `0001`~`0005`，梳理三层文档结构，列出现状/目标差距与文档漂移 |
| 2026-07-03 | 并入 `data` 编号系列，改名为 `data-300`（原 `arda-data-architecture-migration.md`） |
| 2026-07-07 | 更新 schema 版本至 `0007_provisioning_and_usage`（手动 psql 执行，worker-02 两库完成）；§4.2/4.3 反映 C2/C3 已完成状态；§5 待办 3/4 划完成；新增待办 7（migrations 目录打包）；§6 漂移表更新 README/CLAUDE 已修正，补 `docker-compose.yml` 已修正 |
