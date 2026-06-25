import { redirect } from "next/navigation";
import { DEFAULT_LANDING } from "./entitlement/config";

// Root entry: upstream apps land users here. AccountGate (auth) and
// EntitlementGate (subscription) run in the layout; this server component just
// forwards to the configured default landing page.
export default function RootPage() {
  redirect(DEFAULT_LANDING);
}
