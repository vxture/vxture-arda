#!/bin/sh
# Container entrypoint: start the app. Deliberately NO schema migration here -
# DB structure is owned by the hand-written DDL under deploy/database/ddl/ and
# is applied only through the approval-gated db-init workflow (org governance
# #7: the regular deploy chain never runs migrations). A schema-behind DB
# surfaces as query errors, not as a silent half-migrated serve.
set -e

exec node app/server.js
