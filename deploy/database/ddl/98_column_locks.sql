-- 98_column_locks.sql - per-column UPDATE whitelist for arda_svc
-- (org governance #7: REVOKE whole-table UPDATE + GRANT writable columns;
-- anchor columns are locked).
--
-- Locked everywhere (never in a GRANT below): id, "workspaceId", "createdAt".
-- Extra locks where a column is immutable by design: DataSource."orgId" /
-- "productCode" (registration quad), LineageEdge endpoints (a changed edge is
-- delete+insert), ApiKey."hashedKey", WorkspaceRef."orgId", UsageRaw metering
-- identity ("metric"/"amount"/"idempotencyKey"/"product").
-- Append-only record tables get NO UPDATE at all: DatasetTag, DatasetStandard,
-- DataServiceDataset (pure link rows), QualityResult, AuditLog,
-- ProvisioningEvent, TemplateVersion (immutable records/versions).
--
-- FK referential actions (ON DELETE SET NULL / CASCADE) run with the table
-- owner's rights, so these locks do not break cascades.
--
-- NEW WRITABLE COLUMN RULE: adding a writable column to schema.prisma + a ddl
-- increment REQUIRES adding it to the matching GRANT below, or the service
-- role's writes fail with permission denied.
--
-- Idempotent: safe to re-run (REVOKE then re-GRANT).

REVOKE UPDATE ON ALL TABLES IN SCHEMA public FROM arda_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE UPDATE ON TABLES FROM arda_svc;

-- assets ----------------------------------------------------------------------
GRANT UPDATE ("dataSourceId", "name", "code", "description", "domain", "team",
              "refreshFreq", "type", "location", "rowCountEst", "sizeBytes",
              "ownerUserId", "ownerApp", "goldenRecord", "classification",
              "updatedAt")
  ON "Dataset" TO arda_svc;

GRANT UPDATE ("name", "color") ON "Tag" TO arda_svc;

GRANT UPDATE ("term", "definition", "stewardUserId", "scope")
  ON "GlossaryTerm" TO arda_svc;

-- integration -----------------------------------------------------------------
GRANT UPDATE ("name", "type", "connectionConfig", "status", "lastSyncedAt")
  ON "DataSource" TO arda_svc;

-- governance ------------------------------------------------------------------
GRANT UPDATE ("name", "type", "scope", "config", "enabled")
  ON "Policy" TO arda_svc;

GRANT UPDATE ("datasetId", "code", "name", "dimension", "type", "config",
              "severity", "enabled")
  ON "QualityRule" TO arda_svc;

GRANT UPDATE ("code", "name", "type", "ref", "items", "usage", "status",
              "scope", "updatedAt")
  ON "Standard" TO arda_svc;

GRANT UPDATE ("transform", "jobId") ON "LineageEdge" TO arda_svc;

-- services --------------------------------------------------------------------
GRANT UPDATE ("code", "name", "path", "method", "description", "domain",
              "level", "type", "config", "status", "ownerApp", "visibility",
              "publishedAt")
  ON "DataService" TO arda_svc;

-- admin -----------------------------------------------------------------------
GRANT UPDATE ("dataServiceId", "name", "consumerApp", "scopes", "lastUsedAt",
              "revoked")
  ON "ApiKey" TO arda_svc;

-- infrastructure --------------------------------------------------------------
GRANT UPDATE ("tenantId", "plan", "status", "seedStatus", "wipedAt",
              "updatedAt")
  ON "WorkspaceRef" TO arda_svc;

GRANT UPDATE ("name") ON "SeedTemplate" TO arda_svc;

-- local_usage -----------------------------------------------------------------
-- Flush bookkeeping only; the metering identity of a usage record is locked.
GRANT UPDATE ("flushed", "flushAttempts", "flushError", "flushedAt")
  ON "UsageRaw" TO arda_svc;
