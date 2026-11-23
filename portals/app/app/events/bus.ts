import Redis from "ioredis";
import { createHash } from "node:crypto";
import { getOidcConfig } from "../auth/lib/config";

export interface Invalidation { target: string; kind: "workspace" | "revoked" | "refresh"; revision?: string }
export function eventChannel(cid: string): string { return `vx:rp:${cid}:events`; }
export function workspaceTarget(ws: string): string { return `workspace:${createHash("sha256").update(ws).digest("hex")}`; }
export function sessionTarget(rpsid: string): string { return `session:${rpsid}`; }

// Durable versions plus atomic publish: pub/sub is a wake-up, never the only
// evidence of change. Reconnect reads the current version instead of replaying
// obsolete permission decisions. One shared subscription per Node process.
export class EventBus {
  private command: Redis;
  private subscriber: Redis;
  private listeners = new Set<{ event: (event: Invalidation) => void; lost: () => void }>();
  private subscribed: Promise<void> | null = null;
  constructor(endpoint: string, readonly cid: string, private readonly restore: (ws: string) => Promise<string> = async () => "0") {
    const opts = { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000, commandTimeout: 8000 };
    this.command = new Redis(endpoint, opts);
    this.subscriber = new Redis(endpoint, { ...opts, commandTimeout: undefined });
    this.command.on("error", () => {});
    this.subscriber.on("error", () => {});
    this.subscriber.on("message", (channel, raw) => {
      if (channel !== eventChannel(cid) || raw.length > 1024) return;
      try {
        const event = JSON.parse(raw) as Invalidation;
        if (typeof event.target !== "string" || !["workspace", "revoked", "refresh"].includes(event.kind)) return;
        for (const listener of [...this.listeners]) listener.event(event);
      } catch { /* malformed internal messages carry no authority */ }
    });
    this.subscriber.on("close", () => {
      this.subscribed = null;
      for (const listener of [...this.listeners]) listener.lost();
    });
  }
  private key(target: string) { return `${eventChannel(this.cid)}:revision:${target}`; }
  async version(ws: string): Promise<string> {
    const value = await this.command.get(this.key(workspaceTarget(ws)));
    if (value !== null) return value;
    const recovered = await this.restore(ws);
    if (recovered !== "0") await this.publishWorkspace(ws, recovered);
    else await this.command.set(this.key(workspaceTarget(ws)), "0", "NX");
    return await this.command.get(this.key(workspaceTarget(ws))) ?? "0";
  }
  async publishWorkspace(ws: string, revision: string): Promise<void> {
    if (!/^[1-9][0-9]{0,18}$/.test(revision)) throw new Error("invalid_access_revision");
    const target = workspaceTarget(ws);
    await this.command.eval(
      "local old=redis.call('get',KEYS[1]); "
      + "if old and (#old>#ARGV[1] or (#old==#ARGV[1] and old>=ARGV[1])) then return 0 end; "
      + "redis.call('set',KEYS[1],ARGV[1]); redis.call('publish',ARGV[2],ARGV[3]); return 1",
      1, this.key(target), revision, eventChannel(this.cid), JSON.stringify({ target, kind: "workspace", revision }));
  }
  async listen(event: (event: Invalidation) => void, lost: () => void): Promise<() => void> {
    const listener = { event, lost };
    this.listeners.add(listener);
    try {
      this.subscribed ??= this.subscriber.subscribe(eventChannel(this.cid)).then(() => {});
      await this.subscribed;
    } catch { this.listeners.delete(listener); this.subscribed = null; throw new Error("event_bus_unavailable"); }
    return () => { this.listeners.delete(listener); };
  }
  async close(): Promise<void> {
    this.listeners.clear();
    await Promise.all([this.command.quit(), this.subscriber.quit()]);
  }
}
let singleton: EventBus | null = null;
export function getEventBus(): EventBus {
  if (!process.env.REDIS_URL) throw new Error("event_redis_required");
  const cfg = getOidcConfig();
  if (!cfg) throw new Error("event_oidc_required");
  return singleton ??= new EventBus(process.env.REDIS_URL, cfg.clientId, async ws => {
    const { readWorkspaceRevision } = await import("./outbox");
    return readWorkspaceRevision(ws);
  });
}
