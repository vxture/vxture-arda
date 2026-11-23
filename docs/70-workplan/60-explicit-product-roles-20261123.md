# Explicit product roles delivery - 2026-11-23

Current continuation: [I0-I6 integration closure](70-integration-closure-20261123.md).
Production roles are deployed in Arda v0.13.5 and Karda v0.11.8. Historical
checkpoints below retain their time-specific evidence; the current batch table
and final production section supersede old pending-release descriptions.

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
| R2 | Persistent assignments, owner anchor, append-only audit, least-privilege DDL | Production DDL and application rollout complete |
| R3 | Server entry/read/write/export/AI/publication/management checks and role UI | Deployed; owner admission/roster pass; synthetic member acceptance I2 open |
| R4 | Current authorized roster, serialized role changes, durable invalidations, OBO user role checks | Implemented; reliable upstream idle revocation events remain platform731/726 |
| R5 | Real PostgreSQL concurrency/denial/transfer tests, required CI, separate DB/application release and live acceptance | CI/DB/application release pass; live matrix continues in I1-I5 |

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

Arda: management board -> product members (/admin/platform).
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

## Merged delivery and production review checkpoint

| Product | Merged PR and fixed implementation | Required main CI | Verified suite | Pending production DB |
| --- | --- | --- | --- | --- |
| Arda | [PR241](https://github.com/vxture/vxture-arda/pull/241),19b9865144e178b8a482fa173b840bfe3385663e | [45115216329](https://github.com/vxture/vxture-arda/actions/runs/45115216329), all pass | 96 cases,95 pass,0 fail,1 pre-existing hosted-storage skip; real PG/Redis pass | [45115384853](https://github.com/vxture/vxture-arda/actions/runs/45115384853),DDL0005,migrate,pinned19b9865 |
| Karda | [PR259](https://github.com/vxture/vxture-karda/pull/259),f37a421d1db754ebcf9451969aec6b896d5d9599 | [45115081992](https://github.com/vxture/vxture-karda/actions/runs/45115081992), all pass | 899 cases,899 pass,0 fail,0 skip; real PG/Redis pass | [45115340531](https://github.com/vxture/vxture-karda/actions/runs/45115340531),DDL0015,apply,pinnedf37a421 |

PR source checks also passed: Arda45114969686 and Karda45114886327. Main
secret scans passed: Arda45115216348 and Karda45115082068. Production builds
passed in both PR and main CI. These are pre-release evidence, not live access
acceptance. Owner was asked to review the two DB workflows together; no required
reviewer was impersonated. The first Karda dispatch attempt used an unsupported
raw-SHA workflow ref and returned422 without creating a run; the actual run uses
main with expected_sha=f37a421 and its recorded head SHA matches exactly.

Platform boundary update:
[platform731 comment7091962768](https://github.com/vxture-platform/vxture-platform/issues/731#issuecomment-7091962768).
No platform source/worktree/configuration/variable change; no real seat/member
role mutation. Existing Arda untracked design/runtime artifacts were preserved.

R1 complete. R2 schema implementation and replay tests complete, production
application pending. R3/R4 code, management UI and regressions complete; live
permission/roster/revocation acceptance remains pending. R5 PR/main CI complete,
DB human review and subsequent application release/live acceptance pending.

## Ordered continuation after human review

1. Verify both pinned DB jobs succeeded: Arda30tables/3enums, Karda41tables;
   validate runtime role grants and that the existing applications remain ready.
2. Build/release only the checked implementation (or its docs-only successor):
   next unused tags expected Arda v0.13.5 and Karda v0.11.8; verify remote tags
   first. Application production review is separate; never deploy before DDL.
3. Confirm readiness/version on arda.ruyin.work and karda.ruyin.work. Request
   customer login only if expired; use current subscribed workspace context.
4. Verify member management/role label and roleless rejection. Use an explicitly
   designated synthetic member for actual role changes, transfer and seat
   revocation; do not alter unrelated customer/admin roles for acceptance.
5. Verify ordinary tab switching preserves Arda work without full-screen
   permission checks. Verify a real local role event updates both product UIs;
   test reconnect version recovery and repeated events without polling.
6. Run direct OBO live roster/role checks via supported credentials, plus platform
   revocation-message acceptance when731/726 supplies reliable delivery evidence.
7. Record every run, release, readiness and acceptance result here and in the
   delivery handoff; do not label the whole integration complete while live
   checks or the Atlas147 business chain remain unverified.

## Production database completed; application candidate started

Owner confirmed both production DB approvals. Arda migrate45115384853 succeeded
at2026-11-23T05:37:48Z: pinned19b9865,30/30tables,3/3enums,all five increments
replayed and schema verification passed. Karda apply45115340531 succeeded
at2026-11-23T05:38:07Z: pinnedf37a421,41/41baseline tables present and service-role
password set from its existing deployment connection. Both are additive
role-storage deliveries; no business-data reset. Post-migration public readiness
confirmed the old Arda v0.13.1 and Karda v0.11.6 remain ready with db/redis ok;
Karda storageConfig is also ok.

The docs-only successors also passed their main gates: Arda45115742649 at
e3b98026c5e1b132292bda0a2fb74052222ee398; Karda45115744368 at
01e7065a24a139852840e33ce4592acfee9d72ae. These exact commits now have release
candidates Arda v0.13.5 and Karda v0.11.8. Remote tag names were checked unused.

- [Arda application45119134449](https://github.com/vxture/vxture-arda/actions/runs/45119134449)
- [Karda application45119134160](https://github.com/vxture/vxture-karda/actions/runs/45119134160)

Application builds and independent production reviewer approval are separate
from the completed DB approval. Until each application run succeeds and public
version/readiness is checked, do not describe the new role behavior as live.
No platform variable, product registry, route, seat or customer-role change.

## Production application delivery - 2026-11-23

Both owner-approved application deployments succeeded:
Arda v0.13.5 / e3b9802 / run45119134449 (completed05:47:28Z);
Karda v0.11.8 / 01e7065a / run45119134160 (completed05:46:09Z).
Public readiness on both canonical domains at05:48Z confirms production,
the pinned release versions and db/redis ok; Karda storageConfig is also ok.
DDL0005/DDL0015 had already succeeded before the application deployments.

Anonymous production checks: both /api/platform/members endpoints return401
unauthenticated with private/no-store headers; Arda /api/v1/datasets returns401
missing_api_key; Karda /api/pipeline/tasks returns401 unauthenticated.
An exploratory /api/tasks request returned404 and is not acceptance evidence;
the supported Karda task endpoint above was then verified.

Both production customer sessions were initially signed out. After owner login,
normal Accounts flows admitted both products. Arda /admin/platform and Karda
/members loaded the authorized roster with Stone Smoker as product owner.
Both disable the ordinary role editor for the anchored owner. Karda account
menu also labels the role as product owner. No member/owner/seat was changed
through the management UI. No manual ownership bootstrap was submitted.

Arda Ctrl+Tab then Ctrl+Shift+Tab inputs left its member page unchanged; no
full-screen permission gate was observed. This automation did not independently
capture the background/foreground transition, so a full browser-switch trace
remains pending. A full document navigation can still show initial admission
verification; it is distinct from a tab-visibility event.

Only the owner is present in the available roster. Fresh-member readonly,
roleless denial, role removal/regrant/transfer, seat revocation and notification
recovery need a designated synthetic member and action-time authorization for
real security changes. Live OBO credentials are not available in this browser
acceptance. These checks remain open rather than modifying the real owner.

R2 schema and application rollout are complete. R3/R4 implementation is live;
owner admission/roster acceptance passes. R5 release/readiness/anonymous
rejection checks pass; the full production acceptance is not complete.
Platform731/726 notification guarantees and Atlas147 indexing/AI chain remain
separate external gaps. No platform code/configuration/server variable changed.
