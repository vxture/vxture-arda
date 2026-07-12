# arda 回函 05：`had_trial` 载体裁定回复（arda-plat-240-had-trial-reply）

> 版本：v1.0 · 日期：2026-07-12 · 时间标记：**2607121733**（YYMMDDHHMM = 2026-07-12 17:33）
> 方向：arda（线 B）→ vxture 平台团队
> 对账对象：平台回函 `arda_302_reply-02.md`（vxture 仓 `docs/product/arda/`）§2.1 末尾"新开放项"——`had_trial` 历史属性在 `arda:subscription` claim 退役后失去载体，平台给三选一、未擅自裁定
> 性质：**arda 侧回复 + 推荐方案**，最终仍需平台裁定并写回 `arda_200_interface` / `product_220`

---

## 0. 结论

**arda 推荐方案①：C2 信封增补 `had_trial` 布尔字段**（伴随 `subscription_status` 一并下发）。理由见 §2；方案②③的问题见 §3。在平台裁定并交付前，**请求平台暂缓摘除 `arda:subscription` scope**（§4）。

---

## 1. 背景复述

- D10（trial 到期落点 = `null`）已上产，`null` 态的 UX 文案需要 `had_trial` 区分"从未试用"（CTA=开始试用）vs "试用已用过"（CTA=直接订阅）；
- `had_trial` 当前**唯一载体** = `arda:subscription` access_token claim；
- 该 claim 按 reply-01 §7.1 排期在 e2e 通过后**整体退役**（平台从 arda client 摘除 scope）；
- 退役后 arda 读不到 `had_trial`，文案分岔失去数据来源；
- 平台给三选一，未擅自裁定：①C2 信封加 `had_trial` 布尔；②retire 时机绑定该字段先落地；③改判 arda 本地状态自记。

---

## 2. arda 推荐：方案① C2 信封加 `had_trial` 布尔

### 2.1 为什么

- **权益单一来源原则一致**：ADR-11 §1.7 铁律——权益/订阅状态全部实时经 C2 拉取，arda 不建镜像表、不缓存权益判断依据。`had_trial` 本质是订阅历史事实，和 `subscription_status`/`tier`/`bundled` 同属"平台侧权益引擎知道、arda 只读"的范畴，**放进 C2 信封是唯一与现有架构一致的选项**；
- **不依赖即将退役的通道**：`arda:subscription` claim 本身就要退役（product_210 token exchange 落地后，权益不入 token 是既定目标态）——继续靠它承载 `had_trial` 是抱着一个要死的通道不放，方案①从根上避免这个矛盾；
- **零本地状态**：C2 短 TTL 拉取即可拿到最新值，无需 arda 落库、无需处理"错过 webhook 事件导致状态漂移"的边界情况；
- **实现代价小**：`quota.ts`/`platform-client.ts` 已经在解析 C2 信封的 `capabilities`/`subscription_status`/`bundled`，加一个布尔字段是同构扩展，不新增解析路径。

### 2.2 建议形状

```jsonc
GET /platform/entitlements?workspace_id={W}&product=arda
-> {
  ...,
  "subscription_status": "active" | "trialing" | "expired" | "cancelled" | "suspended" | null,
  "had_trial": true | false   // 新增：该 workspace 对该 product 历史上是否曾进入过 trialing 态
}
```

- 语义 = "该 (workspace, product) 历史上是否存在过 `kind='trial'` 的订阅行"，不随当前 `subscription_status` 变化（`null` 后依然可读）；
- 与 D10 的 sweep/门控读侧口径同源（平台侧订阅引擎本就持有这份历史，只是多下发一个布尔，不是新计算）。

---

## 3. 方案②③的问题（arda 视角，供平台参考）

**方案②（retire 时机绑定 `had_trial` 先落地）**：不解决问题本身，只是延后退役——而且让 arda 继续依赖一个"已判定要退役"的通道，与 product_210 的目标态（权益不入 token）方向相反。若最终仍要做方案①，不如直接做，不必先卡retire 时序。

**方案③（arda 本地自记）**：
- 违反 ADR-11 §1.7 边界（arda 不应自建权益历史的镜像/推断逻辑，订阅历史的 SoR 应始终在平台）；
- provisioning webhook 的 payload（`tenant.provisioned`/`subscription_changed`）里 `plan` 字段能否可靠推断"历史上是否曾是 trial 档"存在歧义（业务层需要"曾经是 trialing 态"，而不是"当前 plan 是不是 trial 命名"，两者不等价，尤其在多订阅并存/plan 改名的情况下）；
- 边界 case 多：workspace 在 webhook 机制上线前就已创建、事件丢失重放、乱序等，都会让 arda 本地记忆与平台真实历史脱节，且无法自愈（不像 C2 每次拉取都是权威值）。

---

## 4. 请求：在裁定落地前，暂缓退役 `arda:subscription` scope

若平台采纳方案①但排期晚于 e2e 完成节点，**请暂缓摘除 arda client 的 `arda:subscription` scope**，直到 `had_trial` 在 C2 落地为止——避免 arda 在过渡期完全失去 `had_trial` 数据来源（宁可多余留一个即将退役的字段，不要出现文案分岔无数据可用的空窗期）。

---

## 5. 请平台确认

1. 是否采纳方案①（C2 信封加 `had_trial` 布尔）；
2. 若采纳，排期是否能早于/伴随 e2e 完成节点交付；
3. 若排期晚于 e2e，请确认暂缓 `arda:subscription` scope 退役直至该字段落地（§4）。

---

## 6. 联系
arda 侧：Stone Smoker（yanhaoguo@gmail.com）；对账追踪见 `arda-plat-300-tracking.md` §2c。
