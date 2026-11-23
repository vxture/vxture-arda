// Per-process admission bounds. Never evict an existing identity's connection.
const active = new Map<string, number>();
let total = 0;
export function reserveAccessStream(session: string): (() => void) | null {
  const count = active.get(session) ?? 0;
  if (count >= 8 || total >= 512) return null;
  active.set(session, count + 1); total++;
  let released = false;
  return () => {
    if (released) return;
    released = true; total--;
    const left = (active.get(session) ?? 1) - 1;
    if (left) active.set(session, left); else active.delete(session);
  };
}
