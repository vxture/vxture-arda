import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Client } from "pg";
import { HOSTED_STORAGE_SQL, hostedByteCount } from "./hosted-storage";

test("storage rejects invalid watermarks rather than rounding or charging them", () => {
  assert.equal(hostedByteCount(0n), 0);
  for (const value of [-1, NaN, Infinity, 1.5, 9_007_199_254_740_992n]) {
    assert.throws(() => hostedByteCount(value), /storage_gauge_invalid/);
  }
});

const databaseUrl = process.env.ARDA_STORAGE_TEST_DATABASE_URL;
test("hosted storage excludes external footprints, other tenants and global reference data", { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.equal(url.pathname, "/arda_storage_test");
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query("CREATE SCHEMA catalog");
    const tables = [...HOSTED_STORAGE_SQL.matchAll(/FROM catalog\."([A-Za-z]+)"/g)].map(match => match[1]);
    for (const table of tables) {
      await db.query(`CREATE TABLE catalog."${table}" ("workspaceId" text, "sizeBytes" bigint, description text)`);
    }
    await db.query('INSERT INTO catalog."Dataset" VALUES ($1, $2, $3)', ["w1", "1099511627776", "external 1 TB database"]);
    const read = async (workspace: string) => hostedByteCount((await db.query(HOSTED_STORAGE_SQL, [workspace])).rows[0].bytes);
    const ownBytes = await read("w1");
    assert.ok(ownBytes > 0 && ownBytes < 1024);
    await db.query('INSERT INTO catalog."Dataset" VALUES ($1, $2, $3), (NULL, $2, $3)', ["w2", "9999999999999999", "other"]);
    assert.equal(await read("w1"), ownBytes);
    assert.equal(await read("missing"), 0);
    assert.equal(await read("w1' OR true --"), 0);
    await db.query('INSERT INTO catalog."QualityResult" VALUES ($1, NULL, $2)', ["w1", "x".repeat(4096)]);
    assert.ok(await read("w1") > ownBytes + 4096);
  } finally {
    await db.query("ROLLBACK");
    await db.end();
  }
});
