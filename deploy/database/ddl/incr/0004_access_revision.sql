BEGIN;
-- Product-owned invalidation outbox; no business data is removed.
CREATE TABLE IF NOT EXISTS "vx_provision"."access_revision" (
  "workspaceId" TEXT NOT NULL,
  "generation" BIGINT NOT NULL DEFAULT 1 CHECK ("generation" > 0),
  "publishedGeneration" BIGINT NOT NULL DEFAULT 0 CHECK ("publishedGeneration" >= 0 AND "publishedGeneration" <= "generation"),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "access_revision_pkey" PRIMARY KEY ("workspaceId")
);
GRANT SELECT, INSERT ON "vx_provision"."access_revision" TO arda_svc;
REVOKE UPDATE, DELETE ON "vx_provision"."access_revision" FROM arda_svc;
GRANT UPDATE ("generation", "publishedGeneration", "updatedAt")
  ON "vx_provision"."access_revision" TO arda_svc;
COMMIT;
