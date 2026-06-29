/**
 * Static seed for Data Standards (Phase: standards screen, no DB yet). Generic
 * intelligent data-platform reference standards: code sets + data elements.
 */
import type { StatusBadgeTone } from "@vxture/design-system";

export const STATUS_TONE: Record<string, StatusBadgeTone> = {
  published: "success",
  draft: "neutral",
  review: "warning",
};

export interface Standard {
  id: string;
  name: string;
  type: string; // i18n key: code-set | data-element
  ref: string;
  items: number;
  usage: number;
  status: string; // i18n key: published | draft | review
}

export const STANDARDS: Standard[] = [
  { id: "STD-001", name: "Country Codes", type: "code-set", ref: "ISO 3166-1", items: 249, usage: 1204, status: "published" },
  { id: "STD-002", name: "Currency Codes", type: "code-set", ref: "ISO 4217", items: 180, usage: 968, status: "published" },
  { id: "STD-003", name: "Unified Org Identifier", type: "data-element", ref: "Internal STD-ORG", items: 1, usage: 842, status: "published" },
  { id: "STD-004", name: "Postal Address Structure", type: "data-element", ref: "Internal STD-ADDR", items: 9, usage: 624, status: "published" },
  { id: "STD-005", name: "Product Category Taxonomy", type: "code-set", ref: "Internal 2026", items: 142, usage: 88, status: "draft" },
  { id: "STD-006", name: "Data Classification Levels", type: "code-set", ref: "Internal SEC", items: 64, usage: 53, status: "review" },
  { id: "STD-007", name: "Date / Time Format", type: "data-element", ref: "ISO 8601", items: 1, usage: 1486, status: "published" },
  { id: "STD-008", name: "Language Codes", type: "code-set", ref: "ISO 639-1", items: 184, usage: 312, status: "published" },
];
