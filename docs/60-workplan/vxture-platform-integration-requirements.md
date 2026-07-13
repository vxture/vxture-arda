# arda 对 vxture 平台端的对接要求（v1）

> 状态：对接需求（交付给 vxture 平台团队）
> 上游依据：`docs/ADR-entitlement-and-workspace.md`、`docs/20-design/identity-app-integration-standard.md`、`docs/20-design/entitlement.md`、`docs/20-design/domain-entities-and-feature-keys.md`
> 目的：把 arda「打通」所需平台侧提供的契约一次性讲清，逐项可被平台 implement / 确认。
> 另见：本文件已并入 [`arda-plat-000-index.md`](../20-design/arda-plat-000-index.md) 编号系列——现状/待确认清单/验收判据的对应位置是 [`plat-300`](../20-design/arda-plat-300-tracking.md)；OIDC 契约细节见 [`plat-110`](../20-design/arda-plat-110-oidc-contract.md)。

---

## 0. 现状与阻塞（先读）

arda 当前能力与缺口：

- 身份层（OIDC RP）：基本就位。arda 已实现 Authorization Code + PKCE、JWKS 验签、back-channel logout、BFF（token 只存服务端 Redis）。
- 权益层：**已完成（2026-07-07）**：`PlatformEntitlementResolver` 调 `GET /platform/entitlements`，45s 进程内缓存，`subscription_changed` → 即时失效。当 `PLATFORM_API_URL` + `PLATFORM_INTERNAL_AUTH_TOKEN` 未设置时回落 `MockEntitlementResolver`（本地开发/CI 用）。**待平台侧配置 capability keys + quota_pools（见 `biz-260` §7）后方可 e2e 验收。**
- 指令层（provisioning webhook）：**已完成（2026-07-07）**：`POST /provisioning/webhook`，HMAC-SHA256 验签（`PROVISION_WEBHOOK_SECRET`），4 种事件（`tenant.provisioned/deprovisioned/subscription_changed/grant.invalidated`）。usage consume buffer 亦完成（`UsageRaw` → `POST /usage/consume`）。`seed/wipe` 尚未实现。

因此「打通」需要平台侧提供三件东西：**(1) 身份 token 里的 workspace/org 上下文**、**(2) 只读权益端点**、**(3) 服务间指令/失效通道**。下面逐项给出契约。

> 另注：当前登录失败 `https://arda.vxture.com/?sso=failed`（fix-01 的 Bug A）经判定为 arda 侧 worker-02 环境变量问题（`DEFAULT_RETURN_TO` / `ALLOWED_RETURN_ORIGINS`），不在本对接要求范围；本文件只列**平台侧**需提供/确认的内容。

---

## 1. 总览：两条数据契约 + 三个通道

平台与 arda 仅通过两个契约耦合（ADR §1.7）：

1. **`workspaceId` 隔离键**：业务数据全在 arda；平台不持有。
2. **`(workspace, product=arda)` 订阅行**：订阅/权益/计费全在平台；arda 不建镜像表。

承载这两个契约的三个通道：

| 通道 | 方向 | 用途 | 鉴权 |
|---|---|---|---|
| A. OIDC 身份 | IdP → arda（用户态） | 登录、登出、token 内带 org/workspace 上下文 | 标准 OIDC |
| B. 权益只读端点 | arda → 平台（服务态，拉取） | 按 `(workspaceId, product=arda)` 查 state/tier/features/quota | 服务间 |
| C. 指令/失效通道 | 平台 → arda（服务态，推送） | `invalidate` / `seed` / `wipe` | 服务间签名 |

---

## 2. 通道 A：OIDC 身份（需平台确认 + 补充）

### 2.1 client 注册确认

请平台确认下列注册项与 IdP 实际配置一致（arda 侧已按此实现）：

| 参数 | 值 |
|---|---|
| Client ID（prod） | `arda` |
| Client ID（beta，受众/登出隔离） | `arda-beta` |
| 认证方式 | `client_secret_basic` |
| Redirect URIs | `https://arda.vxture.com/auth/callback`、`https://beta-arda.vxture.com/auth/callback` |
| Post-logout redirect | `https://arda.vxture.com/`、`https://beta-arda.vxture.com/` |
| back-channel logout URI | `https://arda.vxture.com/auth/backchannel-logout`、`https://beta-arda.vxture.com/auth/backchannel-logout` |
| PKCE | S256（不接受 plain） |

### 2.2 token 内必须携带 workspace / org 上下文（新增要求）

ADR §5 要求 IdP 在 token 中下发**不透明**的当前上下文 claim，arda 用它作隔离键并据此向平台查权益：

- `active_org`：当前组织标识（不透明字符串）。
- `active_workspace`：当前 workspace 标识（不透明字符串）——**arda 的业务数据隔离键，必需**。

要求：

- 这两个 claim 在 access token（或可由 BFF 取到的 userinfo）中稳定存在，常态 org:workspace = 1:1，但**格式与语义须按 1:N 设计**（未来多 workspace）。
- arda **不**铸造、不修改 workspace ID，只镜像。
- 上下文切换（org/workspace）是 arda 应用内动作，**不重新走 OIDC**；arda 拿新 `active_workspace` 重新向通道 B 拉权益即可。请平台确认：切换上下文**不需要**重新签发 token / 重新认证（若上下文绑定在 token 内，需提供应用内换取新上下文的机制）。

### 2.3 `arda:subscription` claim 的退役（协调项）

ADR §3.5 决定权益改走通道 B，`arda:subscription` scope/claim **逐步废弃**。过渡期请平台：

- 暂时**继续**在 token 里下发 `arda` claim（`{state, tier, had_trial}`），使 arda 现状不回归；
- 通道 B 上线、arda 切换完成后，再约定时间点停发该 claim。

---

## 3. 通道 B：权益只读端点（平台必须新增）

arda 门控时按当前上下文向平台拉取自己这一行订阅。**arda 不落镜像表**，只做短 TTL 缓存。

### 3.1 端点契约 —— **本节格式已过期（2026-07-03）**

> 下面这版请求/响应形态写于 `ADR-11`（多 Plan/Product 合并、配额池瀑布扣减）定稿**之前**，是扁平的单订阅模型，与权威契约不一致。**实际对接请使用 [`ent-120`](../20-design/arda-ent-120-consumption-contract.md) §1 的分层契约**（`capabilities`/`quota_pools` 结构，来自 `ADR-11` §11.7）。本节原文保留仅作历史参照，不要按此实现。

请求（服务间认证，非用户 token，**旧格式，已过期**）：

```
GET  {PLATFORM_API}/v1/entitlements?workspaceId=<id>&product=arda
Authorization: <服务间凭证，见 3.4>
```

响应（200，**旧格式，已过期**）：

```json
{
  "workspaceId": "ws_123",
  "product": "arda",
  "state": "subscribed",
  "tier": "pro",
  "features": ["arda.assets.dataset", "arda.governance.policy", "arda.quota.ai_calls"],
  "quota": { "arda.quota.ai_calls": 5000, "arda.quota.storage_bytes": 10737418240 },
  "updatedAt": "2026-06-30T00:00:00Z"
}
```

- 无订阅时**查询接口本身**返回 `state=none, tier=free` 的一条正常订阅行（200，不是 404）——这只是**契约层面的响应格式**要求：查询不因无订阅而报错。
- ~~该 free 档对应的 features/quota 可被 arda 正常渲染放行（ADR §3.4「free 无特例」）~~ **已推翻（2026-07-03，决策 A）**：`state=none` 时 arda **门控仍整体拒绝**（二元墙），不放行任何 free 功能——`tier=free` 只是响应体里的占位值，arda 侧不据此渲染任何功能。见 `ADR-entitlement-and-workspace.md` §3.4 修正注、[`ent-100`](../20-design/arda-ent-100-architecture.md) §1.4。
- arda 只查 `product=arda` 一行，不需要也不应看到其他产品订阅。

### 3.2 枚举锁定（请平台书面确认，存在与 arda 代码现状的漂移）

ADR §3.1 定稿枚举：

- `state = trial | subscribed | expired | none`
- `tier  = free | starter | pro | business | enterprise`

**注意 arda 代码现状与设计的剩余漂移（tier 已对齐，state 待办）**：

| 维度 | arda 代码现状（`entitlement/types.ts`） | ADR/设计目标 | 处理 |
|---|---|---|---|
| state | `trial / subscribed / expired / free` | `trial / subscribed / expired / none` | `free` → `none`，待平台 claim 契约先定，arda 才能跟着改（非 arda 单方面能定）|
| tier | `free / starter / pro / business / enterprise` | `free / starter / pro / business / enterprise` | **已对齐**（arda 代码已先行升级为 ADR 五档，2026-07-03 核对确认）|

请平台**以 ADR 五档为准**下发（arda 侧五档已就位）；`state` 的 `free`→`none` 命名仍需平台确认后 arda 才能同步改。若平台计费侧档位命名不同，请在此明确映射表。

### 3.3 features / quota 的归属（ADR §3.4）

> **【本节已取代（2026-07-13，owner 裁定：能力/配额分权）】**下述三条中"平台配置/下发功能键"的表述全部作废，以 [`ent-120`](../20-design/arda-ent-120-consumption-contract.md) v2 与回函 06 为准：**功能键与档位映射全归 arda 本地能力矩阵，平台不配置**；通道 B 只返回商业事实（status/tier/bundled/时间戳）+ 配额（`limits` 上限 + `quota_pools` 消耗池）——**正是"只返回 tier 名让 arda 自己展开"**（当初被否的形态，现为定稿）。

- ~~**features 的「键」由 arda 定义**：……arda 会提供并维护一份权威键清单交平台配置。~~（键仍由 arda 定义，但**不再交平台配置**。）
- ~~**每档开放哪些键 + 配额数值由平台订阅配置下发**。arda **不硬编码「档位 → 功能」映射**（否则改套餐就要发版）。~~（档位→功能映射改为 arda 能力矩阵自持；配额数值仍平台下发。）
- ~~因此通道 B 必须**逐订阅返回当前生效的 features 列表与 quota 数值**，而不是只返回一个 tier 名让 arda 自己展开。~~

### 3.4 鉴权（服务间）

- arda → 平台为**服务间调用**，使用平台签发的服务凭证（API key / 服务 JWT / mTLS，平台定）。请提供：凭证形式、轮换方式、端点 base URL（prod / beta 各一）。

---

## 4. 通道 C：平台 → arda 指令 / 失效通道（平台必须新增）

平台向 arda 推送的指令很少且明确：`invalidate / seed / wipe`（ADR §5.1）。共用同一条已鉴权的服务间通道。

### 4.1 调用形态（arda 暴露内部端点，平台调用）

```
POST {ARDA_INTERNAL}/internal/v1/commands
Authorization: <服务间签名>
{
  "op": "invalidate" | "seed" | "wipe",
  "workspaceId": "ws_123",
  "product": "arda",
  "idempotencyKey": "uuid",        // 幂等，防重放
  "nonce": "...",
  "timestamp": "2026-06-30T00:00:00Z"
}
```

### 4.2 三个指令语义

| op | 触发时机 | arda 行为 |
|---|---|---|
| `invalidate` | 权益变更（付费/开通/降级/过期） | 失效该 `(workspaceId, product)` 的权益缓存，下次访问重拉 → **秒级生效** |
| `seed` | 平台新建/克隆 workspace 并标记需要示例数据 | 配合 `seedStatus`，用户首次进入时把模板业务数据克隆进该 workspace |
| `wipe` | 用户不保留 / 平台触发删除 | 按 `workspaceId` **软删 + 延迟 N 天硬删**该 workspace 全部业务数据；身份/org/workspace 容器去留由平台决定 |

### 4.3 平台侧需保证

- **服务间签名鉴权**：arda 校验签名后才执行（指令可触发破坏性 wipe）。请提供签名方案（密钥/算法）。
- **幂等键**：同一 `idempotencyKey` 重复投递，arda 只执行一次。
- **`invalidate` 必发**：仅靠 TTL 有窗口延迟，业务要求「付费即时可用」，故权益每次变更平台**必须**推一条 `invalidate`。
- **wipe 的可挽回**：arda 用软删 + 延迟硬删；若平台误发，需在延迟窗口内可撤销——请约定撤销/确认机制或仅靠延迟窗口。

---

## 5. workspace 生命周期与示例数据协作（ADR §4 / §5）

- **workspace 的创建 / 克隆 / 删除归平台**；arda 只镜像 + 执行。
- 平台新建 workspace 时，若希望用户体验预置数据，请**标记 `seedStatus`（或等效标记）**并通过 `seed` 指令告知 arda。arda 在用户首次进入时检测标记并克隆模板业务数据（写入正确 `workspaceId`）。
- 删除走 `wipe` 指令，arda 静默清理业务数据，不跨环境搬运。

请平台明确：`seedStatus` 标记是随 workspace 元数据下发，还是仅靠 `seed` 指令携带。

---

## 6. 平台侧待确认清单（汇总）

逐条请平台答复，每条都是「打通」的必要输入：

1. OIDC client `arda` / `arda-beta` 注册项（§2.1）是否与 IdP 实配一致？
2. token 是否已/可下发 `active_org`、`active_workspace`（不透明，§2.2）？切换上下文是否免重认证？
3. `arda:subscription` claim 过渡期是否继续下发，何时停发（§2.3）？
4. 权益只读端点（§3.1）：base URL（prod/beta）、请求/响应字段是否可按本契约提供？
5. 枚举（§3.2）：是否以 ADR 五档 `tier` 与 `state=...|none` 为准？计费侧若有别名，给映射表。
6. ~~features/quota（§3.3）：平台订阅配置能否逐档下发「features 键列表 + quota 数值」？arda 提供键目录，平台据此配置。~~ **已撤回（2026-07-13）**：功能键不再需要平台配置（arda 能力矩阵自持）；配额（`limits`/`quota_pools`）仍请平台按套餐配置，见回函 06。
7. 服务间凭证（§3.4 / §4.3）：形式（API key / 服务 JWT / mTLS）、签名算法、轮换方式、密钥交付方式。
8. 指令通道（§4）：`invalidate / seed / wipe` 载荷与幂等/签名是否可按本契约实现？`invalidate` 是否承诺每次权益变更必发？
9. `seedStatus` 标记的下发方式（§5）。
10. 计费来源（第三方 vs 平台自建）→ 平台订阅写入路径（arda 不直接对接计费，仅消费通道 B 结果）。

---

## 7. 打通判据（验收）

- [ ] 用户从 ruyin.ai / vxture.com 登录后跳转 arda 成功（无 `?sso=failed`），落地 `DEFAULT_LANDING`。
- [ ] 从 vxture.com 退出，arda（及 beta-arda）经 back-channel logout 同步退出。
- [ ] token 内可取到 `active_workspace`，arda 按其向通道 B 拉到本产品权益。
- [ ] 平台变更订阅后推 `invalidate`，arda 缓存失效、门控秒级切换（无需重登录）。
- [ ] 平台建带 `seedStatus` 的 workspace + `seed` 指令，arda 首次进入完成示例数据填充。
- [ ] 平台 `wipe` 指令触发后，arda 软删该 workspace 业务数据并在延迟窗口后硬删。
