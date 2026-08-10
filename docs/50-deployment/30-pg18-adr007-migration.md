# 运维窗口 · Postgres 16 -> 18 + ADR-007 库名迁移(prod/beta 各执行一次)

> 状态:一次性迁移 runbook(执行完成后本文转历史记录)
> 背景:runos->arda 整改 #190(库名 `vxturebiz_arda_{env}` -> `vx_arda_db`)与 #192(postgres:16-alpine -> 18-alpine,数据卷改挂父目录)。合并该 PR 后,compose 的默认值已指向新形态;**在执行本窗口之前,不要对旧库跑 db-init / seed-demo-data**(其默认库名已是 `vx_arda_db`)。

## 前提

- 该 PR 已合并,并已 cut 新的发布 tag(部署会拉起 postgres:18 容器)。
- 窗口内停机可接受(分钟级,取决于 dump/restore 体量)。
- 操作者能 SSH 到 ARDA_DEPLOY_HOST(tailnet)。

## 步骤(以 prod 为例;beta 同理,容器名 arda-beta-*,目录 /srv/md1/arda-beta)

1. **备份**(旧栈仍在运行时):`bash deploy/scripts/55-backup-runtime-state.sh`,或手动
   `docker exec arda-db pg_dump -U arda -d vxturebiz_arda_prod -Fc > /srv/md0/arda/backup/pre18.dump`
2. **停栈**:`docker compose down`(在栈目录)。
3. **移开旧数据目录**(16 的布局,18 镜像拒绝启动):
   `mv <DATA_DIR>/postgres <DATA_DIR>/postgres.pg16.bak`
4. **更新 etc/.env**:`POSTGRES_DB=vx_arda_db`;`DATABASE_URL` 的库段改为 `vx_arda_db`(参考 `deploy/env/prod.env` 模板)。
5. **发布部署**(推 tag 或 rollback.yml 重指现有 sha 镜像):新栈拉起,postgres:18 全新初始化,自动建 `vx_arda_db`(owner=arda)。注意 compose 健康检查已改为真实查询(`psql SELECT 1`),等待 db healthy。
6. **恢复数据**:
   `docker exec -i arda-db pg_restore -U arda -d vx_arda_db --no-owner < pre18.dump`
7. **重建角色与授权**(restore 不含 role):走 `db-init.yml`(action=roles,再 apply/verify),或手动按 `deploy/database/ddl/97_service_role.sql` + `98_column_locks.sql` 执行。
8. **起 app 并验证**:`docker compose up -d`;`/api/health` 绿;登录 UI 抽查;`/api/v1/datasets` 用 scoped key 抽查。
9. **收尾**:确认稳定运行 >= 1 个观察日后删除 `postgres.pg16.bak`;平台侧 infra-allocation-registry 行随 platform #206 更新。

## 回退

任一步失败:`docker compose down` -> 还原 `postgres.pg16.bak` 为 `<DATA_DIR>/postgres` -> etc/.env 改回旧值 -> 用 rollback.yml 重指上一个 sha 镜像(compose 需要临时检出旧版本,因为新 compose 挂父目录)。备份 dump 在第 1 步已留存。
