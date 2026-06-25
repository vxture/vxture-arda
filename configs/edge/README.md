# Edge vhosts (worker-01 shared public edge)

These `.conf` files are the SOURCE ARTIFACTS for arda's public vhosts. arda does
not own the public edge - it only contributes these files. The edge itself lives
in the separate vxture monorepo and is shared by every vxture app.

## Topology

```
Browser
   |  https (:443, *.vxture.com wildcard cert)
   v
worker-01  = SHARED vxture public edge (nginx, TLS termination)
   |  http over tailscale (WireGuard-encrypted)
   v
worker-02  = PRIVATE compute, tailnet-only, NO public IP
             arda-app (published on APP_PUBLISH_PORT) + arda-redis
```

- worker-01 terminates TLS once for all apps using the wildcard `*.vxture.com`
  cert at `/etc/nginx/ssl/live/vxture.com/{fullchain,privkey}.pem`. arda reuses
  that same cert - it issues no cert of its own.
- worker-02 is private (tailnet IP `100.76.219.48`, MagicDNS short name
  `worker-02`). It runs only `arda-app` + `arda-redis`. There is NO per-service
  nginx and NO second TLS hop on worker-02: the edge proxies straight to the
  app's published port over tailscale (the house convention, same as varda-bff).

## Files

| File                         | Domain                  | Upstream            |
|------------------------------|-------------------------|---------------------|
| `arda.vxture.com.conf`       | `arda.vxture.com`       | `worker-02:3230`    |
| `beta-arda.vxture.com.conf`  | `beta-arda.vxture.com`  | `worker-02:3231`    |

Each file is a `:80` -> `:443` redirect plus a `:443` TLS server that proxies
`location /` to the app over tailscale.

## Install (on the vxture repo / worker-01)

1. Copy both `.conf` files into the vxture monorepo at
   `deploy/worker-01/nginx/sites-enabled/`.
2. On worker-01, run `20-sync-nginx-config.sh` to sync and reload nginx.

That is the entire integration surface. Nothing in this directory is consumed by
the arda compose stack; these files only ever live on the shared edge.

## Upstream: MagicDNS name vs raw IP (prerequisite)

The upstream is defined in exactly ONE labeled place per file:

```
resolver 100.100.100.100 valid=30s ipv6=off;   # tailscale MagicDNS
set $arda_upstream "worker-02:3230";            # beta file uses worker-02:3231
```

arda's policy prefers the MagicDNS NAME (`worker-02`) over a raw IP. But the
existing shared-edge nginx container resolves only Docker DNS (`127.0.0.11`), so
every existing vxture vhost hardcodes the worker-02 tailnet IP `100.76.219.48`.

Using the name here therefore requires one prerequisite: the edge container must
be able to query tailscale MagicDNS (`resolver 100.100.100.100`, reachable from
the container). If that prerequisite is NOT yet in place, change ONLY the single
`set $arda_upstream` line to the IP form:

```
set $arda_upstream "100.76.219.48:3230";   # beta: 100.76.219.48:3231
```

Either way it is a single-line change, and the upstream value never appears
anywhere else in the file.
