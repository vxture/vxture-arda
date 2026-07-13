import type { DiscoveredDataset } from "./connectors/types";

/**
 * Pure planning core for a metadata sync (I-BL1): decide which discovered
 * objects become new Datasets, which update existing ones, and which are
 * skipped by the plan cap. Kept side-effect free so the quota/dedup rules
 * are testable without a database.
 *
 * Vanished objects are NOT deleted: a table disappearing upstream must not
 * destroy governance state hanging off its Dataset (rules/lineage/services).
 * Staleness shows via lastSyncedAt; lifecycle handling is biz-451's ring.
 */

export interface SyncPlan {
  toCreate: DiscoveredDataset[];
  toUpdate: DiscoveredDataset[];
  skippedByQuota: number;
}

/** Deterministic workspace-unique Dataset code: <source-slug>.<schema.object>. */
export function datasetCode(sourceName: string, sourceLocalId: string): string {
  const slug = sourceName
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "source"}.${sourceLocalId.toLowerCase()}`;
}

export function planSync(
  discovered: DiscoveredDataset[],
  existingCodes: ReadonlySet<string>,
  sourceName: string,
  datasetMax: number | null,
  datasetsInWorkspace: number,
): SyncPlan {
  const toCreate: DiscoveredDataset[] = [];
  const toUpdate: DiscoveredDataset[] = [];
  let skippedByQuota = 0;

  // Updates never consume quota; only net-new Datasets count against the cap.
  let capacity = datasetMax === null ? Number.POSITIVE_INFINITY : Math.max(0, datasetMax - datasetsInWorkspace);

  for (const d of discovered) {
    if (existingCodes.has(datasetCode(sourceName, d.sourceLocalId))) {
      toUpdate.push(d);
    } else if (capacity > 0) {
      toCreate.push(d);
      capacity -= 1;
    } else {
      skippedByQuota += 1;
    }
  }

  return { toCreate, toUpdate, skippedByQuota };
}
