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

Two branches map to two environments. `beta` is an ENVIRONMENT, not a branch:
pushing `develop` deploys the beta stack; promoting to `main` deploys prod.

- `main` - production source. Updating `main` == "release approved for prod".
  A push to `main` deploys the prod stack (`arda.vxture.com`, `/srv/md0/arda`).
- `develop` - integration branch. All feature work merges here first. A push to
  `develop` deploys the beta/pre-release stack (`beta-arda.vxture.com`,
  `/srv/md1/arda-beta`).
- `claude-memory` - independent Claude memory versioning line. NOT part of the
  product pipeline; never merge it into `develop`/`main`.

Always branch off `origin/develop`, never off a stale local branch.

## How to make a change (the only path)

1. `git fetch origin && git switch -c <feature> origin/develop`
2. Commit work on the feature branch.
3. Open a PR into `develop`. Direct `git push origin develop` is BLOCKED by
   ruleset (must go through a PR, and the `quality-gate` check must pass).
4. CI `quality-gate` runs on the PR. Squash-merge once green; the branch is
   auto-deleted on merge.
5. The squash-merge push to `develop` fires `release.yml` and deploys the beta
   stack. Once beta is validated, promote `develop` -> `main` via `promote.yml`
   (see below). Do not push `main` directly.

Squash merge only (merge commits and rebase merges are disabled) to keep a
linear history.

## Branch protection (GitHub Rulesets, not legacy protection)

Enforced via repo Rulesets (`gh api repos/vxture/vxture-Arda/rulesets`). Legacy
`branches/*/protection` returns 404 - do not look there.

- `develop` ("Arda develop quality gate"): require PR (0 approvals), require
  `quality-gate` status check (strict / up-to-date with base), block deletion,
  block non-fast-forward, require linear history. A push here deploys beta.
- `main` ("Arda main release gate"): require `quality-gate` status check
  (strict), block deletion, block non-fast-forward, require linear history.
  Deliberately NO pull-request rule - `main` only advances via `promote.yml`'s
  fast-forward push. Adding a PR rule here (without a bypass actor for the
  promotion identity) would block promotion and break releases.

## Promotion

Beta is reached by merging to `develop` (no promotion step - the develop push
deploys beta). Prod is reached by a single manual fast-forward of `develop` ->
`main`, which requires `develop` CI green first and touches no working files:

```
gh workflow run promote.yml -f target=main \
  -f expected_sha=<origin/develop SHA> \
  -f release_confirmed=true \
  -f release_note="<summary>"
```

`promote.yml` validates: target is `main`, `release_confirmed=true`,
`release_note` non-empty, `expected_sha == origin/develop`, `main` is an
ancestor of `develop`, and develop's `quality-gate` == success. Then it
fast-forwards `main` and pushes. `PROMOTION_TOKEN` is configured so this push
re-fires the downstream release/deploy chain.

## CI/CD pipeline

```
feature -> PR to develop -> ci (quality-gate) -> squash-merge to develop
  -> release on develop: detect -> docker-build (arda-app)
       -> deploy beta stack (/srv/md1/arda-beta on ARDA_DEPLOY_HOST)
  -> promote.yml (manual, fast-forward) -> main
       -> release on main: detect -> docker-build (retag-by-digest if unchanged)
       -> deploy prod stack (/srv/md0/arda on ARDA_DEPLOY_HOST)
```

Workflows: `.github/workflows/{ci,promote,release}.yml`. `docker-build` and
`deploy` are jobs inside `release.yml` (gated by a `detect` job that skips
docs-only changes), not standalone workflow files. `release.yml` runs on pushes
to `develop` (-> beta environment) and `main` (-> production environment) and
targets the matching stack via a GitHub Environment. `ci.yml` triggers on PRs to
develop/main and pushes to develop; it does NOT deploy. The same commit-addressed
image (`sha-<short>`) built on develop is retagged by digest for prod after the
`develop` -> `main` fast-forward. Deploy internals live under `deploy/`.

`quality-gate` must pass before any merge or promotion. It runs:
- static script checks (`bash -n`, `python -m compileall`,
  `scripts/checks/06-check-deploy-contracts.py`, `git diff --check`,
  secret-scan via `.gitleaks.toml`)
- portal type-check and production build (`@arda/app`)
- DS-usage check (`scripts/checks/09-check-ds-usage.py`, strict)
- `docker compose --env-file .env.example config` validation

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

Deploy contracts hold the one-image, two-stack reality: the build emits exactly
`arda-app`; prod resolves to `/srv/md0/arda` and beta to `/srv/md1/arda-beta` on
ARDA_DEPLOY_HOST; the two stacks must not share runtime state. TLS and the public
domain live on the shared public edge (wildcard `*.vxture.com`); arda only
contributes the vhost source artifacts in `configs/edge/*.conf` and runs no
on-host TLS or nginx.

## Operational gotchas

- `docker-build` intermittently fails at "Set up Docker Buildx" (infra flake,
  not code). Re-run with `gh run rerun <run-id> --failed`; success re-fires
  deploy.
- `promote.yml` runs the workflow file from `main`, so workflow self-changes
  take effect one promotion late.
- A push to `develop` deploys beta automatically. Do not assume develop is a
  staging-only branch; treat every green develop push as a live beta deploy.
- ARDA_DEPLOY_HOST shares a tailscale segment with the edge host; deploys target ARDA_DEPLOY_HOST
  by its tailscale IP. Prod and beta are separate stacks on the same host -
  never point one stack's `.env` or data dir at the other.
