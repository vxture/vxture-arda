/**
 * ApiKey scope vocabulary for the external /api/v1 surface (data-170 1.2:
 * `scopes` bounds what a key may call). Enforcement is fail-closed: a v1
 * endpoint requires its scope to be present on the key, so pre-scope keys
 * (scopes = []) keep working only against the legacy service gateway, never
 * against /api/v1.
 */

export const API_SCOPES = {
  CATALOG_READ: "catalog:read",
  QUALITY_READ: "quality:read",
  LINEAGE_READ: "lineage:read",
} as const;

export type ApiScope = (typeof API_SCOPES)[keyof typeof API_SCOPES];

const ALL: readonly string[] = Object.values(API_SCOPES);

/** Validate a caller-supplied scope list against the known vocabulary. */
export function isKnownScope(scope: string): scope is ApiScope {
  return ALL.includes(scope);
}
