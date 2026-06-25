#!/usr/bin/env bash
# Pull images (GHCR primary, ACR fallback) and start all Docker services.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/01-env.sh"
source "$SCRIPT_DIR/../lib/00-log.sh"

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  echo ""
  echo "  Usage: bash deploy/deploy.sh start"
  echo ""
  echo "  Pulls images (GHCR primary, ACR fallback), starts the app +"
  echo "  redis services, and polls for container health."
  echo ""
  echo "  Called automatically by: bash deploy/deploy.sh all"
  echo "  Run standalone:          bash deploy/deploy.sh start"
  echo ""
  exit 0
fi

log_banner "Arda - Start Services"

cd "$REPO_DIR"

CONTAINERS=("${PROJECT_NAME}-redis" "${PROJECT_NAME}-app")

pull_images_for_current_registry() {
  local image attempt
  local -a images
  local pull_timeout="${DOCKER_PULL_TIMEOUT_SECONDS:-90}"
  mapfile -t images < <(docker compose config --images | sed '/^[[:space:]]*$/d')

  for image in "${images[@]}"; do
    log_info "Pulling $image"
    for attempt in 1 2 3; do
      if timeout "$pull_timeout" docker pull --quiet "$image"; then
        break
      fi

      if [[ "$attempt" -eq 3 ]]; then
        log_error "docker pull failed after retries: $image"
        return 1
      fi

      log_warn "docker pull failed or timed out for $image on attempt $attempt; retrying..."
      sleep $((attempt * 5))
    done
  done
}

# GHCR is primary (IMAGE_REGISTRY/IMAGE_NAMESPACE). If a pull fails and an Aliyun
# ACR fallback is configured (FALLBACK_IMAGE_REGISTRY/FALLBACK_IMAGE_NAMESPACE),
# retry the whole set against it. The owned image name (arda-app) is identical
# across registries, so only the prefix changes.
compose_pull_with_retry() {
  local primary_registry="${IMAGE_REGISTRY:-}"
  local primary_namespace="${IMAGE_NAMESPACE:-}"

  if pull_images_for_current_registry; then
    return 0
  fi

  if [[ -n "${FALLBACK_IMAGE_REGISTRY:-}" && -n "${FALLBACK_IMAGE_NAMESPACE:-}" ]]; then
    if [[ "${FALLBACK_IMAGE_REGISTRY}" != "$primary_registry" || "${FALLBACK_IMAGE_NAMESPACE}" != "$primary_namespace" ]]; then
      log_warn "Primary image registry failed; retrying with fallback ${FALLBACK_IMAGE_REGISTRY}/${FALLBACK_IMAGE_NAMESPACE}"
      export IMAGE_REGISTRY="$FALLBACK_IMAGE_REGISTRY"
      export IMAGE_NAMESPACE="$FALLBACK_IMAGE_NAMESPACE"
      pull_images_for_current_registry
      return $?
    fi
  fi

  return 1
}

log_step "Pulling latest images..."
compose_pull_with_retry

log_step "Starting services..."
docker compose up -d --remove-orphans

log_step "Waiting for services to become healthy..."
HEALTH_CHECK_TIMEOUT=60     # max seconds to wait
HEALTH_CHECK_INTERVAL=3     # seconds between polls
MAX_RETRIES=$((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL))
poll_count=0

while [[ $poll_count -lt $MAX_RETRIES ]]; do
  all_healthy=true
  for c in "${CONTAINERS[@]}"; do
    status=$(docker inspect "$c" --format '{{.State.Status}}' 2>/dev/null || echo "missing")
    health=$(docker inspect "$c" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || echo "none")

    if [[ "$status" != "running" ]]; then
      all_healthy=false
      break
    fi

    # If the container has a health check, require "healthy"; otherwise running is enough.
    if [[ "$health" != "none" && "$health" != "healthy" ]]; then
      all_healthy=false
      break
    fi
  done

  if [[ "$all_healthy" == "true" ]]; then
    log_ok "All containers healthy after ${poll_count}s polling."
    break
  fi

  poll_count=$((poll_count + 1))
  if [[ $poll_count -lt $MAX_RETRIES ]]; then
    sleep "$HEALTH_CHECK_INTERVAL"
  fi
done

if [[ "$all_healthy" != "true" ]]; then
  log_warn "Some containers not healthy after ${HEALTH_CHECK_TIMEOUT}s. Continuing anyway - check status below."
fi

log_step "Container status:"
docker compose ps

# Health check: fail if any service exited or is crash-looping.
PROBLEMS=""
for container in "${CONTAINERS[@]}"; do
  state=$(docker inspect "$container" --format '{{.State.Status}}' 2>/dev/null || echo "missing")
  if [[ "$state" == "exited" ]]; then
    PROBLEMS="$PROBLEMS\n  $container: exited unexpectedly"
  elif [[ "$state" == "restarting" ]]; then
    PROBLEMS="$PROBLEMS\n  $container: crash-looping (currently restarting)"
  fi
done

if [[ -n "$PROBLEMS" ]]; then
  log_error "Container health check failed:"
  echo -e "$PROBLEMS"
  log_info "Diagnose with: docker compose logs <container-name>"
  exit 1
fi

# Reclaim disk from images left by previous releases. Each release pulls fresh
# owned images; superseded tags pile up in /var/lib/docker and will fill the
# disk over time. Runs only after the new containers are confirmed healthy.
# Images referenced by running containers are never removed.
log_step "Pruning unused images to reclaim disk (running images are kept)..."
if docker image prune -af >/tmp/arda-prune.out 2>&1; then
  grep -i "reclaimed" /tmp/arda-prune.out 2>/dev/null | sed 's/^/  /' || true
else
  log_warn "Image prune skipped (non-fatal)"
fi

log_ok "All services started."
