# Arda - Repository Layout

---

## Top-Level Structure

```
vxture-Arda/
|-- CLAUDE.md                     # Repository working agreement (branch model, CI, contracts)
|-- README.md                     # Quick start, architecture, deploy overview
|-- .env.example                  # Authoritative config template; the real .env is git-ignored
|-- docker-compose.yml            # Two-service stack (arda-app + arda-redis)
|-- .gitleaks.toml                # Secret detection rules for CI
|-- .editorconfig
|-- .gitattributes
|-- .gitignore
|-- .npmrc                        # GitHub Packages auth for @vxture scope
|-- .github/
|   `-- workflows/
|       |-- ci.yml                # quality-gate (static checks, portal build, secret scan)
|       |-- release.yml           # detect + docker-build + deploy (develop->beta, main->prod)
|       |-- promote.yml           # Manual fast-forward develop->main with validation gates
|       `-- build.yml             # Reusable docker build workflow (called by release.yml)
|-- configs/
|   `-- edge/
|       |-- README.md             # Sync procedure for edge vhost installation
|       |-- arda.vxture.com.conf  # Prod vhost source artifact (operator installs on edge host)
|       `-- beta-arda.vxture.com.conf
|-- deploy/
|   |-- deploy.sh                 # Unified deploy dispatcher (entry: `bash deploy.sh all`)
|   |-- ops.sh                    # Runtime operations (start/stop/restart/logs/backup)
|   |-- server.sh                 # Server bootstrap and reset
|   |-- env/
|   |   |-- prod.env              # Prod environment defaults (reference only)
|   |   `-- beta.env              # Beta environment defaults (reference only)
|   |-- lib/
|   |   |-- 00-log.sh             # Logging utilities
|   |   `-- 01-env.sh             # Environment loading; sets PROJECT_ROOT, DATA_DIR, etc.
|   `-- scripts/
|       |-- 10-bootstrap-server.sh
|       |-- 11-check-runtime-environment.sh
|       |-- 12-prepare-runtime-directories.sh
|       |-- 23-start-docker-services.sh
|       |-- 24-verify-deployment.sh
|       |-- 30-run-full-deployment.sh
|       |-- 55-backup-runtime-state.sh
|       `-- 60-reset-runtime-services.sh
|-- docs/
|   |-- agent.md                  # AI entry point (this repo's master doc index)
|   |-- 10-specs/
|   |-- 20-design/
|   |-- 30-implementation/
|   |-- 40-deployment/
|   |-- 50-operations/
|   `-- 90-memory/
|-- portals/                      # npm workspace root (Node.js 22+)
|   |-- package.json              # Workspace: app, packages/shared
|   |-- package-lock.json
|   |-- .npmrc                    # GitHub Packages auth (copied per CI workaround)
|   |-- .dockerignore
|   |-- app/                      # @arda/app - the Next.js application
|   `-- packages/
|       `-- shared/               # @arda/shared - cross-portal shared utilities
`-- scripts/
    |-- checks/
    |   |-- 06-check-deploy-contracts.py  # Deployment invariants + ASCII-only check
    |   |-- 09-check-ds-usage.py          # @vxture/design-system enforcement (strict)
    |   |-- check_yaml.py                 # YAML validation
    |   |-- classify_changes.py           # Path -> image/deployable classifier for CI
    |   `-- filter_logs.jq                # jq filter for deployment log parsing
    `-- github/
        |-- b64-beta.ps1                  # Helper: base64-encode beta .env for CI secret
        `-- b64-prod.ps1                  # Helper: base64-encode prod .env for CI secret
```

---

## Portal: `@arda/app` (`portals/app/`)

The Next.js application. All source under `portals/app/app/`:

```
app/
|-- (app)/                        # Auth-gated routes (requires active session)
|   |-- layout.tsx                # Gated layout (session + entitlement check)
|   |-- data-assets/overview/     # Default landing surface
|   |-- integration/              # Integration configuration surface
|   |-- management/               # Management tools surface
|   |-- governance/               # Governance workflows surface
|   `-- services/                 # Service management surface
|-- api/
|   |-- health/                   # GET /api/health -> { status: "ok" }
|   `-- entitlement/              # GET /api/entitlement -> current entitlement JSON
|-- auth/
|   |-- lib/                      # OIDC RP implementation
|   |   |-- config.ts             # OidcConfig builder from env vars
|   |   |-- oidc.ts               # Token exchange, refresh, session creation
|   |   |-- pkce.ts               # PKCE code_verifier / code_challenge generation
|   |   |-- session.ts            # Session read/write middleware
|   |   |-- session-store.ts      # Redis key operations (rpsess, rptok, authreq, sid)
|   |   |-- claims.ts             # ArdaClaim extraction from access token
|   |   |-- cookie.ts             # Session cookie read/write
|   |   `-- return-to.ts          # Return-to URL preservation across auth redirects
|   |-- login/                    # GET /auth/login -> PKCE + authorize redirect
|   |-- callback/                 # GET /auth/callback -> code exchange + session create
|   |-- logout/                   # GET /auth/logout -> session clear + end_session
|   |-- session/                  # GET /auth/session -> current session JSON
|   |-- backchannel-logout/       # POST /auth/backchannel-logout -> JWT verify + invalidate
|   `-- dev-login/                # POST /auth/dev-login (non-prod only: mock session)
|-- entitlement/
|   |-- types.ts                  # ArdaState, Tier, ArdaClaim, Subscription, tierMeets()
|   |-- resolver.ts               # EntitlementResolver interface + MockEntitlementResolver
|   |-- gate.tsx                  # Server component: checks subscription.status
|   |-- env-guard.tsx             # Client component: EnvGuard cross-stack redirect
|   `-- config.ts                 # Entitlement config from env
|-- ui/                           # Shell UI components (nav, layout chrome)
|-- globals.css                   # Global styles
|-- layout.tsx                    # Root layout (providers, metadata)
|-- page.tsx                      # Root page (redirect to login or landing)
`-- providers.tsx                 # React context providers
```

---

## Package: `@arda/shared` (`portals/packages/shared/`)

Shared utilities re-exported and extended from `@vxture/shared`:

| Export | File | Purpose |
|---|---|---|
| brand | `brand.ts` | Brand tokens and asset paths |
| user | `user.ts` | User profile types |
| health | `health.ts` | Health check utilities |
| i18n | `i18n.tsx` | Internationalization provider |
| locale-provider | `locale-provider.tsx` | Locale context |
| locales | `locales.ts` | Supported locales (en-US, zh-CN) |
| preference-sync | `preference-sync.tsx` | User preference sync |
| preferences | `preferences.ts` | Preference types and defaults |
| providers | `providers.tsx` | Combined provider tree |
| version | `version.ts` | App version |

---

## Config Paths on the Server

| Path | Content | Notes |
|---|---|---|
| `<ROOT_DIR>/etc/.env` | Runtime config | Persistent; CI never overwrites |
| `<ROOT_DIR>/deploy/` | Rsync target | Disposable; recreated on each release |
| `<ROOT_DIR>/data/redis/` | Redis AOF data | Backed up by `55-backup-runtime-state.sh` |
| `<ROOT_DIR>/backup/` | Backup archives | Kept by operator |

---

## Source-of-Truth Index

| Topic | Authoritative location |
|---|---|
| Branch model, CI, contracts | `CLAUDE.md` |
| Environment variables | `.env.example` |
| Docker services | `docker-compose.yml` |
| Edge vhost configs | `configs/edge/*.conf` |
| Entitlement types | `portals/app/app/entitlement/types.ts` |
| OIDC config | `portals/app/app/auth/lib/config.ts` |
| Deployment scripts | `deploy/scripts/` |
| Quality gate checks | `scripts/checks/` |
| Design docs | `docs/` |
