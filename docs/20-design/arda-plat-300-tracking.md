# arda 平台对接 · 迁移追踪（arda-plat-300-tracking）

> 状态：实时跟踪（2026-07-07 arda 侧全线完成：代码 + DB 迁移（0001-0007）+ 容器重启；待平台配置 quota_pools + e2e 验收）
> 层：第 3 层 · 迁移追踪（`plat` 系列，见 [`plat-000`](arda-plat-000-index.md) 索引）
> 范围：现状阻塞 + 平台侧待确认清单 + 打通验收判据
> 上游：[`plat-100`](arda-plat-100-architecture.md)（三通道全景）、[`plat-110`](arda-plat-110-oidc-contract.md)（OIDC 契约）

---

## 1. 现状

### 平台侧（全线交付，阻塞解除）

| 通道 | 交付项 | 状态 |
|---|---|---|
| C1 OIDC | client `arda`/`arda-beta` 注册、nginx 就位 | DONE |
| C2 权益 | `GET /platform/entitlements` 上线（Cache-Control: private, max-age=45） | DONE |
| C3 consume | `POST /usage/consume` 上线（200 / 409 gated / replayed:true） | DONE |
| C3 provisioning | webhook 投递机制上线（HMAC-SHA256，8 次退避，幂等，逐产品扇出） | DONE |
| P4 sharing 域 | 可见集 API + `grant.invalidated` 事件投递 | DONE |

### arda 侧（2026-07-07 代码全线完成）

| 通道 | 实现内容 | 状态 |
|---|---|---|
| C1 OIDC | PKCE RP、JWKS 验签、back-channel logout、Redis session、`phone` scope 已加 | DONE |
| C2 权益 | `PlatformEntitlementResolver`：45s TTL 缓存、quota_pools + capabilities 全量解析、`resolveQuota()`、`invalidateCache()` | DONE |
| C2 配额端点 | `GET /api/entitlement/quota` → 返回 `WorkspaceQuota`（存储余量、api.call 余量等） | DONE |
| C3 provisioning | `/provisioning/webhook`：HMAC-SHA256 验签、幂等（event id）、seq 防乱序、`tenant.provisioned/deprovisioned`、`subscription_changed`（清 C2 缓存）、`grant.invalidated`（v1 noop 存档） | DONE |
| C3 consume buffer | `UsageBuffer`（`recordUsage` → `UsageRaw` 表）+ `ConsumeFlushJob`（`flushUsage` → `POST /usage/consume`）+ `GET /api/usage/flush` | DONE |
| C3 metric 定义 | `METRICS` 常量：`storage.bytes` / `service.api.call` / `quality.check.run` / `varda.credit` | DONE |
| P4 sharing stub | `/.well-known/vxture-tools` 路由预留（L0 工具协议，T1 实现时填充） | DONE |
| 计费模型 | `biz-260-billing.md` 完整 7 维设计：C2 capability keys + C3 metric names + 档位矩阵 | DONE |

---

## 2. 剩余实施项（代码外，待 owner 操作）

### 必须完成才能 e2e

| # | 项目 | 状态 |
|---|---|---|
| O1 | **Prisma migration 执行**：worker-02 两个 DB 全量执行 0001-0007（手动 psql，因容器内无 migrations 目录） | **已完成（2026-07-07）** |
| O2 | **容器重启**：`docker restart arda-app arda-beta-app`，两容器均 healthy | **已完成（2026-07-07）** |
| O3 | **平台配置 arda 权益**：按 `biz-260-billing.md` §7 + `plat-200-impl-handoff.md` §2 capability key 表，让平台在 `GET /platform/entitlements` 返回正确的 capabilities + quota_pools | **[owner 操作] 待发给 vxture 平台团队** |

### 已完成的 owner 操作

| 项目 | 完成时间 |
|---|---|
| OIDC client secrets 转运至 worker-02 | 2026-07-07 |
| `PLATFORM_INTERNAL_AUTH_TOKEN` 写入 worker-02 两个 .env | 2026-07-07 |
| `PROVISION_WEBHOOK_SECRET` 写入 worker-02 两个 .env | 2026-07-07 |
| `POSTGRES_*` / `DATABASE_URL` 写入 worker-02 两个 .env | 2026-07-07 |
| `OIDC_SCOPES` 加 `phone` 写入 worker-02 两个 .env | 2026-07-07 |

---

## 2b. 平台回函 reply-01 裁定落地（2026-07-07）

平台回函 `arda-handoff-reply-01.md` 对 arda 回传对账,开出 R1-R5。**核实后:R2/R3 代码本已正确(是 impl-handoff 文档写错触发的裁定),仅 R1 是真实代码补强。**

| # | 裁定 | arda 侧落地 | e2e 阻断 |
|---|---|---|---|
| R1 | webhook 签名 = Stripe 风格 `t=,v1=` | `verify.ts`：多 `v1` 候选 + 常数时间比对 + 300s 窗（原已 Stripe 格式,补多值/常数时间）| 是 → **完成** |
| R2 | back-channel logout = `/auth/backchannel-logout` | 代码本已在此路径；仅勘误 impl-handoff 文档 | 是 → **完成（无代码改动）** |
| R3 | 上下文 claim 在 access_token | `claims.ts` 本已从 access_token 读 + refresh 重取；仅勘误文档 | 是 → **完成（无代码改动）** |
| R4 | storage = gauge 快照（delta 否决）| 过渡态不接 consume（已符合,无触发点）；注释/文档更新为 gauge | 否 |
| R5 | counter 超额分流 | `flush.ts` 409 = 终态不重试 + `invalidateCache`（不记 flushError）；varda atomic 预扣待触发点 | 否 |
| §6 | 键名 `tier` / `service_endpoint.max` | `quota.ts` 本已 `service_endpoint.max`；移除 `platform-client.ts` 的 `data.tier` 回退 | - |

## 3. 待决策项（已决定）

| 项目 | 决策 |
|---|---|
| C3 metric 定义 | `service.api.call`（外部 DataService 调用）/ `quality.check.run` / `varda.credit` / `storage.bytes`（workspace 共享池）|
| varda agent 开放档位 | starter（只读，50 credits）/ pro（只读，500）/ business（读写，5000/席位）|
| 席位定义 | 仅真实人类，agent 不占席位 |
| tier 档位 | 五档 `free/starter/pro/business/enterprise`（不变）|
| 接入来源（正交 tier）| standalone（单独订阅,得 UI+数据）/ **bundled**（旧称 standard,无单独订阅、agent 附带、后台数据支撑、不给 UI、billing=bundled_free、权益管理同 standalone）。产品 UI 门控要 standalone;数据取用门控收 bundled 或 standalone |
| bundled 权益配置 | **独立可配的权益档**(非 free 硬别名);当前 ≈ free,**但 `member.max=0`**(后台无人类席位);合并时档位按 free 计;后续平台可单独调优 |
| 存储容量语义 | **已定（reply-01 R4）**：gauge 快照,arda 报当前水位到未来 `PUT /usage/gauge`,不接 consume；平台读时跨产品求和 |
| counter 超额模式 | **已定（reply-01 R5）**：api.call/quality.check.run = divisible 后报;varda.credit = atomic 预扣 |
| 数据外发量 | Phase 1 按 api.call 计次；Phase 2 export/share 类型加权；Phase 3 bytes 计量 |

---

## 4. 打通验收判据（product_200 §7 checklist）

对照 handoff §3 验收口径：

- [ ] **P3.1** C1 SSO e2e：登录 → 会话 → 登出 → back-channel logout 全链通
- [ ] **P3.3 / P2.5** 全链 e2e：登录 → provisioning webhook 建 WorkspaceRef → C2 门控渲染正确档位 → `service.api.call` consume → `subscription_changed` 清缓存重拉
- [ ] 数据面过检：`WorkspaceRef` / `ProvisioningEvent` / `UsageRaw` 表存在且带 `workspaceId` 隔离键
- [ ] `GET /api/entitlement/quota` 返回正确 quota_pools 余量
- [ ] `GET /.well-known/vxture-tools` 返回 `{"product":"arda","tools":[]}`

---

## 5. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-07-03 | 首版：并入 `plat` 编号系列，标注通道 B 契约版本冲突 |
| 2026-07-07 | 平台侧 P1/P2/P4 全线交付 |
| 2026-07-07 | arda 侧 C2/C3/P4 代码全线实施完成；owner 操作项已完成 5 项；剩余 O1-O3 待执行；更新验收 checklist；新增计费模型（biz-260）引用 |
| 2026-07-07 | O1/O2 完成：worker-02 两库全量迁移（0001-0007 手动 psql）+ 容器重启（healthy）；新增 `plat-200-impl-handoff.md` 回传文档；O3 更新为含 `plat-200` 引用 |
| 2026-07-07 | 平台回函 reply-01 裁定落地（§2b）：R1 verify.ts 多 v1+常数时间；R5 flush.ts 409 终态+invalidateCache；§6 移除 data.tier 回退；R2/R3 核实代码本已正确、勘误 impl-handoff v1.1；R4 storage=gauge 快照写入 biz-260/ent-120 |
