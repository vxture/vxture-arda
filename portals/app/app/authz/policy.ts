/** Explicit product role policy. Never infer business rights from an empty role list. */
export const PRODUCT_ROLES = ["owner", "administrator", "member", "readonly", "guest"] as const;
export type ProductRole = typeof PRODUCT_ROLES[number];
export const PERMISSIONS = ["product.enter", "data.read", "data.write", "data.export", "ai.use",
  "service.publish", "members.manage", "product.manage", "ownership.transfer", "guest.read"] as const;
export type ProductPermission = typeof PERMISSIONS[number];
export interface ProductAccess { roles: ProductRole[]; permissions: ProductPermission[] }
export function permits(access: ProductAccess | null | undefined, permission: ProductPermission): boolean {
  return Boolean(access?.roles.length && access.permissions.includes(permission));
}
export function isProductManager(access: ProductAccess | null | undefined): boolean {
  return permits(access, "product.manage");
}
