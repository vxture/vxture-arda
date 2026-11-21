import { strict as assert } from "node:assert";
import { test } from "node:test";
import { NextResponse } from "next/server";
import { getOidcConfig } from "./config";
import { setSessionCookie, clearSessionCookie } from "./cookie";

function configured(backchannel: string, run: (cfg: NonNullable<ReturnType<typeof getOidcConfig>>) => void) {
  const values = {
    MOCK_AUTH: "false", REDIS_URL: "redis://localhost:6379",
    OIDC_ISSUER: "https://accounts.vxture.com", OIDC_CLIENT_SECRET: "test-only",
    OIDC_REDIRECT_URI: "https://arda.ruyin.work/auth/callback",
    OIDC_BACKCHANNEL_ISSUER: backchannel,
    RP_SESSION_COOKIE_DOMAIN: ".ruyin.work",
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    const cfg = getOidcConfig();
    assert.ok(cfg);
    run(cfg);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("internal token and JWKS transport never changes the public issuer or browser endpoints", () => {
  configured("http://100.64.0.1:8081/", cfg => {
    assert.equal(cfg.issuer, "https://accounts.vxture.com");
    assert.equal(cfg.endpoints.authorize, "https://accounts.vxture.com/oidc/authorize");
    assert.equal(cfg.endpoints.endSession, "https://accounts.vxture.com/oidc/end_session");
    assert.equal(cfg.endpoints.token, "http://100.64.0.1:8081/oidc/token");
    assert.equal(cfg.endpoints.jwks, "http://100.64.0.1:8081/oidc/jwks");
    assert.equal(cfg.appOrigin, "https://arda.ruyin.work");
  });
});

test("an omitted internal transport preserves the existing issuer endpoints", () => {
  configured("", cfg => {
    assert.equal(cfg.endpoints.token, "https://accounts.vxture.com/oidc/token");
    assert.equal(cfg.endpoints.jwks, "https://accounts.vxture.com/oidc/jwks");
  });
});

test("setting and clearing the RP cookie omit Domain even with a legacy parent-domain value", () => {
  configured("", cfg => {
    const response = new NextResponse();
    setSessionCookie(response, cfg, "opaque-test-id");
    assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /domain=/i);
    clearSessionCookie(response, cfg);
    assert.doesNotMatch(response.headers.get("set-cookie") ?? "", /domain=/i);
    assert.match(response.headers.get("set-cookie") ?? "", /max-age=0/i);
  });
});
