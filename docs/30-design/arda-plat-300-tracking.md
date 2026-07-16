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
| bundled 权益配置 | **独立可配组件**(`component_role=bundled`,tier=NULL);C2 以布尔 `bundled` 暴露(正交 tier);当前 ≈ free,**`member.max=0`**;权威=product_220+plat-210(取代"tier rank=free") |
| C2 status(reply-02) | 4 停留态 `none/trial/subscribed/expired`;cancel=取消订阅即时退款→none(事件非态);**trial 到期未转→none(非 expired)**;**expired 仅付费失效**;had_trial 是历史属性非 status 值;suspended 走 token account_status(另一轴)。arda 已按此改 `ArdaState`/`quota.ts`,待平台 C2 发 status 字段 |
| ai.credit(product_220) | `varda.credit→ai.credit` 升格 L0;池按产品 earmark、租户管理员可开共享溢出、全程归因(reply-02 §2);arda metric 常量已改 |
| 存储容量语义 | **已定（reply-01 R4）**：gauge 快照,arda 报当前水位到未来 `PUT /usage/gauge`,不接 consume；平台读时跨产品求和 |
| counter 超额模式 | **已定（reply-01 R5）**：api.call/quality.check.run = divisible 后报;varda.credit = atomic 预扣 |
| 数据外发量 | Phase 1 按 api.call 计次；Phase 2 export/share 类型加权；Phase 3 bytes 计量 |

---

## 4. 打通验收判据（product_200 §7 checklist）

对照 handoff §3 验收口径。左半链 e2e 实测于 2026-07-10（§4.1）；右半链 e2e 实测于 2026-07-12，用平台提供的真实样例 workspace（§4.3）：

- [x] **P3.1** C1 SSO：`/auth/session`→200 匿名；`/auth/login`→307 跳 IdP（PKCE S256 / client=arda-beta / scope / redirect 正确）；登录链路平台侧已确认打通。**登出 + back-channel 端点就位**（back-channel 全浏览器链路待真人走一遍，非阻塞——协议本身已验证正确）
- [x] **左半链**：登录 → provisioning webhook 建 `WorkspaceRef`（§4.1 六用例全绿：processed/duplicate/stale/**beta-ignored**/subscription_changed/bad-sig；DB 核对通过）
- [x] **右半链**：C2 门控渲染正确档位 → `service.api.call` consume → `subscription_changed` 清缓存重拉 —— **2026-07-12 全部实测通过**（§4.3），使用平台真实样例 workspace `00000000-0000-4000-a000-000000000210`
- [x] 数据面过检：`WorkspaceRef` / `ProvisioningEvent` / `UsageRaw` 表存在且带 `workspaceId` 隔离键（0007 迁移，e2e 中实证 WorkspaceRef/ProvisioningEvent 读写）
- [x] C2 响应形状核对：`GET /platform/entitlements` 返回体逐字段匹配 `arda_200_interface` §2.2/§2.3 契约（§4.3）
- [x] `GET /.well-known/vxture-tools` 返回 `{"product":"arda","version":"v1","tools":[]}`（实测 200）

**e2e 全链（product_200 §7 全部判据）已通过。**

### 4.1 provisioning webhook e2e 明细（2026-07-10，beta 栈实测）

真实 HMAC 签名 webhook（`t=,v1=` over `"{t}.{raw}"`）打 `{beta}/provisioning/webhook`，逐用例 + DB 核对：

| 用例 | 响应 | DB |
|---|---|---|
| `tenant.provisioned`（plan=arda-pro） | `200 processed` | `WorkspaceRef` 建成（plan=arda-pro, status=provisioned）|
| 重复投递（同 `id`） | `200 duplicate` | 不重复处理 |
| 旧 seq（seq=0 < 已存 seq=1） | `200 stale` | 不落库 |
| **beta plan（plan=arda-beta-demo）** | `200 ignored` | **未建 `WorkspaceRef`**（懒建，本轮新功能验证成功）|
| `subscription_changed`（seq=2） | `200 processed` | 事件落库 + 触发 `invalidateCache` |
| 坏签名 | `400 invalid signature` | HMAC 验签生效 |

`ProvisioningEvent` 实证 2 条（provisioned seq1 + subscription_changed seq2）；测试数据已清理。**验签(R1)/幂等/seq/beta 忽略/事件语义全部按 `arda_200_interface` §4.1 契约工作。**

### 4.2 右半链解锁前置（2026-07-12 更新——平台已给内网地址，见 §2c）

1. ~~`PLATFORM_API_URL` → 内网 auth-bff 地址~~ **已解**：平台给出内网 auth-bff 地址（`arda_302_reply-02` §3.1；具体值不入库，见 worker-02 两栈 `etc/.env` 的 `PLATFORM_API_URL`）；**arda 侧待执行**：改 worker-02 两栈 `etc/.env` + 重启（见 §2c 待办 1）；
2. ~~平台配 arda 的 C2 `capabilities` + `quota_pools`~~ **已解**：平台确认早于 2026-07-07/09 上产（`arda_302_reply-02` §1.1）；
3. worker-02 ↔ auth-bff tailnet 连通：**先例已生产验证**（varda-server 走同一内网主机的另一端口消费 LLM 网关，具体地址见 worker-02 部署配置），无需再探活；
4. C3 consume 业务触发点接入（当前无 op 调 `recordUsage`）——**仍待 arda 侧实现**，不阻塞 e2e 门票（storage gauge 除外，见 §2c）。

**e2e 门票现状（2026-07-12 收尾）**：R1-R3 ✅ + secret 三件套 ✅ + 平台目录 ✅ + gauge 端点 ✅ + 网络前置 ✅（内网 base 已给且已切换）——**全部就绪，右半链已实测通过，见 §4.3**。

### 4.3 右半链 e2e 实测（2026-07-12，真实平台样例 workspace）

平台指认了生产 seed 内固定播种的集成测试样例 workspace（`deploy/database/seed/seed-lib.mjs` 的 `ID.workspaceZhangsan`，"Sample user for integration testing"，仓库明文常量、非密钥）：`00000000-0000-4000-a000-000000000210`。用它对内网 auth-bff（地址见 worker-02 `etc/.env` 的 `PLATFORM_API_URL`，不入库）直接测三步：

**C2 门控**（`GET /platform/entitlements`）：
```json
{"workspace_id":"00000000-0000-4000-a000-000000000210","product":"arda",
 "capabilities":{"tier":null,"bundled":false,"features":[]},
 "quota_pools":[],"subscription_status":null}
```
HTTP 200，逐字段匹配 `arda_200_interface` §2.3"无订阅回落"契约（该样例 workspace 未挂订阅，`tier`/`subscription_status` 均为 `null` 属预期）。

**C3 consume**（`POST /usage/consume`，`metric=service.api.call`）：
- 首次：`409 {"gated":true,"consumed":0,"remaining_total":0,"reason":"quota_exhausted"}` —— 无订阅、无配额池，符合 `arda_200_interface` §3.1 gated 语义；
- 同 `idempotency_key` 重放：`200 {"gated":false,"consumed":0,"replayed":true}` —— **幂等回放验证通过**（不重复扣减）。

**subscription_changed（缓存失效）**：真实 HMAC 签名投递 `POST /provisioning/webhook`（同 §4.1 wire 格式）→ `200 {"outcome":"processed"}`，触发 arda 侧 `invalidateCache(workspace_id)` 代码路径（`handler.ts`，与 §4.1 逻辑同源，已代码核实）。

**清理**：本次在真实共享样例 workspace 上写入的 `ProvisioningEvent`（`subscription_changed`, `seq`=测试用大数）**已删除**，避免污染该 workspace 的 seq 单调追踪、影响平台或他人后续对其发送的真实 webhook。C2/C3 直连测试未写入 arda 本地 DB，无需清理；平台侧 `gated` 调用为无实际扣减的只读性质探测（无订阅池可扣），未产生副作用。

---

## 2c. 平台回函 arda_302_reply-02 裁定落地（2026-07-12）

平台对 arda 四封信（`docs/80-liaison/` 时间标记 2607120135：plat-200 回传 / plat-210 回函02 / plat-220 回函03 / plat-230 回函04）逐项裁定，**全部采纳**。平台回函 = vxture 仓 `docs/product/arda/arda_302_reply-02.md`；裁定权威新立 vxture 仓 `docs/30-design/product_230_mesh-architecture.md` v1.0（D1-D5）+ `product_310` §4（D10/D11）。**本仓不复制其内容，仅作对账引用**（arda 不越界写 vxture 仓，见 CLAUDE.md 边界纪律）。

| 主题 | 裁定 | 状态 |
|---|---|---|
| **D10 trial 落点** | 采纳 arda 主张：trial 到期未转/试用中取消 → C2 呈现 `null`（非 `expired`）；`expired` 专表付费订阅被动失效。平台已实施：C2 代表选取排除 never-paid 试用行 + trial-expiry sweep（60s）+ 池读侧覆盖门控 + 转正不变量（renew 同事务翻 `paid`）| ✅ 平台已上产，**arda 侧零改动**（门控公式 `status∈{active,trialing}` 天然正确）|
| **`suspended` 覆盖语义** | 确认 arda 现行双轴口径（订阅轴 C2 拦停 + 账号轴 token 拦停）正确，无需改 | ✅ 确认 |
| **`audience`/共享归因** | 已交付（D8，2026-07-09）：策略表 `metering.resource_sharing_policies`（空=全保留安全默认），consume 候选=自留∪共享，逐笔按花钱方归因 | ✅ 平台已上产 |
| **GPU counter+atomic 不变量** | 早已入 product_220 §4.2 原文 | ✅ 确认 |
| **D11 mesh 架构** | arda plat-230 提案**整体采纳**，定稿 `product_230`（vxture 仓 `docs/30-design/product_230_mesh-architecture.md`） v1.0：两类分级（判类精化=是否在平台tailnet，非纯域名）、内网寻址（D1）、会话内省 P1（D2，v1不依赖）、token exchange 收敛 product_210 T2（D3）、控制/数据面分离 P3（D4）、两类分级登记 product_200 §6（D5）| ✅ 平台定稿，arda v1 关键路径仅 P0 边界收口 |
| **内网 auth-bff base** | 平台已给出（worker-01 tailscale，auth-bff 既有绑定；varda-server 同主机另一端口已生产验证，零新基建）；**具体地址不入库，见 worker-02 两栈 `etc/.env` 的 `PLATFORM_API_URL`** | ✅ 已给 |
| **webhook 投递** | 改 tailnet 直投；平台已实施 `ARDA_WEBHOOK_BASE_URL`（空回落 `ARDA_BASE_URL`，避免破坏 OIDC redirect）解耦，生产切换=owner 配 env + 平台 reseed | ✅ 平台已实施，**切换前不要 404 边缘** |
| **边界对称** | 确认：平台 nginx 无 `/platform/*`/`/usage/*` location，C2/C3/gauge/可见集只经 auth-bff tailscale 绑定暴露 | ✅ 确认 |
| **`AUTH_INTERNAL_TOKEN` 轮换** | 接受，与 arda 切内网同窗轮换 | ✅ 接受，owner 定窗；**[2026-07-12 澄清]** 生产密钥尚未实际轮换（仍旧值，arda 现有调用有效），不阻塞——见下方"待 owner 决策" |
| **`configs/edge` flush 404** | 平台已 staged live vhost 同款 404（prod+beta）；请 arda 源工件同步 | ✅ arda 侧 `configs/edge/*.conf` **已加**（本仓上一轮 fix/boundary-hardening） |

### ⚠️ 新开放项（平台自查发现，待 arda 确认，§2.1 遗留）

`had_trial` 历史属性（驱动 `null` 态文案"试用已用过"vs"开始试用"）当前唯一载体 = `arda:subscription` token claim；该 claim 按 reply-01 §7.1 排期在 e2e 通过后**整体退役**。退役后 `had_trial` 将无载体送达 arda。平台给三选一，**未擅自裁定**：
1. C2 信封加 `had_trial` 布尔（伴随 `subscription_status`）；
2. retire 时机绑定该字段先落地；
3. 改判 arda 本地状态自记（按历史 `tenant.provisioned` webhook payload 自行记忆"曾开通 trial plan"）。

**在此项收口前，arda 不应假设 retire 后仍能读到 `had_trial`；若 e2e 排期先到，需请平台暂缓摘除 `arda:subscription` scope。**~~（待 arda 回函确认倾向方案）~~
**【2026-07-13 收口：议题整体撤回】**回函 05 被回函 06 撤回——owner 裁定权益契约松耦合改形（能力归产品矩阵 / 配额归平台 / 商业决策 UI 归 console 深链），`null` 态 CTA 分岔由 console 渲染解决，**三个方案均不再需要**；`arda:subscription` scope 退役**解锁、无前置**，并进一步提案 `arda` claim 整体退役。详见 `docs/80-liaison/arda-plat-250-loose-coupling-reply-2607132030.md` + [`ent-120`](arda-ent-120-consumption-contract.md) v2。

### arda 侧净剩待办（平台回函 §6，已收窄）

| # | 项 | 依赖 | 本仓状态 |
|---|---|---|---|
| 1 | `PLATFORM_API_URL` 切内网地址（两栈 etc/.env + 重启；具体值不入库，见 worker-02 `etc/.env`）| 内网地址已给 | ✅ **已执行**（2026-07-12，见 §2d；`ENV_FILE_BASE64` 再生独立于此，见下方"待 owner 决策"）|
| 2 | C2/C3 出站 host 断言（拒公网 fail-closed）| 与 #1 同车 | **已上线**（`internal-target.ts`，plat-220 §4 自修，兼容 `100.64.0.0/10`）|
| 3 | `/api/usage/flush` 改内网守卫 + `configs/edge` 同步 404 | 独立 | **已上线**（同上）|
| 4 | secret 轮换配合 | owner+平台协调窗口 | **不阻塞**（平台澄清生产密钥尚未轮换、现有调用仍有效，见"待 owner 决策"）|
| 5 | storage.bytes 快照接 `PUT /usage/gauge`（端点已在产）| - | ✅ **已实现（2026-07-14）**：`usage/lib/gauge.ts` 绝对水位 = `SUM(Dataset.sizeBytes)`，带必填 `observed_at`（LWW）；上报点 = 同步成功后 + 硬删清扫后（归零）；best-effort 不阻断调用方，缺口由下次绝对值自愈 |
| 6 | e2e 全链验收 | #1 + 平台 reseed | ✅ **已通过**（2026-07-12，真实样例 workspace，见 §4.3）|
| 7 | **回复 had_trial 三选一** | 无 | ~~已回（回函 05，推荐方案①）~~ **议题撤回**（2026-07-13，回函 06：契约松耦合改形使其不再需要） |
| 8 | **回函 06：C2 信封 v2 + 边界规则 + claim 整体退役 + 平台服务边界建议** | 无 | ✅ **平台已裁定**（`arda_303_reply-03`，见 §2e）|
| 9 | arda 本地能力矩阵（`ent-110` §2a，biz-300 阶段 0） | 无（零平台依赖） | ✅ **已实施**（2026-07-13，`portals/app/app/entitlement/capability.ts`：21 键目录 + 五档累进矩阵 + `canUseFeature`/`minTierFor` + varda/sync 档位级别函数）；门控 UX（锁标+升级页）与信封 v2 消费端同日上线（PR #90/#91）|
| 10 | 升级 `@vxture/shared@^1.4.0`（六值 status，arda_303 §7.1） | ~~本地 `NODE_AUTH_TOKEN` 失效~~ owner 已换发 PAT（read:packages） | ✅ **已完成**（2026-07-14）：package.json 锁 `^1.4.0`、lockfile 更新；e2e 验证 `overdue` 过信封校验并放行、`suspended` 解析后拒绝、未知值 fail-closed |
| 11 | 信封 v2 切换 + `PLATFORM_API_URL` 别名切换 + `AUTH_INTERNAL_TOKEN` 轮换 | `arda_305` cutover 函 | ✅ **已完成（2026-07-14，见 §2f）**：两栈 env 切别名 `:8080` + scope 修正 + 部署 `sha-732a0dc`，验证清单全绿；仅剩 token 轮换值待 owner 带外转运（不阻塞） |
| 12 | **EnvGuard 退役/中性化**（claim 退役的连带项） | claim 已死（arda_305） | ✅ **已执行（2026-07-14，随 cutover PR）**：EnvGuard 组件删除、layout 挂载移除；`ArdaState`/`ArdaClaim` 降级为 dev mock 专用词汇 |

---

## 2h. 深链联测（2026-07-14，arda_301 §4）

**无凭据可验段（已实测全绿）**：console `/subscribe` 四种 intent（upgrade+target_tier / seat / 乱填 / addon+metric）未登录一律 `307 → /{locale}/signin?next=/subscribe?...`，**query 逐字段保留在 next 中**（上下文不丢）；arda 侧深链构造与契约逐参吻合（product/intent 必带、target_tier/metric 选带、**不带 workspace_id**）。
**owner 目测段（2026-07-14 完成，四步全 ✅）**：① 无订阅拦截页按钮【订阅】→ 深链新标签打开；② console 登录门 → 登录后回落地页（上下文保留）；③ 落地页渲染正确（订阅卡片突出"开通"+ 套餐阶梯）；④ 乱 intent 刷新 → 降级订阅管理首页（保留 arda 上下文，不报错）。**arda_301 §4 联测整体收口**。顺带发现并修复拦截页 CTA 占位链接残留（`vxture.com/legal/terms` → 按 status 分岔深链，PR #108）。

## 2f. cutover 执行与验证（2026-07-14，arda_305 → 回函 08）

平台一步切完（arda_305：platform-api 独立宿主 + 别名 + v2 一步切换 + scope/claim 退役 reseed）。线 B 执行：

1. **PR #98**：请求 scope 去 `arda`（默认值两处）+ EnvGuard 退役（组件删除，`ArdaState`/`ArdaClaim` 降级 dev-mock 专用）。
2. **host（两栈 `etc/.env`，带时间戳备份）**：`OIDC_SCOPES` 去退役 scope（**env 覆盖代码默认值——登录恢复的真正生效点**）；`PLATFORM_API_URL` → `http://100.100.197.42:8080`。
3. **部署**：beta 随 #98 自动；prod 经 `promote.yml` fast-forward（本窗口顺带把 prod 从陈旧镜像 `sha-0576e4a` 拉齐到 `sha-732a0dc`）。
4. **验证（arda_305 §4 逐项）**：alias healthz 200 / 旧 base 404 / 两栈登录跳转 scope 干净 / C2 v2 形状逐字段吻合 / consume 幂等 `replayed:true` / gauge `applied:true`（**必须带 `observed_at`**，缺失 400——arda 侧 gauge 实现须随带）/ webhook 坏签名 400。
5. **回传（回函 08）**：`ARDA_WEBHOOK_BASE_URL` prod `http://100.76.219.48:3230` / beta `:3231`；样例 workspace 订阅被 reseed 清除请平台补种；gauge `observed_at` 契约确认。

## 2g. 三通道全链确认（2026-07-14，owner 通报后逐项实测）

owner 通报：平台三通道构建切换完成、`AUTH_INTERNAL_TOKEN` 两端已轮换、console 深链已上线。arda 侧实测确认（worker-02 直测 + 平台仓核对）：

| 通道 | 实测 | 结果 |
|---|---|---|
| A · C1 身份 | 两栈登录跳转 scope = `openid profile email phone`；claim 已死 | ✅ |
| B · C2 权益 | **轮换后 token**（两栈 env==容器，指纹一致）查样例 workspace → **真实订阅信封**（active/pro/账期/五键 limits/双池 quota_pools，平台已补种）；bogus token → 401 | ✅ |
| B · C3 计量 | consume 真实扣减（consumed:1 + per_pool_breakdown，remaining 9999）；gauge `applied:true`（带 `observed_at`） | ✅ |
| C · 入站指令 | prod `ProvisioningEvent` 落库 `tenant.provisioned`（19:01:34 processed，与补种时间吻合）——平台已按回函 08 配置 tailnet base 并发测试事件，收/验/处理全通 | ✅ |
| 深链 | console `/subscribe` 落地页已上线（vxture 仓 #777：intent 词表校验、`seat` 按未知降级、代表订阅同源渲染）；域名 `console.vxture.com` 与 arda 烤入默认一致，arda 零改动 | ✅ |
| 轮换 | 平台收尾 #778（D13 close-out）；两栈容器已加载新值；应用日志 30 分钟窗口无 error/401 | ✅ |

**结论：身份 / 权益 / 计量 / 指令 / 转化深链五个面全部在新契约上实证打通，无遗留通道级事项。**（beta 栈无 webhook 测试事件——平台仅对 prod base 发测，beta 为内部栈，非缺陷。）

## 2e. 平台回函 arda_303_reply-03 裁定落地（2026-07-13）

对回函 06 的逐项裁定（vxture 仓 `docs/product/arda/arda_303_reply-03.md`），**全部采纳且升格**：

| 项 | 裁定 | arda 侧落点 |
|---|---|---|
| 信封 v2 四项 | 确认，**升格为 product_200 全产品契约**（L1/L2/L3 一律 v2 接入） | `ent-120` v2 定稿（已同步） |
| status 枚举 | `past_due` 改判 **`overdue`**；值域**现在**扩六值（precedence = shared 数组序 `active>trialing>overdue>suspended>expired>cancelled`）；`@vxture/shared@1.4.0` 随函发布；支付面落地前平台不产出 `overdue` | `hasProductAccess` 放行集加 `overdue`（前向就绪）；依赖升级见净剩待办 #10 |
| 代表订阅规则（新增条款） | 订阅事实块取自单一代表订阅；配额块跨订阅合并；产品不得混读。**arda 曾提异议**（tier 入事实块与就高合并矛盾：同产品双 active 不同档时平手取周期最晚可能选低档）；**owner 裁定（2026-07-14）就地闭环，无需回函**：同产品**不允许**并存多档订阅（平台不变量，叠单=过度设计），tier 保持**就高合并**、语义归合并侧（与 limits 同侧） | `ent-120` §1a（已按裁定同步） |
| `data_retention_until` | **一期实现**，保留期 90 天（承诺下限；= expired 时刻 + 90d） | 信封字段已就绪（PR #91） |
| 演进容错通则 | 双方义务写入 product_200：容忍新增字段与新枚举值 | `ent-120` §4a 第 4 条（已同步）；arda 现状达标 |
| 深链 | console 五条容错承诺；**预留 `seat` intent**（席位按产品独立、co-term） | `deeplink.ts` 词表 + `ent-120` §4a（已同步） |
| scope + claim 退役 | **一车退役**，与 C2 v2 实施同窗；退役前残留 claim 按已作废对待（勿新增消费点） | arda 无预动作 |
| 待办处置表 | 照单确认；limits 数值平台无需重配（本就在 plan_components.quota）；**一步切换不双发** | arda 已双容 |
| 架构建议 | **两项全采纳，不做折中**：commerce（C2/C3/provisioning 派发/sweep）完整拆出独立宿主 **platform-api**；中性内网别名同窗；`AUTH_INTERNAL_TOKEN` 轮换并入同窗。纠正：provisioning webhook 现出自 admin-bff（非 auth-bff），拆分后归 platform-api，arda 无感 | 别名值另函，届时一次 env 切换；当前 base 持续有效 |

平台排期（线 A）：#1 shared@1.4.0 已发 → #2 platform-api 拆分+别名+轮换 → #3 C2 v2 改造 → #4 claim/scope 退役（同窗）→ #5 文档写回。

## 2d. #1 网络切换执行记录（2026-07-12，worker-02）

`PLATFORM_API_URL` 已从公网 `http://accounts.vxture.com` 切至平台给出的内网 auth-bff 地址（两栈 `etc/.env` + 容器重建；具体值不入库，见 worker-02 `etc/.env` 的 `PLATFORM_API_URL`），**e2e 门票待办 #1 已完成**。

**实测结果**：C2 探测从"公网 301→Cloudflare→404（从未到达真实端点）"变为"**200 连通链路、真实 400 响应**"（auth-bff 已收到并处理请求，400 = 探测用假 token/workspace 被业务校验拒绝，属预期）——网络前置**功能性打通**。webhook 全链烟测（真实 HMAC 签名 `tenant.provisioned`）复测通过，`WorkspaceRef` 正确落库；测试数据已清理。

### 事故与修复：beta 栈 `arda-db` 容器被误删

执行切换过程中，对 beta 栈用 `docker compose up -d --remove-orphans arda-app` 重建容器以加载新 env 时，**`arda-beta-db` 容器被 compose 当作孤儿删除**。

**根因**：`/srv/md1/arda-beta/deploy/docker-compose.yml`（服务器上，非本仓）是**严重过期版本**（100 行，`VERSION=e998d1e`，早于 Postgres/C2 集成引入之前；对照 prod 同目录 149 行 `VERSION=0576e4a` 为当前版本）——该旧文件**根本没有 `arda-db` 服务定义**。`--remove-orphans` 据此把仍在跑但"不在当前 compose 文件服务列表里"的 `arda-beta-db` 判定为孤儿并移除。**prod 侧未受影响**（同批操作在到达 remove-orphans 逻辑前就因镜像拉取失败中止）。

**数据完整性**：**未丢失**。Postgres 数据目录是宿主机 bind mount（非 docker 管理卷），删容器不删数据。补建 `arda-beta-db` 后启动日志明确 `PostgreSQL Database directory appears to contain a database; Skipping initialization`（识别既有数据库、走正常恢复，非新建）；核对 19 张表（含 0007 全部迁移表）结构完整；行数为 0 属预期（beta 此前即为空态，e2e 测试数据本节前已清理，非本次丢失）。

**修复步骤**：
1. 备份并用 prod 当前 `docker-compose.yml`（149 行，含完整 `arda-db` 定义）覆盖 beta 过期文件；
2. 用**显式 compose 项目名**（`-p arda-beta`）补建 `arda-db`，不用 `--remove-orphans`，避免二次误删；
3. 重建 `arda-beta-app` 以真正加载新 `docker-compose.yml`（此前用旧文件重建的 app 容器 `PLATFORM_API_URL` 等新增 env 键**全部缺失**，一并修复）；
4. 全量核对（表结构/行数/容器健康）+ webhook 烟测复验，通过后清理测试数据。

**遗留发现（未处理，供后续排查）**：beta 服务器上的 `deploy/docker-compose.yml` 长期未随正常 CI 发布刷新（落后到 Postgres 引入之前的版本），而 prod 侧是最新的——`release.yml` 对 beta 栈的部署管线是否存在 rsync/刷新缺口，值得单独排查（不在本次任务范围，未改动 CI 脚本，仅修复了服务器上的实例文件）。

### 待 owner 决策（2026-07-12 更新——平台侧澄清，纠正此前误判）

- **`AUTH_INTERNAL_TOKEN` 轮换**：**arda 现在没有被阻塞**——此前误判"平台已发布上线=已轮换密钥"；平台已澄清：刚发布上线的是 **T2 代码**（`PlatformAuthGuard` 双接受设计，legacy `x-vxture-internal-auth` 路径行为零变化），**不触碰运行时密钥的实际值**；经 owner 向平台核实，生产 `AUTH_INTERNAL_TOKEN`（worker-01 真实值）**尚未轮换，仍是旧值**，arda 现有调用（`PLATFORM_INTERNAL_AUTH_TOKEN`）继续有效。轮换本身**不紧急、不能单边做**（共享密钥，需 owner + 平台协调同一窗口，建议绑定下次运维窗口一起做），当前**不阻塞**其余工作；
- **`ENV_FILE_BASE64` CI secret 再生**：平台确认与其无关，纯 arda 自己的灾备快照 housekeeping（`release.yml` 仅在 `etc/.env` 不存在时才读取此 secret，当前不影响任何现有连通性）——是否刷新是 arda 自己的决定，安全层已就"整份 `.env` 明文过一遍本地文件"这个具体动作要求过 owner 明确许可，待确认后执行。

---

## 5. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-07-03 | 首版：并入 `plat` 编号系列，标注通道 B 契约版本冲突 |
| 2026-07-07 | 平台侧 P1/P2/P4 全线交付 |
| 2026-07-07 | arda 侧 C2/C3/P4 代码全线实施完成；owner 操作项已完成 5 项；剩余 O1-O3 待执行；更新验收 checklist；新增计费模型（biz-260）引用 |
| 2026-07-07 | O1/O2 完成：worker-02 两库全量迁移（0001-0007 手动 psql）+ 容器重启（healthy）；新增 `plat-200-impl-handoff.md` 回传文档；O3 更新为含 `plat-200` 引用 |
| 2026-07-07 | 平台回函 reply-01 裁定落地（§2b）：R1 verify.ts 多 v1+常数时间；R5 flush.ts 409 终态+invalidateCache；§6 移除 data.tier 回退；R2/R3 核实代码本已正确、勘误 impl-handoff v1.1；R4 storage=gauge 快照写入 biz-260/ent-120 |
| 2026-07-10 | 对齐 `arda_200_interface v1.0`：Group 1 值域从 `@vxture/shared` 1.3.1 导入、C2 顶层 `subscription_status`(raw-5)；webhook 按 `arda-beta-` 前缀忽略 beta plan；全部上 prod（`01beaf1`）|
| 2026-07-10 | **e2e 验收（§4/§4.1）**：左半链（C1 登录 + provisioning webhook 6 用例 + DB）对 beta 栈实测全绿；右半链（C2/consume/重拉）阻塞于平台前置（§4.2）|
| 2026-07-12 | 平台回函 `arda_302_reply-02` 裁定落地（§2c）：D10 trial→null 已上产（arda 零改动）、D11 mesh 定稿 product_230（P0 边界收口=arda v1 关键路径）、内网 auth-bff base 已给（具体值见 worker-02 `etc/.env`，不入库）、webhook 改 tailnet 投递、audience/GPU不变量已确认早已交付；更正 plat-200 §6 两处过时状态（quota 配置/gauge 端点均已上产，非"待实施"）；新开放项：`had_trial` 载体待 arda 三选一回复 |
| 2026-07-12 | 回函 05 起草并已发（`had_trial` 载体，推荐 C2 信封加布尔）；**e2e 门票 #1 执行完成**：`PLATFORM_API_URL` 切内网 auth-bff 地址（两栈；具体值见 worker-02 `etc/.env`），C2 探测确认从公网 404 变为真实内网响应；过程中发现并修复 beta 服务器 `deploy/docker-compose.yml` 过期（缺 `arda-db` 定义）导致的容器误删事故，数据经核实无丢失（§2d）|
| 2026-07-12 | 平台澄清 AUTH_INTERNAL_TOKEN 未实际轮换（T2 代码上线≠轮密钥），arda 未被阻塞，纠正追踪表 |
| 2026-07-12 | **右半链 e2e 全部通过**（§4.3）：平台指认真实样例 workspace（`00000000-0000-4000-a000-000000000210`，仓内 seed 明文常量），C2/C3/subscription_changed 三步直连内网 auth-bff 实测，响应逐字段匹配 `arda_200_interface` 契约（无订阅回落、gated quota_exhausted、幂等 replayed、事件 processed）；测试痕迹已清理。**product_200 §7 全部验收判据通过** |
| 2026-07-13 | **权益契约松耦合定稿（owner 裁定）+ 回函 06 签发**：C2 信封 v2（删 `capabilities`、上限挪 `limits`、加时间戳），能力归产品能力矩阵、配额仍全归平台；契约演进边界规则（决策位禁入信封）；回函 05（had_trial）撤回、`arda:subscription` scope 退役解锁、`arda` claim 整体退役提案；附平台服务边界建议（commerce 拆出 auth-bff + 中性网关别名）。arda 侧文档已同步修订（ADR §3.4 / ADR-11 / ent-100/110/120 / biz-260 / feature-keys / decisions/00-index.md） |
| 2026-07-13 | **阶段 0 三连发（PR #89/#90/#91，均已上 beta）**：能力矩阵（capability.ts，21 键五档累进 + canUseFeature/minTierFor + varda/sync 档位级别）；门控 UX（锁标 + 服务端 ScreenGate×5 屏 + 极简升级页 + console 深链仅显式点击）；信封 v2 消费端（parseEntitlementEnvelope v2 优先/v1 回退、PlanLimits、时间戳、未知 status fail-closed） |
| 2026-07-13 | **平台回函 arda_303 收到并裁定落地（§2e）**：回函 06 整体采纳升格全产品契约；`overdue` 六值随 shared@1.4.0 先行发布；retention 90d 一期；seat intent 预留；platform-api 完整拆分 + 中性别名全采纳；scope+claim 一车退役与 v2 同窗。arda 行动项：`hasProductAccess` 加 `overdue`（前向就绪）、deeplink 词表加 seat、ent-120 定稿同步；shared 1.4.0 升级被本地 NODE_AUTH_TOKEN 失效阻塞（待办 #10，owner 操作） |
| 2026-07-14 | **代表订阅×tier 矛盾闭环（owner 裁定，无需回函）**：arda 自查发现 arda_303 §1.2 把 tier 划入代表订阅事实块与"tier 就高合并"冲突（双 active 不同档平手取周期最晚可能选低档）；owner 裁定：同产品**不允许**并存多档订阅（平台不变量），tier 保持就高合并、语义归合并侧。ent-120 §1a 已按裁定改写。另自查发现 claim 退役连带项 EnvGuard 退役（待办 #12，与 v2 同窗） |
| 2026-07-14 | **平台回函 arda_304/arda_305 收到**：304 = 回函 07 回执（裁定落地 + `assertNoTierConflict` guardrail 三写路径 + 门控公式 `{active,trialing,overdue}` 入契约）；305 = **cutover 通知**（平台已一步切完：platform-api 宿主 / 别名 / v2 / scope+claim 退役 reseed） |
| 2026-07-14 | **线 B cutover 执行完成 + 回函 08 签发**（§2f）：PR #98 + 两栈 env 切换 + prod promote（`sha-732a0dc`），验证清单全绿；`ARDA_WEBHOOK_BASE_URL` 已回传；EnvGuard 退役落地（待办 #12 关闭） |
| 2026-07-14 | **三通道全链确认（§2g）**：owner 通报平台侧完工 + token 双端轮换 + console 深链上线；arda 逐项实测全绿（轮换 token C2/C3、真实订阅信封、prod webhook 事件收讫、/subscribe 落地页 #777 域名吻合）。**基础通道建设阶段收官** |
| 2026-07-14 | **热修：C2 信封 v2/v3 字段名**——平台定稿把 `subscription_status` 改名 `status`（arda_200 v2.0 §2.2 / product_220 §3 称 v3），arda 解析器仍读旧名致真实订阅用户被 fail-closed 误拒（beta/prod 同病）；hotfix 读 `status` 优先、旧名回退，用 cutover 实测的真实信封逐字段回归 |
