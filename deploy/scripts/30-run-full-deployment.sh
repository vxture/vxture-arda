#!/usr/bin/env bash
# Full deployment: runs all steps in order. Safe to re-run - each step is
# idempotent where possible.
#
# Two-host topology: environment -> directories -> start -> verify. No cert or
# nginx-config step; TLS lives on the shared worker-01 edge.
#
# Options:
#   --skip-verify    Skip the verification step (useful on re-deploys)
#   --skip-backup    Skip the backup step
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/01-env.sh"
source "$SCRIPT_DIR/../lib/00-log.sh"

SKIP_VERIFY=false
SKIP_BACKUP=false
for arg in "$@"; do
  case "$arg" in
    --skip-verify) SKIP_VERIFY=true ;;
    --skip-backup) SKIP_BACKUP=true ;;
  esac
done

if [[ "$EUID" -eq 0 ]]; then
  log_error "Do not run as root. Switch to the admin user."
  log_error "Root-owned files in DATA_DIR will break subsequent runs by the admin user."
  exit 1
fi

log_banner "Arda - Full Deployment"
log_info "Node:    $NODE_NAME"
log_info "Project: $PROJECT_NAME"
log_info "Domain:  $APEX_DOMAIN (fronted by the worker-01 edge)"
log_info "Publish: 127.0.0.1:$APP_PUBLISH_PORT (tailnet)"
log_info "Data:    $DATA_DIR"
log_info "Backup:  $BACKUP_DIR"
echo ""

run_step() {
  local step="$1"
  local label="$2"
  log_step "[$step] $label"
  bash "$SCRIPT_DIR/$step" || {
    log_error "Step $step failed. Deployment aborted."
    exit 1
  }
  echo ""
}

run_step_warn() {
  local step="$1"
  local label="$2"
  log_step "[$step] $label"
  bash "$SCRIPT_DIR/$step" || {
    log_warn "Step $step reported failures - services may still be running."
    log_warn "Check manually: bash deploy/deploy.sh verify"
  }
  echo ""
}

run_step "11-check-runtime-environment.sh"   "Environment check"
run_step "12-prepare-runtime-directories.sh" "Initialize directories"

# -- Pre-deployment backup: snapshot before containers restart -----------------
if [[ "$SKIP_BACKUP" == "true" ]]; then
  log_info "Skipping pre-deployment backup (--skip-backup)"
else
  log_step "[pre-backup] Creating pre-deployment backup snapshot..."
  bash "$SCRIPT_DIR/55-backup-runtime-state.sh" || {
    log_warn "Pre-deployment backup reported warnings - proceeding anyway"
  }
  echo ""
fi

run_step "23-start-docker-services.sh" "Pull images and start services"

# -- Configure backup cron -----------------------------------------------------
log_step "Configuring cron jobs..."

BACKUP_CRON_LINE="0 2 * * * $REPO_DIR/ops.sh backup >> /var/log/${PROJECT_NAME}-backup.log 2>&1"

add_cron() {
  local line="$1"
  if ! crontab -l 2>/dev/null | grep -qF "$line"; then
    ( crontab -l 2>/dev/null || true; echo "$line" ) | crontab -
    log_ok "Cron added: $line"
  else
    log_info "Cron already exists: $(echo "$line" | cut -c1-60)..."
  fi
}

add_cron "$BACKUP_CRON_LINE"
echo ""

# -- Post-deployment backup ----------------------------------------------------
if [[ "$SKIP_BACKUP" == "true" ]]; then
  log_info "Skipping post-deployment backup (--skip-backup)"
else
  bash "$SCRIPT_DIR/55-backup-runtime-state.sh" || {
    log_warn "Post-deployment backup reported warnings - services may still be running."
    log_warn "Check manually: bash deploy/ops.sh backup"
  }
  echo ""
fi

if [[ "$SKIP_VERIFY" == "true" ]]; then
  log_info "Skipping verification (--skip-verify)"
else
  run_step_warn "24-verify-deployment.sh" "Verify deployment"
fi

# -- Done ----------------------------------------------------------------------
echo ""
log_banner "Deployment Complete"
log_ok "All services are running."
echo ""
echo "  App (public, via edge):  https://$APEX_DOMAIN"
echo "  App (tailnet, direct):   http://127.0.0.1:$APP_PUBLISH_PORT/api/health"
echo ""
echo "  Next steps:"
echo "  1. Confirm the worker-01 edge vhost is installed (configs/edge/)."
echo "  2. Confirm OIDC login works: open https://$APEX_DOMAIN/auth/login"
echo "  3. (Optional) set up external uptime monitoring"
echo ""
