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
  /** Fetch governed rows with masking PUSHED DOWN into the source query
   *  (Sec-BL1). Optional; limit is clamped by the implementation. Throws on
   *  connection failure. */
  fetchGovernedRows?(
    config: unknown,
    location: string,
    masked: MaskedColumn[],
    limit: number,
  ): Promise<GovernedRowsResult>;
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

// ---- Governed row egress (Sec-BL1/BL2 + Svc-BL1) -----------------------------
// The gateway serves LIVE rows through arda as a pass-through proxy: masking is
// pushed down into the source query (masked columns never leave the source in
// clear), nothing is persisted in arda (data-150: bytes may transit, never rest).

export interface MaskedColumn {
  /** Validated column name. */
  name: string;
  /** redact | hash | partial */
  strategy: string;
}

export interface GovernedRowsResult {
  columns: string[];
  /** Which of the returned columns were masked (client transparency). */
  maskedColumns: string[];
  rows: Array<Record<string, unknown>>;
}
