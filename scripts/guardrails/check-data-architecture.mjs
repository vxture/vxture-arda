#!/usr/bin/env node
/**
 * check-data-architecture.mjs - DDL-authority guardrail (org governance #7).
 *
 * Keeps the three data-layer artifacts in lockstep:
 *   1. portals/app/prisma/schema.prisma   (app client source)
 *   2. deploy/database/ddl/00_baseline.sql (single DDL authority)
 *   3. deploy/database/ddl/98_column_locks.sql (UPDATE column whitelist)
 *
 * Checks:
 *   - every prisma model has a CREATE TABLE with an identical column set
 *   - every prisma enum has a CREATE TYPE with identical values
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

const SCALARS = new Set([
  "String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime",
  "Json", "Bytes",
]);
const ANCHORS = new Set(["id", "workspaceId", "createdAt"]);

const schema = readFileSync(SCHEMA, "utf8");
const baseline = readFileSync(BASELINE, "utf8");
const locks = readFileSync(LOCKS, "utf8");

const problems = [];

// ---- parse prisma ----------------------------------------------------------
const enums = new Map(); // name -> [values]
for (const m of schema.matchAll(/(?:^|\n)enum\s+(\w+)\s*\{([^}]*)\}/g)) {
  const values = m[2]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"))
    .map((l) => l.split(/\s+/)[0]);
  enums.set(m[1], values);
}

const models = new Map(); // name -> Set(columns)
for (const m of schema.matchAll(/(?:^|\n)model\s+(\w+)\s*\{([^}]*)\}/g)) {
  const cols = new Set();
  for (const raw of m[2].split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [field, typeRaw] = parts;
    const base = typeRaw.replace(/[[\]?]/g, "");
    if (SCALARS.has(base) || enums.has(base)) cols.add(field);
    // model-typed fields are relations, not columns
  }
  models.set(m[1], cols);
}

// ---- parse DDL baseline ----------------------------------------------------
const ddlTables = new Map(); // name -> Set(columns)
for (const m of baseline.matchAll(/CREATE TABLE "(\w+)" \(([\s\S]*?)\n\);/g)) {
  const cols = new Set();
  for (const raw of m[2].split("\n")) {
    const line = raw.trim();
    const cm = line.match(/^"(\w+)"\s/);
    if (cm) cols.add(cm[1]);
  }
  ddlTables.set(m[1], cols);
}

const ddlEnums = new Map(); // name -> [values]
for (const m of baseline.matchAll(/CREATE TYPE "(\w+)" AS ENUM \(([^)]*)\);/g)) {
  const values = [...m[2].matchAll(/'([^']*)'/g)].map((v) => v[1]);
  ddlEnums.set(m[1], values);
}

// ---- compare ----------------------------------------------------------------
for (const [name, cols] of models) {
  const ddl = ddlTables.get(name);
  if (!ddl) {
    problems.push(`model ${name}: no CREATE TABLE in ${BASELINE}`);
    continue;
  }
  for (const c of cols) if (!ddl.has(c)) problems.push(`table ${name}: column ${c} in prisma but not in DDL`);
  for (const c of ddl) if (!cols.has(c)) problems.push(`table ${name}: column ${c} in DDL but not in prisma`);
}
for (const name of ddlTables.keys()) {
  if (!models.has(name)) problems.push(`DDL table ${name} has no prisma model`);
}

for (const [name, values] of enums) {
  const ddl = ddlEnums.get(name);
  if (!ddl) {
    problems.push(`enum ${name}: no CREATE TYPE in ${BASELINE}`);
    continue;
  }
  if (JSON.stringify(values) !== JSON.stringify(ddl)) {
    problems.push(`enum ${name}: values differ (prisma ${values.join(",")} vs DDL ${ddl.join(",")})`);
  }
}
for (const name of ddlEnums.keys()) {
  if (!enums.has(name)) problems.push(`DDL enum ${name} has no prisma enum`);
}

// ---- column locks coverage ---------------------------------------------------
const grantCols = new Map(); // table -> [cols]
for (const m of locks.matchAll(/GRANT UPDATE \(([\s\S]*?)\)\s*\n?\s*ON "(\w+)" TO arda_svc;/g)) {
  const cols = [...m[1].matchAll(/"(\w+)"/g)].map((c) => c[1]);
  grantCols.set(m[2], cols);
}

for (const name of models.keys()) {
  const granted = grantCols.get(name);
  if (granted) {
    for (const c of granted) {
      if (ANCHORS.has(c)) problems.push(`column lock ${name}: anchor column ${c} must not be UPDATE-granted`);
      if (!models.get(name).has(c)) problems.push(`column lock ${name}: grants unknown column ${c}`);
    }
  } else if (!locks.includes(name)) {
    problems.push(
      `table ${name}: not covered in ${LOCKS} (add a GRANT UPDATE whitelist or list it as append-only)`,
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
