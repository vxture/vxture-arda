# arda 商业化/计费模型 (arda-biz-260-billing)

> Status: authoritative design - pending platform configuration
> Scope: arda product billing dimensions, tier matrix, C2 capability keys,
>        C3 metric names. This document is the handoff to the vxture platform
>        team so they can configure quota_pools and capabilities for product=arda.
> Upstream: arda-biz-100 (capability map), arda-ent-120 (C2/C3 contract)
> Code: portals/app/app/entitlement/quota.ts (METRICS constants + types)

---

## 0. Design decisions

- Tier is the original five: **free / starter / pro / business / enterprise** (unchanged).
- **Access mode (source), orthogonal to tier** (per ADR-11 §11.3):
  - **standalone** = the workspace subscribes to arda directly (any tier).
    Grants both the arda product UI and data access.
  - **bundled** (renamed from "standard") = the workspace has NO standalone arda
    subscription, but an agent Plan it subscribes to includes an arda component
    with **`component_role = bundled`** (product_220 §2). arda serves the agent's
    data access from the BACKEND only - **no arda product UI**. C2 exposes this as
    a **`bundled: true` boolean orthogonal to tier** (product_220 §3): tier stays
    five-or-null and reflects only standalone purchases; it is NOT a sixth tier.
  - The bundled component is **independently configured** (its own quota, locked
    into the agent's plan version - see §6). Currently ~ free, EXCEPT
    **`member.max = 0`** (backend-agent mode has no human seats; free = 1).
  - Supersedes the earlier "billing=bundled_free / tier rank=free" framing
    (reply-01 §6); authoritative model = product_220 + reply-02.
  - Enforcement split: product-UI gate requires standalone (active); data-access
    gate (agent DataService consumption) accepts bundled OR standalone. See
    `arda-data-170-platform-agent-support.md` §2②.
- Seats = humans only. Agents (varda, external L1/L2) are not seats.
- free / starter / pro = individual plans, member.max = 1.
- business = team/org plan; member.max comes from the purchased plan.
- enterprise = unlimited, negotiated.
- Storage = workspace-level shared pool across all vxture products
  (arda + karda + terra + agents). Each product reports its slice
  independently via C3. Platform aggregates the total.
- varda agent opens at starter (read-only, 50 credits) and pro
  (read-only, 500 credits). business gets read-write (5000 credits/seat).
- api.call = external DataService callers only (ApiKey + consumerApp != varda).
  varda is a first-party product; its AI draws the L0 `ai.credit` pool.
- Data egress: phase 1 = count-based (api.call). Phase 2 = export/share
  type calls weighted. Phase 3 = bytes. AuditLog.bytesOut field to be added
  when egress billing activates.

---

## 1. C2 fields (SUPERSEDED 2026-07-13: capability keys withdrawn; limits stay)

> **[2026-07-13 owner ruling: capability/quota split]** The platform no longer
> configures or delivers ANY capability keys - the `capabilities` map is
> removed from C2 (ent-120 v2). The former key list below is re-homed:
>
> - **Capability booleans/levels -> arda-local capability matrix**
>   (`varda.enabled`, `varda.readonly`, `sync.frequency`): which tier unlocks
>   what is product knowledge, versioned in the arda repo (ent-110 §2a).
>   Platform stops configuring these entirely.
> - **Numeric caps -> C2 `limits` block** (`member.max`, `dataset.max`,
>   `datasource.max`, `service_endpoint.max`, `retention.days`): these are
>   pricing-page sales numbers, still platform-defined per plan and delivered
>   as a flat `limits` map (max-merged across sources). arda enforces them
>   locally at action points (its own entity counts) - value from platform,
>   enforcement in product.
> - `tier` is a top-level envelope field (status/tier/bundled), not a key.

| Limit (C2 `limits`) | Type | Description |
|---|---|---|
| `member.max` | int or -1 | Max human workspace members. -1 = unlimited |
| `dataset.max` | int or -1 | Max registered Datasets |
| `datasource.max` | int or -1 | Max connected DataSources |
| `service_endpoint.max` | int or -1 | Max published DataService endpoints |
| `retention.days` | int or -1 | Data history retention days. -1 = unlimited |

---

## 2. C3 quota pool metrics (platform must configure quota_pools for product=arda)

These are reported by arda via POST /usage/consume.
Canonical metric names (also in quota.ts METRICS constant):

Metric kind and overage mode are fixed by platform ruling reply-01 R4/R5:

| Metric | Kind | Reset | Overage mode | Description |
|---|---|---|---|---|
| `storage.bytes` | **gauge** | none (water level) | admission-only (no consume) | Workspace shared pool. Snapshot reporting via future `PUT /usage/gauge` (R4: delta rejected). Not wired to consume until gauge endpoint ships; C2 display + local admission only. |
| `service.api.call` | counter | monthly | **divisible 后报** | External DataService calls (rest_api/query/export/share). amount=1 per call. Internal varda calls excluded. 409 = terminal, no retry. |
| `quality.check.run` | counter | monthly | **divisible 后报** | QualityRule batch execution runs. amount=rules executed per batch. 409 = terminal, no retry. |
| `ai.credit` | counter | monthly | **atomic 预扣** | AI credit (renamed from varda.credit, promoted to L0 platform_metric; product_220 §4). Consume BEFORE the AI op; 409 → reject. Pools earmarked per product by default; tenant admin may enable a shared overflow pool (reply-02 §2). See section 4. |

---

## 3. Tier matrix

### 3a. C2 capability limits

| Capability | free | starter | pro | business | enterprise |
|---|---|---|---|---|---|
| Positioning | individual trial | individual light | individual pro | team / org | custom |
| member.max | 1 | 1 | 1 | plan seats | -1 (unlimited) |
| dataset.max | 50 | 500 | 5000 | -1 | -1 |
| datasource.max | 2 | 5 | 20 | 100 | -1 |
| service_endpoint.max | 0 | 1 | 10 | -1 | -1 |
| varda.enabled | false | true | true | true | true |
| varda.readonly | - | true | true | false | false |
| sync.frequency | manual | daily | hourly | realtime | realtime |
| retention.days | 30 | 90 | 365 | -1 | -1 |
| Governance modules | quality (basic) | +standards +lineage | +security +policies | +MDM | all + custom |

### 3b. C3 quota pool limits (monthly, except storage)

| Metric | free | starter | pro | business | enterprise |
|---|---|---|---|---|---|
| storage.bytes (workspace pool) | 1 GB | 10 GB | 100 GB | 1 TB | negotiated |
| service.api.call / month | 1,000 | 20,000 | 200,000 | 2,000,000 | negotiated |
| quality.check.run / month | 100 | 1,000 | 10,000 | 100,000 | negotiated |
| ai.credit / month | 0 | 50 | 500 | 5,000 per seat | negotiated |

> These are initial preset values. Tune after observing real usage patterns.

---

## 4. varda credits reference table

Credits are the unit arda reports to the platform. The platform converts
credits to token cost internally (1 credit = ~2K tokens as baseline).

| varda operation | credits | Notes |
|---|---|---|
| Dataset smart catalog (per asset) | 1 | Reads metadata, generates description/tags |
| Quality rule AI generation | 3 | Generates rules from schema+samples |
| Cross-asset lineage inference | 5 | Multi-hop analysis |
| Master data match/merge analysis | 10 | Entity resolution on a Dataset pair |
| Workspace data health scan | 20 | Full workspace sweep |

> starter: 50 credits = ~25 catalog operations or ~10 quality rule generations.
> pro: 500 credits/month. business: 5000 * seats.

---

## 5. Storage pool reporting design (RESOLVED: gauge snapshot, reply-01 R4)

storage.bytes is a **gauge** (water level), not a counter. Delta was rejected
(needs negative amounts; drifts permanently on a missed delete; no snapshot to
reconcile against). arda reports the current total via a future gauge endpoint,
NOT via consume.

### arda reports (C3 gauge, future endpoint)

```
PUT /usage/gauge                 # shape preview per reply-01 R4; product_310 D5
{
  workspace_id: <wsId>,
  product: "arda",
  metric: "storage.bytes",
  value: <current_total_bytes>,  // absolute water level, not a delta
  observed_at: <iso8601>         // last-write-wins ordering key
}
```

Platform stores the latest value per (workspace, product, metric); cross-product
shared pool = platform sums each product's slice at read time. Self-healing
(each report overwrites), naturally idempotent, aligned with arda-db as SoR.

Trigger: periodic (or write-path throttled) snapshot of `SUM(Dataset.sizeBytes)`
for the workspace. **Until the gauge endpoint ships, storage is NOT wired to
recordUsage** (transition per R4) - C2 display + local admission only.

### arda reads remaining (C2) + admission enforcement

```typescript
// quota.ts: parsePool(quota_pools, "storage.bytes") -> { limit, remaining, pct }
// remaining = plan limit - Σ(each product's water level). arda display unchanged.
```

Admission check (reply-01 §4.1): enforced BEFORE byte transfer, on the client's
**declared** file size (not post-write actual):
1. Apply: `declared_size <= C2 remaining` gates the upload token issuance.
2. Transfer: server counts received bytes, cuts the connection + cleans partials
   if it exceeds declared size or remaining.
3. Commit: actual arda-db size drives the gauge snapshot. Declared size is
   admission-only, never accounted.

Not strongly consistent: concurrent admissions may briefly overshoot (expected,
not a defect). The gauge records the true (over)level next snapshot; C2 remaining
goes negative and the gate closes new uploads (`remaining <= 0`); **deletes always
pass**; level converges as users clean up. No reservation/pre-hold in v1 (storage
overshoot = transient disk, not money; cf. R5 cost-tiered strictness).

UI thresholds (arda-side local check):
- pct < 0.20 -> yellow warning banner
- pct < 0.05 -> red alert, block new asset registration
- remaining <= 0 -> gate closed on new uploads (deletes still allowed)

---

## 6. Member seat enforcement

arda checks member.max from C2 capabilities before adding a new workspace member.
- member.max = 1 (free/starter/pro): block invite UI entirely.
- member.max = N (business): show remaining seats; block when reached.
- member.max = -1 (enterprise): no cap shown.

arda does NOT report member count via C3 (seats are a capability limit, not
a consumable quota pool). The platform manages seat counts via subscription.

---

## 7. Platform configuration checklist

For vxture platform team to configure before arda e2e test:

- [ ] Register product "arda" in platform entitlement system
- [ ] Configure capabilities map for each of the 5 tiers (section 3a)
- [ ] Configure quota_pools for each tier with the 4 metrics (section 3b)
- [ ] **Bundled component**: for agent Plans that need arda data support, add an
      arda `data` component with `component_role = bundled` (tier NULL) in that
      agent's plan version, so C2 returns `bundled: true` for the workspace
      (enables agent data access without a standalone arda subscription;
      product_220 §2/§3). Configure its quota as an INDEPENDENT profile - currently
      ~ free EXCEPT **`member.max = 0`** (no human seats in backend-agent mode).
- [ ] **C2 `status` field** (reply-02 §1): emit `status ∈ {none,trial,subscribed,expired}`
      so arda can distinguish trial/expired/never; `suspended` via token `account_status`.
- [x] storage.bytes reporting mode = gauge snapshot (RESOLVED, reply-01 R4); platform to ship `PUT /usage/gauge` (product_310 D5)
- [ ] Confirm ai.credit -> token conversion rate (1 credit ~= 2K tokens)
- [ ] Set ARDA_PROVISION_WEBHOOK_SECRET and share with arda operator
- [ ] Test workspace: create a workspace with product=arda, tier=pro, verify
      GET /platform/entitlements returns expected capabilities + quota_pools

---

## 8. Code reference

| File | Purpose |
|---|---|
| `portals/app/app/entitlement/quota.ts` | METRICS constants, WorkspaceQuota types, mapToWorkspaceQuota() |
| `portals/app/app/entitlement/platform-client.ts` | fetchPlatformEntitlement() -> { subscription, quota } |
| `portals/app/app/entitlement/platform-resolver.ts` | 45s cache for { subscription, quota }, resolveQuota() |
| `portals/app/app/api/entitlement/quota/route.ts` | GET /api/entitlement/quota |
| `portals/app/app/usage/lib/buffer.ts` | recordUsage() - C3 write buffer |
| `portals/app/app/usage/lib/flush.ts` | flushUsage() - drain buffer to POST /usage/consume |
| `portals/app/app/api/usage/flush/route.ts` | GET /api/usage/flush trigger |
