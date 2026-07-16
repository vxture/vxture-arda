# Arda - Agent Entry Point

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
