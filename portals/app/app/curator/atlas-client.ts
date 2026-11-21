// The Atlas chat client for arda Curator (ADR-013 / arda-biz-270). Atlas is
// L1 infrastructure (repo vxture-atlas) - the platform's sole
// model-inference/metering gateway; every product (karda, arda, ...)
// consumes models through it, never directly. Atlas reports raw input/output/
// cache-write/cache-read tokens attributed to Arda; the platform converts
// them into credits. Arda never duplicates inference metering (issue214). So
// Atlas has its OWN base (ATLAS_BASE_URL, NOT PLATFORM_API_URL) and its OWN
// auth: an S2S token-exchange bearer (aud=atlas), NOT the C2/C3
// x-vxture-internal-auth header. The bearer is minted per (org, ws) by
// atlas-token.ts.
//
// Client stays inactive (getCuratorAtlasClient -> null) until ATLAS_BASE_URL
// is set, so the Curator is honestly not-implemented rather than failing at
// call time - mirrors vxture-karda's kb/retrieval/generation.ts posture.
import { assertInternalTarget } from "../lib/internal-target";
import { getAtlasTokenSource, type AtlasTokenSource } from "./atlas-token";

export interface ChatRequest {
  tenantId: string;
  workspaceId: string;
  taskId: string;
  endpointCode?: string;
  modelCode?: string;
  taskProfile?: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}

export interface ChatResponse {
  content: string;
}

export interface AtlasClientConfig {
  baseUrl: string;
  chatPath: string;
  /** Mints the aud=atlas bearer per (org, ws); see atlas-token.ts. */
  tokenSource: AtlasTokenSource;
}

type FetchLike = typeof fetch;

export const DEFAULT_ATLAS_CHAT_PATH = "/v1/chat";

export class AtlasRequestError extends Error {
  constructor(public status: number, public code: string, public retryable: boolean,
    public retryAfterMs?: number) { super(`atlas_${code}`); }
}

export class CuratorAtlasClient {
  constructor(
    private cfg: AtlasClientConfig,
    private fetchImpl: FetchLike = fetch,
  ) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (!req.tenantId || !req.workspaceId || !req.taskId) throw new Error("atlas_context_required");
    if ([req.endpointCode, req.modelCode, req.taskProfile].filter(Boolean).length !== 1) {
      throw new Error("atlas_route_required");
    }
    if (!this.cfg.chatPath.startsWith("/") || this.cfg.chatPath.startsWith("//")) throw new Error("atlas_path_invalid");
    const url = `${this.cfg.baseUrl.replace(/\/$/, "")}${this.cfg.chatPath}`;
    assertInternalTarget(url); // egress guard: cleartext http only to loopback/private/tailnet
    const token = await this.cfg.tokenSource.tokenFor({ org: req.tenantId, ws: req.workspaceId });
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      // Atlas owns AI metering. Arda never sends a second consume for this call.
      body: JSON.stringify({ ...req, stream: false, timeoutMs: 60_000 }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(65_000),
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const error = body as Record<string, unknown> | null;
      const code = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : "UNAVAILABLE";
      const retryAfterMs = typeof error?.retryAfterMs === "number" && Number.isFinite(error.retryAfterMs)
        && error.retryAfterMs >= 0 ? error.retryAfterMs : undefined;
      throw new AtlasRequestError(res.status, code, error?.retryable === true, retryAfterMs);
    }
    const content = extractContent(body);
    if (content === null) throw new Error("atlas chat: no content in response");
    return { content };
  }
}

/** Tolerant content extraction across the shapes a chat endpoint might return. */
export function extractContent(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (typeof o.content === "string") return o.content;
  if (typeof o.answer === "string") return o.answer;
  const msg = o.message as Record<string, unknown> | undefined;
  if (msg && typeof msg.content === "string") return msg.content;
  const choices = o.choices as { message?: { content?: unknown } }[] | undefined;
  if (Array.isArray(choices) && typeof choices[0]?.message?.content === "string") {
    return choices[0].message!.content as string;
  }
  return null;
}

/**
 * The Curator's Atlas client, or null when it cannot run yet. Activates only
 * when ATLAS_BASE_URL is set AND arda has OIDC client creds to mint the
 * bearer (getAtlasTokenSource); null keeps the Curator honestly
 * not-implemented rather than failing at call time. Chat path defaults to
 * the known Atlas route and is overridable via ATLAS_CHAT_PATH.
 */
export function getCuratorAtlasClient(): CuratorAtlasClient | null {
  const baseUrl = process.env.ATLAS_BASE_URL;
  const tokenSource = getAtlasTokenSource();
  if (!baseUrl || !tokenSource) return null;
  const chatPath = process.env.ATLAS_CHAT_PATH || DEFAULT_ATLAS_CHAT_PATH;
  return new CuratorAtlasClient({ baseUrl, chatPath, tokenSource });
}

export interface CuratorModelSelection {
  endpointCode?: string;
  modelCode?: string;
  taskProfile?: string;
}

/**
 * How the Curator picks a model on Atlas. Exactly one field is emitted so
 * operators can repoint a granted endpoint without a caller release.
 * Prefer ENDPOINT, then the legacy tenant TASK_PROFILE, then pinned MODEL.
 * Missing configuration fails instead of inventing a model called default.
 */
export function curatorModelSelection(): CuratorModelSelection {
  const endpointCode = process.env.ATLAS_CURATOR_ENDPOINT;
  if (endpointCode) return { endpointCode };
  const taskProfile = process.env.ATLAS_CURATOR_TASK_PROFILE;
  if (taskProfile) return { taskProfile };
  const modelCode = process.env.ATLAS_CURATOR_MODEL;
  if (modelCode) return { modelCode };
  throw new Error("atlas_route_unconfigured");
}
