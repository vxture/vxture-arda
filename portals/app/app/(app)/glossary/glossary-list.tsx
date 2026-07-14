"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  PageHeader,
  StatusBadge,
  Textarea,
  type DataTableColumn,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { createGlossaryTerm, type CreateTermResult } from "./actions";
import type { GlossaryTermView } from "./data";

export function GlossaryList({ terms, isAdmin = false }: { terms: GlossaryTermView[]; isAdmin?: boolean }) {
  const t = useTranslations("glossary");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return terms;
    return terms.filter((x) => (x.term + " " + x.definition).toLowerCase().includes(s));
  }, [terms, q]);

  const submit = () => {
    setErr(null);
    startTransition(async () => {
      const res: CreateTermResult = await createGlossaryTerm({ term, definition });
      if (res.ok) {
        setOpen(false);
        setTerm("");
        setDefinition("");
      } else {
        setErr(t("error." + res.error));
      }
    });
  };

  const columns: DataTableColumn<GlossaryTermView>[] = [
    { id: "term", header: t("col.term"), cell: (x) => <span className="cell-asset-name">{x.term}</span> },
    { id: "definition", header: t("col.definition"), cell: (x) => <span className="dim">{x.definition}</span> },
    {
      id: "scope",
      header: t("col.scope"),
      cell: (x) => (
        <StatusBadge tone={x.scope === "platform" ? "info" : "neutral"}>{t("scope." + x.scope)}</StatusBadge>
      ),
    },
    { id: "steward", header: t("col.steward"), cell: (x) => <span className="mono dim">{x.steward ?? "-"}</span> },
  ];

  return (
    <div className="screen">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          isAdmin ? (
            <Button onClick={() => setOpen(true)}>
              <PIcon name="plus" /> {t("newTerm")}
            </Button>
          ) : undefined
        }
      />

      {terms.length === 0 ? (
        <EmptyState
          title={
            <span className="app-empty-title">
              <PIcon name="book-open" /> {t("emptyTitle")}
            </span>
          }
          description={t("emptyDesc")}
        />
      ) : (
        <div className="con-card no-pad">
          <div className="con-card-hd pad">
            <div className="con-card-heading">{t("listTitle")}</div>
            <label className="fb-search" style={{ maxWidth: 280 }}>
              <PIcon name="magnifying-glass" />
              <input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <DataTable columns={columns} rows={list} rowKey={(x) => x.id} />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newTerm")}</DialogTitle>
            <DialogDescription>{t("newTermDesc")}</DialogDescription>
          </DialogHeader>
          <div className="form-stack">
            <div>
              <Label htmlFor="gl-term">{t("form.term")}</Label>
              <Input id="gl-term" value={term} maxLength={120} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="gl-def">{t("form.definition")}</Label>
              <Textarea id="gl-def" rows={4} value={definition} maxLength={2000} onChange={(e) => setDefinition(e.target.value)} />
            </div>
            {err && <p style={{ color: "var(--vx-color-danger-600)", fontSize: 13 }}>{err}</p>}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("form.cancel")}
            </Button>
            <Button disabled={pending || !term.trim() || !definition.trim()} onClick={submit}>
              {t("form.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
