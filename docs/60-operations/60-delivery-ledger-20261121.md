# Arda delivery ledger - 2026-11-21

This is the cumulative handoff for Arda integration and subsequent Karda work.
An implementation, a published configuration, and an accepted live workflow are
different states. Pending evidence below must not be reported as complete.

## Ownership and constraints

- Change Arda only. File detailed platform issues; do not edit platform sources,
  server variables, edge hosts, or create another platform checkout.
- L2/L3 registration and routing use platform management configuration.
- Arda runtime configuration uses its own normal deployment pipeline.
- Browser web only; responsive mobile browsers remain supported.
- Production release requires the owner's GitHub environment approval.
- Never invent subscriptions, usage, grants, or manual acceptance results.

## Delivered before this ledger

| Delivery | Evidence | State |
| --- | --- | --- |
| New production origin and RP integration | PR217; squash 20bd3d256cc828149a549f3415757291f9908712 | Production v0.13.0 |
| Beta validation of PR217 | beta-20261121.3; run 44889948419 | Succeeded |
| Production promotion | run 44890829712; owner approved | Succeeded |
| Stable home, login callback, post-logout and backchannel URLs | Opera save 2026-11-21 17:51:11 CST | arda.ruyin.work only; beta unchanged |
| Web-only terminal registration | Opera save 18:06:43 CST | Desktop/mobile-app/mini-app disabled |
| New-domain login | Real OIDC browser login, repeated after callback cleanup | Passed |
| Accounts-originated customer logout | Arda auth/session false; workforce session remained usable | Passed on old production; delivery path not independently proven |
| Commercial capability and hosted-storage corrections | PR219; squash 47a6b626d5b1f8871f4652ba58497f4eaf8e04cf | Merged |
| Commercial beta | beta-20261121.4; run 44900563041 | Succeeded; not production |
| Accounts correctness and refresh concurrency | PR218; squash ed610dbe5621e5baced87a5bf437d9347d954f3b | Deployed beta-20261121.5 |
| Provisioning, usage worker and Atlas contracts | PR220; squash b98544d5bf8fe9dc2b16eb7fef7559295428d8c6 | Deployed beta-20261121.5; run44905498756 succeeded |

PR218 adds client_id to logout, truthful activity reporting, integer status
deadlines, activity/focus-driven session checks, refresh-lock waiting and re-read,
and retry-safe backchannel deletion. Redis regression and all required CI passed.
The lock fix is not proof of the earlier intermittent C2 failure's root cause.

PR219 opens implemented individual features across tiers while retaining RBAC,
uses seat.max before member.max, and measures Arda-hosted JSON catalog bytes
instead of charging the footprint of external source databases. Isolated PG
storage tests passed. Binary objects will require their own committed-byte ledger.

## Commercial configuration actually published

Free is retired, with existing subscriptions preserved. Four v2 tiers are
published in invitation mode. This does not mean public self-service sales.

| Metric | Starter | Pro | Business | Enterprise |
| --- | ---: | ---: | ---: | --- |
| CNY/month | 99 | 299 | 999 | Contact sales/private deployment |
| Seats | 1 | 1 | 5 | Contract |
| Storage GiB | 1 | 5 | 20 | Contract |
| AI credits/month | 150 | 500 | 1500 | Contract |
| Datasets | 500 | 5000 | 20000 | Contract |
| Sources | 5 | 20 | 100 | Contract |
| Published services | 1 | 10 | 50 | Contract |
| Service calls/month | 20000 | 200000 | 2000000 | Contract |
| Quality executions/month | 1000 | 10000 | 100000 | Contract |
| Internal retention days | 90 | 365 | 365 | Contract |

Enterprise has no fabricated SaaS quota or price. All tiers offer human/ticket
support. Internal varda and sync switches were removed from paid plan quotas.
Customer labels/order and sales CTA remain platform issue717.

Annual prices could not be removed by blanking the editor. Published mitigation
is 1188/3588/11988 (12 times monthly), with no discount. Do not describe this as
monthly-only. Removal needs issue718. No expansion-pack SKU was published.
Pricing alpha remains the platform default 0.5, not a margin or quota setting.
The target direct contribution is approximately 70%, not measured net profit.

## Platform follow-up

| Item | Reference | Status |
| --- | --- | --- |
| Product renewal flow | vxture-platform/vxture-platform issue715 | Open |
| Pricing labels/order, internal controls, enterprise CTA, timestamps | issue717 | Open |
| Remove a billing cycle price explicitly | issue718 | Open |
| Honest launch summary, dependency applicability, Bearer and ACK evidence | issue719 | Open |
| Version-bound ACK, stale ready evidence and delivery ownership | issue720 | Open |
| Configuration-owned legacy domain retirement | issue721 | Open; links historical PR716 |
| Retire old arda.vxture.com edge route | platform PR716 | Awaiting platform CI/merge/deploy |

PR716 was prepared earlier, before the owner clarified the repo boundary. Its
checks were blocked by registry401 and dependency findings. No edge mutation was
applied. A later attempted platform worktree operation was cancelled; do not retry.

## Acceptance still required

- Live signed lifecycle delivery and ready ACK after production promotion;
  missed-delivery repair on an authorized test workspace. Local concurrency,
  payload, ACK retry and read transport regressions are implemented and passed.
- Repeat customer logout with an independently fresh workforce login baseline.
  Beta-originated logout and stable Arda session invalidation passed, but the
  workforce session was not revalidated immediately before logout this round.
  Do not infer its later logged-out state was caused by this logout or by expiry.
- Attribute C2 legacy shared-credential observations and intermittent errors.
- Actual business C3 and AI task with a valid UI subscription. Earlier workspace
  was expired/bundled with tier=null; that is not positive paid-tier acceptance.
- A real usage event and automatic C3 drain; the current local outbox is empty.
  Beta startup read reconciliation already passed with four rows, zero failures.
- Check every launch item against evidence. Runos grants may be inapplicable;
  current Arda source has no Runos dependency. Do not grant merely to turn green.
- Reconcile platform top-level completion wording with failed/manual items.
- Promote a verified beta to production through owner approval, then repeat checks.
- Confirm old domain retirement and public sales decision separately.

## Source evidence and Karda handoff

Local output contains the full Chinese final pricing proposal and timestamped
acceptance notes: arda-complete-plan-final-20261121.md,
arda-production-acceptance-20261121.md, arda-launch-audit-20261121.md,
arda-accounts-followup-20261121.md, plus screenshots and saved issue bodies.
Those earlier notes are point-in-time evidence, not current status overrides.

Karda should reuse the method, not Arda credentials, domains, quotas or claims:
inventory actual contracts; validate Accounts, workspace-bound S2S, C2, durable
C3, signed versioned lifecycle and versionless invalidations; read-reconcile;
verify model grants and terminal settings; publish reviewed packages; beta then
production; keep product fixes local and send platform gaps as detailed issues.
The design standard remains separate from product-specific branding.

## Follow-up implementation in PR220

Webhook validation now follows the producer's epoch timestamp and versionless
notification format; transaction locks cover dedup and lifecycle watermark.
Post-commit ready ACK retries and product-wide read reconciliation were added.
Beta reconciliation is read-only because the platform list is not environment
scoped. A startup/30-second worker drains the existing durable C3 outbox.
An isolated PostgreSQL18 concurrency regression passed locally and is required
in CI. Initial CI exposed missing Prisma generation in the test job; the job
now generates the client before running tests, using a disposable PG service.

Atlas adapter follow-up corrects the retired /model-platform/chat path to
/v1/chat, replaces unverified form-secret exchange with Basic plus signed
workspace/actor/audience/scope/lifetime validation, and adds bounded calls,
stable task attribution and structured quota/rate-limit errors. Endpoint route
configuration is preferred; no invented default model. Compose forwards the
adapter settings, but no model, grant, feature, or paid inference is fabricated.
Curator remains an unwired skeleton per ADR-013; its actual AI feature is not
delivered by configuring an adapter. AI live acceptance remains pending.

PR220 final CI passed: 80 tests, 78 passed, two isolated tests skipped; the real
PG concurrency test ran in CI. Build, audit, static checks, gitleaks and quality
gate passed. Beta-20261121.5 deployed b98544d; normal public health matches.
Production remains v0.13.0 /20bd3d2. No newer production tag was pushed.

## Live follow-up evidence

- Production read-only probe: provisioning:read exchange200, RS256/JWKS verified,
  actor arda, mode service, TTL300, no workspace or subject. List200: four rows,
  two provisioned and two deprovisioned, no next page. Beta probe also passed.
- Workspace-bound Bearer C2 for both provisioned records returned200 and matching
  scope. One was expired/tier=null, one status=null/tier=null; both bundled.
  Local raw usage was empty. Four old local test anchors failed exchange and
  are not evidence of valid subscriptions.
- Beta startup log: pages1, scanned4, failed0, readOnly=true. No production ACK
  or application is performed by this beta scanner.
- Beta and stable Arda were both signed in before beta /auth/logout. Beta
  returned to its signed-out view; stable /auth/session returned
  authenticated:false, signedOut:false. Screenshot saved in local output as
  arda-beta-global-logout-20261121.jpg. This does not distinguish backchannel
  from session-status fallback or prove other products passed.
- Opera reload after that test reached Accounts logout. Its workforce session
  freshness was not checked before the test. Isolation remains unverified for
  this round; owner asked to log into Opera and beta again for a clean baseline.
- Owner named the only workspace under ruyin studio as the business acceptance
  target and confirmed it has no subscription. Normal subscription or coupon
  authorization is required before real paid-tier business acceptance.
- Chinese cumulative handoff saved as output/arda-delivery-record-20261121.md;
  supporting probes and results are saved beside it, without token/secret output.
