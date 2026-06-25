#!/usr/bin/env bash
# Check all prerequisites before deployment.
#
# Two-host topology: this stack is plain HTTP on worker-02's tailnet. TLS and the
# public domain live on the shared worker-01 edge, so there are no cert, nginx,
# or public-DNS checks here - only the app + redis runtime contract.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/01-env.sh"
source "$SCRIPT_DIR/../lib/00-log.sh"

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  echo ""
  echo "  Usage: bash deploy/deploy.sh environment"
  echo ""
  echo "  Validates environment variables, Docker availability, and the"
  echo "  tailnet publish port before deployment."
  echo ""
  echo "  Called automatically by: bash deploy/deploy.sh all"
  echo "  Run standalone:          bash deploy/deploy.sh environment"
  echo ""
  exit 0
fi

log_banner "Arda - Environment Check"

ERRORS=0
fail() { log_fail "$1"; (( ++ERRORS )); }

# Lightweight host validator (the cert helpers that used to provide this were
# removed with on-host TLS; the edge owns certs now).
is_valid_host() {
  local domain="${1:-}"
  [[ -n "$domain" ]] || return 1
  [[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]] || return 1
  [[ "$domain" == .* ]] && return 1
  [[ "$domain" == *. ]] && return 1
  [[ "$domain" == *..* ]] && return 1
  return 0
}

require_int_range() {
  local name="$1"
  local min="$2"
  local max="$3"
  local value="${!name:-}"
  if [[ "$value" =~ ^[0-9]+$ ]] && (( 10#$value >= min && 10#$value <= max )); then
    log_ok "$name is in range $min-$max"
  else
    fail "$name must be an integer in range $min-$max"
  fi
}

# -- Required variables --------------------------------------------------------
log_step "Checking required environment variables..."

REQUIRED_VARS=(
  PROJECT_NAME NODE_NAME
  ROOT_DIR REPO_DIR RUNTIME_DIR DATA_DIR BACKUP_DIR
  APEX_DOMAIN
  APP_PUBLISH_PORT
  OIDC_ISSUER OIDC_CLIENT_ID OIDC_CLIENT_SECRET OIDC_REDIRECT_URI
  OIDC_SCOPES OIDC_POST_LOGOUT_REDIRECT_URI
  REDIS_URL RP_SESSION_TTL RP_SESSION_COOKIE_NAME RP_SESSION_COOKIE_DOMAIN
  DEFAULT_LANDING MOCK_TIER
  IMAGE_REGISTRY IMAGE_NAMESPACE IMAGE_TAG
  VXTURE_NPM_REGISTRY
)

for var in "${REQUIRED_VARS[@]}"; do
  val="${!var:-}"
  if [[ -z "$val" ]]; then
    fail "Missing required variable: $var"
  else
    log_ok "$var is set"
  fi
done

# -- Value validation ----------------------------------------------------------
log_step "Checking environment value formats..."

require_int_range RP_SESSION_TTL 60 31536000

# Tailnet publish port: the host port arda-app binds for the worker-01 edge.
require_int_range APP_PUBLISH_PORT 1 65535

# -- OIDC RP (required: arda login depends on it) ------------------------------
# arda authenticates only via the OIDC Authorization-Code + PKCE RP against
# accounts.vxture.com, so the issuer, client secret, redirect, and session
# store must all be present and well-formed.
if [[ "${OIDC_ISSUER:-}" =~ ^https?://[^[:space:]]+$ ]]; then
  log_ok "OIDC_ISSUER is valid"
else
  fail "OIDC_ISSUER must be an http(s) URL"
fi

if [[ "${OIDC_REDIRECT_URI:-}" =~ ^https?://[^[:space:]]+/auth/callback$ ]]; then
  log_ok "OIDC_REDIRECT_URI is valid"
else
  fail "OIDC_REDIRECT_URI must be an http(s) URL ending in /auth/callback"
fi

if [[ "${#OIDC_CLIENT_SECRET}" -ge 16 ]]; then
  log_ok "OIDC_CLIENT_SECRET is set"
else
  fail "OIDC_CLIENT_SECRET must be provisioned (>= 16 characters)"
fi

if [[ "${REDIS_URL:-}" =~ ^redis://[^[:space:]]+$ ]]; then
  log_ok "REDIS_URL is valid"
else
  fail "REDIS_URL must be a redis:// URL"
fi

# Host-only cookie: scoped to the exact domain, so it must not lead with a dot.
if [[ "${RP_SESSION_COOKIE_DOMAIN:-}" == .* ]]; then
  fail "RP_SESSION_COOKIE_DOMAIN must be host-only (no leading dot)"
elif is_valid_host "${RP_SESSION_COOKIE_DOMAIN:-}"; then
  log_ok "RP_SESSION_COOKIE_DOMAIN is host-only"
else
  fail "RP_SESSION_COOKIE_DOMAIN is not a valid host"
fi

if [[ "${VXTURE_NPM_REGISTRY:-}" =~ ^https?://[^[:space:]]+$ ]]; then
  log_ok "VXTURE_NPM_REGISTRY is valid"
else
  fail "VXTURE_NPM_REGISTRY must be an http(s) URL"
fi

if [[ "${VXTURE_NPM_REGISTRY:-}" == *"npm.pkg.github.com"* ]]; then
  if [[ -n "${NODE_AUTH_TOKEN:-}" ]]; then
    log_ok "NODE_AUTH_TOKEN is set for GitHub Packages"
  else
    fail "NODE_AUTH_TOKEN is required when VXTURE_NPM_REGISTRY uses GitHub Packages"
  fi
fi

# -- Docker --------------------------------------------------------------------
log_step "Checking Docker..."

if ! docker info &>/dev/null; then
  fail "Docker is not running or current user lacks access (try: sudo usermod -aG docker \$USER)"
else
  log_ok "Docker is available"
fi

if ! docker compose version &>/dev/null; then
  fail "docker compose v2 not found (install: apt install docker-compose-plugin)"
else
  log_ok "docker compose v2: $(docker compose version --short)"
fi

# -- Tailnet publish port availability -----------------------------------------
# worker-02 has no public IP; arda-app's published port is reachable only on the
# tailscale/LAN interface. A port already in use is fine when it belongs to this
# stack's own app container (a re-deploy), otherwise it is a conflict.
log_step "Checking tailnet publish port availability..."

APP_CONTAINER="${PROJECT_NAME}-app"
if ss -tlnp 2>/dev/null | grep -q ":${APP_PUBLISH_PORT} "; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${APP_CONTAINER}$"; then
    log_ok "Port $APP_PUBLISH_PORT in use by $APP_CONTAINER (expected)"
  else
    fail "Port $APP_PUBLISH_PORT is already in use - stop the conflicting service first"
  fi
else
  log_ok "Port $APP_PUBLISH_PORT is free"
fi

# -- Result -------------------------------------------------------------------
echo ""
if [[ $ERRORS -gt 0 ]]; then
  log_error "$ERRORS check(s) failed. Fix the issues above, then re-run."
  exit 1
fi
log_ok "All checks passed. Ready to deploy."
