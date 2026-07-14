/**
 * Source connector contract (I-BL1, biz-410 §2 process ring).
 *
 * A connector knows how to test a connection and read metadata (never data)
 * from one source type. arda is a broker: content bytes never enter arda
 * (data-150 D6) - connectors introspect schemas, they do not move rows.
 */

export interface ConnectionTestResult {
  ok: boolean;
  /** Short machine reason on failure (timeout | auth | unreachable | blocked | error). */
  reason?: string;
}

/** One catalogable object discovered in the source (table/view/object). */
export interface DiscoveredDataset {
  /** Stable identity WITHIN the source (e.g. "public.orders"). */
  sourceLocalId: string;
  name: string;
  type: "table" | "view" | "file" | "stream";
  location: string;
  rowCountEst: bigint | null;
  sizeBytes: bigint | null;
}

export interface SourceConnector {
  test(config: unknown): Promise<ConnectionTestResult>;
  /** Introspect metadata. Throws on connection failure (caller audits sync.fail). */
  pullMetadata(config: unknown): Promise<DiscoveredDataset[]>;
  /** Execute quality checks in-source (pushdown). Optional: types without it
   *  cannot run checks (explicit unsupported, no pretending). Throws on
   *  connection failure; per-check errors come back in the outcome. */
  checkQuality?(config: unknown, checks: QualityCheckSpec[]): Promise<QualityCheckOutcome[]>;
}

// ---- Quality check execution (Q-BL1) -----------------------------------------
// Checks run IN the source (pushdown SQL): arda never pulls rows, only the
// aggregate outcome comes back (broker principle, data-150 D6).

export interface QualityCheckSpec {
  ruleId: string;
  /** not_null | unique | range | freshness | row_count */
  type: string;
  /** "schema.table" (Dataset.location). */
  location: string;
  /** Parsed rule config (column names pre-validated by the caller). */
  config: Record<string, unknown>;
}

export interface QualityCheckOutcome {
  ruleId: string;
  /** Rows violating the rule (or 1 for boolean checks like freshness). */
  issues: number;
  /** Pass rate percent 0-100 where computable; null for boolean checks. */
  score: number | null;
  /** Rows examined (0 = empty relation; boolean checks report 0). */
  total: number;
  /** Set when the check could not run (bad config, missing column...). */
  error?: string;
}
