# 管理 板块详细设计（arda-biz-250-admin）

> 状态：第 2 层 · 详细设计（待评审）· 板块 `admin`
> 上游：[`biz-100`](arda-biz-100-architecture.md)、[`domain-entities-and-feature-keys.md`](domain-entities-and-feature-keys.md) §2.5/§3、[`data-250`](arda-data-250-admin.md)
> 跨切面见 `biz-100` §3；本板块**权限维度为主**（functional-domains §4.3）

---

## 1. 板块定位

数据域内的管理/运营面：**API Key 管理 + 审计日志 + 数据生命周期执行（归档/销毁 wipe）**。不含身份/成员/席位（那些归平台/IdP，ADR §1.7）。承载 `biz-100` §1 能力维度里运营层的**审计**，与治理侧共担**生命周期**（留存规则在 `biz-230`，销毁执行+留痕在此）。

## 2. 现状

| 能力 | 现状 | 证据 |
|---|---|---|
| API Key 管理 | **仅建表，零界面**（无路由、无入口） | `ApiKey` 模型 |
| 审计日志查看 | **仅建表，零界面** | `AuditLog` 模型 |

> 本板块是**"有数据模型、完全无产品界面"**的缺口——非有意省略，是产品未建。

## 3. 目标能力（feature-key）

| 键 | 能力 |
|---|---|
| `arda.admin.api_keys` | API key 管理（创建/吊销/查看用途） |
| `arda.admin.audit_log` | 查看/导出审计日志 |

配额：`arda.quota.history_retention_days`（审计/版本留存）。

> 已移除 `arda.admin.advanced_security`（SSO/高级安全属身份层，归平台/IdP，domain-entities §3.1）。

## 4. 数据模型（delta）

| 实体 | 状态 | 关键点 |
|---|---|---|
| `ApiKey` | v1 | `hashedKey`(**仅存哈希**，全局唯一)、`scopes[]`、`revoked`、`dataServiceId?`（关联服务，`biz-240`） |
| `AuditLog` | v1 | `actor`(用户 id 或 "platform")、`action`、`target`、`idempotencyKey`(全局唯一，幂等防重放)、`metadata` |

> `AuditLog.idempotencyKey` 也承载 ADR §5.1 平台指令（seed/wipe/invalidate）审计，且是 `biz-240` 对外取数审计的落点。

## 5. 屏幕/交互（全新，从零建）

- **API Key 管理**：列表（名称/scopes/最后使用/状态）、创建（一次性明文展示后仅存哈希）、吊销。
- **审计日志**：按 `workspaceId + createdAt` 检索（已有复合索引）、按 actor/action 过滤、导出（受 `history_retention_days`）。

## 6. 门控（两轴，权限为主）

- **权限**：域级"能否看到管理菜单"取决于角色（`owner`/`admin`）；`arda.admin.api_keys` / `arda.admin.audit_log` 单独要求 `admin+`（functional-domains §5.3）。
- **订阅**：为辅——如 ApiKey 数量上限、审计留存天数走订阅配额。

## 7. 待办

1. **建 API Key 管理界面**（含创建时一次性明文、此后仅哈希）。
2. **建审计日志查看/导出界面**（复用 `[workspaceId, createdAt]` 索引）。
3. `AuditLog` 写入调用点补齐：对外取数（`biz-240`）、平台指令（ADR §5.1）、敏感写操作都应落审计——目前表建好但**写入点稀疏**。
4. **数据生命周期执行**（`biz-100` §1 新增维度）：按 `biz-230` 的留存规则做到期归档/销毁；平台 `wipe` 指令的软删 + 延迟硬删（ADR §5.1）**未实现**——需软删 schema 决策（见 `arda-data-arch-workplan.md` §2.4）。
