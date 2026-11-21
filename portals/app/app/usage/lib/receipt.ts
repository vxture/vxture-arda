/** Only acknowledged reports may leave the durable outbox. Reserve rejections write no event. */
export interface ConsumeReceipt { gated: boolean; eventId?: string }
export async function consumeReceipt(response: Response): Promise<ConsumeReceipt> {
  if (response.status !== 200) throw new Error(`usage_report_http_${response.status}`);
  const body = await response.json() as Record<string, unknown>;
  if (!body || typeof body.consumed !== "number" || !Number.isFinite(body.consumed) || body.consumed < 0
    || typeof body.remaining_total !== "number" || !Number.isFinite(body.remaining_total)
    || body.gated !== undefined && typeof body.gated !== "boolean"
    || body.event_id !== undefined && typeof body.event_id !== "string") {
    throw new Error("usage_report_invalid_receipt");
  }
  return { gated: body.gated === true, eventId: body.event_id as string | undefined };
}
