import { prisma } from "../lib/db";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { getEventBus } from "./bus";

// A revision is also a coalescing outbox. Only the latest invalidation matters;
// readers always resolve authority, never replay historical access decisions.
export async function advanceAccessRevision(tx: Prisma.TransactionClient, workspaceId: string): Promise<void> {
  await tx.accessRevision.upsert({ where: { workspaceId },
    create: { workspaceId, generation: 1n },
    update: { generation: { increment: 1 }, updatedAt: new Date() } });
}
export async function readWorkspaceRevision(workspaceId: string): Promise<string> {
  return (await prisma.accessRevision.findUnique({ where: { workspaceId } }))?.generation.toString() ?? "0";
}
export async function publishWorkspaceRevision(workspaceId: string, db: PrismaClient = prisma,
  publish: (ws: string, revision: string) => Promise<void> = (ws, revision) => getEventBus().publishWorkspace(ws, revision)): Promise<void> {
  const row = await db.accessRevision.findUnique({ where: { workspaceId } });
  if (!row) return;
  await publish(workspaceId, row.generation.toString());
  // A newer committed change stays pending if it races this publication.
  await db.accessRevision.updateMany({ where: { workspaceId, generation: row.generation,
    publishedGeneration: { lt: row.generation } }, data: { publishedGeneration: row.generation } });
}
export async function tryPublishWorkspaceRevision(workspaceId: string): Promise<void> {
  try { await publishWorkspaceRevision(workspaceId); }
  catch { console.error("[access/outbox] committed revision retained for retry"); }
}
let started = false;
export function startAccessOutbox(): void {
  if (started) return;
  started = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const rows = await prisma.accessRevision.findMany({
        where: { generation: { gt: prisma.accessRevision.fields.publishedGeneration } },
        orderBy: { updatedAt: "asc" }, take: 100 });
      for (const row of rows) await tryPublishWorkspaceRevision(row.workspaceId);
    } catch { console.error("[access/outbox] unavailable; retry scheduled"); }
    finally { running = false; }
  };
  setTimeout(() => { void tick(); }, 1000).unref();
  setInterval(() => { void tick(); }, 30000).unref();
}
