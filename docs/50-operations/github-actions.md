# Arda - CI/CD and GitHub Actions

---

## Workflow Overview

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| CI | `ci.yml` | PR to develop/main; push to develop | `quality-gate` status check |
| Release | `release.yml` | Push to develop or main | detect -> build -> deploy |
| Promote | `promote.yml` | Manual (`gh workflow run`) | Validated fast-forward develop -> main |
| Build | `build.yml` | Called by release.yml | Build and push `arda-app` image |

---

## `ci.yml` - Quality Gate

Runs on PRs to `develop` and `main` (guard), and on pushes to `develop`. Does
NOT deploy.

Three parallel jobs, then a final aggregator:

### `static-checks`

- `git diff --check` (no trailing whitespace)
- `bash -n` syntax check for all `.sh` scripts in `deploy/` and `scripts/`
- `python -m compileall` for `deploy/`, `scripts/`, and `services/` (if present)
- `06-check-deploy-contracts.py` - deployment invariants + ASCII-only paths
- `09-check-ds-usage.py --strict` - `@vxture/design-system` enforcement
- `docker compose --env-file .env.example config --quiet` - compose validation

### `portal-build`

- `npm ci` (workspace install from `portals/`, with co-located `.npmrc` workaround)
- `npm run type-check -w ./app` (TypeScript type check)
- `npm run build -w ./app` (Next.js production build)
- Next.js build cache keyed by `package-lock.json` hash + SHA for incremental builds

### `secret-scan`

- `gitleaks dir . --config .gitleaks.toml --redact` (version 8.21.2, pinned)
- Allowlist of known-safe placeholders in `.gitleaks.toml`

### `quality-gate` (aggregator)

Required status check for branch rulesets. Succeeds only when all three upstream
jobs pass. Branch ruleset names this check exactly `quality-gate`; the job is
also named `quality-gate`.

---

## `release.yml` - Build and Deploy

Triggers on push to `develop` (-> beta) or `main` (-> prod). Manual
`workflow_dispatch` allows overriding the environment for debugging.

Concurrency: serialized per branch. `cancel-in-progress: false` means an
in-flight deploy is never cancelled.

### `detect` Job

Classifies which paths changed and determines whether a deploy is needed:

1. Maps branch to environment: `develop` -> `beta`, `main` -> `production`
2. Finds the last successful release SHA for this branch
3. Calls `classify_changes.py` to determine `deployable` and `build_images`
4. Fail-open: if the compare API fails or no prior base exists, deploy everything

### `call-build` Job (calls `build.yml`)

Runs only if `deployable == true`. Builds and pushes `arda-app` image to:
- GHCR: `ghcr.io/vxture/arda-app:sha-<short-sha>`
- Aliyun ACR: fallback mirror

### `deploy` Job

Runs only if `deployable == true`, after `call-build` succeeds. Targets the
GitHub Environment matching the detected environment (`beta` or `production`).
Each environment carries its own secrets.

Deploy sequence:
1. Join tailnet (ephemeral tailscale node for the CI runner)
2. Wait for `DEPLOY_HOST` to be reachable (ping step)
3. Bootstrap `.env` if absent (`ENV_FILE_BASE64` secret -> base64 decode -> `etc/.env`)
4. rsync `deploy/`, `configs/`, `docker-compose.yml` to `DEPLOY_REPO_DIR`
5. Stamp `VERSION` with `$GITHUB_SHA`
6. SSH: `bash deploy.sh all` + `bash deploy.sh verify`

---

## `promote.yml` - Prod Promotion

Manual only. Validates all preconditions before touching `main`.

```bash
gh workflow run promote.yml \
  -f target=main \
  -f expected_sha=<SHA of develop HEAD> \
  -f release_confirmed=true \
  -f release_note="<summary>"
```

Validation gates:
1. `target == main` (no accidental branch)
2. `release_confirmed == true` (explicit operator intent)
3. `release_note` is non-empty
4. `expected_sha == origin/develop HEAD` (no surprise commits since you checked)
5. `main` is an ancestor of `develop` (linear history; no divergence)
6. `develop` `quality-gate` == success (green before promoting)

Then fast-forwards `main` to `develop` HEAD. `PROMOTION_TOKEN` (a PAT with
`repo` write scope) is used for the push so the push triggers `release.yml` on
`main` automatically.

`promote.yml` reads itself from `main`, so workflow self-changes take effect one
promotion late.

---

## GitHub Environments and Secrets

Two GitHub Environments: `beta` and `production`. Each carries:

| Secret | Purpose |
|---|---|
| `DEPLOY_HOST` | Tailscale hostname or IP of ARDA_DEPLOY_HOST |
| `DEPLOY_USER` | SSH user (e.g., `stone`) |
| `DEPLOY_SSH_KEY` | SSH private key for the deploy user |
| `DEPLOY_PORT` | SSH port (default 22) |
| `DEPLOY_KNOWN_HOSTS` | SSH host key (optional; if absent, `ssh-keyscan` is used) |
| `DEPLOY_REPO_DIR` | Override for the rsync target directory on the server |
| `ENV_FILE_BASE64` | Base64-encoded `.env` for bootstrap deploy |
| `TAILSCALE_OAUTH_CLIENT_ID` | Tailscale OAuth client ID for CI ephemeral node |
| `TAILSCALE_OAUTH_CLIENT_SECRET` | Tailscale OAuth secret |
| `ALIYUN_ACR_REGISTRY` | Aliyun ACR registry URL (pull-through fallback) |
| `ALIYUN_ACR_NAMESPACE` | Aliyun ACR namespace |
| `ALIYUN_ACR_USERNAME` | Aliyun ACR username |
| `ALIYUN_ACR_PASSWORD` | Aliyun ACR password |

Repository-level secrets:
| Secret | Purpose |
|---|---|
| `NODE_AUTH_TOKEN` | GitHub Packages read token for `@vxture` scope (npm install + docker build) |
| `PROMOTION_TOKEN` | PAT with repo write for promote.yml push to main |

Repository-level variable:
| Variable | Purpose |
|---|---|
| `TAILSCALE_OAUTH_CLIENT_TAG` | Tag for the ephemeral tailscale node (e.g., `tag:ci`) |

---

## Common CI Operations

```bash
# Re-run failed jobs (e.g., after docker-build infra flake):
gh run rerun <run-id> --failed

# List recent release runs:
gh run list --workflow release.yml --limit 10

# Watch a running workflow:
gh run watch <run-id>

# Trigger a manual release (debugging only):
gh workflow run release.yml

# Trigger a prod promotion:
gh workflow run promote.yml \
  -f target=main \
  -f expected_sha=$(git rev-parse origin/develop) \
  -f release_confirmed=true \
  -f release_note="deploy: <describe what changed>"
```

---

## First-Time CI Enablement

When setting up a new environment:

1. Create the GitHub Environment (`beta` or `production`) in repo Settings
2. Add all secrets listed above to the environment
3. Run `scripts/github/b64-prod.ps1` (or `b64-beta.ps1`) to generate
   `ENV_FILE_BASE64` from the local `.env`
4. Add the Tailscale OAuth client tag to `TAILSCALE_OAUTH_CLIENT_TAG` variable
5. Trigger the first deploy via `workflow_dispatch` on `release.yml` with the
   correct `explicit_environment` input
6. Verify with `bash deploy/deploy.sh verify` on the server
