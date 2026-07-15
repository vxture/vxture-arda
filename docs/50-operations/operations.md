# Arda - Operations

---

## Routine Operations

### Check Stack Health

```bash
ssh stone@<ARDA_DEPLOY_HOST-tailscale-ip>

# Prod:
cd /srv/md0/arda
bash deploy/ops.sh status

# Beta:
cd /srv/md1/arda-beta
bash deploy/ops.sh status
```

Expected output: `arda-app` and `arda-redis` (or `arda-beta-app` and
`arda-beta-redis`) both showing `Up (healthy)`.

### View Logs

```bash
bash deploy/ops.sh logs arda-app    # App logs (last 100 lines, follow)
bash deploy/ops.sh logs arda-redis  # Redis logs
```

Or directly with Docker:

```bash
docker compose logs -f --tail=100 arda-app
docker compose logs -f --tail=100 arda-redis
```

### Restart Services

```bash
bash deploy/ops.sh restart             # Restart all containers
bash deploy/ops.sh restart arda-app    # Restart app only (Redis keeps running)
```

### Pull and Reload (same image tag)

```bash
bash deploy/ops.sh reload   # docker compose pull + up -d
```

---

## Backup

### Manual Backup

```bash
bash deploy/ops.sh backup
```

Snapshots Redis AOF to `$BACKUP_DIR`. Backup archives are named with a
timestamp and the `PROJECT_NAME` prefix.

### Backup Cron

`30-run-full-deployment.sh` installs a daily backup cron during deploy:

```
0 2 * * * /srv/md0/arda/deploy/ops.sh backup >> /var/log/arda-backup.log 2>&1
```

Check the cron is installed: `crontab -l | grep arda`

### Verify Backup Contents

```bash
ls -lh $BACKUP_DIR/
```

---

## Redis Operations

### Check Session Count

```bash
docker compose exec arda-redis redis-cli DBSIZE
```

### Inspect a Session

```bash
docker compose exec arda-redis redis-cli KEYS "rpsess:*" | head -5
docker compose exec arda-redis redis-cli TTL "rpsess:<session-id>"
```

### Flush All Sessions (last resort)

```bash
docker compose exec arda-redis redis-cli FLUSHALL
```

This invalidates all active sessions. All logged-in users must re-authenticate.
Use only for security incidents or post-rollback schema incompatibility.

### Check Redis Persistence

Redis runs with `appendonly yes`. Verify the AOF file is present:

```bash
ls -lh $DATA_DIR/redis/
# Expected: appendonly.aof
```

---

## OIDC and Session Operations

### Clear a Specific User's Session (Back-Channel Logout)

If the IdP cannot reach `/auth/backchannel-logout` (e.g., network issue),
manually invalidate a session:

1. Find the session ID from the Redis keys (requires knowing the user's
   `sub` claim or session cookie value)
2. Delete the relevant `rpsess:`, `rptok:`, and `sid:` keys:
   ```bash
   docker compose exec arda-redis redis-cli DEL "rpsess:<id>"
   docker compose exec arda-redis redis-cli DEL "rptok:<id>"
   ```

### Rotate OIDC Client Secret

1. Update `OIDC_CLIENT_SECRET` in `<ROOT_DIR>/etc/.env`
2. Restart the app: `bash deploy/ops.sh restart arda-app`
3. Existing sessions remain valid (they use the stored refresh token, not the
   client secret directly); new logins use the new secret
4. If the old secret is revoked before restart, active refresh attempts will
   fail and users will be logged out on next token expiry

---

## Rollback

Prefer the automated workflow (production rollback still requires
required-reviewer approval, same as a normal deploy):

```bash
gh workflow run rollback.yml -f environment=production -f commit_sha=<sha>
```

Manual fallback:

```bash
# Find the previous SHA from the CI run history
gh run list --workflow deploy.yml --limit 10

# On the server:
cd /srv/md0/arda
IMAGE_TAG=sha-<previous-sha> docker compose pull arda-app
IMAGE_TAG=sha-<previous-sha> docker compose up -d arda-app
bash deploy/deploy.sh verify
```

Redis data is unaffected by image rollback. If the rollback crosses a Redis
schema boundary, flush sessions (see Redis Operations above).

---

## Reset (Broken State Recovery)

```bash
bash deploy/server.sh reset
```

Stops all containers and clears `RUNTIME_DIR`. Does NOT touch:
- `DATA_DIR/redis/` (session data preserved)
- `etc/.env` (operator config preserved)

After reset, re-deploy: `bash deploy/deploy.sh all`

---

## Monitoring

There is no automated uptime monitoring installed by default. Options:

- **Manual health check:** `curl https://arda.vxture.com/api/health`
- **Tailnet direct check:** `curl http://127.0.0.1:3230/api/health` (from server)
- **External monitoring:** Configure an uptime checker against `https://arda.vxture.com/api/health`

Container health is checked by Docker itself (`healthcheck` in `docker-compose.yml`).
`docker compose ps` shows the health status. With `restart: always`, a crashed
container restarts automatically; check `docker compose logs` if it keeps
restarting.

---

## Edge Vhost Operations

Arda does not own the shared public edge. To update the vhost config:

1. Modify `configs/edge/arda.vxture.com.conf` or
   `configs/edge/beta-arda.vxture.com.conf` in this repo
2. Open a PR, merge to develop (for beta vhost) or promote to main (for prod vhost)
3. An operator copies the updated `.conf` files into the vxture project repo
4. Run `20-sync-nginx-config.sh` on the edge host
5. Verify: `curl -I https://arda.vxture.com/api/health`

The edge vhost is not deployed by Arda CI. The CI contract check
(`06-check-deploy-contracts.py`) validates that the `configs/edge/` artifacts
are self-consistent but does not push them to the edge.
