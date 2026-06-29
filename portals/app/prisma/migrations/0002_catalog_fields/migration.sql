-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "refreshFreq" TEXT,
ADD COLUMN     "team" TEXT;

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_domain_idx" ON "Dataset"("workspaceId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_workspaceId_code_key" ON "Dataset"("workspaceId", "code");

