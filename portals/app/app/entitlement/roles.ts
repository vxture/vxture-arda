/**
 * Role gate for the admin domain (biz-250 SS6, biz-300 stage 0 line B).
 *
 * The permission axis is ORTHOGONAL to the subscription axis: a subscription
 * says what the workspace bought; roles say what this member may do. Both
 * must pass (two-axis gating, biz-100 SS3.2).
 *
 * Role values come verbatim from the IdP access token `roles` claim
 * (session.roles). The platform issues them as a SCOPE-PREFIXED array, e.g.
 * ["org:owner", "workspace:owner"] (auth-bff access-claims.ts; 080-rp SS2.11).
 * The governance role vocabulary is owner/manager/member/readonly/guest
 * (data_identity_200 SS6.4 seed); the platform NEVER issues a bare `admin`
 * role.
 *
 * The admin domain is reachable by the workspace owner or workspace manager,
 * or the org owner - i.e. exactly {org:owner, workspace:owner,
 * workspace:manager} (080-rp SS2.11 codify). org:manager is intentionally NOT
 * admin (org-level managers do not administer this workspace). Every unknown,
 * absent, or unexpectedly-shaped role is NON-admin (fail closed). Unlike
 * subscription locking (visible-but-locked), role-locked screens are HIDDEN
 * from the nav - an upgrade cannot buy a role.
 */

const ADMIN_ROLES: readonly string[] = [
  "org:owner",
  "workspace:owner",
  "workspace:manager",
];

export function isWorkspaceAdmin(roles: readonly string[] | undefined | null): boolean {
  return (roles ?? []).some((r) => ADMIN_ROLES.includes(r.trim().toLowerCase()));
}
