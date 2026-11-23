# Explicit product roles delivery - 2026-11-23

## Scope and policy

Owner authorization: finish Arda and Karda autonomously; pause only for identity
verification and required production review. Product repositories only. No
platform source, server variables, edge configuration or seat mutations.

| Role | Scope |
| --- | --- |
| owner | One anchored product owner per workspace; administration and explicit ownership transfer |
| administrator | Product settings/member roles and business operations; cannot edit owner or peer administrators |
| member | Scoped business reads/writes, export, AI and service publication; subscription/capacity and object scope still apply |
| readonly | Default explicit role for newly eligible members; read/query only, no write/export/AI/publication/management |
| guest | Entry and explicitly guest-visible resources only; ordinary business-read endpoints denied |
| none | No entry or business permission; platform governance claims do not repair removed local roles |

Platform product-access remains the current seat/coverage authority on every
user business admission. Product-roster supplies the full same-version authorized
member list, never a seat-grant API. Platform revocation overrides retained local
roles. No polling on browser focus, input or a permission timer was added.

## Batches

| Batch | Deliverable | Status |
| --- | --- | --- |
| R1 | Five-role policy and owner boundaries | Implemented; owner decision recorded |
| R2 | Persistent assignments, owner anchor, append-only audit, least-privilege DDL | Authored; production migration pending |
| R3 | Server entry/read/write/export/AI/publication/management checks and role UI | Implemented; CI and production acceptance pending |
| R4 | Current authorized roster, serialized role changes, durable invalidations, OBO user role checks | Implemented; reliable upstream idle revocation events remain platform731/726 |
| R5 | Real PostgreSQL concurrency/denial/transfer tests, required CI, separate DB/application release and live acceptance | In verification; not released |

## Storage and migration

Arda: DDL0005 adds seven local_authz tables; total30 tables/3 enums.
Karda: DDL0015 reuses five existing authz tables and adds two; total41 tables.
DDL is additive/idempotent; Prisma and column locks remain aligned. Catalog
role/permission mappings are runtime read-only. Audit is append-only. Runtime
cannot delete member identity records, which prevents erased initialization
history from silently granting default roles again. Runtime cannot update member
workspace/sub anchors. Existing inactive or roleless members stay denied.

Fresh eligible membership inserts a real readonly assignment once. A trusted
platform workspace-owner claim can bootstrap a newly inserted owner's first
product assignment, with an audit and unique owner anchor. Claims do not remain
an administrative bypass. Existing identities are not silently adopted.

For an existing unowned workspace, /role-setup provides a separate explicit
self-bootstrap confirmation. The backend requires the current trusted platform
workspace owner, active identity, current product eligibility and subscription,
and an empty owner anchor. It records ownership.bootstrap and invalidation in
the transaction. It cannot replace an owner or grant to another subject. After
an owner exists, ownership changes only through the owner's audited transfer.
No real customer account was promoted, removed or transferred for testing.

## Member administration

Arda: management board -> platform settings (/admin/platform).
Karda: workspace scope panel -> product members (/members).
Only currently authorized roster members are selectable. Uninitialized members
show their future readonly default separately from actual assigned roles.
Ordinary role editing never grants/removes owner. Owner grants/removes product
administrators; administrators cannot change peers. Empty roles explicitly
remove product use. Ownership transfer is separate, confirmed, atomic and turns
the previous owner into administrator. Changes increment the durable permission
revision and publish after commit; delivery failure leaves recoverable state.

The target's current roster authorization is re-read inside the serialized
transaction. Origin/Fetch Metadata/content type checks protect management writes.
Browser-selected org/workspace identifiers are not accepted as authority.

User-delegated S2S/OBO calls check live platform assignment and existing local
permissions, without creating a default role. Reads, writes and AI are distinct.
Received OBO tickets cannot be re-exchanged as RP tokens: platform main
resolveOboContext requires active_workspace, while OBO tickets carry workspace_id.
Products therefore use their existing workspace service-ticket roster reader to
check the verified OBO subject against current eligible assignments. No chained
user exchange, platform code or server variable change is required. Authority
outage still denies the call; real direct-OBO acceptance remains pending. Independent workspace service credentials
and API keys keep their existing machine grants and subscription gates; they do
not act as a member's product role.

Guest has no ordinary business-data access. This change does not invent public
or guest-visible versions of existing private resources. Enabling additional
guest resources requires an explicit visibility contract and its own tests.

## Verification and remaining release gates

Both local type checks and DDL/Prisma guards passed during development. Full
local suites passed with infrastructure cases skipped when PG/Redis are absent;
CI must run the real PG/Redis cases before merge. PostgreSQL role tests cover
concurrent initialization, audit-once, readonly denials, deliberate role removal,
owner/administrator boundaries, atomic transfer, workspace isolation, inactive
members, explicit bootstrap and committed-only outbox generations.

Required PR checks and main CI are release prerequisites. Production database
workflow must finish before the role-dependent application is deployed. Both
production workflows require the human reviewer; no approval bypass is allowed.

Current production remains Arda v0.13.1 and Karda v0.11.6 until separately
recorded successful releases. Cancelled Arda v0.13.2/v0.13.3/v0.13.4 and Karda
v0.11.7 must not be rerun. Arda DDL0004 is already applied independently.
Live acceptance still needs authenticated sessions and designated test members;
no arbitrary customer role/seat mutation is authorized by this implementation.
Immediate idle-browser seat revocation remains a platform event-contract gap,
not a reason to restore focus polling or the full-screen tab-switch splash.

## Permission-message UI handling

Arda reloads server-rendered business content only after the authoritative product
role/permission fingerprint actually changes. Karda remounts data/header state
after a successfully checked context/revision change. Same-version transport
heartbeats and browser tab switches do not request business authorization.
