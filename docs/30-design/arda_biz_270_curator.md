# arda Curator · 架构定位与骨架（arda_biz_270_curator）

> 状态：架构占位（2026-07-28 owner 裁定，ADR-013）——只定骨架，不定具体功能
> 层：第 3 层 · 产品能力（`biz` 系列，见 [`biz-000`](arda-biz-000-index.md) 索引）
> 范围：arda 自建的数据治理/管理能力（"arda Curator"）的鉴权模型、tier 门控、
>       配额与计量归属、调用 Atlas 的骨架——**不展开**：Curator 具体能做什么
>       （功能矩阵/子能力列表）尚未定义，属于后续需求
> 上游：[`ADR-013`](decisions/ADR-013-arda-curator-decoupling.md)（改名与解耦决策）、
>       [`biz-260`](arda-biz-260-billing.md)（tier/配额表）、
>       [`ent-120`](arda-ent-120-consumption-contract.md)（消费契约）
> 参照实现：`vxture-karda` 的 `kb/tools/` + `kb/retrieval/`（tool 调用骨架 +
>       Atlas 客户端已跑通，但 karda 自己的 feature/capability 矩阵同样是空的）

---

## 0. 名词说明（先读这个，避免和 data-150/170 的"agent"混淆）

`docs/30-design/arda-data-150-multiagent-sharing.md` 和
`arda-data-170-platform-agent-support.md` 里大量使用"agent"这个词，但指的是
**外部产品**（比如 karda，以及未来的 varda）作为 arda 数据的**消费方/产权方**
（`Dataset.ownerApp` / `ApiKey.consumerApp`，agent↔workspace 是 N-N 关系，
经 `DataService` 网关取用数据）。

本文说的 **arda Curator 是完全不同的东西**：它是 arda **自己养的**、跑在 arda
内部、代表 arda 自己的登录用户去管理 arda 自己数据（catalog、glossary、quality
rules 等）的能力。为了避免和上面那个"agent"概念混在一起，这个能力**不叫
agent**，改用业务角色词命名——**Curator**（owner 2026-07-28 裁定，见 §1）。

## 1. 命名与背景

arda 曾经把内嵌 AI 面板叫"Varda"（实现名）/ "Vela"（设计名，CSS 前缀
`vela-*`）。调查确认 `vxture-varda` 是平台**已注册但仍是空仓**的独立产品名——
这个名字是留给未来一个独立 vxture 产品的，不是给 arda 自己用的。继续叫
"Varda" 会在那个产品真正立项时造成品牌冲突。

同时，模型推理这一层从来就不该是"varda"：**Atlas**（`vxture-atlas`）才是
vxture 平台唯一的模型能力/计量入口——"karda、arda、varda 等都只经 Atlas
消费模型，不直连"（Atlas README 原文）。

**决策（ADR-013，2026-07-28）**：
1. 停止使用"Varda"品牌，改名 **arda Curator**（业务角色名，不用"agent"，
   避免和 data-150/170 冲突）。
2. 模型能力完全经 **Atlas** 调用（S2S token-exchange，`aud=atlas`），不是
   某个 arda 自建/varda 风格的专用 LLM 网关。
3. **Atlas 是 AI 用量计量与上报平台 C3 的唯一权威**——arda 自己不实现
   `ai.credit` 的 `POST /usage/consume` 调用点（历史上也从未真正接通过，见
   `arda-plat-200-impl-handoff` "当前无调用点"）。

## 2. 鉴权模型：跟随 arda 现有会话

Curator **不是**像 karda 的 tool 表面那样被外部 agent 经 S2S 调用（那需要
解析一个独立的 inbound `CallerContext`）。Curator 由 arda 自己已登录的用户在
arda 自己的 UI 里触发，因此它的身份/租户上下文就是 arda 现有的会话：

- 用户身份：`resolveIdentity()`（`portals/app/app/auth/lib/session.ts`）解析
  出的 `IdentityClaims`（`sub` + `active_workspace`）。
- **不需要**另建一套 inbound 鉴权——这是和 karda 架构的关键区别，karda 是
  "外部 agent 调 karda"，Curator 是"arda 自己的用户调 arda 自己的能力"。
- 出站调 Atlas 时仍需要**单独铸造**一个 `aud=atlas` 的 S2S token（见 §4），
  这是第二段、独立的鉴权leg——不是把用户的 session token 转发给 Atlas。

## 3. Tier 门控：沿用现有 write/readonly 设计

复用 `entitlement/capability.ts` 里原 `VardaAccess`/`vardaAccessForTier`
（已重命名为 `CuratorAccess`/`curatorAccessForTier`，逻辑不变）：

| Tier | enabled | readonly |
|---|---|---|
| free | false | - |
| starter | true | true |
| pro | true | true |
| business | true | false |
| enterprise | true | false |

这仍是 arda 本地能力矩阵的一部分（ent-110 §2a 的裁定：平台不下发这类功能
布尔，产品自己定义），只是把类型名从 Varda 改成 Curator。

## 4. 配额与计量：Atlas 是计量系统，arda 只做本地展示/准入

- **`ai.credit`**（platform L0 metric，历史名 `varda.credit`）的 atomic
  预扣 consume 调用**由 Atlas 执行**——arda Curator 调 Atlas 时带上
  workspace/tenant 上下文，Atlas 据此向平台 C3 记账。arda 自己**不**实现
  `POST /usage/consume` 的 `ai.credit` 调用点（这条路径此前就从未接通，见
  `arda-plat-200-impl-handoff`；本次是正式确认并写死这个归属，而不是"待办"）。
- arda 侧仍然做的事：读 C2 `quota_pools` 里的 `ai.credit.remaining` 做**本地
  展示**（"还剩多少"横幅），以及 §3 的 tier enabled/readonly 门控——这两个
  都是本地判断，不涉及 consume。
- 参见 [`biz-260`](arda-biz-260-billing.md) §0/§2/§4，[`ent-120`](arda-ent-120-consumption-contract.md) §2。

## 5. 调用 Atlas 的骨架（参照 karda，仅骨架，无真实网络调用）

代码见 `portals/app/app/curator/`：

- `types.ts` — `CuratorContext`（复用 arda 会话身份 + `CuratorAccess`）。
- `atlas-token.ts` — RFC 8693 token-exchange（`Rfc8693TokenSource`），从
  arda 自己的 OIDC client 凭证铸造 `aud=atlas` bearer，按 (org, ws) 缓存。
  与 `vxture-karda` 的 `kb/retrieval/atlas-token.ts` 同构。
- `atlas-client.ts` — `CuratorAtlasClient.chat()`，`getCuratorAtlasClient()`
  在 `ATLAS_BASE_URL` 未配置时返回 `null`（诚实的"未实现"，不是假装能跑）。
  与 `vxture-karda` 的 `kb/retrieval/generation.ts` 同构。
- `catalog.ts` — **空的**任务注册表占位（`CURATOR_TASKS: []`），等具体功能
  确定后再往里加条目，不要在别处散落定义。

新增环境变量（`.env.example`）：`ATLAS_BASE_URL`、`ATLAS_CHAT_PATH`、
`ATLAS_AUDIENCE`、`ATLAS_CURATOR_TASK_PROFILE` / `ATLAS_CURATOR_MODEL`。

## 6. 明确不做的事（本轮范围之外）

- 不定义 Curator 具体能管什么（任务/功能矩阵留空——这是本文档最大的"不展开"）。
- 不实现真实的 Atlas 网络调用（`ATLAS_BASE_URL` 未配置前，client 恒返回 null）。
- 不把 `assistant.tsx` 现有的种子态 UI 接到 `curator/` 模块上。
- 不改动 `vxture-varda`、`vxture-atlas` 仓库本身（本次只动 arda 侧）。
