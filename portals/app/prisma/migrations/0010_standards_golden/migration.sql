-- M-BL1: golden-record mark (lightweight master-data governance).
ALTER TABLE "Dataset" ADD COLUMN "goldenRecord" BOOLEAN NOT NULL DEFAULT false;
-- S-BL1: dataset-level standard-compliance association.
CREATE TABLE "DatasetStandard" (
    "datasetId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "DatasetStandard_pkey" PRIMARY KEY ("datasetId","standardId")
);
CREATE INDEX "DatasetStandard_workspaceId_idx" ON "DatasetStandard"("workspaceId");
CREATE INDEX "DatasetStandard_standardId_idx" ON "DatasetStandard"("standardId");
ALTER TABLE "DatasetStandard" ADD CONSTRAINT "DatasetStandard_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DatasetStandard" ADD CONSTRAINT "DatasetStandard_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
