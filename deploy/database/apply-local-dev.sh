#!/usr/bin/env bash
# Apply the DDL baseline to the LOCAL dev stack (docker-compose.dev.yml).
# Local-dev convenience only - deployed environments go through the
# approval-gated db-init workflow (governance #7), never this script.
#
#   bash deploy/database/apply-local-dev.sh
#
# Idempotent: every ddl file is IF NOT EXISTS / CREATE OR REPLACE shaped.
set -euo pipefail

CONTAINER="${ARDA_DEV_DB_CONTAINER:-vx-arda-postgres-db-dev}"
DB="${ARDA_DEV_DB:-vx_arda_db}"
OWNER="${ARDA_DEV_DB_OWNER:-arda}"
SVC_PASSWORD="${ARDA_SVC_PASSWORD:-arda_svc_dev}"

DDL_DIR="$(cd "$(dirname "$0")/ddl" && pwd)"

for f in 00_baseline.sql 97_service_role.sql 98_column_locks.sql; do
  echo "== applying $f =="
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -v svc_password="$SVC_PASSWORD" \
    -U "$OWNER" -d "$DB" < "$DDL_DIR/$f"
done

# NOTE: ddl/incr/*.sql is deliberately NOT applied here. Increments are the
# migration path for LIVE schemas (db-init action=migrate); the baseline is
# cumulative and already contains them, and older increments may predate the
# current multi-schema layout (unqualified relation names).

echo "== done: DDL baseline applied to $DB in $CONTAINER =="
