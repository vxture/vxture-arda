# arda 回函 02：对 product_220 的对账与增补提案（arda-plat-210-catalog-reply）

> 版本：v1.0（2026-07-08）
> 方向：arda（线 B）→ vxture 平台团队
> 对账对象：平台 `product_220_catalog-resource-model.md` v1.0（2026-07-08 定稿）
> 配对：去程 `product_220` / 平台回函 `arda-handoff-reply-01.md`；arda 实施回传 `arda-plat-200-impl-handoff.md`
> 性质：arda 侧对 product_220 的采纳确认 + 四项增补提案（请平台纳入 product_220 v1.1 / C2 契约）。owner 已就下列各项拍板（2026-07-08）。

---

## 0. 结论

product_220 整体采纳。三分类学（Product/SKU/Resource）、`bundled` 布尔正交于 tier、L0 `platform_metrics` 单一定义点、席位不池化、profile 盖章拷贝值——全部认同，arda 按 §9 跟进（进度见 §6）。

以下四项为 arda 侧发现的缺口/风险，owner 已拍板，请平台确认并纳入契约：**A 生命周期状态、B 跨产品超冲、C AI credit 熄火、D 组合语义**。

---

## 1. A · 订阅生命周期状态（C2 缺口，请补 `status` 字段）

> **[部分被取代 · 2026-07-09]** 平台已在 **`@vxture/shared` 1.3.0** 落地 canonical 值域（product_220 唯一权威，纯值集、零业务逻辑）：
> - `SubscriptionStatus` = **raw-5** = **`active | trialing | expired | cancelled | suspended`**（`SUBSCRIPTION_STATUSES` 校验常量）；**"无订阅" = `null`**（不在值集内，靠 absence 表达）；
> - `Tier` = `free|starter|pro|business|enterprise`（5 档）；`COMPONENT_ROLES` = `primary|bundled`。
> - C2 从**顶层 `subscription_status`** 下发（非 `capabilities.status`），缺失/越界 = `null`。
>
> 因此本节 §1.2/§1.3 里 arda 自拟的 **4 态命名（none/trial/subscribed/expired）与"放进 capabilities"的形状已被取代**。arda 已改为：从 `@vxture/shared` 导入值域、读顶层 `subscription_status`、门控 `hasProductAccess = status∈{active,trialing}`（覆盖判定属 arda 域：`expired/cancelled/suspended/null` 一律不放行 UI）。
> **注**：平台把 `cancelled`/`suspended` 建成了 status **值**（我们 §1.5/§1.6 曾主张 cancel=事件、suspended=账号轴）——shared 是纯值集，**"哪个 status 给覆盖"归 arda 决定**，故语义论证仍成立，只是线上**值名以 `@vxture/shared` 为准**。§2/§3/§4/§5 不受影响。

### 1.1 问题

product_220 §3 的 C2 `capabilities` 只有 `tier(五档|null) + bundled + features + caps`，**无生命周期状态**。§2 合并只跨 active/trialing 组件，导致：
- 过期订阅被排除 → `tier:null`，与**从未订阅**不可区分；
- 试用 → `tier` 有值，与**付费**不可区分。

arda 的 EnvGuard（trial 路由）与续订 UX 依赖这一区分，C2 v2 一折叠即失明。

### 1.2 提案：4 个 gating 态 + 事件/叠加层

C2 `capabilities` 增补 `status` 字段：

```jsonc
capabilities: {
  tier: "pro" | ... | null,
  status: "none" | "trial" | "subscribed" | "expired",   // 新增：4 个持久 gating 态
  bundled: true | false,
  features: [...], ...caps
}
```

- **持久 gating 态只有 4 个**：`none / trial / subscribed / expired`——判据 = "**订阅停留的条件**"（不是过程、不是另一根轴）。每态对一种停留语义，互不可并（§1.6）。
- **cancelled 不是态，是事件**（owner 裁定）：cancel = **取消订阅（即时退款）**，不是取消续费——一次事件把订阅 `subscribed → none` **立即**结束（平台侧做退款核算）。产品端只看到 `status` 翻到 `none`，无 `cancelled` 值、无 `auto_renew` 旗标。
- **suspended 不进 C2 status**：账号/服务强制冻结走 **token `account_status`**（reply-01 R3 已在 access_token）——它是**另一根轴**的叠加层，查 C2 前即可一票拦停，不占 status 值域。
- **grace/催缴、pending/首付未确认 都不是态**：前者是 `expired` 内部的**过程**（倒计时），后者没付成 = 还没进任何订阅 = `none`。

### 1.3 状态机（owner 2026-07-08 精修）

```
none ──订阅/试用──▶ trial ──转正/付费──▶ subscribed
                       └──到期未转──▶ none  (had_trial=true)     # 试用未转 → none，不是 expired
none ──直购──────────────────────▶ subscribed
subscribed ──cancel(取消订阅,即时退款)──▶ none                    # 事件，立即
subscribed ──续费失败/欠费──▶ expired ──续回付费─▶ subscribed
                                    └──缓冲耗尽─▶ none
account ──冻结/解冻──▶ token.account_status="suspended"          # 另一根轴，叠加
```

**两条精修（请平台对齐）：**
1. **`trial` 到期未转化 → `none`（非 `expired`）**：试用者从没付过钱，判 `expired` 会污染"付费流失"口径与再获取漏斗。`expired` **专表"付费订阅失效"**。
2. **`had_trial` 是历史属性，不是状态**：它记"是否用过试用"，驱动 `none` 的文案（"试用已用过，来订阅" vs "开始试用"），但不改变当前停在哪。同理"从未订 vs 已流失"也是 `none` 的历史属性，不是两个态。

### 1.4 产品-有效状态合并规则（一产品可多订阅供给）

- 取"最可用"：`subscribed` > `trial` > `expired` > `none`；
- 某条订阅 expired/被冻 = 该条退出贡献，不影响同产品其他 active 订阅（arda-pro 正常 + raven 捆绑失效 → arda 仍 subscribed）。

### 1.5 为什么 cancel→none 而非→expired（关键，勿合并）

- `expired` = **被动失效**（没续上钱）：受限（降级/只读、数据仍在）、催缴、UX = "快续订别断"；
- `none`（cancel 后）= **主动离开**：干净、不弹催缴、UX = "已取消，随时回来"。
- 两者**再获取漏斗完全不同**，合并会污染 UX 与增长数据。

### 1.6 四态不可再削（每态一种停留语义 + 访问级）

| 态 | 停留条件 | 访问级 | 为什么不能并入别的 |
|---|---|---|---|
| `none` | 无有效订阅（从未订 / 已离开） | 零 | 唯一"非客户"停留态 |
| `trial` | 试用生效、未付费、有时限 | 全（试用档） | 权益受限 + 出口边 `→none`，与 subscribed 不同 |
| `subscribed` | 付费正常 | 全 | 唯一"正常付费"停留态 |
| `expired` | 付费被动失效、受限 | 降级 | 与 `none` 差别在**数据保留 + 一键续回 subscribed 的边**，非访问级 |

- `subscribed`/`trial` 都是全访问，但**出口边不同**（`subscribed→expired` / `trial→none`）→ 必须分开；
- `expired`≠`none`：哪怕访问级都低，`expired` 带数据保留 + 续回边 → 转移语义不同 → 两个态。

---

## 2. C · AI credit 熄火 + 不浪费（请补池 `audience` 与租户共享策略）

### 2.1 问题

`ai.credit` 池按订阅贡献、消费全局瀑布 → 一个产品跑量大会烧掉别产品组件贡献的池（熄火 + 交叉补贴），且违背 D「组合不是包含」。

### 2.2 提案：产品保留池 + 租户管理员可开共享 + 全程归因

```
① 产品保留池 reserved：每产品订阅组件贡献，audience = 该产品
     → 产品配额被保留，别产品烧不到 → 无熄火、无交叉补贴
② 共享溢出池 shared   ：租户管理员开启并选定参与产品，audience = 参与产品集 / any
     → 闲置额度汇一处、谁缺谁取 → 不浪费

消费(product=X, ai.credit)：先烧 X 的 reserved → 用尽再取 X 参与的 shared
每次 consume 记 usage_events.product → 谁烧多少、共享池内谁超谁，全程可查
```

- **设定权在租户管理员**：workspace 级 credit 共享策略，**默认全 reserved**（安全:不熄火、保配额）；管理员按需纳入共享换取"不浪费"。waste↔starvation 的档由租户自拨；
- **不违反 plan 锁定**（§6）：管理员改的是**消费路由策略**（哪些池参与共享），不是 plan 授予额度，授予值随版本锁死；
- **归因永远在**：reserved/shared 均逐 consume 记 product，"谁超多少"随时可导，成本分摊报表算得清；
- **L0 收益不丢**：`ai.credit` 仍单一 metric/货币/换算基线；audience 只是"可消费池集合"的过滤，不新增端点、不破单一计量入口。

请平台在 `metering.quota_pools`（或池视图）增 `audience`（默认=贡献组件产品），并在 consume 引擎按 `audience ∈ {X, any, X参与的共享集}` 过滤可扣池；共享策略入 workspace 级配置（租户管理员面）。

---

## 3. B · 跨产品并发超冲：接受 + 一条不变量

- **接受**：gauge 共享物理资源（storage）跨产品并发准入的短时超冲予以接受（理由同 reply-01 §4.1：短时磁盘、gauge 自愈、非资金损失）；
- **不变量（请写入契约）**：**成本 = 真金白银的共享资源（`compute.gpu` 等）一律 counter + atomic 预扣，永不 gauge + admission**——超冲只允许发生在"超了不亏钱"的资源上。product_220 已把 compute 设 counter，请把该不变量显式钉入 §4.2。

---

## 4. C1 · 命名/词汇

- **metric key 保持 `ai.credit`**：面向客户可读、跨产品统一货币单位，正确；不加 `l0.`/`platform.` 前缀（L0 归属由 `platform_metrics` 注册表表达，与 `storage.bytes` 一致）;
- **词汇修正**：§3/§4 的"共享池 shared pool"会误导为"单一全局钱包"。建议区分：
  - **共享物理资源**（storage/gpu）：真·一池、跨产品求和、余量各产品一致 → 保留 "shared pool"；
  - **可携带额度**（ai.credit）：是**授予的预算**、按贡献成池、按 audience 消费 → 称 **"L0 计量维度 + 按贡献成池"**，各产品视图余量 = 自己可消费池之和（reserved + 参与的 shared），非全局同一数。

---

## 5. D · 组合不是包含（确认并落模型）

确认：所有产品（含被捆绑的 arda）以 `plan_component` **组合**进 plan，不存在产品 A"包含"产品 B。bundled arda 的配额活在**那个 agent plan 的组件**里，arda 只消费 C2 结果、不自持 bundled 配置。这也正是 §2 credit「reserved 默认贡献产品自用」的依据。

---

## 6. arda 侧 §9 跟进（进行中）

按 product_220 §9 + 本回函 §1：

| 项 | 变更 | 状态 |
|---|---|---|
| `quota.ts` 类型 | `tier: Tier | null` + `bundled: boolean` + `status`；门控按 §3 公式 | 跟进 PR |
| `ArdaState` | `trial/subscribed/expired/none`（`free` 降为 tier=null；无 cancelled 态） | 跟进 PR |
| metric 常量 | `varda.credit → ai.credit`（`storage.bytes` 不变） | 跟进 PR |
| 门控公式 | 产品 UI = `tier != null && status ∈ {trial,subscribed}`；数据取用 = 上式 `|| bundled` | 跟进 PR |
| 文档对齐 | biz-260 / ADR-11 / agent-support / plat-200：删 `billing=bundled_free` 与 "tier rank=free"，改 `{role:'bundled', quota:{...}}` + 布尔 + status | 跟进 PR |

## 7. 请平台确认项

1. C2 `capabilities.status`（4 态 `none/trial/subscribed/expired`）+ 合并规则（§1.4）纳入 C2 契约 / product_220 v1.1；
2. **状态机精修**（§1.3）：`trial` 到期未转 → `none`（非 expired）；`expired` 仅表付费失效；`had_trial` 作历史属性下发（非 status 值）；
3. `account_status="suspended"` 保持在 access_token（reply-01 R3），作为账号级叠加层；
4. quota_pools 增 `audience` + 租户管理员 credit 共享策略（§2）；
5. §4.2 钉入"贵资源必 counter+atomic、gauge 仅限超冲不亏钱资源"不变量；
6. cancel 语义 = 取消订阅即时退款→none（非取消续费），平台侧退款核算对齐。

---

## 8. 联系
arda 侧：Stone Smoker（yanhaoguo@gmail.com）;内部追踪 `arda-plat-300-tracking.md`;实施回传 `arda-plat-200-impl-handoff.md`。
