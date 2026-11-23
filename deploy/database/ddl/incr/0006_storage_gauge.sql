BEGIN;
CREATE TABLE IF NOT EXISTS "local_usage"."storage_gauge" (
  "workspaceId" TEXT NOT NULL,
  "value" BIGINT NOT NULL CHECK ("value" >= 0),
  "observedAt" TIMESTAMPTZ(3) NOT NULL,
  "retryAt" TIMESTAMPTZ(3),
  CONSTRAINT "storage_gauge_pkey" PRIMARY KEY ("workspaceId")
);
CREATE INDEX IF NOT EXISTS "storage_gauge_retryAt_workspaceId_idx"
  ON "local_usage"."storage_gauge"("retryAt", "workspaceId");
GRANT SELECT, INSERT ON "local_usage"."storage_gauge" TO arda_svc;
REVOKE UPDATE, DELETE ON "local_usage"."storage_gauge" FROM arda_svc;
GRANT UPDATE ("value", "observedAt", "retryAt")
  ON "local_usage"."storage_gauge" TO arda_svc;
COMMIT;
