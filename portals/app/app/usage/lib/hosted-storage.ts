/** Logical UTF-8 payload bytes actually hosted in Arda's catalog.
 * External Dataset.sizeBytes is descriptive metadata, never hosted capacity.
 * Indexes, database overhead, internal delivery ledgers and compliance audit
 * are service costs, not another copy charged to the tenant. Future object
 * storage must add an authoritative committed-object ledger to this total.
 */
const HOSTED_TABLES = [
  "Dataset", "Tag", "DatasetTag", "GlossaryTerm", "DataSource", "Policy",
  "AccessRequest", "QualityRule", "QualityResult", "Standard", "LineageEdge",
  "DataService", "DatasetStandard", "DataServiceDataset",
] as const;

// Identifiers are compile-time constants; workspace identity is a bound value.
export const HOSTED_STORAGE_SQL = `SELECT COALESCE(SUM(bytes), 0)::bigint AS bytes FROM (
${HOSTED_TABLES.map(table => `SELECT COALESCE(SUM(octet_length(to_jsonb(r)::text)), 0) AS bytes
FROM catalog."${table}" r WHERE r."workspaceId" = $1`).join("\nUNION ALL\n")}
) hosted`;

export function hostedByteCount(value: bigint | number | string): number {
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("storage_gauge_invalid");
  return bytes;
}
