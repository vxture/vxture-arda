import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { handleProvisioningEvent, applyLifecycle, lockWorkspace } from "./handler";
import type { ProvisioningPayload } from "./payload";
import { advanceAccessRevision, publishWorkspaceRevision } from "../../events/outbox";

const databaseUrl = process.env.ARDA_PROVISIONING_TEST_DATABASE_URL;
test("real PG serializes reversed/duplicate events and versionless notifications without watermark regression",
  { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.equal(url.pathname, "/arda_provisioning_test");
  const pg = new Client({ connectionString: databaseUrl });
  await pg.connect();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  process.env.MOCK_AUTH = "true";
  try {
    await pg.query(await readFile(new URL("../../../../../deploy/database/ddl/00_baseline.sql", import.meta.url), "utf8"));
    // Replay the exact db-init sequence across both historical domain layouts.
    // Each file gets a fresh public search_path, as separate psql invocations do.
    await pg.query("CREATE ROLE arda_svc NOLOGIN");
    const increments = ["0001_access_request.sql", "0002_drop_platform_sentinel.sql",
      "0003_schema_split.sql", "0004_access_revision.sql"];
    const replay = async () => {
      for (const name of increments) {
        await pg.query("SET search_path TO public");
        await pg.query(await readFile(new URL(`../../../../../deploy/database/ddl/incr/${name}`, import.meta.url), "utf8"));
      }
      const count = await pg.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname IN ('public','catalog','vx_provision','local_usage','local_authz')");
      assert.equal(count.rows[0].n, 23, "replay must not create public shadow tables");
      assert.equal((await pg.query(`SELECT to_regclass('public."AccessRequest"') AS shadow`)).rows[0].shadow, null);
    };
    await replay();
    await pg.query('CREATE TABLE public."AccessRequest" (LIKE catalog."AccessRequest" INCLUDING ALL)');
    await replay();
    await pg.query(`CREATE TABLE public."AccessRequest" (id TEXT); INSERT INTO public."AccessRequest" VALUES ('must-preserve')`);
    await assert.rejects(replay(), /Nonempty public AccessRequest shadow/);
    await pg.query("ROLLBACK");
    assert.equal((await pg.query('SELECT id FROM public."AccessRequest"')).rows[0].id, "must-preserve");
    await pg.query('DROP TABLE public."AccessRequest"');
    // Recreate the pre-ADR-012 domain location, then migrate it forward again.
    const tables = await pg.query("SELECT tablename FROM pg_tables WHERE schemaname='catalog'");
    for (const { tablename } of tables.rows) {
      assert.match(tablename, /^[A-Za-z]+$/);
      await pg.query(`ALTER TABLE catalog."${tablename}" SET SCHEMA public`);
    }
    for (const name of ["AssetLevel", "QualityStatus", "AssetScope"]) {
      await pg.query(`ALTER TYPE catalog."${name}" SET SCHEMA public`);
    }
    await pg.query("DROP SCHEMA catalog");
    await replay();
    await replay();
    const event = (seq: number, type: "tenant.provisioned" | "tenant.deprovisioned" = "tenant.provisioned"): ProvisioningPayload => ({
      id: `d${seq}`, type, seq, occurred_at: 1_795_000_000,
      workspace_id: "w1", tenant_id: "o1", application: "arda", data: {},
    });
    await Promise.all([handleProvisioningEvent(event(5, "tenant.deprovisioned"), db),
      ...[1, 2, 3, 4, 5].map(seq => handleProvisioningEvent(event(seq, seq === 5 ? "tenant.deprovisioned" : "tenant.provisioned"), db))]);
    assert.equal((await db.provisionSeq.findFirst())!.lastSeq, 5);
    assert.equal((await db.workspaceRef.findUnique({ where: { id: "w1" } }))!.status, "deprovisioned");
    assert.equal(await db.webhookDelivery.count(), 5);
    const notification: ProvisioningPayload = { id: "notify1", type: "subscription_changed",
      occurred_at: 1_795_000_000, workspace_id: "w1", tenant_id: "o1", application: "arda", data: {} };
    await handleProvisioningEvent(notification, db);
    const generation = (await db.accessRevision.findUnique({ where: { workspaceId: "w1" } }))!.generation;
    await handleProvisioningEvent(notification, db);
    assert.equal((await db.accessRevision.findUnique({ where: { workspaceId: "w1" } }))!.generation, generation);
    assert.equal((await db.accessRevision.findUnique({ where: { workspaceId: "w1" } }))!.publishedGeneration, 0n,
      "a committed but unpublished invalidation remains recoverable");
    await assert.rejects(publishWorkspaceRevision("w1", db, async () => { throw new Error("redis-unavailable"); }), /redis-unavailable/);
    assert.equal((await db.accessRevision.findUnique({ where: { workspaceId: "w1" } }))!.publishedGeneration, 0n);
    await publishWorkspaceRevision("w1", db, async () => {
      await db.$transaction(tx => advanceAccessRevision(tx, "w1"));
    });
    assert.equal((await db.accessRevision.findUnique({ where: { workspaceId: "w1" } }))!.publishedGeneration, 0n,
      "a concurrent newer commit cannot be acknowledged by an older publisher");
    await publishWorkspaceRevision("w1", db, async () => {});
    const published = (await db.accessRevision.findUnique({ where: { workspaceId: "w1" } }))!;
    assert.equal(published.publishedGeneration, published.generation);
    await assert.rejects(db.$transaction(async tx => {
      await lockWorkspace(tx, "rollback-ws");
      await applyLifecycle(tx, { workspaceId: "rollback-ws", tenantId: "o1", state: "provisioned", seq: 1 });
      throw new Error("abort-transaction");
    }), /abort-transaction/);
    assert.equal(await db.accessRevision.findUnique({ where: { workspaceId: "rollback-ws" } }), null);
    assert.equal((await db.provisionSeq.findFirst())!.lastSeq, 5);
    assert.equal((await db.webhookDelivery.findUnique({ where: { id: "notify1" } }))!.seq, 0);
    await handleProvisioningEvent(event(6), db);
    assert.equal((await db.workspaceRef.findUnique({ where: { id: "w1" } }))!.wipedAt, null);
    // A delayed read page cannot undo a newer webhook.
    await db.$transaction(async tx => {
      await lockWorkspace(tx, "w1");
      await applyLifecycle(tx, { workspaceId: "w1", tenantId: "o1", state: "deprovisioned", seq: 4 });
    });
    assert.equal((await db.workspaceRef.findUnique({ where: { id: "w1" } }))!.status, "provisioned");
    await assert.rejects(handleProvisioningEvent({ ...event(7), tenant_id: "other" }, db), /tenant_conflict/);
    assert.equal((await db.provisionSeq.findFirst())!.lastSeq, 6);
  } finally {
    await db.$disconnect();
    await pg.query('DROP SCHEMA IF EXISTS catalog CASCADE; DROP SCHEMA IF EXISTS vx_provision CASCADE; DROP SCHEMA IF EXISTS local_usage CASCADE; DROP SCHEMA IF EXISTS local_authz CASCADE');
    await pg.query('DROP ROLE IF EXISTS arda_svc');
    await pg.end();
  }
});
