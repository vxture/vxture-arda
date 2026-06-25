"use client";

import {
  DataTable,
  EmptyState,
  Icon,
  MetricGrid,
  PageHeader,
  PageStack,
  SectionCard,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";

/** Shape of a recent-dataset row. No rows yet (placeholder landing); the table
 *  renders its EmptyState until a real data source is connected. */
interface DatasetRow {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly updatedAt: string;
}

export default function OverviewPage() {
  const t = useTranslations("overview");

  // Placeholder metrics. Real values will come from the data-assets service.
  const metrics: MetricGridItem[] = [
    { id: "sources", label: t("metrics.dataSources"), value: "12", tone: "default" },
    { id: "datasets", label: t("metrics.datasets"), value: "248", tone: "default" },
    {
      id: "quality",
      label: t("metrics.qualityScore"),
      value: "92",
      tone: "positive",
    },
    {
      id: "governance",
      label: t("metrics.governanceCoverage"),
      value: "78%",
      tone: "positive",
    },
  ];

  const columns: DataTableColumn<DatasetRow>[] = [
    { id: "name", header: t("metrics.datasets"), cell: (row) => row.name },
    { id: "source", header: t("metrics.dataSources"), cell: (row) => row.source },
    { id: "updatedAt", header: "", cell: (row) => row.updatedAt, align: "right" },
  ];

  const rows: DatasetRow[] = [];

  return (
    <PageStack>
      <PageHeader
        icon="database"
        title={t("title")}
        description={t("description")}
      />

      <MetricGrid items={metrics} />

      <SectionCard title={t("tableTitle")} description={t("tableDescription")}>
        <DataTable<DatasetRow>
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={
            <EmptyState
              title={
                <span className="app-empty-title">
                  <Icon name="table" size="sm" />
                  {t("emptyTitle")}
                </span>
              }
              description={t("emptyDescription")}
            />
          }
        />
      </SectionCard>
    </PageStack>
  );
}
