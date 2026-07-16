# Vxture App Integration Standard v1.0 (OIDC RP)

> Status: Interface specification (integration reference).
> This document describes the contract that Arda implements as an OIDC relying
> party against accounts.vxture.com.
> See also: [`arda-plat-110-oidc-contract.md`](../30-design/arda-plat-110-oidc-contract.md)
> for arda's numbered-series counterpart (same contract, cross-checked against
> the current auth code, with the additional `appOrigin` / back-channel replay
> details this file does not cover).

Arda follows the Vxture App Integration Standard v1.0. The upstream authoritative
specification is maintained in the vxture/umbra repository at:

  `docs/10-standards/10-identity-app-integration-standard.md`

The upstream spec is the single source of truth for the full OIDC contract,
including endpoint parameters, PKCE requirements, token format, back-channel
logout protocol, and error handling. This document summarizes Arda's specific
implementation of that standard.

---

## Arda OIDC Client Registration

Arda registers two OIDC clients on accounts.vxture.com, one per stack. Each is a
confidential client with its own secret, callback, post-logout, and
back-channel-logout URI. Two clients (not one client with two redirect URIs) are
required because OIDC back-channel logout allows a single logout URI per client;
the split also isolates token audience and secret blast-radius between the prod
and the internal beta stack.

| Parameter | Prod client | Beta client |
|---|---|---|
| Client ID | `arda` | `arda-beta` |
| Client authentication | `client_secret_basic` | `client_secret_basic` |
| Redirect URI | `https://arda.vxture.com/auth/callback` | `https://beta-arda.vxture.com/auth/callback` |
| Post-logout redirect URI | `https://arda.vxture.com/` | `https://beta-arda.vxture.com/` |
| Back-channel logout URI | `https://arda.vxture.com/auth/backchannel-logout` | `https://beta-arda.vxture.com/auth/backchannel-logout` |
| Scopes | `openid profile email phone arda` | `openid profile email phone arda` |
| Deployment mode | Mode A (cross-subdomain, `*.vxture.com`) | Mode A (cross-subdomain, `*.vxture.com`) |

Both clients authenticate the same user directory (one IdP realm); the split
isolates the app registrations, not the users.

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

Arda requests the `arda` scope (current; `arda:subscription` was an earlier
scope name being phased out, see `docs/70-workplan/20-vxture-platform-integration-requirements.md`
section 2.3). accounts.vxture.com populates the `arda` claim in the access
token with lifecycle state and subscription tier:

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
[`30-design/40-entitlement.md`](../30-design/40-entitlement.md) for the full claim schema and mapping.

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
the standard for server-rendered web apps. See [`30-design/decisions/00-index.md`](../30-design/decisions/00-index.md)
for rationale.

---

## MOCK_AUTH Mode

Local development without a real IdP is supported via `MOCK_AUTH=true`. When
set (and `NODE_ENV != production`), the OIDC flow is bypassed and the
`/auth/dev-login` route creates sessions directly in Redis with mock claims.
The `arda` claim values in dev-login sessions are controlled by `MOCK_STATE`
and `MOCK_TIER` env vars.

`MOCK_AUTH=true` is hard-gated: it has no effect in `NODE_ENV=production`.
