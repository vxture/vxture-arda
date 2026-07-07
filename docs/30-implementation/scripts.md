# Arda - Deployment Scripts

---

## Entry Points

Three top-level scripts at `deploy/`:

| Script | Usage | Purpose |
|---|---|---|
| `deploy.sh` | `bash deploy/deploy.sh <cmd>` | Deployment lifecycle dispatcher |
| `ops.sh` | `bash deploy/ops.sh <cmd>` | Runtime operations (start/stop/logs/backup) |
| `server.sh` | `bash deploy/server.sh <cmd>` | Server bootstrap and reset |

All scripts source `deploy/lib/01-env.sh` first, which loads `.env` from
`$PROJECT_ROOT/etc/.env` and sets the standard path variables.

---

## `deploy.sh` - Deployment Lifecycle

```
bash deploy/deploy.sh all              # Full deploy pipeline (used by CI)
bash deploy/deploy.sh all --skip-verify
bash deploy/deploy.sh all --skip-backup
bash deploy/deploy.sh environment      # Validate environment only
bash deploy/deploy.sh directories      # Initialize runtime + data dirs
bash deploy/deploy.sh start            # Pull images and start containers
bash deploy/deploy.sh verify           # Verify deployment
```

CI path: `image-build success -> deploy.sh all -> deploy.sh verify`

The `all` command runs `30-run-full-deployment.sh`, which chains the numbered
scripts in order (see below).

---

## `ops.sh` - Runtime Operations

```
bash deploy/ops.sh status              # Show container status
bash deploy/ops.sh logs [service]      # Tail logs (arda-app or arda-redis)
bash deploy/ops.sh restart [service]   # Restart containers
bash deploy/ops.sh reload              # Pull latest images and restart
bash deploy/ops.sh backup              # Run backup snapshot
```

---

## `server.sh` - Server Bootstrap

```
bash deploy/server.sh bootstrap        # First-time server setup (Docker, user, dirs)
bash deploy/server.sh reset            # Stop all containers and wipe runtime state
```

`reset` is destructive: it stops containers and clears `RUNTIME_DIR`. It does
NOT touch `DATA_DIR` (Redis AOF) or `etc/.env`. Use only when recovering from
a broken state.

---

## Numbered Step Scripts (`deploy/scripts/`)

Step scripts are numbered by their position in the deployment order. Each is
idempotent: safe to re-run without destroying state.

| Script | Step | Description |
|---|---|---|
| `10-bootstrap-server.sh` | bootstrap | Install Docker, create admin user, set firewall rules |
| `11-check-runtime-environment.sh` | environment | Validate .env values and system prerequisites |
| `12-prepare-runtime-directories.sh` | directories | Create `runtime/`, `data/`, `backup/` under `ROOT_DIR` |
| `23-start-docker-services.sh` | start | `docker compose pull` + `docker compose up -d` |
| `24-verify-deployment.sh` | verify | Health-check containers and `/api/health` endpoint |
| `30-run-full-deployment.sh` | all | Orchestrator: chains 11 -> 12 -> backup -> 23 -> cron -> backup -> 24 |
| `55-backup-runtime-state.sh` | backup | Snapshot Redis AOF to `BACKUP_DIR` |
| `60-reset-runtime-services.sh` | reset | Stop containers; clear `RUNTIME_DIR` |

`30-run-full-deployment.sh` is the canonical deploy path:

```
11 - check environment
12 - prepare directories
55 - pre-deployment backup
23 - pull images + start containers
cron - install daily backup cron
55 - post-deployment backup
24 - verify deployment
```

The backup steps run both before (preserve state before restart) and after
(confirm the running state is good). The cron job runs `ops.sh backup` at 02:00
daily and logs to `/var/log/${PROJECT_NAME}-backup.log`.

---

## Shared Libraries (`deploy/lib/`)

| File | Purpose |
|---|---|
| `00-log.sh` | Logging: `log_info`, `log_ok`, `log_warn`, `log_error`, `log_step`, `log_banner` |
| `01-env.sh` | Load `.env`; validate and export `ROOT_DIR`, `REPO_DIR`, `RUNTIME_DIR`, `DATA_DIR`, `BACKUP_DIR`, `PROJECT_NAME`, `NODE_NAME`, `APEX_DOMAIN`, `APP_PUBLISH_PORT` |

`01-env.sh` searches for `.env` at `$PROJECT_ROOT/etc/.env`. `PROJECT_ROOT` is
resolved as two levels up from the `lib/` directory: the full deploy tree is
under `<root>/deploy/` so `lib/../..` == `<root>`.

---

## Quality Gate Checks (`scripts/checks/`)

These run in CI as part of `quality-gate`. They can also be run locally.

| Script | Purpose | CI step |
|---|---|---|
| `06-check-deploy-contracts.py` | Deployment invariants: one image, two stacks, no shared state, ASCII-only in contract paths | `static-checks` |
| `09-check-ds-usage.py --strict` | Enforce `@vxture/design-system` usage; reject raw ad-hoc styling | `static-checks` |
| `check_yaml.py` | Validate YAML files | `static-checks` |
| `classify_changes.py` | Path -> image/deployable classifier; used by `release.yml` `detect` job | release detect step |
| `filter_logs.jq` | jq filter for deployment log parsing (local ops helper) | not in CI |

---

## CI/CD Workflow Files (`.github/workflows/`)

| File | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PR to develop/main; push to develop | `quality-gate` check (static checks, portal build, secret scan) |
| `release.yml` | Push to develop or main | detect -> docker-build -> deploy |
| `promote.yml` | Manual (`gh workflow run`) | Validated fast-forward develop -> main |
| `build.yml` | Called by release.yml | Build and push `arda-app` image to GHCR + Aliyun ACR |

See [`50-operations/github-actions.md`](../50-operations/github-actions.md) for full
CI/CD design and the promotion contract.
