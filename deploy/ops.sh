#!/usr/bin/env bash
# Operations lifecycle dispatcher.
#
# Trigger: initial beta deployment marker.
#
# Usage:
#   bash deploy/ops.sh <command> [args]
#
# Two-host topology: there is no on-host nginx/TLS to reload here. The shared
# worker-01 edge owns TLS and config reloads.
#
# Commands:
#   status                         Show container status
#   logs [service]                 Tail container logs
#   restart [service]              Restart one or all services
#   reload                         Restart arda-app (no nginx on this host)
#   backup                         Create backup archive
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CMD="${1:-}"
shift || true

_usage() {
  echo ""
  echo "  Usage: bash deploy/ops.sh <command> [args]"
  echo ""
  echo "  Purpose:"
  echo "    Operate an already deployed Arda runtime."
  echo "    These commands should not bootstrap a fresh server or change release state."
  echo ""
  echo "  Runtime operations:"
  echo "    status                                Container status"
  echo "    logs [service]                        Tail logs"
  echo "    restart [service]                     Restart service(s)"
  echo "    reload                                Restart arda-app"
  echo "    backup                                Create backup"
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

  status)
    cd "$REPO_DIR"
    docker compose ps
    ;;

  logs)
    SERVICE="${1:-}"
    cd "$REPO_DIR"
    if [[ -z "$SERVICE" ]]; then
      docker compose logs -f --tail=50
    else
      docker compose logs -f --tail=50 "$SERVICE"
    fi
    ;;

  restart)
    SERVICE="${1:-}"
    cd "$REPO_DIR"
    if [[ -z "$SERVICE" ]]; then
      log_step "Restarting all services..."
      docker compose restart
      log_ok "All services restarted"
    else
      log_step "Restarting $SERVICE..."
      docker compose restart "$SERVICE"
      log_ok "$SERVICE restarted"
    fi
    ;;

  reload)
    # No nginx on this host (TLS/proxy is the worker-01 edge). The closest
    # equivalent is to restart the app container to pick up a new config/env.
    cd "$REPO_DIR"
    log_step "Restarting arda-app..."
    docker compose restart arda-app
    log_ok "arda-app restarted"
    ;;

  backup)
    exec bash "$SCRIPT_DIR/scripts/55-backup-runtime-state.sh"
    ;;

  *)
    log_error "Unknown ops command: $CMD"
    _usage
    exit 1
    ;;

esac
