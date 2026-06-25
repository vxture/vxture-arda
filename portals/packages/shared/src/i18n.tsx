"use client";

/**
 * i18n.tsx - tiny in-house translation layer for the Arda app.
 *
 * Strings live in independent per-locale JSON files; this module just selects
 * the active locale's bundle (driven by the shared `useLocale()`) and resolves
 * dot-path keys with `{var}` interpolation. No third-party i18n dependency. Add
 * a locale by dropping another JSON file into `messages/` and listing it in
 * `messages/index.ts`.
 */

import { createContext, useContext, type ReactNode } from "react";
import { ARDA_DEFAULT_LOCALE, type ArdaLocale } from "./locales";
import { useLocale } from "./locale-provider";

/** A namespaced, possibly-nested bundle of strings for one locale. */
export type Messages = Record<string, unknown>;

const MessagesContext = createContext<Messages>({});

/**
 * Provides the active locale's message bundle to `useTranslations`. Must render
 * inside the shared `LocaleProvider` (it reads `useLocale()`); pass the app's
 * full `{ "en-US": ..., "zh-CN": ... }` map.
 */
export function I18nProvider({
  messages,
  children,
}: {
  messages: Partial<Record<ArdaLocale, Messages>>;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const active = messages[locale] ?? messages[ARDA_DEFAULT_LOCALE] ?? {};
  return (
    <MessagesContext.Provider value={active}>
      {children}
    </MessagesContext.Provider>
  );
}

function resolve(messages: Messages, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (
      acc != null &&
      typeof acc === "object" &&
      part in (acc as Record<string, unknown>)
    ) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

export interface TranslateFn {
  /** Resolve a string key (within the namespace), interpolating `{var}`. */
  (key: string, vars?: Record<string, string | number>): string;
  /** Raw (non-string) value at a key - arrays / objects (e.g. feature lists). */
  raw: <T = unknown>(key: string) => T | undefined;
}

/**
 * Returns a translator scoped to `namespace` (e.g. "overview"). `t("title")`
 * resolves `overview.title` in the active bundle; `t("greeting", { name })`
 * interpolates `{name}`; `t.raw("metrics")` returns a non-string value.
 * Missing keys return the key itself (and warn in development).
 */
export function useTranslations(namespace?: string): TranslateFn {
  const messages = useContext(MessagesContext);
  const prefix = namespace ? `${namespace}.` : "";

  const t = ((key: string, vars?: Record<string, string | number>): string => {
    const value = resolve(messages, prefix + key);
    if (typeof value === "string") return interpolate(value, vars);
    if (value == null) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing key: ${prefix}${key}`);
      }
      return key;
    }
    return String(value);
  }) as TranslateFn;

  t.raw = <T = unknown,>(key: string): T | undefined =>
    resolve(messages, prefix + key) as T | undefined;

  return t;
}
