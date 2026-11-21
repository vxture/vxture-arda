# Accounts integration follow-up

Date: 2026-11-21. Production baseline: v0.13.0 / 20bd3d2.
Changes in this branch are not deployed. No commercial plan was published.

## Authority

- [Product integration rules](https://claude.ai/artifact/54YtaMf3K7tPULZur29Vzf), C1.
- [Application reference](https://claude.ai/artifact/WjCmptqy2TR5mfXLoNt1pP), C1 and #538.
- Platform `docs/30-design/identity/080-rp-integration.md` is supporting detail;
  the external originals take precedence where older refresh guidance differs.

## Corrections

1. Send `client_id=arda` to Accounts `GET /oidc/end_session`, with the registered
   return URI and state. Missing client identity causes conservative handling of
   both realm cookies. Never use `id_token_hint` to select a central sid.
2. Send `active:false` from generic status resolution: focus, session bootstrap
   and refresh do not establish real human interaction. Do not manufacture activity.
3. Replace periodic browser polling with focus/visibility and throttled input
   checks. The backend still respects Accounts `next_check_at`. No claims of
   instant push updates to a completely idle browser.
4. Wait boundedly for the distributed session lock. Concurrent session and C2
   requests re-read identity/tokens under the lock, so only one refresh consumes
   the old single-use token. The previous immediate busy error is a confirmed
   failure path, not proven to be the cause of the observed production C2 503.
5. Logout teardown is idempotent and retryable. Do not mark a logout seen before
   Redis deletion succeeds; otherwise a failure can permanently suppress retries.
   Require the documented integer iat/exp along with signature/issuer/audience,
   sid, jti, event and absent nonce validation.

## Production evidence

Using the existing authenticated customer browser, a top-level Accounts
`/oidc/end_session` with `client_id=arda` and the registered return URI was
performed. Arda's pre-existing page returned to the login entry after reload;
`GET https://arda.ruyin.work/auth/session` returned
`{"authenticated":false,"signedOut":false}`. The separate workforce Admin
session remained usable. No credentials or synthetic sessions were created.

This proves Accounts-to-Arda logout effect. Browser evidence alone does not
distinguish back-channel delivery from the central-status fallback. It does not
prove logout propagation to every other product, nor the modified branch's
production behavior. Reverse-direction Arda logout needs post-release acceptance.

## Local validation

Run unit tests and type checking with the portal package scripts.
The Redis integration test requires a disposable isolated Redis:

```powershell
$env:ARDA_TEST_REDIS_URL='redis://127.0.0.1:16389'
# From portals/app; never point this at a product Redis.
node --import tsx --test --test-force-exit app/auth/lib/session-store.test.ts
```

It verifies concurrent requests share the completed rotation, TTL is retained,
all RP sessions for one sid are removed, repeat logout is safe, and a late
refresh cannot recreate a deleted session.

## Remaining launch work

- Diagnose C2 legacy-credential signal attribution and any remaining transient 503.
- Promote the validated beta Accounts changes after production approval.
- Finish live lifecycle/ACK acceptance; implementation and concurrency tests are
  recorded in 70-provisioning-acceptance.md.
- Use an existing valid test subscription for real C3 usage acceptance; never
  fabricate usage or change customer subscriptions just to make checks green.
- Retire old product hostname through platform configuration (issue721).

## Fresh beta isolation retest

After the owner signed into both realms, Opera was reloaded and returned live
provider/model data as superadmin. Stable Arda /auth/session returned
authenticated:true. Beta /auth/logout then returned its signed-out screen;
stable Arda /auth/session returned authenticated:false. Opera was reloaded again
and still returned live data as superadmin. Customer logout and workforce
isolation passed for these clients; other products were not independently tested.
Screenshots are saved in local output as arda-opera-isolation-passed-20261121.jpg
and arda-beta-logout-passed-20261121.jpg.

## v0.13.1 production follow-up

Production6295744 login callback returned to arda.ruyin.work and admitted the
active Business workspace. With beta session confirmed authenticated, production
/auth/logout returned the signed-out view; beta /auth/session then returned
authenticated:false. Opera had expired before this test, so no fresh production
workforce-isolation claim is made. The earlier beta fresh-baseline isolation
passed. Browser evidence does not distinguish backchannel from status fallback.
