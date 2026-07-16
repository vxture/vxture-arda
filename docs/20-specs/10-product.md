# Arda - Product Scope

---

## What Arda Is

Arda is the `data` product of the Vxture platform: a general-purpose data
platform (data domain) that catalogs, governs, and serves enterprise data.
It produces trusted, controlled, traceable data for console users and for
external consumers (BI, business agents, downstream products).

Arda owns:
- The authentication flow (OIDC RP against accounts.vxture.com)
- The entitlement gate (binary wall on subscription status, plus per-feature
  keys resolved from the platform entitlement endpoint)
- Workspace-scoped domain business data (datasets, data sources, standards,
  quality rules, lineage, services) persisted in `arda-db` (Postgres)
- The console surfaces for the five functional domains (assets, integration,
  governance, services, admin), built on `@vxture/design-system`

Scope boundary: Arda manages the data itself, not how the data is used.
Structured data plus common unstructured assets (documents, images, tables as
files) are in scope. KB/RAG/LLM orchestration, agents, and complex twin data
(GIS, 3D, IoT) belong to other products. See
[`30-design/arda-biz-100-architecture.md`](../30-design/arda-biz-100-architecture.md).

---

## Capability Surfaces

All surfaces live under the auth-gated `(app)` layout. Access requires a valid
session with an `active` subscription status.

| Route | Domain | Surface |
|---|---|---|
| `/dashboard` | overview (always-on) | Landing dashboard (default landing) |
| `/catalog` | assets | Data asset catalog and detail |
| `/etl` | integration | Data sources and integration runs |
| `/standards` | governance | Data standards and reference data |
| `/quality` | governance | Quality rules and results |
| `/lineage` | governance | Lineage graph and impact analysis |
| `/security` | governance | Classification and security policies |
| `/service` | services | Data services and API management |

The default post-login landing page is `/dashboard` (configurable via
`DEFAULT_LANDING` in `.env`). Domain-to-surface mapping and gating keys are
specified in [`30-design/arda-biz-000-index.md`](../30-design/arda-biz-000-index.md).

---

## Tenancy and Isolation

Arda is multi-tenant with a two-level isolation model (shared across all
Vxture products):

- **Org (tenant) = hard isolation.** The organization is the tenant boundary.
  No data access ever crosses orgs.
- **Workspace = soft isolation by default.** All business data carries a
  `workspaceId` and queries are scoped by it by default; cross-workspace
  access within the same org can be granted under explicit authorization.

Subscription entitlement attaches to the workspace and IS strictly isolated:
each workspace's entitlement comes from its own `(workspace, product)`
subscription rows. Authorized cross-workspace data access does not carry or
merge entitlement; gating always evaluates against the active workspace's own
subscription.

Workspace and org lifecycle (create/clone/delete) is owned by the Vxture
platform. Arda mirrors the identifiers (from the `active_org` /
`active_workspace` token claims), never mints them, and executes platform
commands (seed/wipe/invalidate) against them. Org/workspace context switching
is an in-app action (re-fetch entitlement, reload data), never a re-login.

---

## What Arda Is Not

- **Not an identity provider.** Arda is an OIDC relying party. It never issues
  tokens, stores passwords, or manages user accounts. Identity lives in
  `accounts.vxture.com`.
- **Not the subscription system of record.** Subscriptions, plans, billing,
  and quota accounting live in the Vxture platform. Arda keeps no entitlement
  tables; it pulls a resolved entitlement snapshot per
  `(workspace, product=arda)` and caches it briefly.
- **Not a data consumer.** Arda manages what the data is, whether it can be
  trusted, and who may use it. Using the data (RAG, analysis, agent
  workflows) happens in consuming products via Arda's service contracts.
- **Not responsible for TLS.** The shared public edge terminates TLS with the
  wildcard `*.vxture.com` cert. Arda runs plain HTTP on the tailnet.
- **Not responsible for user management.** User records, invite flows, and
  password resets belong to accounts.vxture.com.
- **Not an API gateway.** The `/api/*` routes are Next.js route handlers for
  the app's own BFF needs (session, health, entitlement check), not a general
  data API. External data access goes through `DataService` + `ApiKey`.

---

## Subscription Model

Entitlement is resolved by the Vxture platform per `(workspace, product=arda)`
and consumed read-only by Arda: real-time pull from the platform entitlement
endpoint, short-TTL Redis cache, and platform-pushed `invalidate` for
second-level effect. The legacy token-claim tier source is deprecated. See
[`ADR-11`](../30-design/decisions/ADR-011-subscription-entitlement-design.md) and
[`30-design/arda-ent-120-consumption-contract.md`](../30-design/arda-ent-120-consumption-contract.md).

Two orthogonal axes:

- **state** (subscription lifecycle): `none | trial | subscribed | expired`.
  Gating is a binary wall: only an active subscription (trial or subscribed)
  passes; `none` and `expired` are rejected outright.
- **tier** (capability level): `free | starter | pro | business | enterprise`.
  Higher tiers include lower-tier features. `free` appears as the fallback
  value in non-active states; it never grants access by itself.

Feature keys are defined by Arda (only the product knows its features); the
tier-to-feature mapping and quotas are platform configuration, delivered in
the entitlement snapshot (`capabilities` + `quota_pools`). Arda hardcodes no
tier-to-feature matrix.

---

## Environments

| Environment | Release tag | Domain | Approval gate |
|---|---|---|---|
| beta | `beta-YYYYMMDD.N` | `beta-arda.vxture.com` | None - deploys on tag push |
| prod | `vX.Y.Z` | `arda.vxture.com` | Required reviewer approval |

Beta is an internal pre-release and demo environment; end users never touch
it. User-facing trial ("public beta") is expressed in prod as
`state=trial`, not as a separate deployment. Upgrading trial to subscribed is
a subscription change with data continuing in place: zero migration, zero
re-login. See CLAUDE.md for the branch and promotion model.
