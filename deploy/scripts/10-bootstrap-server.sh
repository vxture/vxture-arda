#!/usr/bin/env bash
# Server bootstrap - run as root on a fresh (or existing) server.
# Installs Docker, creates the admin user, copies SSH keys, prepares ROOT_DIR.
# Safe to re-run: each step checks state before acting.
#
# ROOT_DIR selects which stack's tree is prepared (the same host runs both):
#   ROOT_DIR=/srv/arda       prod (default)
#   ROOT_DIR=/srv/arda-beta  beta
# Run init once per stack to create each root.
#
# NOTE: root SSH is intentionally left enabled - disable manually after
# verifying the admin login works.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/00-log.sh"

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  echo ""
  echo "  Usage: [ROOT_DIR=/srv/arda[-beta]] sudo bash deploy/server.sh init"
  echo ""
  echo "  Bootstraps a server: installs Docker and docker compose, creates the"
  echo "  admin user (default: stone), copies SSH keys from root, configures the"
  echo "  UFW firewall (22/tcp only; the app port is tailnet-only), and prepares"
  echo "  the ROOT_DIR tree."
  echo ""
  echo "  Must run as root. Safe to re-run."
  echo "  Run init once per stack (prod and beta use different ROOT_DIR)."
  echo ""
  exit 0
fi

log_banner "Arda - Server Init"

if [[ "$EUID" -ne 0 ]]; then
  log_error "Must run as root"
  exit 1
fi

ADMIN_USER="${ADMIN_USER:-stone}"
ROOT_DIR="${ROOT_DIR:-/srv/arda}"

# -- System packages -----------------------------------------------------------
log_step "Checking required packages..."

apt-get update -qq
PKGS=()
command -v curl    &>/dev/null || PKGS+=(curl)
command -v openssl &>/dev/null || PKGS+=(openssl)
command -v dig     &>/dev/null || PKGS+=(dnsutils)
command -v python3 &>/dev/null || PKGS+=(python3)
command -v git     &>/dev/null || PKGS+=(git)
command -v rsync   &>/dev/null || PKGS+=(rsync)

if [[ ${#PKGS[@]} -gt 0 ]]; then
  apt-get install -y "${PKGS[@]}" -qq
  log_ok "Installed: ${PKGS[*]}"
else
  log_ok "All required packages already present"
fi

# -- Docker --------------------------------------------------------------------
log_step "Checking Docker..."

if ! command -v docker &>/dev/null; then
  log_info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  log_ok "Docker installed: $(docker --version)"
else
  log_ok "Docker already installed: $(docker --version)"
fi

if ! docker compose version &>/dev/null; then
  log_info "Installing docker compose plugin..."
  apt-get install -y docker-compose-plugin -qq
  log_ok "docker compose plugin installed"
else
  log_ok "docker compose v2: $(docker compose version --short)"
fi

# -- Admin user ----------------------------------------------------------------
log_step "Setting up admin user: $ADMIN_USER ..."

if id "$ADMIN_USER" &>/dev/null; then
  log_ok "User $ADMIN_USER already exists"
else
  useradd -m -s /bin/bash "$ADMIN_USER"
  log_ok "User created: $ADMIN_USER"
fi

# Add to groups (idempotent: usermod -aG is a no-op if already in group).
if id -nG "$ADMIN_USER" | grep -qw sudo; then
  log_ok "$ADMIN_USER already in group: sudo"
else
  usermod -aG sudo "$ADMIN_USER"
  log_ok "$ADMIN_USER added to group: sudo"
fi

if id -nG "$ADMIN_USER" | grep -qw docker; then
  log_ok "$ADMIN_USER already in group: docker"
else
  usermod -aG docker "$ADMIN_USER"
  log_ok "$ADMIN_USER added to group: docker"
fi

# -- SSH authorized_keys -------------------------------------------------------
SSH_DIR="/home/$ADMIN_USER/.ssh"
AUTH_KEYS="$SSH_DIR/authorized_keys"

if [[ -f "$AUTH_KEYS" ]]; then
  log_ok "SSH authorized_keys already present for $ADMIN_USER"
elif [[ -f /root/.ssh/authorized_keys ]]; then
  mkdir -p "$SSH_DIR"
  cp /root/.ssh/authorized_keys "$AUTH_KEYS"
  chown -R "$ADMIN_USER:$ADMIN_USER" "$SSH_DIR"
  chmod 700 "$SSH_DIR"
  chmod 600 "$AUTH_KEYS"
  log_ok "SSH authorized_keys copied from root -> $ADMIN_USER"
else
  log_warn "No /root/.ssh/authorized_keys found"
  log_warn "Add your public key manually: /home/$ADMIN_USER/.ssh/authorized_keys"
fi

# -- Directory ownership -------------------------------------------------------
log_step "Setting up $ROOT_DIR ..."

# Pre-create the top-level dirs so the chown below covers them, and so the first
# CI rsync (which writes the deploy subset to $ROOT_DIR/deploy) and the
# subsequent deploy.sh run (which fills runtime/data/backup) both succeed.
# etc/ is the persistent home for the operator .env (deploy/ is disposable).
mkdir -p "$ROOT_DIR/etc" "$ROOT_DIR/deploy" "$ROOT_DIR/runtime" "$ROOT_DIR/data" "$ROOT_DIR/backup"

# Always chown recursively - safe to repeat; fixes root-owned files from any
# previous accidental root invocation of deploy scripts.
chown -R "$ADMIN_USER:$ADMIN_USER" "$ROOT_DIR"
log_ok "$ROOT_DIR owned by $ADMIN_USER (etc + deploy + runtime + data + backup)"

# -- Firewall ------------------------------------------------------------------
log_step "Configuring firewall..."

# worker-02 is private compute with no public IP. Only SSH is opened on the
# public surface; arda-app's published port is reached by the worker-01 edge
# over tailscale, so it must NOT be opened to the public interface. If UFW is
# used to filter the tailscale interface, allow APP_PUBLISH_PORT there only.
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp &>/dev/null || true
  log_ok "UFW rule added: 22/tcp (app port stays tailnet-only)"
else
  log_info "UFW not installed - skipping firewall config"
fi

# -- Done ----------------------------------------------------------------------
echo ""
log_banner "Server Init Complete"
log_ok "Admin user : $ADMIN_USER  (sudo + docker)"
log_ok "Docker     : $(docker --version | cut -d' ' -f3 | tr -d ',')"
log_ok "Root dir   : $ROOT_DIR (owned by $ADMIN_USER)"
echo ""
log_info "No git clone is used. CI rsyncs the deploy subset (deploy/, configs/,"
log_info "docker-compose.yml) to $ROOT_DIR/deploy on the next release, then runs"
log_info "deploy.sh all over SSH. Before that first release:"
log_info "  create $ROOT_DIR/etc/.env with real secrets (copy from .env.example)"
log_info "  install the edge vhost from configs/edge/ on worker-01 (see its README)"
echo ""
log_info "After confirming $ADMIN_USER SSH login works, optionally harden SSH:"
log_info "  sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && systemctl reload sshd"
