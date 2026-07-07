❯ 我从ruyin.ai 登录的。
  website, console, beta-arda, 都争取登入并跳转了。
  只有arda，返回https://0.0.0.0:3230/?sso=failed，报错。

  退出操作，从vxture.com , 其他都退出成功了。只有 beta-arda, 还是登录态。前面有过这个错误，清理浏览器缓存可修好，但这不是正路。

vxture项目已经完成，并给arda提出沟通：

Bug B（beta-arda 退出不生效）→ PR #484继续
- 代码已就位，merge 后重跑 seed 即可
- 还需要你在 worker-02 上把 beta-arda BFF 的 OIDC_CLIENT_ID（或等效配置）从 arda 改为 arda-beta，然后重启 beta-arda 容器
- 重跑 seed：cd /srv/vxture/deploy && CONFIRM_SEED=yes bash scripts/23-seed-platform-database.sh

Bug A（arda 0.0.0.0:3230/?sso=failed）→ 需要你查 worker-02

这是 arda 侧配置问题，不在 vxture 代码里。请在 worker-02 上检查 arda BFF 的环境变量：
- DEFAULT_RETURN_TO 必须是 https://arda.vxture.com（当前很可能是 http://0.0.0.0:3230）
- ALLOWED_RETURN_ORIGINS 必须包含 https://arda.vxture.com

同时查一下 arda BFF 容器日志，看 callback 的具体报错是什么（docker logs vx-arda --tail=50 或类似），确认是 token exchange 失败还是 state 过期。

Seed 成功。确认两行都在：

- arda (realm=tenant, secret=set) ✓ — back_channel_logout_uri = https://arda.vxture.com/auth/backchannel-logout
- arda-beta (realm=tenant, secret=unset) ✓ — back_channel_logout_uri = https://beta-arda.vxture.com/auth/backchannel-logout

现在还需要你做一件事：在 worker-02 上把 beta-arda BFF 的 client_id 配置从 arda 改为 arda-beta，然后重启 beta-arda BFF 容器。具体是哪个环境变量取决于 arda 的 BFF 框架（NestJS 是 OIDC_CLIENT_ID，NextAuth.js 是 NEXTAUTH_*，等等）。改好重启后，再验证退出：从 vxture.com 退出，beta-arda 应该也同步退出。



好的。待办事项记在这里：

worker-02 上需要做的（beta-arda 退出同步）：
1. 找到 beta-arda BFF 的环境变量文件（通常是 platform-arda-beta.env 或类似）
2. 把 OIDC_CLIENT_ID=arda 改为 OIDC_CLIENT_ID=arda-beta（字段名视 BFF 框架而定）
3. 重启 beta-arda BFF 容器
4. 验证：从 vxture.com 退出 → beta-arda 同步退出

arda 0.0.0.0:3230 问题（独立于上面）：
也在 worker-02 检查 arda BFF 环境变量：DEFAULT_RETURN_TO 和 ALLOWED_RETURN_ORIGINS 要设为 https://arda.vxture.com。