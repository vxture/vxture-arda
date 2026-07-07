# Vxture Arda

Arda is a single destination app for data capability work: a unified entry point
for data asset, integration, management, governance, and service platform
surfaces. It is shell-only for now - the app authenticates users, gates them by
subscription tier, and lands them on a configurable default page; the capability
surfaces are built out behind that shell over time.

**Stack:** Next.js (`arda-app`) / Redis / Postgres, behind the shared public edge

**Repo:** `github.com/vxture/vxture-Arda`

---

## What it is

- OIDC relying party against `accounts.vxture.com`. Arda does not own identity;
  it delegates sign-in to the central accounts service and consumes the
  resulting session.
- Subscription-tier gate. After authentication a pluggable resolver determines
  the user's tier (`free` / `starter` / `pro` / `business` / `enterprise`). The
  resolver is an interface so the backing source can change without touching
  the gate.
- Configurable default landing. Once authenticated and gated, the user lands on
  a configurable default page (default `/data-assets/overview`).

---

## Architecture

Two-host topology. The shared public edge terminates TLS with
the wildcard `*.vxture.com` cert and reverse-proxies over tailscale to ARDA_DEPLOY_HOST,
which is private compute (tailnet-only, no public IP) running `arda-app` +
`arda-redis` + `arda-db` only. There is no on-host TLS or nginx in this repo.

```
Browser
   |  https (:443, *.vxture.com wildcard cert)
   v
EDGE HOST  (SHARED public edge: nginx, TLS termination)
   |  http over tailscale (WireGuard-encrypted) -> ARDA_DEPLOY_HOST:APP_PUBLISH_PORT
   v
ARDA_DEPLOY_HOST  (PRIVATE compute, tailnet-only, no public IP)
   |
arda-app (Next.js, published on APP_PUBLISH_PORT)
   |- /            -> Next.js pages
   |- /api/*       -> Next.js route handlers
   |- OIDC RP      -> accounts.vxture.com (sign-in / token exchange)
   |- tier gate    -> PlatformEntitlementResolver (C2: GET /platform/entitlements, 45s TTL)
   |- provisioning -> /provisioning/webhook (C3: HMAC-SHA256, 4 event types)
   |- usage buffer -> UsageRaw -> POST /usage/consume (C3)
   |- /.well-known/vxture-tools -> L0 tool protocol (v1 empty)
   |- session / cache -> arda-redis
   |- workspace data -> arda-db (Postgres, workspace-isolated)
   `- default landing -> /data-assets/overview (configurable)
```

arda contributes its public vhost as source artifacts in `configs/edge/*.conf`;
an operator installs them on the edge host. There is no separate
console/admin app and no VPN stack - Arda is one app, one owned image
(`arda-app`), two environments.

---

## Domains and environments

| Environment | Domain | Stack path (ARDA_DEPLOY_HOST) | Tailnet port (`APP_PUBLISH_PORT`) |
|-------------|--------------------------|------------------------|-----------------------------------|
| prod | `arda.vxture.com` | `/srv/md0/arda` | 3230 |
| beta | `beta-arda.vxture.com` | `/srv/md1/arda-beta` | 3231 |

Both are direct subdomains of `vxture.com`, served by the public edge with
the wildcard `*.vxture.com` cert. Each stack publishes `arda-app` on its own
tailnet port (`APP_PUBLISH_PORT`); the edge upstream targets
`ARDA_DEPLOY_HOST:APP_PUBLISH_PORT` over tailscale. Beta advances automatically on every
push to `develop`; prod advances only via the manual `develop` -> `main`
promotion. See [CLAUDE.md](CLAUDE.md) for the branch and promotion model.

> [OK] **CI/CD pipeline fully operational** -- `develop` -> beta (auto), promote -> `main` -> prod (manual confirm).

---

## Local development

Arda uses a dedicated local-only port to stay clear of other Vxture dev ports.

| Port | Service | URL |
|------|---------|--------------------------|
| 3230 | Arda app | `http://localhost:3230` |

The repo is an npm workspace rooted at `portals/` (members `app` and
`packages/shared`). Design-system and shared packages `@vxture/design-system`
and `@vxture/shared` are pulled from GitHub Packages; the local shared package
is `@arda/shared`. A `NODE_AUTH_TOKEN` with read access to GitHub Packages must
be set so `npm ci` can resolve the `@vxture` scope (see root `.npmrc`).

```bash
cd portals
npm ci
npm run dev -w @arda/app   # http://localhost:3230
```

If local Vxture SSO origin checks are enabled, allow `http://localhost:3230` as
an Arda OIDC callback origin against `accounts.vxture.com`.

---

## Deploy

Arda deploys to `ARDA_DEPLOY_HOST` (private compute, reached by its tailscale name/IP,
same segment as the edge host). Two independent stacks live on that host: `/srv/md0/arda`
(prod) and `/srv/md1/arda-beta` (beta). Each release builds the one owned image
(`arda-app`) and deploys the stack matching the pushed branch (`develop` -> beta,
`main` -> prod). The deploy starts `arda-app` + `arda-redis` + `arda-db` and publishes the
app on `APP_PUBLISH_PORT`; TLS and the public domain are handled by the public
edge, which fronts the app with the wildcard `*.vxture.com` cert.

```bash
ssh stone@<ARDA_DEPLOY_HOST-tailscale-ip>
cd /srv/md0/arda            # or /srv/md1/arda-beta for the beta stack
bash deploy/deploy.sh all
```

`deploy/deploy.sh` owns the deployment lifecycle (environment -> directories ->
start -> verify). CI normally runs this for you on a release; the manual form
above is for operator intervention. The two stacks must never share an `.env`
file or data directory.

The public vhost arda contributes to the edge lives in `configs/edge/` (one
`.conf` per environment). An operator installs them on the edge host by copying them
into the vxture project repository and running
`20-sync-nginx-config.sh`; see [configs/edge/README.md](configs/edge/README.md).

---

## Environment configuration

All runtime configuration is supplied via `.env`. Copy the template and fill in
the required values:

```bash
cp .env.example .env
```

`.env.example` is the authoritative reference for every supported variable
(OIDC client config for `accounts.vxture.com`, subscription-resolver settings,
default landing page, Redis connection, Postgres DB config, platform API auth,
provisioning webhook secret, and per-environment domain values).
`.env` is git-ignored and never committed.

---

## Design-system rule

App UI must consume `@vxture/design-system` primitives instead of
re-implementing them. This is enforced strictly in CI by
`scripts/checks/09-check-ds-usage.py` as part of `quality-gate`; raw ad-hoc
styling that bypasses the design system fails the build.

See [CLAUDE.md](CLAUDE.md) for the full repository working agreement: branch
model, promotion flow, CI/CD pipeline, and contract checks (including the
ASCII-only rule over source, config, and root meta files).
