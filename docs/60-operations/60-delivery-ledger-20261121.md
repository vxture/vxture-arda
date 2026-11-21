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
| Accounts correctness and refresh concurrency | PR218; squash ed610db (resolve full SHA with Git) | Merged; not deployed yet |

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
| Retire old arda.vxture.com edge route | platform PR716 | Awaiting platform CI/merge/deploy |

PR716 was prepared earlier, before the owner clarified the repo boundary. Its
checks were blocked by registry401 and dependency findings. No edge mutation was
applied. A later attempted platform worktree operation was cancelled; do not retry.

## Acceptance still required

- Provisioning strict wire validation, concurrent dedup/ordering, ACK retries,
  startup/periodic read reconciliation, and isolated PG regression.
- Deploy Accounts corrections to beta; test Arda-originated Accounts logout and
  central logout with another Arda tab. Do not infer every product passed.
- Attribute C2 legacy shared-credential observations and intermittent errors.
- Actual business C3 and AI task with a valid UI subscription. Earlier workspace
  was expired/bundled with tier=null; that is not positive paid-tier acceptance.
- Verify usage flush scheduling and provisioning reconciliation on live runtime.
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
