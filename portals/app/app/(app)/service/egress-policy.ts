import { prisma } from "../../lib/db";
import type { MaskedColumn } from "../sources/connectors/types";

/**
 * External egress policy resolution (Sec-BL1/Sec-BL2): what may leave arda
 * through the data-service gateway, and masked how.
 *
 * - Classification filter (Sec-BL2): datasets ABOVE the workspace's max
 *   external level are excluded from external responses entirely.
 *   Default max = internal; an enabled Policy{type:"access"} with
 *   config.maxExternalLevel overrides (product-owned policy vocabulary).
 * - Masking rules (Sec-BL1): enabled Policy{type:"masking"} rows contribute
 *   config.fields + config.strategy; optional config.datasetId narrows a rule
 *   to one dataset. Masking is pushed down into the source query - the
 *   connector computes masked expressions in-source.
 */

const LEVEL_RANK: Record<string, number> = { public: 0, internal: 1, sensitive: 2, core: 3 };
const DEFAULT_MAX_EXTERNAL = "internal";
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const STRATEGIES = new Set(["redact", "hash", "partial"]);

export interface EgressPolicy {
  maxExternalLevel: string;
  /** datasetId -> masked columns (null key "*" = workspace-wide rules). */
  maskRules: Array<{ datasetId: string | null; column: MaskedColumn }>;
}

export function levelAllowed(classification: string, maxLevel: string): boolean {
  return (LEVEL_RANK[classification] ?? LEVEL_RANK.core) <= (LEVEL_RANK[maxLevel] ?? LEVEL_RANK.internal);
}

export function maskedColumnsFor(policy: EgressPolicy, datasetId: string): MaskedColumn[] {
  const byName = new Map<string, MaskedColumn>();
  for (const rule of policy.maskRules) {
    if (rule.datasetId === null || rule.datasetId === datasetId) {
      byName.set(rule.column.name, rule.column); // dataset-specific later rules override
    }
  }
  return [...byName.values()];
}

export async function resolveEgressPolicy(workspaceId: string): Promise<EgressPolicy> {
  const policies = await prisma.policy.findMany({
    where: { workspaceId, enabled: true, type: { in: ["access", "masking"] } },
    orderBy: { createdAt: "asc" },
  });

  let maxExternalLevel = DEFAULT_MAX_EXTERNAL;
  const maskRules: EgressPolicy["maskRules"] = [];

  for (const p of policies) {
    const cfg = (p.config ?? {}) as Record<string, unknown>;
    if (p.type === "access") {
      const lvl = cfg.maxExternalLevel;
      if (typeof lvl === "string" && lvl in LEVEL_RANK) maxExternalLevel = lvl;
    } else if (p.type === "masking") {
      const strategy = typeof cfg.strategy === "string" && STRATEGIES.has(cfg.strategy) ? cfg.strategy : "redact";
      const datasetId = typeof cfg.datasetId === "string" ? cfg.datasetId : null;
      const fields = Array.isArray(cfg.fields) ? cfg.fields : [];
      for (const f of fields) {
        if (typeof f === "string" && IDENT.test(f)) {
          maskRules.push({ datasetId, column: { name: f, strategy } });
        }
      }
    }
  }

  return { maxExternalLevel, maskRules };
}
