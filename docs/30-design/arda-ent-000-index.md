# arda 权益门控系列 · 索引与编号法（arda-ent-000-index）

> 状态：系列索引（4 篇正文已完成，逐篇对代码真源核验通过）
> 用途：`arda-ent-*`（权益门控维度）系列总目录 —— **arda 作为消费方**如何本地实现门控与同步
> 范围：仅 arda 产品端职责——本地权益类型/Resolver/Gate、pull+cache+invalidate 同步机制、API 消费契约（怎么调、怎么解读响应）、arda 自身的现状-目标迁移。
> **明确不含（平台侧业务，不属于 arda 职责，本系列不设计）**：Org/Workspace/两级 Membership 建模、Plan/Product/Subscription 实体设计、权益解析合并算法（能力就高合并/额度独立成池）、瀑布扣减算法、MVP 阶段规划——这些是 **vxture 平台**（ADR-11 开篇自述"平台侧的订阅、Plan、权益解析、计量"）的职责，arda 只消费其输出（`capabilities` / `quota_pools`），不设计其内部如何算出来。
> 上游依据：[`biz-000`](arda-biz-000-index.md) §0 全局编号法；源材料见 §4 映射表

---

## 0. 边界纠正说明

规划的上一稿把平台侧的实体模型/算法/MVP 路线也纳入了 `ent` 系列，这是越界——arda 是数据域**产品端**，不是平台。平台的 Org/Workspace/Membership、Plan/Product 打包、权益合并算法、瀑布扣减算法，这些属于 vxture 平台自己的设计系列（不在本仓库、不由 arda 侧规划）。本系列现在只回答一个问题：

> **arda 作为消费方，收到平台下发的权益后，自己要建什么、怎么门控、怎么同步？**

不回答"平台如何算出这份权益"。

---

## 1. 维度与编号法

维度代码 = `ent`（权益门控，**arda 侧消费职责**）。沿用 [`biz-000`](arda-biz-000-index.md) §0 全局命名法：`arda-ent-<三位数>-<slug>.md`。

"计量"（曾用代号 `mtr`）**不是 arda 侧维度、不进本系列**：瀑布扣减/配额池是平台侧算法（arda 只 `POST /usage/consume` 上报数字、拿回结果），不是 arda 要设计的能力，`biz-000` §0 维度命名空间表也不再列出这一行（避免误读为待建维度）。

---

## 2. 两层结构（比 data/biz 系列更扁——arda 侧职责本就单薄）

| 层 | 编号 | 内容 |
|---|---|---|
| **第 1 层 · 总体** | `ent-100` | arda 侧权益模型现状（state/tier，`40-entitlement.md`）+ 目标消费契约概览 + SoR 边界重申（权益不建表）|
| **第 1 层 · 本地实现** | `ent-110` | 本地 Resolver/Gate/EnvGuard 行为、pull+cache+invalidate 同步（arda 侧客户端逻辑）|
| **第 2 层 · 消费契约** | `ent-120` | arda 怎么调用平台的 `GET /entitlements`、`POST /usage/consume`，怎么解读 `capabilities`/`quota_pools` 响应体（契约的**形状**，非其算法） |
| **第 3 层 · 迁移** | `ent-300` | arda 自身现状（token claim + Mock Resolver）到目标（平台拉取+缓存）的迁移任务清单（仅 arda 侧任务，平台侧任务只引用不展开）|

---

## 3. ent 系列看板（收窄后，4 篇）

| 编号 | 文档 | 层 | 内容来源（只取 arda 侧相关章节） | 状态 |
|---|---|---|---|---|
| `ent-000` | 索引与编号法（本文件） | - | 新建 | 完成 |
| `ent-100` | 总体：arda 侧权益模型现状 + 目标契约概览 + SoR 边界 | 1 | `40-entitlement.md`（现状全文）+ ADR-entitlement-and-workspace §3.1-3.2（两轴定义，仅作 arda 需理解的契约形状）| 完成 |
| `ent-110` | 本地实现：Resolver/Gate/EnvGuard + 同步机制 | 1 | ADR-entitlement-and-workspace §3.4-3.5（仅 arda 侧执行动作部分）+ `40-entitlement.md`（现状实现）| 完成 |
| `ent-120` | 消费契约：`GET /entitlements` / `POST /usage/consume` 怎么调、响应怎么读 | 2 | ADR-11 §11.7（仅作**契约形状**引用，不涉及平台内部瀑布/合并算法）| 完成 |
| `ent-300` | 迁移：现状(token claim) -> 目标(平台拉取) 的 arda 侧任务清单 | 3 | ADR-entitlement-and-workspace §8（仅挑 arda 侧任务项：3/4/7/9/10）| 完成 |

---

## 4. 源材料映射表（标注哪些内容属于 arda、哪些属于平台不摘录）

| 源文档 | arda 侧内容（本系列会用） | 平台侧内容（本系列不设计，只作既知契约引用） |
|---|---|---|
| `40-entitlement.md` | 全文——这就是 arda 当前实现 | 无（本就是 arda 侧现状文档）|
| `ADR-001-entitlement-and-workspace.md` | §3.4 门控点、§3.5 同步通道（arda 执行动作部分）、§8 实现清单里 arda 侧任务（3/4/7/9/10） | §1 Org/Workspace/Subscription 实体归属、§3.2 挂载粒度设计、§5 workspace 生命周期归属、§5.1 指令通道鉴权机制、§4 模板填充（这些已属平台或已由 [`data`](arda-data-000-index.md) 系列覆盖）|
| `ADR-011-subscription-entitlement-design.md` | §11.7 API 契约（仅契约**形状**：请求/响应字段），供 arda 知道怎么解读 | §11.0-11.6 平台实体/算法（Org/Workspace/Membership/Plan/Product/合并算法/瀑布扣减）、§11.8-11.9 时序与差异、§12 MVP 路线——**全部是平台侧设计，不摘录进 ent 系列** |

---

## 5. 阅读顺序

`ent-100`（现状+契约概览）-> `ent-110`（本地实现）-> `ent-120`（消费契约细节）-> `ent-300`（迁移任务）。

---

## 6. 落地情况

4 篇正文已授权完成：[`ent-100`](arda-ent-100-architecture.md)（总体）、[`ent-110`](arda-ent-110-local-implementation.md)（本地实现）、[`ent-120`](arda-ent-120-consumption-contract.md)（消费契约，每节均标注"形状 vs 不展开"）、[`ent-300`](arda-ent-300-migration.md)（迁移，仅 arda 侧任务）。已对照代码真源（`portals/app/app/entitlement/*.ts(x)`、`auth/lib/claims.ts`）核验，并发现两处此前文档未记录的现状事实：

1. **`Tier` 已先行升级为 5 档**（代码已是 `free|starter|pro|business|enterprise`），但 `40-entitlement.md` 仍描述旧的 4 档——`40-entitlement.md` 已过期，建议按 [`ent-300`](arda-ent-300-migration.md) §2.1 更新或废弃。
2. **claim 支持两种线格式**（平台当前格式 A vs arda-native 目标格式 B），且格式 A 下 trial 与 free 无法区分——这是当前系统的真实缺口，非文档遗漏，详见 [`ent-100`](arda-ent-100-architecture.md) §2.1、[`ent-300`](arda-ent-300-migration.md) §1。

边界自查（4 篇 grep 扫描）：所有平台侧关键词（Membership/Plan/合并算法/瀑布扣减）出现处均在"明确排除"语境下，无越界内容混入正文设计。
