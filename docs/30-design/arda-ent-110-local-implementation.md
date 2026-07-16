# arda 权益门控 · 本地实现（arda-ent-110-local-implementation）

> 状态：权威设计（随代码演进更新）
> 层：第 1 层 · 本地实现（`ent` 系列，见 [`ent-000`](arda-ent-000-index.md) 索引）
> 范围：**arda 侧**需要实现的本地组件——`EntitlementResolver` / `EntitlementGate` / `EnvGuard` 的行为规范，以及未来同步机制（pull+cache+invalidate）的本地落地方式。不含平台侧如何计算权益。
> 上游：[`ent-100`](arda-ent-100-architecture.md)（两轴模型、claim 格式）；代码真源 `portals/app/app/entitlement/{resolver,gate,env-guard,config}.{ts,tsx}`

---

## 1. `EntitlementResolver`：权益解析接口

```typescript
export interface EntitlementResolver {
  resolve(claim: ArdaClaim | null): Promise<Subscription>;
}
```

**当前实现 `MockEntitlementResolver`**（`resolver.ts`）：

- `claim` 非空 → 直接透传给 `subscriptionFromClaim(claim)`（见 [`ent-100`](arda-ent-100-architecture.md) §1.4）。
- `claim` 为空（本地开发、无真实 IdP）→ 读 `MOCK_STATE` / `MOCK_TIER` 环境变量构造一个假 `ArdaClaim`，再走同一条映射。默认值：`MOCK_STATE=subscribed`、`MOCK_TIER=pro`。

```typescript
export function getEntitlementResolver(): EntitlementResolver {
  return new MockEntitlementResolver();
}
```

**接口稳定性承诺**：`EntitlementResolver` 接口本身不会因为权益来源从"读 token claim"改为"查平台端点"而改变——未来只需替换 `getEntitlementResolver()` 内部返回的实现类（例如 `PlatformEntitlementResolver`），调用方（`/api/entitlement` 路由）代码不用动。这是当前架构已经预留好的扩展点。

---

## 2. `EntitlementGate`：订阅门禁

`gate.tsx` 是客户端组件，渲染在 `AccountGate`**内部**（会话已存在，这里只判断"是否有权访问"）：

1. 挂载时 `fetch("/api/entitlement", { credentials: "include" })`，拿到 `Subscription` JSON。
2. 三态渲染：`loading`（骨架屏）→ `ready`（读 `subscription.status`）→ `error`。
3. **失败即拒绝**：请求出错时按"未授权"处理，展示升级页而非放行——避免在权益检查不确定时泄露应用内容（fail-closed，非 fail-open）。
4. `status === "active"` 才渲染 `children`；否则展示升级页（`EmptyState` + 跳转 `vxture.com/legal/terms` 的升级引导）。

**门禁只看 `status`，不看 `tier`**：档位差异化的功能门控（如"business 才能用某功能"）应在具体路由/组件里用 `tierMeets(subscription.tier, minTier)` 单独判断，不属于这一层全局门禁的职责。

> **决策确认（2026-07-03，决策 A）**：`status !== "active"`（即 `none` 或 `expired`）时**一律不放行，free 档功能也不可用**——这是正式确认的业务规则，不是待重新设计的临时行为。`ADR-001-entitlement-and-workspace.md` §3.4 曾写过相反的目标态（"门控统一按 features/quota 渲染放行，无 free 特例，不是未订阅就挡墙"），该表述**已被推翻**（该文件与 `ADR-11` §12 MVP-1、`20-vxture-platform-integration-requirements.md` §3.1 均已同步加注）。`tier: "free"` 在 `Subscription` 里只在 `expired`/`none` 两种非活跃状态下作为占位值出现，**从未、也不应该**单独触发任何功能放行。

> **代码注释漂移提示**：`gate.tsx` 顶部注释写"tokens carry no entitlement claims"（暗示 token 不带权益 claim），这与 [`ent-100`](arda-ent-100-architecture.md) §1.3 描述的 `arda` claim 事实矛盾——`/api/entitlement` 路由自己的注释明确写"The `arda` scope claim in the access token is the authoritative source"。这条 `gate.tsx` 注释是**过期表述**（大概率是 claim 接入前写的旧注释未随实现同步更新），准确说法应为："客户端组件不能直接读 JWT，必须经同源 API 转发"，而非"token 不带权益数据"。建议随下次改动顺手修正该注释，避免误导后来读者。

---

## 2a. 产品能力矩阵（2026-07-13 定稿——档位功能门控的本地形态）

**归属裁定**：哪档解锁什么功能 = **产品知识**，收敛为 arda 仓库内的版本化配置（**能力矩阵**），平台不配置、不下发任何功能键（[`ent-120`](arda-ent-120-consumption-contract.md) §4a 规则 3；取代 ADR §3.4 旧分工"档位映射由平台下发"）。

```typescript
// 形态示意（biz-300 阶段 0 实施；键目录见 arda-biz-120-domain-entities-and-feature-keys.md）
const CAPABILITY_MATRIX: Record<Tier, readonly FeatureKey[]> = {
  free: [...], starter: [...], pro: [...], business: [...], enterprise: [...],
};
// 能力门 = 入口墙通过（status 活跃）AND 矩阵含键
canUseFeature(sub, key) = hasProductAccess(sub) && CAPABILITY_MATRIX[sub.tier].includes(key)
```

- **求值完全本地**（纯函数），平台不可达时随缓存信封继续有效——松耦合的机制保证。
- 与既有 `tierMeets(tier, min)` 的关系：`tierMeets` 是"矩阵按档位单调递增"这一特例的紧凑写法，继续可用；矩阵是权威表达，二者不得冲突。
- **配额不在此矩阵**：上限型数字（`limits`）与消耗型池（`quota_pools`）由平台下发，产品只执行/展示（[`ent-120`](arda-ent-120-consumption-contract.md) §1）；能力矩阵只含布尔性功能键。
- 矩阵变更 = 产品发版（走评审），并同步导出机器可读工件供 console 定价页渲染（单向、静态，不构成运行时耦合）。

---

## 3. `EnvGuard`：环境路由门禁

`env-guard.tsx` 也渲染在 `AccountGate` 内部，与 `EntitlementGate` 是**并列的两道门**（先经过哪个不影响语义，两者各管一件事）：

- **唯一依据是 `session.user.ardaClaim.state`**（不查 `/api/entitlement`，直接读会话里已解析好的 claim）。
- 路由规则：
  | `state` | 应在哪个栈 |
  |---|---|
  | `trial` | beta（`NEXT_PUBLIC_BETA_URL`）|
  | `subscribed` \| `expired` \| `free` | prod（`NEXT_PUBLIC_PROD_URL`）|
- 若当前栈（由构建期 `NEXT_PUBLIC_APP_ENV` 决定）与规则不符，`window.location.replace()` 跳转到正确栈，**保留原路径**（深链接不丢失）。
- `claim` 为空（本地开发无真实 IdP）→ 跳过校验，直接放行——这是**便利性豁免，非安全豁免**：真正的强制点在服务端会话与权益门禁。
- 重定向进行中持续展示骨架屏，避免应用内容闪烁后又跳走。

> **已知缺口**（承接 [`ent-100`](arda-ent-100-architecture.md) §2.1）：当平台 claim 仍是格式 A 且未带 `trial` 字段时，trial 用户会被误判为 `free`，`EnvGuard` 因而**不会**把他们路由到 beta 栈。这不是 `EnvGuard` 自身的 bug，是上游 claim 信息不足；修复依赖平台侧补齐字段，见 [`ent-300`](arda-ent-300-migration.md) §1。

---

## 4. 门禁配置（`config.ts`）

```typescript
export const DEFAULT_LANDING: string = process.env.DEFAULT_LANDING ?? "/dashboard";
export const MIN_TIER: Tier = (process.env.MIN_TIER as Tier) ?? "pro";
```

- `DEFAULT_LANDING`：认证+授权通过后的落地路由。
- `MIN_TIER`：使用本应用所需的最低档位；低于此档（或订阅非 active）一律展示升级页。两者均可用环境变量覆盖，无需改代码发版。（2026-07-13 起分工原则更新：**功能键与档位映射全部归产品**（§2a 能力矩阵），平台只下发商业事实——MIN_TIER 作为 arda 自己的部署期配置与此完全一致。）

---

## 5. 同步机制：现状 vs 目标（本地落地方式）

**现状**：无同步机制。`EntitlementGate` 每次挂载都重新 `fetch`，`/api/entitlement` 每次都重新读 Redis 会话里的 claim（claim 本身随 token 刷新而更新，无独立缓存层）。

**目标**（[`ent-100`](arda-ent-100-architecture.md) §3；契约细节见 [`ent-120`](arda-ent-120-consumption-contract.md)）：`EntitlementResolver` 的实现改为查平台端点，**本地**需要新增：

1. **短 TTL 缓存**（Redis，与现有 session 存储同基础设施）：避免每次门禁检查都打平台端点。
2. **`invalidate` 接收端点**：平台发权益变更通知时，本地立即失效该 `(workspaceId, product=arda)` 的缓存项，下次访问强制重新拉取——不是本地主动轮询，是被动失效 + 下次访问时才真正重拉（懒失效，非主动预热）。
3. `invalidate` 复用 `data-140` 描述的服务间指令通道（签名/幂等/审计），本系列不重复设计该通道的鉴权机制。

`EntitlementResolver` 接口不变（见 §1），只是内部实现从"读 claim"换成"查缓存→未命中查平台→写缓存"。

---

## 6. 文档导航

| 需要什么 | 看哪个文件 |
|---|---|
| 两轴模型、claim 格式（上游） | [`ent-100`](arda-ent-100-architecture.md) |
| 本地组件行为（本文件） | `ent-110`（本文件） |
| 怎么调用平台端点 | [`ent-120`](arda-ent-120-consumption-contract.md) |
| 迁移任务清单 | [`ent-300`](arda-ent-300-migration.md) |
