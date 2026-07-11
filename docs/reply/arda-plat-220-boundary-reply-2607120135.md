# arda 回函 03：C1/C2/C3 路径边界与 S2S 内网化（arda-plat-220-boundary-reply）

> 版本：v1.0（2026-07-10）
> 时间标记：**2607120135**（YYMMDDHHMM = 2026-07-12 01:35）
> 方向：arda（线 B）→ vxture 平台团队
> 主题：登录授权之后的**内部通信路径边界**——C2/C3（S2S）不得走公网、入站 webhook 与内部端点的暴露面收口
> 配对：`arda_200_interface v1.0`（三通道契约）、`arda_100_handoff` §2（"C2/C3 仅内网可达，公网 nginx 不路由 `/platform/*`"）、reply-01 §7.3（网络前置）
> 触发：2026-07-10 e2e 验收（`arda-plat-300` §4）中实测三通道实际走向，发现路径边界与契约声明不一致。

---

## 0. 结论

契约声明 **"C2/C3 仅内网可达"**，但**实际落地的路径边界没有兑现这条声明**：
- **C2/C3 出站**当前指向**公网** `http://accounts.vxture.com`（明文 HTTP），把 S2S 共享密钥 `x-vxture-internal-auth` 发到公网主机；
- arda 的公网边缘对所有路径**全量代理**（`location /`），导致本应内网-only 的端点也被公网暴露。

本回函列清三区边界模型、实测偏差、以及**需要平台侧提供/确认的项**（§3）与 **arda 侧自行修复项**（§4）。核心诉求一句话：**登录后的一切 S2S 内部通信必须留在内网（tailnet/WireGuard），密钥与内部端点不出网。**

---

## 1. 应有的三区边界模型

| 区 | 主体 | 路径 | 边界控制 |
|---|---|---|---|
| **公网（浏览器面）** | 用户浏览器（经共享边缘 TLS） | `/auth/*`、页面 `/`、`/api/entitlement(+/quota)`、`/.well-known/vxture-tools` | session cookie / OIDC；公网可达是**必须** |
| **S2S 入站（平台 → arda）** | 平台 auth-bff | `/provisioning/webhook`（`subscription_changed`/`grant.invalidated` 同端点） | HMAC 验签；**源应可控** |
| **纯内网（绝不公网）** | arda 自身 / 定时任务 → 平台 | **C2/C3 出站** `/platform/entitlements`、`/usage/consume`、`/usage/gauge`；arda 内部触发 `/api/usage/flush` | tailnet + S2S token；**任一字节不出内网** |

---

## 2. 实测偏差（e2e 2026-07-10）

| # | 偏差 | 级别 | 证据 |
|---|---|---|---|
| B1 | **C2/C3 出站走公网明文 HTTP** | 高 | `PLATFORM_API_URL=http://accounts.vxture.com`；探测 `/platform/entitlements` → 301 公网 Cloudflare → 404。`x-vxture-internal-auth` 明文发公网主机 |
| B2 | **`/api/usage/flush` 无鉴权 + 公网可达** | 中 | 路由 `GET(){ flushUsage() }` 零鉴权；边缘 `location /` 全量代理 → `https://arda.vxture.com/api/usage/flush` 公网可触发上报。端点注释自称 "internal-only" 与实际暴露矛盾 |
| B3 | **`/provisioning/webhook` 公网 + 仅 HMAC** | 低 | 边缘全量代理；靠 HMAC 兜底（坏签名 400）。行业可接受，但与"`/platform/*` 内网-only"不对称 |
| B0 | **边缘无路径分段（根因）** | — | `configs/edge/*.conf` 仅 `location / { proxy_pass }`，无 deny/allow/内网限制 |

---

## 3. 请平台侧提供 / 确认（阻塞右半链 e2e）

1. **【最优先】内网 auth-bff 地址**：给出 C2/C3 出站应指向的**内网（tailnet）base URL**，arda 将 `PLATFORM_API_URL` 从公网改指于此。给出前，arda 的 C2/C3 出站处于"明文公网发 S2S 密钥"状态，**请知悉此为待修安全项**，非单纯"功能未通"。
2. **webhook 投递源**：平台从哪个**源地址/网段**投递 `/provisioning/webhook`？
   - 若走 tailnet：请确认目标 = `ARDA_DEPLOY_HOST:APP_PUBLISH_PORT`（内网），arda 将在边缘对该路径**只放行平台源、deny 其余**；
   - 若必须走公网边缘：请确认边缘对该 vhost 的**平台源 IP 允许名单**，arda 提供 `configs/edge` 修订、由 operator 装入。
3. **边界策略对称确认**：平台侧是否也强制 `/platform/*`、`/usage/*` **仅内网**（不经任何公网边缘暴露）？请确认，以便两侧边界一致。
4. **过渡凭证纪律**：`AUTH_INTERNAL_TOKEN` 在内网地址就绪前若曾随公网请求发出，建议**轮换一次**（product_210 token exchange 落地前的过渡凭证，轮换成本低）。

---

## 4. arda 侧自行修复（不等平台，纵深防御）

| 项 | 动作 | 状态 |
|---|---|---|
| B2 应用层 | `/api/usage/flush` 加内网守卫（`x-internal-job-token` 头 ↔ env 密钥），或**改为 app 内定时器、取消 HTTP 端点**（零暴露面，首选） | arda 侧待做 |
| B2 边缘 | `configs/edge/*.conf` 对 `/api/usage/flush` 返回 404（贡献修订，operator 装入） | arda 侧待做 |
| B1 客户端 | C2/C3 客户端加**出站 host 断言**（目标须属内网网段，否则拒发），防误配把 secret 发公网 | arda 侧待做 |
| B3 边缘 | `/provisioning/webhook` 平台源 IP 允许名单（依 §3.2 平台回复） | 待平台源信息 |

---

## 5. 联系
arda 侧：Stone Smoker（yanhaoguo@gmail.com）；对接契约 `arda-plat-200-impl-handoff.md` / `arda-plat-210-catalog-reply.md`；e2e 与追踪 `arda-plat-300-tracking.md` §4。
