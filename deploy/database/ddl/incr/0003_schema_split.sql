-- 0003_schema_split.sql - physical schema split (ADR-012 / rectification C2).
--
-- Moves the single-`public`-schema layout to the ADR-012 layout: contract
-- schemas vx_provision / local_usage / local_authz + domain schema catalog.
-- The AUTHORITATIVE shape is 00_baseline.sql (fresh apply + the data-architecture
-- guardrail); this file is the idempotent live migration for an existing stack,
-- applied via db-init action=migrate. It moves tables between schemas, renames
-- the four contract tables, and splits ProvisioningEvent into
-- webhook_delivery + provision_seq. No data is dropped.
--
-- Idempotent: ALTER TABLE IF EXISTS / RENAME IF EXISTS become no-ops once the
-- object has moved; enum moves and provision_seq backfill are guarded. Runs as
-- the DB owner (db-init). Re-run 97/98 (db-init roles) afterwards so grants land
-- on the new schemas.

-- 1) Schemas -----------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS "vx_provision";
CREATE SCHEMA IF NOT EXISTS "local_authz";
CREATE SCHEMA IF NOT EXISTS "local_usage";
CREATE SCHEMA IF NOT EXISTS "catalog";

-- 2) Move domain enums into catalog (ALTER TYPE has no IF EXISTS - guard). -----
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['AssetLevel','QualityStatus','AssetScope'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_type ty JOIN pg_namespace n ON n.oid = ty.typnamespace
      WHERE ty.typname = t AND n.nspname = 'public'
    ) THEN
      EXECUTE format('ALTER TYPE public.%I SET SCHEMA catalog', t);
    END IF;
  END LOOP;
END
$$;

-- 3) Move domain tables into catalog (IF EXISTS = idempotent). ----------------
ALTER TABLE IF EXISTS public."Dataset"            SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."Tag"                SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."DatasetTag"         SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."GlossaryTerm"       SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."DataSource"         SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."Policy"             SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."AccessRequest"      SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."QualityRule"        SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."QualityResult"      SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."Standard"           SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."LineageEdge"        SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."DataService"        SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."DatasetStandard"    SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."DataServiceDataset" SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."ApiKey"             SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."AuditLog"           SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."SeedTemplate"       SET SCHEMA catalog;
ALTER TABLE IF EXISTS public."TemplateVersion"    SET SCHEMA catalog;

-- 4) Contract tables: move + rename (both guarded by IF EXISTS on old name). ---
-- WorkspaceRef -> vx_provision.app_instance
ALTER TABLE IF EXISTS public."WorkspaceRef"       SET SCHEMA vx_provision;
ALTER TABLE IF EXISTS vx_provision."WorkspaceRef" RENAME TO "app_instance";
-- ProvisioningEvent -> vx_provision.webhook_delivery
ALTER TABLE IF EXISTS public."ProvisioningEvent"       SET SCHEMA vx_provision;
ALTER TABLE IF EXISTS vx_provision."ProvisioningEvent" RENAME TO "webhook_delivery";
-- UsageRaw -> local_usage.raw
ALTER TABLE IF EXISTS public."UsageRaw"        SET SCHEMA local_usage;
ALTER TABLE IF EXISTS local_usage."UsageRaw"   RENAME TO "raw";

-- 5) Split out the seq watermark table + backfill from the delivery ledger. ----
CREATE TABLE IF NOT EXISTS "vx_provision"."provision_seq" (
    "workspaceId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL DEFAULT 'arda',
    "lastSeq" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provision_seq_pkey" PRIMARY KEY ("workspaceId","productCode")
);

INSERT INTO "vx_provision"."provision_seq" ("workspaceId","productCode","lastSeq","updatedAt")
SELECT "workspaceId", 'arda', MAX("seq"), now()
FROM "vx_provision"."webhook_delivery"
GROUP BY "workspaceId"
ON CONFLICT ("workspaceId","productCode") DO NOTHING;
