# arda 平台对接 · OIDC RP 契约（arda-plat-110-oidc-contract）

> 状态：权威设计（随代码演进更新）
> 层：第 1 层 · OIDC 契约（`plat` 系列，见 [`plat-000`](arda-plat-000-index.md) 索引）
> 范围：arda 作为 OIDC relying party 对 accounts.vxture.com 的完整契约——client 注册、endpoints、PKCE 流程、back-channel logout、session cookie、`MOCK_AUTH` 本地开发模式。这是 `plat` 系列**唯一详细展开**的内容层。
> 上游：`10-identity-app-integration-standard.md`（原始规范，本文件核对代码后修正了其中的 scope 名残留）；代码真源 `portals/app/app/auth/lib/{config,pkce,oidc,cookie}.ts`、`portals/app/app/auth/backchannel-logout/route.ts`

---

## 1. Client 注册（两个 client，每栈一个）

| 参数 | Prod client | Beta client |
|---|---|---|
| Client ID | `arda` | `arda-beta` |
| 认证方式 | `client_secret_basic` | `client_secret_basic` |
| Redirect URI | `https://arda.vxture.com/auth/callback` | `https://beta-arda.vxture.com/auth/callback` |
| Post-logout redirect URI | `https://arda.vxture.com/` | `https://beta-arda.vxture.com/` |
| Back-channel logout URI | `https://arda.vxture.com/auth/backchannel-logout` | `https://beta-arda.vxture.com/auth/backchannel-logout` |
| Scopes | `openid profile email phone arda` | 同左 |

两个 client（而非一个 client 配两个 redirect URI）是必须的：OIDC back-channel logout 每个 client 只能注册一条登出 URI，且两个 client 分离了 token 受众与密钥爆炸半径（prod 泄露不连累 beta）。两个 client 认证**同一个用户目录**（同一 IdP realm）——分离的是应用注册，不是用户。

> **scope 名修正（2026-07-03）**：`10-identity-app-integration-standard.md` 此前写 `arda:subscription` 为当前 scope，已过期——真实代码（`auth/lib/config.ts` 第 78/113 行）的 scope 字符串是 `openid profile email phone arda`，且可由 `OIDC_SCOPES` 环境变量覆盖。`arda:subscription` 是**历史 scope 名**，`20-vxture-platform-integration-requirements.md` §2.3 已经记录了它的退役过程（过渡期仍下发 `arda` claim），本文件与代码现状同步为准。

---

## 2. Endpoints（从 issuer 派生，不走 discovery）

`OIDC_ISSUER` = `https://accounts.vxture.com`；全部 endpoint 由此派生，**每次请求不重新 discovery**：

| Endpoint | URL |
|---|---|
| Authorization | `{issuer}/oidc/authorize` |
| Token exchange | `{issuer}/oidc/token` |
| JWKS（验签） | `{issuer}/oidc/jwks` |
| End session | `{issuer}/oidc/end_session` |

---

## 3. Authorization Code + PKCE 流程

- **仅支持 S256**，不接受 `plain` code_challenge_method（`pkce.ts`：`code_challenge = base64url(sha256(code_verifier))`）。
- `code_verifier` 每次请求生成（32 随机字节，base64url），存入 Redis `authreq:<state>`，callback 时消费且**仅消费一次**。
- 完整流程：
  1. 用户命中受保护路由 -> 中间件重定向到 `/auth/login`。
  2. `/auth/login` 生成 PKCE（verifier + challenge），`authreq` 存入 Redis，重定向到 `{issuer}/oidc/authorize`。
  3. 用户在 accounts.vxture.com 完成认证。
  4. IdP 重定向回 `/auth/callback?code=...&state=...`。
  5. `/auth/callback` 校验 `state`，从 Redis 取回 `authreq`，用 code 换 token（Authorization Code + PKCE）。
  6. Token 存入 Redis（`rptok:`）；创建会话（`rpsess:`）。
  7. 浏览器拿到不透明会话 cookie（`vx_rp_session`）。
  8. 重定向到 return-to URL 或 `DEFAULT_LANDING`。

**Token 刷新**：每次请求时会话中间件检查 access token 是否临近过期，是则用 refresh token 静默换新；浏览器无感知，会话 cookie 不变。

### 3.1 `appOrigin`：防止内部 bind 地址泄漏到跳转（关键细节，原规范未记录）

`config.ts` 里的 `appOrigin` **不取自请求 host**，而是从注册的 `redirectUri` 派生（`new URL(redirectUri).origin`）。原因：arda 部署在共享边缘代理之后，请求 host 在内部会解析成绑定地址（如 `0.0.0.0:3230`）——若直接用请求 host 拼跳转地址，会把这个内部地址泄漏进 `Location` header。所有用户可见的跳转（callback 落地、登出后落地、`returnTo` 基址）一律锚定 `appOrigin`，不用请求 host。

> 这正是 [`plat-300`](arda-plat-300-tracking.md) §1 记录的生产 bug（`https://arda.vxture.com/?sso=failed` 背后曾出现 `0.0.0.0:3230`）的相关机制——该 bug 经判定是 `DEFAULT_RETURN_TO`/`ALLOWED_RETURN_ORIGINS` 环境变量配置问题，不是 `appOrigin` 机制本身的缺陷，但理解这个机制是排查同类问题的关键背景。

---

## 4. Back-Channel Logout

`POST /auth/backchannel-logout` 接收 IdP 推送的 `logout_token` JWT（标准 §8）：

- 验签（`verifyToken`：iss/aud/exp）。
- **禁止携带 `nonce`**——`logout_token` 若带 `nonce` 直接判无效（防止与 authorization 流程的 token 混淆）。
- 必须携带 `backchannel-logout` 事件（`events["http://schemas.openid.net/event/backchannel-logout"]` 存在且为非 null 对象）。
- 必须携带 `sid` 字符串。
- **`jti` 幂等防重放**：`jti` 是必需字段，用于在 token 有效期窗口内拒绝重复投递——同一 `jti` 第二次到达时，直接幂等返回 200（不重复执行登出），不算错误。
- 校验通过后，按 `sid` 查 Redis 的 `sid:<sid>` 索引，销毁对应的 `rpsess:`/`rptok:`。
- 这是跨子域应用**唯一支持的全局登出机制**（无需 iframe/cookie 共享）。

实现：`portals/app/app/auth/backchannel-logout/route.ts`。

---

## 5. Session Cookie

| 属性 | 值 |
|---|---|
| 名称 | `vx_rp_session`（可由 `RP_SESSION_COOKIE_NAME` 覆盖）|
| Domain | 精确 host，**无前导点**（`RP_SESSION_COOKIE_DOMAIN`）|
| HttpOnly | 是 |
| Secure | 生产环境为 `true`（`cfg.isProd`）|
| SameSite | `Lax` |
| Path | `/` |
| MaxAge | `RP_SESSION_TTL`（默认 2592000 秒 = 30 天）|

Cookie 是 **host-only**：不会传播到 `*.vxture.com` 的兄弟子域。这是跨子域应用的硬性要求（标准强制项）。

---

## 6. Token 存储

Token 只存服务端（Redis）。浏览器**永远拿不到** access token / refresh token——这是标准规定的 BFF 模式。参见 [`decisions/00-index.md`](decisions/00-index.md)。

---

## 7. `MOCK_AUTH` 本地开发模式

`MOCK_AUTH=true`（且 `NODE_ENV != production`）时绕过真实 OIDC 流程：

- `getOidcConfig()` 返回固定的 mock 配置（`issuer=http://mock-idp.local`，endpoints 全部指向不可达占位地址——这些 endpoint 从不会被真正调用，因为 `/auth/dev-login` 直接在 Redis 里建会话）。
- mock 模式下 session TTL 被**强制封顶 86400 秒**（1天），即使 `RP_SESSION_TTL` 配置了更长的值。
- `/auth/dev-login` 的 `arda` claim 由 `MOCK_STATE`/`MOCK_TIER` 环境变量控制（见 [`ent-100`](arda-ent-100-architecture.md) §1）。
- **硬门控**：`NODE_ENV=production` 时 `MOCK_AUTH` 完全不生效，无论其值是什么。

---

## 8. 文档导航

| 需要什么 | 看哪个文件 |
|---|---|
| 三通道全景、耦合契约 | [`plat-100`](arda-plat-100-architecture.md) |
| OIDC 契约细节（本文件） | `plat-110`（本文件） |
| 对接现状、平台待确认清单 | [`plat-300`](arda-plat-300-tracking.md) |
