import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { resolveIdentity } from "../../auth/lib/session";
import { getIdentity, getTokens } from "../../auth/lib/session-store";
import { getEventBus, sessionTarget, workspaceTarget, type Invalidation } from "../../events/bus";
import { reserveAccessStream } from "../../events/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Accel-Buffering": "no" };

export async function GET(req: Request): Promise<Response> {
  const cfg = getOidcConfig();
  if (!cfg || process.env.NODE_ENV !== "production" && process.env.MOCK_AUTH === "true") return new Response(null, { status: 204, headers });
  // Same-origin cookie authentication. No tokens, session IDs or workspace IDs
  // are accepted from query parameters. The stream carries invalidation only.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin
    || req.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403, headers });
  const rpsid = (await cookies()).get(cfg.cookieName)?.value;
  if (!rpsid) return new Response(null, { status: 401, headers });
  let stop: (() => void) | undefined;
  let release: (() => void) | undefined;
  try {
    const { identity: user } = await resolveIdentity(cfg, rpsid);
    if (!user) return new Response(null, { status: 401, headers });
    if (!user.active_workspace) return new Response(null, { status: 204, headers });
    const ws = user.active_workspace;
    release = reserveAccessStream(rpsid) ?? undefined;
    if (!release) return new Response(null, { status: 429, headers: { ...headers, "Retry-After": "30" } });
    const bus = getEventBus();
    const fingerprint = (identity: typeof user) => createHash("sha256").update(JSON.stringify([identity.sub, identity.active_org, identity.active_workspace,
      [...identity.roles].sort(), identity.account_status])).digest("hex");
    const context = fingerprint(user);
    const queue: Invalidation[] = [];
    let deliver: ((event: Invalidation) => void) | undefined;
    let lost = false;
    let disconnect: (() => void) | undefined;
    const unsubscribe = await bus.listen(event => {
      if (event.target !== workspaceTarget(ws) && event.target !== sessionTarget(rpsid)) return;
      if (deliver) deliver(event); else if (queue.length < 32) queue.push(event); else { lost = true; disconnect?.(); }
    }, () => { lost = true; disconnect?.(); });
    stop = () => { unsubscribe(); release?.(); };
    const [session, tokens] = await Promise.all([getIdentity(cfg, rpsid), getTokens(cfg, rpsid)]);
    if (!session || !tokens) { stop(); return new Response(null, { status: 401, headers }); }
    if (fingerprint(session) !== context) { stop(); return new Response(null, { status: 409, headers }); }
    const revision = await bus.version(ws);
    if (lost || req.signal.aborted) { stop(); return new Response(null, { status: 503, headers }); }
    const encoder = new TextEncoder();
    let cleanup = () => { stop?.(); };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let heartbeat: ReturnType<typeof setInterval>;
        let deadline: ReturnType<typeof setTimeout>;
        const finish = () => {
          if (closed) return;
          closed = true; clearInterval(heartbeat); clearTimeout(deadline); stop?.();
          req.signal.removeEventListener("abort", finish);
          try { controller.close(); } catch { /* reader already cancelled */ }
        };
        cleanup = finish; disconnect = finish;
        const send = (data: object) => {
          if (closed) return;
          if ((controller.desiredSize ?? 0) < -16) { finish(); return; }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };
        deliver = event => {
          if (event.kind === "refresh") { finish(); }
          else if (event.kind === "revoked") { send({ type: "revoked" }); finish(); }
          else send({ type: "changed", revision: event.revision, context });
        };
        send({ type: "ready", revision, context });
        for (const event of queue) deliver(event);
        heartbeat = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(": keepalive\n\n"));
        }, 25000);
        // No authority check in the keepalive. Reauthenticate at token expiry
        // or at a bounded stream lifetime; this never calls C2 periodically.
        deadline = setTimeout(finish, Math.max(1000, Math.min(600000, tokens.access_exp * 1000 - Date.now())));
        if (closed) { clearInterval(heartbeat); clearTimeout(deadline); }
        if (req.signal.aborted) finish();
        else if (!closed) req.signal.addEventListener("abort", finish, { once: true });
      },
      cancel() { cleanup(); },
    });
    return new Response(stream, { headers: { ...headers, "Content-Type": "text/event-stream; charset=utf-8", Connection: "keep-alive" } });
  } catch { stop?.(); release?.(); return new Response(null, { status: 503, headers }); }
}
