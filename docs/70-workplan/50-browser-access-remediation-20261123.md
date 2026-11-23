# Arda browser access synchronization remediation

Date: 2026-11-23. Scope: Arda only. Architecture: ADR-014.
This tracker separates implementation, release and live acceptance.

## Batches

| Batch | Deliverable | Acceptance | Status |
| --- | --- | --- | --- |
| A1 | Decouple background verification from the blocking entry screen | An already admitted, unchanged scope keeps its page and drafts during verification; explicit denial and failures still block; first entry still verifies | Merged; PR/main CI pass; production acceptance pending |
| A2 | Durable workspace revision/outbox and atomic session revocation notifications | Commit/publish crash recovery, duplicate/out-of-order events and multi-replica invalidation; no dropped logout on Redis failure | Merged; real PostgreSQL/Redis CI pass; production DDL0004 verified |
| A3 | Authenticated same-origin SSE and authoritative reconnect handshake | Session/workspace isolation, expiry, slow consumers, Redis disconnect/reset and missed-event recovery; no tokens in browser | Merged; CI pass; real edge and failure acceptance pending |
| A4 | Browser message coordinator and removal of focus/input permission triggers | 100 ordinary tab switches cause zero session/entitlement reads and zero gate flashes; change bursts coalesce; same-scope drafts persist | Merged; coordinator CI passes; browser acceptance pending |
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

Successful migrate now runs the read-only schema/role verification in the same
approved job, so release readiness does not depend on a separate manual action.

### Baseline member entry follow-up

Owner requires new members to have baseline product use without a manual role
assignment. Arda had an extra frontend USAGE_ROLES list after platform assignment
and commercial admission; a roleless authorized member therefore saw unassigned.
Remove this extra governance-role requirement. Require affirmative productAssigned
instead; missing/false assignment cannot admit anyone. Platform token roles remain
unchanged and explicit owner/manager checks still protect management operations.
Regression covers roleless entry, no admin elevation and unknown/denied assignment.
Karda already admits on platform access plus subscription; its shell defaults to
member and separate claim checks protect management. Platform-owned seats remain
mandatory and cannot be synthesized locally.

Production db-init45104288046 succeeded on a764c21:23 tables,3 enums,service role
present. v0.13.2 application run45105672438 was cancelled before release to include
this newly requested entry correction in the next production candidate.


### Platform-authorized roster and revocation boundary - 2026-11-23

Owner clarified: platform subscription management alone grants/revokes product
seats. Do not add an automatic seat grant policy. Baseline member use applies
only after affirmative live platform authorization and valid coverage.
Platform issue731 was corrected to this scope; it now requests reliable seat
change/revocation notification semantics, linked to726, not automatic access.

Consume the existing GET /platform/product-roster with a ticket-bound complete
snapshot: validate product/org/workspace, assigned_seats mode, eligible subjects,
page version and unique members. Restart a changing snapshot once; never return
partial/stale authorization on failure. No periodic roster refresh or persisted
authorization copy. A no-store manager-only GET /api/platform/members reads the
current authorized roster without accepting browser-provided scope selectors.
No member-management UI or local role administration is introduced by this API.
Every protected business request still checks the subject's live product-access;
roster snapshots and previous local roles never override explicit revocation.
A cancelled seat denies subsequent requests even if the account remains logged
in. Immediate idle-page withdrawal still depends on reliable upstream events;
do not claim the currently missing seat event contract has been accepted.
Five roster regression cases cover pagination, revision race recovery, removed
members, OBO reader denial, invalid scope/eligibility, cursor loops and authority
outage. Production authorization mutation was not performed on real members.


### Release checkpoint

- PR236 merged a764c21; main CI45104178256 passed. Production migration
  45104288046 succeeded after owner approval:23 tables,3 enums,service role.
- Default-member correction PR237 merged f613834; main CI45106292956 passed.
- Authorized-roster PR238 merged6a136f9eb0bba70be4095922f6380516274fe296;
  PR CI45106931547 and main CI45107050445 passed:93 tests,92 pass,0 fail,
  one pre-existing hosted-storage integration skip. Real Redis/PG checks passed.
- v0.13.2 and v0.13.3 application runs were cancelled before deployment to
  combine the new member/roster requirements. Do not approve these old runs.
- Final application candidate v0.13.4 pins6a136f9; deploy45107304781.
  Image/reviewer/live acceptance outcomes are not yet established here.
- Karda mirrors the authorized-roster contract in PR256/25ac496;892 tests
  pass with zero failures/skips. Its separate v0.11.7 release is tracked there.
- Platform issue731 excludes automatic seat grants and tracks reliable access
  revocation notifications. This is distinct from single-request access denial.


## Owner correction: explicit roles required - 2026-11-23

The earlier implicit member baseline is rejected: no role means no permission.
Cancelled the pending production application candidate before deployment.
New authorized members need a real readonly assignment, not a fallback when roles
are empty. Administrator/member/readonly/guest define the initial product role
catalog. Existing roleless members must remain denied, including after repeated
login. No role or seat should be silently restored. Product role storage and
full operation enforcement are NOT delivered by the previously merged roster
reader. R1-R5 are tracked in ADR-015-explicit-product-roles.md; R2-R5 remain pending.

## Explicit roles implementation checkpoint - 2026-11-23

Owner/administrator/member/readonly/guest implementation is under verification.
New authorized members receive a persisted readonly assignment once; existing
roleless/inactive members stay denied. Owner transfer/bootstrap is explicit and
audited. Platform authorization revocation overrides all retained local roles.
See [R1-R5 delivery tracker](../70-workplan/60-explicit-product-roles-20261123.md).
Production migration and application deployment remain pending. Do not rerun the
cancelled implicit-member candidates or modify platform sources/variables.

### Explicit roles merged; production DB review pending

Arda PR241 merged19b9865; main45115216329 passes (96 cases,95 pass,one existing
storage skip). Karda PR259 mergedf37a421; main45115081992 passes (899/899,no skips).
Production DB review: Arda45115384853/DDL0005 and Karda45115340531/DDL0015.
No new application release yet. Full evidence and ordered continuation:
[roles delivery](60-explicit-product-roles-20261123.md).
