/**
 * Standards presentation metadata. The rows now come from the DB (see data.ts);
 * this file only holds the status->tone map shared by the client component.
 */
import type { StatusBadgeTone } from "@vxture/design-system";

export const STATUS_TONE: Record<string, StatusBadgeTone> = {
  published: "success",
  draft: "neutral",
  review: "warning",
};
