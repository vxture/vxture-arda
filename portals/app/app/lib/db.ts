import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

/**
 * Prisma 7 client (Rust-free) over the node-postgres driver adapter. Connection
 * comes from DATABASE_URL (set by compose per stack). A single instance is
 * reused across hot reloads in dev to avoid exhausting connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
