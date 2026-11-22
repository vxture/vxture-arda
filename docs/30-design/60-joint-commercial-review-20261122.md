# Arda / Karda joint commercial review - proposal r1

Date: 2026-11-22. Status: PROPOSAL ONLY, not approved for publication.
Latest workload-driven review supersedes the equal-resource r1 recommendation:
[Workload review](https://github.com/vxture/vxture-karda/blob/main/docs/20-specs/70-ai-workload-review-20261122.md).
The owner accepts one pricing system, with different AI allocations by product.
Arda's Curator registry is currently empty: SQL assistance and analysis workload
examples are prospective capabilities, not delivered features. New candidates
are Arda150/600/2000 and Karda300/1200/4000 credits per month. Prices remain
owner-confirmed at199/499/1499 monthly for both products (r3), not published.
The20% coupon and95% joint discount are recalculated together; historical
65%/50% margin targets are no longer guaranteed. Resources remain candidates. Karda's workload examples depend on an unimplemented
retrieval optimization; current100-candidate scenarios exceed candidate grants.
The r1 tables below are historical budget scenarios, not the latest offer.

The owner requested joint pricing and cost review, including possible Arda
revisions. This does not change the current 99/299/999 offer, published grants,
existing subscriptions, addons, annual billing or production application.

The authoritative Chinese review, inputs and offline Decimal calculator live in
the Karda repository. Do not maintain a second independently edited cost model:

- [Joint review](https://github.com/vxture/vxture-karda/blob/main/docs/20-specs/60-joint-commercial-review-20261122.md)
- [Inputs](https://github.com/vxture/vxture-karda/blob/main/scripts/commercial/joint-pricing-inputs.json)
- [Calculator](https://github.com/vxture/vxture-karda/blob/main/scripts/commercial/joint-pricing-model.py)
- Review identifier: `arda-karda-20261122-r1`.

## Findings

Arda's old local calculator still models early 39/129/399 prices, storage0.50
perGiB-month and a0.6% payment assumption. The final offer is99/299/999 and
the approximately70% contribution goal was not measured profit. Karda uses
different storage/support/fee assumptions; comparing those results directly
does not establish a real product cost difference.

Admin readback confirms0.20CNY/credit anchor and70% conversion target. The
0.06CNY/credit reference applies to calibrated cost-aware rates, not all default
fallback models. Missing supplier prices remain. No pricing configuration changed.

Use one budget with separate AI, incremental hosted storage/indexes/backups,
public egress, fixed platform/support allocation, non-AI work and payment cost.
Shared storage is one workspace balance, AI follows reserved/shared audiences,
and seats remain product-specific. Never double a shared balance when summing
product views, nor multiply Business seats across products.

## Recommended candidates

| Metric, per product | Starter | Pro | Business |
| --- | ---: | ---: | ---: |
| CNY/month | 199 | 599 | 2199 |
| Seats | 1 | 1 | 5 |
| Hosted storage GiB | 1 | 5 | 20 |
| AI credits/month | 200 | 800 | 3000 |
| Connections | 5 | 20 | 100 |
| Public egress GiB/month, new proposal | 5 | 25 | 100 |
| Arda datasets | 500 | 5000 | 20000 |
| Arda published services | 1 | 10 | 50 |
| Arda service calls/month | 20000 | 200000 | 2000000 |
| Arda quality executions/month | 1000 | 10000 | 100000 |

Enterprise stays private deployment/contact sales. Core implemented individual
features remain open; collaboration starts at Business; human/ticket support
for all. Free100MiB/zeroAI is an internal/invitation candidate only; current
Free status and versioned old grants do not change.

The same per-product operating budget produces the same provisional price
ladder, not a claim that the products' actual costs are identical. New egress
is not an implemented or granted resource; contract/measurement, user-visible
overage behavior and technical controls must be verified before publication.

Optional joint base-subscription95% pricing:378.10/1138.10/4178.10 per month
for same-tier pairs. Mixed tiers are allowed in the proposal. Both independent
subscriptions and budgets are retained; no extra entitlement pool is created.
Addons do not receive that discount. Common candidate addons:10GiB storage99
per month,1000AI credits200 per pack,10GiB egress19 per period. All require
separate commercial approval and platform capability verification.

| Per-product budget result | Starter | Pro | Business |
| --- | ---: | ---: | ---: |
| Base monthly cost | 53.99 | 168.99 | 651.99 |
| Base contribution percent | 72.87 | 71.79 | 70.35 |
| Stress contribution percent | 59.30 | 55.43 | 53.07 |
| Severe-stress contribution percent | 53.02 | 50.00 | 47.39 |

These are full AI/storage/egress grant scenarios plus ASSUMED non-AI workload
budgets, not proof that all business limits can run worst-case workloads. No
actual CPU, index amplification, support labor, payment contract, tax treatment
or measured net profit is established. Joint Business95% stress contribution
is50.65%;90% would be47.97%. Heavy AI expansion can push stress margin below50%.

## Arda acceptance requirements

The gateway caps100rows PER linked dataset, not per entire service request;
response bytes and dataset fan-out have no demonstrated aggregate bound.
Source PostgreSQL statements have10second timeouts, but row width and public
egress still need limits. The /api/v1 per-key limiter is not proof the separate
/api/services gateway has the same limiter. Quality checks push queries into
customer-owned sources; their external compute bills are not our procurement
cost, but local waiting, memory, audit and result writes still cost resources.

Require service/query/quality/sync and wide-row load benchmarks; actual cost
attribution by product; calibrated Atlas rates; storage/egress and discount
contracts; and owner confirmation before any new offer is published. Keep
existing plan versions and subscription terms unchanged. No platform source,
server variable, edge route or environment was edited for this review.
