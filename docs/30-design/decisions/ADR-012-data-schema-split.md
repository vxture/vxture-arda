# ADR-012: Physical schema split (contract schemas + domain schema)

Status: Accepted (2026-07-21)
Refs: rectification requirements C2; platform data_platform_100 SS2.3.1 / SS2.3.2;
owner ruling 2026-07-20 (product_240 SS2.4).

## Context

Arda's domain DB was a single `public` schema holding everything: the
catalog/governance/services business tables, the provisioning contract tables
(WorkspaceRef, ProvisioningEvent) and the usage buffer (UsageRaw). The platform
data architecture (data_platform_100 SS2.3.1) mandates a physical split into a
small set of FIXED, platform-constrained CONTRACT schemas plus one or more
product-owned DOMAIN schemas:

- `vx_provision` (prefix `vx_` = platform/contract-facing): platform
  provisioning + inbound webhook ledger.
- `local_usage` (prefix `local_` = product-owned contract): usage-report buffer.
- `local_authz`: product-level member/role/permission tables. arda has no
  product-level RBAC yet (admin gating is the token governance role, binary
  admin - see roles.ts), so this schema stays EMPTY (created, no tables).
- domain schema(s): product-decided naming; the business tables.

## Decision

### 1. Schema map

| Schema | Physical table | Prisma model | Source |
| --- | --- | --- | --- |
| `vx_provision` | `app_instance` | WorkspaceRef | rename (WorkspaceRef) |
| `vx_provision` | `webhook_delivery` | WebhookDelivery | ProvisioningEvent (dedup half) |
| `vx_provision` | `provision_seq` | ProvisionSeq | ProvisioningEvent (seq watermark, new table) |
| `local_usage` | `raw` | UsageRaw | rename (UsageRaw) |
| `local_authz` | (none) | (none) | empty contract schema |
| `catalog` | (unchanged PascalCase names) | Dataset, Tag, DatasetTag, GlossaryTerm, DataSource, Policy, AccessRequest, QualityRule, QualityResult, Standard, LineageEdge, DataService, DatasetStandard, DataServiceDataset, ApiKey, AuditLog, SeedTemplate, TemplateVersion | move only |

Domain schema name = `catalog` (arda is a catalog-first data-governance product;
the governance/services/admin/seed tables are its satellites). It is a single
domain schema, distinct from the prefixed contract schemas.

### 2. Prisma model names are kept; physical names change via @@map

Per the C2 fidelity ruling (owner 2026-07-21): use Prisma `@@schema` + `@@map`
to place/rename tables PHYSICALLY while keeping the PascalCase Prisma MODEL
names, so app code (`prisma.dataset`, `prisma.workspaceRef`, `prisma.usageRaw`,
...) is unchanged. We do NOT convert the domain tables to the platform's
snake_case / `{table}_no` / uuid convention - that is a far larger rewrite
beyond C2's scope. Domain tables move schema only (no @@map, physical name
stays). Only the four contract tables get an @@map physical rename.

### 3. ProvisioningEvent splits into two tables

The single ProvisioningEvent served both roles the contract separates:

- `webhook_delivery` (Prisma `WebhookDelivery`): the per-delivery idempotency
  ledger, PK = delivery uuid (`id`). Keeps the full row (workspaceId, tenantId,
  eventType, seq, plan, processedAt) as the audit of every delivery.
- `provision_seq` (Prisma `ProvisionSeq`): the per-(workspaceId, productCode)
  processed-seq watermark, PK = (workspaceId, productCode). Replaces the old
  `MAX(seq)`-over-the-ledger derivation with an explicit watermark row.

Handler change (`provisioning/lib/handler.ts`): idempotency reads
`webhookDelivery.findUnique({id})`; staleness reads `provisionSeq` (not
`MAX(seq)`); on process the transaction inserts the `webhook_delivery` row AND
upserts `provision_seq.lastSeq = seq`. Only handler.ts changes (ProvisioningEvent
is referenced nowhere else).

### 4. Least-privilege role + column locks follow the schemas

`97_service_role.sql` grants USAGE + SELECT/INSERT/DELETE on each non-empty
schema (`vx_provision`, `local_usage`, `catalog`) and sets ALTER DEFAULT
PRIVILEGES per schema. `98_column_locks.sql` REVOKE/GRANTs are re-qualified to
`"schema"."Table"`, ProvisioningEvent's entry is replaced by webhook_delivery
(append-only, no UPDATE) + provision_seq (UPDATE lastSeq only).

### 5. Guardrail

`check-data-architecture.mjs` is reworked to (a) parse the prisma `@@schema` /
`@@map` attributes, (b) parse schema-qualified `CREATE TABLE "s"."t"` in the
baseline, and (c) compare by the mapped physical (schema, table) pair rather
than by the model name.

## Migration strategy (live DB, owner via db-init action=migrate)

`incr/0003_schema_split.sql` is idempotent:

1. `CREATE SCHEMA IF NOT EXISTS` for the four schemas.
2. `ALTER TABLE ... SET SCHEMA` to move each existing `public` table to its
   target schema; `ALTER TABLE ... RENAME TO` for the four renamed contract
   tables (guarded by `to_regclass` so re-runs are no-ops).
3. Split ProvisioningEvent: rename it to `webhook_delivery`; create
   `provision_seq`; backfill `provision_seq` from
   `SELECT workspaceId, 'arda', MAX(seq) ... GROUP BY workspaceId`.
4. Re-run `97`/`98` (db-init `roles`) so grants land on the new schemas.

Order: beta first (validate), then prod. Because tables leave `public`, the
seed scripts (`platform-seed.sql`, `seed.sql`) and any raw psql set an explicit
`search_path` (or schema-qualify) so unqualified names still resolve.

## Consequences

- App code is almost entirely unchanged (model names kept); only handler.ts and
  the prisma/DDL/guardrail/seed/role artifacts change.
- The `search_path` must include `catalog, vx_provision, local_usage, public`
  for unqualified SQL; Prisma emits qualified SQL from `@@schema`, so the app is
  unaffected - only hand-written SQL needs the search_path.
- `local_authz` is an empty contract schema today; product RBAC tables land here
  later without another split.
- Rollback is a reverse `SET SCHEMA`/rename; data is never dropped by the
  migration.
