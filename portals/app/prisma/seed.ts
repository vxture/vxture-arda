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

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  await prisma.workspaceRef.upsert({
    where: { id: WORKSPACE_ID },
    update: {},
    create: { id: WORKSPACE_ID, orgId: ORG_ID },
  });

  for (const d of DATASETS) {
    await prisma.dataset.upsert({
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
  }

  const count = await prisma.dataset.count({ where: { workspaceId: WORKSPACE_ID } });
  // eslint-disable-next-line no-console
  console.log(`Seeded ${DATASETS.length} datasets; workspace ${WORKSPACE_ID} now has ${count}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
