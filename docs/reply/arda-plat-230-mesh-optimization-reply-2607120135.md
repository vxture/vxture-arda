# arda 回函 04：跨产品通信 mesh 优化提案（arda-plat-230-mesh-optimization-reply）

> 版本：v0.1 **提案（需平台最终敲定）** · 日期：2026-07-10
> 时间标记：**2607120135**（YYMMDDHHMM = 2026-07-12 01:35）
> 方向：arda（线 B）→ vxture 平台团队
> 主题：登录授权之后的**跨产品通信架构**分级优化——通信安全 / 沟通效率 / 数据传输效率
> 性质：**arda 侧分析建议，非 arda 单方可定**。本文涉及全产品通信 fabric、平台身份/令牌/网络策略，属**平台架构域**（`product_100_matrix` / `product_200_integration` / `product_210_tool-protocol`）。**须平台评审并敲定后，各产品据此落地**。
> 上游：`arda-plat-220-boundary-reply`（路径边界 · 回函 03，本文是其架构层延伸）、`product_210_tool-protocol`（token exchange · T2）、reply-01 §7（可复用 JWT 验签模块预留）。

---

## 0. 摘要

现状 = **所有产品一把尺**：都做完整 OIDC RP + C2/C3 + webhook，且**默认全走公网边缘**。这在"跨域名轻业务"上过重、在"同域名内网业务"上又没吃到内网红利，且把 S2S 暴露在公网（见回函 03）。

提案核心 = **按"域关系"与"产品层"两轴分级**，同 apex（`*.vxture.com`）产品走**统一 tailnet fabric + 会话互验 + 平台签发 scoped token**，跨 apex（ruyin.ai 类）保持**轻集成**。

> ⚠️ **本文每一节都需平台敲定**：内网寻址约定、会话内省端点、token exchange 形状、控制/数据面分离策略——都跨产品，平台是唯一裁定方。§7 列出请平台决策项。

---

## 1. 分级判据：两类业务

| | **类 1 · 跨 apex（ruyin.ai 类）** | **类 2 · 同 apex（`*.vxture.com`）** |
|---|---|---|
| eTLD+1 | 不同 → **cookie 不能共享** | 相同 → **登录态可互验** |
| 网络 | 可能异网段 | **同 tailscale 网段** |
| 登录 | 完整 OIDC（跨域 SSO） | OIDC 建态一次 + 之后**内网会话互验**，免重复 OIDC |
| 权益 | 简单（claim / 单次 C2 读），**不做深度计量** | 完整 C2/C3 |
| S2S 传输 | 只能公网 HTTPS（异网） | **只走 tailnet，绝不公网** |
| 计量 | 无 / 轻 | 完整 C3 |

**类 1 故意做轻**（认证 + 简单订阅授权即可）；**类 2 吃满内网 fabric**。

---

## 2. 类 2 的三个优化

### 2.1 同 apex → 登录态互验（免重复 OIDC）

- **不共享 cookie**：现行 host-only cookie（无前导点）是对的，**不要**改成 `.vxture.com` 父域 cookie（等于把会话泄给所有兄弟站）；
- 改用**平台内网会话内省端点**（建议）：`GET /internal/session/introspect`（tailnet + S2S 鉴权）→ 返回该会话的 `subject/org/workspace`。产品间验对方登录态 = **一次 tailnet 调用、可缓存**，比重跑 OIDC 快且不牺牲隔离。**（端点形状、缓存 TTL 请平台定。）**

### 2.2 同 tailscale → 二级域名对应内网地址（不暴露在外）

- **流量分两面**（回函 03 边界问题的架构解，推广到全产品）：
  - **边缘面**（公网 TLS）：**仅**浏览器路由（`/auth`、页面、浏览器 `/api/*`），其余边缘 404；
  - **tailnet 面**（S2S）：C2/C3、provisioning webhook、产品↔产品取数——**全内网、MagicDNS 寻址**（`PLATFORM_API_URL = http://<auth-bff>.<tailnet>`，非公网 URL）；
- **tailscale = WireGuard 加密 + 节点级双向身份**：S2S 走 tailnet 天然"传输层已互认"，**不必再上 mTLS**（省一层复杂度、更安全）。**（内网命名/寻址约定请平台统一发布。）**

### 2.3 统一 fabric 替代"每对一个共享 secret"

现状 = `x-vxture-internal-auth` 一个长期共享 secret 给所有 C2/C3（product_210 T2 前的过渡）。建议向 T2 收敛：

```
                平台 L0（accounts + auth-bff + metering）
                  │  签发短时 scoped S2S token（token exchange, product_210 T2）
        ┌─────────┼──────────────┐
        ▼(tailnet)                ▼(tailnet)
   product P1（arda/karda）  ◄──取数(S2S token, 同 JWKS 验签)── product P2 / agent
        │ DataService 网关                                    │
        └── C2/C3 ──► 平台                          C2/C3 ──► 平台
```

- **平台签发短时 scoped token**（caller product × target × act × workspace）替代长期共享 secret → 泄露即失效、per-call 可审计、按需授权；
- **一套 JWKS 验签**：用户 token 与 S2S token 同一套验签纪律（reply-01 §7 "可复用验签模块"预留即为此）——加产品 = 注册 client + 上 tailnet 节点，**不新建 bespoke 通道**；
- P2/agent → P1 取数带 S2S token（内含 workspace/product/act），P1 同 JWKS 验 + entitlement 求值，**归因天然**（与 reply-02 §2"谁超多少"同源）。**（token 形状/scope/生命周期 = product_210 T2，请平台定稿。）**

---

## 3. 数据传输效率：控制面 / 数据面分离

arda 是 broker（不搬字节）。P2/agent 大宗取数若都"agent → arda → 属主库 → arda → agent"两跳缓冲，既慢又让 arda 扛流量。建议：

- **arda 留控制面**（authz + policy + 审计 + 配额）；**大宗只读走数据面**——arda 签发**短时定向签名凭据**，agent 凭它**直连**属主端点拉数，arda 不缠在字节路径上；
- 小结果 / 需脱敏的仍经 arda 代理，大宗只读直连；
- 效果：arda 始终在授权/审计闭环内，吞吐不受 broker 单点限制。**（是否引入直连数据面、签名凭据形状，请平台 + 属主产品共定。）**

---

## 4. 设计目标对照

| 目标 | 手段 |
|---|---|
| **通信安全** | S2S 永不公网；tailnet WireGuard + 平台签发 scoped 短时 token + 一套 JWKS；无长期共享 secret；host-only cookie 不泄会话；内省端点 S2S-gated |
| **沟通效率** | tailnet 直连（无公网/Cloudflare 跳）；同 apex 会话内省免重复 OIDC；token/权益缓存 |
| **数据传输效率** | 控制面/数据面分离，大宗只读直连，broker 不缓冲字节 |
| 爆炸半径隔离 | per-product scoped token，泄露只影响一个 caller、短时失效（vs 共享 secret 全线沦陷）|
| 可审计 | per-call S2S token = 天然调用归因，喂计量/成本分摊 |
| 可演进/一致 | 一套 fabric（JWKS + tailnet + token exchange）；加产品零新通道 |
| 分层解耦 | 类 1 轻耦合（异网、只 auth），拖不垮类 2 内网 fabric |

---

## 5. 落地路线（阶段化，均待平台敲定后启动）

| 阶段 | 动作 | 依赖 |
|---|---|---|
| **P0 边界收口** | S2S 全改 tailnet（`PLATFORM_API_URL` 内网名）+ 边缘只放浏览器路由 | 平台给内网地址（回函 03 §3）|
| **P1 会话内省** | 平台加 `/internal/session/introspect`（tailnet）；类 2 产品互验免重复 OIDC | 平台设计端点 |
| **P2 token exchange** | 平台签发 scoped S2S token 替换共享 secret；arda 复用 JWKS 验签模块（已预留）| product_210 T2 |
| **P3 数据面分离** | arda 签发定向签名凭据，大宗取数直连 | 平台 + 属主产品 |

---

## 6. 请平台决策项（本文须平台敲定的清单）

1. **内网寻址约定**：`*.vxture.com` 各产品/平台的 tailnet 内网名 + S2S base URL 规范（P0 前置）；
2. **会话内省端点**：是否引入 `/internal/session/introspect`（tailnet），形状 / 鉴权 / 缓存 TTL；
3. **token exchange 形状**（product_210 T2）：scoped S2S token 的 claim（caller/target/act/workspace）、生命周期、JWKS；共享 secret 退场时序；
4. **控制/数据面分离**：是否引入直连数据面 + 短时签名凭据形状（涉及各属主产品）；
5. **两类分级确认**：类 1（跨 apex 轻集成）/ 类 2（同 apex 内网 fabric）的判据与各自义务是否成立，写入 `product_200`/`product_100`。

---

## 7. 联系
arda 侧：Stone Smoker（yanhaoguo@gmail.com）；关联 `arda-plat-220-boundary-reply.md`（路径边界）、`arda-plat-200-impl-handoff.md`、`arda-plat-300-tracking.md`。
