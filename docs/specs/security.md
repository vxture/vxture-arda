# Arda - Security

---

## Security Model

Arda's security boundary is the OIDC session: every authenticated request must
carry a valid `vx_rp_session` cookie that resolves to a live session in Redis.
There is no separate API key or basic-auth layer. Unauthenticated requests are
redirected to `/auth/login`.

---

## Network Boundary

```
Internet
  |  HTTPS (:443, *.vxture.com wildcard cert)
  v
EDGE HOST  (shared public edge, not owned by Arda)
  |  HTTP over Tailscale (WireGuard-encrypted)
  v
ARDA_DEPLOY_HOST  (private compute, tailnet-only, no public IP)
  |
  arda-app on APP_PUBLISH_PORT (3230 prod / 3231 beta)
```

ARDA_DEPLOY_HOST has no public IP. The only ingress path is from the shared
public edge over tailscale. The host firewall must permit ingress on the
tailscale interface only. `arda-redis` is container-internal and never published
to any host port.

---

## OIDC RP Security

Arda implements the Authorization Code flow with PKCE (Proof Key for Code
Exchange) against accounts.vxture.com. Key properties:

**Code interception resistance:** PKCE prevents authorization code interception
attacks. The code verifier is generated per-authorization request, stored in
Redis under the `authreq:` key space, and consumed exactly once on callback.

**Token confinement (BFF pattern):** Access tokens and refresh tokens never
leave the server. The browser receives only an opaque session cookie. The app
BFF (`arda-app`) holds the token bundle in Redis under `rptok:` keys.

**Host-only session cookie:** `RP_SESSION_COOKIE_DOMAIN` is set to the exact
hostname (`arda.vxture.com`, no leading dot). This prevents the session cookie
from being sent to sibling `*.vxture.com` subdomains. The cookie is also
`HttpOnly` and `Secure` (in production).

**Back-channel logout:** Arda supports OIDC back-channel logout. The IdP calls
`/auth/backchannel-logout` with a logout JWT; the app looks up the `sid->rpsid`
index in Redis and invalidates the server-side session directly. The browser
cookie becomes orphaned and the next request is rejected.

**Session TTL:** Sessions expire after `RP_SESSION_TTL` seconds (default: 30
days). The TTL is reset on token refresh. Tokens are refreshed transparently
when the access token nears expiry.

---

## Cookie Specification

| Attribute | Value |
|---|---|
| Name | `vx_rp_session` (configurable via `RP_SESSION_COOKIE_NAME`) |
| Domain | Exact hostname, no leading dot (e.g., `arda.vxture.com`) |
| Path | `/` |
| HttpOnly | Yes |
| Secure | Yes (production); No (development) |
| SameSite | `Lax` |
| Expiry | Session TTL from `RP_SESSION_TTL` (default 30 days) |

---

## Identity vs Session Isolation

accounts.vxture.com is the single source of truth for identity and subscription
state. Both prod and beta authenticate against the same IdP with the same
`arda` OIDC client. A user's `ArdaClaim` (`state`, `tier`, `had_trial`) is
the same regardless of which stack they hit - it comes from the IdP, not from
any server-side env var.

Session data is isolated per stack. Each stack has its own Redis instance and
host-only cookie domain. A session created on prod (`arda.vxture.com`) is
invisible to beta (`beta-arda.vxture.com`) and vice versa. The `REDIS_URL`
resolves to `${PROJECT_NAME}-redis` which is the correct Redis container for
that stack's Docker network.

MOCK_STATE and MOCK_TIER in `.env` are local-dev fallbacks. They activate only
when the `arda` claim is absent from the token (no real IdP). In production
deployments (both prod and beta), the real claim from accounts.vxture.com takes
precedence and the MOCK_* vars are dormant.

## Redis Key Space

All session state lives in the `arda-redis` container, isolated on `arda-net`.

| Key prefix | Content | TTL |
|---|---|---|
| `authreq:<state>` | PKCE code verifier + return-to URL for in-flight OIDC request | Short (minutes) |
| `rpsess:<session-id>` | RP session: identity claims, tier, entitlement | `RP_SESSION_TTL` |
| `rptok:<session-id>` | Token bundle: access token, refresh token, expiry | `RP_SESSION_TTL` |
| `sid:<sid>` | Back-channel logout index: OIDC session ID -> RP session ID | `RP_SESSION_TTL` |

Prod and beta each run their own Redis instance. There is no shared Redis. The
container name is `${PROJECT_NAME}-redis`, so `REDIS_URL` in `.env` resolves to
the correct instance for each stack.

---

## Subscription Gate

After authentication, the entitlement resolver reads the `arda` claim from the
access token and derives the user's `Subscription` (`tier` + `status`). The gate
checks `status`:

- `active` (trial or subscribed): user is admitted to `(app)` routes.
- `expired` or `none`: user is redirected to the upgrade/entitlement surface.

The gate is enforced server-side in the `(app)` layout. Client-side tier checks
for feature gating (e.g., hide pro-only controls for free-tier users) must not
be the sole enforcement mechanism.

---

## Secret Management

| Secret | Location | Notes |
|---|---|---|
| `OIDC_CLIENT_SECRET` | `.env` on server at `<ROOT_DIR>/etc/.env` | Provisioned by the platform; never in Git |
| `NODE_AUTH_TOKEN` | CI secret / `.env` | GitHub Packages read token for `@vxture` scope |
| `DEPLOY_SSH_KEY` | GitHub Environment secret | SSH key for CI -> ARDA_DEPLOY_HOST |
| `ENV_FILE_BASE64` | GitHub Environment secret | Base64-encoded `.env` for bootstrap deploy |
| `TAILSCALE_OAUTH_*` | GitHub Environment secret | Tailscale OAuth for CI runner ephemeral node |
| `ALIYUN_ACR_*` | GitHub Environment secret | Aliyun ACR pull-through credentials |

`.env` on the server is written by the CI bootstrap step on first deploy and
never overwritten by subsequent deploys. It lives at `<ROOT_DIR>/etc/.env`
outside the rsync target so deploy updates cannot clobber it.

---

## MOCK_AUTH Mode (Local Dev Only)

When `MOCK_AUTH=true` is set and `NODE_ENV != production`, the OIDC flow is
bypassed. The `/auth/dev-login` route creates a session directly in Redis with
mock identity claims. `MOCK_AUTH` is hard-gated: if `NODE_ENV=production`, it
is silently ignored and the real OIDC flow is enforced.

`MOCK_STATE` and `MOCK_TIER` control the simulated entitlement when no real
`arda` claim is present (local dev, or before accounts emits the real claim).
These env vars have no effect when a real `arda` claim is present in the token.
