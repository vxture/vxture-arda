# Arda browser access synchronization remediation

Date: 2026-11-23. Scope: Arda only. Architecture: ADR-014.
This tracker separates implementation, release and live acceptance.

## Batches

| Batch | Deliverable | Acceptance | Status |
| --- | --- | --- | --- |
| A1 | Decouple background verification from the blocking entry screen | An already admitted, unchanged scope keeps its page and drafts during verification; explicit denial and failures still block; first entry still verifies | Implemented; local type-check passes; CI/live acceptance pending |
| A2 | Durable workspace revision/outbox and atomic session revocation notifications | Commit/publish crash recovery, duplicate/out-of-order events and multi-replica invalidation; no dropped logout on Redis failure | Implemented; isolated PostgreSQL/Redis CI and DDL0004 application pending |
| A3 | Authenticated same-origin SSE and authoritative reconnect handshake | Session/workspace isolation, expiry, slow consumers, Redis disconnect/reset and missed-event recovery; no tokens in browser | Implemented; real edge and failure acceptance pending |
| A4 | Browser message coordinator and removal of focus/input permission triggers | 100 ordinary tab switches cause zero session/entitlement reads and zero gate flashes; change bursts coalesce; same-scope drafts persist | Implemented; coordinator tests pass; browser acceptance pending |
| A5 | Direct production deployment and end-to-end acceptance | Real edge streaming, logout to idle browser, reconnect/restart, subscription changes and authorization regression; record actual results | Pending |
| A6 | Production acceptance and delivery | Required human production approval; promote validated commit/image; repeat production checks and record limitations | Pending |

A1 was first prepared while retaining return/activity checks. The combined A1-A4
candidate now removes those triggers with the event/recovery path in the same
release. A1 alone is not being promoted as the completed architecture.
No browser periodic entitlement polling will be introduced. Business APIs keep
server-side authority checks throughout. Do not keep using old authority after
an explicit denial, an identity/scope change or a failed verification.

## Platform boundary

The tab-switch flash is an Arda defect, not blocked by platform changes. Platform
issue726 tracks missing/unclear upstream identity-context notification contracts
(roles, assignment, account status and active organization/workspace changes).
Existing logout/lifecycle inputs can be connected now. Do not invent upstream
events or claim immediate convergence for events the platform does not deliver.
No platform source, server variables, edge routes, credentials or product grants
may be modified by these batches. Configuration gaps go to detailed issues.

## Baseline

AccountGate handles focus/visibility/storage and throttled input. Every successful
session response increments revision. EntitlementGate then fetches /api/entitlement
and hides its children while checking. The endpoint reads C2 and user assignment;
this is authority synchronization, not business-data loading. ADR-014 is design
only on current main. Karda has an implemented SSE path; its Arda-to-Karda logout
and original-byte download acceptance do not prove Arda's own browser transport.

Existing untracked local design/output files are outside the change and retained.

## Implementation and validation log

- Candidate adds vx_provision.access_revision: one durable workspace generation
  plus publishedGeneration, also serving as a coalescing outbox. DDL0004,
  baseline, Prisma and column grants stay in lockstep. There are23 declared
  tables. No business rows are deleted; workspace anchors cannot be updated.
- Lifecycle/reconciliation advance generation in the state transaction;
  versionless notifications advance it only once per accepted delivery.
  Publication acknowledges only the exact generation sent. Failed delivery
  remains pending and a worker retries local outbox work, not platform polling.
- Lua atomically deletes RP credentials/index entries and publishes revocation.
  Token rotation requests a fresh stream handshake; browser invalidation fences
  old session responses. Scope/account-state changes discard the old page.
- SSE uses host cookie authentication, same-origin checks and server-derived
  session/workspace targets. It subscribes before reading session/version,
  bounds queues, heartbeats25s and reconnects at token expiry or10min. Heartbeats
  never query authority or renew activity. Per-process limits:8 streams/session,
  512 total; these are admission bounds, not measured deployment capacity.
- Redis versions fence replica-local C2 caches before/after reads. Missing Redis
  revisions restore from PostgreSQL. Reconnect compares a current snapshot;
  it does not replay old permission decisions. See ADR-014 implementation note.
- Browser coalesces changed versions and retains same-scope work while checking.
  Only transport failures show a recovery status. Session/authority failures and
  explicit denials still gate access; business APIs retain their own checks.
- First local run: type-check passes;87 tests,83 pass,4 skipped because isolated
  integration services are unavailable locally. Added CI Redis service enables
  the session/replica tests; existing PostgreSQL service covers transaction,
  duplicate, rollback, publication-failure and newer-generation races. Live tab
  switching, cross-product logout, server/Redis restart and edge flush are still
  pending, not established by the pure coordinator's100-message test.

## Rollout order

User explicitly selected direct production deployment and validation instead of
beta login/acceptance. Merge only after required checks pass. Apply DDL0004
through pinned production db-init and its human reviewer gate, verify schema,
then deploy the checked commit through the separate production release gate.
Do not deploy code requiring the new table before successful migration.

### A1-A4 CI and first beta migration attempt

PR234 merged as c56587d38d7c134db85b4ee523b43f6de6bf8fcc. PR CI45102164283
and main CI45102335739 pass. CI:87 tests,86 passed,0 failed,1 pre-existing
hosted-storage integration test skipped. The new real Redis and PostgreSQL
checks ran and passed; they are not part of that skip.

Beta db-init45102428117 failed before SQL execution: Missing reviewed integration
profile. The workflow staged deploy/lib and deploy/database but omitted the
release-owned deploy/config required by01-env.sh. This is an Arda workflow defect,
not a platform configuration/variable problem. The follow-up includes the reviewed
profiles in staging, tests both release and db-init layouts, and guards that
transfer contract. No beta application tag or production operation was started.

### Migration replay correction

PR235 (23d19e8) includes reviewed profiles in db-init staging; required PR/main
CI passed. Production migrate45103034254 was human-approved but failed in0002:
Dataset had already moved to catalog while the historical increment searched
public. The earlier0001 also created an empty public AccessRequest shadow.
DDL0004 was not reached; no application release occurred.

The correction resolves domain objects through catalog/public in atomic0001
and0002 increments. It removes an empty public AccessRequest shadow only when
catalog already owns the real table, and fails closed if the shadow contains
rows. Real PostgreSQL regression replays all increments repeatedly against
split and legacy domain layouts, including the failed-run shadow artifact.
No platform configuration or server variables are changed.
