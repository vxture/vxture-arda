"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { EntrySessionContext, fetchSession, ssoStartUrl, type SessionResponse } from "./api";
import { EntryScreen, type EntryState } from "./entry/entry-screen";
import { sessionScope } from "./entry/state";

/** Shared session boundary. Recovery retains the same member's mounted work. */
export function AccountGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [phase, setPhase] = useState<EntryState>("connecting");
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scope = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const inflight = useRef<Promise<SessionResponse | null> | null>(null);
  const alive = useRef(true);
  const lastInteractionCheck = useRef(0);

  const recheck = useCallback((): Promise<SessionResponse | null> => {
    if (inflight.current) return inflight.current;
    const abort = new AbortController(); controller.current = abort;
    const operation = (async () => {
      try {
        const next = await fetchSession(abort.signal);
        if (!alive.current || abort.signal.aborted) return null;
        if (next.authenticated) {
          const nextScope = sessionScope(next.user);
          if (scope.current !== null && scope.current !== nextScope) {
            // Never resume an old server payload or drafts under a different identity/scope.
            setReady(false); setMounted(false); window.location.reload(); return null;
          }
          scope.current = nextScope;
          setSession(next); setReady(true); setMounted(true);
          setRevision(n => n + 1);
        } else {
          setSession(next); setReady(false);
          setPhase(scope.current ? "recovery" : next.signedOut ? "signedout" : "signin");
        }
        return next;
      } catch {
        if (!alive.current || abort.signal.aborted) return null;
        setReady(false); setPhase("unavailable");
        return null;
      } finally { if (controller.current === abort) inflight.current = null; }
    })();
    inflight.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    alive.current = true;
    void recheck();
    const checkVisible = () => { if (document.visibilityState === "visible") void recheck(); };
    const invalid = () => { setReady(false); setPhase("recovery"); void recheck(); };
    const interaction = () => {
      if (Date.now() - lastInteractionCheck.current < 30_000) return;
      lastInteractionCheck.current = Date.now();
      checkVisible();
    };
    window.addEventListener("focus", checkVisible);
    window.addEventListener("storage", checkVisible);
    window.addEventListener("arda:session-invalid", invalid);
    document.addEventListener("visibilitychange", checkVisible);
    // Accounts status is checked on return/activity, not by background timers.
    window.addEventListener("pointerdown", interaction, { passive: true });
    window.addEventListener("keydown", interaction);
    return () => {
      alive.current = false; controller.current?.abort(); inflight.current = null;
      window.removeEventListener("pointerdown", interaction);
      window.removeEventListener("keydown", interaction);
      window.removeEventListener("focus", checkVisible);
      window.removeEventListener("storage", checkVisible);
      window.removeEventListener("arda:session-invalid", invalid);
      document.removeEventListener("visibilitychange", checkVisible);
    };
  }, [recheck]);

  function login() {
    if (scope.current) {
      window.open(ssoStartUrl(), "_blank", "noopener,noreferrer");
      setPhase("recovery");
    } else {
      setPhase("restoring"); window.location.assign(ssoStartUrl());
    }
  }

  return <EntrySessionContext.Provider value={{ loading: phase === "connecting" && !session, session, revision, recheck }}>
    {mounted && <div hidden={!ready} inert={!ready}>{children}</div>}
    {!ready && <EntryScreen state={phase} user={session?.authenticated ? session.user : undefined}
      onLogin={["signin", "signedout", "recovery"].includes(phase) ? login : undefined}
      onRetry={["recovery", "unavailable"].includes(phase) ? async () => { await recheck(); } : undefined} />}
  </EntrySessionContext.Provider>;
}
