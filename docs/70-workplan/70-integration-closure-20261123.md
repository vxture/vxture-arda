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
| Arda | v0.13.5 / e3b9802 | 45119134449, success | DDL0005, run45115384853,30tables/3enums |
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

| ID | Deliverable and exit condition | Current state | Owner/dependency |
| --- | --- | --- | --- |
| I0 | One scope/status baseline, reconstruction-replaced items, linked evidence and issue ownership | Scope/status/issue matrix delivered; gate/merge receipts on linked delivery PRs | Both product repos |
| I1 | Accounts login/refresh/logout, workforce isolation, full tab-visibility trace; ordinary switching makes no authority read or gate flash | Existing acceptance retained; anonymous contract checks pass; fresh authenticated/browser trace blocked by browser access | Both products;726 for context notifications |
| I2 | New authorized member gets persisted readonly once; roleless/guest deny; revoked platform eligibility overrides local role; owner protection/isolation | Implemented/deployed; owner roster accepted; test member display ID supplied,actual subject/workspace unresolved | Both products; platform roster/browser access |
| I3 | Actual local role event and upstream context/seat events; duplicates/out-of-order/reconnect/multi-replica recovery; bounded idle convergence | Deployed local revision/outbox/SSE; anonymous/origin denial passes; live delivery and upstream contract open | Products plus platform731/726 |
| I4 | Registration/client/callback/logout/webhook/logo/web-only configuration agrees; only canonical host serves app, no legacy redirect | Product release profiles correct; canonical ready passes; both legacy hosts still serve200 | Platform721/727; live registry read needs workforce session |
| I5 | Published plans/C2/usage/gauge/lifecycle/ACK and delegated calls agree with platform records, including deny/retry/dedup | Prior plan/C2/Arda single-call/ingest evidence retained; remaining positive/negative contract checks open | Products plus platform715/717/718/719/720/728 |
| I6 | Evidence matrix, config/contract register and remaining external handoff; each item accepted/blocked/reconstruction-replaced | Pending I1-I5 closure or explicit external-blocked handoff | Both repos |

I0 -> I1 -> I2 -> I3 is the main order. Independent I4/I5 reads may run earlier.
No percent-complete estimate mixes implementation, release and live acceptance.
A browser/member/platform dependency does not block independent work.

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

1. Finish I0 PR/main gates; this documentation/probe delivery needs no new app
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
