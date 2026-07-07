# arda 权益门控 · 消费契约（arda-ent-120-consumption-contract）

> 状态：目标设计（平台端点尚未实现，`ent-300` 追踪落地进度）
> 层：第 2 层 · 消费契约（`ent` 系列，见 [`ent-000`](arda-ent-000-index.md) 索引）
> 范围：arda 怎么调用平台的权益/计量端点、怎么解读响应体——**只是契约的形状（字段/请求/响应），不是平台内部怎么算出这些字段的**。平台侧的 Org/Workspace/Membership/Plan/Product 建模与权益解析合并算法、瀑布扣减算法，一律不在本文展开，见 [`ent-000`](arda-ent-000-index.md) §0 边界。
> 上游：`ADR-11-subscription-entitlement-design.md` §11.7（仅摘录契约形状字段）；`ent-100`/`ent-110`（本地消费方视角）

---

## 0. 提醒：以下每一节都只是"平台给我的信封长什么样"

本文出现的每一个端点/字段，标注方式统一为：**「形状」**（arda 需要知道的请求/响应结构）+ 一句**「不展开」**（提示背后的平台算法本系列不设计）。凡是本文没有解释"怎么算出来的"的地方，都是有意为之——去 vxture 平台自己的设计文档找答案，不要在本系列里补全它。

---

## 1. 查询权益：`GET /platform/entitlements`

**形状**：

```
# 单 product 查询（arda 运行时门控主用，高频，缓存友好）
GET /platform/entitlements?workspace_id={W}&product=arda
-> 200 {
    workspace_id, product: "arda",
    capabilities: {                 # 能力型权益（结构化单值）
      "data.tier": "pro",
      "storage.max": "100GB",
      "member.max": 20,
      "features": ["...", "..."]    # 功能键数组
    },
    quota_pools: [                  # 消耗型权益（数组，可能有多条）
      { metric: "doc.words", limit: 500000, remaining: 120000, priority: 10 }
    ]
  }

# 批量查询（arda 若同时消费多个 product 的权益，一次拿全）
GET /platform/entitlements?workspace_id={W}&products=arda,other_product
-> 200 { workspace_id, entitlements: { "arda": {capabilities, quota_pools}, "other_product": {...} } }
```

**不展开**：`capabilities` 里同一 product 多来源（比如附带 + 单独订阅）怎么合并成这一个值、`quota_pools` 为什么可能有多条池——这是平台的权益解析合并算法，arda 只需要知道**响应体长这样、`capabilities` 是单值、`quota_pools` 是数组**即可消费。

**arda 侧怎么用这个响应**：
- `capabilities["data.tier"]` 映射到本地 `Subscription.tier`（见 [`ent-100`](arda-ent-100-architecture.md) §1.4）。
- `capabilities.features` 决定功能入口是否渲染。
- `quota_pools` 的 `remaining` 汇总展示"还剩多少额度"；具体扣哪一条池由平台在 `consume` 时决定（见 §2），arda 不需要自己实现瀑布路由逻辑。

**约定**：`?product=` 单个 / `?products=` 逗号分隔批量，二选一；**没有 `?plan=` 入口**——plan 是平台内部的商业打包概念，产品端运行时只认 `product`。

---

## 2. 上报消耗：`POST /usage/consume`

**形状**：

```
POST /usage/consume
  body: { workspace_id, product: "arda", metric, amount, idempotency_key }
-> 200 {
    consumed,              # 本次实际扣减总量
    remaining_total,       # 该 (product, metric) 剩余合计
    per_pool_breakdown: [ { subscription_id, metric, took, remaining } ],  # 仅用于对账/审计展示，arda 不需要理解其内部路由依据
    gated: false
  }
-> 409 {
    gated: true, reason: "quota_exhausted",
    consumed,              # 耗尽前已扣的部分（部分成功语义，见下）
    remaining_total: 0
  }
```

**不展开**：平台按什么优先级（priority）在多个配额池间做瀑布扣减——那是平台算法，arda 只上报"消耗了多少"、拿回"扣了多少、还剩多少"。

**arda 侧职责**：
- 只上报**数量**（`amount` + `metric`），**不上报内容**——消耗的是什么（方案正文、数据集内容）永远留在 arda 侧，不进这条通道（对应 [`ent-100`](arda-ent-100-architecture.md) 隐含的 SoR 边界：内容是产品端业务数据，数字是平台计量事实）。
- `idempotency_key` 防重放/重复计量：同一操作重试必须带同一个 key，`consume` 调用本身必须幂等（与 [`data-140`](arda-data-140-audit.md) 的幂等约定同构，但这是两条独立通道，不复用同一个 key 空间）。
- **超额语义**（实现时按 metric 类型选择，需与平台协商确认）：可分割消耗（如字数）建议走"部分成功"（能扣多少扣多少，返回 409 + `consumed > 0`）；原子动作（如一次生成）建议走"全有或全无"（额度不足整笔拒绝、不扣）。arda 侧调用方需要按具体 metric 处理这两种返回形态。

---

## 3. 失效通知：`PUSH invalidate`

**形状**：

```
PUSH invalidate { workspace_id, products: ["arda", ...] }   # 支持批量 product
```

**arda 侧动作**：收到即失效本地缓存（见 [`ent-110`](arda-ent-110-local-implementation.md) §5），下次访问强制重新拉取 `GET /platform/entitlements`，实现"秒级生效"（升级/降级几乎立刻反映）。

**不展开**：这条通道复用平台→arda 的服务间指令通道（与 `data-140` 的 seed/wipe 共享鉴权机制），签名/幂等/审计工程细节见 [`data-140`](arda-data-140-audit.md)，本文不重复设计。

---

## 4. 契约层面的两个硬约定（arda 消费时必须遵守）

1. **arda 永远只按自己的 `product` 查询/上报**，不查询、不感知其他 product 的权益或用量——即使批量端点返回了别的 product，arda 也不应据此做业务决策（那属于平台/其它产品的事）。
2. **arda 不缓存 `quota_pools` 明细做本地扣减判断**——本地只做展示（"还剩多少"），真正的扣减放行判断以 `POST /usage/consume` 的响应（`gated`）为准，避免本地缓存与平台 SoT 不一致导致超额放行。

---

## 5. 文档导航

| 需要什么 | 看哪个文件 |
|---|---|
| 两轴模型、claim 格式 | [`ent-100`](arda-ent-100-architecture.md) |
| 本地组件如何消费这些契约 | [`ent-110`](arda-ent-110-local-implementation.md) |
| 消费契约形状（本文件） | `ent-120`（本文件） |
| 迁移任务清单 | [`ent-300`](arda-ent-300-migration.md) |
