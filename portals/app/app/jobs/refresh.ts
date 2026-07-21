/**
 * Scheduled refresh job (Q-BL1 periodic + I-BL2 freshness).
 *
 * Session-less core: syncs every live-connector source and re-runs quality
 * checks for every workspace that has enabled rules. Reuses the exact same
 * building blocks as the interactive actions (connectors, planSync, check
 * pushdown, quota pre-gate, gauge report) with actor="scheduler" in audits.
 * Caller = the internal cron endpoint (INTERNAL_JOB_TOKEN guard); cadence
 * lives in the host crontab, not in code.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "../lib/db";
import { unseal, type SealedSecret } from "../lib/seal";
import { getEntitlementResolver } from "../entitlement/resolver";
import { METRICS } from "../entitlement/quota";
import { recordUsage } from "../usage/lib/buffer";
import { reportStorageGauge } from "../usage/lib/gauge";
import { getConnector } from "../(app)/sources/connectors";
import type { QualityCheckSpec } from "../(app)/sources/connectors/types";
import { datasetCode, planSync } from "../(app)/sources/sync-core";

const WORKSPACE_CAP = 50; // per tick; skips are reported, never silent

export interface RefreshResult {
  workspaces: number;
  sourcesSynced: number;
  sourcesFailed: number;
  checksRun: number;
  skippedWorkspaces: number;
}

export async function refreshAll(): Promise<RefreshResult> {
  // Workspaces with anything refreshable: a configured source or enabled rules.
  const [sourceWs, ruleWs] = await Promise.all([
    prisma.dataSource.findMany({ select: { workspaceId: true }, distinct: ["workspaceId"] }),
    prisma.qualityRule.findMany({ where: { enabled: true }, select: { workspaceId: true }, distinct: ["workspaceId"] }),
  ]);
  // DataSource / QualityRule are tenant-only (non-null workspaceId); drop any
  // empty defensively. Platform reference data carries no source/rules to refresh.
  const all = [...new Set([...sourceWs, ...ruleWs].map((w) => w.workspaceId))].filter((w): w is string => Boolean(w));
  const batch = all.slice(0, WORKSPACE_CAP);

  const result: RefreshResult = {
    workspaces: batch.length,
    sourcesSynced: 0,
    sourcesFailed: 0,
    checksRun: 0,
    skippedWorkspaces: all.length - batch.length,
  };

  for (const workspaceId of batch) {
    // Wiped workspaces refresh nothing.
    const ref = await prisma.workspaceRef.findUnique({ where: { id: workspaceId }, select: { wipedAt: true } });
    if (ref?.wipedAt) continue;

    result.sourcesSynced += await syncWorkspaceSources(workspaceId, result);
    result.checksRun += await runWorkspaceChecksScheduled(workspaceId);
    await reportStorageGauge(workspaceId);
  }
  return result;
}

async function syncWorkspaceSources(workspaceId: string, result: RefreshResult): Promise<number> {
  const sources = await prisma.dataSource.findMany({ where: { workspaceId } });
  const resolver = getEntitlementResolver();
  const quota = await resolver.resolveQuota(workspaceId);
  let synced = 0;

  for (const source of sources) {
    const connector = getConnector(source.type);
    if (!connector || !source.connectionConfig) continue;
    try {
      const config = unseal(source.connectionConfig as unknown as SealedSecret);
      const discovered = await connector.pullMetadata(config);
      const [existing, count] = await Promise.all([
        prisma.dataset.findMany({ where: { workspaceId, dataSourceId: source.id }, select: { code: true } }),
        prisma.dataset.count({ where: { workspaceId } }),
      ]);
      const plan = planSync(
        discovered,
        new Set(existing.map((e) => e.code)),
        source.name,
        quota.limits.datasetMax,
        count,
      );
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        for (const d of plan.toCreate) {
          await tx.dataset.create({
            data: {
              workspaceId,
              dataSourceId: source.id,
              name: d.name,
              code: datasetCode(source.name, d.sourceLocalId),
              type: d.type,
              location: d.location,
              rowCountEst: d.rowCountEst,
              sizeBytes: d.sizeBytes,
            },
          });
        }
        for (const d of plan.toUpdate) {
          await tx.dataset.update({
            where: { workspaceId_code: { workspaceId, code: datasetCode(source.name, d.sourceLocalId) } },
            data: { type: d.type, location: d.location, rowCountEst: d.rowCountEst, sizeBytes: d.sizeBytes },
          });
        }
        await tx.dataSource.update({ where: { id: source.id }, data: { status: "connected", lastSyncedAt: now } });
        await tx.auditLog.create({
          data: {
            workspaceId,
            actor: "scheduler",
            action: "datasource.sync",
            target: source.id,
            metadata: {
              name: source.name,
              discovered: discovered.length,
              created: plan.toCreate.length,
              updated: plan.toUpdate.length,
              skippedByQuota: plan.skippedByQuota,
            },
          },
        });
      });
      synced += 1;
    } catch (err) {
      result.sourcesFailed += 1;
      const reason = (err as { reason?: string })?.reason ?? "error";
      await prisma.$transaction([
        prisma.dataSource.update({ where: { id: source.id }, data: { status: "disconnected" } }),
        prisma.auditLog.create({
          data: {
            workspaceId,
            actor: "scheduler",
            action: "datasource.sync_fail",
            target: source.id,
            metadata: { name: source.name, type: source.type, reason },
          },
        }),
      ]);
    }
  }
  return synced;
}

async function runWorkspaceChecksScheduled(workspaceId: string): Promise<number> {
  const resolver = getEntitlementResolver();
  const quota = await resolver.resolveQuota(workspaceId);
  const pool = quota.pools.qualityCheckRun;
  if (pool && pool.remaining <= 0) return 0; // quota pre-gate, same as interactive

  const rules = await prisma.qualityRule.findMany({
    where: { workspaceId, enabled: true },
    include: { dataset: { select: { id: true, location: true, dataSourceId: true } } },
  });
  if (rules.length === 0) return 0;

  const bySource = new Map<string, typeof rules>();
  for (const r of rules) {
    if (!r.dataset.dataSourceId || !r.dataset.location) continue;
    const list = bySource.get(r.dataset.dataSourceId) ?? [];
    list.push(r);
    bySource.set(r.dataset.dataSourceId, list);
  }

  let ran = 0;
  let failed = 0;
  const runAt = new Date();
  for (const [sourceId, sourceRules] of bySource) {
    const source = await prisma.dataSource.findFirst({ where: { workspaceId, id: sourceId } });
    const connector = source ? getConnector(source.type) : null;
    if (!source?.connectionConfig || !connector?.checkQuality) continue;
    try {
      const config = unseal(source.connectionConfig as unknown as SealedSecret);
      const specs: QualityCheckSpec[] = sourceRules.map((r) => ({
        ruleId: r.id,
        type: r.type,
        location: r.dataset.location as string,
        config: (r.config ?? {}) as Record<string, unknown>,
      }));
      const outcomes = await connector.checkQuality(config, specs);
      const ruleById = new Map(sourceRules.map((r) => [r.id, r]));
      await prisma.$transaction(async (tx) => {
        for (const o of outcomes) {
          const rule = ruleById.get(o.ruleId);
          if (!rule || o.error) continue;
          const status = o.issues === 0 ? "pass" : rule.severity === "critical" ? "fail" : "warn";
          if (status === "fail") failed += 1;
          ran += 1;
          await tx.qualityResult.create({
            data: {
              workspaceId,
              ruleId: rule.id,
              datasetId: rule.datasetId,
              runAt,
              status,
              score: o.score,
              issues: o.issues,
              details: { total: o.total, type: rule.type },
            },
          });
        }
      });
    } catch {
      // connection failure already reflected by the sync pass; skip checks
    }
  }

  if (ran > 0) {
    await recordUsage({
      workspaceId,
      metric: METRICS.QUALITY_CHECK_RUN,
      amount: ran,
      idempotencyKey: `arda:${METRICS.QUALITY_CHECK_RUN}:${randomUUID()}`,
    });
    await prisma.auditLog.create({
      data: {
        workspaceId,
        actor: "scheduler",
        action: failed > 0 ? "quality.alert" : "quality.run",
        metadata: { ran, failed, scheduled: true },
      },
    });
  }
  return ran;
}
