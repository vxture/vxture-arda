#!/usr/bin/env bash
# Server lifecycle dispatcher.
#
# Usage:
#   bash deploy/server.sh <command> [args]
#
# Commands:
#   init              Bootstrap a fresh server; run as root
#   reset [--full]    Stop or wipe this stack; run as admin user
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CMD="${1:-}"
shift || true

_usage() {
  echo ""
  echo "  Usage: bash deploy/server.sh <command> [args]"
  echo ""
  echo "  Purpose:"
  echo "    Manage deploy host lifecycle tasks."
  echo "    Use this for first-time server bootstrap or explicit reset only."
  echo ""
  echo "  Server lifecycle:"
  echo "    init              Install Docker + admin user, prepare ROOT_DIR"
  echo "    reset [--full]    Stop containers or wipe runtime data"
  echo ""
  echo "  ROOT_DIR selects the stack for init (default /srv/arda):"
  echo "    ROOT_DIR=/srv/arda       sudo bash deploy/server.sh init   # prod"
  echo "    ROOT_DIR=/srv/arda-beta  sudo bash deploy/server.sh init   # beta"
  echo ""
}

case "$CMD" in
  -h|--help|help)
    _usage
    exit 0
    ;;
  init)
    exec bash "$SCRIPT_DIR/scripts/10-bootstrap-server.sh" "$@"
    ;;
  reset)
    exec bash "$SCRIPT_DIR/scripts/60-reset-runtime-services.sh" "$@"
    ;;
  "")
    _usage
    exit 1
    ;;
  *)
    echo "[ERROR] Unknown server command: $CMD" >&2
    _usage
    exit 1
    ;;
esac
