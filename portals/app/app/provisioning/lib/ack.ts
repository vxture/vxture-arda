import { prisma } from "../../lib/db";
import { platformRequest, workspacePlatformContext } from "../../platform/client";
interface AckDependencies {
  state: (workspaceId: string) => Promise<{ status: string; wipedAt: Date | null; lastSeq?: number } | null>;
  report: (workspaceId: string, body: string) => Promise<Response>;
}
const defaults: AckDependencies = {
  state: async workspaceId => {
  const [ref, watermark] = await Promise.all([
    prisma.workspaceRef.findUnique({ where: { id: workspaceId } }),
    prisma.provisionSeq.findUnique({ where: {
      workspaceId_productCode: { workspaceId, productCode: "arda" },
    } }),
  ]);
    return ref ? { status: ref.status, wipedAt: ref.wipedAt, lastSeq: watermark?.lastSeq } : null;
  },
  report: async (workspaceId, body) => platformRequest("/provisioning/ack", await workspacePlatformContext(workspaceId), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body,
  }),
};
export async function acknowledgeProvisioning(workspaceId: string, seq: number, deliveryId?: string,
  deps: AckDependencies = defaults): Promise<void> {
  const current = await deps.state(workspaceId);
  if (current?.status !== "provisioned" || current.wipedAt || current.lastSeq !== seq) return;
  const response = await deps.report(workspaceId, JSON.stringify({ workspace_id: workspaceId,
    product: "arda", status: "ready", ...(deliveryId ? { delivery_id: deliveryId } : {}), detail: { seq } }));
  if (!response.ok) throw new Error(`provisioning_ack_${response.status}`);
  const value = await response.json();
  if (value?.workspace_id !== workspaceId || value.product !== "arda"
    || typeof value.replayed !== "boolean" || typeof value.acked_at !== "string"
    || !Number.isFinite(Date.parse(value.acked_at))) throw new Error("provisioning_ack_invalid");
}
