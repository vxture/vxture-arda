// The Atlas chat client for arda Curator (ADR-013 / arda-biz-270). Atlas is
// an INDEPENDENT vxture product (repo vxture-atlas) - the platform's sole
// model-inference/metering gateway; every product (karda, arda, ...)
// consumes models through it, never directly, and Atlas itself is the
// metering system of record for ai.credit (see entitlement/quota.ts). So
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
  workspaceId?: string;
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

export const DEFAULT_ATLAS_CHAT_PATH = "/model-platform/chat";

export class CuratorAtlasClient {
  constructor(
    private cfg: AtlasClientConfig,
    private fetchImpl: FetchLike = fetch,
  ) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const token = await this.cfg.tokenSource.tokenFor({ org: req.tenantId, ws: req.workspaceId ?? "" });
    const url = `${this.cfg.baseUrl.replace(/\/$/, "")}${this.cfg.chatPath}`;
    assertInternalTarget(url); // egress guard: cleartext http only to loopback/private/tailnet
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(req),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`atlas chat endpoint ${res.status}`);
    const body: unknown = await res.json().catch(() => null);
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
  modelCode?: string;
  taskProfile?: string;
}

/**
 * How the Curator picks a model on Atlas. Exactly one field is emitted so
 * there is no modelCode-vs-taskProfile precedence ambiguity (Atlas requires
 * at least one, and the two are alternatives):
 * - auto-adapt: if ATLAS_CURATOR_TASK_PROFILE is set, send that taskProfile
 *   label and let Atlas resolve a concrete model from the tenant's grant.
 * - pinned: otherwise send ATLAS_CURATOR_MODEL as an explicit modelCode.
 */
export function curatorModelSelection(): CuratorModelSelection {
  const taskProfile = process.env.ATLAS_CURATOR_TASK_PROFILE;
  if (taskProfile) return { taskProfile };
  return { modelCode: process.env.ATLAS_CURATOR_MODEL ?? "default" };
}
