# arda 权益门控 · 消费契约（arda-ent-120-consumption-contract）

> 状态：**契约 v2 定稿（2026-07-13 平台裁定 `arda_303_reply-03`：整体采纳并升格为 product_200 全产品契约）**——`capabilities`（功能键/features）整体退出契约，能力归产品本地档位矩阵；新增时间戳与 `limits` 块；`quota_pools`/consume/invalidate 原样保留。status 值域扩为**六值**（`overdue` 取代提案的 past_due，`@vxture/shared@1.4.0` 已发布）；新增**代表订阅规则**与**演进容错通则**（见 §1a/§4a）。平台**一步切换、不做双发**，切换窗口另函通知；arda 消费端已 v1 容错（平台仍发 `capabilities` 时忽略），两侧无需同步发版。C2/C3 端点 2026-07-07 已上生产；arda 侧消费实现见 `plat-200`
> 层：第 2 层 · 消费契约（`ent` 系列，见 [`ent-000`](arda-ent-000-index.md) 索引）
> 范围：arda 怎么调用平台的权益/计量端点、怎么解读响应体——**只是契约的形状（字段/请求/响应），不是平台内部怎么算出这些字段的**。平台侧的 Org/Workspace/Membership/Plan/Product 建模与权益解析合并算法、瀑布扣减算法，一律不在本文展开，见 [`ent-000`](arda-ent-000-index.md) §0 边界。
> 上游：`ADR-011-subscription-entitlement-design.md` §11.7（仅摘录契约形状字段）；`ent-100`/`ent-110`（本地消费方视角）

---

## 0. 提醒：以下每一节都只是"平台给我的信封长什么样"

本文出现的每一个端点/字段，标注方式统一为：**「形状」**（arda 需要知道的请求/响应结构）+ 一句**「不展开」**（提示背后的平台算法本系列不设计）。凡是本文没有解释"怎么算出来的"的地方，都是有意为之——去 vxture 平台自己的设计文档找答案，不要在本系列里补全它。

---

## 1. 查询权益：`GET /platform/entitlements`

**形状（v2，2026-07-13）**——信封只承载**商业事实**（买了什么），不承载功能解释（意味着什么）：

```
# 单 product 查询（arda 运行时门控主用，高频，缓存友好）
GET /platform/entitlements?workspace_id={W}&product=arda
-> 200 {
    workspace_id, product: "arda",

    # -- 订阅事实（描述性，产品逐字渲染，零解读；六值 = @vxture/shared@1.4.0）--
    status: "active|trialing|overdue|suspended|expired|cancelled" | null,
    tier:   "free|starter|pro|business|enterprise" | null,
    bundled: false,
    trial_ends_at: "...",            # trialing 时非空（倒计时 UX）
    current_period_end: "...",       # active/overdue 时非空（宽限/账期 UX）
    cancel_at_period_end: false,     # 已预约取消（"服务至 X 日"UX）
    data_retention_until: null,      # expired 时非空 = expired 时刻 + 90 天（arda_303 §1.4，一期实现；语义 = 承诺下限）

    # -- 上限型销售数字（就高合并后的单值；产品在动作点本地执行）--
    limits: { "member.max": 20, "dataset.max": 500, "retention.days": 365, ... },

    # -- 消耗型配额池（平台记账 SoT；产品只展示 remaining、经 consume 放行）--
    quota_pools: [
      { metric: "ai.credit",     limit: 500,          remaining: 120,          priority: 10 },
      { metric: "storage.bytes", limit: 107374182400, remaining: 96636764160,  priority: 10 }
    ]
  }

# 批量查询形状同理（entitlements: { "<product>": {...} }），字段以单查询为准。
```

**v2 相对 v1 的变化**：`capabilities`（含 `features` 功能键数组与功能布尔）**整体移除**——哪档开放什么功能是产品知识，收敛进 arda 本地能力矩阵（[`ent-110`](arda-ent-110-local-implementation.md) §2a），平台不再配置、不再下发任何功能键；上限型数字从 `capabilities` 挪入独立 `limits` 块（它们是定价页销售数字，仍归平台，与消耗型池的两种形状对应 ADR-11 §11.3 的两路解析）；新增四个时间戳/日期字段（描述性事实，准入判据见 §4a）。

**§1a 代表订阅规则（arda_303 §1.2 + owner 裁定 2026-07-14，消费侧必须遵守）**：**订阅事实块**（status/时间戳）取自平台选定的同一笔**代表订阅**（precedence = `@vxture/shared` 数组顺序 `active > trialing > overdue > suspended > expired > cancelled`，平手取周期结束最晚者）；**`tier` 与配额块**（`limits` 就高、`quota_pools` 累加）保持跨订阅**就高合并**语义。**平台不变量（owner 裁定 2026-07-14）：同一产品不允许并存多笔档位不同的订阅**（升档 = 原单变更，叠单属过度设计）——故 tier 的代表取值与就高恒等价，但语义归属定为合并侧（与 `limits` 同侧，能力语义的输入）。两块语义不同，**产品不得混读**（例如不得用 `status` 推断某条 pool 的来源订阅状态）。

**status 语义（六值，arda_303 §1.3）**：`overdue` = 欠费宽限（扣款失败、催缴中、**权益保留**——门控放行 + 警示横幅）；`suspended` = 运营拦停（阻断）；`expired` = 权益已停（回落）。arda `hasProductAccess` 放行集 = `{active, trialing, overdue}`。支付面落地前平台不产出 `overdue`（预留防契约再动）。

**不展开**：`tier`/`limits` 的多来源就高合并、`quota_pools` 为何多条池、代表订阅怎么选——平台内部算法，arda 只消费结果。

**arda 侧怎么用这个响应**：
- `status`/`tier`/`bundled` 映射到本地 `Subscription`（入口二元墙看 status；能力门 = status 活跃 AND 本地矩阵 `CAPABILITY_MATRIX[tier]` 含该功能键）。
- `limits` 在对应动作点本地校验（如登记第 N+1 个 Dataset 前查 `dataset.max`）——数值来自平台，执行在产品。
- `quota_pools.remaining` 汇总展示"还剩多少"；消耗型放行以 `consume` 响应为准（§2），水位型（storage.bytes）在动作点用自持字节数对 `limit` 校验（账本是产品自己的业务数据）。
- 时间戳字段直接渲染横幅/倒计时，不做任何策略推断。

**约定**：`?product=` 单个 / `?products=` 逗号分隔批量，二选一；**没有 `?plan=` 入口**——plan 是平台内部的商业打包概念，产品端运行时只认 `product`。**过渡兼容**：平台在 v2 落地前仍下发 `capabilities` 的，arda 忽略该字段；缺失新时间戳字段时对应 UX 降级隐藏，不报错。

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
    replayed: false,       # 幂等回放时为 true（同 key 重试返回与首次相同结果，不二次扣减）
    gated: false
  }
-> 409 {
    gated: true, reason: "quota_exhausted",
    consumed,              # 耗尽前已扣的部分（部分成功语义，见下）
    remaining_total       # 真实余额（reply-01 §5 更正：atomic 拒绝可留正值，非恒为 0）
  }
```

**不展开**：平台按什么优先级（priority）在多个配额池间做瀑布扣减——那是平台算法，arda 只上报"消耗了多少"、拿回"扣了多少、还剩多少"。

**arda 侧职责**：
- 只上报**数量**（`amount` + `metric`），**不上报内容**——消耗的是什么（方案正文、数据集内容）永远留在 arda 侧，不进这条通道（对应 [`ent-100`](arda-ent-100-architecture.md) 隐含的 SoR 边界：内容是产品端业务数据，数字是平台计量事实）。
- `idempotency_key` 防重放/重复计量：同一操作重试必须带同一个 key，`consume` 调用本身必须幂等（与 [`data-140`](arda-data-140-audit.md) 的幂等约定同构，但这是两条独立通道，不复用同一个 key 空间）。
- **超额语义**（reply-01 R5 已定，按操作成本分流）：
  - `service.api.call` / `quality.check.run` = **divisible 后报**（先做事后记账）：409 为**终态**——置本地 gated 标志（拦新调用+横幅）、该 UsageRaw 行标记完成，**不记 flushError、不重试**；部分扣减以响应 `consumed` 为准，未覆盖部分不追缴（reply-01 §5.2）。
  - `varda.credit` = **atomic 预扣**：**先 consume 再执行 AI 操作**，409 → 拒绝执行（贵操作前置门控）；执行失败不返还（v1 接受，量小）。
  - **gated 是从 C2 派生的判断，不是持久标志**（reply-01 §5.1）：`gated ⇔ C2 该 metric 行 remaining ≤ 0`；flush 收 409 → `invalidateCache(workspaceId)` → 下次 C2 拉取（≤45s）自然反映；周期重置后平台读侧自动恢复满额，门自动开——**不要**持久化 gated 标志、写解锁定时器或专门轮询。

---

## 3. 失效通知：`PUSH invalidate`

**形状**：

```
PUSH invalidate { workspace_id, products: ["arda", ...] }   # 支持批量 product
```

**arda 侧动作**：收到即失效本地缓存（见 [`ent-110`](arda-ent-110-local-implementation.md) §5），下次访问强制重新拉取 `GET /platform/entitlements`，实现"秒级生效"（升级/降级几乎立刻反映）。

**不展开**：这条通道复用平台→arda 的服务间指令通道（与 `data-140` 的 seed/wipe 共享鉴权机制），签名/幂等/审计工程细节见 [`data-140`](arda-data-140-audit.md)，本文不重复设计。

---

## 4. 契约层面的硬约定（arda 消费时必须遵守）

1. **arda 永远只按自己的 `product` 查询/上报**，不查询、不感知其他 product 的权益或用量——即使批量端点返回了别的 product，arda 也不应据此做业务决策（那属于平台/其它产品的事）。
2. **arda 不缓存 `quota_pools` 明细做本地扣减判断**——本地只做展示（"还剩多少"），真正的扣减放行判断以 `POST /usage/consume` 的响应（`gated`）为准，避免本地缓存与平台 SoT 不一致导致超额放行。（上限型 `limits` 例外：其账本本就是产品自己的数据，动作点本地校验即为正解，见 §1。）

## 4a. 契约演进规范（2026-07-13 定稿——had_trial 类问题的防复发条款）

契约的新增需求按三条规则**确定性路由**，不逐案谈判：

1. **决策位/资格位禁入信封。** 任何"能不能试用 / 该买什么 / 什么价 / 给不给资格"类字段一律拒绝——商业决策 UI 归 vxture-console（产品端渲染通用入口 + 深链），产品端永远零商业推断。历史案例：`had_trial`（历史布尔 → 产品端推断试用资格）即此类，已废弃。
2. **描述性事实字段按判据准入。** 判据 = **产品无需理解任何平台策略即可逐字渲染**（状态、日期、剩余量、上限数字）。满足判据的字段可随需求加入信封，属正常演进而非补丁（如 `data_retention_until`）。
3. **功能语义不过界。** 哪档解锁什么功能 = 产品能力矩阵（产品仓库内、版本化）；tier→配额数值 = 平台销售配置。产品不展示"升到 X 档得 Y 容量"（那是 console 的事），只深链。

**转化深链词表**（产品 → console 的唯一转化出口，保持极小）：`intent = upgrade | renew | addon | seat`（`seat` 为 arda_303 §2.3 预留：席位按产品独立、与该产品主订阅共终 co-term），参数 `workspace_id / product / metric? / target_tier?`。console 已承诺五条未知 intent 容错（arda_303 §2.2：未知降级订阅管理首页且保留上下文 / 无效参数忽略 / 状态感知渲染 / 未知值观测 / intent 只废弃不删除）——故障降级为一次跳转体验损耗，永不成为产品逻辑错误。

4. **演进容错通则（双方义务，arda_303 §1.3，已写入 product_200）**：产品必须容忍信封**新增字段**（未知即忽略/降级隐藏）与 status **新枚举值**（未知即保守渲染 = fail-closed 拒绝 + 不崩溃）。arda 现状达标：未知字段不解析、未知 status 映射 null。**新增消费代码不得破坏这两条路径。**

---

## 5. 文档导航

| 需要什么 | 看哪个文件 |
|---|---|
| 两轴模型、claim 格式 | [`ent-100`](arda-ent-100-architecture.md) |
| 本地组件如何消费这些契约 | [`ent-110`](arda-ent-110-local-implementation.md) |
| 消费契约形状（本文件） | `ent-120`（本文件） |
| 迁移任务清单 | [`ent-300`](arda-ent-300-migration.md) |
