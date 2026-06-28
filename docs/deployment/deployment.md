# Arda - Deployment

---

## Overview

Arda deploys to a single private compute host (`ARDA_DEPLOY_HOST`, tailnet-only,
no public IP). Two independent stacks run on that host: prod (`/srv/md0/arda`)
and beta (`/srv/md1/arda-beta`). CI deploys beta automatically on every push to
`develop`; prod deploys only via the manual `promote.yml` fast-forward.

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

### Beta (automatic on push to `develop`):

```
push to develop
  -> release.yml detect (classify changed paths)
  -> release.yml docker-build (build arda-app image, push to GHCR + Aliyun ACR)
  -> release.yml deploy
       - Join tailnet (tailscale github-action)
       - Bootstrap .env if not present
       - rsync deploy subset to ARDA_DEPLOY_HOST:/srv/md1/arda-beta/deploy/
       - SSH: bash deploy.sh all + bash deploy.sh verify
```

### Prod (manual promote):

```
gh workflow run promote.yml \
  -f target=main \
  -f expected_sha=<origin/develop SHA> \
  -f release_confirmed=true \
  -f release_note="<summary>"

  -> promote.yml validates:
       target == main
       release_confirmed == true
       release_note non-empty
       expected_sha == origin/develop HEAD
       main is ancestor of develop
       develop quality-gate == success
  -> fast-forward main to develop HEAD
  -> push triggers release.yml on main (prod environment)
  -> release.yml reuses the same arda-app image (retag by digest if unchanged)
  -> deploys to /srv/md0/arda
```

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
| `OIDC_CLIENT_SECRET` | (provisioned) | (provisioned) |
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
Aliyun ACR: crpi-l3l7g186zpo2if7p.cn-hangzhou.personal.cr.aliyuncs.com/agentos/arda-app:<tag>
```

Image tags:
- `sha-<7-char-short-sha>`: canonical per-commit tag (used by deploy)
- `latest`: floating tag (not used by automated deploys)

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
