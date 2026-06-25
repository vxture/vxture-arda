#!/usr/bin/env bash
# Deployment lifecycle dispatcher.
#
# Usage:
#   bash deploy/deploy.sh <command> [args]
#
# The same scripts deploy either stack; which stack is decided by which root
# they run from (PROJECT_ROOT = lib/../.. = /srv/arda or /srv/arda-beta) and the
# .env found at $PROJECT_ROOT/etc/.env.
#
# Two-host topology: this stack is app + redis only, plain HTTP on worker-02's
# tailnet. TLS / the public domain live on the shared worker-01 edge, so there
# is no certificate or nginx-config step in this lifecycle.
#
# Commands:
#   all [--skip-verify] [--skip-backup]   Full deployment pipeline
#   environment                            Validate environment
#   directories                            Initialize runtime + data directories
#   start                                  Pull images and start containers
#   verify                                 Verify containers and endpoints
#
# Legacy aliases (kept for muscle memory):
#   check -> environment   dirs -> directories   up -> start
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CMD="${1:-}"
shift || true

_usage() {
  echo ""
  echo "  Usage: bash deploy/deploy.sh <command> [args]"
  echo ""
  echo "  Purpose:"
  echo "    Deploy the Arda runtime from repository source and environment values."
  echo "    This is the entrypoint used by CI after the image build succeeds."
  echo ""
  echo "  Deployment lifecycle:"
  echo "    all [--skip-verify] [--skip-backup] Full deployment pipeline"
  echo "    environment                         Validate environment"
  echo "    directories                         Initialize runtime + data dirs"
  echo "    start                               Pull images and start containers"
  echo "    verify                              Verify deployment"
  echo ""
  echo "  CI/CD path:"
  echo "    image-build success -> deploy.sh all -> deploy.sh verify"
  echo ""
  echo "  Legacy aliases (still accepted):"
  echo "    check|dirs|up"
  echo ""
  echo "  Operational commands moved to:"
  echo "    bash deploy/ops.sh <status|logs|restart|reload|backup>"
  echo ""
}

case "$CMD" in
  ""|-h|--help|help)
    _usage
    exit 0
    ;;
esac

source "$SCRIPT_DIR/lib/01-env.sh"
source "$SCRIPT_DIR/lib/00-log.sh"

case "$CMD" in

  all)
    exec bash "$SCRIPT_DIR/scripts/30-run-full-deployment.sh" "$@"
    ;;

  # -- Canonical names ---------------------------------------------------------
  environment|check)
    exec bash "$SCRIPT_DIR/scripts/11-check-runtime-environment.sh"
    ;;

  directories|dirs)
    exec bash "$SCRIPT_DIR/scripts/12-prepare-runtime-directories.sh"
    ;;

  start|up)
    exec bash "$SCRIPT_DIR/scripts/23-start-docker-services.sh"
    ;;

  verify)
    exec bash "$SCRIPT_DIR/scripts/24-verify-deployment.sh"
    ;;

  backup|status|logs|reload|restart)
    log_error "'$CMD' is an operations command."
    log_info "Use: bash deploy/ops.sh $CMD $*"
    exit 1
    ;;

  *)
    log_error "Unknown deploy command: $CMD"
    _usage
    exit 1
    ;;

esac
