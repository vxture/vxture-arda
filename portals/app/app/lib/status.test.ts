import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStatus, parseDbUrl, statusMode } from "./status";

// Distinctive sentinels so the no-leak assertion is unambiguous.
const SECRETS = {
  OIDC_CLIENT_SECRET: "SENTINEL_oidc_secret_zzz",
  POSTGRES_PASSWORD: "SENTINEL_pg_pw_zzz",
  PLATFORM_INTERNAL_AUTH_TOKEN: "SENTINEL_platform_tok_zzz",
  PROVISION_WEBHOOK_SECRET: "SENTINEL_wh_secret_zzz",
  PROVISION_WEBHOOK_SECRET_NEXT: "SENTINEL_wh_next_zzz",
  INTERNAL_JOB_TOKEN: "SENTINEL_job_tok_zzz",
};

const FULL_ENV = {
  ...SECRETS,
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_ENV: "production",
  OIDC_ISSUER: "https://accounts.vxture.com",
  OIDC_CLIENT_ID: "arda",
  OIDC_REDIRECT_URI: "https://arda.vxture.com/auth/callback",
  OIDC_SCOPES: "openid profile email phone",
  RP_SESSION_COOKIE_NAME: "vx_rp_session",
  PLATFORM_API_URL: "http://platform.internal",
  NEXT_PUBLIC_CONSOLE_URL: "https://console.vxture.com",
  DATABASE_URL: `postgresql://arda_svc:${SECRETS.POSTGRES_PASSWORD}@arda-db:5432/vxturebiz_arda_prod`,
  REDIS_URL: "redis://arda-redis:6379",
};

test("NO SECRET VALUE ever appears in the status output", () => {
  const json = JSON.stringify(buildStatus(FULL_ENV, "t"));
  for (const [k, v] of Object.entries(SECRETS)) {
    assert.equal(json.includes(v), false, `secret ${k} leaked into status`);
  }
});

test("secrets are reported as presence booleans only", () => {
  const s = buildStatus(FULL_ENV, "t");
  assert.equal(s.c1.clientSecretConfigured, true);
  assert.equal(s.c2.authTokenConfigured, true);
  assert.equal(s.c3.webhookSecretConfigured, true);
  assert.equal(s.c3.webhookRotationConfigured, true);
  assert.equal(s.c3.internalJobTokenConfigured, true);
  const empty = buildStatus({}, "t");
  assert.equal(empty.c1.clientSecretConfigured, false);
  assert.equal(empty.c3.internalJobTokenConfigured, false);
});

test("resolver = platform only when both API url and token are set", () => {
  assert.equal(buildStatus(FULL_ENV, "t").c2.resolver, "platform");
  assert.equal(buildStatus({ PLATFORM_API_URL: "x" }, "t").c2.resolver, "mock");
  assert.equal(buildStatus({}, "t").c2.resolver, "mock");
});

test("c1.enabled requires both issuer and client secret", () => {
  assert.equal(buildStatus(FULL_ENV, "t").c1.enabled, true);
  assert.equal(buildStatus({ OIDC_ISSUER: "https://accounts.vxture.com" }, "t").c1.enabled, false);
  assert.equal(buildStatus({}, "t").c1.enabled, false);
});

test("parseDbUrl extracts host/db/role and DROPS the password", () => {
  const p = parseDbUrl(`postgresql://arda_svc:${SECRETS.POSTGRES_PASSWORD}@arda-db:5432/vxturebiz_arda_prod`);
  assert.deepEqual(p, { host: "arda-db", db: "vxturebiz_arda_prod", role: "arda_svc" });
  assert.equal(JSON.stringify(p).includes(SECRETS.POSTGRES_PASSWORD), false);
  assert.equal(parseDbUrl(undefined), null);
});

test("STATUS_SHOW_INFRA=off hides host/db/role but keeps configured", () => {
  const off = buildStatus({ ...FULL_ENV, STATUS_SHOW_INFRA: "off" }, "t");
  assert.equal(off.data.database.configured, true);
  assert.equal(off.data.database.host, undefined);
  assert.equal(off.data.database.role, undefined);
  assert.equal(off.data.redis.host, undefined);
  const on = buildStatus(FULL_ENV, "t");
  assert.equal(on.data.database.host, "arda-db");
  assert.equal(on.data.database.role, "arda_svc");
});

test("statusMode defaults to public and accepts off/authed", () => {
  assert.equal(statusMode({}), "public");
  assert.equal(statusMode({ STATUS_PAGE: "off" }), "off");
  assert.equal(statusMode({ STATUS_PAGE: "authed" }), "authed");
  assert.equal(statusMode({ STATUS_PAGE: "garbage" }), "public");
});
