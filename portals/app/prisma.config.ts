import { defineConfig } from "prisma/config";

// Prisma 7 moved Migrate's connection URL out of schema.prisma into here. The
// runtime query client connects via the pg driver adapter (see app/lib/db.ts);
// this URL is used only by `prisma migrate deploy` (run from the container
// entrypoint) and other CLI operations. DATABASE_URL is a real env var in the
// container (compose), so no dotenv loader is needed.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Read directly (not via the eager `env()` helper) so `prisma generate` at
  // build time - where no DB exists - does not fail; `migrate deploy` runs at
  // container start where DATABASE_URL is always set by compose.
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
