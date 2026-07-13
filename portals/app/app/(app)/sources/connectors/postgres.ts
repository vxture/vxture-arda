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
