import type { FeatureKey } from "../../entitlement/capability";

/**
 * Registerable source types and their gating key (biz-410 §gating):
 * basic (file/db) = arda.integration.sources_basic; premium connectors
 * (warehouse/SaaS) = arda.integration.sources_premium. The required key is
 * re-derived SERVER-SIDE in the register action - this table also drives the
 * type picker UI (premium options carry the tier badge).
 */
export const SOURCE_TYPES = [
  // Internal agent-db (arda_000 2.2 type-1, v1 priority): an L3 product's
  // business database (vxturebiz_{product}_{env}); postgres under the hood.
  { type: "agent_db", premium: false },
  { type: "file", premium: false },
  { type: "postgres", premium: false },
  { type: "mysql", premium: false },
  { type: "rest", premium: false },
  { type: "s3", premium: true },
  { type: "bigquery", premium: true },
  { type: "snowflake", premium: true },
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number]["type"];

export function featureKeyForSourceType(type: string): FeatureKey | null {
  const entry = SOURCE_TYPES.find((t) => t.type === type);
  if (!entry) return null;
  return entry.premium ? "arda.integration.sources_premium" : "arda.integration.sources_basic";
}
