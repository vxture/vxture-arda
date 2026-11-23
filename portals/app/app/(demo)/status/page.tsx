import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readStatus, statusAccess } from "../../lib/status-server";
import type { PublicStatus } from "../../lib/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = { title: "Arda · 运行状态" };

const labels: Record<PublicStatus["status"], string> = {
  operational: "正常",
  degraded: "降级",
  unavailable: "不可用",
};

export default async function StatusPage() {
  const access = await statusAccess();
  if (access === 404) notFound();
  if (access === 401) {
    return (
      <main className="content-inner">
        <h1>Arda 运行状态</h1>
        <p>请<a href="/">登录 Arda</a>后查看运行状态。</p>
      </main>
    );
  }

  const { status, updatedAt } = await readStatus();
  const updatedInUtc = updatedAt.slice(0, 19).replace("T", " ");
  return (
    <main className="content-inner">
      <h1>Arda 运行状态</h1>
      <p>{labels[status]}</p>
      <p>更新时间：<time dateTime={updatedAt}>{updatedInUtc} UTC</time></p>
    </main>
  );
}
