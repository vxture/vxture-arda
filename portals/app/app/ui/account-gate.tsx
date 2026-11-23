"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { EntrySessionContext, fetchSession, ssoStartUrl, type SessionResponse } from "./api";
import { EntryScreen, type EntryState } from "./entry/entry-screen";
import { sessionScope } from "./entry/state";
import { useAccessEvents } from "../events/use-access-events";
import { useLocale } from "@arda/shared/locale-provider";

/** Shared session boundary. Recovery retains the same member's mounted work. */
export function AccountGate({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [phase, setPhase] = useState<EntryState>("connecting");
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scope = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const inflight = useRef<Promise<SessionResponse | null> | null>(null);
  const alive = useRef(true);
  const invalidationEpoch = useRef(0);
  const recoveryChannel = useRef<BroadcastChannel | null>(null);
  const announced = useRef(false);

  const recheck = useCallback((): Promise<SessionResponse | null> => {
    if (inflight.current) return inflight.current;
    const epoch = invalidationEpoch.current;
    const abort = new AbortController(); controller.current = abort;
    const operation = (async () => {
      try {
        const next = await fetchSession(abort.signal);
        if (!alive.current || abort.signal.aborted || invalidationEpoch.current !== epoch) return null;
        if (next.authenticated) {
          const nextScope = sessionScope(next.user);
          if (scope.current !== null && scope.current !== nextScope) {
            // Never resume an old server payload or drafts under a different identity/scope.
            setReady(false); setMounted(false); window.location.reload(); return null;
          }
          scope.current = nextScope;
          setSession(next); setReady(true); setMounted(true);
          setRevision(n => n + 1);
          if (!announced.current) {
            announced.current = true;
            recoveryChannel.current?.postMessage({ type: "session-established" });
          }
        } else {
          setSession(next); setReady(false);
          setPhase(scope.current ? "recovery" : next.signedOut ? "signedout" : "signin");
        }
        return next;
      } catch {
        if (!alive.current || abort.signal.aborted || invalidationEpoch.current !== epoch) return null;
        setReady(false); setPhase("unavailable");
        return null;
      } finally { if (controller.current === abort) inflight.current = null; }
    })();
    inflight.current = operation;
    return operation;
  }, []);

  const invalid = useCallback(() => {
    // A response started before revocation must not reopen the old interface.
    invalidationEpoch.current++;
    controller.current?.abort(); inflight.current = null;
    setReady(false); setPhase("recovery"); void recheck();
  }, [recheck]);
  const recovering = useAccessEvents(Boolean(session?.authenticated && ready), recheck, invalid);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    // Same-origin login recovery only. The message carries no identity and
    // grants nothing: the receiving tab must reread its server-side session.
    const channel = new BroadcastChannel("arda:session-recovery");
    recoveryChannel.current = channel;
    channel.onmessage = event => { if (event.data?.type === "session-established") void recheck(); };
    return () => { channel.close(); recoveryChannel.current = null; };
  }, [recheck]);

  useEffect(() => {
    alive.current = true;
    void recheck();
    window.addEventListener("arda:session-invalid", invalid);
    return () => {
      alive.current = false; controller.current?.abort(); inflight.current = null;
      window.removeEventListener("arda:session-invalid", invalid);
    };
  }, [recheck, invalid]);

  function login() {
    if (scope.current) {
      window.open(ssoStartUrl(), "_blank", "noopener,noreferrer");
      setPhase("recovery");
    } else {
      setPhase("restoring"); window.location.assign(ssoStartUrl());
    }
  }

  return <EntrySessionContext.Provider value={{ loading: phase === "connecting" && !session, session, revision, recheck }}>
    {ready && recovering && <p role="status">{locale === "en-US" ? "Connection interrupted. Reconnecting..." : "\u8fde\u63a5\u6682\u65f6\u4e2d\u65ad\uff0c\u6b63\u5728\u6062\u590d\u2026"}</p>}
    {mounted && <div hidden={!ready} inert={!ready}>{children}</div>}
    {!ready && <EntryScreen state={phase} user={session?.authenticated ? session.user : undefined}
      onLogin={["signin", "signedout", "recovery"].includes(phase) ? login : undefined}
      onRetry={["recovery", "unavailable"].includes(phase) ? async () => { await recheck(); } : undefined} />}
  </EntrySessionContext.Provider>;
}
