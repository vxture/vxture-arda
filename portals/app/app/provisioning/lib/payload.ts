/** Current platform wire contract: lifecycle has seq; notifications do not. */
import { z } from "zod";
const identifier = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const common = {
  id: identifier,
  occurred_at: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  workspace_id: identifier, tenant_id: identifier, application: z.literal("arda"),
  data: z.record(z.string(), z.unknown()).optional(),
};
const lifecycle = z.object({ ...common,
  type: z.enum(["tenant.provisioned", "tenant.deprovisioned"]),
  // PostgreSQL integer in the current local schema.
  seq: z.number().int().min(1).max(2_147_483_647),
  plan: z.string().min(1).max(200).nullable().optional(),
});
const notification = z.object({ ...common,
  type: z.enum(["subscription_changed", "grant.invalidated"]), seq: z.never().optional(),
});
export const payloadSchema = z.union([lifecycle, notification]);
export type ProvisioningPayload = z.infer<typeof payloadSchema>;
export function parseProvisioningPayload(value: unknown, headers: Headers): ProvisioningPayload {
  const payload = payloadSchema.parse(value);
  for (const [header, expected] of [["x-vxture-delivery", payload.id], ["x-vxture-event", payload.type]]) {
    const actual = headers.get(header);
    if (actual !== null && actual !== expected) throw new Error("webhook_header_mismatch");
  }
  return payload;
}
