-- 0001_access_request.sql - Sec-BL4 AccessRequest table (idempotent increment).
--
-- The AUTHORITATIVE definition (fresh apply + the data-architecture guardrail)
-- lives in 00_baseline.sql; this file mirrors it as CREATE ... IF NOT EXISTS so
-- a LIVE non-empty stack can adopt the new table via db-init action=migrate
-- without a destructive reset. Column-level UPDATE grants for arda_svc are in
-- 98_column_locks.sql (applied by action=roles once the table exists).
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "AccessRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "datasetId" TEXT,
    "requesterSub" TEXT NOT NULL,
    "requesterName" TEXT,
    "useCase" TEXT NOT NULL,
    "scope" TEXT,
    "justification" TEXT NOT NULL,
    "duration" TEXT,
    "method" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccessRequest_workspaceId_idx" ON "AccessRequest"("workspaceId");
CREATE INDEX IF NOT EXISTS "AccessRequest_workspaceId_status_idx" ON "AccessRequest"("workspaceId", "status");
