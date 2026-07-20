# Arda - Deployment

---

## Overview

Arda deploys to a single private compute host (`ARDA_DEPLOY_HOST`, tailnet-only,
no public IP). Two independent stacks run on that host: prod (`/srv/md0/arda`)
and beta (`/srv/md1/arda-beta`). Deploys are triggered only by pushing a
release tag: a `beta-*` tag deploys beta, a `v*.*.*` tag deploys prod (after a
required-reviewer approval). Merging to `main` never deploys by itself.

There is no git clone on the server. CI rsyncs only the deploy subset
(`deploy/`, `configs/`, `docker-compose.yml`) plus a `VERSION` file stamped
with the deployed SHA.

---

## Prerequisites

On the server (first-time only):

1. Docker Engine installed and running as the admin user
2. `stone` user in the `docker` group
3. Tailscale connected (`tailscale up`, the host must be reachable by its
   tailscale name/IP from the CI runner)
4. Host firewall: allow ingress on the tailscale interface for port 3230 (prod)
   and 3231 (beta); block public interface for those ports
5. Stack root directories created: `/srv/md0/arda` (prod), `/srv/md1/arda-beta`
   (beta)
6. `.env` placed at `<ROOT_DIR>/etc/.env` (see Environment Configuration below)

---

## First Deploy (Manual)

```bash
ssh stone@<ARDA_DEPLOY_HOST-tailscale-ip>

# Prod stack:
cd /srv/md0/arda
git clone ... deploy    # OR: let CI rsync the first time
bash deploy/deploy.sh all

# Beta stack:
cd /srv/md1/arda-beta
bash deploy/deploy.sh all
```

After the first deploy, CI takes over. Manual deploys are only needed for
operator intervention.

---

## Standard Deploy (CI-Driven)

### Beta (push a `beta-*` tag):

```
git tag beta-YYYYMMDD.N && git push origin beta-YYYYMMDD.N
  -> deploy.yml detect (route tag prefix -> beta environment)
  -> deploy.yml docker-build (build arda-app image, push to GHCR + Aliyun ACR)
  -> deploy.yml deploy
       - Join tailnet (tailscale github-action)
       - Bootstrap .env if not present
       - rsync deploy subset to ARDA_DEPLOY_HOST:/srv/md1/arda-beta/deploy/
       - SSH: bash deploy.sh all + bash deploy.sh verify
```

No approval gate - deploys as soon as the build finishes.

### Prod (push a `vX.Y.Z` tag):

```
git tag vX.Y.Z && git push origin vX.Y.Z
  -> deploy.yml detect (route tag prefix -> production environment)
  -> deploy.yml docker-build (reuses the same arda-app image if this commit was
       already built under a prior tag; retag by digest instead of rebuilding)
  -> [deploy job pauses for required-reviewer approval on the production
       GitHub Environment]
  -> deploy.yml deploy: same sequence as beta, targeting /srv/md0/arda
```

Approve the pending deployment request in the GitHub Actions run (or under
repo Settings -> Environments -> production -> Deployments) to let it proceed.

---

## Environment Configuration

All runtime config is in `.env` at `<ROOT_DIR>/etc/.env`. Use `.env.example`
as the template:

```bash
cp .env.example /srv/md0/arda/etc/.env    # prod
cp .env.example /srv/md1/arda-beta/etc/.env  # beta
# Edit each file for its environment
```

`.env` is git-ignored and never committed. CI bootstraps it from the
`ENV_FILE_BASE64` GitHub Environment secret on first deploy.

### Key Variables to Verify

| Variable | Prod | Beta |
|---|---|---|
| `PROJECT_NAME` | `arda` | `arda-beta` |
| `ROOT_DIR` | `/srv/md0/arda` | `/srv/md1/arda-beta` |
| `APEX_DOMAIN` | `arda.vxture.com` | `beta-arda.vxture.com` |
| `APP_PUBLISH_PORT` | `3230` | `3231` |
| `OIDC_CLIENT_ID` | `arda` | `arda-beta` |
| `OIDC_CLIENT_SECRET` | (provisioned, `arda` client) | (provisioned, `arda-beta` client) |
| `OIDC_REDIRECT_URI` | `https://arda.vxture.com/auth/callback` | `https://beta-arda.vxture.com/auth/callback` |
| `REDIS_URL` | `redis://arda-redis:6379` | `redis://arda-beta-redis:6379` |
| `RP_SESSION_COOKIE_DOMAIN` | `arda.vxture.com` | `beta-arda.vxture.com` |
| `MOCK_STATE` | `subscribed` | `trial` |
| `NEXT_PUBLIC_APP_ENV` | `prod` | `beta` |

See `.env.example` for all supported variables and their documentation.

---

## Deploy Step Reference

`bash deploy/deploy.sh all` chains these steps:

| Step | Script | Description |
|---|---|---|
| 1 | `11-check-runtime-environment.sh` | Validate .env values and system prerequisites |
| 2 | `12-prepare-runtime-directories.sh` | Create runtime/, data/, backup/ dirs |
| 3 | `55-backup-runtime-state.sh` | Pre-deploy backup snapshot |
| 4 | `23-start-docker-services.sh` | `docker compose pull` + `docker compose up -d` |
| 5 | (cron) | Install daily backup cron at 02:00 |
| 6 | `55-backup-runtime-state.sh` | Post-deploy backup snapshot |
| 7 | `24-verify-deployment.sh` | Health-check containers and `/api/health` |

---

## Verification

After deploy, verify manually:

```bash
# Container health
docker compose ps

# App health endpoint (direct on tailnet)
curl http://127.0.0.1:$APP_PUBLISH_PORT/api/health
# Expected: {"status":"ok"}

# Redis connectivity
docker compose exec arda-redis redis-cli ping
# Expected: PONG

# Full deployment verification
bash deploy/deploy.sh verify
```

Through the edge (requires edge vhost installed):

```bash
curl https://arda.vxture.com/api/health
# Expected: {"status":"ok"}
```

---

## Edge Vhost Installation

After the first deploy or domain changes, install the vhost config on the
shared public edge:

1. Copy `configs/edge/arda.vxture.com.conf` and
   `configs/edge/beta-arda.vxture.com.conf` into the vxture project repository
2. Run `20-sync-nginx-config.sh` on the edge host
3. Verify with `curl -I https://arda.vxture.com/api/health`

See `configs/edge/README.md` for the full sync procedure.

---

## Image Registry

The `arda-app` image is pushed to GHCR (primary) and Aliyun ACR (pull-through
fallback for the deploy host):

```
GHCR:       ghcr.io/vxture/arda-app:<tag>
Aliyun ACR: <ALIYUN_ACR_REGISTRY>/<ALIYUN_ACR_NAMESPACE>/arda-app:<tag>
```

`ALIYUN_ACR_REGISTRY` (org-level GitHub variable) and `ALIYUN_ACR_NAMESPACE`
(repo-level GitHub variable, currently `vx-foundation` for arda) resolve the
actual hostname/namespace - see `docs/60-operations/20-github-actions.md`.

Image tags:
- `sha-<7-char-short-sha>`: canonical per-commit tag (used by deploy)
- `beta-YYYYMMDD.N` / `vX.Y.Z`: the exact pushed release tag (human/audit reference)

The deploy script tries GHCR first; if the pull fails, it falls back to Aliyun
ACR using the `FALLBACK_IMAGE_*` env vars. Docker login is retried up to 6 times
with back-off for the Aliyun registry.

---

## Generating CI Secrets

Helper scripts in `scripts/github/` base64-encode the `.env` file for upload
as the `ENV_FILE_BASE64` GitHub Environment secret:

```powershell
# Prod:
.\scripts\github\b64-prod.ps1
# Beta:
.\scripts\github\b64-beta.ps1
```

Copy the output into the corresponding GitHub Environment secret.

## Database Structure (db-init, governance #7)

DB structure has a single authority: the hand-written DDL under
`deploy/database/ddl/` (`00_baseline.sql` schema, `97_service_role.sql`
least-privilege `arda_svc` role, `98_column_locks.sql` UPDATE column
whitelist). The app container never migrates at startup and the regular
deploy chain never touches schema. All structure operations run through the
`db-init` workflow (Actions -> db-init -> Run workflow):

| action   | effect                                                       |
| -------- | ------------------------------------------------------------ |
| `verify` | read-only audit: live tables/enums vs DDL, service role      |
| `roles`  | apply service role + column locks only (adopt a live schema) |
| `apply`  | create-once full baseline on an EMPTY schema                 |
| `reset`  | DROP schema + full baseline (DESTRUCTIVE)                    |

Gates: `confirm=yes`, `expected_sha` (required for mutating actions, pins the
ref), and environment routing - a `production` run pauses for the required
reviewer, exactly like a deploy. The role password comes from the
environment-level `ARDA_DB_SVC_PASSWORD` secret.

Schema increments: add the column to `prisma/schema.prisma` (client source),
add an idempotent numbered ddl file (`ADD COLUMN IF NOT EXISTS`), extend the
`98_column_locks.sql` whitelist if the column is writable, regenerate
`00_baseline.sql` parity (the `check-data-architecture` guardrail in
quality-gate blocks drift), then run `db-init` with the increment.

Existing stacks created under the old prisma-migrate flow are ADOPTED in
place: run `db-init` `roles` then `verify` (the leftover `_prisma_migrations`
table is ignored by verify). Cutting the app over to the `arda_svc` role is
an operator action: set `DATABASE_URL` in the stack's `etc/.env` to
`postgresql://arda_svc:<ARDA_DB_SVC_PASSWORD>@<stack>-db:5432/vxturebiz_arda_<env>?schema=public`
and restart the app container - beta first, verify, then production.
