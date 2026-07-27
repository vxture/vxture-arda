import { TIERS, SUBSCRIPTION_STATUSES } from "@vxture/shared";
import type { Subscription, SubscriptionStatus, Tier } from "../../entitlement/types";
import { hasProductAccess, hasDataAccess } from "../../entitlement/types";

// Subscription-tier verification: the five tiers x six statuses (plus the
// null / bundled-only edge cases) with their gate + CTA outcomes. Pure
// functions, fully offline - no platform, no session.
export const dynamic = "force-static";

interface Row {
  label: string;
  tier: Tier | null;
  status: SubscriptionStatus | null;
  bundled: boolean;
}

function rows(): Row[] {
  const out: Row[] = [];
  for (const tier of TIERS) {
    for (const status of SUBSCRIPTION_STATUSES) {
      out.push({ label: `${tier} / ${status}`, tier, status, bundled: false });
    }
  }
  out.push({ label: "null / null (never subscribed)", tier: null, status: null, bundled: false });
  out.push({ label: "bundled only (no direct purchase)", tier: null, status: null, bundled: true });
  return out;
}

// CTA branches on the subscription fact (arda_200 2.3), mirroring
// entitlement/gate.tsx: never-subscribed (null) -> subscribe;
// expired/cancelled/suspended -> renew; otherwise access is already granted.
function ctaFor(sub: Subscription): string {
  if (hasProductAccess(sub)) return "-";
  const lapsed = sub.status === "expired" || sub.status === "cancelled" || sub.status === "suspended";
  return lapsed ? "renew" : "subscribe";
}

// ds-allow: bare diagnostic surface (operator/CI tool, not product UI)
const cellStyle: React.CSSProperties = { border: "1px solid #ccc", padding: "4px 8px", textAlign: "left" }; // ds-allow: bare diagnostic surface

export default function EntitlementMatrixPage() {
  const data = rows().map((r) => {
    const sub: Subscription = { tier: r.tier, status: r.status, bundled: r.bundled };
    return { ...r, productAccess: hasProductAccess(sub), dataAccess: hasDataAccess(sub), cta: ctaFor(sub) };
  });
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Entitlement gating matrix</h1>
      <p>
        Offline demonstration of the C2 gating and CTA rules (product_220 section
        3). UI gate = <code>status in active/trialing/overdue</code>; data gate ={" "}
        <code>UI gate || bundled</code>.
      </p>
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellStyle}>tier / status (bundled)</th>
            <th style={cellStyle}>UI access</th>
            <th style={cellStyle}>data access</th>
            <th style={cellStyle}>CTA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.label}>
              <td style={cellStyle}>
                {r.label}
                {r.bundled ? " [bundled]" : ""}
              </td>
              <td style={cellStyle}>{r.productAccess ? "yes" : "no"}</td>
              <td style={cellStyle}>{r.dataAccess ? "yes" : "no"}</td>
              <td style={cellStyle}>{r.cta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
