# Arda - Deployment Checklists

---

## Pre-Deploy Checklist

Before any deployment to prod:

- [ ] `quality-gate` check is green on the source commit
- [ ] Beta has been validated (the beta stack is the pre-flight for prod)
- [ ] No in-flight sessions that would be disrupted by a Redis restart
      (Redis is persistent; container restart does not lose sessions)
- [ ] The edge vhost config in `configs/edge/` matches the current `APEX_DOMAIN`
- [ ] `OIDC_REDIRECT_URI` in prod `.env` matches the registered URI on the
      `arda` OIDC client in accounts.vxture.com

---

## First-Time Stack Checklist

Run once per stack (prod and beta independently):

- [ ] `ARDA_DEPLOY_HOST` is on the tailscale network and reachable
- [ ] `stone` user is in the `docker` group
- [ ] Host firewall allows tailscale interface ingress on `APP_PUBLISH_PORT`
      and blocks public interface ingress on that port
- [ ] Stack root directory exists: `/srv/md0/arda` (prod) or `/srv/md1/arda-beta` (beta)
- [ ] `.env` is present at `<ROOT_DIR>/etc/.env` with correct values
- [ ] `OIDC_CLIENT_SECRET` is filled in (non-empty)
- [ ] `NODE_AUTH_TOKEN` is set (for `docker compose pull` of `@vxture` images)
- [ ] `bash deploy/server.sh bootstrap` has been run (Docker installed, dirs created)
- [ ] Edge vhost source artifacts are installed on the shared public edge
- [ ] OIDC redirect URI for this stack is registered on the `arda` OIDC client:
      - Prod: `https://arda.vxture.com/auth/callback`
      - Beta: `https://beta-arda.vxture.com/auth/callback`

---

## Post-Deploy Verification Checklist

After `bash deploy/deploy.sh all` completes:

- [ ] `docker compose ps` shows `arda-app` and `arda-redis` as healthy
- [ ] `curl http://127.0.0.1:$APP_PUBLISH_PORT/api/health` returns `{"status":"ok"}`
- [ ] `docker compose exec arda-redis redis-cli ping` returns `PONG`
- [ ] `curl https://$APEX_DOMAIN/api/health` returns `{"status":"ok"}` (via edge)
- [ ] OIDC login works: visit `https://$APEX_DOMAIN/auth/login` and complete flow
- [ ] Session cookie is set with correct domain (no leading dot)
- [ ] `VERSION` file in `REPO_DIR` contains the deployed commit SHA

---

## Preservation Contracts

These invariants must hold after every deploy. A violation means the deploy is
unsafe:

| Contract | What to check |
|---|---|
| One owned image | Only `arda-app` is built and pushed; no other images in `build_images` |
| Two stacks, no shared state | Prod and beta have separate `DATA_DIR`, separate Redis, separate `PROJECT_NAME` |
| No cross-env `.env` | `/srv/md0/arda/etc/.env` has `PROJECT_NAME=arda`; `/srv/md1/arda-beta/etc/.env` has `PROJECT_NAME=arda-beta` |
| Redis is host-only | `arda-redis` has no host-published ports; only reachable from `arda-net` |
| Session cookie is host-only | `RP_SESSION_COOKIE_DOMAIN` has no leading dot |
| `MOCK_AUTH` is unset in prod | `MOCK_AUTH` must not appear (or must be unset) in the prod `.env` |
| Tailnet port is protected | `APP_PUBLISH_PORT` is bound only on the tailscale interface; not `0.0.0.0` |

---

## Rollback Checklist

If a deploy is bad and must be rolled back, prefer the automated workflow:

```bash
gh workflow run rollback.yml -f environment=production -f commit_sha=<sha>
```

Find `<sha>` from the target host's `deploy/VERSION` file or
`gh run list --workflow deploy.yml`. Production rollback pauses for the same
required-reviewer approval as a normal deploy. See
[`60-operations/20-github-actions.md`](../60-operations/20-github-actions.md) for
details.

Manual fallback (if Actions is unavailable):

1. Identify the last known-good image tag (check `VERSION` file or `gh run list`
   on `deploy.yml`)
2. On the server, pull the previous image tag:
   ```bash
   IMAGE_TAG=sha-<previous-sha> docker compose pull arda-app
   IMAGE_TAG=sha-<previous-sha> docker compose up -d arda-app
   ```
3. Verify the rollback: `bash deploy/deploy.sh verify`
4. Redis data is unaffected by image rollback (AOF persistence)
5. If the rollback is to a version with breaking schema changes, check Redis
   key compatibility manually

Session data in Redis survives container restarts. A rollback that changes the
session schema may result in `rpsess:` keys that the old app cannot parse; in
that case, flush Redis (`docker compose exec arda-redis redis-cli FLUSHALL`)
and have users re-authenticate.

---

## Scenario Matrix

| Scenario | Action |
|---|---|
| First deploy (new server) | `server.sh bootstrap` -> place `.env` -> `deploy.sh all` |
| Routine feature deploy | Push a `beta-*` tag (beta) / push a `v*.*.*` tag + approve (prod) |
| Bad deploy needs rollback | `gh workflow run rollback.yml -f environment=<env> -f commit_sha=<sha>` |
| CI docker-build infra flake | `gh run rerun <run-id> --failed` |
| Manual re-deploy (same image) | `bash deploy/deploy.sh all --skip-backup` |
| Redis data backup | `bash deploy/ops.sh backup` |
| Container crash (restart policy handles it) | `docker compose ps` to confirm; `ops.sh logs arda-app` |
| Container stuck (won't restart) | `ops.sh restart` or `docker compose down && docker compose up -d` |
| Edge vhost update | Update `configs/edge/*.conf`, install on edge host via vxture repo `20-sync-nginx-config.sh` |
| OIDC secret rotation | Update `OIDC_CLIENT_SECRET` in `etc/.env`; `ops.sh restart arda-app` |
| Full reset (broken state) | `server.sh reset` (stops containers, clears RUNTIME_DIR; DATA_DIR and .env preserved) |
