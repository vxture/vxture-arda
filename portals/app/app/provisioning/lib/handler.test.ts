import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { handleProvisioningEvent, applyLifecycle, lockWorkspace } from "./handler";
import type { ProvisioningPayload } from "./payload";

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
    await pg.end();
  }
});
