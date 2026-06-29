-- AlterTable
ALTER TABLE "QualityResult" ADD COLUMN     "issues" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QualityRule" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "dimension" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "QualityRule_workspaceId_code_key" ON "QualityRule"("workspaceId", "code");

