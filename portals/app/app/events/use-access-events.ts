"use client";
import { useEffect, useState } from "react";
import { parseAccessEvent } from "./protocol";
import { AccessCursor, accessSynchronizer } from "./coordinator";

// Timers reconnect a broken transport; none polls session or entitlement.
export function useAccessEvents(enabled: boolean, check: () => Promise<unknown>, invalidate: () => void) {
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const lifetime = new AbortController();
    let connection: AbortController | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const cursor = new AccessCursor();
    const synchronize = accessSynchronizer(check, () => !lifetime.signal.aborted);
    const connect = async (attempt = 0) => {
      if (lifetime.signal.aborted) return;
      connection = new AbortController();
      const handshakeTimeout = setTimeout(() => connection?.abort(), 15000);
      try {
        const response = await fetch("/api/events", { cache: "no-store", signal: connection.signal,
          headers: { Accept: "text/event-stream" } });
        clearTimeout(handshakeTimeout);
        if (response.status === 204) return;
        if ([401, 409].includes(response.status)) { invalidate(); return; }
        if (!response.ok || !response.body || !response.headers.get("content-type")?.startsWith("text/event-stream")) throw new Error("events_unavailable");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 16384) throw new Error("event_buffer_limit");
          let end: number;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            if (!frame.startsWith("data: ")) continue;
            const event = parseAccessEvent(frame.slice(6));
            attempt = 0;
            if (event.type === "revoked") { invalidate(); return; }
            const changed = cursor.accept(event);
            setRecovering(false);
            if (changed) void synchronize().catch(() => { setRecovering(true); connection?.abort(); });
          }
        }
      } catch { if (!lifetime.signal.aborted) setRecovering(true); }
      finally { clearTimeout(handshakeTimeout); connection?.abort(); }
      if (!lifetime.signal.aborted) {
        retry = setTimeout(() => void connect(attempt + 1), Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)) + Math.random() * 500);
      }
    };
    void connect();
    return () => { lifetime.abort(); connection?.abort(); clearTimeout(retry); };
  }, [enabled, check, invalidate]);
  return recovering;
}
