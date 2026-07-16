import { defineConfig } from "prisma/config";

// Prisma here is CLIENT TOOLING only: `prisma generate` (build) and local-dev
// `prisma db push`. DB STRUCTURE is owned by the hand-written DDL under
// deploy/database/ddl/ applied via the db-init workflow (org governance #7) -
// there is no migrations directory and the container never migrates.
export default defineConfig({
  schema: "prisma/schema.prisma",
  // Read directly (not via the eager `env()` helper) so `prisma generate` at
  // build time - where no DB exists - does not fail; a URL is only needed for
  // local-dev `db push`.
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
