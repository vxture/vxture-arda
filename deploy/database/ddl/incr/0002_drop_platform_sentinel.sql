-- 0002_drop_platform_sentinel.sql - retire the __platform__ workspaceId sentinel
-- in favor of the explicit axis (rectification C4; data_platform_100 2.3.2).
--
-- The AUTHORITATIVE shape lives in 00_baseline.sql (fresh apply + the
-- data-architecture guardrail). This file mirrors it as an idempotent migration
-- so a LIVE non-empty stack adopts it via db-init action=migrate without a
-- destructive reset.
--
-- What changes: platform-global reference rows stop carrying the fabricated
-- workspaceId '__platform__' (which violates the "workspace_id is platform-
-- issued" iron law) and instead carry workspaceId = NULL with scope = 'platform'.
-- Dataset gains a scope column; workspaceId becomes nullable on the four
-- platform-bearing tables; partial unique indexes enforce platform-namespace
-- uniqueness; a CHECK ties scope=platform to workspaceId IS NULL.
--
-- Idempotent: guarded ADD COLUMN / DROP NOT NULL / CREATE INDEX IF NOT EXISTS,
-- and the data backfill is a no-op once no '__platform__' rows remain. Runs as
-- the DB owner (db-init), so it may write the workspaceId anchor column.

-- 1) Dataset gains the explicit scope axis (default workspace for existing rows).
ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "scope" "AssetScope" NOT NULL DEFAULT 'workspace';

-- 2) workspaceId becomes nullable on every platform-bearing table.
ALTER TABLE "Dataset"         ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "GlossaryTerm"    ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "Standard"        ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "DatasetStandard" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- 3) Backfill: move existing sentinel rows to the explicit axis. Order matters
--    only for readability; each statement is independently idempotent (no
--    '__platform__' rows remain after the first successful run).
UPDATE "Standard"        SET "scope" = 'platform', "workspaceId" = NULL WHERE "workspaceId" = '__platform__';
UPDATE "GlossaryTerm"    SET "scope" = 'platform', "workspaceId" = NULL WHERE "workspaceId" = '__platform__';
UPDATE "Dataset"         SET "scope" = 'platform', "workspaceId" = NULL WHERE "workspaceId" = '__platform__';
UPDATE "DatasetStandard" SET "workspaceId" = NULL                       WHERE "workspaceId" = '__platform__';

-- 4) Partial unique indexes for the platform namespace (NULL workspaceId rows are
--    all-distinct under the composite uniques, so per-code uniqueness needs these).
CREATE UNIQUE INDEX IF NOT EXISTS "Dataset_platform_code_key"      ON "Dataset"("code")      WHERE "workspaceId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Standard_platform_code_key"     ON "Standard"("code")     WHERE "workspaceId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "GlossaryTerm_platform_term_key" ON "GlossaryTerm"("term") WHERE "workspaceId" IS NULL;

-- 5) Explicit-axis invariant: scope=platform iff workspaceId IS NULL. Added after
--    the backfill so existing data already satisfies it. Guarded so re-runs skip.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Dataset_scope_ws_ck') THEN
    ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_scope_ws_ck"
      CHECK (("scope" = 'platform') = ("workspaceId" IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Standard_scope_ws_ck') THEN
    ALTER TABLE "Standard" ADD CONSTRAINT "Standard_scope_ws_ck"
      CHECK (("scope" = 'platform') = ("workspaceId" IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GlossaryTerm_scope_ws_ck') THEN
    ALTER TABLE "GlossaryTerm" ADD CONSTRAINT "GlossaryTerm_scope_ws_ck"
      CHECK (("scope" = 'platform') = ("workspaceId" IS NULL));
  END IF;
END
$$;
