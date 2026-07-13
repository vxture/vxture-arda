# arda 回函 07：arda_303 执行回执 + 进展回传（arda-plat-260-303-ack-progress）

> 版本：v1.0 · 日期：2026-07-14 · 时间标记：**2607140100**（YYMMDDHHMM）
> 方向：arda（线 B）→ vxture 平台团队
> 对账对象：平台回函 `arda_303_reply-03`（vxture 仓 `docs/product/arda/`）
> 性质：**执行回执**——arda_303 全项确认收讫；§7 行动项已全部完成；附一项双方裁定备案（代表订阅 × tier）与一项 arda 侧连带项通报。**无新增待平台裁定项。**

---

## 1. arda_303 §7 行动项：全部完成（2026-07-14）

| # | 行动项 | 状态 |
|---|---|---|
| 1 | 升级 `@vxture/shared@^1.4.0`，status 对齐六值全集 | ✅ 完成。package.json 下限锁 `^1.4.0`；e2e 验证：`overdue` 过信封校验并**放行**（宽限权益保留，`hasProductAccess` 放行集 = `{active, trialing, overdue}`）、`suspended` 解析后**拒绝**、`expired`/`null` 拒绝 |
| 2 | 演进容错通则自查 | ✅ 达标并回归验证：未知信封字段不解析、未知 status 值（测试用 `"frozen"`）映射 null → fail-closed 不崩溃。已作为规范条款写入 arda `ent-120` §4a，**arda 承诺对等遵守** |
| 3 | 信封 v2 / 别名切换不预动作 | ✅ 遵守。消费端已 v1/v2 双容（v2 优先、v1 回退、`capabilities` 忽略），平台**一步切换**随时可执行，无需与 arda 协调窗口 |

## 2. arda 产品侧同期进展（供平台了解，均已上 beta）

- **能力矩阵**（产品自持，21 键五档累进）+ **门控 UX**（功能全显示 + 档位锁标 + 服务端升级页 + console 深链仅显式点击触发；`seat` 已入 arda 深链词表，console 实现前按未知容错）；
- **信封 v2 消费端**（`limits` 分块、时间戳、代表订阅规则消费侧约束）已实现并验证；
- 企业版语义按 owner 裁定落地：SaaS 售卖面止于 business，enterprise 键集恒等于 business（矩阵构造保证，升级引导永不指向 enterprise）。

## 3. 裁定备案：代表订阅 × tier（owner 2026-07-14，已闭环，请随文档写回固化）

arda 自查发现 arda_303 §1.2 将 `tier` 划入代表订阅事实块，与既有"tier 就高合并"存在理论冲突（同产品双 active 不同档、平手取周期最晚时可能选中低档）。**owner 裁定（两侧同源，无需往返）**：

1. **平台不变量：同一产品不允许并存多笔档位不同的订阅**（升档 = 原单变更；叠单 = 过度设计）；
2. **`tier` 语义归合并侧**（与 `limits` 同为就高合并的能力输入）；代表订阅事实块 = `status` + 时间戳。

请平台在排期 #5 文档写回（product_200 / arda_200_interface）时**将此不变量与 tier 归侧一并固化**，并建议在订阅创建路径加 guardrail 校验（防运营误配叠单）。

## 4. arda 侧连带项通报（arda_303 §7 未列，arda 自查补充）

`arda` claim 整体退役将使 `EnvGuard`（beta/prod 分流组件）失去唯一数据源。因 beta 已内部化、用户路径无分流需求，arda 将**与退役同窗**移除 EnvGuard 并将本地 mock 路径收敛为纯 env 注入——arda 内部工作，不需要平台动作，仅备案避免窗口期误报。

## 5. 等待项（均等平台另函，arda 无预动作）

1. platform-api 中性别名值（arda 届时一次 env 切换）；
2. C2 信封 v2 切换窗口；
3. `AUTH_INTERNAL_TOKEN` 轮换（与上并窗，owner 已知悉）。

## 6. 联系
arda 侧：Stone Smoker（yanhaoguo@gmail.com）；对账追踪 `arda-plat-300-tracking.md` §2e。
