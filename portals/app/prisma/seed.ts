/**
 * Dev/demo seed: populate a workspace with sample catalog datasets so the
 * DB-backed catalog has content locally. NOT run in deploy - on real stacks the
 * catalog is filled via the platform-triggered template seed (ADR section 4).
 *
 * Run: DATABASE_URL=... npm run db:seed  (optionally SEED_WORKSPACE_ID=...)
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import type { AssetLevel } from "../app/(app)/dashboard/seed";

const WORKSPACE_ID = process.env.SEED_WORKSPACE_ID ?? "dev-ws-001";
const ORG_ID = process.env.SEED_ORG_ID ?? "dev-org-001";

interface SeedDataset {
  code: string;
  name: string;
  domain: string;
  team: string;
  level: AssetLevel;
  refreshFreq: string;
  rows: number;
  type: string;
  owner: string;
  description: string;
}

const DATASETS: SeedDataset[] = [
  { code: "dw_customer_master", name: "Customer Master", domain: "customer", team: "platform", level: "core", refreshFreq: "realtime", rows: 12_100_000, type: "table", owner: "A. Rivera", description: "Authoritative master record for every customer: identity, contacts, and lifecycle attributes." },
  { code: "dw_order_txn", name: "Order Transactions", domain: "product", team: "engineering", level: "internal", refreshFreq: "daily", rows: 384_000_000, type: "table", owner: "L. Chen", description: "Line-item order and transaction history across all channels." },
  { code: "dw_web_clickstream", name: "Web Clickstream", domain: "web", team: "growth", level: "public", refreshFreq: "realtime", rows: 1_200_000_000, type: "stream", owner: "M. Okafor", description: "Page views, sessions, and events from web and app surfaces." },
  { code: "dw_revenue_ledger", name: "Revenue Ledger", domain: "finance", team: "finance", level: "sensitive", refreshFreq: "daily", rows: 27_400_000, type: "table", owner: "S. Patel", description: "Recognized revenue and billing events reconciled to the general ledger." },
  { code: "dw_mkt_attribution", name: "Marketing Attribution", domain: "marketing", team: "growth", level: "internal", refreshFreq: "daily", rows: 9_100_000, type: "table", owner: "R. Haddad", description: "Multi-touch attribution joining campaign spend to conversions." },
  { code: "dw_support_tickets", name: "Support Tickets", domain: "customer", team: "ops", level: "sensitive", refreshFreq: "realtime", rows: 18_600_000, type: "table", owner: "J. Park", description: "Customer support cases, interactions, and resolution metrics." },
  { code: "dw_inventory_iot", name: "Inventory Telemetry", domain: "operations", team: "ops", level: "internal", refreshFreq: "realtime", rows: 640_000_000, type: "stream", owner: "T. Mori", description: "Warehouse and fulfilment sensor telemetry." },
  { code: "dw_product_catalog", name: "Product Catalog", domain: "product", team: "engineering", level: "public", refreshFreq: "weekly", rows: 182_000, type: "table", owner: "C. Silva", description: "Canonical product, SKU, and pricing reference." },
  { code: "dw_subscriptions", name: "Subscription Entitlements", domain: "finance", team: "platform", level: "core", refreshFreq: "daily", rows: 4_600_000, type: "table", owner: "H. Yusuf", description: "Per-workspace subscription state and tier history mirrored from the platform." },
  { code: "dw_campaign_perf", name: "Campaign Performance", domain: "marketing", team: "analytics", level: "internal", refreshFreq: "daily", rows: 52_800_000, type: "view", owner: "R. Haddad", description: "Aggregated campaign delivery, engagement, and ROI metrics." },
  { code: "dw_churn_scores", name: "Churn Risk Scores", domain: "customer", team: "analytics", level: "sensitive", refreshFreq: "weekly", rows: 12_000_000, type: "table", owner: "L. Chen", description: "Model-scored churn propensity per customer with feature contributions." },
  { code: "dw_web_sessions", name: "Clickstream Sessions", domain: "web", team: "growth", level: "public", refreshFreq: "weekly", rows: 340_000_000, type: "view", owner: "M. Okafor", description: "Sessionised clickstream rollups with device, geo, and acquisition attributes." },
];

interface SeedStandard {
  code: string;
  name: string;
  type: string;
  ref: string;
  items: number;
  usage: number;
  status: string;
}

const STANDARDS: SeedStandard[] = [
  { code: "STD-001", name: "Country Codes", type: "code-set", ref: "ISO 3166-1", items: 249, usage: 1204, status: "published" },
  { code: "STD-002", name: "Currency Codes", type: "code-set", ref: "ISO 4217", items: 180, usage: 968, status: "published" },
  { code: "STD-003", name: "Unified Org Identifier", type: "data-element", ref: "Internal STD-ORG", items: 1, usage: 842, status: "published" },
  { code: "STD-004", name: "Postal Address Structure", type: "data-element", ref: "Internal STD-ADDR", items: 9, usage: 624, status: "published" },
  { code: "STD-005", name: "Product Category Taxonomy", type: "code-set", ref: "Internal 2026", items: 142, usage: 88, status: "draft" },
  { code: "STD-006", name: "Data Classification Levels", type: "code-set", ref: "Internal SEC", items: 64, usage: 53, status: "review" },
  { code: "STD-007", name: "Date / Time Format", type: "data-element", ref: "ISO 8601", items: 1, usage: 1486, status: "published" },
  { code: "STD-008", name: "Language Codes", type: "code-set", ref: "ISO 639-1", items: 184, usage: 312, status: "published" },
];

interface SeedRule {
  code: string;
  name: string;
  datasetCode: string;
  type: string;
  dimension: string;
  prevScore: number;
  score: number;
  issues: number;
}

const QUALITY_RULES: SeedRule[] = [
  { code: "Q-201", name: "Identifier checksum", datasetCode: "dw_customer_master", type: "not_null", dimension: "validity", prevScore: 99.4, score: 99.2, issues: 9842 },
  { code: "Q-188", name: "Order id uniqueness", datasetCode: "dw_order_txn", type: "unique", dimension: "uniqueness", prevScore: 97.2, score: 97.6, issues: 12480 },
  { code: "Q-174", name: "Geo bounds check", datasetCode: "dw_web_clickstream", type: "range", dimension: "accuracy", prevScore: 99.8, score: 99.8, issues: 1204 },
  { code: "Q-159", name: "Timestamp null rate", datasetCode: "dw_support_tickets", type: "not_null", dimension: "completeness", prevScore: 92.0, score: 91.4, issues: 184200 },
  { code: "Q-143", name: "Amount range threshold", datasetCode: "dw_revenue_ledger", type: "range", dimension: "validity", prevScore: 85.0, score: 86.2, issues: 42600 },
  { code: "Q-126", name: "Freshness SLA", datasetCode: "dw_churn_scores", type: "freshness", dimension: "timeliness", prevScore: 89.5, score: 88.7, issues: 23400 },
];

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

  const count = await prisma.dataset.count({ where: { workspaceId: WORKSPACE_ID } });
  const stdCount = await prisma.standard.count({ where: { workspaceId: WORKSPACE_ID } });
  const ruleCount = await prisma.qualityRule.count({ where: { workspaceId: WORKSPACE_ID } });
  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${DATASETS.length} datasets, ${STANDARDS.length} standards, ${QUALITY_RULES.length} quality rules; ` +
      `workspace ${WORKSPACE_ID} has ${count} datasets, ${stdCount} standards, ${ruleCount} rules.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
