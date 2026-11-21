# Commercial plans - November 2026

This supersedes the numeric tier presets and individual feature locks in
arda-biz-260-billing.md. Platform plan versions own all commercial limits;
this document is the release specification, not a local quota override.

## Public offer

| Metric | Starter | Pro | Business | Enterprise |
| --- | ---: | ---: | ---: | --- |
| CNY per month | 99 | 299 | 999 | Contact sales |
| Human seats | 1 | 1 | 5 | Private deployment agreement |
| Hosted storage | 1 GiB | 5 GiB | 20 GiB | Agreement |
| AI credits per month | 150 | 500 | 1500 | Agreement |
| Datasets | 500 | 5000 | 20000 | Agreement |
| Source connections | 5 | 20 | 100 | Agreement |
| Published services | 1 | 10 | 50 | Agreement |
| Service calls per month | 20000 | 200000 | 2000000 | Agreement |
| Quality rule executions per month | 1000 | 10000 | 100000 | Agreement |

All editions support human assistance and tickets. Enterprise is private
deployment, never a zero-price self-service offer. Free is retired from new
sales; its existing subscriptions remain pinned to their original versions.
Trials use platform coupons, not a separate trial plan. No annual discount
is approved. Public Chinese labels and their order are fixed in the owner's
final proposal; published services and monthly service calls are separate.

## Product behavior

Implemented individual capabilities are open at all tiers, including existing
Free subscriptions. Collaboration remains Business/Enterprise. Future feature
keys stay unavailable. Subscription access, workspace isolation and RBAC are
unchanged. Opening a capability does not permit operations forbidden by RBAC.

Canonical human seats use seat.max. Read member.max for pinned legacy plans
when seat.max is absent. Other numeric limits remain platform-owned.
Do not silently hard-block soft consumption pools.

Storage reports the logical UTF-8 JSON payload size of workspace catalog
records, including quality history. Dataset.sizeBytes describes external
assets and MUST NOT be summed as hosted storage. Shared reference records,
delivery ledgers, internal indexes and compliance logs are excluded. New
hosted binary objects require a committed-object ledger before upload ships.
The current snapshot is reconciled by scheduled refresh and source sync;
report failures are best-effort and never fabricate successful C3 delivery.

## Release

Save and verify four plan versions before publishing. Remove legacy functional
quota keys varda.enabled, varda.readonly and sync.frequency. These are product
behavior, not commercial grant parameters. Retain internal retention limits
90/365/365 days. Do not migrate existing subscriptions or reduce their grants.

Validate the capability/seat regression suite and hosted storage query against
an isolated PostgreSQL database. Follow the repository PR, beta and required
production approval flow. Platform configuration is changed only through the
management application; do not edit platform server environment variables.
