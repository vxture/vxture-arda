import { prisma } from "../../lib/db";

/**
 * Approval-center data (Sec-BL4, biz-107 decision 2: approvals single-homed
 * here). Approvers (workspace admins) see the pending queue; every member sees
 * their own requests. Read-only; decisions live in actions.ts.
 */
export interface RequestView {
  id: string;
  datasetName: string | null;
  requesterName: string;
  useCase: string;
  justification: string;
  duration: string | null;
  method: string | null;
  status: string;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  mine: boolean;
}

export interface ApprovalData {
  pending: RequestView[];
  mine: RequestView[];
  pendingCount: number;
}

export async function getApprovalData(workspaceId: string, sub: string, isAdmin: boolean): Promise<ApprovalData> {
  const rows = await prisma.accessRequest.findMany({
    where: { workspaceId, ...(isAdmin ? {} : { requesterSub: sub }) },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const datasetIds = [...new Set(rows.map((r) => r.datasetId).filter((x): x is string => !!x))];
  const names = datasetIds.length
    ? new Map((await prisma.dataset.findMany({ where: { workspaceId, id: { in: datasetIds } }, select: { id: true, name: true } })).map((d) => [d.id, d.name]))
    : new Map<string, string>();

  const toView = (r: (typeof rows)[number]): RequestView => ({
    id: r.id,
    datasetName: r.datasetId ? (names.get(r.datasetId) ?? null) : null,
    requesterName: r.requesterName ?? r.requesterSub,
    useCase: r.useCase,
    justification: r.justification,
    duration: r.duration,
    method: r.method,
    status: r.status,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    mine: r.requesterSub === sub,
  });

  const views = rows.map(toView);
  const pending = isAdmin ? views.filter((v) => v.status === "pending") : [];
  const mine = views.filter((v) => v.mine);

  return { pending, mine, pendingCount: pending.length };
}
