#!/usr/bin/env bash
# Create a timestamped backup of runtime config and persistent state.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/01-env.sh"
source "$SCRIPT_DIR/../lib/00-log.sh"

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  echo ""
  echo "  Usage: bash deploy/ops.sh backup"
  echo ""
  echo "  Creates timestamped backup archives of runtime state:"
  echo "    - .env file"
  echo "    - Redis append-only / snapshot data"
  echo "    - Crontab"
  echo ""
  echo "  Archives older than 30 days are automatically pruned."
  echo ""
  echo "  Run: bash deploy/ops.sh backup"
  echo ""
  exit 0
fi

log_banner "Arda - Backup"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# -- Environment ---------------------------------------------------------------
log_step "Backing up environment file..."
ENV_BACKUP="$BACKUP_DIR/env-${TIMESTAMP}.txt"
if [[ -f "$ROOT_DIR/etc/.env" ]]; then
  cp "$ROOT_DIR/etc/.env" "$ENV_BACKUP"
  chmod 600 "$ENV_BACKUP"
  log_ok "Environment -> $(basename "$ENV_BACKUP")"
else
  log_warn "Environment file not found at $ROOT_DIR/etc/.env - skipping"
fi

# -- Redis data ----------------------------------------------------------------
# Redis runs as a non-root uid inside the container and may write files the
# deploy user cannot read directly, so archive from a root container and hand
# ownership back to the deploy user (same pattern as the cert backup).
log_step "Backing up Redis data..."
REDIS_DATA="$DATA_DIR/redis"
if [[ -d "$REDIS_DATA" ]]; then
  REDIS_ARCHIVE="$BACKUP_DIR/redis-data-${TIMESTAMP}.tar.gz"
  HOST_UID="$(id -u)"
  HOST_GID="$(id -g)"
  docker run --rm \
    -v "$REDIS_DATA:/data/redis:ro" \
    -v "$BACKUP_DIR:/backup" \
    -e OUT="/backup/$(basename "$REDIS_ARCHIVE")" \
    -e HOST_UID="$HOST_UID" \
    -e HOST_GID="$HOST_GID" \
    alpine sh -c '
      set -eu
      tar -czf "$OUT" -C /data redis
      chown "$HOST_UID:$HOST_GID" "$OUT"
      chmod 600 "$OUT"
    '
  if tar -tzf "$REDIS_ARCHIVE" >/dev/null 2>&1; then
    SIZE=$(du -sh "$REDIS_ARCHIVE" | cut -f1)
    log_ok "Redis data -> $(basename "$REDIS_ARCHIVE") ($SIZE)"
  else
    log_error "Redis archive failed integrity check: $REDIS_ARCHIVE"
    exit 1
  fi
else
  log_warn "Redis data dir not found at $REDIS_DATA - skipping"
fi

# -- Crontab -------------------------------------------------------------------
log_step "Saving crontab..."
CRON_FILE="$BACKUP_DIR/crontab-${TIMESTAMP}.txt"
crontab -l 2>/dev/null > "$CRON_FILE" || echo "# no crontab" > "$CRON_FILE"
chmod 600 "$CRON_FILE"
log_ok "Crontab saved -> $(basename "$CRON_FILE")"

# -- Retention: delete archives older than 30 days -----------------------------
log_step "Cleaning up archives older than 30 days..."
DELETED=0
while IFS= read -r -d '' f; do
  if rm -f -- "$f"; then
    log_info "Removed: $(basename "$f")"
    DELETED=1
  fi
done < <(
  find "$BACKUP_DIR" -type f \( -name "*.tar.gz" -o -name "*.txt" \) -mtime +30 -print0 2>/dev/null
)

if [[ "$DELETED" == "0" ]]; then
  log_info "No old archives to remove"
fi

# -- Summary -------------------------------------------------------------------
echo ""
log_ok "Backup complete. Files in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR" | tail -20
