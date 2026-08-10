/**
 * Rich test-data injector for TEST environments (dev / beta). Standalone -
 * never part of any deploy chain; real stacks get product data via the
 * platform seed flow.
 *
 * Deterministic (seeded RNG) and idempotent: it OWNS its workspace and wipes
 * that workspace's rows first. Safety: the workspace id must start with
 * dev-/test- unless SEED_ALLOW_ANY=1.
 *
 * Modes:
 *   direct (default)  writes via Prisma using DATABASE_URL
 *     dev:  DATABASE_URL=postgresql://arda:arda@localhost:15432/vx_arda_db?schema=public \
 *           pnpm --filter @arda/app run db:seed:test
 *   EMIT=sql          prints SQL to stdout (no DB touched) - pipe into any
 *                     psql, e.g. beta over SSH:
 *     EMIT=sql pnpm --filter @arda/app run db:seed:test | \
 *       ssh <host> "docker exec -i arda-beta-db psql -v ON_ERROR_STOP=1 -U arda -d vx_arda_db"
 *
 * Scale via SEED_SCALE (default 1): datasets = 60*scale, results = 14 days
 * per rule. Test API keys (plaintext, TEST ONLY - never mint these in prod):
 *   ak_test_full_0001      all scopes
 *   ak_test_readonly_0001  catalog:read only
 */
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const WS = process.env.SEED_WORKSPACE_ID ?? "test-ws-rich";
const ORG = process.env.SEED_ORG_ID ?? "test-org-rich";
const SCALE = Math.max(1, Number(process.env.SEED_SCALE) || 1);
const EMIT_SQL = process.env.EMIT === "sql";

if (!/^(dev-|test-)/.test(WS) && process.env.SEED_ALLOW_ANY !== "1") {
  console.error(`refusing to own workspace '${WS}' (must start dev-/test-, or set SEED_ALLOW_ANY=1)`);
  process.exit(1);
}

// mulberry32 - deterministic runs, stable ids across re-runs.
let s = 0x9e3779b9;
const rnd = () => ((s = (s + 0x6d2b79f5) | 0), (((s ^ (s >>> 15)) * (1 | s)) >>> 0) / 4294967296);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
const id = (p: string, n: number) => `${p}-${WS}-${String(n).padStart(4, "0")}`;
const day = 24 * 3600 * 1000;
const T0 = Date.parse("2026-08-01T00:00:00Z");

const DOMAINS = ["sales", "finance", "hr", "logistics", "marketing", "iot"] as const;
const TEAMS = ["core-dw", "growth", "ops", "risk"] as const;
const TYPES = ["table", "view", "file", "stream"] as const;
const LEVELS = ["public", "internal", "internal", "sensitive", "core"] as const;
const AGENTS = ["runos", "umbra", "curator"] as const;
const DIMS = ["completeness", "accuracy", "validity", "uniqueness", "timeliness", "consistency"] as const;

type Row = Record<string, unknown>;
const plan: Array<{ table: string; rows: Row[] }> = [];
const add = (table: string, rows: Row[]) => rows.length && plan.push({ table, rows });

// ---- build rows --------------------------------------------------------------
const nDs = 60 * SCALE;
const sources = [0, 1, 2].map((i) => ({
  id: id("src", i), workspaceId: WS, orgId: ORG, productCode: "arda",
  name: ["dwh-postgres", "crm-rest", "landing-files"][i], type: ["postgres", "rest", "file"][i],
  status: "connected", lastSyncedAt: new Date(T0 + 8 * day), createdAt: new Date(T0),
}));
add("DataSource", sources);

const datasets = Array.from({ length: nDs }, (_, i) => {
  const dm = pick(DOMAINS);
  return {
    id: id("ds", i), workspaceId: WS, dataSourceId: pick(sources).id,
    name: `${dm} ${["orders", "customers", "events", "ledger", "shipments", "sessions"][i % 6]} ${i}`,
    code: `tst_${dm}_${i}`, description: `Rich test dataset #${i} for ${dm}`,
    domain: dm, team: pick(TEAMS), refreshFreq: pick(["realtime", "daily", "weekly", "monthly"] as const),
    type: pick(TYPES), location: `warehouse.${dm}.t${i}`,
    rowCountEst: BigInt(Math.floor(rnd() * 5_000_000)), sizeBytes: BigInt(Math.floor(rnd() * 8e9)),
    ownerUserId: null, ownerApp: rnd() < 0.5 ? pick(AGENTS) : null,
    goldenRecord: rnd() < 0.1, classification: pick(LEVELS), scope: "workspace",
    createdAt: new Date(T0 + (i % 7) * day), updatedAt: new Date(T0 + 8 * day),
  };
});
add("Dataset", datasets);

const tags = ["pii", "gdpr", "hot", "deprecated", "certified", "raw", "mart", "kpi", "ml-feature", "finance-close", "realtime", "external"]
  .map((name, i) => ({ id: id("tag", i), workspaceId: WS, name, color: null }));
add("Tag", tags);
add("DatasetTag", datasets.flatMap((d, i) => [tags[i % tags.length], tags[(i * 5 + 3) % tags.length]]
  .filter((t, j, a) => a.indexOf(t) === j)
  .map((t) => ({ datasetId: d.id, tagId: t.id, workspaceId: WS }))));

add("GlossaryTerm", Array.from({ length: 20 }, (_, i) => ({
  id: id("gt", i), workspaceId: WS, term: `tst term ${i}`,
  definition: `Business definition #${i} used by ${pick(DOMAINS)}.`, stewardUserId: null, scope: "workspace",
})));

const standards = Array.from({ length: 8 }, (_, i) => ({
  id: id("std", i), workspaceId: WS, code: `TST-STD-${i}`, name: `test standard ${i}`,
  type: i % 2 ? "data-element" : "code-set", ref: `ISO-${3166 + i}`, items: 10 + i, usage: i * 3,
  status: pick(["published", "draft", "review"] as const), scope: "workspace",
  createdAt: new Date(T0), updatedAt: new Date(T0 + 5 * day),
}));
add("Standard", standards);
add("DatasetStandard", datasets.filter((_, i) => i % 4 === 0)
  .map((d, i) => ({ datasetId: d.id, standardId: standards[i % standards.length].id, workspaceId: WS })));

const rules = datasets.filter((_, i) => i % 3 === 0).flatMap((d, i) =>
  Array.from({ length: 1 + (i % 3) }, (_, j) => ({
    id: id("qr", i * 4 + j), workspaceId: WS, datasetId: d.id, code: `TQ-${i * 4 + j}`,
    name: `${pick(DIMS)} check ${j} on ${d.code}`, dimension: pick(DIMS),
    type: pick(["not_null", "unique", "range", "freshness"] as const),
    config: { threshold: 95 }, severity: pick(["info", "warning", "critical"] as const), enabled: rnd() < 0.9,
  })));
add("QualityRule", rules);
add("QualityResult", rules.flatMap((r, ri) => Array.from({ length: 14 }, (_, dIdx) => {
  const trend = ri % 3; // 0 improving, 1 degrading, 2 stable
  const base = trend === 0 ? 80 + dIdx : trend === 1 ? 99 - dIdx * 1.5 : 96;
  const score = Math.max(0, Math.min(100, base + (rnd() * 4 - 2)));
  return {
    id: id("qres", ri * 14 + dIdx), workspaceId: WS, ruleId: r.id, datasetId: r.datasetId,
    runAt: new Date(T0 + dIdx * day), status: score >= 95 ? "pass" : score >= 80 ? "warn" : "fail",
    score: Math.round(score * 10) / 10, issues: score >= 95 ? 0 : Math.floor((100 - score) * 3), details: null,
  };
})));

// Layered DAG: edges only from lower to higher layer index - cycle-free.
const layer = (i: number) => i % 4;
const edges: Row[] = [];
for (let i = 0; i < nDs; i++) for (let k = 0; k < 2; k++) {
  const j = Math.floor(rnd() * nDs);
  if (layer(i) < layer(j) && !edges.some((e) => e.upstreamDatasetId === datasets[i].id && e.downstreamDatasetId === datasets[j].id)) {
    edges.push({ id: id("le", edges.length), workspaceId: WS, upstreamDatasetId: datasets[i].id,
      downstreamDatasetId: datasets[j].id, transform: pick(["join", "aggregate", "filter", "enrich"] as const), jobId: `job-${edges.length}` });
  }
}
add("LineageEdge", edges);

const services = Array.from({ length: 10 }, (_, i) => ({
  id: id("svc", i), workspaceId: WS, code: `API-${1000 + i}`, name: `test service ${i}`,
  path: `/api/v2/test/${i}`, method: i % 3 ? "GET" : "POST", domain: pick(DOMAINS),
  level: pick(LEVELS), type: pick(["rest_api", "query", "export"] as const), config: null,
  status: pick(["draft", "running", "running", "review", "paused"] as const),
  ownerApp: rnd() < 0.4 ? pick(AGENTS) : null, visibility: i % 5 === 0 ? "owner" : "workspace",
  publishedAt: new Date(T0 + 3 * day), createdAt: new Date(T0),
}));
add("DataService", services);
add("DataServiceDataset", services.flatMap((svc, i) => [datasets[i * 3 % nDs], datasets[(i * 3 + 1) % nDs]]
  .map((d) => ({ dataServiceId: svc.id, datasetId: d.id, workspaceId: WS }))));

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
add("ApiKey", [
  { id: id("ak", 0), workspaceId: WS, dataServiceId: null, name: "test-full", consumerApp: "runos",
    hashedKey: sha("ak_test_full_0001"), scopes: ["catalog:read", "catalog:write", "quality:read", "lineage:read", "lineage:write", "access:write"],
    lastUsedAt: null, revoked: false, createdAt: new Date(T0) },
  { id: id("ak", 1), workspaceId: WS, dataServiceId: null, name: "test-readonly", consumerApp: "runos-ro",
    hashedKey: sha("ak_test_readonly_0001"), scopes: ["catalog:read"], lastUsedAt: null, revoked: false, createdAt: new Date(T0) },
]);

add("AccessRequest", Array.from({ length: 12 }, (_, i) => ({
  id: id("ar", i), workspaceId: WS, datasetId: datasets[i * 2 % nDs].id, requesterSub: `user-${i}`,
  requesterName: `Test User ${i}`, useCase: `analysis case ${i}`, scope: null,
  justification: `needs ${pick(DOMAINS)} data for test scenario ${i}`, duration: "30d", method: "api",
  status: pick(["pending", "pending", "approved", "rejected", "cancelled"] as const),
  decidedBy: i % 3 ? "admin-1" : null, decidedAt: i % 3 ? new Date(T0 + 4 * day) : null,
  decisionNote: null, createdAt: new Date(T0 + (i % 6) * day),
})));

add("AuditLog", Array.from({ length: 30 }, (_, i) => ({
  id: id("al", i), workspaceId: WS, actor: i % 2 ? `apikey:runos` : `user-${i % 5}`,
  action: pick(["catalog.dataset.register", "metadata.tag.attach", "lineage.change", "service.access", "access.request.submit"] as const),
  target: datasets[i % nDs].id, idempotencyKey: null, metadata: { seeded: true, n: i }, createdAt: new Date(T0 + (i % 9) * day),
})));

// ---- emitters ----------------------------------------------------------------
const TABLE_SCHEMA: Record<string, string> = { UsageRaw: "local_usage" };
const WIPE_ORDER = ["AuditLog", "AccessRequest", "ApiKey", "DataServiceDataset", "DataService", "LineageEdge",
  "QualityResult", "QualityRule", "DatasetStandard", "Standard", "GlossaryTerm", "DatasetTag", "Tag", "Dataset", "DataSource"];

function sqlVal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "boolean" || typeof v === "number" || typeof v === "bigint") return String(v);
  if (Array.isArray(v)) return `ARRAY[${v.map((x) => sqlVal(x)).join(",")}]::text[]`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main(): Promise<void> {
  if (EMIT_SQL) {
    const out: string[] = ["BEGIN;"];
    out.push(`INSERT INTO vx_provision."app_instance" ("id","orgId","status","createdAt","updatedAt") VALUES ('${WS}','${ORG}','provisioned',now(),now()) ON CONFLICT ("id") DO NOTHING;`);
    for (const t of WIPE_ORDER) out.push(`DELETE FROM catalog."${t}" WHERE "workspaceId" = '${WS}';`);
    for (const { table, rows } of plan) {
      const schema = TABLE_SCHEMA[table] ?? "catalog";
      const cols = Object.keys(rows[0]);
      for (const r of rows) {
        out.push(`INSERT INTO ${schema}."${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map((c) => sqlVal(r[c])).join(",")});`);
      }
    }
    out.push("COMMIT;");
    process.stdout.write(out.join("\n") + "\n");
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  await prisma.workspaceRef.upsert({ where: { id: WS }, update: {}, create: { id: WS, orgId: ORG } });
  const client = prisma as unknown as Record<string, { deleteMany: (a: object) => Promise<unknown>; createMany: (a: object) => Promise<unknown> }>;
  const model = (t: string) => client[t[0].toLowerCase() + t.slice(1)];
  for (const t of WIPE_ORDER) await model(t).deleteMany({ where: { workspaceId: WS } });
  for (const { table, rows } of plan) await model(table).createMany({ data: rows });
  console.log(`seeded workspace '${WS}': ` + plan.map((p) => `${p.table}=${p.rows.length}`).join(", "));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
