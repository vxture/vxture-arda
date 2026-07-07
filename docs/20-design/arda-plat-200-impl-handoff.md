# arda 实施回传 · 对 vxture 平台的交付状态说明（arda-plat-200-impl-handoff）

> 版本：v1.0（2026-07-07）
> 面向：vxture 平台团队
> 用途：告知平台 arda 在三通道（C1 OIDC / C2 权益 / C3 指令）及 L0 工具协议上的具体落地方式，
>       供平台侧对接、联调、验收使用。
> 对应：`arda-handoff.md`（平台→arda 方向）的 arda 侧回传文档。

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
| back-channel logout 端点 | `https://arda.vxture.com/auth/logout/back-channel` |
| token 存储 | 服务端 Redis，不落客户端 |
| session cookie 名 | `vx_rp_session`，HttpOnly / SameSite=Lax |
| session TTL | 30 天（`RP_SESSION_TTL=2592000`） |

### 1.2 token 使用

- arda 从 `id_token` 中读取 `active_org`、`active_workspace`，作为 `workspaceId` 传入 C2/C3。
- `arda:subscription` claim（`state` / `tier` / `had_trial`）当前在 `MockEntitlementResolver`
  模式下仍被读取（过渡期兜底）；C2 联调通过后该 claim 将停止作为权威来源。

### 1.3 back-channel logout 实现

收到平台推送的 back-channel logout 请求后，arda 清除对应用户的 Redis session，
用户下次访问时需重新登录。实现文件：`portals/app/app/auth/logout/back-channel/route.ts`。

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

### 2.3 响应字段映射

arda 消费 `capabilities` 和 `quota_pools` 两个顶层字段（权威格式见 `ent-120`）：

| 平台响应字段 | arda 侧用途 |
|---|---|
| `capabilities["data.tier"]` | 映射到 `Subscription.tier`，决定功能入口渲染 |
| `capabilities["member.max"]` | 席位上限显示（arda 不自行裁决，仅展示） |
| `capabilities["dataset.max"]` | 数据集数量上限提示 |
| `capabilities["datasource.max"]` | 数据源数量上限提示 |
| `capabilities["service.endpoint.max"]` | 服务端点数量上限提示 |
| `capabilities["varda.enabled"]` | varda agent 入口是否显示 |
| `capabilities["varda.readonly"]` | varda 是否只读模式 |
| `capabilities["sync.frequency"]` | 同步频率展示 |
| `capabilities["retention.days"]` | 数据保留天数展示 |
| `quota_pools[metric="storage.bytes"]` | 存储余量展示 |
| `quota_pools[metric="service.api.call"]` | API 调用余量展示 |
| `quota_pools[metric="quality.check.run"]` | 质量检查余量展示 |
| `quota_pools[metric="varda.credit"]` | varda 积分余量展示 |

**arda 侧暴露给前端的聚合端点**：`GET /api/entitlement/quota`（返回 `WorkspaceQuota`，
含 capabilities 平铺 + pools 余量，供页面直接消费）。

### 2.4 capability key 清单（平台需配置）

详见 `biz-260-billing.md` §7 checklist。核心 key 列表：

```
data.tier, member.max, dataset.max, datasource.max, service.endpoint.max,
varda.enabled, varda.readonly, sync.frequency, retention.days
```

---

## 3. C3 · 指令通道

### 3.1 provisioning webhook（arda 作接收方）

**端点**：`POST /provisioning/webhook`（arda 对外暴露）

**鉴权**：HMAC-SHA256，header `x-vxture-signature: sha256={hex}`，
密钥 = `PROVISION_WEBHOOK_SECRET`（与平台 `ARDA_PROVISION_WEBHOOK_SECRET` 同值）。
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
       -> 200/409 -> 标记 flushed=true/记录 flushError
```

**上报的 metric**（详见 `biz-260-billing.md` §4）：

| metric | 触发时机 | amount 单位 |
|---|---|---|
| `storage.bytes` | 数据集写入/删除时 | 字节数（delta，正增 / 负减） |
| `service.api.call` | 外部 ApiKey 调用 DataService 时 | 次（1/call） |
| `quality.check.run` | 质量规则执行时 | 次（1/run） |
| `varda.credit` | varda agent 处理请求时 | token 换算积分 |

**存储上报语义**：snapshot 或 delta 待与平台确认（`biz-260` §3 注记）。

**flush 触发端点**（内部，不对外暴露）：`GET /api/usage/flush`（供定时 Job 或手动触发）。

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
| C2 PlatformEntitlementResolver | **完成**（代码）| **待配置** capability keys + quota_pools（见 `biz-260` §7） |
| C3 provisioning webhook | **完成** | **完成**（投递机制已上线） |
| C3 usage consume buffer | **完成**（代码）| **完成**（端点已上线） |
| DB migration 0007 | **完成**（worker-02 两库已执行）| 无 |
| `/.well-known/vxture-tools` | **完成**（v1 空实现）| 无 |
| storage.bytes 上报语义 | 待确认（delta vs snapshot）| **[待回复]** |
| e2e 全链验收 | 待执行 | 待执行 |

**e2e 验收路径**：
1. 登录 → token 携带 `active_workspace`
2. provisioning webhook 投递 `tenant.provisioned` → `WorkspaceRef` 创建
3. `GET /api/entitlement` 调 C2 → 返回正确 tier/capabilities
4. 业务操作 → `UsageRaw` 写入 → flush → `POST /usage/consume` 200
5. 投递 `subscription_changed` → C2 缓存立即失效 → 下次请求重拉新档位

---

## 7. 联系

arda 侧对接：Stone Smoker（yanhaoguo@gmail.com）
内部追踪：`arda-plat-300-tracking.md`
计费模型配置需求：`arda-biz-260-billing.md` §7
