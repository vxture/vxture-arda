# Arda L2 platform alignment audit

Audit date: 2026-11-21. This is an implementation audit, not a new platform
standard. It supersedes historical integration requirements where those conflict
with the platform sources below. Production currently remains v0.12.0 on the
old domain; changing repository templates does not migrate a running stack.

Owner correction: L2/L3 integration is configuration-managed. Product domains,
OIDC clients, callbacks, edge routing and webhook credentials must be maintained
through the platform product configuration. Do not edit server environment
variables on platform hosts, add product-specific platform env keys, or install hand-written
vhosts to perform this migration. Existing env-based Arda code/templates are
legacy implementation evidence, not the target configuration workflow.

Owner clarification, 2026-11-21: the prohibition applies to platform-side
onboarding. Arda's own runtime connection settings may be updated through its
normal product deployment. `deploy/config/integration-{production,beta}.env`
now carries only non-secret product connection settings; the deploy loader
applies that release profile after the legacy operator file, preserving client,
webhook and database secrets. CI image pins retain precedence. Empty cookie
Domain is now accepted by deployment validation. This is product configuration,
not a new platform registration authority or a remote config-delivery API.

## Evidence and ownership

- Platform main: `fc3233657e695c32d3b056cc7bbfefd0fa91c4a9`, fetched read-only.
  The local platform checkout contains unrelated uncommitted work and is behind
  main. Findings use `git show origin/main:...`, not that working tree.
- CoSpace reference: `cdf2629`, specifically
  `packages/infrastructure/platform_{rp,subscription,identity,provisioning,usage}.py`.
  Its launch record distinguishes implemented APIs from real production evidence.
- Platform authorities: `docs/20-specs/000-platform/opera/40-product-registry.md`,
  `docs/30-design/product_200_integration.md`, `product_220_catalog-resource-model.md`,
  `product_230_mesh-architecture.md`, and `identity/080-rp-integration.md`.
- Resolve conflicting prose against the current route/service implementation.
  Main-branch code, local modifications and deployed platform behavior are
  separate facts. Authenticated Opera observations are recorded below.

Arda is an independent **L2 product**, not a platform portal or an L3 agent.
The directory's explicit `products.layer` is authoritative; do not derive layer
from product code/type. Platform owns identity, commercial subscriptions,
assignment/seats, numeric entitlements and usage accounting. Arda owns data
catalog behavior and data authorization. Retain workspace isolation and product
references. Do not copy CoSpace's scene policies, plans, metrics or allowances.

## Baseline gaps against current APIs

This table records the pre-migration findings. Source changes now implemented
are listed separately below; unlisted lifecycle/sharing gaps remain open.

| Priority | Area | Arda evidence | Required alignment |
| --- | --- | --- | --- |
| P0 | Configuration consumption | `auth/lib/config.ts` and existing deployment templates still read integration settings from env | Verify and adopt the current product configuration consumption/delivery mechanism before migrating APIs. Platform registration is authoritative. Do not invent a configuration endpoint or substitute server env edits for this work. |
| P0 | Product assignment | `ui/entry/state.ts` treats workspace governance roles as usage permission | Use user-bound `GET /platform/product-access`; a workspace member is not necessarily assigned this product. Enforce at server business boundaries as well as the entry UI. |
| P0 | C2/C3 credentials | `entitlement/platform-client.ts`, `usage/lib/{flush,gauge}.ts` use `x-vxture-internal-auth` | Exchange Arda's confidential client for `audience=vxture`, then send Bearer. Never use Atlas's delegated-reporter ticket as an L2 product. |
| P0 | Missing configuration | `entitlement/resolver.ts` falls back to a mock when either URL/token is absent, including production | Permit mock only in explicit local development/test. Missing production integration configuration must fail unavailable, never grant a mock Pro subscription. |
| P0 | Error/cache behavior | `platform-resolver.ts` can return stale access without an age bound after platform failure; entry-only `resolveFresh` is stricter | Establish bounded authority freshness across server actions, REST and UI; outages remain unavailable, not unsubscribed or unlimited access. Validate C2 response workspace/product and reject malformed facts. |
| P0 | Consume acknowledgment | `usage/lib/flush.ts` marks HTTP 409 as flushed | `intent=report` returns 200, including `gated:true`. Only reserve/hard rejection is 409 and writes no event. Do not acknowledge a failed report; keep the durable business idempotency key on retry. |
| P1 | Lifecycle receiver | `/provisioning/webhook` is the sole old route | Standard route is `/api/webhooks/vxture`. Alias added in this batch; retain old route until registration and delivery are verified. |
| P1 | Webhook semantics | `provisioning/lib/handler.ts` applies one sequence watermark to all event kinds; missing seq is not validated; grant invalidation is a no-op | Validate each actual event envelope/header binding, separate sequenced provisioning from other invalidation events, preserve transactional deduplication/ordering, invalidate authoritative views across app instances. |
| P1 | Provisioning recovery | Receiver exists; no platform provisioning read/reconcile/ack client found | Compare CoSpace recovery with current platform provisioning readers and `POST /provisioning/ack`; implement replay-safe reconciliation and actual handling receipts, not just HTTP acceptance. |
| P1 | Central session validity | `auth/lib/session.ts` waits for token expiry/refresh or back-channel logout | Adopt confidential Basic `POST /oidc/session/status` and its `valid`/`next_check_at` contract. Transport/refresh failures alone do not prove logout. Avoid inventing a high-frequency timer. |
| P1 | Tenant/workspace context | Identity is an access-token snapshot; no explicit reauthorization/switch flow found | Reauthorize or controlled refresh, trust verified replacement claims, then clear the old scope. Session status does not report context changes. Platform docs mark parts of shared-context work as not production-validated. |
| P1 | C2 gate model | `hasProductAccess` only checks a short status list; envelope still supports v1 capabilities | Reconcile v3 effective `tier`/`bundled` coverage with `product_220` and actual responses. Subscription status is descriptive; do not infer all effective coverage from one subscription's status. Unknown facts must not grant new access. |
| P1 | Asset visibility | S2S allow-list admits callers; no `GET /platform/sharing/visible-set` consumption found | L2 data entry points need resource grants AND entitlement evaluation. Add server-side visible-set filtering and revocation before claiming shared assets work. |
| P2 | Product roster/profile | Governance-role-based administration and local identity display | Review current product roster/profile APIs and assignment vs Arda business roles. Do not invent an Arda-local platform member directory. |
| P2 | AI/data-plane calls | Atlas RFC8693 caller exists but used the public issuer transport | Internal token transport fixed in this batch. Follow up token verification, bounded caching, context binding and Runos/Atlas authorization against real grants. Atlas remains the sole inference-usage reporter. |
| P2 | Documentation | Old requirements still request token entitlements and claim context can switch without reauthorization | Mark old requirements historical; update implementation-owned contracts during each code migration rather than treating old prose as the current platform contract. |

`GET /platform/product-access` is implemented in platform
`bff/platform-api/src/routers/platform-product-access.router.ts`:

- No query parameters. Subject/org/workspace/product come from the ticket.
- Requires a non-delegated **OBO** ticket; service/legacy credentials cannot
  establish a user's product assignment.
- Response: `{product, workspace_id, org_id, subject, allowed}`.
- Verify all four scope fields and a boolean decision before using it.
- Assignment denial is separate from missing Arda business roles. Preserve the
  confirmed "role not assigned" meaning; do not relabel seat denial as a role.

For OBO exchange, send the current server-held user access token as
`subject_token` with its access-token type. Background jobs instead use service
mode bound to trusted org/workspace references. Both authenticate with Arda's
own Basic client credentials, request `audience=vxture`, and must validate the
signed ticket's audience/actor/mode/context/lifetime. User assignment results
must never be shared in a workspace-only cache.

Keep the user-confirmed commerce URL
`https://vxture.com/zh-CN/pricing?product=arda`. Platform `product_200` still
documents a console subscribe deep link; this is a known discrepancy, not
authorization to undo the confirmed design. Platform issue #715 tracks the
pricing renewal behavior; this audit does not establish it as fixed.

## Changes delivered with this audit

1. Canonical production URL in environment templates and current deployment/OIDC
   documentation is `https://arda.ruyin.work`. Beta remains
   `https://beta-arda.vxture.com`; the user requested the production domain.
2. `OIDC_BACKCHANNEL_ISSUER` now drives token and JWKS transport, including the
   existing Atlas exchange caller. Signature issuer and browser authorization /
   end-session endpoints stay on `https://accounts.vxture.com`.
3. RP cookies omit Domain on set and clear. A leading-dot-free Domain attribute
   is still a domain cookie; old comments incorrectly called it host-only.
4. The standard webhook URL delegates to the same receiver as the old URL.
   This adds reachability, not a claim that all lifecycle gaps above are fixed.
5. Domain values in legacy templates are migration reference only. The new
   hand-written edge artifact was withdrawn after the owner clarified the
   configuration-only workflow. Platform configuration owns generated routing.
   Certificate coverage for `arda.ruyin.work` must be verified through the
   existing platform process.
6. C2, consume and storage gauge now use Arda-owned RFC8693 Bearer exchange,
   with RS256 audience/actor/mode/org/workspace/subject/lifetime validation.
   User admission uses OBO; background jobs use trusted WorkspaceRef context.
   Removed the shared platform credential from Compose and example templates.
7. Product assignment uses scoped `GET /platform/product-access`. Business
   pages/actions check assignment and effective product tier before loading
   data or seeding a workspace. Identity/bootstrap endpoints stay separate.
   Entry C2 reads use OBO, so a first login does not depend on a preexisting
   local WorkspaceRef. User assignment is never cached by workspace alone.
8. Effective tier gates UI; tier or bundled gates backend data access. Status
   is descriptive. Future status values do not invent a purchase/renewal CTA;
   unknown tiers and malformed quota responses fail unavailable.
9. Production no longer falls back to mock entitlement. Background C2 cache
   expires after 45 seconds and has no stale-on-error fallback. Entry reads
   are fresh. External API surfaces distinguish verified denial (403) from an
   unavailable platform decision (503); entitlement responses are no-store.
10. Consume explicitly reports actual use with a durable idempotency key.
    Only a validated HTTP 200 receipt acknowledges an outbox row, including
    gated reports. HTTP 409, malformed receipts and network failures retain
    the row. After five failures rows remain unflushed; the flush endpoint
    reports `exhausted` for operator recovery, with no discarded usage.
11. Central session validity follows `POST /oidc/session/status` and the
    server's `next_check_at` on actual requests. No background timer was added.
    Only explicit `valid:false` destroys the session; unavailable status or
    refresh returns unavailable. Redis serializes refresh across requests,
    atomically commits identity/tokens with existing TTL, and cannot restore
    a session deleted by concurrent logout. Permanent refresh failure still
    needs a controlled reauthorization UX in a later batch.
12. Status detection now reports product exchange configuration and an
    unavailable state; a legacy shared token never marks integration ready.

Configuration investigation: `40-register-a-product.md` explicitly scopes its
pure-page flow to platform-side registration. It describes one-time secret
handoff and database-generated edge maps; `080-rp-integration.md` still
describes product-side runtime settings. No product runtime-config delivery API
was established from these sources. Existing Arda env readers remain legacy
adapters; this batch does not claim automated configuration consumption or
authorize manual runtime variable changes. Resolve that delivery boundary
before production rollout.

No design-kit files, frozen Arda design, logo, welcome text, layout, artwork,
copyright, product prices or existing business data are changed.

## Coordinated domain cutover

### Live configuration inspection, 2026-11-21

The owner logged into Opera and completed its TOTP step-up. The existing stable
client `arda` now retains the old callback/logout allow-list entries and adds
`https://arda.ruyin.work/auth/callback` and `https://arda.ruyin.work/`.
The product form shows an update timestamp of 2026/11/21 16:24:22 and the saved
values. No client was created or rotated. Beta settings, edge domain, homepage,
upstream and back-channel logout target remain unchanged pending cutover.

Observed live registration: layer L2, full integration, stable and beta clients
active, PKCE required, back-channel logout enabled. Webhook is already registered
as `http://100.76.219.48:3230/api/webhooks/vxture`, with an existing secret
reference. Preserve this internal delivery address; changing the public domain
does not require moving the webhook onto public ingress.

Read-only platform recheck at 16:24:55 reports six active model grants, no
capability grant, four implementation confirmations pending, no Arda outbound
exchange in the last 90 days, and no Arda consume event in the last 90 days.
C2 was last observed at 16:22:21 via legacy shared credentials, with 397 legacy
calls this month. A test subscription is active. The drawer summary says all
stages completed/formal while expanded rows still report missing items; use the
individual observations, not the contradictory summary, as acceptance evidence.
No missing checklist item was manually marked complete or grant invented.

### Remaining cutover prerequisites

Read-only DNS lookup on 2026-11-21 returned NXDOMAIN for `arda.ruyin.work`.
Current platform main still contains the old `arda.vxture.com` edge vhost.
Runtime registration, installed certificates and authoritative DNS control
have not been verified. The domain is therefore **prepared in source, not live**.

1. Add `arda.ruyin.work` DNS targeting the shared public edge, not worker02.
   Verify the installed certificate's SANs; use existing platform certificate
   management if coverage is missing.
2. In Opera, update the existing Arda product (same code `arda`, layer L2):
   home/edge domain `arda.ruyin.work`, existing worker02 port 3230, webhook
   keep the registered internal webhook URL above. Preserve product, plan,
   subscription and workspace identifiers; do not create a replacement product.
3. Update the stable client `arda`: exact redirect
   `https://arda.ruyin.work/auth/callback`, post-logout
   `https://arda.ruyin.work/`, back-channel logout
   `https://arda.ruyin.work/auth/backchannel-logout`. Retain old callback
   allow-list entries during migration where supported. Beta is its own client.
4. Use the platform's configured edge synchronization to activate its generated
   routing. Confirm the new hostname reaches the intended worker02 stack.
   Do not install a product-owned vhost or modify server variables manually.
5. Verify Arda consumes the platform-managed integration configuration through
   the supported delivery/loading mechanism. Identify and migrate legacy
   env-only reads before claiming the configuration is applied. Do not create
   another configuration authority in `.env` or hard-coded public URLs.
6. Release through PR/checks/beta/tag/production Environment. Verify anonymous
   access, real login/returnTo, assigned/unassigned user access, expired or
   suspended subscription behavior, global logout and signed webhook delivery.
7. Final owner decision: keep only `arda.ruyin.work`, with no old-domain
   redirect or permanent dual entrance. After new-domain acceptance and the
   in-flight handshake window, remove the old public routing and old stable
   callback/logout allow-list entries through platform configuration. A new domain
   requires a new host-local RP session; never copy cookies across apexes.

## Implementation sequence

1. Implemented in source: domain/internal transport, C1 status, C2/C3 Bearer,
   assignment and effective-tier admission, receipt-safe reporting.
2. Before rollout: resolve platform-managed runtime configuration delivery,
   review permanent refresh failure/reauthorization and real integration access.
3. Remaining C3: validated event
   handling, provisioning reconciliation/ack and bounded invalidation.
4. L2: asset visible sets/grants, roster/profile and real product-to-product calls.
5. Coordinated production domain cutover and user-driven positive verification.

Each batch needs meaningful tests against wrong scope, revoked assignment,
transport failure, duplicate/out-of-order events and retries. Mock success is
not evidence of live platform registration, billing, SSO or successful delivery.

## Local validation of this batch

- 62 Node tests passed via `node --import tsx --test "app/**/*.test.ts"` from
  `portals/app`: wrong ticket context, assignment denial, tier admission, status
  failures, stale-cache rejection, receipt acknowledgment and retry identity.
- Next.js production build passed, including TypeScript and route generation.
- Isolated Redis 7 integration verified competing refresh lock rejection,
  atomic rotation, preserved session TTL and no resurrection after logout.
- Deployment contracts, DS usage, data architecture, docs numbering,
  `git diff --check`, and Compose configuration validation passed.
- The pnpm test wrapper attempted an automatic dependency synchronization and
  failed on npm tarball download timeouts. Direct tests and type-check above
  used the existing installed dependencies; no lockfile change was made.
- No real Arda exchange/consume, authenticated acceptance on the new domain,
  DNS write or deployment has been verified. Opera callback allow-list changes
  above are registration evidence only. New-domain DNS still returns NXDOMAIN.

## Live routing progress, 2026-11-21 17:08 CST

- Opera saved edge domain `arda.ruyin.work` at 17:05:55. Upstream remains
  `100.76.219.48:3230`; internal webhook, stable/beta callbacks and secrets
  were preserved. Homepage and back-channel logout remain on the old domain
  until product runtime origin and ordinary DNS access are aligned.
- Worker01 certificate is valid 2026-11-06 through 2027-02-04 and includes
  `*.ruyin.work`. The installed registered-product wildcard route is present.
- Regenerated the edge map with the platform's installed `render-agent-map.mjs`
  reading product registration. No hand-written vhost or server variable edits.
  Backed up the previous map under `/srv/vxture/runtime/backups/`.
  Nginx syntax validation and reload succeeded. The map now points the new
  domain at the same existing upstream. Old exact-host routing is retained
  until verified final cutover, not as a permanent second entrance.
- Source-targeted HTTPS with normal certificate validation returns health 200,
  service arda-app, production v0.12.0 / 9609a92. Login still generates
  `redirect_uri=https://arda.vxture.com/auth/callback`; updating registration
  alone does not update Arda's current runtime origin. No new release applied.
- Owner reports DNS was already configured. At 17:07, local, worker01,
  1.1.1.1, 8.8.8.8, Cloudflare authoritative nameservers and HTTPS DNS queries
  still returned NXDOMAIN for the exact `arda.ruyin.work` name. Preserve this
  discrepancy for verification; do not create a duplicate record blindly.
- Clarification pending: whether the prohibition on server-variable changes
  applies specifically to platform onboarding, or also to Arda's own normal
  deployment configuration. Current Arda deployment preserves the existing
  `etc/.env`; code release alone does not apply the new callback origin.

## Runtime configuration clarification and DNS resolution

The owner confirmed that the server-variable prohibition applies to the platform.
Arda runtime settings may change through normal product deployment. The reviewed
production/beta profiles now override legacy public origins and internal transport
settings after loading persistent secrets, without rewriting those secrets.
Deployment regression checks verify channel separation and retained image pins.
Profiles are explicitly tracked despite the general secret-file ignore rule.
Preference cookies are host-only, avoiding the former registrable-domain fallback
that would spread preferences to sibling products on the new host.

A subsequent resolver check returned A 39.103.62.17 with TTL 300. The prior
NXDOMAIN observations above describe the earlier state. DNS-only (gray cloud)
is appropriate for the existing TLS edge. Real authenticated acceptance and
production runtime cutover still require the release below; remaining C3 lifecycle
and resource-sharing work is not claimed complete by this deployment.
