-- Catalog quad (arda_000 2.1): register DataSource under (org, ws, product, ds).
-- Backfill orgId from the WorkspaceRef mirror where known; new writes set it
-- from the session (active_org). productCode defaults to "arda" (external
-- sources); internal agent-db sources carry the owning product's code.
ALTER TABLE "DataSource" ADD COLUMN "orgId" TEXT;
ALTER TABLE "DataSource" ADD COLUMN "productCode" TEXT NOT NULL DEFAULT 'arda';
UPDATE "DataSource" ds SET "orgId" = wr."orgId"
  FROM "WorkspaceRef" wr WHERE wr."id" = ds."workspaceId" AND ds."orgId" IS NULL;
CREATE INDEX "DataSource_orgId_idx" ON "DataSource"("orgId");
