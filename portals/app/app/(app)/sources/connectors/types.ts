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
}
