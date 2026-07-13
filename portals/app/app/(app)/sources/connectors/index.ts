import { postgresConnector } from "./postgres";
import type { SourceConnector } from "./types";

/**
 * Connector registry. Types without a live connector register fine but
 * cannot sync yet - the sync action reports connector_unsupported instead
 * of pretending (no silent caps). Adding a connector = one entry here.
 */
const CONNECTORS: Partial<Record<string, SourceConnector>> = {
  postgres: postgresConnector,
};

export function getConnector(type: string): SourceConnector | null {
  return CONNECTORS[type] ?? null;
}
