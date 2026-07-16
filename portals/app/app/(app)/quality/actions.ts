"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { METRICS } from "../../entitlement/quota";
import { prisma } from "../../lib/db";
import { unseal, type SealedSecret } from "../../lib/seal";
import { recordUsage } from "../../usage/lib/buffer";
import { getConnector } from "../sources/connectors";
import type { QualityCheckSpec } from "../sources/connectors/types";

export type RuleActionResult = { ok: true } | { ok: false; error: "unauthenticated" | "forbidden" | "tier" | "invalid" };

const DIMENSIONS = new Set(["completeness", "accuracy", "consistency", "timeliness", "uniqueness", "validity"]);
const RULE_TYPES = new Set(["not_null", "unique", "range", "freshness", "row_count"]);
const SEVERITIES = new Set(["warning", "critical"]);

export interface CreateQualityRuleInput {
  datasetId: string;
  name: string;
  dimension: string;
  type: string;
  severity: string;
}

/** Create a quality rule (Q-BL3 input: rules can only be audited once they can
 *  be authored). Config stays empty in v1 - connectors run with per-type
 *  defaults; a config editor can follow once a real per-rule need shows up. */
export async function createQualityRule(input: CreateQualityRuleInput): Promise<RuleActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.quality_rules")) return { ok: false, error: "tier" };

  const name = input.name.trim();
  if (!name || name.length > 120) return { ok: false, error: "invalid" };
  if (!DIMENSIONS.has(input.dimension) || !RULE_TYPES.has(input.type) || !SEVERITIES.has(input.severity)) {
    return { ok: false, error: "invalid" };
  }

  const dataset = await prisma.dataset.findFirst({ where: { workspaceId: session.workspaceId, id: input.datasetId } });
  if (!dataset) return { ok: false, error: "invalid" };

  const existing = await prisma.qualityRule.findMany({ where: { workspaceId: session.workspaceId }, select: { code: true } });
  let maxNum = 300;
  for (const r of existing) {
    const m = /^Q-(\d+)$/.exec(r.code);
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  }
  const code = `Q-${maxNum + 1}`;

  await prisma.$transaction(async (tx) => {
    const rule = await tx.qualityRule.create({
      data: {
        workspaceId: session.workspaceId,
        datasetId: dataset.id,
        code,
        name,
        dimension: input.dimension,
        type: input.type,
        severity: input.severity,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "quality.rule.create",
        target: rule.id,
        metadata: { code, name, dataset: dataset.name, dimension: input.dimension, type: input.type, severity: input.severity },
      },
    });
  });

  revalidatePath("/quality");
  return { ok: true };
}

/** Enable/disable a rule without deleting its result history. */
export async function setQualityRuleEnabled(ruleId: string, enabled: boolean): Promise<RuleActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.quality_rules")) return { ok: false, error: "tier" };

  const rule = await prisma.qualityRule.findFirst({ where: { workspaceId: session.workspaceId, id: ruleId } });
  if (!rule) return { ok: false, error: "invalid" };
  if (rule.enabled === enabled) return { ok: true };

  await prisma.$transaction([
    prisma.qualityRule.update({ where: { id: rule.id }, data: { enabled } }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: enabled ? "quality.rule.enable" : "quality.rule.disable",
        target: rule.id,
        metadata: { code: rule.code, name: rule.name },
      },
    }),
  ]);

  revalidatePath("/quality");
  return { ok: true };
}

/** Delete a rule (cascades its result history, schema onDelete: Cascade). */
export async function deleteQualityRule(ruleId: string): Promise<RuleActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.quality_rules")) return { ok: false, error: "tier" };

  const rule = await prisma.qualityRule.findFirst({ where: { workspaceId: session.workspaceId, id: ruleId } });
  if (!rule) return { ok: false, error: "invalid" };

  await prisma.$transaction([
    prisma.qualityRule.delete({ where: { id: rule.id } }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "quality.rule.delete",
        target: rule.id,
        metadata: { code: rule.code, name: rule.name },
      },
    }),
  ]);

  revalidatePath("/quality");
  return { ok: true };
}

export type RunChecksResult =
  | { ok: true; ran: number; passed: number; warned: number; failed: number; skipped: number }
  | { ok: false; error: "unauthenticated" | "forbidden" | "tier" | "quota" | "no_rules" | "connect"; reason?: string };

/**
 * Run all enabled quality rules in the workspace (Q-BL1: checks really run).
 * Checks push down to each dataset's source via its connector - arda reads
 * only aggregate outcomes, never rows. Datasets without a live-connector
 * source (or without a location) are SKIPPED and counted (no silent gaps).
 *
 * Metering: quality.check.run is a divisible post-report counter (reply-01
 * R5): a pre-run gate blocks NEW runs when the C2 pool shows nothing
 * remaining, executed checks are buffered via recordUsage and flushed async.
 */
export async function runWorkspaceChecks(): Promise<RunChecksResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const resolver = getEntitlementResolver();
  const [subscription, quota] = await Promise.all([
    resolver.resolve(session.ardaClaim, session.workspaceId),
    resolver.resolveQuota(session.workspaceId),
  ]);
  if (!canUseFeature(subscription, "arda.governance.quality_rules")) return { ok: false, error: "tier" };

  // Pre-run gate (ent-120 2: gated is derived from C2, never persisted).
  const pool = quota.pools.qualityCheckRun;
  if (pool && pool.remaining <= 0) return { ok: false, error: "quota" };

  const rules = await prisma.qualityRule.findMany({
    where: { workspaceId: session.workspaceId, enabled: true },
    include: { dataset: { select: { id: true, location: true, dataSourceId: true } } },
  });
  if (rules.length === 0) return { ok: false, error: "no_rules" };

  // Group by data source so each source gets one connection.
  const bySource = new Map<string, typeof rules>();
  let skipped = 0;
  for (const r of rules) {
    if (!r.dataset.dataSourceId || !r.dataset.location) {
      skipped += 1;
      continue;
    }
    const list = bySource.get(r.dataset.dataSourceId) ?? [];
    list.push(r);
    bySource.set(r.dataset.dataSourceId, list);
  }

  let ran = 0;
  let passed = 0;
  let warned = 0;
  let failed = 0;
  const runAt = new Date();

  for (const [sourceId, sourceRules] of bySource) {
    const source = await prisma.dataSource.findFirst({
      where: { workspaceId: session.workspaceId, id: sourceId },
    });
    const connector = source ? getConnector(source.type) : null;
    if (!source?.connectionConfig || !connector?.checkQuality) {
      skipped += sourceRules.length;
      continue;
    }

    let outcomes;
    try {
      const config = unseal(source.connectionConfig as unknown as SealedSecret);
      const specs: QualityCheckSpec[] = sourceRules.map((r) => ({
        ruleId: r.id,
        type: r.type,
        location: r.dataset.location as string,
        config: (r.config ?? {}) as Record<string, unknown>,
      }));
      outcomes = await connector.checkQuality(config, specs);
    } catch {
      skipped += sourceRules.length;
      continue;
    }

    const ruleById = new Map(sourceRules.map((r) => [r.id, r]));
    await prisma.$transaction(async (tx) => {
      for (const o of outcomes) {
        const rule = ruleById.get(o.ruleId);
        if (!rule) continue;
        if (o.error) {
          skipped += 1;
          continue;
        }
        const status = o.issues === 0 ? "pass" : rule.severity === "critical" ? "fail" : "warn";
        if (status === "pass") passed += 1;
        else if (status === "warn") warned += 1;
        else failed += 1;
        ran += 1;
        await tx.qualityResult.create({
          data: {
            workspaceId: session.workspaceId,
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
  }

  if (ran > 0) {
    // Divisible post-report (reply-01 R5): buffer, flushed async to consume.
    await recordUsage({
      workspaceId: session.workspaceId,
      metric: METRICS.QUALITY_CHECK_RUN,
      amount: ran,
      idempotencyKey: `arda:${METRICS.QUALITY_CHECK_RUN}:${randomUUID()}`,
    });
  }

  await prisma.auditLog.create({
    data: {
      workspaceId: session.workspaceId,
      actor: session.sub,
      action: failed > 0 ? "quality.alert" : "quality.run",
      metadata: { ran, passed, warned, failed, skipped },
    },
  });

  revalidatePath("/quality");
  revalidatePath("/catalog");
  return { ok: true, ran, passed, warned, failed, skipped };
}
