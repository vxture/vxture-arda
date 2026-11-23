export type AccessEvent = { type: "revoked" } | { type: "ready" | "changed"; revision: string; context: string };
export function parseAccessEvent(raw: string): AccessEvent {
  if (raw.length > 2048) throw new Error("event_too_large");
  const event = JSON.parse(raw) as AccessEvent;
  if (event.type === "revoked") return { type: "revoked" };
  if (!["ready", "changed"].includes(event.type) || !("context" in event)
    || !/^[a-f0-9]{64}$/.test(event.context)
    || !/^(0|[1-9][0-9]{0,18})$/.test(event.revision)) throw new Error("invalid_access_event");
  return event;
}
