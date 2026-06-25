"use client";

// Thin re-export so app code imports providers from a local path; the actual
// provider stack (Theme + Locale + Toast + Fullscreen + PreferenceSync) lives
// in the shared workspace package and is reused verbatim.
export { Providers } from "@arda/shared/providers";
