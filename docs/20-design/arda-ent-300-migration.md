# arda 权益门控 · 迁移（arda-ent-300-migration）

> 状态：实时跟踪（随每次迭代更新）
> 层：第 3 层 · 迁移（`ent` 系列，见 [`ent-000`](arda-ent-000-index.md) 索引）
> 范围：**只列 arda 侧任务**——现状（token claim + Mock Resolver）到目标（平台拉取 + 缓存 + invalidate）的迁移清单。平台侧任务（如"平台补 `trial` claim 字段"）只作为 arda 任务的**前置依赖**提及，不展开设计。
> 上游：`ent-100`/`ent-110`/`ent-120`；`ADR-entitlement-and-workspace.md` §8（仅挑其中 arda 侧任务项）

---

## 1. 已知的现状缺口（阻塞项，依赖平台侧，arda 单方面无法解决）

| 缺口 | 现状 | 影响 | 谁来解决 |
|---|---|---|---|
| Trial 与 free 无法区分 | 平台当前 claim 格式 A 的 `subscribed=false` 无法区分两者（见 [`ent-100`](arda-ent-100-architecture.md) §2.1） | `EnvGuard` 无法把 trial 用户自动路由到 beta 栈 | **平台**需在 claim 里补 `trial: boolean` 字段；arda 侧 `claims.ts` 已经预留了消费这个字段的解析逻辑（`o.trial === true`），一旦平台补上即刻生效，无需 arda 改代码 |
| `state` 枚举的 `free` -> `none` 改名 | 代码仍用 `free`（4 值），目标契约设想改 `none` | 两边语义一旦不同步会漂移 | 需**平台先定 claim 契约**，arda 才能跟着改（不是 arda 单方面能定，见 [`ent-100`](arda-ent-100-architecture.md) §3）|

---

## 2. arda 侧任务清单（本系列职责范围内，按建议顺序）

1. ~~更新/废弃 `entitlement.md`~~ **已完成（2026-07-03）**：该文档此前仍描述 4 档 tier（`free/pro/team/enterprise`），与代码现状（5 档 `free/starter/pro/business/enterprise`，见 [`ent-100`](arda-ent-100-architecture.md) §1.2）不一致，已更新为一致。同批一并修正了全库其余旧 4 档残留（`README.md`、`CLAUDE.md`、`decisions.md`"Subscription Tiers as a Closed Enum"决策、`vxture-platform-integration-requirements.md` §3.2 漂移表、`dev-login/route.ts` 的过期示例 URL）。
2. **修正 `gate.tsx` 的过期注释**：顶部注释"tokens carry no entitlement claims"与实际实现矛盾（token 确实携带 `arda` claim），见 [`ent-110`](arda-ent-110-local-implementation.md) §2 的说明。低优先级、纯文档卫生，顺手改。
3. ~~**实现 `PlatformEntitlementResolver`**~~ **已完成（2026-07-07）**：`portals/app/app/entitlement/platform-resolver.ts`，`getEntitlementResolver()` 工厂函数当 `PLATFORM_API_URL` + `PLATFORM_INTERNAL_AUTH_TOKEN` 均设置时自动切换；接口不变，调用方无需改动。
4. ~~**加短 TTL 缓存层**~~ **已完成（2026-07-07）**：进程内 `Map<workspaceId, CacheEntry>` 45s TTL（非 Redis；缓存 C2 响应是短时单机缓存，不需要跨实例一致性）。
5. ~~**接 `invalidate` 接收端点**~~ **已完成（2026-07-07）**：`subscription_changed` provisioning 事件 → `invalidateCache(workspaceId)` 立即清除进程内缓存，下次请求重拉。复用 provisioning webhook 通道，不单独建 invalidate 端点。
6. ~~**接 `POST /usage/consume` 上报**~~ **已完成（2026-07-07）**：`UsageRaw` 本地缓冲 + `flushUsage()` 异步 Job 上报。metric：`storage.bytes` / `service.api.call` / `quality.check.run` / `varda.credit`（见 `biz-260`）。
7. **`MOCK_STATE`/`MOCK_TIER` 的去留**：`PlatformEntitlementResolver` 落地后，`MockEntitlementResolver` 的 mock 回退路径仍需保留给本地开发/无真实 IdP 的场景（CI、local dev）——不是要删除 mock，是要让 mock 与新 resolver 共存，按环境切换（现有 `getEntitlementResolver()` 工厂函数已经是切换点）。

---

## 3. 明确排除、由平台侧或其它系列跟踪的事项

| 事项 | 为什么不在这里 |
|---|---|
| 平台补 `trial` claim 字段 | 平台侧工作，本文件只记录依赖关系（见 §1），不设计平台怎么做 |
| Org/Workspace/Membership 建模、Plan/Product 合并算法、瀑布扣减算法 | 平台侧业务设计，见 [`ent-000`](arda-ent-000-index.md) §0 边界，永久不进本系列 |
| 平台→arda 指令通道的签名/幂等/审计机制 | 已在 [`data-140`](arda-data-140-audit.md)/[`data-300`](arda-data-300-migration.md) 设计，本系列只引用 |
| 模板/示例数据填充 | 已在 [`data-260`](arda-data-260-infrastructure.md)/[`data-300`](arda-data-300-migration.md) 设计 |

---

## 4. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-07-03 | 首版：核对代码真源（`entitlement/*.ts(x)`、`auth/lib/claims.ts`）与三份源文档，发现 tier 已先行升级为 5 档、claim 双线格式并存、trial/free 现状缺口；产出 ent-100/110/120/300 四篇（收窄边界后，仅 arda 侧消费职责）|
| 2026-07-03 | 全库扫描并修正旧 4 档 tier 残留（6 处）：`entitlement.md`（Tier 表 + ArdaClaim 注释 + Invariants 表）、`README.md`（正文 + 架构图）、`CLAUDE.md`（产品定位段）、`decisions.md`（"Subscription Tiers as a Closed Enum"决策）、`vxture-platform-integration-requirements.md` §3.2（漂移表，tier 行标记已对齐、state 行保留待办）、`dev-login/route.ts`（过期示例 URL `tier=team`）|
| 2026-07-03 | **决策 A 确认并推翻 ADR §3.4 反向表述**：`state=none`（无订阅）时 free 档功能也不可用，门控保持二元墙（`status !== "active"` 一律拒绝），非按 features/quota 逐项渲染放行。修正 4 处引用旧"无 free 特例、按 features/quota 渲染放行"原则的文档：`ADR-entitlement-and-workspace.md` §3.4 + §8 任务4、`ADR-11` §12 MVP-1 验收标准、`vxture-platform-integration-requirements.md` §3.1；`ent-110` §2 补充决策确认注记作为权威结论落点。|
| 2026-07-07 | 任务 3-6 全部完成：`PlatformEntitlementResolver`（进程内 45s TTL Map，非 Redis）、`resolveQuota()` + `invalidateCache()`、`subscription_changed` → 立即清缓存、`UsageRaw` 缓冲 + `flushUsage()` → `POST /usage/consume`。同批新增 `GET /api/entitlement/quota` 端点、4 个 METRICS 常量、provisioning webhook（含 `grant.invalidated` v1 noop）。|
