# Edge vhosts (edge host)

These `.conf` files are legacy source artifacts retained for migration history.
L2/L3 product ingress is now platform configuration-managed. Change the product's
edge settings in the platform; do not install these files or edit server env
variables to change integration. The shared public edge belongs to the platform.

## Topology

```
Browser
   |  https (:443, certificate SAN must cover the selected product domain)
   v
EDGE HOST  = SHARED public edge (nginx, TLS termination)
   |  http over tailscale (WireGuard-encrypted)
   v
ARDA_DEPLOY_HOST  = PRIVATE compute, tailnet-only, NO public IP
             arda-app (published on APP_PUBLISH_PORT) + arda-redis
```

- The edge terminates TLS. The shared certificate path is
  `/etc/nginx/ssl/live/vxture.com/{fullchain,privkey}.pem`. Before enabling
  `arda.ruyin.work`, verify that the installed certificate includes
  `arda.ruyin.work` or `*.ruyin.work` in its SANs. A certificate covering only
  `*.vxture.com` is insufficient. Arda does not issue certificates itself.
- ARDA_DEPLOY_HOST is private (tailnet IP `100.76.219.48`, MagicDNS short name
  `ARDA_DEPLOY_HOST`). It runs only `arda-app` + `arda-redis`. There is NO per-service
  nginx and NO second TLS hop on ARDA_DEPLOY_HOST: the edge proxies straight to the
  app's published port over tailscale (the house convention, same as karda).

## Files

| File                         | Domain                  | Upstream            |
|------------------------------|-------------------------|---------------------|
| `arda.vxture.com.conf`       | `arda.vxture.com` (migration only) | `ARDA_DEPLOY_HOST:3230` |
| `beta-arda.vxture.com.conf`  | `beta-arda.vxture.com`  | `ARDA_DEPLOY_HOST:3231`    |

Each file is a `:80` -> `:443` redirect plus a `:443` TLS server that proxies
`location /` to the app over tailscale.

## Activate platform routing

1. Complete the coordinated cutover in
   [the platform alignment audit](../../docs/70-workplan/30-platform-l2-alignment.md).
   DNS, certificate coverage and the platform client/edge/webhook registration
   must be ready before changing the running app's public origin.
2. Update platform product configuration and use its generated routing/sync;
   do not install a hand-written production vhost.
3. Retain the old vhost until the new domain passes login/logout verification.
   Then remove old routing/allow-lists through platform configuration. Final
   production has only `arda.ruyin.work`, with no old-domain redirect.

That is the entire integration surface. Nothing in this directory is consumed by
the arda compose stack; these files only ever live on the shared edge.

## Upstream: MagicDNS name vs raw IP (prerequisite)

The upstream is defined in exactly ONE labeled place per file:

```
resolver 100.100.100.100 valid=30s ipv6=off;   # tailscale MagicDNS
set $arda_upstream "ARDA_DEPLOY_HOST:3230";            # beta file uses ARDA_DEPLOY_HOST:3231
```

arda's policy prefers the MagicDNS NAME (`ARDA_DEPLOY_HOST`) over a raw IP. But the
existing shared-edge nginx container resolves only Docker DNS (`127.0.0.11`), so
every existing vxture vhost hardcodes the ARDA_DEPLOY_HOST tailnet IP `100.76.219.48`.

Using the name here therefore requires one prerequisite: the edge container must
be able to query tailscale MagicDNS (`resolver 100.100.100.100`, reachable from
the container). If that prerequisite is NOT yet in place, change ONLY the single
`set $arda_upstream` line to the IP form:

```
set $arda_upstream "100.76.219.48:3230";   # beta: 100.76.219.48:3231
```

Either way it is a single-line change, and the upstream value never appears
anywhere else in the file.
