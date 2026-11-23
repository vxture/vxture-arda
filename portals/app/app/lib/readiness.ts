import { Client } from "pg";
import Redis from "ioredis";

const TIMEOUT_MS = 1000;

async function databaseReady(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const client = new Client({ connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: TIMEOUT_MS, query_timeout: TIMEOUT_MS });
  client.on("error", () => {});
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch { return false; }
  finally { await client.end().catch(() => {}); }
}

async function redisReady(): Promise<boolean> {
  if (!process.env.REDIS_URL) return false;
  const client = new Redis(process.env.REDIS_URL, { lazyConnect: true,
    connectTimeout: TIMEOUT_MS, commandTimeout: TIMEOUT_MS,
    maxRetriesPerRequest: 0, retryStrategy: () => null });
  client.on("error", () => {});
  try { await client.connect(); return await client.ping() === "PONG"; }
  catch { return false; }
  finally { client.disconnect(); }
}

export async function checkDependencies() {
  const [database, redis] = await Promise.all([databaseReady(), redisReady()]);
  return { database, redis };
}
