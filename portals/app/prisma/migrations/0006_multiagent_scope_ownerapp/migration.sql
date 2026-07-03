-- CreateEnum
CREATE TYPE "AssetScope" AS ENUM ('workspace', 'platform');

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "consumerApp" TEXT;

-- AlterTable
ALTER TABLE "DataService" ADD COLUMN     "ownerApp" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'workspace';

-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN     "ownerApp" TEXT;

-- AlterTable
ALTER TABLE "GlossaryTerm" ADD COLUMN     "scope" "AssetScope" NOT NULL DEFAULT 'workspace';

-- AlterTable
ALTER TABLE "Standard" ADD COLUMN     "scope" "AssetScope" NOT NULL DEFAULT 'workspace';

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_ownerApp_idx" ON "Dataset"("workspaceId", "ownerApp");
