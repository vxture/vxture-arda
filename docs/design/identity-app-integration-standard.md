# Vxture App Integration Standard v1.0 (OIDC RP)

> Status: Interface specification (integration reference).
> This document describes the contract that Arda implements as an OIDC relying
> party against accounts.vxture.com.

Arda follows the Vxture App Integration Standard v1.0. The upstream authoritative
specification is maintained in the vxture/umbra repository at:

  `docs/design/identity-app-integration-standard.md`

The upstream spec is the single source of truth for the full OIDC contract,
including endpoint parameters, PKCE requirements, token format, back-channel
logout protocol, and error handling. This document summarizes Arda's specific
implementation of that standard.

---

## Arda OIDC Client Registration

| Parameter | Value |
|---|---|
| Client ID | `arda` |
| Client authentication | `client_secret_basic` (recommended) |
| Redirect URIs | `https://arda.vxture.com/auth/callback`, `https://beta-arda.vxture.com/auth/callback` |
| Post-logout redirect URIs | `https://arda.vxture.com/`, `https://beta-arda.vxture.com/` |
| Scopes | `openid profile email arda:subscription` |
| Deployment mode | Mode A (cross-subdomain, `*.vxture.com`) |

---

## OIDC Endpoints (Derived from Issuer)

All endpoints are derived from `OIDC_ISSUER` (never fetched via discovery per
request). The issuer base URL is `https://accounts.vxture.com`.

| Endpoint | URL |
|---|---|
| Authorization | `{issuer}/oidc/authorize` |
| Token exchange | `{issuer}/oidc/token` |
| JWKS (verification) | `{issuer}/oidc/jwks` |
| End session | `{issuer}/oidc/end_session` |

---

## Authorization Code + PKCE Flow

Arda implements the Authorization Code flow with PKCE (S256). Plain `code_challenge_method`
is not supported. The code verifier is generated per-request, stored in Redis under
`authreq:<state>`, and consumed exactly once on callback. See
`portals/app/app/auth/lib/pkce.ts` and `portals/app/app/auth/lib/oidc.ts`.

---

## The `arda` Scope Claim

Arda requests the `arda:subscription` scope. accounts.vxture.com populates the
`arda` claim in the access token with lifecycle state and subscription tier:

```json
{
  "arda": {
    "state": "subscribed",
    "tier": "pro",
    "had_trial": false
  }
}
```

This claim is the authoritative source for entitlement. See
[`design/entitlement.md`](entitlement.md) for the full claim schema and mapping.

---

## Back-Channel Logout

Arda implements OIDC back-channel logout. The IdP calls
`POST /auth/backchannel-logout` with a `logout_token` JWT when the user's
central session ends. Arda verifies the JWT, extracts the `sid` claim, looks up
the `sid:<sid>` key in Redis, and invalidates the corresponding `rpsess:` and
`rptok:` keys. This is the only supported global logout mechanism for
cross-subdomain apps (no iframe/cookie sharing required).

Implementation: `portals/app/app/auth/backchannel-logout/route.ts`

---

## Session Cookie

| Attribute | Value |
|---|---|
| Name | `vx_rp_session` (`RP_SESSION_COOKIE_NAME`) |
| Domain | Exact host, no leading dot (`RP_SESSION_COOKIE_DOMAIN`) |
| HttpOnly | Yes |
| Secure | Yes (production) |
| SameSite | `Lax` |

The cookie domain is host-only. It does not propagate to sibling `*.vxture.com`
subdomains. This is a hard requirement of the standard for cross-subdomain apps.

---

## Token Storage

Tokens are stored exclusively on the server (Redis). The browser never receives
or sees an access token or refresh token. This is the BFF pattern mandated by
the standard for server-rendered web apps. See [`design/decisions.md`](decisions.md)
for rationale.

---

## MOCK_AUTH Mode

Local development without a real IdP is supported via `MOCK_AUTH=true`. When
set (and `NODE_ENV != production`), the OIDC flow is bypassed and the
`/auth/dev-login` route creates sessions directly in Redis with mock claims.
The `arda` claim values in dev-login sessions are controlled by `MOCK_STATE`
and `MOCK_TIER` env vars.

`MOCK_AUTH=true` is hard-gated: it has no effect in `NODE_ENV=production`.
