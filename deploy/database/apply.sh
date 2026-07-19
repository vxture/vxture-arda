#!/usr/bin/env bash
# apply.sh - arda DB structure lifecycle (org governance #7).
#
# The hand-written DDL under ddl/ is the single authority for DB structure.
# The regular deploy chain NEVER calls this; it runs only from the db-init
# workflow (approval-gated for production) or by the operator on the host.
#
# Actions:
#   verify        read-only audit: table/enum counts vs DDL, service role
#   roles         apply 97_service_role.sql + 98_column_locks.sql only
#                 (adopt-in-place path for a live prisma-created schema;
#                 requires ARDA_SVC_PASSWORD in the environment)
#   migrate       apply ddl/incr/*.sql in order (idempotent CREATE ... IF NOT
#                 EXISTS increments) to a LIVE non-empty schema - the
#                 non-destructive path for a new table/column between baselines
#   apply         create-once full baseline (00 + roles) on an EMPTY schema;
#                 refuses if business tables already exist
#   reset         DROP SCHEMA public CASCADE + full apply  [DESTRUCTIVE]
#
# Runs psql inside this stack's db container (docker exec -i keeps stdin so
# the SQL pipes through - governance #7 gotcha).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../lib/01-env.sh"

DB_CONTAINER="${PROJECT_NAME:-arda}-db"
PSQL_USER="${POSTGRES_USER:-arda}"
PSQL_DB="${POSTGRES_DB:-arda}"
DDL_DIR="$SCRIPT_DIR/ddl"

ACTION="${1:-verify}"

psql_exec() {
  # $@ = extra psql args; SQL arrives on stdin.
  docker exec -i "$DB_CONTAINER" psql -U "$PSQL_USER" -d "$PSQL_DB" \
    -v ON_ERROR_STOP=1 --no-psqlrc --quiet "$@"
}

psql_scalar() {
  docker exec -i "$DB_CONTAINER" psql -U "$PSQL_USER" -d "$PSQL_DB" \
    -v ON_ERROR_STOP=1 --no-psqlrc -tA
}

expected_tables() {
  grep -c '^CREATE TABLE ' "$DDL_DIR/00_baseline.sql"
}

expected_enums() {
  grep -c '^CREATE TYPE ' "$DDL_DIR/00_baseline.sql"
}

live_tables() {
  # _prisma_migrations (historical artifact on adopted stacks) not counted.
  echo "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations';" | psql_scalar
}

live_enums() {
  echo "SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e';" | psql_scalar
}

role_exists() {
  echo "SELECT count(*) FROM pg_roles WHERE rolname='arda_svc';" | psql_scalar
}

apply_roles() {
  if [[ -z "${ARDA_SVC_PASSWORD:-}" ]]; then
    echo "[db] ARDA_SVC_PASSWORD is required to (re)apply the service role" >&2
    exit 1
  fi
  echo "[db] applying 97_service_role.sql (role + DML floor)..."
  docker exec -i "$DB_CONTAINER" psql -U "$PSQL_USER" -d "$PSQL_DB" \
    -v ON_ERROR_STOP=1 --no-psqlrc --quiet \
    -v svc_password="$ARDA_SVC_PASSWORD" < "$DDL_DIR/97_service_role.sql"
  echo "[db] applying 98_column_locks.sql (UPDATE column whitelist)..."
  psql_exec < "$DDL_DIR/98_column_locks.sql"
  echo "[db] roles applied"
}

migrate() {
  # Apply idempotent increments to a live schema (governance #7: structure
  # change between baselines ships as a numbered CREATE ... IF NOT EXISTS file
  # and is applied through db-init, never by the deploy chain or ad-hoc SSH).
  local dir="$DDL_DIR/incr"
  if [[ ! -d "$dir" ]]; then
    echo "[db] no ddl/incr directory - nothing to migrate"
    return 0
  fi
  shopt -s nullglob
  local files=("$dir"/*.sql)
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "[db] ddl/incr is empty - nothing to migrate"
    return 0
  fi
  for f in "${files[@]}"; do
    echo "[db] applying increment $(basename "$f")..."
    psql_exec < "$f"
  done
  echo "[db] migrate done (${#files[@]} increment(s)); run 'verify' to confirm"
}

verify() {
  local et lt ee le re
  et="$(expected_tables)"; lt="$(live_tables)"
  ee="$(expected_enums)";  le="$(live_enums)"
  re="$(role_exists)"
  echo "[db] tables: live=$lt expected=$et"
  echo "[db] enums : live=$le expected=$ee"
  echo "[db] arda_svc role present: $re"
  local fail=0
  [[ "$lt" == "$et" ]] || { echo "[db] FAIL table count mismatch" >&2; fail=1; }
  [[ "$le" == "$ee" ]] || { echo "[db] FAIL enum count mismatch" >&2; fail=1; }
  [[ "$re" == "1" ]] || { echo "[db] FAIL arda_svc role missing (run: apply.sh roles)" >&2; fail=1; }
  [[ "$fail" == "0" ]] && echo "[db] verify OK"
  return "$fail"
}

case "$ACTION" in
  verify)
    verify
    ;;
  roles)
    apply_roles
    ;;
  migrate)
    migrate
    ;;
  apply)
    if [[ "$(live_tables)" != "0" ]]; then
      echo "[db] refusing: schema already holds tables (create-once baseline)." >&2
      echo "[db] adopted live stacks want 'roles' + 'verify'; a rebuild wants 'reset'." >&2
      exit 1
    fi
    echo "[db] applying 00_baseline.sql..."
    psql_exec < "$DDL_DIR/00_baseline.sql"
    apply_roles
    verify
    ;;
  reset)
    echo "[db] RESET: dropping schema public on $DB_CONTAINER/$PSQL_DB..." >&2
    echo "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" | psql_exec
    echo "[db] applying 00_baseline.sql..."
    psql_exec < "$DDL_DIR/00_baseline.sql"
    apply_roles
    verify
    ;;
  *)
    echo "usage: apply.sh {verify|roles|migrate|apply|reset}" >&2
    exit 2
    ;;
esac
