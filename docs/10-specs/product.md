# Arda - Product Scope

---

## What Arda Is

Arda is the unified entry point for data capability work within the Vxture
platform. It is a **destination app**: users authenticate once, are gated by
subscription tier, and land on the data capability surface that matches their
entitlement.

The app is a **shell** for now. It owns:
- The authentication flow (OIDC RP against accounts.vxture.com)
- The subscription gate (tier resolver + gated layout)
- The top-level navigation and shell chrome (via `@vxture/design-system`)
- The route stubs for each capability surface

Capability surfaces behind the shell are built out over time. The shell exists
so authentication, entitlement, and navigation are settled infrastructure before
the surfaces themselves are staffed.

---

## Capability Surfaces

All surfaces live under the auth-gated `(app)` layout. Access requires a valid
session with an `active` subscription status.

| Route prefix | Surface |
|---|---|
| `/data-assets/overview` | Data asset catalog and overview (default landing) |
| `/integration` | Data integration configuration |
| `/management` | Data management tools |
| `/governance` | Data governance workflows |
| `/services` | Platform service management |

The default post-login landing page is `/data-assets/overview` (configurable
via `DEFAULT_LANDING` in `.env`).

---

## What Arda Is Not

- **Not an identity provider.** Arda is an OIDC relying party. It never issues
  tokens, stores passwords, or manages user accounts. Identity lives in
  `accounts.vxture.com`.
- **Not a data storage backend.** Arda is a UI shell. Data assets, pipelines,
  and governance state live in downstream services; Arda surfaces them.
- **Not a multi-tenant app.** Each user sees their own data scoped by their
  session and tier. There is no concept of "organizations" or "workspaces" at
  the Arda shell level.
- **Not responsible for TLS.** The shared public edge terminates TLS with the
  wildcard `*.vxture.com` cert. Arda runs plain HTTP on the tailnet.
- **Not responsible for user management.** User records, invite flows, and
  password resets belong to accounts.vxture.com.
- **Not an API gateway.** The `/api/*` routes are Next.js route handlers for
  the app's own BFF needs (session, health, entitlement check), not a general
  data API.

---

## Subscription Tiers

Arda gates access by subscription tier. The tier is derived from the `arda`
claim carried in the access token issued by accounts.vxture.com.

| Tier | Rank | Target users |
|---|---|---|
| `free` | 0 | Lapsed or direct-free users |
| `pro` | 1 | Individual paid subscribers |
| `team` | 2 | Team subscriptions |
| `enterprise` | 3 | Enterprise contracts |

Higher rank entitles the user to all features of lower tiers. The entitlement
model is documented in [`20-design/entitlement.md`](../20-design/entitlement.md).

---

## Environments

| Environment | Branch | Domain | Auto-deploy |
|---|---|---|---|
| beta | `develop` | `beta-arda.vxture.com` | Yes, on every push to develop |
| prod | `main` | `arda.vxture.com` | Manual promote only |

Beta is for pre-release validation. Users on beta are in `trial` state. Prod
carries subscribed users. See CLAUDE.md for the branch and promotion model.
