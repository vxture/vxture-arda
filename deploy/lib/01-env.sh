#!/usr/bin/env bash
# Load .env into environment if not already loaded.

_ENV_LOADED="${_ARDA_ENV_LOADED:-0}"
if [[ "$_ENV_LOADED" == "0" ]]; then
  _ARDA_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  DEPLOY_DIR="$(cd "$_ARDA_LIB_DIR/.." && pwd)"
  # lib/ sits under the DISPOSABLE deploy dir (CI rsyncs it fresh each release).
  # The operator .env is NOT kept there; it lives under the persistent root at
  # $PROJECT_ROOT/etc/.env (PROJECT_ROOT = the /srv/arda[-beta] root, lib/../..).
  # Pointing PROJECT_ROOT at /srv/arda vs /srv/arda-beta is what makes the same
  # scripts deploy either stack.
  PROJECT_ROOT="$(cd "$_ARDA_LIB_DIR/../.." && pwd)"

  if [[ -f "$PROJECT_ROOT/etc/.env" ]]; then
    # Snapshot vars already exported by the caller (e.g. IMAGE_TAG injected by
    # CI) so we can restore them after sourcing .env, which would otherwise
    # overwrite them with the operator defaults (e.g. IMAGE_TAG=latest).
    declare -A _pre_env=()
    for _v in IMAGE_TAG IMAGE_REGISTRY IMAGE_NAMESPACE \
               FALLBACK_IMAGE_REGISTRY FALLBACK_IMAGE_NAMESPACE; do
      [[ -n "${!_v+x}" ]] && _pre_env[$_v]="${!_v}"
    done

    set -a
    # shellcheck disable=SC1090
    source "$PROJECT_ROOT/etc/.env"
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
      # shellcheck disable=SC1090
      source "$DEPLOY_DIR/.env"
    fi
    set +a

    # Restore caller-provided vars (CI wins over operator defaults).
    for _v in "${!_pre_env[@]}"; do
      export "$_v"="${_pre_env[$_v]}"
    done
    unset _pre_env _v

    export _ARDA_ENV_LOADED=1
  else
    echo "[ERROR] .env not found at $PROJECT_ROOT/etc/.env" >&2
    echo "        Copy .env.example to $PROJECT_ROOT/etc/.env and fill in your values." >&2
    exit 1
  fi
fi
