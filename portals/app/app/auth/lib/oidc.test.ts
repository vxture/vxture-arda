import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEndSessionUrl } from "./oidc";
import type { OidcConfig } from "./config";

test("global logout selects this client's realm and preserves the registered return URI", () => {
  const cfg = { clientId: "arda", postLogoutRedirectUri: "https://arda.ruyin.work/",
    endpoints: { endSession: "https://accounts.vxture.com/oidc/end_session" } } as OidcConfig;
  const url = new URL(buildEndSessionUrl(cfg, "logout-state"));
  assert.equal(url.origin, "https://accounts.vxture.com");
  assert.equal(url.pathname, "/oidc/end_session");
  assert.equal(url.searchParams.get("client_id"), "arda");
  assert.equal(url.searchParams.get("post_logout_redirect_uri"), "https://arda.ruyin.work/");
  assert.equal(url.searchParams.get("state"), "logout-state");
  assert.equal(url.searchParams.has("id_token_hint"), false);
});
