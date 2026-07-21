# Arda operator runbook (host + secret config)

> Scope: the host-side / GitHub-secret configuration that the CI/CD pipeline
> cannot set for you. Source-of-truth for "why did my committed change not take
> effect on the running stack?" Two-host topology: shared public edge ->
> ARDA_DEPLOY_HOST (private compute) running `arda-app` + `arda-redis` + `arda-db`
> per stack (prod `arda-*`, beta `arda-beta-*`).

## 0. Golden rule

The running stacks read config from the **persistent host file**
`$PROJECT_ROOT/etc/.env` (prod `/srv/md0/arda/etc/.env`, beta
`/srv/md1/arda-beta/etc/.env`). Committed `deploy/env/*.env` are TEMPLATES used
ONLY to seed `etc/.env` on first bootstrap (via the `ENV_FILE_B64` environment
secret); the bootstrap SKIPS an `etc/.env` that already exists. So a committed
config change does NOT reach a running stack until `etc/.env` is edited on the
host. After editing `etc/.env`, redeploy (a plain `docker compose restart` does
NOT reload env - the container must be recreated; a redeploy does that).

---

## 1. BLOCKER: `DEPLOY_DIR` must equal the host `REPO_DIR`

Symptom: CI is green and the deploy log shows
`[deliver] docker-compose.yml has arda-db`, but the running stack still uses the
OLD compose/scripts (new services like `arda-db` never start; new deploy-script
behavior never runs).

Cause: CI rsyncs the fresh `deploy/` + `configs/` + `docker-compose.yml` to
`$DEPLOY_DIR` (the GitHub Environment secret). But `deploy.sh` sources
`etc/.env`, which sets `REPO_DIR`, and every step does `cd "$REPO_DIR"`. If
`DEPLOY_DIR` (rsync dest) differs from `etc/.env`'s `REPO_DIR` (run dir),
the deploy runs from a different directory and reads stale files.

Fix (per environment, beta and prod):

1. Check the host value:
   ```
   grep REPO_DIR /srv/md1/arda-beta/etc/.env   # beta
   grep REPO_DIR /srv/md0/arda/etc/.env        # prod
   ```
2. Compare to the `DEPLOY_DIR` secret in the matching GitHub Environment
   (repo Settings -> Environments -> beta / production).
3. Make them equal. Recommended canonical values:
   - beta: `/srv/md1/arda-beta/deploy`
   - prod: `/srv/md0/arda/deploy`
   Either set `DEPLOY_DIR` to that exact value, or unset it (the workflow
   defaults to the same path) AND ensure `etc/.env`'s `REPO_DIR` matches.
4. Redeploy. Confirm in the deploy log: `arda-(beta-)db` appears in the container
   status table and the DB health-gate passes.

---

## 2. Required `etc/.env` values (edit on host, then redeploy)

### Beta (`/srv/md1/arda-beta/etc/.env`)

| Key | Value | Why |
|---|---|---|
| `OIDC_CLIENT_ID` | `arda-beta` | Beta is a distinct IdP client; using `arda` causes `invalid_redirect_uri` and breaks logout fan-out. |
| `OIDC_CLIENT_SECRET` | real `arda-beta` secret | Not `ChangeME`. |
| `DEFAULT_LANDING` | `/dashboard` | Old `/data-assets/overview` route was removed; stale value 404s the post-login root. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `arda` / a real secret / `arda` | DB creds. Internal-only DB; defaults work but set a real password. |
| `DATABASE_URL` | `postgresql://arda:<pw>@arda-beta-db:5432/arda?schema=public` | Host MUST be `arda-beta-db` (this stack's db container). If unset, the compose default already resolves to `${PROJECT_NAME}-db`. |

### Prod (`/srv/md0/arda/etc/.env`)

Same keys, with: `OIDC_CLIENT_ID=arda`, real `OIDC_CLIENT_SECRET`,
`DEFAULT_LANDING=/dashboard`, `DATABASE_URL` host `arda-db`, and a real
`POSTGRES_PASSWORD`.

> Also update each environment's `ENV_FILE_B64` secret to match, so a future
> fresh bootstrap seeds the correct `etc/.env`.

---

## 3. Apply + verify

1. SSH to ARDA_DEPLOY_HOST, edit the stack's `etc/.env`.
2. Redeploy: push a new `beta-*`/`v*.*.*` tag, or re-run the latest `deploy.yml`
   run for that tag. A plain container restart will NOT pick up new env.
3. Verify:
   - `cd <REPO_DIR> && docker compose ps` -> `arda-(beta-)app`, `-redis`, `-db`
     all `Up (healthy)`.
   - App: browser login lands on `/dashboard` (no `0.0.0.0`, no `sso=failed`).
   - Logout from `vxture.com` also signs out beta (client_id fix).
   - DB: `docker compose logs <stack>-app | grep -i migrate` shows migrations
     applied; `docker exec <stack>-db psql -U arda -d arda -c '\dt'` lists tables.

---

## 4. Cut a production release

Beta validated -> push a production tag (see CLAUDE.md "How to make a change"):
```
git tag vX.Y.Z && git push origin vX.Y.Z
```
Then approve the pending deployment request on the `production` GitHub
Environment to let the deploy proceed. Before tagging, ensure prod `etc/.env`
already carries the §2 values so the prod stack comes up healthy on first
deploy of the new image.

## 5. DB service-role cutover (one-time per stack)

After `db-init` (`roles` action) has created `arda_svc` on the stack DB:

1. Read the environment's `ARDA_DB_SVC_PASSWORD` (GitHub Environment secret).
2. On the host, edit the stack `etc/.env`: set
   `DATABASE_URL=postgresql://arda_svc:<password>@<stack>-db:5432/arda?schema=public`
   (host is `arda-db` for prod, `arda-beta-db` for beta).
3. Restart the app container (`docker compose up -d arda-app` from the stack
   deploy dir, or rerun the release deploy).
4. Verify: app healthy + a write path works (create/edit a catalog entity).
   `permission denied for table ...` means a writable column is missing from
   `98_column_locks.sql` - fix the whitelist, rerun db-init `roles`.

Order: beta first, observe, then production. Until cutover the app still
connects as the DB owner role; the locks exist but do not constrain it.
