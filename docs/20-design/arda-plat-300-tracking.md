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

## 3. 待决策项（已决定）

| 项目 | 决策 |
|---|---|
| C3 metric 定义 | `service.api.call`（外部 DataService 调用）/ `quality.check.run` / `varda.credit` / `storage.bytes`（workspace 共享池）|
| varda agent 开放档位 | starter（只读，50 credits）/ pro（只读，500）/ business（读写，5000/席位）|
| 席位定义 | 仅真实人类，agent 不占席位 |
| 存储容量语义 | workspace 共享大池，arda 独立上报，平台汇总；上报模式（delta vs 快照）待与平台确认 |
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
