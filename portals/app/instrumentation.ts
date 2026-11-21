/** Node-only startup integration for the long-running, single-image service. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build"
    || process.env.MOCK_AUTH === "true" || !process.env.PLATFORM_API_URL
    || !process.env.OIDC_CLIENT_SECRET) return;
  const { startProvisioningReconciliation } = await import("./app/provisioning/lib/reconcile");
  startProvisioningReconciliation();
  const { startUsageWorker } = await import("./app/usage/lib/worker");
  startUsageWorker();
}
