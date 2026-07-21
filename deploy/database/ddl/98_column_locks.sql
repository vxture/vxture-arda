-- 98_column_locks.sql - per-column UPDATE whitelist for arda_svc
-- (org governance #7: REVOKE whole-table UPDATE + GRANT writable columns;
-- anchor columns are locked). Multi-schema (ADR-012): tables are schema-
-- qualified - catalog.* domain tables, vx_provision.* / local_usage.* contract
-- tables.
--
-- Locked everywhere (never in a GRANT below): id, "workspaceId", "createdAt".
-- Extra locks where a column is immutable by design: DataSource."orgId" /
-- "productCode" (registration quad), LineageEdge endpoints (a changed edge is
-- delete+insert), ApiKey."hashedKey", app_instance."orgId", raw metering
-- identity ("metric"/"amount"/"idempotencyKey"/"product"), Dataset."scope"
-- (platform promotion is ops-only, not an arda_svc write).
-- Append-only record tables get NO UPDATE at all: DatasetTag, DatasetStandard,
-- DataServiceDataset (pure link rows), QualityResult, AuditLog,
-- webhook_delivery, TemplateVersion (immutable records/versions).
--
-- FK referential actions (ON DELETE SET NULL / CASCADE) run with the table
-- owner's rights, so these locks do not break cascades.
--
-- NEW WRITABLE COLUMN RULE: adding a writable column to schema.prisma + a ddl
-- increment REQUIRES adding it to the matching GRANT below, or the service
-- role's writes fail with permission denied.
--
-- Idempotent: safe to re-run (REVOKE then re-GRANT).

REVOKE UPDATE ON ALL TABLES IN SCHEMA vx_provision, local_usage, catalog FROM arda_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA vx_provision, local_usage, catalog REVOKE UPDATE ON TABLES FROM arda_svc;

-- assets ----------------------------------------------------------------------
GRANT UPDATE ("dataSourceId", "name", "code", "description", "domain", "team",
              "refreshFreq", "type", "location", "rowCountEst", "sizeBytes",
              "ownerUserId", "ownerApp", "goldenRecord", "classification",
              "updatedAt")
  ON "catalog"."Dataset" TO arda_svc;

GRANT UPDATE ("name", "color") ON "catalog"."Tag" TO arda_svc;

GRANT UPDATE ("term", "definition", "stewardUserId", "scope")
  ON "catalog"."GlossaryTerm" TO arda_svc;

-- integration -----------------------------------------------------------------
GRANT UPDATE ("name", "type", "connectionConfig", "status", "lastSyncedAt")
  ON "catalog"."DataSource" TO arda_svc;

-- governance ------------------------------------------------------------------
GRANT UPDATE ("name", "type", "scope", "config", "enabled")
  ON "catalog"."Policy" TO arda_svc;

-- Access requests: the body is insert-once; only the decision mutates.
GRANT UPDATE ("status", "decidedBy", "decidedAt", "decisionNote")
  ON "catalog"."AccessRequest" TO arda_svc;

GRANT UPDATE ("datasetId", "code", "name", "dimension", "type", "config",
              "severity", "enabled")
  ON "catalog"."QualityRule" TO arda_svc;

GRANT UPDATE ("code", "name", "type", "ref", "items", "usage", "status",
              "scope", "updatedAt")
  ON "catalog"."Standard" TO arda_svc;

GRANT UPDATE ("transform", "jobId") ON "catalog"."LineageEdge" TO arda_svc;

-- services --------------------------------------------------------------------
GRANT UPDATE ("code", "name", "path", "method", "description", "domain",
              "level", "type", "config", "status", "ownerApp", "visibility",
              "publishedAt")
  ON "catalog"."DataService" TO arda_svc;

-- admin -----------------------------------------------------------------------
GRANT UPDATE ("dataServiceId", "name", "consumerApp", "scopes", "lastUsedAt",
              "revoked")
  ON "catalog"."ApiKey" TO arda_svc;

GRANT UPDATE ("name") ON "catalog"."SeedTemplate" TO arda_svc;

-- vx_provision ----------------------------------------------------------------
-- app_instance (<- WorkspaceRef): the platform-owned identity columns stay
-- locked; only the mirrored lifecycle/plan/seed/wipe fields mutate.
GRANT UPDATE ("tenantId", "plan", "status", "seedStatus", "wipedAt",
              "updatedAt")
  ON "vx_provision"."app_instance" TO arda_svc;

-- provision_seq: only the watermark advances (workspaceId/productCode are the PK
-- anchor and immutable); updatedAt is Prisma-maintained.
GRANT UPDATE ("lastSeq", "updatedAt")
  ON "vx_provision"."provision_seq" TO arda_svc;

-- local_usage -----------------------------------------------------------------
-- Flush bookkeeping only; the metering identity of a usage record is locked.
GRANT UPDATE ("flushed", "flushAttempts", "flushError", "flushedAt")
  ON "local_usage"."raw" TO arda_svc;
