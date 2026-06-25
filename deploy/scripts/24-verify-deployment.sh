#!/usr/bin/env bash
# Post-deployment verification suite. All checks are read-only.
#
# Two-host topology: this stack is plain HTTP on worker-02's tailnet, so the app
# is verified directly on its published port. TLS / the public domain / the
# OIDC login surface are fronted by the shared worker-01 edge and are verified
# there, not here.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/01-env.sh"
source "$SCRIPT_DIR/../lib/00-log.sh"

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  echo ""
  echo "  Usage: bash deploy/deploy.sh verify"
  echo ""
  echo "  Runs post-deployment verification: container health, the app"
  echo "  /api/health endpoint on the tailnet publish port, redis, and the"
  echo "  backup cron job. All checks are read-only."
  echo ""
  echo "  Called automatically by: bash deploy/deploy.sh all"
  echo "  Run standalone:          bash deploy/deploy.sh verify"
  echo ""
  exit 0
fi

log_banner "Arda - Verification"

PASS=0
FAIL=0

# -- Container status ----------------------------------------------------------
log_step "Container health..."

CONTAINERS=(
  "${PROJECT_NAME}-redis"
  "${PROJECT_NAME}-app"
)

cd "$REPO_DIR"
for c in "${CONTAINERS[@]}"; do
  state=$(docker inspect "$c" --format '{{.State.Status}}' 2>/dev/null || echo "missing")
  if [[ "$state" == "running" ]]; then
    log_ok "$c: running"
    (( ++PASS ))
  else
    log_fail "$c: $state"
    (( ++FAIL ))
  fi
done

# -- App health (plain HTTP on the tailnet publish port) -----------------------
# TLS is terminated at the edge; on worker-02 the app speaks plain HTTP. Probe
# the published port on loopback so this works without any tailscale routing.
log_step "App health endpoint..."
HEALTH_URL="http://127.0.0.1:${APP_PUBLISH_PORT}/api/health"
if curl -fsS --max-time 10 "$HEALTH_URL" >/dev/null 2>&1; then
  log_ok "App /api/health responds ($HEALTH_URL)"
  (( ++PASS ))
else
  log_fail "App /api/health did not respond ($HEALTH_URL)"
  (( ++FAIL ))
fi

# -- Redis ---------------------------------------------------------------------
log_step "Redis..."
REDIS_PING=$(docker exec "${PROJECT_NAME}-redis" redis-cli ping 2>/dev/null || echo "")
if [[ "$REDIS_PING" == "PONG" ]]; then
  log_ok "Redis responds to PING"
  (( ++PASS ))
else
  log_fail "Redis did not respond to PING (got '$REDIS_PING')"
  (( ++FAIL ))
fi

# -- Cron jobs -----------------------------------------------------------------
log_step "Cron jobs..."

BACKUP_CRON="0 2 * * * $REPO_DIR/ops.sh backup >> /var/log/${PROJECT_NAME}-backup.log 2>&1"
CRONTAB_CONTENT="$(crontab -l 2>/dev/null || true)"

if grep -Fxq "$BACKUP_CRON" <<< "$CRONTAB_CONTENT"; then
  log_ok "Backup cron installed"
  (( ++PASS ))
else
  log_fail "Backup cron missing"
  (( ++FAIL ))
fi

# -- Result --------------------------------------------------------------------
echo ""
log_info "Results: ${PASS} passed, ${FAIL} failed"

if (( FAIL > 0 )); then
  log_error "Verification failed ($FAIL checks). Review logs above."
  exit 1
fi
log_ok "All verification checks passed."
