# Arda - Domains

---

## Public Domains

Arda exposes two public domains, one per environment. Both are served by the
shared public edge using the wildcard `*.vxture.com` TLS certificate. Arda does
not own the edge; it contributes vhost source artifacts in `configs/edge/` that
an operator installs on the edge host.

| Environment | Domain | Tailnet port | Stack root |
|---|---|---|---|
| prod | `arda.vxture.com` | 3230 | `/srv/md0/arda` |
| beta | `beta-arda.vxture.com` | 3231 | `/srv/md1/arda-beta` |

---

## URL Contracts

### Production (`arda.vxture.com`)

| Path | Handler | Notes |
|---|---|---|
| `/` | Next.js page | Redirects to default landing if authenticated |
| `/auth/login` | OIDC RP | Initiates Authorization Code + PKCE flow |
| `/auth/callback` | OIDC RP | Token exchange callback; must match `OIDC_REDIRECT_URI` |
| `/auth/logout` | OIDC RP | Clears session + initiates end_session at IdP |
| `/auth/session` | Route handler | Returns current session as JSON (server-side) |
| `/auth/backchannel-logout` | Route handler | Receives back-channel logout JWT from IdP |
| `/auth/dev-login` | Route handler | Local dev only; disabled in `NODE_ENV=production` |
| `/api/health` | Route handler | Returns `{ status: "ok" }` for healthcheck |
| `/api/entitlement` | Route handler | Returns current entitlement for the session |
| `/entitlement/*` | Next.js pages | Upgrade and tier-gate UI surfaces |
| `/(app)/*` | Auth-gated routes | All capability surfaces (requires active session) |
| `/data-assets/overview` | Default landing | Configurable via `DEFAULT_LANDING` in `.env` |

### Beta (`beta-arda.vxture.com`)

Same URL structure as prod. The beta stack differs only in:
- `PROJECT_NAME=arda-beta` (separate containers and Redis)
- `APP_PUBLISH_PORT=3231`
- `OIDC_REDIRECT_URI` and `OIDC_POST_LOGOUT_REDIRECT_URI` point at the beta domain
- `MOCK_STATE=trial` (beta users are in trial state)
- `NEXT_PUBLIC_APP_ENV=beta`

### OIDC Clients (One Per Stack)

Prod and beta are two SEPARATE OIDC clients on accounts.vxture.com, each with
its own client secret. A confidential client's secret is bound to its client
ID, and OIDC back-channel logout registers one logout URI per client, so two
stacks that both need central logout require two clients.

| Stack | Client ID | Registered redirect URI |
|---|---|---|
| prod | `arda` | `https://arda.vxture.com/auth/callback` |
| beta | `arda-beta` | `https://beta-arda.vxture.com/auth/callback` |

Each client also registers its own post-logout redirect and back-channel logout
URI on its own domain. Both clients authenticate the SAME user directory (one
IdP realm); "two clients" isolates the app registrations, not the users.

---

## Edge Vhost Artifacts

Arda contributes one nginx vhost config per environment to `configs/edge/`:

| File | Edge domain | Upstream |
|---|---|---|
| `configs/edge/arda.vxture.com.conf` | `arda.vxture.com` | `ARDA_DEPLOY_HOST:3230` over tailscale |
| `configs/edge/beta-arda.vxture.com.conf` | `beta-arda.vxture.com` | `ARDA_DEPLOY_HOST:3231` over tailscale |

These are source artifacts only. An operator copies them into the vxture project
repository and runs `20-sync-nginx-config.sh` on the edge host to activate them.
See `configs/edge/README.md` for the sync procedure.

---

## Local Development

| Port | Service | URL |
|---|---|---|
| 3230 | Arda app | `http://localhost:3230` |

The local dev port is 3230. If local Vxture SSO origin checks are enabled,
`http://localhost:3230` must be registered as an allowed OIDC callback origin
against accounts.vxture.com. Alternatively, use `MOCK_AUTH=true` to bypass
the real OIDC flow and create sessions directly via `/auth/dev-login`.

---

## EnvGuard and Cross-Environment Redirect

The `EnvGuard` component in `portals/app/app/entitlement/env-guard.tsx` uses
`NEXT_PUBLIC_APP_ENV` to detect if a user has landed on the wrong stack (e.g., a
prod user hitting the beta URL or vice versa). It redirects to the correct stack
using `NEXT_PUBLIC_PROD_URL` or `NEXT_PUBLIC_BETA_URL` as the redirect target.

These three `NEXT_PUBLIC_*` variables are baked into the browser bundle at build
time and cannot be changed at runtime.
