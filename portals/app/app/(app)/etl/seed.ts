/**
 * Data development (ETL) static seed + display metadata.
 *
 * Pipelines are not modeled in the v1 domain schema (they are `future` in
 * docs/30-design/arda-biz-120-domain-entities-and-feature-keys.md), so this screen renders from
 * a static, generic seed (like lineage) until a Pipeline/JobRun schema lands.
 */
import type { StatusBadgeTone } from "@vxture/design-system";
import type { PIconName } from "../../ui/phosphor-icon";

export type PipelineStatus = "success" | "running" | "warning" | "failed";

export interface PipelineRow {
  id: string;
  /** i18n key suffix under etl.rows.* for name/source/target labels. */
  key: string;
  status: PipelineStatus;
  rows: string;
  dur: string;
  schedule: string;
}

export const STATUS_META: Record<PipelineStatus, { tone: StatusBadgeTone; icon: PIconName }> = {
  success: { tone: "success", icon: "check" },
  running: { tone: "info", icon: "lightning" },
  warning: { tone: "warning", icon: "warning" },
  failed: { tone: "danger", icon: "warning-octagon" },
};

export const PIPELINES: PipelineRow[] = [
  { id: "JOB-1001", key: "p1", status: "success", rows: "12.1M", dur: "12m 04s", schedule: "daily" },
  { id: "JOB-1002", key: "p2", status: "success", rows: "3.8M", dur: "8m 21s", schedule: "daily" },
  { id: "JOB-1003", key: "p3", status: "running", rows: "stream", dur: "-", schedule: "stream" },
  { id: "JOB-1004", key: "p4", status: "warning", rows: "27K", dur: "3m 48s", schedule: "q15m" },
  { id: "JOB-1005", key: "p5", status: "success", rows: "0.6M", dur: "21m 10s", schedule: "weekly" },
  { id: "JOB-1006", key: "p6", status: "failed", rows: "-", dur: "1m 12s", schedule: "stream" },
];
