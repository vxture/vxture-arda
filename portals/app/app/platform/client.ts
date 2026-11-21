/** Product-side adapter over existing runtime configuration; no server configuration writes. */
import { assertInternalTarget } from "../lib/internal-target";
import { getPlatformTicketSource, type PlatformContext } from "./ticket";

export async function workspacePlatformContext(workspaceId: string): Promise<PlatformContext> {
  if (!workspaceId) throw new Error("workspace required");
  // Background callers use only the trusted local platform reference, never request-body org IDs.
  const { prisma } = await import("../lib/db");
  const ref = await prisma.workspaceRef.findUnique({ where: { id: workspaceId }, select: { orgId: true } });
  if (!ref?.orgId) throw new Error("platform_workspace_reference_required");
  return { orgId: ref.orgId, workspaceId };
}

export async function platformRequest(path: string, context: PlatformContext, init: RequestInit = {}): Promise<Response> {
  const base = process.env.PLATFORM_API_URL;
  if (!base) throw new Error("platform_api_unconfigured");
  assertInternalTarget(base);
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("invalid_platform_path");
  const token = await getPlatformTicketSource().tokenFor(context);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  return fetch(`${base.replace(/\/+$/, "")}${path}`, {
    ...init, headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
  });
}
