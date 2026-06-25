#!/usr/bin/env bash
# Create DATA_DIR and BACKUP_DIR structure with correct perms.
#
# Two-host topology: no nginx/letsencrypt/certbot directories here. TLS lives on
# the shared worker-01 edge; this stack only persists Redis state.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/01-env.sh"
source "$SCRIPT_DIR/../lib/00-log.sh"

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  echo ""
  echo "  Usage: bash deploy/deploy.sh directories"
  echo ""
  echo "  Creates DATA_DIR and BACKUP_DIR structure with correct"
  echo "  permissions, plus the persistent operator config dir."
  echo ""
  echo "  Called automatically by: bash deploy/deploy.sh all"
  echo "  Run standalone:          bash deploy/deploy.sh directories"
  echo ""
  exit 0
fi

log_banner "Arda - Init Directories"

mk() {
  mkdir -p "$1"
  log_ok "mkdir -p $1"
}

# -- Data directories (persistent state; the only tree that is backed up) ------
log_step "Creating DATA_DIR structure at $DATA_DIR ..."

mk "$DATA_DIR/redis"

# -- Backup directory ----------------------------------------------------------
log_step "Creating BACKUP_DIR at $BACKUP_DIR ..."
mk "$BACKUP_DIR"

# -- Operator config dir (persistent home for .env; survives deploy re-pulls) --
# The deploy/ dir is disposable (CI rsyncs it fresh), so the hand-maintained
# .env lives here instead. The operator places .env; this only ensures the dir.
mk "$ROOT_DIR/etc"

# -- Permissions: sensitive directories ---------------------------------------
log_step "Setting permissions on sensitive directories..."

chmod 700 "$ROOT_DIR/etc"
log_ok "chmod 700 $ROOT_DIR/etc"

chmod 700 "$BACKUP_DIR"
log_ok "chmod 700 $BACKUP_DIR"

log_ok "Directory init complete."
