"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { LOCALE_CONSTANTS } from "@vxture/shared";
import {
  ARDA_DEFAULT_LOCALE,
  ARDA_LOCALES,
  isArdaLocale,
  type ArdaLocale,
} from "./locales";
import { persistLocale } from "./preferences";

const LOCALE_CYCLE: ArdaLocale[] = [...ARDA_LOCALES]; // en-US -> zh-CN

interface LocaleContextValue {
  locale: ArdaLocale;
  setLocale: (locale: ArdaLocale) => void;
  toggle: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function getStoredLocale(): ArdaLocale {
  if (typeof window === "undefined") return ARDA_DEFAULT_LOCALE;
  const stored = localStorage.getItem(LOCALE_CONSTANTS.STORAGE_KEY);
  if (isArdaLocale(stored)) return stored;
  return ARDA_DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<ArdaLocale>(ARDA_DEFAULT_LOCALE);

  useEffect(() => {
    const initial = getStoredLocale();
    setLocaleState(initial);
    document.documentElement.lang = initial;
  }, []);

  const setLocale = (next: ArdaLocale) => {
    setLocaleState(next);
    // Mirror to the parent-domain cookie (+ localStorage + lang + broadcast) so
    // the choice syncs across every *.arda.vxture.com app.
    persistLocale(next);
  };

  const toggle = () => {
    const idx = LOCALE_CYCLE.indexOf(locale);
    const next = LOCALE_CYCLE[(idx + 1) % LOCALE_CYCLE.length];
    setLocale(next);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, toggle }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within <LocaleProvider>");
  return ctx;
}
