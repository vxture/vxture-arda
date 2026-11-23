# Arda / Karda integration closure batches

Date: 2026-11-23. Current authority for this integration round in both repos.
Owner approved execution of I0-I6 after excluding legacy product functionality.
This document supersedes old current-status summaries, not historical evidence.

## Scope and boundaries

Keep: Accounts identity/session/logout; current platform eligibility and roster;
explicit product roles; reliable invalidation; configuration-owned registration,
canonical domains and web-only clients; subscriptions/C2/C3/gauge/lifecycle/ACK;
supported user-delegated OBO; reproducible acceptance and reconstruction handoff.

Reconstruction-replaced (not accepted, not a current blocker): Arda Curator and
source-query/masking/quality features; Karda ingestion/index/retrieval/grounded
answers; old feature optimization, capacity workload/performance and AI cost
tuning. Atlas147 remains an upstream issue, but the old knowledge fixture is no
longer a release/closure prerequisite. Generic AI token attribution/credit
contract remains in I5. No new business capability will be built for acceptance.

Modify product repositories only. No platform source/worktree/server variable,
manual edge/routing, credential, real-owner/seat or subscription-version change.
Platform corrections go through existing detailed issues. A real member security
change needs a designated test member and concrete action authorization.
No grant escalation, silent role restoration or default-role bypass is allowed.

## Current deployment and commercial baseline

| Product | Production release | Approved application run | Database |
| --- | --- | --- | --- |
| Arda | v0.13.6 / df69583 | 45130411354, success | DDL0005, run45115384853,30tables/3enums |
| Karda | v0.11.8 / 01e7065a | 45119134160, success | DDL0015, run45115340531,41tables |

Canonical origins: https://arda.ruyin.work and https://karda.ruyin.work.
Both production readiness responses passed at 2026-11-23 14:38 CST.
Four public tiers: Starter/Pro/Business/Enterprise; Free retired.
Monthly199/499/1499; annual1990/4990/14990; Enterprise private/contact sales.
Historic subscriptions retain their original plan versions. Expansion SKU and
joint-discount/coupon publication were not performed. Consumable share alpha
uses the platform default0.5; it is not an AI charge multiplier.
Historical financial assumptions are not a promise for the reconstructed apps.

## Ordered batches

| ID | Status | Completed evidence | Remaining exit condition / dependency |
| --- | --- | --- | --- |
| I0 | COMPLETE | Scope/status/issue matrix merged;Arda245/740b368 and Karda263/4e59ac1;both main CI and secret scans pass | None for scope-baseline delivery |
| I1 | IN PROGRESS - PARTIAL | Production login/owner entry,prior logout/isolation,anonymous session/cache and local session/coordinator regressions pass | Current authenticated baseline,both logout directions and full tab/network trace;browser access required |
| I2 | IN PROGRESS - PARTIAL | Explicit persisted roles deployed;owner roster/protection pass;test member display ID supplied | Resolve actual subject/workspace;readonly/none/guest/revoke/regrant live tests;no real-owner transfer |
| I3 | IN PROGRESS - EXTERNAL BLOCK | Revision/outbox/SSE deployed;anonymous/cross-origin rejection and protocol regressions pass | Live role-event/reconnect/multi-replica trace and platform731/726 delivery contract |
| I4 | EXTERNAL BLOCK | Product release profiles and canonical readiness pass;latest legacy-host failure recorded | Managed old-host retirement/no redirect via721/727;live registry read |
| I5 | IN PROGRESS - PARTIAL | Four public tiers/annual10months/Free retirement,C2 admission,Arda single-call and Karda ingest evidence retained | Minimal metering acceptance; separate subscription lifecycle/ACK and delegated-access checks |
| I6 | NOT COMPLETE | Scope/evidence/issue register exists | Final acceptance or explicit external-blocked handoff after I1-I5 |

I0 -> I1 -> I2 -> I3 is the main order. Independent I4/I5 reads may run earlier.
No percent-complete estimate mixes implementation, release and live acceptance.
A browser/member/platform dependency does not block independent work.

## Explicit completion checklist

- [x] I0.1 Owner scope excludes legacy product functionality for reconstruction.
- [x] I0.2 Both current production releases and public-plan baseline recorded.
- [x] I0.3 Current tracker,index/memory and historical ledgers cross-linked.
- [x] I0.4 Both delivery PRs merged and required main checks passed.
- [x] I1.1 Anonymous session response and no-store boundary accepted.
- [x] I1.2 Prior production login/owner admission evidence retained.
- [x] I1.3 Prior Karda logout/workforce isolation and Arda-to-idle-Karda logout accepted.
- [ ] I1.4 Fresh authenticated baseline on current releases.
- [ ] I1.5 Full actual tab-visibility and authority-request trace,including repeated switches.
- [ ] I1.6 Current-release reverse logout and signed-backchannel delivery evidence.
- [x] I1.7 Arda strict logout-event validation and explicit retryable503 deployed;
  Karda equivalent behavior retained. Implementation/test progress below is
  separate from production acceptance.
- [x] I2.1 Explicit role storage/enforcement deployed;owner roster/protection accepted.
- [x] I2.2 Owner designated a non-owner test-member display identifier.
- [ ] I2.3 Resolve its actual authorized subject/workspace and perform isolated role tests.
- [x] I3.1 Local durable invalidations and transport/origin boundaries delivered.
- [ ] I3.2 Real role-event,reconnect and upstream grant/revoke convergence acceptance.
- [x] I4.1 Canonical public endpoints and repo-owned production URL profiles verified.
- [ ] I4.2 Legacy hosts retired via managed configuration;registry/callback set re-read.
- [x] I5.1 Approved four public tiers,annual10months,Enterprise contact sales and Free retirement.
- [x] I5.2 Existing production C2 and isolated usage evidence recorded.
- [ ] I5.3 Subscription/entitlement lifecycle, ACK and delegated-access acceptance (separate from metering).
- [x] I5.4 Cross-product source audit of gauge durability and recovery completed.
- [ ] I5.5 Implement and accept the minimal metering contract below.
- [x] I5.6 Record retained meters, capacity limits and legacy compatibility.
- [ ] I6.1 Final reconstruction handoff with accepted/blocked/replaced dispositions.

## Acceptance matrix

| Check | Latest evidence | Status / next action |
| --- | --- | --- |
| Production release and dependency readiness | Both canonical /api/ready,14:38 CST; versions above,db/redis ok,Karda storageConfig ok | Pass |
| Anonymous session cache safety | /auth/session200 authenticated:false,Cache-Control no-store | Public probe |
| Member API anonymous denial | /api/platform/members401 unauthenticated,private/no-store | Public probe |
| SSE anonymous and cross-origin denial | /api/events401 without cookie;403 for cross-site origin | Public probe; authenticated stream still open |
| Role-management origin protection | Empty anonymous POST without Origin returns403 | Public probe; not real role mutation acceptance |
| Invalid backchannel request | Empty logout-token form returns400 | Public probe; not signed delivery acceptance |
| Current owner roster | Arda /admin/platform and Karda /members show Stone Smoker as owner; ordinary owner editor disabled | Prior authenticated pass; no manual bootstrap/role mutation |
| Cross-product logout | Arda logout made idle Karda return to gate; protected API unauthenticated | Prior direction passes; reverse/current-release repetition open |
| Customer/workforce isolation | Karda customer logout left established Opera workforce session authenticated | Prior pass; establish fresh baseline for any repeat |
| Browser visibility | Earlier Ctrl+Tab inputs preserved Arda page, no independent transition/network trace | Open; do not label zero-read100-switch test passed |
| New readonly/none/guest/revoke/regrant/owner transfer | Real PG/Redis suites pass; only current owner available in live roster | Dedicated synthetic member required |
| User-delegated OBO | Incoming verified subject checked against current roster using workspace service ticket, then existing local role | Implementation pass; supported live caller required; no RP re-exchange of OBO ticket |
| Platform seat/context invalidation | Per-request live authority checks implemented | Idle convergence pending731/726 reliable delivery |
| Canonical-only domain | Both legacy /api/ready still200 with current prod release, no Location,14:38 CST | Fail/open721/727; managed removal only |
| Plan publication | Prior public readback: four tiers,annual10months,Enterprise contact sales,Free retired | Retained pass; fresh catalog/registry reconciliation open |
| Subscription authority and counters | Prior subscribed workspace admission/C2,Arda one production service call + revoke/downline,Karda ingest observation | Partial; pool boundaries/gauge/receipt/dedup/annual resets remain open |
| Lifecycle stop/re-enable/ACK | Local code/tests; platform720 version-bound ACK remains open | Live controlled lifecycle acceptance pending; never change real tenant subscription to simulate |
| Old product AI/index/retrieval/quality features | Previous implementation/acceptance history only | Reconstruction-replaced; generic metering contract still in I5 |

Run public probe manually in either repo:
node scripts/checks/11-check-public-integration.mjs
It sends no credentials/cookies and uses no valid mutation payload. It never
opens role grants, transfers ownership, publishes a service or creates a key.
Results prove anonymous behavior only, not authenticated permissions or delivery.

## Issue ownership and dispositions

| Issue | Remaining ask | Scope |
| --- | --- | --- |
| platform731 | Reliable seat grant/revoke/member-disable events,version/auth/retry/dedup/recovery and idle convergence | I2/I3,active |
| platform726 | Identity/logout/context discovery and recovery contract; retain observed Arda-to-Karda evidence | I1/I3,active |
| platform721 | Retire arda.vxture.com using managed config; no redirect | I4,active |
| platform727 | Canonical Karda login recovered; retire karda.vxture.com and return effective config revision | I4,remaining scope only |
| platform715 | Supported subscription renewal flow | I5,active |
| platform717 | Customer metric labels/order and Enterprise sales CTA | I5,active |
| platform718 | Explicit billing-cycle removal; no silent old annual price restoration | I5,active contract; not requesting current annual removal |
| platform719 | Honest launch status and applicable Bearer/ACK evidence attribution | I5,active |
| platform720 | Version-bound provisioning ACK and delivery ownership | I5,active |
| platform728 | Managed max-cap grants/business hard-pool semantics,C2 attribution and C3 receipts | I5,active |
| platform547 | Four-dimensional raw token attribution to caller,platform converts to credits | Closed upstream; live generic credit/receipt acceptance still required |
| Atlas147 | Upstream embedding/rerank account restoration | External history; old business chain reconstruction-replaced |

Do not close an upstream issue merely because the old feature is replaced.
Likewise an open historical issue is not proof that its original defect persists:
ready/path/token-doc fixes need evidence-based issue triage.

## Execution log

Delivery PRs:
[Arda245](https://github.com/vxture/vxture-arda/pull/245),
[Karda263](https://github.com/vxture/vxture-karda/pull/263).
Required checks gate squash merges; neither PR publishes an application.

I0 completion receipts:
Arda245 merged740b368b876ca1603856bbefeba081b112ef97fc;
main45126707329 and secret-scan45126707180 succeeded.
Karda263 merged4e59ac15af43803cb793aa399856069a97798397;
main45126741617 and secret-scan45126741605 succeeded.
This is an explicit completed baseline,not a pending-merge checkpoint.

- 2026-11-23 14:38 CST: canonical readiness passes; both legacy domains still
  serve the current app at /api/ready with200 and no redirect.
- Browser inventory attempt reports local browser access unavailable for this
  chat. This is not an authentication failure. No alternate browser/profile or
  extracted cookie was used. Continue docs/public probes/source checks; request
  actual login only after browser access is available.
- Owner supplied a test-member display identifier for I2. Resolve it against the
  actual authorized roster; do not treat a display code as an OBO subject or
  infer its workspace. Identifier retained in local handoff only. No membership
  change was performed. Current owner and other customer roles stay untouched.
- 2026-11-23 14:39 CST: manual public probe passed7/7 checks in each product:
  readiness,anonymous session/cache,anonymous members/cache,anonymous SSE,
  cross-origin SSE,missing-origin role-write and missing-token backchannel.
  No authenticated cookie or valid write payload was supplied.
- Focused existing integration regressions: Arda24/24 pass,zero skips; Karda
  27pass/0fail/1isolated-PostgreSQL storage-gauge skip (local PG not configured).
  Includes refresh/revocation semantics,roster consistency,admission/OBO,protocol,
  Arda coordinator and ACK receipts. These are contract regression evidence,
  not real production member changes,live platform delivery or signed OBO calls.
- Platform issue updates sent:
  [721/comment7093632939](https://github.com/vxture-platform/vxture-platform/issues/721#issuecomment-7093632939),
  [727/comment7093633646](https://github.com/vxture-platform/vxture-platform/issues/727#issuecomment-7093633646),
  [731/comment7093634374](https://github.com/vxture-platform/vxture-platform/issues/731#issuecomment-7093634374).
  Domain asks require managed retirement/no redirect/effective revision; message
  ask requires version/auth/retry/recovery and observed delivery evidence.

## Next executable work and exact prerequisites

I1 continuation checkpoint: Arda receiver previously accepted an array-valued
backchannel event and whitespace sid/jti,allowed inverted token lifetime,and
let deletion failure escape as a generic500. The candidate now rejects those
claims before deletion and maps deletion failure to503 with no-store,allowing
the same signed delivery to retry. RS256/issuer/audience/expiry verification
still runs before claims parsing. No delivery is marked consumed before delete.
The handler tests cover invalid forms/signatures,malformed verified payloads,
store failure,successful retry and duplicate idempotent completion.
These are adapter/regression results,not captured real Accounts deliveries.
Karda already has equivalent strict claims and503 handling; no Karda runtime
change is required. Application release is still required for Arda I1.7.
Local focused results: Arda6pass/0fail/1existing isolated-Redis skip;all three new
receiver tests pass. Karda5pass/0fail/0skip for logout/response contracts. Full
hosted gates remain required before merging/releasing the Arda runtime change.
Browser API still reports unavailable in this continuation; no native-browser
retry or security-barrier bypass was attempted. I1.4-I1.6 remain unchecked.

1. I0 is COMPLETE. Continue I1; progress-marker/document updates need no new app
   deployment,DDL or production approval.
2. When browser access returns,establish product+workforce sessions,resolve the
   designated test member in the current workspace roster,and record the actual
   authorized subject. Never derive the subject from its display identifier.
3. Establish an authenticated SSE/identity baseline,then perform the I1
   background/foreground trace and both logout directions. Re-login only when
   required; distinguish interface transport from authority reads.
4. Prepare concrete reversible I2 test changes only for the designated member;
   confirm any security-expanding UI action at execution time. Never transfer
   the real owner's anchor solely to finish an acceptance checkbox.
5. Consume platform731/726 contract/delivery evidence and721/727 managed-routing
   results; retry only the affected acceptance,not old product feature tests.
6. Read current catalog/subscription/C2/C3/gauge/provisioning evidence through
   supported Admin/Opera paths. Verify pool/reset/receipt semantics using an
   isolated authorized fixture; no artificial tenant grants or valid billable
   operation is submitted in this anonymous probe round.

Source audit limitation: Arda storage gauge currently reports best-effort on a
watermark change; a failed report relies on a later change rather than a durable
report outbox. Karda has a persistent gauge snapshot/retry implementation.
I5 must decide the generic reconstruction-safe gauge/report recovery contract
before calling cross-product gauge recovery complete; no old storage feature is
being rebuilt to manufacture that evidence.

## I1 production receipt - 2026-11-23 15:34 CST

Arda PR246 merged df695838cb0cc2034b00310e199274607174248f.
Main CI45130158489 and secret scan45130158505 passed. Owner approved production
run45130411354; v0.13.6 deployed successfully. Canonical readiness returns
v0.13.6/df69583,production,db/redis ok. All7 anonymous probes passed,including
missing-token backchannel400 with no-store. Retryable503 and malformed verified
claims are covered by the merged handler regressions,not live signed delivery.
Karda PR264 merged929f6d20c1553e5d5c96dc8c0c3448afd16a741f;main CI45130112257
and secret scan45130112250 passed. No Karda application deployment was needed;
v0.11.8/01e7065a readiness and all7 anonymous probes passed at the same checkpoint.
I1.7 implementation/deployment is complete. Earlier candidate-only paragraphs
are historical checkpoints. I1.4-I1.6 and overall I1 remain PARTIAL: authenticated
baseline,tab/network trace and reverse/signed-delivery acceptance are not done.
Browser access remains unavailable;no customer permissions were changed.
Next: I2 resolve the designated member's actual subject/workspace through the
supported roster,then isolated role acceptance;I3 awaits reliable platform events.
No platform code,server variable,DDL or customer subscription change occurred.
## I5.4 gauge recovery audit (historical findings)

Source audit completed;not live platform receipt or fault-injection acceptance.
Browser control was rechecked after I1.7 and still reports local browser access
unavailable. I1.4-I1.6 and I2.3 remain open;no repeated login is requested.

| Concern | Arda source | Karda source | Disposition |
| --- | --- | --- | --- |
| Failed gauge snapshot | usage/lib/gauge.ts logs only;no durable pending record | kb/storage/gauge.ts stores pending/value/observedAt | Arda product-owned gap |
| Zero after hard delete | lifecycle/sweep.ts marks hard_deleted before best-effort report;later sweeps exclude it | confirmed deletion queues durable lower snapshot | Arda zero must survive failed delivery and restart |
| Independent recovery | jobs/refresh.ts retries only workspaces with sources/rules,skips wiped workspaces,caps50 without cursor | storage/worker.ts seeds missing and retries pending snapshots | Source refresh is not a generic reliable recovery mechanism |
| Acknowledgement | HTTP ok only;body not checked | exact workspace/product/metric/value/observation receipt validation | Product adapter must bind acknowledgement to sent snapshot |
| Ordering | application timestamp before query;no durable monotonic revision | DB clock plus previous observation+1ms under workspace lock | Require monotonic observations across replicas and restart |
| Retry exhaustion | no durable retry state | background selects attempts<10;pending survives but automatic selection stops | Specify observable exhaustion and supported replay;not unlimited success claim |

## I5.5 minimum metering contract (current)

| Metric | Applies to | Required behavior |
| --- | --- | --- |
| storage.bytes | Arda and Karda | Each product reports its current hosted bytes; platform owns the shared balance. Keep one pending latest observation per workspace/product, retry the same observation after transient failure, and clear only on matching acknowledgement. A confirmed deletion can report zero. External source capacity is excluded. |
| ai.credit | Arda and Karda | Charge for actual inference only. Platform converts provider usage into credits; products read the platform balance and do not submit a second credit charge. |
| service.api.call | Arda | Count one eligible external service invocation under the existing contract. Use its stable invocation key on retry. Internal UI and health requests are not billable service calls. |

Seats, datasets, data connections, published services and knowledge bases are
capacity limits, not consumption events. Read entitlement limits and count
current resources at admission. New Karda plans retain no content-count cap;
respect a cap when explicitly present on an existing version.

Quality-check runs and Karda ingest/search/ask counts are excluded from the
reconstruction metering target. Keep operational statistics local if needed.
Arda's published versions include quality-check allowances. Existing plan
versions, usage records, limits and report paths retain their current behavior
until the managed replacement is approved and verified. Do not disable Karda
legacy ingest reporting in the current runtime as a side effect of this scope
change. Reconcile plan/catalog dependencies before retiring legacy emission.

Acceptance is limited to: hosted-byte decrease/zero and restart retry without
another user action; AI attribution with no second charge; external-call
retry without a second count; and the platform's monthly reset for monthly
allowances on annual plans. Use the existing delivery path and platform
configuration. No new generic queue, operator console, metering dashboard or
exhausted-state workflow is required in this batch. Retain existing bounded
recovery and verify that the latest unsent storage value is not discarded.
Subscription lifecycle/ACK and delegated authorization stay in I5.3 because
they are integration obligations, not additional consumption metrics.

I5.6 scope recorded. I5.5 implementation and live acceptance remain open.
Published plans, runtime emission and platform configuration did not change.
