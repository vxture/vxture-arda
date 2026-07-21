/**
 * Dev/demo seed: populate a workspace with sample catalog datasets so the
 * DB-backed catalog has content locally. NOT run in deploy - on real stacks the
 * catalog is filled via the platform-triggered template seed (ADR section 4).
 *
 * Run: DATABASE_URL=... pnpm --filter @arda/app run db:seed  (optionally SEED_WORKSPACE_ID=...)
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { DATASETS, STANDARDS, QUALITY_RULES, SERVICES } from "../app/lib/seed-manifest";

const WORKSPACE_ID = process.env.SEED_WORKSPACE_ID ?? "dev-ws-001";
const ORG_ID = process.env.SEED_ORG_ID ?? "dev-org-001";

// Seed content is the shared default manifest (single source of truth, also used
// by the runtime template cloner in app/lib/seed-fill.ts). This dev seed upserts
// it into a fixed workspace; the runtime path clones it into real workspaces.

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  await prisma.workspaceRef.upsert({
    where: { id: WORKSPACE_ID },
    update: {},
    create: { id: WORKSPACE_ID, orgId: ORG_ID },
  });

  const datasetIdByCode: Record<string, string> = {};
  for (const d of DATASETS) {
    const rec = await prisma.dataset.upsert({
      where: { workspaceId_code: { workspaceId: WORKSPACE_ID, code: d.code } },
      update: {
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
      create: {
        workspaceId: WORKSPACE_ID,
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

  const statusFor = (score: number): "pass" | "warn" | "fail" =>
    score >= 95 ? "pass" : score >= 90 ? "warn" : "fail";
  const now = Date.now();
  const DAY = 86_400_000;
  for (const r of QUALITY_RULES) {
    const datasetId = datasetIdByCode[r.datasetCode];
    if (!datasetId) continue;
    const rule = await prisma.qualityRule.upsert({
      where: { workspaceId_code: { workspaceId: WORKSPACE_ID, code: r.code } },
      update: { datasetId, name: r.name, dimension: r.dimension, type: r.type, severity: "warning" },
      create: { workspaceId: WORKSPACE_ID, datasetId, code: r.code, name: r.name, dimension: r.dimension, type: r.type, severity: "warning" },
    });
    await prisma.qualityResult.deleteMany({ where: { ruleId: rule.id } });
    await prisma.qualityResult.createMany({
      data: [
        { workspaceId: WORKSPACE_ID, ruleId: rule.id, datasetId, runAt: new Date(now - 7 * DAY), status: statusFor(r.prevScore), score: r.prevScore, issues: r.issues },
        { workspaceId: WORKSPACE_ID, ruleId: rule.id, datasetId, runAt: new Date(now), status: statusFor(r.score), score: r.score, issues: r.issues },
      ],
    });
  }

  for (const s of STANDARDS) {
    await prisma.standard.upsert({
      where: { workspaceId_code: { workspaceId: WORKSPACE_ID, code: s.code } },
      update: { name: s.name, type: s.type, ref: s.ref, items: s.items, usage: s.usage, status: s.status },
      create: { workspaceId: WORKSPACE_ID, ...s },
    });
  }

  for (const s of SERVICES) {
    await prisma.dataService.upsert({
      where: { workspaceId_code: { workspaceId: WORKSPACE_ID, code: s.code } },
      update: { name: s.name, path: s.path, method: s.method, domain: s.domain, level: s.level, type: s.type, status: s.status, description: s.description },
      create: { workspaceId: WORKSPACE_ID, ...s },
    });
  }

  const count = await prisma.dataset.count({ where: { workspaceId: WORKSPACE_ID } });
  const stdCount = await prisma.standard.count({ where: { workspaceId: WORKSPACE_ID } });
  const ruleCount = await prisma.qualityRule.count({ where: { workspaceId: WORKSPACE_ID } });
  const svcCount = await prisma.dataService.count({ where: { workspaceId: WORKSPACE_ID } });
  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${DATASETS.length} datasets, ${STANDARDS.length} standards, ${QUALITY_RULES.length} quality rules, ` +
      `${SERVICES.length} services; workspace ${WORKSPACE_ID} has ${count} datasets, ${stdCount} standards, ` +
      `${ruleCount} rules, ${svcCount} services.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
