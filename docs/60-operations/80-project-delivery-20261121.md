# Arda project delivery: design through production

Snapshot: 2026-11-21. This consolidated record supersedes early status statements
in the cumulative [ledger](60-delivery-ledger-20261121.md), without rewriting
historical evidence. Implemented, configured, deployed and accepted are separate.

## Handoff update - 2026-11-22

[PR226](https://github.com/vxture/vxture-arda/pull/226), f04fcb5, archived this
consolidated delivery and Karda plan. [PR227](https://github.com/vxture/vxture-arda/pull/227),
3101c3c, added [ADR-014](../30-design/decisions/ADR-014-event-driven-browser-access.md)
for event-driven browser access synchronization.

The tab-switch access-screen problem is diagnosed: successful unchanged session
checks advance revision and cause blocking entitlement reads. The architecture
uses committed events, shared revisions, recoverable SSE and targeted reads;
ordinary healthy tab switches must perform no session/C2 reads or full-screen
transition. It includes expiry, replay, multi-instance cache invalidation and
server-side authority. Upstream event coverage and edge streaming remain checks.

This is an architecture delivery only. No SSE runtime, schema migration, gate fix
or new release was delivered. Production remains v0.13.1/6295744; the existing tab
behavior is unchanged. Arda implementation remains an explicit follow-up and is
not a prerequisite claimed complete before starting Karda discovery.

Karda kickoff is now prepared: read-only HEAD2503652 (v0.10.3 record), tracked tree
clean on 2026-11-22; local standards and workplan inspected. Historical bootstrap
and integration statements conflict with later release records, so discovery must
verify code, current registration and live identity rather than copy old statuses.
No Karda code, configuration, subscription or release has been changed. See the
[updated kickoff sequence](../70-workplan/40-karda-rectification-handoff.md).

## Final status

- Production v0.13.1 / 6295744 is deployed at https://arda.ruyin.work.
- CoSpace v1.3.1 and independent Arda entry design v1.0.0 are frozen.
- Four v2 plans are published in invitation mode. Free is retired; two legacy
  subscriptions are preserved. Public self-service sales are not enabled.
- Production login, Business admission, readiness, provisioning reads/reconcile,
  one actual service call and automatic accounting, cleanup and customer logout
  have evidence. This is not acceptance of every business feature or interface.

## Design baseline and artifacts

The generic standard remains separate from product branding. Its final directory
is the CoSpace v1.3.1 package dated 2026-11-21 under D:/MyWebSite (39 validated
files). Product artifacts are local output/arda-entry-design-v1.0.0 (29 validated
files), its ZIP and SHA256, release.lock.json, ten-state preview and standalone
login HTML. Do not overwrite either frozen package.

Accepted constraints:

1. WELCOME TO {PRODUCT} is persistent; state titles carry no product branding.
2. A divider and bottom explanation persist, with a generic secure-login fallback.
3. Middle content aligns toward the bottom. Background artwork does not consume
   content space; it is centered in the login blank area and stays at the same
   vertical location across states.
4. Minimum height is 480px desktop / 440px mobile, not a fixed height or ceiling.
   Content may grow. Narrow screens support mobile browsers.
5. Preserve the existing header, footer, background, Ruyin identity, copyright,
   legal links and remaining visual baseline.

Titles, dropdowns and manuals distinguish missing subscription, renewal and an
assigned product user lacking a usage role. Retry rechecks authority; transport
failure is not missing subscription. Purchase/renewal target the public product
pricing flow, not console order paths. Arda uses
https://vxture.com/zh-CN/pricing?product=arda.

Arda assets include an independent logo/mark, light technology background with
reduced-motion support and card motif. Static acceptance covered ten states at
1440/390/320px (30 cases). Static demonstrations do not execute authentication.

## Implementation and releases

| PR | Delivery | Squash |
| --- | --- | --- |
| [215](https://github.com/vxture/vxture-arda/pull/215) | Entry framework, real gates, recovery and scoped actions | a5b63ac |
| [216](https://github.com/vxture/vxture-arda/pull/216) | ACR-compatible image manifests | 9609a92 |
| [217](https://github.com/vxture/vxture-arda/pull/217) | Domain, RP and platform admission | 20bd3d2 |
| [218](https://github.com/vxture/vxture-arda/pull/218) | Accounts logout, activity, refresh and backchannel correctness | ed610db |
| [219](https://github.com/vxture/vxture-arda/pull/219) | Core-feature access, seats and hosted-storage accounting | 47a6b62 |
| [220](https://github.com/vxture/vxture-arda/pull/220) | Lifecycle, read reconciliation, durable C3 and Atlas adapter | b98544d |
| [222](https://github.com/vxture/vxture-arda/pull/222) | Eligible quota-pool aggregation, readiness and AI accounting correction | ff4e132 |
| [223](https://github.com/vxture/vxture-arda/pull/223) | Workspace-scoped service binding in key creation UI | 6295744 |

Entry recovery uses a new login tab and retains the mounted work surface only
when identity, organization, workspace and roles still match. Scope changes reload.
Server authorization remains authoritative. Purchase actions require the existing
signed org:owner role; workspace administration does not imply billing authority.
Storage counts tenant-hosted JSON bytes, not external source-database footprints.

Initial entry checks: 45 tests and 21 browser cases passed. Later interface CI
included real PostgreSQL concurrency; PR222 had 79 passed / 2 skipped of 81 tests.
Build, audit, gitleaks and quality gates passed for implementation PRs. Counts
are stage-specific, not a cumulative final suite count.

| Release | Actions run | Outcome |
| --- | --- | --- |
| v0.12.0 | 44881629536 | Initial entry production release succeeded |
| v0.13.0 | 44890829712 | New-domain release, owner approved, succeeded |
| beta-20261121.7 | 44910187525 | Final candidate and gateway acceptance succeeded |
| v0.13.1 | 44911686041 | Same validated 6295744 image, owner approved, succeeded |

Run links use https://github.com/vxture/vxture-arda/actions/runs/{run}.
Earlier beta manifest failure was corrected before successful redeployment.
Later documentation merges do not change the deployed image or trigger release.

## Configuration and commercial delivery

Stable home, callback, post-logout and backchannel URLs use arda.ruyin.work;
stable localhost/legacy URLs were removed. Beta remains independent. Registration
is web only, including responsive mobile browsers, not native apps or mini-apps.
Platform L2/L3 registration/routing uses management configuration. Product runtime
settings use this repository's normal deployment. Legacy edge retirement remains
a platform follow-up; cleaned RP configuration alone does not prove retirement.

| Customer metric | Starter | Pro | Business | Enterprise |
| --- | ---: | ---: | ---: | --- |
| CNY/month | 99 | 299 | 999 | Private deployment/contact sales |
| Seats | 1 | 1 | 5 | Contract |
| Storage GiB | 1 | 5 | 20 | Contract |
| AI credits/month | 150 | 500 | 1500 | Contract |
| Datasets | 500 | 5000 | 20000 | Contract |
| Sources | 5 | 20 | 100 | Contract |
| Published services | 1 | 10 | 50 | Contract |
| Service calls/month | 20000 | 200000 | 2000000 | Contract |
| Quality executions/month | 1000 | 10000 | 100000 | Contract |

Public ordering starts seats, storage, AI. Customer labels for the last two
service metrics are recorded in the local Chinese handoff. All tiers have human
and ticket support. Internal retention 90/365/365 is not a public key metric.
Annual prices remain 1188/3588/11988, without discount, because explicit removal
needs platform issue718. No expansion SKU was published. Alpha 0.5 is a platform
upgrade/refund weight, not margin. Approximately 70% direct contribution is a
pricing target, not measured net profit.

## Accepted live behavior and limits

- Production health/readiness identify v0.13.1/6295744; DB and Redis are healthy.
  Bounded failed-dependency readiness returned503 locally without secret leakage.
- Signed provisioning read exchange/list returned200. Production startup scan:
  pages1, scanned4, failed0, readOnly=false. Beta scans are read-only because the
  list is product-wide. This is not a live stop/re-enable/repair drill.
- Actual subscribed workspace C2 is active/business. Eligible returned pools are
  summed; combined storage/AI balances may include shared or earmarked grants.
- Beta and production each performed one separately owner-authorized empty-service
  GET200. Each generated one real amount1 service.api.call row, automatically
  acknowledged on attempt1, without manual flush or synthetic events. Purchased
  call remaining moved2000000 ->1999999 in beta, then1999999 ->1999998 in prod.
- Each temporary key was service-bound, had zero /api/v1 scopes, was revoked
  through UI, and the service was paused. Read-only DB checks confirmed cleanup;
  temporary plaintext files were deleted. No second acceptance call was made.
- Production Accounts callback admitted Business. Beta logout invalidated prod;
  prod logout invalidated beta. Fresh Opera reads before/after beta logout proved
  workforce isolation. Opera was already expired before the later prod test, so
  that round adds no isolation claim. Browser outcomes do not identify backchannel
  versus status-fallback delivery or prove every other product passed.
- Atlas adapter targets /v1/chat with validated scoped tickets and bounded calls.
  Curator is unwired; runtime route/model is unconfigured; actual inference is
  unaccepted. Atlas reports four raw token dimensions attributed to Arda; the
  platform converts/debits credits. Arda must not duplicate AI usage reporting.

Local output retains redacted single-call results, C2 probes and cleanup/logout
screenshots named arda-prod-*-20261121 and arda-opera-isolation-passed-20261121.jpg.
Review tenant/environment information before sharing evidence externally.

## Remaining work and ownership

Arda still needs authorized real source queries, masking and quality execution;
actual Curator/Atlas inference and token-to-credit evidence; live lifecycle stop,
re-enable and missed-delivery repair. Intermittent C2 errors need separate root
cause evidence; failed legacy fixtures do not prove a paid-workspace defect.

Platform issues in https://github.com/vxture-platform/vxture-platform/issues/:

| Issue | Follow-up |
| --- | --- |
| 715 | Product renewal flow |
| 717 | Customer labels/order, internal controls, Enterprise CTA and timestamps |
| 718 | Explicit billing-cycle removal |
| 719 | Honest launch summaries, applicable dependencies and Bearer/ACK evidence |
| 720 | Atomic version-bound ACK and delivery ownership |
| 721 | Configuration-owned legacy-domain retirement |

These are handoff items, not a fresh issue-state audit. Historical platform PR716
predates the clarified repository boundary; no edge installation was applied.
Do not edit platform sources, create platform worktrees or change server variables.
Send detailed issues instead. Public sales and expansion publication need separate
decisions. See [Karda next-step plan](../70-workplan/40-karda-rectification-handoff.md).

Readable Chinese local records: output/arda-project-delivery-20261121.md and
output/karda-rectification-plan-20261121.md. They are local delivery artifacts;
this tracked document preserves the consolidated project history independently.
