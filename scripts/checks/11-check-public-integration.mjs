// Anonymous production integration probe. No cookies, credentials or valid mutation payloads.
// Run manually: node scripts/checks/11-check-public-integration.mjs
// Does not test subscriptions, member changes, live SSE delivery or OBO calls.
const product = "arda";
const origin = `https://${product}.ruyin.work`;
const report = { product, origin, checkedAt: new Date().toISOString(), checks: [] };
async function probe(name, path, expected, validate = () => true, init = {}) {
  try {
    const response = await fetch(origin + path, {
      redirect: "manual", signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json", ...init.headers }, ...init,
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    const noStore = response.headers.get("cache-control")?.includes("no-store") ?? false;
    const ok = response.status === expected && validate({ body, response, noStore });
    const entry = { name, path, status: response.status, expected, noStore, ok };
    if (name === "readiness" && body) entry.release = {
      version: body.version, gitSha: body.gitSha, stage: body.stage, checks: body.checks,
    };
    report.checks.push(entry);
  } catch (error) {
    report.checks.push({ name, path, ok: false, error: error instanceof Error ? error.name : "request_failed" });
  }
}
await probe("readiness", "/api/ready", 200, ({ body }) =>
  body?.status === "ready" && body.stage === "production" &&
  body.service === `${product}-app` &&
  body.checks?.db === "ok" && body.checks?.redis === "ok" &&
  (product !== "karda" || body.checks.storageConfig === "ok"));
await probe("anonymous_session", "/auth/session", 200,
  ({ body, noStore }) => body?.authenticated === false && noStore);
await probe("anonymous_members", "/api/platform/members", 401,
  ({ body, noStore }) => body?.error === "unauthenticated" && noStore);
await probe("anonymous_event_stream", "/api/events", 401, ({ noStore }) => noStore);
await probe("cross_origin_event_stream", "/api/events", 403, () => true, {
  headers: { Origin: "https://integration-probe.invalid", "Sec-Fetch-Site": "cross-site" },
});
// An unauthenticated empty payload has no target member/role or valid logout token.
await probe("role_write_missing_origin", "/api/platform/member-roles", 403, () => true, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
});
await probe("logout_missing_token", "/auth/backchannel-logout", 400, () => true, {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "",
});
report.passed = report.checks.every(check => check.ok);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
