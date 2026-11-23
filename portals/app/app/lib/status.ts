export type StatusMode = "off" | "public" | "authed";

export function statusMode(env: Record<string, string | undefined>): StatusMode {
  const mode = (env.STATUS_PAGE ?? "public").toLowerCase();
  return mode === "off" || mode === "authed" ? mode : "public";
}

export interface PublicStatus {
  status: "operational" | "degraded" | "unavailable";
  updatedAt: string;
}

type PrepareStatus = () => Promise<{ database: boolean; redis: boolean }>;

// One refresh per interval per app process, shared by the HTML page and API.
// No timer runs in the background, and simultaneous requests share a refresh.
export function createStatusReader(check: PrepareStatus, ttl = 30_000, now = Date.now) {
  let cached: { value: PublicStatus; expiresAt: number } | undefined;
  let pending: Promise<PublicStatus> | undefined;

  return (): Promise<PublicStatus> => {
    if (cached && now() < cached.expiresAt) return Promise.resolve(cached.value);
    if (pending) return pending;

    pending = Promise.resolve().then(check).then(({ database, redis }): PublicStatus["status"] =>
      database && redis ? "operational" : database || redis ? "degraded" : "unavailable",
    ).catch((): PublicStatus["status"] => "unavailable").then((status) => {
      const checkedAt = now();
      const value = { status, updatedAt: new Date(checkedAt).toISOString() };
      cached = { value, expiresAt: checkedAt + ttl };
      return value;
    }).finally(() => { pending = undefined; });

    return pending;
  };
}
