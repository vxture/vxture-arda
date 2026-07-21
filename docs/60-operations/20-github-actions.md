# Arda - CI/CD and GitHub Actions

---

## Workflow Overview

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| CI | `ci.yml` | PR to main | `quality-gate` + `audit` status checks |
| Deploy | `deploy.yml` | Push of a `beta-*` or `v*.*.*` tag | detect environment -> build -> deploy |
| Build | `build.yml` | Called by deploy.yml (`workflow_call`) | Build, push, and scan the `arda-app` image |
| CodeQL | `codeql.yml` | PR/push to main; weekly schedule | SAST on the TS/JS source |
| Rollback | `rollback.yml` | Manual (`workflow_dispatch`) | Re-point a stack at a previously built image, no rebuild |
| Seed demo data | `seed-demo-data.yml` | Manual (`workflow_dispatch`) | Load demo/sample catalog data into a workspace |

There is no branch-promotion workflow. Deploys are triggered only by pushing a
release tag - merging to `main` never deploys anything by itself.

`.github/actions/tailnet-ssh-connect` is a composite action (not a standalone
workflow) shared by `deploy.yml`, `rollback.yml`, and `seed-demo-data.yml` -
it joins the tailnet and prepares the SSH key/known_hosts. Every value is an
input threaded through from the caller's own secrets/vars; the action itself
stores no credentials.

`.github/dependabot.yml` covers the npm workspace (`portals/`, weekly) and
GitHub Actions versions (weekly). `@vxture/*` packages are grouped and
excluded from auto-bump PRs - that scope moves on its own release cadence
from a different repo, bump it deliberately.

---

## `ci.yml` - Quality Gate

Runs on PRs to `main` only - no `push:main` trigger. main only advances via
squash-merged, up-to-date-with-base PRs, so the PR's own `pull_request` run
already validates exactly what lands on `main`; a push-triggered rerun would
just redo identical work. (The one gap: an admin using their ruleset bypass to
push `main` directly without a PR gets no CI validation - accepted tradeoff.)
Does NOT deploy.

Four parallel jobs (`audit` is an independent required check, not part of the
`quality-gate` aggregation - see below), then a final aggregator:

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

### `audit` - SCA (dependency vulnerability) gate

- `osv-scanner scan -L portals/package-lock.json --config .osv-scanner.toml`
  (pinned binary v2.4.0, cached across runs by version)
- Hard-blocks on any new finding - fix (upgrade/override) or explicitly accept
  in `.osv-scanner.toml` with a `[[PackageOverrides]]` entry (name+version
  pinned, never a global `[[IgnoredVulns]]` by GHSA id - that would also
  suppress the same CVE resurfacing in a different, still-vulnerable version)
- Independent required status check on the `main` ruleset, not folded into
  `quality-gate` - a security gate deserves its own visible status
- Matches the org-wide SCA policy
  (vxture-platform `docs/10-standards/140-repo-governance-standard.md` #9)

### `quality-gate` (aggregator)

One of two required status checks for the `main` branch ruleset (the other is
`audit`, above). Succeeds only when `static-checks`/`portal-build`/`secret-scan`
all pass (a docs-only-skipped `portal-build` still counts as passing - only
its internal steps are conditionally skipped, the job itself always
completes). Does not run on a tag push - cutting a release tag ships
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
at a commit a prior `beta-*` tag already validated. The digest-reuse check
verifies BOTH GHCR and ACR already have the tag before skipping - a prior
partial push (one registry ok, the other missing) forces a rebuild instead of
the retag step failing on a missing source ref.

On an actual build (not a retag), also runs a report-only trivy vulnerability
scan of the built image (CRITICAL/HIGH, SARIF uploaded to the repo's Security
> Code scanning tab) - never fails the build/deploy.

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
4. rsync `deploy/`, `configs/`, `docker-compose.yml` to `DEPLOY_DIR`
5. Stamp `VERSION` with `$GITHUB_SHA`
6. SSH: `bash deploy.sh all` + `bash deploy.sh verify`

Deploy pulls by the immutable `sha-<short>` tag (not the release tag name
directly) - this sidesteps any need for exact/unstripped tag-name matching on
the deploy side.

On failure, opens or updates a GitHub issue titled `Deploy failure: <env>`
(zero-config, no webhook needed - beta has no approval gate and no other
built-in signal that a deploy silently failed). On the next successful deploy
to that environment, the matching open issue is commented on and closed
automatically.

---

## `rollback.yml` - Manual Rollback

`workflow_dispatch` only. Inputs: `environment` (`beta`/`production`),
`commit_sha` (a commit that was actually built and pushed by a prior deploy -
find it via the target host's `deploy/VERSION` file or
`gh run list --workflow deploy.yml`).

```bash
gh workflow run rollback.yml -f environment=production -f commit_sha=<sha>
```

Does NOT rebuild and does NOT touch `deploy/`, `configs/`, or
`docker-compose.yml` on the host - only re-points the `arda-app` image tag and
recreates that one container (`deploy.sh start` + `deploy.sh verify`), matching
the manual rollback procedure in
[`50-deployment/10-deployment.md`](../50-deployment/10-deployment.md). Fails fast
with a clear error if the image for that commit was never actually built
(checked via `docker buildx imagetools inspect` before touching the host).
`environment: ${{ inputs.environment }}` means a production rollback pauses
for the same required-reviewer approval as a normal deploy - rollback is not
an emergency bypass of that gate.

Same schema-compatibility caveat as the manual procedure: rolling back past a
breaking DB migration can serve traffic against a schema the older code
doesn't expect - verify compatibility first for anything beyond a
straightforward app-code revert.

---

## `codeql.yml` - Static Application Security Testing

Runs `github/codeql-action` against the `javascript-typescript` source on PRs
to `main`, pushes to `main`, and a weekly schedule (Monday 03:00 UTC - catches
new CodeQL query-pack findings against code that didn't itself change).
Separate concern from `secret-scan` (committed credentials) and the `build.yml`
trivy scan (built image's OS/dependency layers) - this looks for code-level
vulnerability patterns in the app's own source. Free for public repos.

---

## `seed-demo-data.yml` - Load Demo Data

`workflow_dispatch` only. Loads DEMO/SAMPLE catalog data (`portals/app/prisma/seed.sql`)
into a workspace for evaluation/demo purposes - not product or customer data,
not part of the release pipeline. (Renamed from `seed.yml`, which read as
"seed the product's own data.")

```bash
gh workflow run seed-demo-data.yml -f environment=beta -f workspace_id=<id>
```

Get the workspace id by logging into the app and opening `/auth/session`.
Idempotent (re-running upserts). Manual-only by design for now - wiring
"onboard a workspace -> ask if they want demo data -> dispatch this workflow"
automatically would need the provisioning flow
(`portals/app/app/provisioning/`) to call the GitHub API with a token scoped
to `workflow_dispatch`; that's a real feature to design deliberately when
there's an actual onboarding UI to hang it off of, not bolted on here.

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
| `DEPLOY_DIR` | Override for the rsync target directory on the server |
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

# Roll back a stack to a previously built commit (no rebuild):
gh workflow run rollback.yml -f environment=production -f commit_sha=<sha>

# Load demo data into a workspace:
gh workflow run seed-demo-data.yml -f environment=beta -f workspace_id=<id>
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
