# Provisioning and C3 worker acceptance

## Implemented contract

The platform producer's ProvisioningPayload uses integer epoch occurred_at and
positive integer seq for tenant.provisioned/deprovisioned. GenericEventPayload
subscription_changed/grant.invalidated has no seq. Notifications use zero only
as a local legacy NOT NULL delivery-ledger sentinel, never a state watermark.
Header ID/type cannot override signed JSON. Unsupported events are rejected.

PostgreSQL transaction advisory locks serialize first delivery, dedup, lifecycle,
audit and sequence advancement per workspace. Reconciliation takes the same lock.
Older versions cannot restore an expired state. Repeated stop commands preserve
the retention start. Reprovision clears it. Cross-tenant anchor changes fail closed.
No DDL is changed. Beta plan lifecycle deliveries remain lazily initialized.
Grant invalidation records delivery only: Arda has no sharing-grant cache yet.

A ready ACK is sent only for the current live version after commit, using a
workspace-bound tool:vxture service ticket. An ACK failure returns webhook503;
redelivery dedups local mutations and retries the same ACK. The platform ACK
endpoint records evidence only, not lifecycle state; it lacks atomic version
preconditions. An event superseded during network flight requires platform-side
version-bound ACK semantics for a strict guarantee (platform issue720).

Product-wide reconciliation uses a separate provisioning:read service grant,
signed-claim validation, no workspace/user/delegation authority, bounded responses,
one401 refresh, full pagination from the beginning, and cursor-loop protection.
Pending rows and absence never delete local data. Failed rows are counted and
retried on the next full round. Startup plus five-minute rounds run in Node
instrumentation. In beta/non-production, scans validate/read only: this API is
product-wide and must not cause beta to mirror or ACK production facts.

C3 durable reports drain at startup and every30 seconds without an external cron.
Existing stable idempotency keys protect retried reports. The existing five-attempt
exhaustion rule retains rows for operator recovery and logs exhausted counts.
The guarded manual flush endpoint remains available; no new public endpoint.

## Required live evidence

1. Confirm startup logs include reconcile readOnly=true in beta, false in prod;
   record pages/scanned/failed, no token or secret contents.
2. Verify a real lifecycle delivery, duplicate, stop and newer re-enable on an
   authorized test workspace. Inspect state, watermark and platform ACK.
3. Confirm a missed delivery is repaired by a full scan; missing rows cause no wipe.
4. Verify a real versionless subscription change evicts C2 and does not touch seq.
5. Generate a real service/quality action with a valid subscription. Confirm raw
   usage, automatic drain and matching platform receipt; do not invent events.
6. Check existing exhausted rows separately; no blanket mark-as-flushed/reset.

## Local regression

Run node --import tsx --test app/**/*.test.ts from portals/app.
For concurrency, set ARDA_PROVISIONING_TEST_DATABASE_URL to a disposable loopback
database named arda_provisioning_test, then run handler.test.ts. It installs the
real baseline and removes its schemas after testing. Never point this at shared
or deployed databases. Tests cover reversed/duplicate events, stop-before-create,
re-enable, versionless notifications, delayed read versions and tenant conflicts.
ACK retry, signed-header binding, isolated read authority and paging also have
regressions. These tests do not substitute for live C3 or Accounts acceptance.

## Beta live gateway receipt

Business subscription was verified active on the owner's designated workspace.
On beta-20261121.7 /6295744, one owner-authorized empty-service call returned200.
The real gateway inserted one service.api.call row (amount1); the automatic
worker acknowledged it on its first attempt without a manual flush. C2 call
remaining changed2000000 ->1999999. The bound temporary key was revoked and
service paused through normal UI operations; read-only DB checks confirm both.
This meets the gateway accounting path in item5, not quality execution or data
egress acceptance. Live stop/re-enable and production reconcile/ACK still need
their own evidence; no lifecycle event or usage was fabricated for this test.
