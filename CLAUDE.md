# Arda Repository Standards

Authoritative working agreement for this repo. The goal is a clean, predictable
branch and deploy flow with no direct human writes to protected branches.

Arda is a single Next.js destination app: an OIDC relying party against
accounts.vxture.com that gates users by subscription tier (free/starter/pro/
business/enterprise) and lands them on a configurable default page. It ships
as one owned image (`arda-app`) into two environments (beta + prod).

Topology is two-host. The shared vxture public edge (edge host) terminates TLS
with the wildcard `*.vxture.com` cert and reverse-proxies over tailscale to
ARDA_DEPLOY_HOST, which is private compute (tailnet-only, no public IP) running
`arda-app` + `arda-redis` + `arda-db` only. arda does NOT own the edge; it contributes the
vhost source artifacts in `configs/edge/*.conf`, which an operator installs into
the vxture project repository. There is no on-host
TLS or nginx in this repo - the app is published on ARDA_DEPLOY_HOST's tailnet
(`APP_PUBLISH_PORT`, prod 3230 / beta 3231) and the edge is the only TLS hop.

## Branch model

Single long-lived branch: `main` (trunk-based). Deploys are NOT tied to merges -
they are triggered only by pushing a release tag, which also selects the
environment:

- `main` - the only integration branch. All feature work merges here via PR.
  Merging to `main` does NOT deploy anything by itself.
- `beta-YYYYMMDD.N` tag - deploys the beta stack (`beta-arda.vxture.com`,
  `/srv/md1/arda-beta`). No approval gate.
- `vX.Y.Z` tag - deploys the prod stack (`arda.vxture.com`, `/srv/md0/arda`).
  Gated by a required reviewer on the `production` GitHub Environment
  (stonesmoker) - the deploy job pauses until approved.
- `claude-memory` - independent Claude memory versioning line. NOT part of the
  product pipeline; never merge it into `main`.

Always branch off `origin/main`, never off a stale local branch.

## How to make a change (the only path)

1. `git fetch origin && git switch -c <feature> origin/main`
2. Commit work on the feature branch.
3. Open a PR into `main`. Direct `git push origin main` is BLOCKED by ruleset
   (must go through a PR, and the `quality-gate` check must pass).
4. CI `quality-gate` runs on the PR. Squash-merge once green; the branch is
   auto-deleted on merge. This does not deploy anything.
5. When ready to release, cut a tag from the commit you want deployed and push
   it - that push is what triggers a deploy:
   - Beta: `git tag beta-$(date +%Y%m%d).1 && git push origin beta-$(date +%Y%m%d).1`
   - Production (after beta is validated): `git tag vX.Y.Z && git push origin vX.Y.Z`,
     then approve the `production` environment's pending deployment request in
     GitHub.

Squash merge only (merge commits and rebase merges are disabled) to keep a
linear history.

## Branch protection (GitHub Rulesets, not legacy protection)

Enforced via repo Rulesets (`gh api repos/vxture/vxture-arda/rulesets`). Legacy
`branches/*/protection` returns 404 - do not look there.

- `main` (single ruleset): require PR (0 approvals - checks gate merges, not
  human review), require `quality-gate`, `build`, `audit` and `gitleaks`
  status checks (strict / up-to-date with base), block deletion, block
  non-fast-forward, require linear history, squash-only merges.
- `production` GitHub Environment: required reviewer (stonesmoker) - every
  `v*.*.*` tag deploy pauses here until approved.
- `beta` GitHub Environment: no reviewer gate - a `beta-*` tag deploys
  immediately once its build finishes.

## CI/CD pipeline

```
feature -> PR to main -> ci (quality-gate) -> squash-merge to main
  (no automatic deploy on merge)

git push origin beta-YYYYMMDD.N
  -> deploy.yml: detect(beta) -> docker-build (arda-app) -> deploy beta stack (/srv/md1/arda-beta)

git push origin vX.Y.Z
  -> deploy.yml: detect(production) -> [pause for required-reviewer approval]
       -> docker-build (retag-by-digest if this commit was already built under
          a prior tag) -> deploy prod stack (/srv/md0/arda)
```

Workflows: `.github/workflows/{ci,build,deploy}.yml`. `deploy.yml` triggers only
on tag push (`beta-*` -> beta, `v*.*.*` -> production) and calls `build.yml` via
`workflow_call` before deploying - build and deploy run in one workflow run, so
build always finishes before deploy starts (no separate wait-for-build polling
needed, unlike a two-independently-tag-triggered-workflows split). `ci.yml`
triggers on PRs to `main` and on `push:main` (org governance #1: the squash
commit that lands on main is a new SHA, so it gets its own gate run); it does
NOT deploy. Every image
build publishes both an immutable `sha-<short>` tag (what deploy actually pulls
by, and what the skip-rebuild-if-unchanged dedup checks across tags) and the
exact release tag name (`beta-YYYYMMDD.N` / `vX.Y.Z`, for human/audit
reference). Deploy internals live under `deploy/`.

Additional workflows: `rollback.yml` (manual, `workflow_dispatch`) re-points a
stack at a previously built `sha-<short>` image without rebuilding - same
production approval gate as a normal deploy. `codeql.yml` runs SAST on the
TypeScript/JavaScript source (PR/push to `main` + weekly schedule).
`seed-demo-data.yml` (manual) loads demo/sample catalog data into a workspace
for evaluation - not product data, not part of the release pipeline.
`build.yml` also runs a report-only trivy vulnerability scan of the built
image (SARIF -> Security tab, never blocks). `deploy.yml`/`seed-demo-data.yml`/
`rollback.yml` share their tailnet-join + SSH-key-prep steps via the
`.github/actions/tailnet-ssh-connect` composite action - it takes every value
as an input from the caller's own secrets/vars, never stores credentials
itself. `.github/dependabot.yml` covers the npm workspace (`@vxture/*` grouped
and excluded from auto-bump - that moves on its own release cadence) and
GitHub Actions versions.

`quality-gate`, `build`, `audit` and `gitleaks` must all pass before any merge
to `main`. None of them runs on a tag push - cutting a release tag ships
whatever is already at that commit on `main`, it does not re-verify the gates.
`quality-gate` aggregates:
- static script checks (`bash -n`, `python -m compileall`,
  `scripts/checks/06-check-deploy-contracts.py`, `git diff --check`)
- `build`: portal type-check and production build (`@arda/app`) - also its
  own required check
- DS-usage check (`scripts/checks/09-check-ds-usage.py`, strict)
- docs numbering guardrail (`scripts/guardrails/check-docs-numbering.mjs`,
  strict): every `.md` under `docs/` must carry a taxonomy number (`NN-`,
  `arda-{sub}-NNN-`, `ADR-NNN`/`TD-NNN`); unnumbered = temporary = blocked
- `docker compose --env-file .env.example config` validation

`audit` is a separate required check: `osv-scanner` (pinned binary) scans
`portals/package-lock.json` for known dependency vulnerabilities, hard-blocking
on any new finding. Exceptions (dev-only/build-time-only transitive deps that
never reach the deployed image) are recorded in `.osv-scanner.toml` with a
reason, per-package-version - never suppressed by removing the check.

`gitleaks` is a separate required check (`.github/workflows/secret-scan.yml`):
pinned gitleaks binary, full-history `detect` scan, rules and allowlist in
`.gitleaks.toml`. It is CI layer 2 of the org's four-layer secret hygiene;
layer 3 is the local pre-commit hook in `.husky/pre-commit` - wire it once per
clone with `git config core.hooksPath .husky` (and install gitleaks locally,
e.g. `scoop install gitleaks`).

## Repository hygiene

- Keep the working tree clean; do not commit local runtime artifacts
  (`.env`, `.env.bak.*`, generated data, certs, caches) - they are git-ignored
  and skipped by contract scans on purpose.
- After a deploy/merge, prune stale remotes: `git fetch --prune`. Local `main`
  may drift; realign with `git reset --hard origin/main`.
- Squash merges make `git branch -d` report merged branches as "not fully
  merged"; use `-D` after confirming the PR is MERGED via `gh pr view`.

## Contract checks - do not break these

`scripts/checks/06-check-deploy-contracts.py` enforces deployment safety
invariants and an ASCII-only rule over source/doc paths (`.github`, `configs`,
`scripts`, `services`, `deploy`, `portals`, `docs`, plus the root meta files:
`.gitignore`, `.editorconfig`, `.gitattributes`, `.npmrc`, `.gitleaks.toml`,
`CLAUDE.md`, `README.md`). In those paths use ASCII only - no em-dashes, smart
quotes, or non-ASCII characters, or `quality-gate` fails.

`scripts/checks/09-check-ds-usage.py` enforces strict design-system usage: app
UI must consume `@vxture/design-system` primitives rather than re-implementing
them. Raw ad-hoc styling that bypasses the DS fails the gate.

`docs/` follows the org docs taxonomy (vxture-platform
`docs/10-standards/070-docs-taxonomy.md`): top-level decades `00-meta` /
`10-standards` / `20-specs` / `30-design` / `40-implementation` /
`50-deployment` / `60-operations` / `70-workplan` / `80-liaison` /
`90-memory`; map in `docs/00-meta/00-index.md`. Numbered = formal, unnumbered
= temporary (delete or number it) - enforced by the docs numbering guardrail
above. ADRs live in `docs/30-design/decisions/` with stable append-only IDs.

Deploy contracts hold the one-image, two-stack reality: the build emits exactly
`arda-app`; prod resolves to `/srv/md0/arda` and beta to `/srv/md1/arda-beta` on
ARDA_DEPLOY_HOST; the two stacks must not share runtime state. TLS and the public
domain live on the shared public edge (wildcard `*.vxture.com`); arda only
contributes the vhost source artifacts in `configs/edge/*.conf` and runs no
on-host TLS or nginx.

## Operational gotchas

- `docker-build` intermittently fails at "Set up Docker Buildx" (infra flake,
  not code). Re-run with `gh run rerun <run-id> --failed`; success re-fires the
  rest of that `deploy.yml` run.
- `docker-build` and `deploy` run inside the same `deploy.yml` workflow run
  (`deploy` job `needs: call-build`, which is `build.yml` invoked via
  `workflow_call`). Do not split them into two independently tag-triggered
  workflows without re-adding a wait-for-build polling step - the single-run
  structure is what guarantees build finishes before deploy starts.
- Pushing a `beta-*` tag deploys beta immediately, with no approval gate.
  Pushing a `v*.*.*` tag deploys production only after stonesmoker approves the
  pending deployment request on the `production` GitHub Environment.
- ARDA_DEPLOY_HOST shares a tailscale segment with the edge host; deploys target ARDA_DEPLOY_HOST
  by its tailscale IP. Prod and beta are separate stacks on the same host -
  never point one stack's `.env` or data dir at the other.
