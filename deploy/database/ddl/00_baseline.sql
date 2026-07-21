-- 00_baseline.sql - arda domain DB baseline (single DDL authority).
--
-- Org governance #7: the hand-written SQL under deploy/database/ddl/ is the
-- single source of truth for DB STRUCTURE; the regular deploy chain never
-- runs migrations. Applied only via the db-init workflow (apply.sh).
-- portals/app/prisma/schema.prisma remains the source the app client is
-- generated from; scripts/guardrails/check-data-architecture.mjs enforces
-- that this file and schema.prisma stay in lockstep (tables, columns, enums).
--
-- Create-once: this file CREATEs objects and is NOT idempotent against a
-- live schema. Increments belong in new numbered ddl files using idempotent
-- ADD COLUMN IF NOT EXISTS forms (governance #7 live-db increments).
-- Service role + column locks live in 97_service_role.sql / 98_column_locks.sql.

-- CreateSchema (ADR-012 physical split: contract schemas + domain schema).
-- Contract-facing (platform-constrained): vx_provision, local_usage, local_authz
-- (local_authz is EMPTY today - no product RBAC yet). Domain schema: catalog.
CREATE SCHEMA IF NOT EXISTS "public";
CREATE SCHEMA IF NOT EXISTS "vx_provision";
CREATE SCHEMA IF NOT EXISTS "local_authz";
CREATE SCHEMA IF NOT EXISTS "local_usage";
CREATE SCHEMA IF NOT EXISTS "catalog";

-- Domain objects below are created UNQUALIFIED and land in `catalog` via this
-- search_path (single psql session per file); only the four contract tables are
-- schema-qualified explicitly. Prisma queries are always fully qualified from
-- @@schema, so the running app never relies on this search_path.
SET search_path TO "catalog", "vx_provision", "local_usage", "public";

-- CreateEnum
CREATE TYPE "AssetLevel" AS ENUM ('public', 'internal', 'sensitive', 'core');

-- CreateEnum
CREATE TYPE "QualityStatus" AS ENUM ('pass', 'warn', 'fail');

-- CreateEnum
CREATE TYPE "AssetScope" AS ENUM ('workspace', 'platform');

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    -- NULL = platform-global reference asset (scope=platform); see AssetScope.
    "workspaceId" TEXT,
    "dataSourceId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "team" TEXT,
    "refreshFreq" TEXT,
    "type" TEXT NOT NULL,
    "location" TEXT,
    "rowCountEst" BIGINT,
    "sizeBytes" BIGINT,
    "ownerUserId" TEXT,
    "ownerApp" TEXT,
    "goldenRecord" BOOLEAN NOT NULL DEFAULT false,
    "classification" "AssetLevel" NOT NULL DEFAULT 'internal',
    "scope" "AssetScope" NOT NULL DEFAULT 'workspace',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id"),
    -- Explicit-axis invariant (data_platform_100 2.3.2): a platform-global row
    -- carries NULL workspaceId, a workspace row a non-null one; the two agree.
    CONSTRAINT "Dataset_scope_ws_ck" CHECK (("scope" = 'platform') = ("workspaceId" IS NULL))
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetTag" (
    "datasetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "DatasetTag_pkey" PRIMARY KEY ("datasetId","tagId")
);

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "id" TEXT NOT NULL,
    -- NULL = platform-global term (scope=platform); see AssetScope.
    "workspaceId" TEXT,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "stewardUserId" TEXT,
    "scope" "AssetScope" NOT NULL DEFAULT 'workspace',

    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GlossaryTerm_scope_ws_ck" CHECK (("scope" = 'platform') = ("workspaceId" IS NULL))
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orgId" TEXT,
    "productCode" TEXT NOT NULL DEFAULT 'arda',
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "connectionConfig" JSONB,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "config" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessRequest" (
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

-- CreateTable
CREATE TABLE "QualityRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "QualityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityResult" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "QualityStatus" NOT NULL,
    "score" DOUBLE PRECISION,
    "issues" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,

    CONSTRAINT "QualityResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL,
    -- NULL = platform-global standard (scope=platform); see AssetScope.
    "workspaceId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "items" INTEGER NOT NULL DEFAULT 0,
    "usage" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scope" "AssetScope" NOT NULL DEFAULT 'workspace',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Standard_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Standard_scope_ws_ck" CHECK (("scope" = 'platform') = ("workspaceId" IS NULL))
);

-- CreateTable
CREATE TABLE "LineageEdge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "upstreamDatasetId" TEXT NOT NULL,
    "downstreamDatasetId" TEXT NOT NULL,
    "transform" TEXT,
    "jobId" TEXT,

    CONSTRAINT "LineageEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataService" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "description" TEXT,
    "domain" TEXT,
    "level" "AssetLevel" NOT NULL DEFAULT 'internal',
    "type" TEXT NOT NULL,
    "config" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ownerApp" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'workspace',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetStandard" (
    "datasetId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    -- NULL for platform-global links (carry column, denormalized; data-110 3.2).
    "workspaceId" TEXT,

    CONSTRAINT "DatasetStandard_pkey" PRIMARY KEY ("datasetId","standardId")
);

-- CreateTable
CREATE TABLE "DataServiceDataset" (
    "dataServiceId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "DataServiceDataset_pkey" PRIMARY KEY ("dataServiceId","datasetId")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dataServiceId" TEXT,
    "name" TEXT NOT NULL,
    "consumerApp" TEXT,
    "hashedKey" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable (vx_provision.app_instance <- WorkspaceRef; ADR-012)
CREATE TABLE "vx_provision"."app_instance" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tenantId" TEXT,
    "plan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'provisioned',
    "seedStatus" TEXT,
    "wipedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable (vx_provision.webhook_delivery <- ProvisioningEvent dedup ledger; ADR-012)
CREATE TABLE "vx_provision"."webhook_delivery" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "plan" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable (vx_provision.provision_seq: per (workspaceId, productCode) seq watermark; ADR-012)
CREATE TABLE "vx_provision"."provision_seq" (
    "workspaceId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL DEFAULT 'arda',
    "lastSeq" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provision_seq_pkey" PRIMARY KEY ("workspaceId","productCode")
);

-- CreateTable
CREATE TABLE "SeedTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeedTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable (local_usage.raw <- UsageRaw; ADR-012)
CREATE TABLE "local_usage"."raw" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "product" TEXT NOT NULL DEFAULT 'arda',
    "metric" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "flushed" BOOLEAN NOT NULL DEFAULT false,
    "flushAttempts" INTEGER NOT NULL DEFAULT 0,
    "flushError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flushedAt" TIMESTAMP(3),

    CONSTRAINT "raw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_idx" ON "Dataset"("workspaceId");

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_dataSourceId_idx" ON "Dataset"("workspaceId", "dataSourceId");

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_domain_idx" ON "Dataset"("workspaceId", "domain");

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_ownerApp_idx" ON "Dataset"("workspaceId", "ownerApp");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_workspaceId_code_key" ON "Dataset"("workspaceId", "code");

-- Platform namespace uniqueness: workspaceId IS NULL rows are all-distinct under
-- the composite index above (NULLs never conflict), so a partial unique index
-- enforces per-code uniqueness across platform-global reference assets. This is
-- the ON CONFLICT arbiter platform-seed.sql targets.
CREATE UNIQUE INDEX "Dataset_platform_code_key" ON "Dataset"("code") WHERE "workspaceId" IS NULL;

-- CreateIndex
CREATE INDEX "Tag_workspaceId_idx" ON "Tag"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_workspaceId_name_key" ON "Tag"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "DatasetTag_workspaceId_idx" ON "DatasetTag"("workspaceId");

-- CreateIndex
CREATE INDEX "GlossaryTerm_workspaceId_idx" ON "GlossaryTerm"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryTerm_workspaceId_term_key" ON "GlossaryTerm"("workspaceId", "term");

-- Platform namespace uniqueness (see Dataset_platform_code_key rationale).
CREATE UNIQUE INDEX "GlossaryTerm_platform_term_key" ON "GlossaryTerm"("term") WHERE "workspaceId" IS NULL;

-- CreateIndex
CREATE INDEX "DataSource_workspaceId_idx" ON "DataSource"("workspaceId");

-- CreateIndex
CREATE INDEX "DataSource_orgId_idx" ON "DataSource"("orgId");

-- CreateIndex
CREATE INDEX "Policy_workspaceId_idx" ON "Policy"("workspaceId");
CREATE INDEX "AccessRequest_workspaceId_idx" ON "AccessRequest"("workspaceId");
CREATE INDEX "AccessRequest_workspaceId_status_idx" ON "AccessRequest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "QualityRule_workspaceId_idx" ON "QualityRule"("workspaceId");

-- CreateIndex
CREATE INDEX "QualityRule_datasetId_idx" ON "QualityRule"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityRule_workspaceId_code_key" ON "QualityRule"("workspaceId", "code");

-- CreateIndex
CREATE INDEX "QualityResult_workspaceId_idx" ON "QualityResult"("workspaceId");

-- CreateIndex
CREATE INDEX "QualityResult_ruleId_idx" ON "QualityResult"("ruleId");

-- CreateIndex
CREATE INDEX "QualityResult_datasetId_idx" ON "QualityResult"("datasetId");

-- CreateIndex
CREATE INDEX "Standard_workspaceId_idx" ON "Standard"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Standard_workspaceId_code_key" ON "Standard"("workspaceId", "code");

-- Platform namespace uniqueness (see Dataset_platform_code_key rationale).
CREATE UNIQUE INDEX "Standard_platform_code_key" ON "Standard"("code") WHERE "workspaceId" IS NULL;

-- CreateIndex
CREATE INDEX "LineageEdge_workspaceId_idx" ON "LineageEdge"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "LineageEdge_upstreamDatasetId_downstreamDatasetId_key" ON "LineageEdge"("upstreamDatasetId", "downstreamDatasetId");

-- CreateIndex
CREATE INDEX "DataService_workspaceId_idx" ON "DataService"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "DataService_workspaceId_code_key" ON "DataService"("workspaceId", "code");

-- CreateIndex
CREATE INDEX "DatasetStandard_workspaceId_idx" ON "DatasetStandard"("workspaceId");

-- CreateIndex
CREATE INDEX "DatasetStandard_standardId_idx" ON "DatasetStandard"("standardId");

-- CreateIndex
CREATE INDEX "DataServiceDataset_workspaceId_idx" ON "DataServiceDataset"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_hashedKey_key" ON "ApiKey"("hashedKey");

-- CreateIndex
CREATE INDEX "ApiKey_workspaceId_idx" ON "ApiKey"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_idempotencyKey_key" ON "AuditLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_idx" ON "AuditLog"("workspaceId");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- CreateIndex (contract tables in vx_provision - qualified)
CREATE INDEX "app_instance_orgId_idx" ON "vx_provision"."app_instance"("orgId");

-- CreateIndex
CREATE INDEX "app_instance_wipedAt_idx" ON "vx_provision"."app_instance"("wipedAt");

-- CreateIndex
CREATE INDEX "app_instance_status_idx" ON "vx_provision"."app_instance"("status");

-- CreateIndex
CREATE INDEX "webhook_delivery_workspaceId_idx" ON "vx_provision"."webhook_delivery"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVersion_templateId_version_key" ON "TemplateVersion"("templateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "raw_idempotencyKey_key" ON "local_usage"."raw"("idempotencyKey");

-- CreateIndex
CREATE INDEX "raw_flushed_createdAt_idx" ON "local_usage"."raw"("flushed", "createdAt");

-- CreateIndex
CREATE INDEX "raw_workspaceId_idx" ON "local_usage"."raw"("workspaceId");

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetTag" ADD CONSTRAINT "DatasetTag_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetTag" ADD CONSTRAINT "DatasetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityRule" ADD CONSTRAINT "QualityRule_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityResult" ADD CONSTRAINT "QualityResult_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "QualityRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityResult" ADD CONSTRAINT "QualityResult_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineageEdge" ADD CONSTRAINT "LineageEdge_upstreamDatasetId_fkey" FOREIGN KEY ("upstreamDatasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineageEdge" ADD CONSTRAINT "LineageEdge_downstreamDatasetId_fkey" FOREIGN KEY ("downstreamDatasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetStandard" ADD CONSTRAINT "DatasetStandard_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetStandard" ADD CONSTRAINT "DatasetStandard_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataServiceDataset" ADD CONSTRAINT "DataServiceDataset_dataServiceId_fkey" FOREIGN KEY ("dataServiceId") REFERENCES "DataService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataServiceDataset" ADD CONSTRAINT "DataServiceDataset_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_dataServiceId_fkey" FOREIGN KEY ("dataServiceId") REFERENCES "DataService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SeedTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
