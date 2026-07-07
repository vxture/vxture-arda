# arda 商业化/计费模型 (arda-biz-260-billing)

> Status: authoritative design - pending platform configuration
> Scope: arda product billing dimensions, tier matrix, C2 capability keys,
>        C3 metric names. This document is the handoff to the vxture platform
>        team so they can configure quota_pools and capabilities for product=arda.
> Upstream: arda-biz-100 (capability map), arda-ent-120 (C2/C3 contract)
> Code: portals/app/app/entitlement/quota.ts (METRICS constants + types)

---

## 0. Design decisions

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
  varda is a first-party product and has its own varda.credit pool.
- Data egress: phase 1 = count-based (api.call). Phase 2 = export/share
  type calls weighted. Phase 3 = bytes. AuditLog.bytesOut field to be added
  when egress billing activates.

---

## 1. C2 capability keys (platform must include in capabilities map)

These are read by arda from GET /platform/entitlements capabilities field.
All keys are flat (no product prefix per P2.1 note).

| Key | Type | Description |
|---|---|---|
| `tier` | string | Subscription tier: free/starter/pro/business/enterprise |
| `member.max` | int or -1 | Max human workspace members. -1 = unlimited |
| `dataset.max` | int or -1 | Max registered Datasets |
| `datasource.max` | int or -1 | Max connected DataSources |
| `service_endpoint.max` | int or -1 | Max published DataService endpoints |
| `varda.enabled` | bool | varda agent feature enabled |
| `varda.readonly` | bool | varda restricted to read DataService calls |
| `sync.frequency` | string | manual/daily/hourly/realtime |
| `retention.days` | int or -1 | Data history retention days. -1 = unlimited |

---

## 2. C3 quota pool metrics (platform must configure quota_pools for product=arda)

These are reported by arda via POST /usage/consume.
Canonical metric names (also in quota.ts METRICS constant):

| Metric | Unit | Reset | Description |
|---|---|---|---|
| `storage.bytes` | bytes | none (cumulative capacity) | Workspace shared pool. arda reports delta: +sizeBytes on Dataset register, -sizeBytes on delete. Reporting mode: delta or snapshot - TBD with platform. |
| `service.api.call` | count | monthly | External DataService calls (rest_api/query/export/share). amount=1 per call. Internal varda calls excluded. |
| `quality.check.run` | count | monthly | QualityRule batch execution runs. amount=rules executed per batch. |
| `varda.credit` | credits | monthly | varda AI operation credit consumption. See credit table in section 4. |

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
| varda.credit / month | 0 | 50 | 500 | 5,000 per seat | negotiated |

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

## 5. Storage pool reporting design

### arda reports (C3)

```
POST /usage/consume
{
  workspace_id: <wsId>,
  product: "arda",
  metric: "storage.bytes",
  amount: <delta_bytes>,           // + on register, - on delete
  idempotency_key: "storage-<wsId>-<datasetId>-<version>"
}
```

Trigger points in arda code (to be wired when Dataset CRUD routes exist):
- Dataset create with sizeBytes -> +sizeBytes
- Dataset delete            -> -sizeBytes (if sizeBytes was set)
- Dataset update sizeBytes  -> +(new - old)
- File asset upload         -> +fileBytes (future, if arda hosts file bytes)

### arda reads remaining (C2)

```typescript
// quota.ts: parsePool(quota_pools, "storage.bytes")
// -> { limit, remaining, pct }
// Displayed in admin storage card.
```

UI thresholds (arda-side local check):
- pct < 0.20 -> yellow warning banner
- pct < 0.05 -> red alert, block new asset registration

### Pending decision with platform

storage.bytes reporting mode: delta accumulation vs periodic snapshot.
- Delta: arda reports +/- on each operation. Platform accumulates.
  Risk: drift if arda misses a delete event.
- Snapshot: arda periodically (e.g. hourly) reports current total bytes.
  Platform takes the latest value, not sum.
Recommendation: snapshot mode is more resilient. Confirm with platform team.

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
- [ ] Confirm storage.bytes reporting mode (delta vs snapshot)
- [ ] Confirm varda.credit -> token conversion rate
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
