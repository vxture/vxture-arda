-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "items" INTEGER NOT NULL DEFAULT 0,
    "usage" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Standard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Standard_workspaceId_idx" ON "Standard"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Standard_workspaceId_code_key" ON "Standard"("workspaceId", "code");

