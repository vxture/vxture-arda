# Arda - Agent Entry Point

当前对接范围和恢复条件以[平台对接交接与长期记忆](20-platform-integration-handoff.md)为准。
先看平台交付，再按批次验收；I1 登录、退出和切换标签页已由用户暂缓。
下文旧版本、旧业务模块和历史验收记录只作背景，不作为当前任务。


> Master entry point for AI assistants (Claude Code, Codex, DeepSeek).
> Read this first. Follow document links for detail.

---

## Project Identity

```
Name:       Vxture Arda
Repo:       vxture/vxture-arda
Deploy host: ARDA_DEPLOY_HOST (private compute, tailnet-only)
User:       stone
Purpose:    Data capability portal shell - unified entry point for data work
```

**One-liner:**
> Arda is a single Next.js destination app: an OIDC relying party against
> accounts.vxture.com that gates users by subscription tier and lands them on a
> configurable default page. It is a shell - capability surfaces are built out
> behind it over time.

**Principles:**
- One app, one owned image (`arda-app`), two environments (beta + prod)
- Arda does not own identity; it delegates to accounts.vxture.com
- Arda does not own TLS; the shared public edge terminates it
- Tokens never reach the browser (BFF pattern: Redis + opaque session cookie)
- UI must consume `@vxture/design-system` - no ad-hoc styling
- Secrets never enter Git

---

## Service Inventory

| Service | Container | Purpose |
|---------|-----------|---------|
| Arda App | `arda-app` | Next.js OIDC RP / app-BFF, subscription gate, all UI surfaces |
| Redis | `arda-redis` | Server-side RP session store (authreq, tokens, sessions) |

Both containers run on a single Docker bridge network (`arda-net`). The app
publishes on `APP_PUBLISH_PORT` to the host tailnet interface; the shared public
edge reaches it there over tailscale.

---

## Domain Map

| Environment | Domain | Stack path | Tailnet port |
|-------------|--------|------------|--------------|
| prod | `arda.vxture.com` | `/srv/md0/arda` | 3230 |
| beta | `beta-arda.vxture.com` | `/srv/md1/arda-beta` | 3231 |

Both domains are served by the shared public edge with the wildcard
`*.vxture.com` cert. Arda contributes vhost source artifacts in `configs/edge/`;
it does not own or run nginx.

---

## Current State

Active browser-access remediation2026-11-23: see
`../70-workplan/50-browser-access-remediation-20261123.md` (A1-A6).
ADR-014 implementation candidate connects durable workspace invalidation,
atomic logout notifications, authenticated SSE and browser coordination.
Focus/visibility/input authority triggers are removed in the combined candidate.
This is not yet deployed or accepted. DDL0004 must precede deployment in each
environment; production database and application approvals remain human-only.
No platform source, server variables, routes or grants may be changed.

Arda is in active shell development. The OIDC RP, subscription gate, and
entitlement resolver are implemented. The `arda` claim from accounts.vxture.com
is read at session creation; a `MockEntitlementResolver` covers local dev and
the period before accounts emits the real claim. Capability surfaces
(`data-assets`, `integration`, `management`, `governance`, `services`) exist as
route stubs behind the auth-gated layout. CI/CD is fully operational:
`beta-*` tag -> beta, `v*.*.*` tag -> prod (required-reviewer approval).

---

## Document Map

| Document | Content |
|----------|---------|
| [`agent.md`](10-agent.md) | **This file.** Identity, service inventory, domain map, constraints |
| [`20-specs/10-product.md`](../20-specs/10-product.md) | Product scope and non-goals |
| [`20-specs/20-domains.md`](../20-specs/20-domains.md) | Domain responsibilities and public URL contracts |
| [`20-specs/30-security.md`](../20-specs/30-security.md) | Security boundaries: OIDC, session, cookie scope |
| [`30-design/10-architecture.md`](../30-design/10-architecture.md) | Traffic flow, container topology, server directory layout |
| [`30-design/20-modules.md`](../30-design/20-modules.md) | Per-service spec: config, volumes, ports, environment variables |
| [`30-design/decisions/00-index.md`](../30-design/decisions/00-index.md) | Design decisions: BFF pattern, entitlement model, env guard |
| [`30-design/40-entitlement.md`](../30-design/40-entitlement.md) | Subscription tier gating: ArdaClaim, states, tiers, resolver |
| [`30-design/10-identity-app-integration-standard.md`](../10-standards/10-identity-app-integration-standard.md) | Vxture App Integration Standard v1.0 (OIDC RP contract) |
| [`40-implementation/10-repository.md`](../40-implementation/10-repository.md) | Repository layout and source-of-truth paths |
| [`40-implementation/20-scripts.md`](../40-implementation/20-scripts.md) | Deployment script entrypoints and ordered steps |
| [`50-deployment/10-deployment.md`](../50-deployment/10-deployment.md) | Deploy steps, .env reference, verification checklist |
| [`50-deployment/20-checklists.md`](../50-deployment/20-checklists.md) | Scenario matrix, preservation contracts, deployment safety |
| [`60-operations/10-operations.md`](../60-operations/10-operations.md) | Backup, rollback, monitoring, routine operations |
| [`60-operations/20-github-actions.md`](../60-operations/20-github-actions.md) | CI/CD design, quality gate, promotion contract |
| [`90-memory/README.md`](README.md) | Pointer to where Claude's persistent memory lives |

---

## Global Build Constraints

1. **Single owned image** - arda builds exactly `arda-app`. No other images.
2. **Two environments, one compose file** - `PROJECT_NAME` drives container name
   prefixes so prod (`arda-*`) and beta (`arda-beta-*`) never collide on the
   same host.
3. **No on-host TLS or nginx** - the shared public edge is the only TLS hop.
   Arda publishes plain HTTP on the tailnet port; the edge proxies over tailscale.
4. **BFF session model** - OIDC tokens live in Redis server-side. The browser
   holds only an opaque `vx_rp_session` cookie, host-only (no leading dot).
5. **Cookie scope is host-only** - `RP_SESSION_COOKIE_DOMAIN` is set to the
   exact host (`arda.vxture.com`, no leading dot) so the session cannot leak to
   sibling `*.vxture.com` subdomains.
6. **Design-system enforcement** - `@vxture/design-system` is the only source
   for UI primitives. Raw ad-hoc styling fails `quality-gate` (09-check-ds-usage).
7. **Secrets never in Git** - `.env`, client secrets, and `NODE_AUTH_TOKEN` are
   runtime values only. `.env.example` is the schema; `.env` is git-ignored.
8. **ASCII-only in contract paths** - `.github`, `configs`, `scripts`, `services`,
   `deploy`, `portals`, `docs`, and root meta files must contain ASCII only.
   Em-dashes, smart quotes, and non-ASCII fail `quality-gate`.
9. **Stacks must never share state** - prod and beta each have their own `.env`,
   data directory, Redis instance, and container network. Cross-env state is a
   deployment invariant violation.
10. **Deploy scripts are idempotent** - safe to re-run without destroying state.

## Explicit roles implementation checkpoint - 2026-11-23

Owner/administrator/member/readonly/guest implementation is under verification.
New authorized members receive a persisted readonly assignment once; existing
roleless/inactive members stay denied. Owner transfer/bootstrap is explicit and
audited. Platform authorization revocation overrides all retained local roles.
See [R1-R5 delivery tracker](../70-workplan/60-explicit-product-roles-20261123.md).
Production migration and application deployment succeeded. Do not rerun the
cancelled implicit-member candidates or modify platform sources/variables.

Implementation merged: Arda PR241/19b9865 and Karda PR259/f37a421; both full main
CI runs pass. DB jobs45115384853 (Arda) and45115340531 (Karda) succeeded.
Continue from60-explicit-product-roles-20261123.md for remaining live acceptance.

Both production DB jobs now SUCCEEDED after owner approval: Arda45115384853
(30tables/3enums),Karda45115340531(41tables). Application deployments succeeded:
Arda v0.13.5/e3b9802/run45119134449 and Karda v0.11.8/01e7065a/run45119134160.
Canonical-domain readiness confirms the releases and healthy dependencies.
Anonymous members APIs and supported business APIs reject unauthenticated access.
Owner login restored; both members pages show the authorized product owner and
disable ordinary role editing of that owner. No manual bootstrap submitted.
Tab-switch inputs preserved Arda's page; full visibility trace is still open.
Synthetic-member/roleless/revocation/notification/OBO acceptance remains pending.
No real member/owner/seat changes. Platform731/726 remain active integration gaps.

## Current owner scope - 2026-11-23 integration closure

Use [I0-I6 tracker](../70-workplan/70-integration-closure-20261123.md) as current
authority. Legacy product features will be rebuilt: stop Curator/source/quality
and Karda index/retrieval/answer optimization or acceptance. Mark them
reconstruction-replaced, never accepted. Atlas147 is external history, not a
blocker for this closure; generic AI attribution/credit contracts stay in I5.
Keep identity/session,explicit roles,platform authorization/messages,managed
domain/configuration,commercial/C2/C3/gauge/lifecycle/OBO and handoff.
Both old domains still serve200; managed retirement stays platform721/727.
Browser access unavailable in this chat; do not confuse that with login failure.
Dedicated non-owner test-member display identifier supplied in local handoff;
actual authorized subject/workspace unresolved. No privileges/subscriptions changed.
I0 COMPLETE: Arda245/740b368,main45126707329;Karda263/4e59ac1,main45126741617,
both CI and secret scans pass. Current batch I1 IN PROGRESS/PARTIAL;I2 PARTIAL;
I3 EXTERNAL BLOCK/PARTIAL;I4 EXTERNAL BLOCK;I5 PARTIAL;I6 NOT COMPLETE.
Use the explicit checkbox list in70-integration-closure-20261123.md.
