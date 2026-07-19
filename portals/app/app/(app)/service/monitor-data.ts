import { prisma } from "../../lib/db";

/**
 * Service invocation monitoring (biz-441 result ring): aggregates the
 * `service.access` AuditLog the egress gateway already writes on every call
 * (Sec-BL3). Real telemetry (latency/error modelling) is future - this is the
 * call-volume view over the audit trail, no new model.
 */
export interface ServiceCallRow {
  service: string;
  actor: string;
  at: string;
}

export interface ServiceMonitor {
  totalCalls: number;
  windowCalls: number;
  services: number;
  byService: Array<{ name: string; calls: number }>;
  recent: ServiceCallRow[];
}

export async function getServiceMonitor(workspaceId: string): Promise<ServiceMonitor> {
  const [total, logs, services] = await Promise.all([
    prisma.auditLog.count({ where: { workspaceId, action: "service.access" } }),
    prisma.auditLog.findMany({
      where: { workspaceId, action: "service.access" },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { actor: true, target: true, createdAt: true },
    }),
    prisma.dataService.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
  ]);

  const nameById = new Map(services.map((s) => [s.id, s.name]));
  const resolve = (target: string | null) => (target ? (nameById.get(target) ?? target) : "-");

  const perService = new Map<string, number>();
  for (const l of logs) {
    const name = resolve(l.target);
    perService.set(name, (perService.get(name) ?? 0) + 1);
  }

  return {
    totalCalls: total,
    windowCalls: logs.length,
    services: perService.size,
    byService: [...perService.entries()]
      .map(([name, calls]) => ({ name, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 12),
    recent: logs.slice(0, 30).map((l) => ({
      service: resolve(l.target),
      actor: l.actor,
      at: l.createdAt.toISOString(),
    })),
  };
}
