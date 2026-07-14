import { Client } from "pg";
import { assertConnectorTarget } from "./net-guard";
import type { ConnectionTestResult, DiscoveredDataset, SourceConnector } from "./types";

interface PgConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}

const CONNECT_TIMEOUT_MS = 5_000;
const QUERY_TIMEOUT_MS = 10_000;

function parseConfig(config: unknown): PgConfig {
  const c = (config ?? {}) as Record<string, unknown>;
  const host = typeof c.host === "string" ? c.host : "";
  const database = typeof c.database === "string" ? c.database : "";
  const user = typeof c.user === "string" ? c.user : "";
  if (!host || !database || !user) {
    const err = new Error("postgres config requires host/database/user");
    (err as { reason?: string }).reason = "config";
    throw err;
  }
  return {
    host,
    port: typeof c.port === "number" ? c.port : 5432,
    database,
    user,
    password: typeof c.password === "string" ? c.password : undefined,
    ssl: c.ssl === true,
  };
}

async function connect(config: unknown): Promise<Client> {
  const cfg = parseConfig(config);
  assertConnectorTarget(cfg.host);
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
  });
  await client.connect();
  return client;
}

/** Live PostgreSQL introspection: pg_catalog metadata only, never row data. */
export const postgresConnector: SourceConnector = {
  async test(config): Promise<ConnectionTestResult> {
    try {
      const client = await connect(config);
      await client.query("select 1");
      await client.end();
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: reasonOf(err) };
    }
  },

  async pullMetadata(config): Promise<DiscoveredDataset[]> {
    const client = await connect(config);
    try {
      const res = await client.query<{
        schema: string;
        name: string;
        relkind: string;
        row_est: string;
        size_bytes: string;
      }>(
        `select n.nspname as schema, c.relname as name, c.relkind,
                greatest(c.reltuples, 0)::bigint::text as row_est,
                pg_total_relation_size(c.oid)::text as size_bytes
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where c.relkind in ('r', 'p', 'v', 'm')
            and n.nspname not in ('pg_catalog', 'information_schema')
          order by n.nspname, c.relname
          limit 500`,
      );
      return res.rows.map((r) => ({
        sourceLocalId: `${r.schema}.${r.name}`,
        name: r.name,
        type: r.relkind === "v" || r.relkind === "m" ? "view" : "table",
        location: `${r.schema}.${r.name}`,
        rowCountEst: BigInt(r.row_est),
        sizeBytes: BigInt(r.size_bytes),
      }));
    } finally {
      await client.end();
    }
  },
};

function reasonOf(err: unknown): string {
  const reason = (err as { reason?: string })?.reason;
  if (reason) return reason;
  const code = (err as { code?: string })?.code ?? "";
  if (code === "28P01" || code === "28000") return "auth";
  if (code === "ETIMEDOUT" || /timeout/i.test(String(err))) return "timeout";
  if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "EHOSTUNREACH") return "unreachable";
  return "error";
}

// ---- Quality check pushdown (Q-BL1) ------------------------------------------

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Quote a SQL identifier after strict validation (defense against config-borne
 *  injection: rule configs are workspace-admin input, still untrusted here). */
function ident(name: unknown): string | null {
  if (typeof name !== "string" || !IDENT.test(name)) return null;
  return `"${name}"`;
}

function relation(location: string): string | null {
  const parts = location.split(".");
  if (parts.length !== 2) return null;
  const schema = ident(parts[0]);
  const table = ident(parts[1]);
  return schema && table ? `${schema}.${table}` : null;
}

interface CheckSql {
  /** Must select: total bigint, issues bigint. */
  sql: string;
  params: unknown[];
}

function buildCheckSql(spec: import("./types").QualityCheckSpec): CheckSql | { error: string } {
  const rel = relation(spec.location);
  if (!rel) return { error: "bad_location" };
  const c = spec.config;

  switch (spec.type) {
    case "not_null": {
      const col = ident(c.column);
      if (!col) return { error: "bad_column" };
      return { sql: `select count(*)::bigint as total, count(*) filter (where ${col} is null)::bigint as issues from ${rel}`, params: [] };
    }
    case "unique": {
      const col = ident(c.column);
      if (!col) return { error: "bad_column" };
      return {
        sql: `select count(*)::bigint as total, (count(*) - count(distinct ${col}))::bigint as issues from ${rel} where ${col} is not null`,
        params: [],
      };
    }
    case "range": {
      const col = ident(c.column);
      if (!col) return { error: "bad_column" };
      const min = typeof c.min === "number" ? c.min : null;
      const max = typeof c.max === "number" ? c.max : null;
      if (min === null && max === null) return { error: "bad_range" };
      const conds: string[] = [];
      if (min !== null) conds.push(`${col} < $1`);
      if (max !== null) conds.push(`${col} > $${min !== null ? 2 : 1}`);
      const params = [min, max].filter((v): v is number => v !== null);
      return {
        sql: `select count(*)::bigint as total, count(*) filter (where ${conds.join(" or ")})::bigint as issues from ${rel} where ${col} is not null`,
        params,
      };
    }
    case "freshness": {
      const col = ident(c.column);
      const hours = typeof c.maxAgeHours === "number" ? c.maxAgeHours : null;
      if (!col || hours === null || hours <= 0) return { error: "bad_freshness" };
      return {
        sql: `select 0::bigint as total, (case when max(${col}) is null or max(${col}) < now() - ($1 || ' hours')::interval then 1 else 0 end)::bigint as issues from ${rel}`,
        params: [String(hours)],
      };
    }
    case "row_count": {
      const min = typeof c.min === "number" ? c.min : null;
      if (min === null || min < 0) return { error: "bad_row_count" };
      return { sql: `select count(*)::bigint as total, (case when count(*) < $1 then 1 else 0 end)::bigint as issues from ${rel}`, params: [min] };
    }
    default:
      return { error: "unsupported_type" };
  }
}

postgresConnector.checkQuality = async function checkQuality(config, checks) {
  const client = await connect(config);
  const outcomes: import("./types").QualityCheckOutcome[] = [];
  try {
    for (const spec of checks) {
      const built = buildCheckSql(spec);
      if ("error" in built) {
        outcomes.push({ ruleId: spec.ruleId, issues: 0, score: null, total: 0, error: built.error });
        continue;
      }
      try {
        const res = await client.query<{ total: string; issues: string }>(built.sql, built.params);
        const total = Number(res.rows[0]?.total ?? 0);
        const issues = Number(res.rows[0]?.issues ?? 0);
        const score = total > 0 ? Math.round(((total - issues) / total) * 10000) / 100 : null;
        outcomes.push({ ruleId: spec.ruleId, issues, score, total });
      } catch (err) {
        const code = (err as { code?: string })?.code ?? "";
        outcomes.push({
          ruleId: spec.ruleId,
          issues: 0,
          score: null,
          total: 0,
          error: code === "42703" ? "missing_column" : code === "42P01" ? "missing_relation" : "query_error",
        });
      }
    }
    return outcomes;
  } finally {
    await client.end();
  }
};
