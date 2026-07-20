# Arda - Architecture

---

## Traffic Flow

```
Browser
  |  https (:443, *.vxture.com wildcard cert)
  v
EDGE HOST  (shared public edge: nginx + TLS termination, NOT owned by Arda)
  |  http over tailscale (WireGuard-encrypted)
  |  -> ARDA_DEPLOY_HOST:APP_PUBLISH_PORT
  v
ARDA_DEPLOY_HOST  (private compute, tailnet-only, no public IP)
  |
  arda-app (Next.js, internal :3230, published on APP_PUBLISH_PORT)
    |- /                    -> Next.js pages (redirect to default landing if authed)
    |- /auth/*              -> OIDC RP routes (login, callback, logout, session)
    |- /(app)/*             -> Auth-gated capability surfaces (dashboard, catalog, etc.)
    |- /api/health          -> Healthcheck (no auth required)
    |- /api/entitlement     -> Entitlement check API (EntitlementGate reads this)
    `- OIDC RP              -> accounts.vxture.com (Authorization Code + PKCE)
  |
  arda-redis (session store, container-internal only)
    |- authreq:<state>      -> PKCE handshake (in-flight OIDC request)
    |- rpsess:<id>          -> RP session (identity claims, tier)
    |- rptok:<id>           -> Token bundle (access + refresh, server-side only)
    `- sid:<sid>            -> Back-channel logout index (OIDC sid -> RP session)
  |
  arda-db (Postgres 16, domain/business data, container-internal only)
    `- see docs/30-design/arda-data-100-architecture.md for the full schema
```

> **Note (2026-07-03):** the domain persistence layer (`arda-db`, Postgres 16) was
> added after this doc was first written; the diagram above and the sections
> below are now updated to include it. Full schema/table design lives in the
> [`arda-data-*`](arda-data-000-index.md) series, not here - this file stays at
> the topology/runtime level.

The edge vhost (contributed as source artifacts in `configs/edge/`) proxies
`APEX_DOMAIN` to `ARDA_DEPLOY_HOST:APP_PUBLISH_PORT` over tailscale. There is no
nginx on ARDA_DEPLOY_HOST; the app is published directly as plain HTTP on the
tailnet port.

---

## OIDC Flow

```
1. User hits protected route -> middleware redirects to /auth/login
2. /auth/login generates PKCE (code_verifier + code_challenge),
   stores authreq in Redis, redirects to accounts.vxture.com/oidc/authorize
3. User authenticates at accounts.vxture.com
4. IdP redirects to /auth/callback?code=...&state=...
5. /auth/callback verifies state, retrieves authreq from Redis,
   exchanges code for tokens (Authorization Code + PKCE)
6. Tokens are stored in Redis (rptok:); session is created (rpsess:)
7. Opaque session cookie (vx_rp_session) is set on the browser
8. User is redirected to return-to URL or DEFAULT_LANDING

Token refresh:
  - On each request, session middleware checks if the access token
    is nearing expiry; if so, exchanges the refresh token silently.
  - The browser is unaware of the refresh; the session cookie is unchanged.

Back-channel logout:
  - IdP POST /auth/backchannel-logout with a logout_token JWT
  - App verifies JWT, extracts sid, looks up sid index in Redis
  - Invalidates the rpsess: and rptok: keys
  - Browser cookie is orphaned; next request is rejected
```

---

## Container Topology

```
Docker network: arda-net (bridge)

Host ports (prod stack):
  3230 -> arda-app (tailnet interface only; host firewall restricts to tailscale)

Host ports (beta stack, same host):
  3231 -> arda-beta-app (tailnet interface only)

Containers (prod):
  arda-app       (Next.js OIDC RP / app-BFF)
  arda-redis     (server-side session store)
  arda-db        (Postgres 16, domain business data)

Containers (beta, separate compose project on same host):
  arda-beta-app
  arda-beta-redis
  arda-beta-db

The two stacks never share a network, a container, a Redis instance, a
Postgres instance, or a data directory. PROJECT_NAME drives both the Docker
compose project name and the container_name prefix, ensuring zero collision.
```

---

## Two-Environment, One Compose File

The same `docker-compose.yml` deploys prod and beta. The environment is
determined entirely by which `.env` is loaded:

| Variable | Prod | Beta |
|---|---|---|
| `PROJECT_NAME` | `arda` | `arda-beta` |
| `APP_PUBLISH_PORT` | `3230` | `3231` |
| `OIDC_CLIENT_ID` | `arda` | `arda-beta` |
| `ROOT_DIR` | `/srv/md0/arda` | `/srv/md1/arda-beta` |
| `DATA_DIR` | `/srv/md0/arda/data` | `/srv/md1/arda-beta/data` |
| `APEX_DOMAIN` | `arda.vxture.com` | `beta-arda.vxture.com` |
| `REDIS_URL` | `redis://arda-redis:6379` | `redis://arda-beta-redis:6379` |
| `DATABASE_URL` | `postgresql://arda_svc:...@arda-db:5432/vxturebiz_arda_prod?schema=public` | `postgresql://arda_svc:...@arda-beta-db:5432/vxturebiz_arda_beta?schema=public` |
| `MOCK_STATE` | `subscribed` | `trial` |
| `NEXT_PUBLIC_APP_ENV` | `prod` | `beta` |

The `REDIS_URL` hostname (`${PROJECT_NAME}-redis`) and the `DATABASE_URL`
hostname (`${PROJECT_NAME}-db`) each resolve to the correct Redis/Postgres
container on that stack's network, so the app always reaches its own
dependencies. See [`data-100`](arda-data-100-architecture.md) §3 for the full
runtime topology and [`data-300`](arda-data-300-migration.md) §3 for the
deploy-time service table.

---

## Identity Shared, Session Data Isolated

This is the most important architectural invariant to understand:

**Identity (shared):** Both stacks are OIDC RPs against the same
`accounts.vxture.com` and authenticate the same user directory. The same user
record and the same `arda` claim (carrying `state` and `tier`) apply to both
environments. A user's subscription state is authoritative from
accounts.vxture.com - not from any env var in this repo. The OIDC *client*,
however, is per-stack (`arda` for prod, `arda-beta` for beta): two distinct app
registrations over one shared user directory, for token-audience and
back-channel-logout isolation. See `30-design/decisions/00-index.md`.

**Session data (isolated):** Each stack runs its own Redis instance. Session
cookies are host-only, scoped to the exact domain (`arda.vxture.com` vs
`beta-arda.vxture.com`). A login on prod creates a session in `arda-redis`; a
login on beta creates a separate session in `arda-beta-redis`. These sessions
are never shared or visible across stacks.

**Practical consequence:** The same user can be logged in on both stacks
simultaneously with two independent sessions. EnvGuard redirects users to the
correct stack based on their `NEXT_PUBLIC_APP_ENV` vs their subscription state,
but it is a UX convenience - it does not prevent dual sessions.

---

## Server Directory Structure

No git clone on the server. The CI `deploy` job rsyncs only the deploy subset
from the runner checkout. The layout under each stack root is:

```
/srv/md0/arda/                     (prod stack root = ROOT_DIR)
|-- etc/
|   `-- .env                       # Persistent operator config; CI never overwrites
|-- deploy/                        # Disposable: rsynced each release (= REPO_DIR)
|   |-- deploy.sh ops.sh           # Unified deploy / ops dispatcher
|   |-- lib/                       # Shared libs (00-log.sh, 01-env.sh)
|   |-- scripts/                   # Numbered deploy step scripts
|   |-- configs/                   # Edge vhost source artifacts (read-only reference)
|   |-- docker-compose.yml
|   `-- VERSION                    # Deployed commit SHA
|-- runtime/                       # RUNTIME_DIR: regenerable at any time
|-- data/                          # DATA_DIR: persistent state
|   |-- redis/                     # Redis AOF data (appendonly)
|   `-- postgres/                  # Postgres data directory (arda-db)
`-- backup/                        # BACKUP_DIR

/srv/md1/arda-beta/                (beta stack root, same host, md1 RAID array)
  (identical structure)
```

`etc/.env` is the only file that persists across redeploys. All other state
under `data/` is either Redis AOF (append-only file) or the Postgres data
directory, both of which survive container restarts and redeploys. The
`deploy/` subtree is disposable and safe to delete; it is recreated on the
next release. Postgres backup coverage is tracked as an open item in
[`data-300`](arda-data-300-migration.md) §5.

---

## Port Allocation

| Port | Visibility | Container | Purpose |
|---|---|---|---|
| 3230 (prod) | Tailnet only | arda-app | App HTTP, proxied by edge over tailscale |
| 3231 (beta) | Tailnet only | arda-beta-app | App HTTP, proxied by edge over tailscale |
| 6379 | Container-internal | arda-redis | Session store; never published to host |
| 5432 | Container-internal | arda-db | Domain business data (Postgres 16); never published to host |

---

## Design System and Portals

Arda is an npm workspace rooted at `portals/` with two members:

| Package | Path | Role |
|---|---|---|
| `@arda/app` | `portals/app/` | The Next.js application |
| `@arda/shared` | `portals/packages/shared/` | Cross-portal shared utilities |

External packages consumed from GitHub Packages (`@vxture` scope):

| Package | Version | Role |
|---|---|---|
| `@vxture/design-system` | ^1.3.2 | Authoritative source for all UI primitives |
| `@vxture/shared` | ^1.2.2 | Cross-product shared utilities (brand, i18n, preferences) |

`@arda/shared` re-exports and extends `@vxture/shared` with Arda-specific
utilities. The design-system constraint is enforced in CI by
`scripts/checks/09-check-ds-usage.py --strict`.
