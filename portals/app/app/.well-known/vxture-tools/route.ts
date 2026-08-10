/**
 * GET /.well-known/vxture-tools
 *
 * L0 tool protocol discovery endpoint (product_210_tool-protocol.md v1.0).
 * Serves arda's agent-facing tool manifest: TASK-ORIENTED, coarse tools over
 * the /api/v1 surface (arda_data_180) - deliberately NOT a 1:1 CRUD mirror,
 * because tool-count inflation is the most common agent-integration failure.
 *
 * The unified entry (RunOS) pulls this manifest and renders the tools as MCP;
 * `endpoint` + `openapi`/`operationId` bind every tool to the machine-readable
 * contract served at /openapi/arda-v1.yaml. Calls authenticate with a
 * workspace-bound API key (x-arda-api-key) carrying the tool's `scope`;
 * workspace isolation, entitlement, rate limits and idempotency semantics are
 * enforced server-side per arda_data_180 and never delegated to the caller.
 */

import { NextResponse } from "next/server";

const OPENAPI_PATH = "/openapi/arda-v1.yaml";

const TOOLS = [
  {
    name: "arda_search_datasets",
    description:
      "Search the data catalog of the caller's workspace (plus read-only platform reference assets). Filter by free text, domain, classification or type; cursor-paginated.",
    endpoint: { method: "GET", path: "/api/v1/datasets" },
    operationId: "listDatasets",
    scope: "catalog:read",
  },
  {
    name: "arda_get_dataset_profile",
    description:
      "Full profile of one dataset: base metadata plus source, tags, standards, linked services, derived quality summary and lineage degree. Use after arda_search_datasets to inspect a candidate.",
    endpoint: { method: "GET", path: "/api/v1/datasets/{id}" },
    operationId: "getDataset",
    scope: "catalog:read",
  },
  {
    name: "arda_check_data_quality",
    description:
      "Quality check runs (newest first) for the workspace, filterable by dataset, rule or status; pair with /api/v1/quality-rules (same scope) to read rule definitions.",
    endpoint: { method: "GET", path: "/api/v1/quality-results" },
    operationId: "listQualityResults",
    scope: "quality:read",
  },
  {
    name: "arda_get_lineage",
    description:
      "Curated dataset-level lineage of the workspace as an edge list plus dataset name map; optionally narrowed to edges touching one dataset. Caps at 500 edges (reported via `truncated`).",
    endpoint: { method: "GET", path: "/api/v1/lineage" },
    operationId: "getLineage",
    scope: "lineage:read",
  },
  {
    name: "arda_register_dataset",
    description:
      "Catalog a dataset the calling agent produced. Provenance (ownerApp) is stamped from the API key's consumerApp, never from the body; subject to the workspace dataset quota. Supports Idempotency-Key.",
    endpoint: { method: "POST", path: "/api/v1/datasets" },
    operationId: "createDataset",
    scope: "catalog:write",
  },
  {
    name: "arda_declare_lineage",
    description:
      "Record one upstream->downstream lineage edge between two workspace datasets (cycles and duplicates rejected). Supports Idempotency-Key.",
    endpoint: { method: "POST", path: "/api/v1/lineage" },
    operationId: "createLineageEdge",
    scope: "lineage:write",
  },
  {
    name: "arda_request_access",
    description:
      "File a data access / sharing request for a workspace dataset; it lands in the human approval center as pending. Supports Idempotency-Key.",
    endpoint: { method: "POST", path: "/api/v1/access-requests" },
    operationId: "createAccessRequest",
    scope: "access:write",
  },
] as const;

export async function GET() {
  return NextResponse.json({
    product: "arda",
    version: "v1",
    openapi: OPENAPI_PATH,
    auth: {
      type: "api_key",
      header: "x-arda-api-key",
      description:
        "Workspace-bound API key minted by a workspace admin; each tool requires its `scope` on the key (fail-closed).",
    },
    conventions: {
      errors: "RFC 9457 application/problem+json with stable snake_case `code`",
      pagination: "cursor-based (`limit` + `cursor`, `nextCursor` in responses)",
      idempotency: "optional Idempotency-Key header on every POST",
    },
    tools: TOOLS,
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
