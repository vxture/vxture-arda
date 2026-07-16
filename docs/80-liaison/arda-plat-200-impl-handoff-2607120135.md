# arda 实施回传 · 对 vxture 平台的交付状态说明（arda-plat-200-impl-handoff）

> 版本：v1.3（2026-07-12，网络切换完成 + e2e 全链通过，详见 `arda-plat-300-tracking.md` §4/§4.3；v1.2 按平台回函 `arda_302_reply-02.md` §1 更正 §6 两处过时状态；v1.1 见 2026-07-07 按 `arda-handoff-reply-01.md` 勘误）
> 时间标记：**2607120135**（YYMMDDHHMM = 2026-07-12 01:35，文件签发时间；内容含 2026-07-12 追加更正）
> 面向：vxture 平台团队
> 用途：告知平台 arda 在三通道（C1 OIDC / C2 权益 / C3 指令）及 L0 工具协议上的具体落地方式，
>       供平台侧对接、联调、验收使用。
> 对应：`arda-handoff.md`（平台→arda 方向）的 arda 侧回传文档。
>
> **v1.1 勘误说明**：v1.0 有三处描述与真实代码不符，导致平台回函开出 R2/R3 修正项（实际代码本已正确，是本文档写错）：
> ① back-channel logout 路径实为 `/auth/backchannel-logout`（v1.0 误写 `/auth/logout/back-channel`）；
> ② 上下文 claim 实从 **access_token** 读取（v1.0 误写 id_token）；
> ③ capability 键实为 `service_endpoint.max` / 平铺 `tier`（v1.0 误写 `service.endpoint.max` / `data.tier`）。
> R1（webhook 多 v1 + 常数时间比对）是唯一真实代码补强，已完成。

---

## 1. C1 · 身份通道（OIDC RP）

### 1.1 实现方式

arda 使用 NextAuth.js（自定义 OIDC Provider 适配）实现 Authorization Code + PKCE 流程。
token 存服务端 Redis（`arda-redis`），浏览器只持有不透明 session cookie。

| 参数 | 值 |
|---|---|
| OIDC 端点 | `https://arda.vxture.com/auth/callback`（prod）/ `https://beta-arda.vxture.com/auth/callback`（beta） |
| client_id | `arda`（prod）/ `arda-beta`（beta） |
| 请求 scopes | `openid profile email phone arda:subscription` |
| PKCE | S256，必须 |
| back-channel logout 端点 | `https://arda.vxture.com/auth/backchannel-logout`（五端点标准约定，平台按注册 URI 自动推导投递） |
| token 存储 | 服务端 Redis，不落客户端 |
| session cookie 名 | `vx_rp_session`，HttpOnly / SameSite=Lax |
| session TTL | 30 天（`RP_SESSION_TTL=2592000`） |

### 1.2 token 使用（reply-01 R3）

- arda 从 **access_token**（RS256，同 JWKS 验签后读取）读取 `active_org` / `active_workspace` /
  `roles` / `account_status`，`active_workspace` 作为 `workspaceId` 传入 C2/C3。**id_token 不携带上下文**
  （仅 `sid` / `nonce` / `auth_time` / `userType` / profile 子集，用于验 nonce、建会话、back-channel logout 索引）。
- **refresh 后重取**：token 轮换时从新 access_token 重新解析上下文（`claims.ts` → `toIdentityClaims(rotatedId, rotatedAccess)`），切租户即时对齐。
- `arda:subscription` claim（`state` / `tier` / `had_trial`）当前在 `MockEntitlementResolver`
  模式下仍被读取（过渡期兜底）；C2 联调通过后该 claim 将停止作为权威来源。

### 1.3 back-channel logout 实现

收到平台推送的 back-channel logout 请求后，arda 验签 logout_token（RS256 / iss / aud / exp，
要求 backchannel-logout event + sid、禁 nonce、jti 防重放），销毁该中央 sid 的所有 RP session。
实现文件：`portals/app/app/auth/backchannel-logout/route.ts`（URL `/auth/backchannel-logout`）。

---

## 2. C2 · 权益通道（GET /platform/entitlements 消费方）

### 2.1 调用方式

```
GET /platform/entitlements?workspace_id={W}&product=arda
Header: x-vxture-internal-auth: {PLATFORM_INTERNAL_AUTH_TOKEN}
```

### 2.2 本地缓存策略

- **TTL**：45 秒每 workspaceId（与平台 `Cache-Control: private, max-age=45` 对齐）。
- **缓存粒度**：per-workspaceId 进程内 Map，多实例各自独立缓存。
- **失效触发**：收到 `subscription_changed` 事件后立即清除该 workspaceId 的缓存，
  下次请求强制重拉（无需等 TTL 到期）。
- **降级策略**：平台请求失败时，返回上一次缓存值；无缓存时降级 `{tier:"free", status:"none"}`。
- **接入来源无差别消费**（对齐 product_220 + reply-02）：C2 `capabilities` 现为 `tier: 五档|null` + **`bundled: boolean`** + **`status: none|trial|subscribed|expired`**。arda 解析(`quota.ts`/`platform-client.ts`)：`tier` 可空、读 `bundled`、读 `status`(平台未发时按 tier 有值→subscribed 兜底)。门控公式：**产品 UI = `tier!=null && status∈{trial,subscribed}`**(`hasProductAccess`);**数据取用 = 上式 `|| bundled`**(`hasDataAccess`)。metric `varda.credit→ai.credit`。账号级 `suspended` 走 token `account_status`。详见 `plat-210` / `product_220`。

### 2.3 响应字段映射

arda 消费 `capabilities` 和 `quota_pools` 两个顶层字段（权威格式见 `ent-120`）：

键名以 `quota.ts` 常量为 SoT（reply-01 §6）：

| 平台响应字段 | arda 侧用途 |
|---|---|
| `capabilities["tier"]` | 平铺键（**非** `data.tier`；信封已带 product）→ `Subscription.tier`，决定功能入口渲染 |
| `capabilities["member.max"]` | 席位上限显示（arda 不自行裁决，仅展示） |
| `capabilities["dataset.max"]` | 数据集数量上限提示 |
| `capabilities["datasource.max"]` | 数据源数量上限提示 |
| `capabilities["service_endpoint.max"]` | 服务端点数量上限提示（**下划线**，按 `quota.ts`） |
| `capabilities["varda.enabled"]` | varda agent 入口是否显示 |
| `capabilities["varda.readonly"]` | varda 是否只读模式 |
| `capabilities["sync.frequency"]` | 同步频率展示 |
| `capabilities["retention.days"]` | 数据保留天数展示 |
| `quota_pools[metric="storage.bytes"]` | 存储余量展示（gauge，见 §3.2）|
| `quota_pools[metric="service.api.call"]` | API 调用余量展示 |
| `quota_pools[metric="quality.check.run"]` | 质量检查余量展示 |
| `quota_pools[metric="varda.credit"]` | varda 积分余量展示 |

**arda 侧暴露给前端的聚合端点**：`GET /api/entitlement/quota`（返回 `WorkspaceQuota`，
含 capabilities 平铺 + pools 余量，供页面直接消费）。

### 2.4 capability key 清单（平台需配置）

详见 `biz-260-billing.md` §7 checklist。核心 key 列表（9 键，以 `quota.ts` 为 SoT）：

```
tier, member.max, dataset.max, datasource.max, service_endpoint.max,
varda.enabled, varda.readonly, sync.frequency, retention.days
```

---

## 3. C3 · 指令通道

### 3.1 provisioning webhook（arda 作接收方）

**端点**：`POST /provisioning/webhook`（arda 对外暴露）

**鉴权**（reply-01 R1，Stripe 风格）：header `x-vxture-signature: t=<unix_ts>,v1=<hex>`，
签名体 = `"{t}.{原始报文字节}"`（不可重序列化），`v1 = hex(HMAC_SHA256(secret, ...))`。
密钥 = `PROVISION_WEBHOOK_SECRET`（与平台 `ARDA_PROVISION_WEBHOOK_SECRET` 同值）。
验签要点：解析逗号分隔 k=v；用原始字节重算；与**每个** `v1=`（轮换双签窗期多值）做常数时间比对,任一命中即过；
`|now − t| > 300s` 拒绝（防重放）。另读 header `x-vxture-event` / `x-vxture-delivery`(= payload.id)。
实现：`portals/app/app/provisioning/lib/verify.ts`。

**幂等**：按 `payload.id`（平台投递 UUID）去重，已处理过的 id 返回 200（不重复执行）。

**顺序保护**：按 `(workspaceId, seq)` 单调递增检查，旧 seq 事件丢弃（返回 200）。

**处理的事件类型**：

| 事件类型 | arda 侧动作 |
|---|---|
| `tenant.provisioned` | upsert `WorkspaceRef`（status=provisioned，记录 tenantId/plan） |
| `tenant.deprovisioned` | 标记 `WorkspaceRef.status=deprovisioned`，保留记录（不删除） |
| `subscription_changed` | 清除 C2 entitlement 缓存（`invalidateCache(workspaceId)`），下次请求立即重拉 |
| `grant.invalidated` | v1 noop（数据共享可见集尚未实现），存档用于幂等去重 |

**响应约定**：所有情况均返回 200（包括重复投递和旧 seq）；平台侧无需根据响应体区分处理。

### 3.2 usage consume（arda 作上报方）

arda 采用"本地缓冲 + 异步 Job 上报"模式，**不做本地配额裁决**：

```
业务操作 -> recordUsage(workspaceId, metric, amount, idempotencyKey)
  -> 写入 UsageRaw 表（flushed=false）
  -> ConsumeFlushJob: 读 UsageRaw[flushed=false]
       -> POST /usage/consume（单条，带 idempotency_key）
       -> 200 -> flushed=true
       -> 409 -> flushed=true（终态，不重试、不记 flushError）+ invalidateCache（reply-01 §5.1）
```

**metric 分类与上报模式**（reply-01 R4/R5；详见 `biz-260-billing.md` §4）：

| metric | 类别 | 上报模式 | 触发时机 | amount |
|---|---|---|---|---|
| `storage.bytes` | gauge（存量）| **快照**（未来 `PUT /usage/gauge`，**不接 consume**）| gauge 端点上线后 | 当前总水位 |
| `service.api.call` | counter | divisible 后报 | 外部 ApiKey 调 DataService | 次（1/call）|
| `quality.check.run` | counter | divisible 后报 | 质量规则执行 | 次（rules_run）|
| `varda.credit` | counter | **atomic 预扣**（先 consume 再执行 AI，409 拒绝）| varda AI 操作前 | token 换算积分 |

**storage = gauge 快照（reply-01 R4，已定）**：delta 被否决；快照自愈幂等，平台按 `(workspace, product, metric)` 存最新水位、读时跨产品求和。gauge 端点（`PUT /usage/gauge`）上线前 storage **不挂 recordUsage**，仅 C2 展示 + 本地准入（按 C2 remaining 做 admission check，`remaining ≤ 0` 关闸新上传、删除始终放行）。**当前代码已符合：无 storage consume 触发点。**

**gated 解除（reply-01 §5.1）**：gated 不是持久标志,而是每次准入从 C2 派生的判断 `remaining ≤ 0`；409 后 `invalidateCache` → 下次 C2 拉取（≤45s）自然反映；周期重置后平台 C2 读侧自动恢复满额,门自动开,无悬挂态。

**flush 触发端点**（内部，不对外暴露）：`GET /api/usage/flush`（供定时 Job 或手动触发）。

**varda.credit 特例**：atomic 预扣走同步路径（执行 AI 前直接 consume，409 → 拒绝执行），**不经**上面的异步 buffer/flush；该触发点随 varda consume 接入落地（当前无调用点）。

---

## 4. L0 工具协议（architecture reserve，v1 空实现）

**端点**：`GET /.well-known/vxture-tools`

**当前响应**（v1）：
```json
{ "product": "arda", "version": "v1", "tools": [] }
```

**填充时机**：T1 实施（工具面 S2S token 验签 + 入口求值 + tool manifest）时填充。
S2S token 验签届时复用与 RP 相同的 JWKS，只换 `aud` 与 `act` 检查。
查询入口（DataService query）将在 T1 与 Web 会话解耦，同时接受用户 session 和 S2S token 两种主体。

---

## 5. 数据库与 schema

arda 使用独立 Postgres（`arda-db` / `arda-beta-db`），**不读平台库**。

| schema | 用途 |
|---|---|
| `public.WorkspaceRef` | workspace 注册记录（由 provisioning webhook 维护） |
| `public.ProvisioningEvent` | 事件幂等存档（provisioning webhook 每条事件都写入） |
| `public.UsageRaw` | 用量缓冲（待 flush 到 C3 `consume` 的本地队列） |
| 其余业务表 | arda 业务数据（Dataset / DataSource / DataService 等），均带 `workspaceId` 隔离 |

数据库命名规范：`vxturebiz_arda_{beta,prod}`（目前单 schema 实现，多 schema 为目标态）。

---

## 6. 当前状态与待双方动作

| 项目 | arda 侧 | 平台侧 |
|---|---|---|
| C1 OIDC | **完成** | **完成**（client 已注册） |
| R1 webhook 签名（多 v1 + 常数时间比对）| **完成**（`verify.ts`，2026-07-07 按 reply-01）| 无 |
| R2 back-channel logout 路径 | **完成**（代码本已在 `/auth/backchannel-logout`；仅文档勘误）| 无 |
| R3 上下文 claim 读 access_token + refresh 重取 | **完成**（代码本已正确；仅文档勘误）| 无 |
| §6 capability 键名（`tier` / `service_endpoint.max`）| **完成**（移除 `data.tier` 回退）| 采纳 `quota.ts` 为 SoT |
| C2 PlatformEntitlementResolver | **完成**（代码）| **已上产**（quota 键 8 个 + counter 两池 + L0 两键，2026-07-07/09 班车；见 `arda_302_reply-02` §1.1，取代下方旧行）|
| C3 provisioning webhook | **完成** | **完成**（投递机制已上线） |
| C3 usage consume buffer | **完成**（代码；409 终态+invalidateCache）| **完成**（端点已上线） |
| R4 storage = gauge 快照 | 过渡态：不接 consume，仅 C2 展示+本地准入；`PUT /usage/gauge` **端点已在产，arda 侧可随时接上报**（尚未接线） | **已实现并上产**（PR #711，2026-07-09；`usage_gauges` 表 + LWW + C2 读侧求和；取代下方旧行）|
| R5 counter 超额模式 | flush 侧已对齐（409 不重试+invalidateCache）；varda atomic 预扣待触发点 | **已配置**（counter/gauge metric_kind 随 2026-07-07/09 班车上产）|
| DB migration 0001-0007 | **完成**（worker-02 两库手动 psql）| 无 |
| `/.well-known/vxture-tools` | **完成**（v1 空实现）| 无 |
| **[2026-07-12 更正]** 网络前置 | `PLATFORM_API_URL` 已切内网（值见 worker-02 `etc/.env`，不入库；`arda_302_reply-02` §3.1）| **已解**：内网 base 已给，webhook 改 tailnet 投递已实施 |
| **[2026-07-12 更正]** e2e 全链验收 | R1/R2/R3 就绪，`PLATFORM_API_URL` 已切内网 | ✅ **全链已通过**（真实样例 workspace 实测，详见 `arda-plat-300-tracking.md` §4/§4.3）|

> **[2026-07-12 平台对账更正]**（`arda_302_reply-02` §1）：本表 2026-07-07 首版把 capability keys/quota_pools 标"待配置"、`PUT /usage/gauge` 标"待实施"——**均已过时**：目录配置早在 2026-07-07/09 上产，gauge 端点已于 2026-07-09（PR #711）独立专车上产。e2e 门票现状见下方替换行。

**e2e 门票（2026-07-12 更新，取代 reply-01 §7.4 旧版）**：R1/R2/R3 修正 ✅ + secret 三件套到位 ✅ + 平台目录配置 ✅（已上产） + gauge 端点 ✅（已上产） + 网络前置 ✅（内网 base 已给，见 `arda_302_reply-02` §3.1）——**全链 e2e 只差 `PLATFORM_API_URL` 切内网这一步 + 平台 reseed 运维窗口**。

**e2e 验收路径**：
1. 登录 → **access_token** 携带 `active_workspace`（R3）
2. provisioning webhook（Stripe 签名，R1）投递 `tenant.provisioned` → `WorkspaceRef` 创建
3. `GET /api/entitlement` 调 C2 → 返回正确 tier/capabilities
4. 业务操作 → `UsageRaw` 写入 → flush → `POST /usage/consume` 200
5. 投递 `subscription_changed` → C2 缓存立即失效 → 下次请求重拉新档位

---

## 7. 联系

arda 侧对接：Stone Smoker（yanhaoguo@gmail.com）
内部追踪：`arda-plat-300-tracking.md`
计费模型配置需求：`arda-biz-260-billing.md` §7
平台回函裁定：`arda-handoff-reply-01.md`（R1-R5 + §6 命名 + §7 对齐）
