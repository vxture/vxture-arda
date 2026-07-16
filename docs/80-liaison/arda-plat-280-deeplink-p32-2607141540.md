# arda 回函 09：深链联测收口 + P3.2 v1 功能切片回销（arda-plat-280-deeplink-p32）

> 版本：v1.0 · 日期：2026-07-14 · 时间标记：**2607141540**（YYMMDDHHMM）
> 方向：arda（线 B）→ vxture 平台团队
> 对账对象：`arda_301_deeplink-live`（联测请求）、`arda_000_definition` §3（v1 功能切片）、`product_310` 剩项 P3.2
> 性质：**联测结果回传 + P3.2 回销**。无待平台裁定项。

---

## 1. 深链联测（arda_301 §4）：全链通过

**机器可验段**（2026-07-14 实测）：`/subscribe` 四种 intent（upgrade+target_tier / seat / 乱填 / addon+metric）未登录一律 `307 → /{locale}/signin?next=/subscribe?...`，query 逐字段保留；arda 深链构造与 product_200 §3.2 逐参吻合（不带 workspace_id）。

**真人目测段**（owner，四步全 ✅）：
1. arda 无订阅拦截页 →【订阅】按钮显式点击，新标签打开深链；
2. console 登录门 → 登录后回到 `/subscribe` 落地页，上下文不丢；
3. 落地页渲染正确：当前订阅卡片（null 态突出"开通"）+ 套餐阶梯；
4. 未知 intent 刷新 → 降级订阅管理首页（保留 product 上下文），不报错。

顺带修复一处 arda 侧残留：入口拦截墙 CTA 仍挂深链体系之前的占位链接（`vxture.com/legal/terms`），已改为按 status 分岔的深链（null→`intent=upgrade`+【订阅】；expired/cancelled/suspended→`intent=renew`+【续订】），全仓占位残留清零。

## 2. P3.2（arda_000 §3 v1 功能切片）回销

| 切片 | 状态 |
|---|---|
| ① 数据目录 | **基本完成**：DataSource 登记/查询已上产，**目录四元组 `(org, ws, product, datasource)` 已补齐**（orgId 取自会话 active_org、productCode 区分归属产品；迁移 0009 已两栈落库）。**缺口如实报**：生命周期"解绑"动作（注销 + 级联撤销上游信号）未实现，列 arda 侧待办 |
| ② 连接器登记（内部 agent-db 类型） | **完成**：`agent_db` 一等源类型（登记时填归属产品码），postgres 内省连接器（pg_catalog，只读元数据），连接参数**应用层 AES-256-GCM 加密落库、DB 不见明文**（与"secret 引用不落明文"同一意图），连接测试 + 手动同步（调度=future 占位） |
| ③ 数据服务化只读输出 | **完成**：`GET /api/services/{id}` 网关——ApiKey 认证（sha256、一次性明文铸造）、只读（scope=read 语义）、**v1 求值 = 属主访问 + 执行点产品 entitlement（经 C2）**，grant 求值按约后置（P4.4 随共享面，SoT 尊重平台 sharing 域）；附加分级上限过滤 + 脱敏下推 + 访问审计 |

切片之外同窗完成（供了解）：质量检查下推执行 + 发布质量门、血缘三实体成图 + 影响分析、workspace 级 wipe 软删/90 天清扫/复活窗口。

## 3. 计量整备收口

C3 全链就绪：consume 两个业务触发点（`quality.check.run` divisible 后报、`service.api.call` 逐调用）+ **storage gauge 已实装**（`SUM(Dataset.sizeBytes)` 绝对水位，必填 `observed_at`，上报点=同步后+硬删后，best-effort 自愈）。arda 侧平台集成待办清零。

## 4. 联系
arda 侧：Stone Smoker（yanhaoguo@gmail.com）；对账 `arda-plat-300-tracking.md` §2h。
