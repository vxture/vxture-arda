# Explicit product roles and default assignment

Date:2026-11-23. Status: implementation decision; runtime not implemented.
Owner clarification supersedes the earlier implicit-baseline-member design.

## Authority and decision

Platform owns subscriptions, seats and the currently authorized user roster.
The product owns its member records, roles and business permissions. A platform
grant is necessary but does not itself grant product business permissions.
A missing product role grants zero permissions, including product entry.
Do not put fabricated product roles in platform governance-token claims.

## Initial built-in roles

| Role code | Purpose | Permission boundary | Default |
| --- | --- | --- | --- |
| owner | Single anchored product owner; audited bootstrap/transfer; never billing or seat authority | Full product administration plus ownership transfer | Trusted initial bootstrap only |
| administrator | Product administration | Product settings/member roles plus business operations, subject to resource scope; never platform billing or seats | No |
| member | Normal business work | Read/create/edit within permitted resource scopes; no member-role or product-settings management | No |
| readonly | Read existing business information | View and permitted read-only queries; no create/edit/delete/import/publish or management | Yes, new authorized members |
| guest | Limited product visit | Only explicitly guest-visible resources; do not reuse the full readonly data scope | No |

These are product role codes, not platform governance role aliases. Product
capabilities and resource scopes further narrow every role. Karda library owner
and visibility rules continue to apply; a product administrator is not implicitly
the owner of a private library. Arda classification and workspace isolation also
remain mandatory. Read-only query POSTs must be classified explicitly; HTTP method
alone cannot define read/write permissions. AI use and export need named
permissions and quota checks, not automatic inclusion under read-only access.

## Default assignment lifecycle

1. Resolve active identity, current subject-bound platform product access and
   effective subscription from trusted context. Reject denied/unavailable facts.
2. For an eligible new product member, transactionally insert the workspace/sub
   member identity and an explicit readonly role assignment. Concurrency must
   create at most one member/default grant. Do not grant platform seats.
3. Existing member records are never treated as new merely because their role
   list is empty. An empty/removed role stays denied; repeated login, roster sync,
   token refresh or an out-of-order event must not recreate the default grant.
4. Evaluate role-to-permission assignments server-side for every operation.
   Unknown/inactive roles or permissions fail closed; no role means no access.
5. A platform revocation disables all product use regardless of retained local
   role history. The roster is an eligibility source, not a permanent allow-list.
   A later platform reauthorization never restores a locally removed role.
6. Product role changes publish local permission invalidations and retain audit
   evidence. Upstream seat-change delivery remains platform issue731/726.

## Existing members and bootstrap

Do not silently promote all historical users or infer product administrator from
any arbitrary token owner string. Prepare a scoped adoption preview for existing
platform-authorized members. Preserve explicitly removed/suspended local roles.
Bootstrap an initial product administrator only through the documented trusted
workspace-owner/configuration path, with an explicit role grant and audit; the
role is not a permanent bypass based on identity or subscription.
Karda has local_authz member/role/permission/member_role/role_permission tables;
reuse and verify them. Arda local_authz currently has no models and needs an
owned DDL increment. Record schema, grants and Prisma in lockstep. No server
variable, platform code or seat mutation is part of this implementation.

## Batches and acceptance

| Batch | Deliverable | Status |
| --- | --- | --- |
| R1 | Formal explicit roles, default grant lifecycle, no-role denial and boundaries | Defined by this decision |
| R2 | Persistent member/role/permission/default-grant records and migration/adoption preview | Pending |
| R3 | Role checks on entry, business reads/writes, queries, AI/export and management; remove all implicit member fallbacks | Pending |
| R4 | Platform roster integration, local role-change invalidation and platform revocation recovery | Roster reader implemented; role integration pending |
| R5 | Regression, human-gated production release and actual authorized/roleless/revoked-member acceptance | Pending |

Required regression: new eligible member receives a real readonly assignment;
unauthorized subjects cannot create membership/grants; an existing roleless member
is denied and remains roleless after login; readonly cannot write via server
actions or read-like POST endpoints; no accidental AI/export or management
permission; guest data scope is narrower; removed platform seats deny historical
local administrators; concurrent initialization is idempotent; workspace scope,
role changes, authority failure and out-of-order notifications fail safely.

## Superseded candidates

Arda v0.13.4 deploy45107304781 was cancelled before production deployment.
Karda v0.11.7 deploy45107365314 was cancelled before production deployment.
Neither cancelled candidate is evidence of this explicit-role implementation.
Do not approve or re-run those application deployments. Database DDL0004 for
Arda events remains verified and is independent of the pending role storage.

## Implementation checkpoint - 2026-11-23

The role catalog includes owner/administrator/member/readonly/guest. Owner is a
unique persisted anchor, not a permanent platform-claim bypass. R2-R4 are now
authored in the product repository; production DDL/application and R5 live
acceptance are pending. Current evidence and adoption/owner recovery procedure:
[role delivery tracker](../../70-workplan/60-explicit-product-roles-20261123.md).
