# arda 回函 06：权益契约收缩（松耦合定稿）——C2 改形 + 商业决策边界 + `arda` claim 整体退役（arda-plat-250-loose-coupling-reply）

> 版本：v1.0 · 日期：2026-07-13 · 时间标记：**2607132030**（YYMMDDHHMM）
> 方向：arda（线 B）→ vxture 平台团队
> 性质：**契约变更提案 + 回函 05 撤回**。owner 已裁定 arda 侧方向（能力/配额分权、松耦合），本函请平台确认契约侧四项变更并写回 `arda_200_interface` / `product_220`。
> 取代关系：**撤回回函 05**（`arda-plat-240-had-trial-reply-2607121733.md`，`had_trial` 载体三选一）——该问题被本函 §2 的边界规则整体消解，不再需要任何载体。
> arda 侧权威落点：`ent-120` v2（契约形状）、`ent-110` §2a（能力矩阵）、`ent-100` §0（分权边界）、decisions.md（决策留痕）。

---

## 0. 一句话结论

**契约只承载商业事实（买了什么），不承载功能解释（意味着什么）**：C2 信封移除 `capabilities`（功能键全归产品本地能力矩阵，平台不再配置）；配额（上限 `limits` + 消耗池 `quota_pools`）不变、仍全归平台；新增四个时间戳/日期字段；商业决策 UI 一律归 console（深链）；`arda` claim 整体退役。

---

## 1. C2 信封 v2（请平台确认并实施）

```jsonc
GET /platform/entitlements?workspace_id={W}&product=arda
-> 200 {
  "workspace_id": "...", "product": "arda",

  // 订阅事实（描述性，产品逐字渲染）
  "status": "trialing|active|past_due|expired|cancelled" | null,
  "tier":   "free|starter|pro|business|enterprise" | null,
  "bundled": false,
  "trial_ends_at": "...",            // trialing 时非空
  "current_period_end": "...",       // active/past_due 时非空
  "cancel_at_period_end": false,     // 已预约取消
  "data_retention_until": null,      // expired 时非空：数据保留截止（与 wipe 排程同源；可二期）

  // 上限型销售数字（就高合并单值；产品动作点本地执行）
  "limits": { "member.max": 20, "dataset.max": 500, "datasource.max": 10,
              "service_endpoint.max": 20, "retention.days": 365 },

  // 消耗型配额池（平台记账 SoT，机制零变更）
  "quota_pools": [ { "metric": "...", "limit": ..., "remaining": ..., "priority": ... } ]
}
```

变更明细（相对 `arda_200_interface` 现行版）：

| # | 变更 | 说明 |
|---|---|---|
| 1 | **移除 `capabilities`**（含 `features` 数组与功能布尔） | 哪档解锁什么功能 = 产品知识，arda 以仓内版本化**能力矩阵**自持；平台侧**无需再为 arda 配置任何功能键**（此前 handoff 请平台配置的 capability keys 清单作废，见 §4）。`varda.enabled`/`varda.readonly`/`sync.frequency` 等功能布尔同归 arda 矩阵 |
| 2 | **上限型数字挪入独立 `limits` 块** | `member.max`/`dataset.max`/`datasource.max`/`service_endpoint.max`/`retention.days`——定价页销售数字，仍由平台按套餐配置、就高合并；产品在动作点本地执行（账本是产品自己的实体计数） |
| 3 | **新增时间戳/日期字段** | `trial_ends_at`/`current_period_end`/`cancel_at_period_end`（对齐 Stripe 底线，倒计时/宽限/已预约取消 UX）+ `data_retention_until`（expired 态数据保留截止，可二期）。同请评估 `status` 枚举补 `past_due`（欠费宽限）语义 |
| 4 | **`quota_pools`/consume/gauge/invalidate 零变更** | 池模型、瀑布扣减、幂等、失效通知全部保留 |

**过渡兼容（无需两侧同步发版）**：平台未实施前继续下发 `capabilities` 的，arda 直接忽略；新字段缺失时 arda 对应 UX 降级隐藏。平台可按自己节奏切换。

---

## 2. 契约演进边界规则（请平台确认为双方共同规范）

为杜绝 `had_trial` 类一次性字段谈判（模型缺陷症状），双方按以下规则**确定性路由**新需求：

1. **决策位/资格位禁入信封**：能不能试用、该买什么、什么价、给不给资格——一律不下发。商业决策 UI 归 **vxture-console**，产品端渲染通用入口 + 深链，零商业推断。
2. **描述性事实按判据准入**：产品无需理解任何平台策略即可逐字渲染的字段（状态/日期/剩余量/上限数字）可正常加入信封，属演进非补丁。
3. **功能语义不过界**：档位→功能 = 产品矩阵；档位→配额数值 = 平台配置；产品不展示"升到 X 档得 Y 容量"（console 的事）。

**转化深链词表**（产品→console 唯一转化出口）：`intent = upgrade | renew | addon`，参数 `workspace_id / product / metric? / target_tier?`。**请 console 承诺容错未知 intent**（降级订阅管理首页）。

---

## 3. 回函 05 撤回 + `arda` claim 整体退役

1. **撤回 `had_trial` 三选一议题**：null 态 CTA 分岔由 console 深链后渲染解决（试用资格计算只发生在 console），信封不需要 `had_trial`/`trial_eligible` 任何形态。方案①②③均不再需要。
2. **`arda:subscription` scope 退役解锁**：不再有任何前置（回函 05 §4 的暂缓请求作废），平台可按期摘除。
3. **进一步：`arda` 嵌套 claim 整体退役**（新提案）：其三个字段全部失去用途——`had_trial` 已死；`tier` 仅剩本地 mock 用途（不需要平台下发）；`state` 路由提示服务的 beta/prod 用户分流已随 beta 降级内部环境而消失。目标态 = **token 零商业字段**（仅身份 + `active_org`/`active_workspace` 上下文），身份面与商业面彻底分离。请平台确认退役排期。

---

## 4. 对既有待办的影响

| 平台侧待办 | 处置 |
|---|---|
| 为 arda 配置 capability keys（`biz-260` §1 移交清单） | **作废**（功能键归产品） |
| 为 arda 配置 quota_pools + `limits` 数值（`biz-260` §2 + 本函 §1.2） | **保留**（配额归平台，请按套餐配置） |
| `had_trial` 载体裁定（回函 05） | **撤回**（本函 §3.1） |
| `arda:subscription` scope 退役 | **解锁**，可按期执行（§3.2） |

---

## 5. 平台侧架构建议（非契约项，供平台自裁）

e2e 实测中 C2/C3/webhook 全部终结于 **auth-bff**（身份认证 BFF 同时承载商业引擎 + 计量记账 + provisioning 事件源）。趁两侧零债务窗口，建议：

1. **commerce 从 auth-bff 拆出**（订阅/权益解析/配额记账/provisioning 事件），auth-bff 回归纯身份——登录是全生态最高可用性面，不应与随业务量线性增长的计量写流量同进程；凭证面也随之分权。
2. **立即可做的廉价高杠杆项**：给产品侧一个**中性内网网关别名**（如 tailnet MagicDNS `platform-api.<tailnet>`），`PLATFORM_API_URL` 指别名而非服务名——此后平台任意重构拓扑，所有产品零改动。此项与是否拆服务无关，建议先行。

（arda 依赖面仅为 base URL + 拓扑中性路径 + 鉴权约定，平台重构不影响 arda。）

---

## 6. 请平台确认清单

1. §1 信封 v2 四项变更（含 `past_due` 枚举评估、`data_retention_until` 排期）；
2. §2 边界规则 + console 深链词表与未知 intent 容错承诺；
3. §3 回函 05 撤回知悉、`arda:subscription` scope 退役排期、`arda` claim 整体退役排期；
4. §4 待办处置表；
5. §5 为建议项，是否采纳由平台自裁（若采纳别名方案，请给出别名，arda 侧一次 env 切换）。

---

## 7. 联系
arda 侧：Stone Smoker（yanhaoguo@gmail.com）；对账追踪见 `arda-plat-300-tracking.md`。
