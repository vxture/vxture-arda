import { prisma } from "../lib/db";
import { RETENTION_DAYS } from "../lib/workspace-state";
import { reportStorageGauge } from "../usage/lib/gauge";

/**
 * Hard-delete sweep (Lc-BL2 second half): physically clears business data for
 * workspaces whose wipe mark is older than RETENTION_DAYS.
 *
 * What is deleted: all workspace business rows (assets, integration,
 * governance, services, admin keys, buffered usage).
 * What is KEPT: AuditLog (compliance trail - the wipe itself must stay
 * traceable) and the WorkspaceRef anchor (status=hard_deleted, for idempotency
 * and history). A final workspace.hard_delete audit row records the counts.
 */

export interface SweepResult {
  workspaces: number;
  rowsDeleted: number;
}

export async function sweepWipedWorkspaces(now: Date = new Date()): Promise<SweepResult> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const due = await prisma.workspaceRef.findMany({
    where: { wipedAt: { not: null, lt: cutoff }, status: { not: "hard_deleted" } },
    select: { id: true, wipedAt: true },
  });

  let rowsDeleted = 0;
  for (const ws of due) {
    const workspaceId = ws.id;
    await prisma.$transaction(async (tx) => {
      // Order respects FKs; cascades clear join/dependent rows (DatasetTag,
      // QualityRule/Result, LineageEdge, DataServiceDataset) with their parents.
      const counts = [
        await tx.dataset.deleteMany({ where: { workspaceId } }),
        await tx.dataSource.deleteMany({ where: { workspaceId } }),
        await tx.dataService.deleteMany({ where: { workspaceId } }),
        await tx.apiKey.deleteMany({ where: { workspaceId } }),
        await tx.policy.deleteMany({ where: { workspaceId } }),
        await tx.standard.deleteMany({ where: { workspaceId } }),
        await tx.glossaryTerm.deleteMany({ where: { workspaceId } }),
        await tx.tag.deleteMany({ where: { workspaceId } }),
        await tx.qualityResult.deleteMany({ where: { workspaceId } }),
        await tx.qualityRule.deleteMany({ where: { workspaceId } }),
        await tx.lineageEdge.deleteMany({ where: { workspaceId } }),
        await tx.usageRaw.deleteMany({ where: { workspaceId } }),
      ];
      // Direct deletions only - cascade children (edges/rules/results/links)
      // are cleared by their parents and not counted here.
      const deleted = counts.reduce((n, c) => n + c.count, 0);
      rowsDeleted += deleted;

      await tx.workspaceRef.update({ where: { id: workspaceId }, data: { status: "hard_deleted" } });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actor: "platform",
          action: "workspace.hard_delete",
          target: workspaceId,
          metadata: { rowsDeleted: deleted, wipedAt: ws.wipedAt?.toISOString(), retentionDays: RETENTION_DAYS },
        },
      });
    });
  }

  // Hard deletes drop each workspace's watermark to zero - tell the platform.
  for (const ws of due) {
    await reportStorageGauge(ws.id);
  }

  return { workspaces: due.length, rowsDeleted };
}
