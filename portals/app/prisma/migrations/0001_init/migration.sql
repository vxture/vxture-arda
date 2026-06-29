-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetLevel" AS ENUM ('public', 'internal', 'sensitive', 'core');

-- CreateEnum
CREATE TYPE "QualityStatus" AS ENUM ('pass', 'warn', 'fail');

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dataSourceId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT,
    "rowCountEst" BIGINT,
    "sizeBytes" BIGINT,
    "ownerUserId" TEXT,
    "classification" "AssetLevel" NOT NULL DEFAULT 'internal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
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
    "workspaceId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "stewardUserId" TEXT,

    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "QualityRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
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
    "details" JSONB,

    CONSTRAINT "QualityResult_pkey" PRIMARY KEY ("id")
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
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataService_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "WorkspaceRef" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "seedStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceRef_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_idx" ON "Dataset"("workspaceId");

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_dataSourceId_idx" ON "Dataset"("workspaceId", "dataSourceId");

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

-- CreateIndex
CREATE INDEX "DataSource_workspaceId_idx" ON "DataSource"("workspaceId");

-- CreateIndex
CREATE INDEX "Policy_workspaceId_idx" ON "Policy"("workspaceId");

-- CreateIndex
CREATE INDEX "QualityRule_workspaceId_idx" ON "QualityRule"("workspaceId");

-- CreateIndex
CREATE INDEX "QualityRule_datasetId_idx" ON "QualityRule"("datasetId");

-- CreateIndex
CREATE INDEX "QualityResult_workspaceId_idx" ON "QualityResult"("workspaceId");

-- CreateIndex
CREATE INDEX "QualityResult_ruleId_idx" ON "QualityResult"("ruleId");

-- CreateIndex
CREATE INDEX "QualityResult_datasetId_idx" ON "QualityResult"("datasetId");

-- CreateIndex
CREATE INDEX "LineageEdge_workspaceId_idx" ON "LineageEdge"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "LineageEdge_upstreamDatasetId_downstreamDatasetId_key" ON "LineageEdge"("upstreamDatasetId", "downstreamDatasetId");

-- CreateIndex
CREATE INDEX "DataService_workspaceId_idx" ON "DataService"("workspaceId");

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

-- CreateIndex
CREATE INDEX "WorkspaceRef_orgId_idx" ON "WorkspaceRef"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVersion_templateId_version_key" ON "TemplateVersion"("templateId", "version");

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
ALTER TABLE "DataServiceDataset" ADD CONSTRAINT "DataServiceDataset_dataServiceId_fkey" FOREIGN KEY ("dataServiceId") REFERENCES "DataService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataServiceDataset" ADD CONSTRAINT "DataServiceDataset_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_dataServiceId_fkey" FOREIGN KEY ("dataServiceId") REFERENCES "DataService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SeedTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

