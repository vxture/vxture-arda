# arda 权益门控 · 总体（arda-ent-100-architecture）

> 状态：权威设计（随代码演进更新）
> 层：第 1 层 · 总体（`ent` 系列，见 [`ent-000`](arda-ent-000-index.md) 索引）
> 范围：**arda 侧**权益模型现状 + 目标消费契约概览 + SoR 边界。**不含**平台侧 Org/Workspace/Membership/Plan/Product 实体设计或权益解析算法——那是 vxture 平台职责，见 [`ent-000`](arda-ent-000-index.md) §0 边界说明。
> 上游：`40-entitlement.md`（现状实现全文）、`ADR-001-entitlement-and-workspace.md` §3.1-3.2（仅作 arda 需理解的契约形状）；代码真源 `portals/app/app/entitlement/*.ts(x)`、`portals/app/app/auth/lib/claims.ts`

---

## 0. SoR 边界（先读）

arda 是数据域**产品端**，**商业事实**（订阅 status/tier/bundled、配额数值与记账）的唯一 SoT 是 **vxture 平台**。arda：

- **不建权益镜像表**（无 Subscription/Plan/Product 表；见 [`data-100`](arda-data-100-architecture.md) §6 "arda 不落的表"）。
- **不设计**平台如何解析多 Plan/多 Product 合并、如何路由配额扣减——那是平台内部算法，arda 只消费其结果。
- **只做两件事**：① 把平台下发的商业事实翻译成本地门控判断（本文 + [`ent-110`](arda-ent-110-local-implementation.md)）；② 按契约与平台通信（[`ent-120`](arda-ent-120-consumption-contract.md)）。

**【2026-07-13 owner 裁定：能力/配额分权（松耦合定稿）】**在上述边界之上新增一条对称边界——**功能语义的 SoT 是产品**：哪档解锁什么功能 = arda 本地能力矩阵（[`ent-110`](arda-ent-110-local-implementation.md) §2a），平台不配置、不下发功能键（`capabilities`/`features` 已从 C2 契约移除，见 [`ent-120`](arda-ent-120-consumption-contract.md) v2）；**配额**（上限数字 + 消耗池）是销售策略，仍全归平台。一句话：**平台管"买了什么"，产品管"意味着什么"**。商业决策 UI（试用资格/买什么/什么价）归 vxture-console，产品端深链、零推断（防 had_trial 类问题复发的规范条款见 [`ent-120`](arda-ent-120-consumption-contract.md) §4a）。同时定向：token 的 `arda` claim **整体退役**（不只 `arda:subscription` scope）——目标态 token 零商业字段，身份面与商业面彻底分离（回函 06）。

---

## 1. arda 侧权益模型：两个正交轴

**代码真源**：`portals/app/app/entitlement/types.ts`。

### 1.1 `ArdaState`（生命周期状态）

```typescript
export type ArdaState = "trial" | "subscribed" | "expired" | "free";
```

| 值 | 含义 |
|---|---|
| `trial` | beta 栈新用户，尚未商业订阅 |
| `subscribed` | prod 栈，有效付费订阅 |
| `expired` | prod 栈，订阅已过期，回落 free 档 |
| `free` | prod 栈，直接订阅后过期，或从未走过 trial |

### 1.2 `Tier`（订阅档位）——**现状已是 5 档**

```typescript
export type Tier = "free" | "starter" | "pro" | "business" | "enterprise";
export const TIER_ORDER: readonly Tier[] = ["free", "starter", "pro", "business", "enterprise"];
```

`tierRank()` / `tierMeets(tier, min)` 提供档位比较；`tierMeets` 是功能门控的标准用法（见 [`ent-110`](arda-ent-110-local-implementation.md) §2）。

> **`docs/30-design/40-entitlement.md` 的历史漂移已修正**（2026-07-03）：该文件此前仍描述旧的 4 档 `free(0)/pro(1)/team(2)/enterprise(3)`（无 `starter`/`business`），与代码现状（5 档）不一致；已同步更新为本文件描述的 5 档模型。后续仍建议以本文件为唯一权威，`40-entitlement.md` 仅作实现细节补充（见 [`ent-300`](arda-ent-300-migration.md) §2）。

### 1.3 `ArdaClaim`（access token 的 `arda` 嵌套 claim）

```typescript
export interface ArdaClaim {
  readonly state: ArdaState;
  readonly tier: Tier;
  readonly had_trial: boolean;
}
```

`had_trial` 语义：用户是否曾进入过 trial（决定升级时是否需要"trial 数据迁移/丢弃"确认步骤；直接订阅路径跳过此步）。

### 1.4 `Subscription`（门控消费视图）

```typescript
export type SubscriptionStatus = "active" | "none" | "expired";
export interface Subscription {
  readonly tier: Tier;
  readonly status: SubscriptionStatus;
}
```

`subscriptionFromClaim(claim)` 把 `ArdaClaim` 映射为 `Subscription`：

| `state` | `status` | `tier` |
|---|---|---|
| `trial` \| `subscribed` | `active` | claim 的 tier |
| `expired` | `expired` | `free` |
| `free` | `none` | `free` |

`EntitlementGate`（[`ent-110`](arda-ent-110-local-implementation.md) §1）只看 `status`：`active` 放行，`expired`/`none` 都进升级页（区别只在文案）。

---

## 2. Claim 的两种线格式：现状 vs 目标

**代码真源**：`portals/app/app/auth/lib/claims.ts` 的 `toArdaClaim()`。这是 `40-entitlement.md` 完全没有记录、但已经写进代码的关键事实——arda 同时兼容平台**当前真实格式**与**未来目标格式**：

| 格式 | 线上形状 | 状态 |
|---|---|---|
| **A（平台当前格式）** | `{ subscribed: boolean, plan: string, status: "active"\|"expired"\|"none" }` | accounts.vxture.com **今天实际下发**的格式 |
| **B（arda-native 目标格式）** | `{ state: ArdaState, tier: Tier, had_trial: boolean }` | ADR-entitlement-and-workspace 设想的目标格式，平台尚未采用 |

`toArdaClaim()` 对两种格式做统一解析，转成同一个内部 `ArdaClaim`。

### 2.1 格式 A 的已知限制（现状缺口）

格式 A 的 `subscribed=false` **无法区分 trial 与 free**（两者都是 `subscribed=false`）——只有当平台的 claim 里带 `trial: true` 才能识别为 trial，否则一律回落判为 `free`。代码注释显式记录：

> "Cannot distinguish 'trial' from 'free' (both have subscribed=false). Until the platform adds a `trial` flag, trial users appear as 'free' and EnvGuard cannot route them to the beta stack automatically."

这意味着：**在平台还未添加 `trial`/`had_trial` 字段之前，[`ent-110`](arda-ent-110-local-implementation.md) 的 `EnvGuard`（trial 用户路由到 beta 栈）实际上不能正确识别 trial 用户**——这是当前系统的一个真实的功能缺口，不是文档遗漏（见 [`ent-300`](arda-ent-300-migration.md) §1 "待平台补齐"）。

---

## 3. 现状 vs 目标契约：一张总表

| 维度 | 现状（代码 + `40-entitlement.md`） | 目标（`ADR-001-entitlement-and-workspace.md` §3.1-3.2，仅取契约形状） |
|---|---|---|
| state 取值 | `trial\|subscribed\|expired\|free` | `trial\|subscribed\|expired\|none`（去 `free`、加 `none`）|
| tier 取值 | 5 档 `free..enterprise`（**已达标**） | 5 档 `free..enterprise` |
| 挂载粒度 | 隐式单 product（`arda` 自身） | `(workspace, product)`，产品端只查自己那行 |
| 权益来源 | OIDC access token 的 `arda` claim（格式 A/B 二选一解析） | 平台只读端点实时拉取 + 短 TTL 缓存 + `invalidate` 失效通知（见 [`ent-120`](arda-ent-120-consumption-contract.md)）|
| resolver | `MockEntitlementResolver`（claim 存在则透传，否则读 `MOCK_STATE`/`MOCK_TIER`） | 同一 `EntitlementResolver` 接口，未来实现改为查平台端点（接口不变，见 [`ent-110`](arda-ent-110-local-implementation.md) §3）|

> `state` 轴的 `free`→`none` 改名**不是 arda 单方面能定的**——需平台侧 claim 契约先定，避免两边语义再次漂移（与 [`data-300`](arda-data-300-migration.md) §4.2 一致的结论）。

---

## 4. 文档导航

| 需要什么 | 看哪个文件 |
|---|---|
| 两轴模型、claim 格式、现状 vs 目标契约（本文件） | `ent-100`（本文件） |
| 本地 Resolver/Gate/EnvGuard 行为、同步机制 | [`ent-110`](arda-ent-110-local-implementation.md) |
| 怎么调用平台的权益/计量端点 | [`ent-120`](arda-ent-120-consumption-contract.md) |
| arda 侧迁移任务清单 | [`ent-300`](arda-ent-300-migration.md) |
