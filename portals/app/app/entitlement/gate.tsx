"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SUBSCRIPTION_STATUSES } from "@vxture/shared";
import { type Subscription } from "./types";
import { EntrySessionContext } from "../ui/api";
import { EntryScreen } from "../ui/entry/entry-screen";
import { accessState } from "../ui/entry/state";

const SubscriptionContext = createContext<Subscription | null>(null);
export function useSubscription(): Subscription | null { return useContext(SubscriptionContext); }

/** Errors remain unknown access; only an authoritative result can suggest purchase. */
export function EntitlementGate({ children }: { children: ReactNode }) {
  const account = useContext(EntrySessionContext);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [entered, setEntered] = useState(false);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const user = account?.session?.authenticated ? account.session.user : undefined;

  const check = useCallback(async () => {
    if (lock.current || !user) return;
    lock.current = true;
    const abort = new AbortController(); controller.current = abort;
    setChecking(true); setFailed(false);
    try {
      const res = await fetch("/api/entitlement", { credentials: "include", cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]) });
      if (res.status === 401) { window.dispatchEvent(new Event("arda:session-invalid")); throw new Error("session expired"); }
      if (!res.ok) throw new Error(`entitlement ${res.status}`);
      const next = await res.json() as Subscription;
      if (!next || !Object.hasOwn(next, "status") || (next.status !== null && !(SUBSCRIPTION_STATUSES as readonly string[]).includes(next.status))) throw new Error("invalid entitlement");
      if (!abort.signal.aborted) {
        setSubscription(next);
        if (accessState(next, user) === "connected") setEntered(true);
      }
    } catch { if (!abort.signal.aborted) { setFailed(true); setSubscription(null); } }
    finally { if (!abort.signal.aborted) setChecking(false); if (controller.current === abort) lock.current = false; }
  }, [user]);

  useEffect(() => { void check(); return () => { controller.current?.abort(); lock.current = false; }; }, [check, account?.revision]);

  const state = failed || !subscription || !user ? "access-unavailable" : accessState(subscription, user);
  const connected = !checking && state === "connected";
  return <>
    {entered && <div hidden={!connected} inert={!connected}><SubscriptionContext.Provider value={subscription}>{children}</SubscriptionContext.Provider></div>}
    {!connected && <EntryScreen state={checking || state === "connected" ? "checking-access" : state} user={user}
    onRetry={checking ? undefined : async () => { await account?.recheck(); }}
    // Workspace management alone does not grant organization billing authority.
    canManage={Boolean(user?.roles.some(role => role.trim().toLowerCase() === "org:owner"))} />}
  </>;
}
