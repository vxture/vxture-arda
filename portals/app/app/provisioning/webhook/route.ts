/**
 * C3 provisioning webhook receiver.
 * Endpoint: POST /provisioning/webhook
 *
 * Contract: identity-platform-rp-integration §5 (wire format) + handoff §2.
 * Platform delivers: headers x-vxture-event, x-vxture-delivery, x-vxture-signature.
 * Payload: { id, type, occurred_at, seq, workspace_id, tenant_id, application, plan, data }
 *
 * Obligations implemented here:
 *   1. HMAC-SHA256 signature verify (verifyWebhookSignature)
 *   2+3+4+5: idempotency / seq / event semantics / 2xx (handleProvisioningEvent)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignatureAny } from "../lib/verify";
import { handleProvisioningEvent } from "../lib/handler";
import { parseProvisioningPayload } from "../lib/payload";
import { acknowledgeProvisioning } from "../lib/ack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Dual rotation slot (080-rp SS4 / D3): the current secret plus an optional
  // PROVISION_WEBHOOK_SECRET_NEXT. During a platform-side rotation either may
  // sign the payload, so verify against each and accept on any match. Order
  // (current first) is a minor fast-path, not a security property.
  const secrets = [
    process.env.PROVISION_WEBHOOK_SECRET,
    process.env.PROVISION_WEBHOOK_SECRET_NEXT,
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  if (secrets.length === 0) {
    console.error("[provisioning/webhook] PROVISION_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());
  const sigHeader = request.headers.get("x-vxture-signature");

  const { ok, reason } = await verifyWebhookSignatureAny(rawBody, sigHeader, secrets);
  if (!ok) {
    console.warn(`[provisioning/webhook] signature rejected: ${reason}`);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let payload;
  try {
    payload = parseProvisioningPayload(JSON.parse(new TextDecoder().decode(rawBody)), request.headers);
  } catch {
    return NextResponse.json({ error: "invalid payload or headers" }, { status: 400 });
  }

  if (payload.application !== "arda") {
    return NextResponse.json({ error: "not for this application" }, { status: 400 });
  }

  try {
    const result = await handleProvisioningEvent(payload);
    if (payload.type === "tenant.provisioned" && result.outcome !== "ignored") {
      await acknowledgeProvisioning(payload.workspace_id, payload.seq!, payload.id);
    }
    return NextResponse.json({ outcome: result.outcome }, { status: 200 });
  } catch {
    // Retry after ACK failure dedups local changes, then retries the same ACK.
    console.error("[provisioning/webhook] processing unavailable; retry required");
    return NextResponse.json({ error: "provisioning unavailable" }, { status: 503 });
  }
}
