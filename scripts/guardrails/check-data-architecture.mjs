#!/usr/bin/env node
/**
 * check-data-architecture.mjs - DDL-authority guardrail (org governance #7).
 *
 * Keeps the three data-layer artifacts in lockstep:
 *   1. portals/app/prisma/schema.prisma   (app client source)
 *   2. deploy/database/ddl/00_baseline.sql (single DDL authority)
 *   3. deploy/database/ddl/98_column_locks.sql (UPDATE column whitelist)
 *
 * Multi-schema aware (ADR-012): a prisma model's PHYSICAL identity is
 * (schema, table) where schema = @@schema("...") and table = @@map("...") or
 * the model name. The DDL is matched by that same (schema, table) pair.
 * Unqualified DDL objects default to the `catalog` domain schema (the head of
 * the baseline's search_path); the four contract tables are schema-qualified.
 *
 * Checks:
 *   - every prisma model has a CREATE TABLE (same schema+table) with an
 *     identical column set
 *   - every prisma enum has a CREATE TYPE (same schema+type) with identical
 *     values
 *   - no extra tables/enums in the DDL that prisma does not know
 *   - every table is covered in 98_column_locks.sql (a GRANT UPDATE or an
 *     explicit append-only mention) and no GRANT whitelists an anchor column
 *     (id / workspaceId / createdAt)
 *
 * Zero-dep node; wired into CI quality-gate static-checks (hard gate).
 */

import { readFileSync } from "node:fs";

const SCHEMA = "portals/app/prisma/schema.prisma";
const BASELINE = "deploy/database/ddl/00_baseline.sql";
const LOCKS = "deploy/database/ddl/98_column_locks.sql";

// Unqualified DDL objects land here (head of the baseline search_path).
const DEFAULT_SCHEMA = "catalog";

const SCALARS = new Set([
  "String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime",
  "Json", "Bytes",
]);
const ANCHORS = new Set(["id", "workspaceId", "createdAt"]);

const schema = readFileSync(SCHEMA, "utf8");
const baseline = readFileSync(BASELINE, "utf8");
const locks = readFileSync(LOCKS, "utf8");

const problems = [];
const key = (s, t) => `${s}.${t}`;

// ---- parse prisma ----------------------------------------------------------
function attr(body, name) {
  const m = body.match(new RegExp(`@@${name}\\("([^"]+)"\\)`));
  return m ? m[1] : null;
}

const enums = new Map(); // "schema.Enum" -> [values]
for (const m of schema.matchAll(/(?:^|\n)enum\s+(\w+)\s*\{([^}]*)\}/g)) {
  const body = m[2];
  const sch = attr(body, "schema") ?? DEFAULT_SCHEMA;
  const values = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
    .map((l) => l.split(/\s+/)[0]);
  enums.set(key(sch, m[1]), values);
}

const models = new Map(); // "schema.table" -> {cols:Set, model}
for (const m of schema.matchAll(/(?:^|\n)model\s+(\w+)\s*\{([^}]*)\}/g)) {
  const model = m[1];
  const body = m[2];
  const sch = attr(body, "schema") ?? DEFAULT_SCHEMA;
  const table = attr(body, "map") ?? model;
  const cols = new Set();
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [field, typeRaw] = parts;
    const base = typeRaw.replace(/[[\]?]/g, "");
    if (SCALARS.has(base) || enums.has(key(sch, base)) || [...enums.keys()].some((k) => k.endsWith(`.${base}`))) {
      cols.add(field);
    }
    // model-typed fields are relations, not columns
  }
  models.set(key(sch, table), { cols, model });
}

// ---- parse DDL baseline ----------------------------------------------------
const ddlTables = new Map(); // "schema.table" -> Set(columns)
for (const m of baseline.matchAll(/CREATE TABLE (?:"(\w+)"\.)?"(\w+)" \(([\s\S]*?)\n\);/g)) {
  const sch = m[1] ?? DEFAULT_SCHEMA;
  const cols = new Set();
  for (const raw of m[3].split("\n")) {
    const line = raw.trim();
    const cm = line.match(/^"(\w+)"\s/);
    if (cm) cols.add(cm[1]);
  }
  ddlTables.set(key(sch, m[2]), cols);
}

const ddlEnums = new Map(); // "schema.Enum" -> [values]
for (const m of baseline.matchAll(/CREATE TYPE (?:"(\w+)"\.)?"(\w+)" AS ENUM \(([^)]*)\);/g)) {
  const sch = m[1] ?? DEFAULT_SCHEMA;
  const values = [...m[3].matchAll(/'([^']*)'/g)].map((v) => v[1]);
  ddlEnums.set(key(sch, m[2]), values);
}

// ---- compare ----------------------------------------------------------------
for (const [k, { cols, model }] of models) {
  const ddl = ddlTables.get(k);
  if (!ddl) {
    problems.push(`model ${model} (${k}): no matching CREATE TABLE in ${BASELINE}`);
    continue;
  }
  for (const c of cols) if (!ddl.has(c)) problems.push(`table ${k}: column ${c} in prisma but not in DDL`);
  for (const c of ddl) if (!cols.has(c)) problems.push(`table ${k}: column ${c} in DDL but not in prisma`);
}
for (const k of ddlTables.keys()) {
  if (!models.has(k)) problems.push(`DDL table ${k} has no prisma model`);
}

for (const [k, values] of enums) {
  const ddl = ddlEnums.get(k);
  if (!ddl) {
    problems.push(`enum ${k}: no CREATE TYPE in ${BASELINE}`);
    continue;
  }
  if (JSON.stringify(values) !== JSON.stringify(ddl)) {
    problems.push(`enum ${k}: values differ (prisma ${values.join(",")} vs DDL ${ddl.join(",")})`);
  }
}
for (const k of ddlEnums.keys()) {
  if (!enums.has(k)) problems.push(`DDL enum ${k} has no prisma enum`);
}

// ---- column locks coverage ---------------------------------------------------
// GRANT UPDATE (cols) ON "schema"."table" (or unqualified) TO arda_svc.
const grantCols = new Map(); // "schema.table" -> [cols]
for (const m of locks.matchAll(/GRANT UPDATE \(([\s\S]*?)\)\s*\n?\s*ON (?:"(\w+)"\.)?"(\w+)" TO arda_svc;/g)) {
  const cols = [...m[1].matchAll(/"(\w+)"/g)].map((c) => c[1]);
  grantCols.set(key(m[2] ?? DEFAULT_SCHEMA, m[3]), cols);
}

for (const [k, { cols, model }] of models) {
  const [, table] = k.split(".");
  const granted = grantCols.get(k);
  if (granted) {
    for (const c of granted) {
      if (ANCHORS.has(c)) problems.push(`column lock ${k}: anchor column ${c} must not be UPDATE-granted`);
      if (!cols.has(c)) problems.push(`column lock ${k}: grants unknown column ${c}`);
    }
  } else if (!locks.includes(`"${table}"`) && !locks.includes(table) && !locks.includes(model)) {
    problems.push(
      `table ${k}: not covered in ${LOCKS} (add a GRANT UPDATE whitelist or list it as append-only)`,
    );
  }
}

// ---- seed idempotency ---------------------------------------------------------
// Every INSERT in the demo seed must be an upsert (governance #8 seed guardrail).
const seed = readFileSync("portals/app/prisma/seed.sql", "utf8");
const inserts = (seed.match(/INSERT INTO/g) || []).length;
const conflicts = (seed.match(/ON CONFLICT/g) || []).length;
if (inserts !== conflicts) {
  problems.push(
    `seed.sql: ${inserts} INSERT INTO but ${conflicts} ON CONFLICT - every insert must be idempotent`,
  );
}

if (problems.length) {
  console.error(`[data-architecture] ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `[data-architecture] OK - ${models.size} tables, ${enums.size} enums in lockstep; ` +
    `${grantCols.size} UPDATE whitelists, anchors locked.`,
);
