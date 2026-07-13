# Arda - Design Decisions

Decisions that are not obvious from the code, that survived deliberate
consideration, or that would otherwise tempt a future reader to change them.

---

## BFF Session Model (Tokens Server-Side in Redis)

**Decision:** Access tokens and refresh tokens are stored server-side in Redis.
The browser receives only an opaque session cookie.

**Rationale:** The standard OIDC implicit and hybrid flows that put tokens in
`localStorage` or as JavaScript-accessible cookies expose them to XSS. The
Backend-for-Frontend (BFF) pattern confines tokens to the server; a compromised
browser cannot exfiltrate them. The trade-off is the Redis dependency: if Redis
is down, all sessions are invalidated. This is acceptable because Redis is
co-located on the same host with `always` restart policy and AOF persistence.

**Consequence:** The cookie must be `HttpOnly` and `Secure`. The cookie domain
is host-only (no leading dot) so it cannot propagate to sibling `*.vxture.com`
subdomains. See `10-specs/security.md` for the full cookie spec.

---

## PKCE for Authorization Code Flow

**Decision:** Arda uses Authorization Code + PKCE, not the implicit flow or
client-credentials flow.

**Rationale:** PKCE prevents authorization code interception even if the
redirect URI is compromised. The code verifier is stored in Redis per
authorization request and consumed exactly once. This satisfies current OIDC
security best practices (RFC 9700) for server-side web apps.

**Consequence:** The `authreq:<state>` key in Redis is critical to the login
flow. If Redis is unavailable during the callback, the login fails. This is
preferable to silently accepting unverified codes.

---

## Two OIDC Clients (Per-Stack), Shared Identity, Isolated Sessions

**Decision:** Prod and beta are two SEPARATE OIDC clients against the same
`accounts.vxture.com`: prod uses `OIDC_CLIENT_ID=arda`, beta uses `arda-beta`.
Each client has its own client secret. Identity (user records, subscription
state, the `arda` claim) is shared - both clients authenticate the same user
directory. Session data (Redis, cookies) is isolated per stack.

**Rationale:** Two forces require two clients, not one:
- **Central logout.** OIDC back-channel logout registers exactly one
  `backchannel_logout_uri` per client. With a single shared client the IdP
  could notify only one stack on central logout; the other stack would stay
  logged in. Two clients let each stack register its own logout URI. (This was
  the root cause of the historical beta logout bug.)
- **Isolation.** Beta is an internal pre-release / demo stack (lower trust,
  wider access). A separate client gives it a separate token audience (a beta
  token cannot be replayed against prod) and a separate secret (a beta leak
  does not compromise the prod client).

"One user base" does not imply one client: the user directory is a property of
the IdP realm, not of the OIDC client. Both clients authenticate the same
users; the split isolates the app registrations, not the users. EnvGuard still
routes users to the stack that matches their subscription state. Session
isolation (separate Redis, host-only cookies) is a data hygiene requirement
layered on top.

**Consequence:**
- The same user can authenticate on both stacks simultaneously with two
  independent sessions; this is intentional and not a bug.
- Each stack's client secret is provisioned and rotated independently. Rotating
  the `arda` secret does not affect beta, and vice versa.
- `MOCK_STATE=trial` on the beta `.env` is a local-dev fallback only (used
  when no real `arda` claim is present). In production, the claim from
  accounts.vxture.com is authoritative and overrides any MOCK_* env vars.

---

## MockEntitlementResolver (Passthrough, Not Stub)

**Decision:** `MockEntitlementResolver` passes real `ArdaClaim` values through
unchanged when the claim is present. It only falls back to `MOCK_STATE` /
`MOCK_TIER` env vars when no claim is available (local dev or missing scope).

**Rationale:** If the mock always returned env-var values, deploying to prod with
`MOCK_STATE=subscribed` would grant all users access regardless of their real
claim. The passthrough behavior means the mock is transparent in production: once
accounts emits the real claim, no code change is needed.

**Consequence:** The `MockEntitlementResolver` can be removed (and the factory
simplified) only after the `arda` claim is guaranteed to be present in all
environments. Premature removal would break local dev.

---

## EnvGuard: Client-Side Environment Redirect

**Decision:** A client-side component (`EnvGuard`) redirects users who land on
the wrong stack (e.g., a prod user on the beta URL).

**Rationale:** Beta and prod are two independent deployments on the same domain
namespace. A user with a prod subscription who visits the beta URL would
encounter trial-state behavior. EnvGuard detects the mismatch via
`NEXT_PUBLIC_APP_ENV` and redirects to the correct stack.

**Consequence:** `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_PROD_URL`, and
`NEXT_PUBLIC_BETA_URL` are baked into the browser bundle at build time. They
cannot be changed without rebuilding the image. A beta image deployed to prod
(e.g., wrong image tag) would silently serve the wrong EnvGuard behavior.

---

## Two RAID Arrays, Two Stack Roots

**Decision:** Prod data lives on `/srv/md0` (1.8 TB RAID-1); beta data lives on
`/srv/md1` (916 GB RAID-1). Each stack's `DATA_DIR` is on its respective array.

**Rationale:** Prod session state (user logins, token bundles) must survive root
disk failure. Placing `DATA_DIR` on the RAID array ensures Redis AOF data is on
redundant storage. Beta follows the same pattern for consistency, using the
smaller array.

**Consequence:** If `DATA_DIR` is misconfigured to point at the root filesystem,
session data is not on redundant storage. The `.env` template enforces correct
paths via comments; the deploy contract check validates them at CI time.

---

## No On-Host Nginx, No TLS

**Decision:** ARDA_DEPLOY_HOST runs no nginx and holds no TLS certificates. The
shared public edge handles both.

**Rationale:** Arda is one of multiple apps behind the shared `*.vxture.com`
wildcard. Maintaining per-app TLS certs and nginx configs would duplicate
infrastructure that the edge already owns. The tailscale link between the edge
and the deploy host provides WireGuard-level encryption in transit; no additional
TLS hop is needed.

**Consequence:** Arda cannot be accessed directly without going through the
edge. This is a feature, not a bug: it enforces the network boundary. The only
exception is `http://localhost:3230` for local development.

---

## Subscription Tiers as a Closed Enum

**Decision:** Subscription tiers are a fixed ordered enum: `free < starter <
pro < business < enterprise`. The `tierMeets(tier, min)` utility compares by
rank index.

**Rationale:** An open-ended tier system (arbitrary strings, bitmask
capabilities) would require all feature checks to know about all capabilities.
A closed ordered enum lets features gate on a minimum tier without knowing the
full tier space: `tierMeets(user.tier, "pro")` is sufficient for pro-gated
features.

**Consequence:** Adding a new tier requires updating `TIER_ORDER` in
`types.ts`, updating `ArdaClaim` JSDoc invariants, and coordinating with
accounts.vxture.com to emit the new tier value. This is intentional friction
to avoid ad-hoc tier proliferation.

---

## Two-Level Isolation: Org Hard, Workspace Soft (Grantable)

**Decision (owner ruling, 2026-07-13):** Isolation is two-level across arda
and all Vxture products. The org (tenant) is the hard isolation boundary:
no data access ever crosses orgs. The workspace is soft isolation by
default: business data is force-filtered by `workspaceId`, but cross-
workspace access within the same org can be granted via an explicit,
resource-level `WorkspaceGrant` (see `arda-data-160-cross-workspace-
authorization.md`). Subscription entitlement attaches to the workspace and
stays strictly isolated: a grant never carries or merges entitlement, and
gating/quota always evaluate against the consumer's active workspace.

**Rationale:** Real org-internal collaboration needs controlled sharing
between workspaces (for example, one team consuming another team's
published data service) without collapsing workspaces into one pool or
routing bytes through the platform layer. Keeping the grant resource-level
and org-bounded preserves auditability; keeping entitlement workspace-
bound preserves the billing model.

**Consequence:** This supersedes data-150 decision D8 ("no share-grant
primitive"). The default read path and the data-110 force-filter paradigm
are unchanged: cross-workspace reads go only through a dedicated
grant-join helper, never by widening the default `workspaceId` filter.
