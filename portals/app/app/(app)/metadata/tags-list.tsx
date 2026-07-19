"use client";

import { useState, useTransition } from "react";
import { Button, DataTable, Input, MetricGrid, type DataTableColumn, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import { createTag, deleteTag } from "./tags-actions";
import type { TagView } from "./tags-data";

/** Tag management: list tags + dataset usage, create/delete (admin). */
export function TagsList({ tags, isAdmin = false }: { tags: TagView[]; isAdmin?: boolean }) {
  const t = useTranslations("tags");
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const add = () => {
    const v = name.trim();
    if (!v) return;
    setMsg(null);
    startTransition(async () => {
      const res = await createTag(v);
      if (res.ok) setName("");
      else setMsg(t("error." + res.error));
    });
  };

  const metrics: MetricGridItem[] = [
    { id: "tags", label: t("mTags"), value: tags.length.toLocaleString() },
    { id: "tagged", label: t("mTagged"), value: tags.reduce((a, x) => a + x.count, 0).toLocaleString() },
    { id: "unused", label: t("mUnused"), value: tags.filter((x) => x.count === 0).length.toLocaleString() },
  ];

  const columns: DataTableColumn<TagView>[] = [
    {
      id: "name",
      header: t("cName"),
      cell: (r) => (
        <span className="dim-tag">
          <PIcon name="tag" /> {r.name}
        </span>
      ),
    },
    { id: "count", header: t("cCount"), align: "right", cell: (r) => r.count.toLocaleString() },
    ...(isAdmin
      ? [
          {
            id: "remove",
            header: "",
            align: "right",
            cell: (r: TagView) => (
              <button
                aria-label={t("delete")}
                disabled={pending}
                onClick={() => startTransition(async () => { await deleteTag(r.id); })}
                style={{ border: 0, background: "none", cursor: "pointer", padding: 0, color: "inherit" }}
              >
                <PIcon name="x" />
              </button>
            ),
          } as DataTableColumn<TagView>,
        ]
      : []),
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="tag" title={t("title")} description={t("desc")} />
      <MetricGrid items={metrics} />
      {msg && (
        <p role="status" style={{ fontSize: 13, color: "var(--vx-color-danger-600)" }}>
          {msg}
        </p>
      )}
      <div className="con-card no-pad">
        <DataTable columns={columns} rows={tags} rowKey={(r) => r.id} empty={t("empty")} />
        {isAdmin && (
          <div style={{ display: "flex", gap: 6, padding: "0 var(--vx-space-md) var(--vx-space-md)" }}>
            <Input
              value={name}
              maxLength={60}
              placeholder={t("namePh")}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button size="sm" disabled={pending || !name.trim()} onClick={add}>
              <PIcon name="plus" /> {t("add")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
