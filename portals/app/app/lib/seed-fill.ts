/**
 * First-entry workspace seeding (ADR section 4 / arda-data-arch-workplan section 1).
 *
 * When a workspace first enters arda and the platform has marked it for seeding
 * (`WorkspaceRef.seedStatus = "pending"`), clone the default template's content
 * into that workspace so the catalog is not empty. The clone is:
 *   - concurrency-safe: a conditional `pending -> seeding` lease means only one
 *     request performs the fill even if several land at once;
 *   - transactional: the whole manifest lands atomically or not at all;
 *   - audited: success/failure writes an AuditLog row.
 *
 * Trigger policy: seeding runs only when seedStatus is "pending". For a workspace
 * arda has never recorded, behaviour depends on ARDA_SEED_AUTOFILL:
 *   - unset/"false" (default, prod): record a WorkspaceRef anchor but do NOT seed
 *     - the platform owns the decision and will set seedStatus=pending later;
 *   - "true" (beta/demo): treat a never-seen workspace as pending and seed it,
 *     so the internal preview environment shows data without platform wiring.
 */
import type { PrismaClient, Prisma, QualityStatus } from "../../generated/prisma/client";
import {
  DEFAULT_MANIFEST,
  DEFAULT_TEMPLATE_ID,
  DEFAULT_TEMPLATE_NAME,
  DEFAULT_TEMPLATE_VERSION,
  type SeedManifest,
} from "./seed-manifest";

export interface SeedCounts {
  datasets: number;
  standards: number;
  qualityRules: number;
  qualityResults: number;
  services: number;
}

export interface FillOutcome {
  seeded: boolean;
  reason: string;
  counts?: SeedCounts;
}

const TEMPLATE_REF = `${DEFAULT_TEMPLATE_NAME}@${DEFAULT_TEMPLATE_VERSION}`;
const DAY_MS = 86_400_000;

function autofillEnabled(): boolean {
  return process.env.ARDA_SEED_AUTOFILL === "true";
}

function statusFor(score: number): QualityStatus {
  return score >= 95 ? "pass" : score >= 90 ? "warn" : "fail";
}

/**
 * Upsert the default SeedTemplate + TemplateVersion (global, not workspace
 * scoped). The persisted manifest is provenance: the cloner reads the typed
 * in-memory DEFAULT_MANIFEST, and this row records which template/version filled
 * a workspace (referenced by the audit log).
 */
export async function ensureSeedTemplate(
  prisma: PrismaClient,
  manifest: SeedManifest = DEFAULT_MANIFEST,
): Promise<void> {
  await prisma.seedTemplate.upsert({
    where: { id: DEFAULT_TEMPLATE_ID },
    update: { name: DEFAULT_TEMPLATE_NAME },
    create: { id: DEFAULT_TEMPLATE_ID, name: DEFAULT_TEMPLATE_NAME },
  });
  await prisma.templateVersion.upsert({
    where: { templateId_version: { templateId: DEFAULT_TEMPLATE_ID, version: DEFAULT_TEMPLATE_VERSION } },
    update: { manifest: manifest as unknown as Prisma.InputJsonValue },
    create: {
      templateId: DEFAULT_TEMPLATE_ID,
      version: DEFAULT_TEMPLATE_VERSION,
      manifest: manifest as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Clone the manifest into a workspace atomically; returns per-entity counts. */
async function cloneManifest(
  prisma: PrismaClient,
  workspaceId: string,
  manifest: SeedManifest,
): Promise<SeedCounts> {
  const now = Date.now();

  return prisma.$transaction(async (tx) => {
    const datasetIdByCode: Record<string, string> = {};
    for (const d of manifest.datasets) {
      const rec = await tx.dataset.create({
        data: {
          workspaceId,
          code: d.code,
          name: d.name,
          description: d.description,
          domain: d.domain,
          team: d.team,
          refreshFreq: d.refreshFreq,
          type: d.type,
          rowCountEst: BigInt(d.rows),
          ownerUserId: d.owner,
          classification: d.level,
        },
      });
      datasetIdByCode[d.code] = rec.id;
    }

    let qualityResults = 0;
    for (const r of manifest.qualityRules) {
      const datasetId = datasetIdByCode[r.datasetCode];
      if (!datasetId) continue;
      const rule = await tx.qualityRule.create({
        data: {
          workspaceId,
          datasetId,
          code: r.code,
          name: r.name,
          dimension: r.dimension,
          type: r.type,
          severity: "warning",
        },
      });
      await tx.qualityResult.createMany({
        data: [
          { workspaceId, ruleId: rule.id, datasetId, runAt: new Date(now - 7 * DAY_MS), status: statusFor(r.prevScore), score: r.prevScore, issues: r.issues },
          { workspaceId, ruleId: rule.id, datasetId, runAt: new Date(now), status: statusFor(r.score), score: r.score, issues: r.issues },
        ],
      });
      qualityResults += 2;
    }

    await tx.standard.createMany({ data: manifest.standards.map((s) => ({ workspaceId, ...s })) });
    await tx.dataService.createMany({ data: manifest.services.map((s) => ({ workspaceId, ...s })) });

    return {
      datasets: manifest.datasets.length,
      standards: manifest.standards.length,
      qualityRules: manifest.qualityRules.length,
      qualityResults,
      services: manifest.services.length,
    };
  });
}

/**
 * Seed the workspace on first entry if it is marked pending (or, under
 * ARDA_SEED_AUTOFILL, never seen before). Best-effort and idempotent: safe to
 * call on every gated navigation. Never throws - callers render regardless.
 */
export async function fillWorkspaceIfNeeded(
  prisma: PrismaClient,
  workspaceId: string,
  orgId: string,
): Promise<FillOutcome> {
  try {
    const ref = await prisma.workspaceRef.findUnique({ where: { id: workspaceId } });

    if (!ref) {
      if (!autofillEnabled()) {
        // Record the isolation anchor but leave seeding to the platform.
        await prisma.workspaceRef.create({ data: { id: workspaceId, orgId } });
        return { seeded: false, reason: "recorded-new-workspace (autofill off)" };
      }
      await prisma.workspaceRef.create({ data: { id: workspaceId, orgId, seedStatus: "pending" } });
    } else if (ref.seedStatus !== "pending") {
      return { seeded: false, reason: `no-op (seedStatus=${ref.seedStatus ?? "null"})` };
    }

    // Concurrency-safe lease: exactly one caller flips pending -> seeding.
    const lease = await prisma.workspaceRef.updateMany({
      where: { id: workspaceId, seedStatus: "pending" },
      data: { seedStatus: "seeding" },
    });
    if (lease.count !== 1) return { seeded: false, reason: "lease-not-acquired (concurrent fill)" };

    try {
      await ensureSeedTemplate(prisma);
      const counts = await cloneManifest(prisma, workspaceId, DEFAULT_MANIFEST);
      await prisma.workspaceRef.update({ where: { id: workspaceId }, data: { seedStatus: "done" } });
      await prisma.auditLog.create({
        data: {
          workspaceId,
          actor: "system",
          action: "seed.fill",
          target: TEMPLATE_REF,
          metadata: counts as unknown as Prisma.InputJsonValue,
        },
      });
      return { seeded: true, reason: "filled", counts };
    } catch (err) {
      // Release the lease to failed so a later entry can retry, and audit it.
      await prisma.workspaceRef
        .update({ where: { id: workspaceId }, data: { seedStatus: "failed" } })
        .catch(() => undefined);
      await prisma.auditLog
        .create({
          data: {
            workspaceId,
            actor: "system",
            action: "seed.fail",
            target: TEMPLATE_REF,
            metadata: { error: String(err) } as unknown as Prisma.InputJsonValue,
          },
        })
        .catch(() => undefined);
      return { seeded: false, reason: "error" };
    }
  } catch {
    // findUnique/create/DB unavailable: never block the caller.
    return { seeded: false, reason: "skipped (db error)" };
  }
}
