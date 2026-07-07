-- AlterTable: extend WorkspaceRef for provisioning tracking
ALTER TABLE "WorkspaceRef"
  ADD COLUMN "tenantId"  TEXT,
  ADD COLUMN "plan"      TEXT,
  ADD COLUMN "status"    TEXT NOT NULL DEFAULT 'provisioned',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "WorkspaceRef_status_idx" ON "WorkspaceRef"("status");

-- CreateTable: C3 provisioning event idempotency log (logical schema: context)
CREATE TABLE "ProvisioningEvent" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "eventType"   TEXT NOT NULL,
  "seq"         INTEGER NOT NULL,
  "plan"        TEXT,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProvisioningEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProvisioningEvent_workspaceId_idx" ON "ProvisioningEvent"("workspaceId");

-- CreateTable: C3 local_usage buffer (logical schema: local_usage)
CREATE TABLE "UsageRaw" (
  "id"             TEXT NOT NULL,
  "workspaceId"    TEXT NOT NULL,
  "product"        TEXT NOT NULL DEFAULT 'arda',
  "metric"         TEXT NOT NULL,
  "amount"         INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT NOT NULL,
  "flushed"        BOOLEAN NOT NULL DEFAULT false,
  "flushAttempts"  INTEGER NOT NULL DEFAULT 0,
  "flushError"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "flushedAt"      TIMESTAMP(3),
  CONSTRAINT "UsageRaw_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsageRaw_idempotencyKey_key" ON "UsageRaw"("idempotencyKey");
CREATE INDEX "UsageRaw_flushed_createdAt_idx" ON "UsageRaw"("flushed", "createdAt");
CREATE INDEX "UsageRaw_workspaceId_idx" ON "UsageRaw"("workspaceId");
