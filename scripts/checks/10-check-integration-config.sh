#!/usr/bin/env bash
# Exercise the actual deployment loader with isolated operator secrets.
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
fixture="$(mktemp -d /tmp/arda-profile.XXXXXXXX)"
[[ "$fixture" == /tmp/arda-profile.* ]] || exit 1
trap 'rm -rf -- "$fixture"' EXIT
for stage in production beta; do
  stack="$fixture/$stage"
  mkdir -p "$stack/etc" "$stack/deploy/lib" "$stack/deploy/config"
  cp "$repo/deploy/lib/01-env.sh" "$stack/deploy/lib/"
  cp "$repo"/deploy/config/integration-*.env "$stack/deploy/config/"
  cat > "$stack/etc/.env" <<EOF
DEPLOY_STAGE=$stage
OIDC_CLIENT_SECRET=operator-client-secret
PROVISION_WEBHOOK_SECRET=operator-webhook-secret
DATABASE_URL=operator-db-url
OIDC_REDIRECT_URI=https://old.invalid/auth/callback
RP_SESSION_COOKIE_DOMAIN=.old.invalid
IMAGE_TAG=old-image
EOF
  env -u _ARDA_ENV_LOADED IMAGE_TAG=reviewed-image bash -c '
    set -euo pipefail
    source "$1/deploy/lib/01-env.sh"
    [[ "$OIDC_CLIENT_SECRET" == operator-client-secret ]]
    [[ "$PROVISION_WEBHOOK_SECRET" == operator-webhook-secret ]]
    [[ "$DATABASE_URL" == operator-db-url ]]
    [[ "$IMAGE_TAG" == reviewed-image ]]
    [[ -z "$RP_SESSION_COOKIE_DOMAIN" ]]
    [[ "$OIDC_REDIRECT_URI" == "https://$APEX_DOMAIN/auth/callback" ]]
    [[ "$OIDC_BACKCHANNEL_ISSUER" == http://100.100.197.42:8081 ]]
    [[ "$PLATFORM_API_URL" == http://100.100.197.42:8080 ]]
    case "$DEPLOY_STAGE" in
      production) [[ "$APEX_DOMAIN" == arda.ruyin.work && "$OIDC_CLIENT_ID" == arda ]] ;;
      beta) [[ "$APEX_DOMAIN" == beta-arda.vxture.com && "$OIDC_CLIENT_ID" == arda-beta ]] ;;
    esac
  ' bash "$stack"
done
echo '[ OK ] release profiles replace legacy URLs, isolate channels and preserve secrets/image pins'
