# ADR-013: Decouple arda's in-house data-management capability from "Varda"; name it "arda Curator"; source model capability from Atlas

Status: Accepted (2026-07-28)
Refs: arda_biz_270_curator; arda-biz-260-billing SS0/SS2/SS4; arda-ent-120-consumption-contract SS2;
owner ruling 2026-07-28.

## Context

arda's internal right-docked AI panel was branded "Varda" (implementation
name) / "Vela" (design source, still the CSS class prefix `vela-*`). Its
tier-based access gate was typed `VardaAccess`/`vardaAccessForTier` in
`entitlement/capability.ts`, and its metering metric was originally named
`varda.credit` (later renamed `ai.credit` at the platform level, product_220
SS4/SS9).

Two problems with this, surfaced 2026-07-27/28:

1. **"Varda" is not arda's name to use.** `vxture-varda` is a real,
   separately-registered vxture repository - reserved for a future,
   independent product - that is currently empty (no commits, no docs).
   Continuing to brand arda's own internal feature "Varda" sets up a brand
   collision the moment that separate product is actually built.
2. **The model-inference layer was never "varda" anyway.** `vxture-atlas`
   is the platform's sole model-capability/inference gateway: "karda, arda,
   varda, etc. all consume models through Atlas, never directly" (Atlas
   README). Atlas also owns AI-usage metering and its reporting to the
   platform's C3 accounting exclusively - callers must not re-report token
   consumption themselves. arda's own design of self-calling
   `POST /usage/consume` for `ai.credit` was never actually wired (confirmed:
   `arda-plat-200-impl-handoff` "当前无调用点" - no call site exists), so
   there was no working implementation being displaced here, only a stale
   plan.

`vxture-karda` is the working sibling reference for "how a vxture product
calls Atlas": it mints its own S2S token (RFC 8693 token-exchange, `aud=atlas`)
from its own OIDC client credentials with an explicit `workspace_id`/`org_id`
context, and its Atlas client returns `null` (honestly not-implemented) until
`ATLAS_BASE_URL` is configured. karda's own feature/capability matrix is
likewise left empty pending scope - the same stub posture adopted here.

## Decision

1. **Rename**: "Varda" -> **"arda Curator"**. This is a deliberately
   business-role name (not "agent"), chosen to also avoid colliding with the
   unrelated "agent" terminology already used throughout
   `arda-data-150-multiagent-sharing.md` / `arda-data-170-platform-agent-
   support.md` (there, "agent" means an external product consuming arda's
   data via `DataService`/`ApiKey` - a different concept entirely).
   - `capability.ts`: `VardaAccess` -> `CuratorAccess`,
     `vardaAccessForTier` -> `curatorAccessForTier`. Tier thresholds
     unchanged (free: disabled; starter/pro: enabled+readonly;
     business/enterprise: enabled+read-write).
   - New module `portals/app/app/curator/` holds the architecture skeleton
     (session-derived context, Atlas client, empty task registry). See
     `arda_biz_270_curator.md` for the full design.
2. **Auth model**: Curator follows arda's own existing session/workspace
   context (`resolveIdentity()`) - there is no separate inbound S2S
   resolution to build, unlike karda's externally-called tool surface. A
   second, independently-minted S2S token (`aud=atlas`) is used only for the
   outbound leg to Atlas.
3. **Model capability**: sourced exclusively from Atlas via S2S
   token-exchange. arda does not build, and must not build, a bespoke or
   "varda-flavored" LLM gateway of its own.
4. **Metering**: Atlas performs the atomic pre-deduct `ai.credit` consume
   itself when Curator calls it with workspace/tenant context, and reports
   that consumption to platform C3. arda does not implement its own
   `POST /usage/consume` call site for `ai.credit` - this was already true in
   practice (never wired) and is now the permanent, intended design rather
   than an open TODO. arda's local role is limited to: (a) tier-based
   enabled/readonly gating (unchanged logic, renamed types), and (b) reading
   `quota_pools["ai.credit"].remaining` from C2 for local "remaining balance"
   display/admission UX.
5. **Scope of this decision**: architecture only. What Curator concretely
   manages (a task/feature matrix) is intentionally left undefined - see
   `arda_biz_270_curator.md` SS6 for the explicit non-goals.

## Consequence

- All literal "Varda" text/comments/type names in code, i18n strings, and
  design docs are replaced with "arda Curator". The CSS class prefix
  `vela-*` (a styling implementation detail, not the brand collision) is
  left untouched.
- `docs/30-design/arda-biz-260-billing.md`, `arda-ent-120-consumption-
  contract.md`, `arda-ent-300-migration.md`, `30-console-ui.md` are updated
  to reflect the rename and the Atlas metering ownership split.
  `arda-plat-300-tracking.md`'s historical dated log entries are left as
  originally written (they record what was literally named/decided at the
  time) with a single dated note at the top pointing here.
- Any future work that gives Curator concrete tasks must register them in
  `portals/app/app/curator/catalog.ts` and extend
  `arda_biz_270_curator.md` - not scatter task definitions elsewhere.
- No changes to `vxture-varda` or `vxture-atlas` themselves; this ADR is
  arda-repo-scoped only.
