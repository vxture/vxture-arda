# Arda - Entitlement Model

---

## Overview

Entitlement in Arda has two dimensions: **lifecycle state** and **subscription
tier**. Both are derived from the `arda` claim carried in the OIDC access token
issued by accounts.vxture.com. The resolver converts the claim into a
gate-facing `Subscription` object that the auth-gated layout uses to admit or
redirect the user.

Source of truth: `portals/app/app/entitlement/types.ts`

---

## Lifecycle State (`ArdaState`)

The state describes where the user is in the Arda subscription lifecycle.

| State | Meaning |
|---|---|
| `trial` | New user on the beta stack. Has not subscribed commercially. |
| `subscribed` | Active paid subscription; on the prod stack. |
| `expired` | Subscription lapsed; on the prod stack at free-tier access. |
| `free` | Direct-subscribed user whose sub lapsed, or never entered trial; on prod. |

**Invariants enforced by accounts.vxture.com:**

| State | Forced tier | `had_trial` |
|---|---|---|
| `trial` | `pro` (full-feature preview) | `false` until user has been on trial, then `true` |
| `subscribed` | `pro`, `team`, or `enterprise` | any |
| `expired` | `free` | any |
| `free` | `free` | `false` (no trial) or `true` (was on trial) |

---

## Subscription Tiers (`Tier`)

| Tier | Rank | Intended users |
|---|---|---|
| `free` | 0 | Lapsed or direct-free users |
| `pro` | 1 | Individual paid subscribers |
| `team` | 2 | Team subscriptions |
| `enterprise` | 3 | Enterprise contracts |

Tiers are ordered: a higher rank entitles the user to all features of lower
tiers. Use `tierMeets(user.tier, minTier)` for feature gates:

```typescript
import { tierMeets } from "@/entitlement/types";

// True if the user is on pro or above:
if (tierMeets(subscription.tier, "pro")) { ... }
```

---

## ArdaClaim (From Access Token)

```typescript
interface ArdaClaim {
  state: ArdaState;        // "trial" | "subscribed" | "expired" | "free"
  tier: Tier;              // "free" | "pro" | "team" | "enterprise"
  had_trial: boolean;      // true iff user ever entered a trial
}
```

`had_trial` is used for the data-migration step on upgrade: users who came
through trial may have trial-era data assets that need a migrate/discard decision
before they can be merged into their prod subscription. Direct-subscribe paths
skip this step.

---

## Subscription (Gate-Facing View)

The gate does not use `ArdaClaim` directly; it uses `Subscription`:

```typescript
interface Subscription {
  tier: Tier;
  status: "active" | "expired" | "none";
}
```

Mapping from `ArdaClaim` to `Subscription` (`subscriptionFromClaim`):

| State | `status` | `tier` |
|---|---|---|
| `trial` | `active` | `pro` |
| `subscribed` | `active` | claim tier |
| `expired` | `expired` | `free` |
| `free` | `none` | `free` |

---

## Gate Behavior

The `(app)` layout checks `subscription.status`:

- `active`: user is admitted. All routes under `/(app)` are accessible
  (subject to per-route tier checks).
- `expired`: user is redirected to the upgrade/entitlement surface with
  context that their subscription lapsed.
- `none`: user is redirected to the upgrade/entitlement surface with
  context that they have no active subscription.

---

## Entitlement Resolver

```typescript
interface EntitlementResolver {
  resolve(claim: ArdaClaim | null): Promise<Subscription>;
}
```

The active resolver is `MockEntitlementResolver` (returned by
`getEntitlementResolver()`). It is a passthrough: if a real `ArdaClaim` is
present in the token, it is passed to `subscriptionFromClaim` unchanged. If no
claim is present (local dev without a real IdP), it falls back to `MOCK_STATE`
and `MOCK_TIER` env vars.

**When to remove the mock:** Once accounts.vxture.com guarantees the `arda`
claim is present in all environments (prod, beta, local dev with real IdP),
the factory can be simplified. Until then, the mock is needed for local dev
and for CI builds that do not have a live IdP.

---

## EnvGuard

`portals/app/app/entitlement/env-guard.tsx` is a client-side component that
checks `NEXT_PUBLIC_APP_ENV` against the user's stack affinity. If a user with a
prod subscription lands on the beta URL, EnvGuard redirects them to
`NEXT_PUBLIC_PROD_URL`. If a trial user lands on the prod URL, EnvGuard redirects
them to `NEXT_PUBLIC_BETA_URL`.

EnvGuard is a UX convenience, not a security gate. A determined user can bypass
it by disabling JavaScript. The server-side session and entitlement gate is the
authoritative enforcement mechanism.

---

## Entitlement Configuration (`.env`)

| Variable | Default | Effect |
|---|---|---|
| `MOCK_STATE` | `subscribed` | Fallback state when no real claim present |
| `MOCK_TIER` | `pro` | Fallback tier when no real claim present |
| `DEFAULT_LANDING` | `/data-assets/overview` | Post-login redirect for `active` users |

For beta stack: set `MOCK_STATE=trial` so local dev against the beta stack sees
trial-state behavior. For prod stack: `MOCK_STATE=subscribed` is safe because
the mock is only active when no real claim is present.
