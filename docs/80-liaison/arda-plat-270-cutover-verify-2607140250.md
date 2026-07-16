# arda 回函 08：cutover 完成回传——线 B 切换执行与验证结果（arda-plat-270-cutover-verify）

> 版本：v1.0 · 日期：2026-07-14 · 时间标记：**2607140250**（YYMMDDHHMM）
> 方向：arda（线 B）→ vxture 平台团队
> 对账对象：`arda_305_reply-05`（cutover 通知函）、`arda_304_reply-04`（回函 07 回执）
> 性质：**切换执行回传**。线 B 全部行动项已完成，两栈（prod + beta）已在新契约上运行并逐项验证。§3 含平台要的 `ARDA_WEBHOOK_BASE_URL` 与两个小回传项。

---

## 1. 线 B 执行记录（2026-07-14，全部完成）

| 项 | 执行 |
|---|---|
| 代码：请求 scope 去除退役项 | PR #98（`732a0dc`）：默认 scopes → `openid profile email phone`（真实与 MOCK 路径同改） |
| 代码：EnvGuard 退役（回函 07 §4 备案项） | 同 PR：组件删除、根 layout 挂载移除；`ArdaState`/`ArdaClaim` 降级为 dev-mock 专用 |
| host：两栈 `etc/.env` | `OIDC_SCOPES` 去除 `arda:subscription`（**此处才是登录恢复关键**——env 覆盖代码默认值）；`PLATFORM_API_URL` → `http://100.100.197.42:8080`；原值已带时间戳备份 |
| 部署 | beta：#98 合并自动部署；prod：`promote.yml` fast-forward `main`（release_note 含窗口摘要），CI 按 digest 重签部署。两栈现均为 `sha-732a0dc` + 新 env |

## 2. 验证结果（arda_305 §4 清单逐项）

| # | 项 | 结果 |
|---|---|---|
| 1 | `GET :8080/healthz` | ✅ 200；旧 base `:3090/platform/*` 已 404（边界摘除确认） |
| 2 | C1 登录（改 scope 后） | ✅ 两栈 `/auth/login` 授权跳转 `scope=openid+profile+email+phone`（无退役 scope）；app 健康 200 |
| 3 | C2 v2 信封 | ✅ 形状逐字段吻合 arda_200 v2.0（status/时间戳/tier/bundled/limits/quota_pools）；**注意**：样例 workspace `…0210` 现回落 never-subscribed 形状（status:null、空 limits/pools）——订阅疑被 reseed 清除，**请平台补种后我方再补一例"真实订阅"验证**（不阻塞：回落形状与 never-subscribed 例均已验证） |
| 4 | C3 consume 幂等 + gauge LWW | ✅ consume 同 key 重放返回 `replayed:true` 不二次扣减；gauge `applied:true`。**契约小回传**：`PUT /usage/gauge` 强制要求 `observed_at`（缺失 400 `invalid_observed_at`）——arda_200 §2.4 的 gauge 载荷示例请确认已含该必填字段，arda 侧 gauge 实现将随带 |
| 5 | provisioning webhook | ✅ 坏签名 400（验签在岗）；正向投递用例待平台按 §3 新 base 配置后触发一笔测试订阅联测 |
| 6 | 回传对账 | ✅ 本函 + `arda-plat-300-tracking.md` §2f |

## 3. 平台索要项：`ARDA_WEBHOOK_BASE_URL`

worker-02 tailnet 接收 base（app 直发布于 tailnet 端口，无本机反代）：

| 栈 | 值 |
|---|---|
| **prod** | `http://100.76.219.48:3230` |
| beta | `http://100.76.219.48:3231` |

（webhook 路径照旧 `/provisioning/webhook`，HMAC secret 同值不动。）配置 + reseed 后请发一笔测试事件，我方回执 processed。

## 4. 未尽事项

1. `AUTH_INTERNAL_TOKEN` 轮换：等 owner 带外转运新值（现值有效，非阻塞）；arda 侧为两栈 env 更新 + 容器重建，随到随做。
2. v1 回退解析代码：按 arda_305 §2 提示留存无害，将随后续清理 PR 移除。

## 5. 联系
arda 侧：Stone Smoker（yanhaoguo@gmail.com）；执行留痕 `arda-plat-300-tracking.md` §2f。
