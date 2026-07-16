# arda 数据架构 · 跨 workspace 授权访问模型（arda-data-160-cross-workspace-authorization）

> 状态：**定稿 v2（2026-07-14 owner 裁定：SoT 对齐平台 sharing 域）**——v1 的"arda 本地 `WorkspaceGrant` 表作 SoR"（原裁定 §1#5）**作废**：平台 `product_110_sharing-isolation`（owner 2026-07-06 拍板，早于本文件 v1）已确立**所有 grant 的单一 SoT = 平台控制面 `sharing` 域**（`sharing.grants` 等三表已建库，`GET /platform/sharing/visible-set` 已上产）。arda 侧收敛为**入口求值方 + 可见集消费方**，不建授权表、不做第二真相源。
> 层：第 1 层 · 横切架构决策（`data` 系列）
> 背景裁定不变（owner 2026-07-13）：**org（tenant）= 硬隔离；workspace = 默认软隔离，同 org 内可授权跨访问；订阅权益归属 workspace 且严格隔离**。
> 本文仍取代 [`data-150`](arda-data-150-multiagent-sharing.md) 决策 D8 的绝对表述——收敛为：**默认不流动；仅经显式授权流动；授权止于 org 内**。
> 上游：vxture 仓 `product_110_sharing-isolation.md` §8（SharingGrant 模型/命中谓词/管理权，**权威**）、`product_200` §3.3（可见集通道）、[`data-110`](arda-data-110-isolation.md)（隔离范式）、arda_000 §3（v1 切片不含跨 WS 共享）

---

## 1. 五条裁定（v2 修订后）

| # | 决策点 | 裁定 |
|---|---|---|
| 1 | 硬边界 | **org**。grant 双方必须同 org，跨 org 一律无通路（平台侧 `tenant_id` FK 硬约束；唯一合法跨 org 形态 = P 级平台资产走 entitlement，不走 grant） |
| 2 | 授予单位 | 平台 SharingGrant 的 grantee 三型：**workspace / product / org_all**（arda 场景最常用 = workspace；此前"WorkspaceGrant"即 grantee_type=workspace 的子集，命名弃用以免误认独立机制） |
| 3 | 粒度与 scope | **资源级**（数据集），scope 值域**钉死 `read`**（写永远只属属主，product_110 §8.2）。整 workspace 授权 = grantee 命中所有资源的多行 grant，不引入通配粒度 |
| 4 | 权益 | **权益不随授权流动**：联合求值 = 命中 grant **∧** 调用方 workspace 对**执行点产品（arda）**持有效 entitlement（product_110 §8.3，公式写死不得放宽）；quota 记账记在消费方 |
| 5 | **载体（SoT）** | ~~arda 本地 `WorkspaceGrant` 表~~ **作废**。**单一 SoT = 平台控制面 `sharing` 域**（`sharing.grants` / `visible_set_current` / `visible_set_refresh`）。arda 不建表、不缓存授权判断的独立副本——只做**入口强制求值**与**可见集短 TTL 消费** |

## 2. arda 侧落地形态（求值/消费方）

### 2.1 读路径（不变的部分）

**data-110 默认 force-filter 范式零改动**：常规查询仍是 `where: { workspaceId }`，跨 ws 可见性不通过扩大默认过滤实现。跨 ws 访问走**独立入口**：

```
消费方入口（"共享给我的"视图 / 对外网关 / 未来 agent 工具面）
  1) GET /platform/sharing/visible-set?workspace_id={caller_ws}&product=arda   # 鉴权同 C2/C3
     → 命中的资源引用集（短 TTL 缓存，复用 C2 缓存模式）
  2) 按可见集的 resource_ref 二次取源行（服务端，单一 helper 收敛）
  3) 入口强制联合求值：grant 命中 ∧ entitlement_active(caller_ws, arda)   # §8.3 公式，召回层过滤
```

- **召回层强制，不做生成后裁剪**（product_110 §8.5 / product_210 §5）；
- 源 workspace 的分级/脱敏 `Policy` 照常执行（Sec-BL1/BL2 出口不变量对被授方同样生效）；
- `grant.invalidated` 事件（webhook 已接收、v1 存档）→ 共享面实装时清可见集缓存 re-scope。

### 2.2 写路径（授予/撤销）

**授权的建立与撤销发生在平台 SoT**，arda 不落授权行：

- 管理权语义（product_110 §8.7）：**workspace 发起 + org 管理员可审计与一键回收**；属主 workspace 随时撤销自己的 grant；
- arda 产品内的"共享"入口 = 触发平台面（console 或平台 sharing API）完成授予，形态随共享面实装时与平台确认——arda 只提供入口与上下文，不写授权数据；
- 审计：授予/撤销的权威审计在平台 `sharing` 域；arda 侧在**取用时**落 `service.access` 类访问审计（已实现）。

### 2.3 时序

**arda v1 明确不含跨 WS 共享**（arda_000 §3 / product_310 剩项 P4.4"入口 grant 求值随共享面"）。本文件为共享面实装时的执行依据；当前不产生编码工作。能力键 `arda.services.cross_workspace_share` 保留（届时门控 arda 内的共享入口 UI）。

## 3. 门控与商业化（不变）

- `arda.services.cross_workspace_share` 入 arda 能力矩阵（business 档——多用户/协作类差异，见 tier 裁定 2026-07-14）；
- 被授方双闸 = 自己 ws 的订阅（执行点产品 entitlement，§1#4）AND grant 命中。

## 4. 与 v1 的差异记录（防回退）

| 项 | v1（2026-07-13） | v2（2026-07-14，现行） | 变更原因 |
|---|---|---|---|
| SoT | arda 本地 `WorkspaceGrant` 表 | 平台 `sharing` 域三表 | product_110 单一真相源原则（grant 横贯数据/知识/能力，联合求值两操作数需同源）；平台表已建库上产 |
| 读路径 | 本地 grant-join helper | 平台可见集 API + 入口联合求值 | 同上；公式 §8.3 平台写死防分叉 |
| 授予界面 | arda 侧授予/撤销 + 本地审计 | 平台面（console/API）授予；arda 只做入口与访问审计 | 授权写路径必须落 SoT |
| grantee | 仅 workspace→workspace | workspace / product / org_all 三型（arda 常用 workspace） | 平台模型是超集，避免功能缺口 |
| 实施时点 | G1 立即建表 | 随共享面（P4.4），v1 无编码工作 | arda_000 v1 切片明确排除 |
