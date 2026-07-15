# Arda - CI/CD and GitHub Actions

---

## Workflow Overview

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| CI | `ci.yml` | PR to main; push to main | `quality-gate` status check |
| Deploy | `deploy.yml` | Push of a `beta-*` or `v*.*.*` tag | detect environment -> build -> deploy |
| Build | `build.yml` | Called by deploy.yml (`workflow_call`) | Build and push `arda-app` image |

There is no branch-promotion workflow. Deploys are triggered only by pushing a
release tag - merging to `main` never deploys anything by itself.

---

## `ci.yml` - Quality Gate

Runs on PRs to `main` only - no `push:main` trigger. main only advances via
squash-merged, up-to-date-with-base PRs, so the PR's own `pull_request` run
already validates exactly what lands on `main`; a push-triggered rerun would
just redo identical work. (The one gap: an admin using their ruleset bypass to
push `main` directly without a PR gets no CI validation - accepted tradeoff.)
Does NOT deploy.

Three parallel jobs, then a final aggregator:

### `static-checks`

- `git diff --check` (no trailing whitespace)
- `bash -n` syntax check for all `.sh` scripts in `deploy/` and `scripts/`
- `python -m compileall` for `deploy/`, `scripts/`, and `services/` (if present)
- `06-check-deploy-contracts.py` - deployment invariants + ASCII-only paths
- `09-check-ds-usage.py --strict` - `@vxture/design-system` enforcement
- `docker compose --env-file .env.example config --quiet` - compose validation

### `portal-build`

- First step diffs against the PR base to decide if the build is needed at
  all - skipped (job still succeeds) when every changed path is docs/root-meta
  only; fails open (runs the build) if the diff can't be determined
- `npm ci` (workspace install from `portals/`, with co-located `.npmrc` workaround)
- `npm run type-check -w ./app` (TypeScript type check)
- `npm run build -w ./app` (Next.js production build)
- Next.js build cache keyed by `package-lock.json` hash + SHA for incremental builds

### `secret-scan`

- `gitleaks dir . --config .gitleaks.toml --redact` (version 8.21.2, pinned),
  binary cached across runs by version
- Allowlist of known-safe placeholders in `.gitleaks.toml`

### `quality-gate` (aggregator)

Required status check for the `main` branch ruleset. Succeeds only when all
three upstream jobs pass (a docs-only-skipped `portal-build` still counts as
passing - only its internal steps are conditionally skipped, the job itself
always completes). Does not run on a tag push - cutting a release tag ships
whatever is already at that commit on `main`, it does not re-verify the gate.

---

## `deploy.yml` - Build and Deploy (tag-triggered)

Triggers only on pushing a tag matching `beta-*` (-> beta) or `v*.*.*` (->
production). Manual `workflow_dispatch` allows overriding the environment for
debugging without cutting a real tag.

Concurrency: serialized per tag ref. `cancel-in-progress: false` means an
in-flight deploy is never cancelled. Keying on the ref keeps beta and
production deploys in separate queues.

### `detect` Job

Routes the pushed tag to a GitHub Environment - `beta-*` -> `beta`, `v*.*.*` ->
`production`. Any other ref fails the job (should be unreachable given the
trigger filter). No path-based change classification: a tag push is already a
deliberate release action, so the job always proceeds to build+deploy.

### `call-build` Job (calls `build.yml` via `workflow_call`)

Builds and pushes the `arda-app` image to:
- GHCR: `ghcr.io/vxture/arda-app:sha-<short-sha>` and `:<tag-name>`
- Aliyun ACR: same two tags, fallback mirror

Skips the actual build (retags the existing digest instead) if this exact
commit was already built and pushed under an earlier tag - e.g. a `v*.*.*` cut
at a commit a prior `beta-*` tag already validated.

Because this is a `workflow_call` inside the same workflow run (not a second,
independently tag-triggered workflow), the `deploy` job's `needs: call-build`
guarantees the build has finished before deploy starts - no wait-for-build
polling step needed.

### `deploy` Job

Runs after `call-build` succeeds. Targets the GitHub Environment matching the
detected environment (`beta` or `production`). Each environment carries its own
secrets; `production` additionally requires a human reviewer to approve before
the job proceeds.

Deploy sequence:
1. Join tailnet (ephemeral tailscale node for the CI runner)
2. Wait for `DEPLOY_HOST` to be reachable (ping step)
3. Bootstrap `.env` if absent (`ENV_FILE_BASE64` secret -> base64 decode -> `etc/.env`)
4. rsync `deploy/`, `configs/`, `docker-compose.yml` to `DEPLOY_REPO_DIR`
5. Stamp `VERSION` with `$GITHUB_SHA`
6. SSH: `bash deploy.sh all` + `bash deploy.sh verify`

Deploy pulls by the immutable `sha-<short>` tag (not the release tag name
directly) - this sidesteps any need for exact/unstripped tag-name matching on
the deploy side.

---

## GitHub Environments, Secrets, and Variables

Two GitHub Environments: `beta` and `production`.

`production` has a required-reviewer protection rule (stonesmoker) and a
deployment tag policy restricted to `v*`. `beta` has a deployment tag policy
restricted to `beta-*` and no reviewer gate.

Each environment carries:

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
| `ALIYUN_ACR_USERNAME` | Aliyun ACR username |
| `ALIYUN_ACR_PASSWORD` | Aliyun ACR password |

`ALIYUN_ACR_REGISTRY` and `ALIYUN_ACR_NAMESPACE` are NOT secrets - they are
public identifiers (registry hostname, image namespace), classified as
`vars.*` per the org-wide secret/variable standard. `ALIYUN_ACR_REGISTRY` is an
org-level variable (shared across vxture-platform/arda/umbra, since it is the
same Aliyun account/region for all of them). `ALIYUN_ACR_NAMESPACE` is a
repo-level variable - each product line has its own ACR namespace (arda uses
`vx-foundation`) so images from different products don't collide.
`ALIYUN_ACR_USERNAME`/`PASSWORD` remain credentials and stay as org-level
secrets.

Repository-level secrets:
| Secret | Purpose |
|---|---|
| `NODE_AUTH_TOKEN` | GitHub Packages read token for `@vxture` scope (npm install + docker build) |

Repository-level variables:
| Variable | Purpose |
|---|---|
| `TAILSCALE_OAUTH_CLIENT_TAG` | Tag for the ephemeral tailscale node (e.g., `tag:ci`) |
| `ALIYUN_ACR_NAMESPACE` | Aliyun ACR namespace for this product's images |

Org-level variable: `ALIYUN_ACR_REGISTRY` (Aliyun ACR registry hostname, pull-through fallback, shared across repos).

---

## Common CI Operations

```bash
# Re-run failed jobs (e.g., after docker-build infra flake):
gh run rerun <run-id> --failed

# List recent deploy runs:
gh run list --workflow deploy.yml --limit 10

# Watch a running workflow:
gh run watch <run-id>

# Cut a beta release:
git tag beta-$(date +%Y%m%d).1 && git push origin beta-$(date +%Y%m%d).1

# Cut a production release (then approve the pending deployment request in
# the production GitHub Environment):
git tag vX.Y.Z && git push origin vX.Y.Z

# Trigger a manual deploy (debugging only, no tag involved):
gh workflow run deploy.yml -f explicit_environment=beta
```

---

## First-Time CI Enablement

When setting up a new environment:

1. Create the GitHub Environment (`beta` or `production`) in repo Settings
2. Add all secrets listed above to the environment; for `production`, add the
   required-reviewer protection rule and restrict deployment tags to `v*`; for
   `beta`, restrict deployment tags to `beta-*`
3. Run `scripts/github/b64-prod.ps1` (or `b64-beta.ps1`) to generate
   `ENV_FILE_BASE64` from the local `.env`
4. Add the Tailscale OAuth client tag to `TAILSCALE_OAUTH_CLIENT_TAG` variable
5. Trigger the first deploy via `workflow_dispatch` on `deploy.yml` with the
   correct `explicit_environment` input, or push the matching tag directly
6. Verify with `bash deploy/deploy.sh verify` on the server
