# Karda remediation handoff

Planning snapshot: 2026-11-21. No Karda code, configuration, commercial plan or
release is changed by this handoff. Start with discovery, not copied Arda settings.

## Baseline and ownership

Read-only baseline: sibling vxture-karda at2503652, v0.10.3 release record, tracked
tree clean. Recheck origin/main and actual deployed identity when implementation
starts. Existing ShellViewport geometry and withdrawn header toggle decisions
must be understood before changing layout. Old bootstrap text is not runtime proof.

Karda's governing product blueprint is docs/20-specs/30-agent-knowledge-blueprint.md
(KD-017): shared knowledge infrastructure for AI Agents. Audit knowledge building,
management, retrieval and context provision against that positioning. Checklist
items below are proposed audits, not confirmed defects.

Change Karda only during its implementation. Report platform gaps with contract
reference, expected/actual behavior, redacted reproduction, impact and acceptance
criteria. Platform registration/routing is configuration-owned. Product runtime
configuration uses Karda's normal deployment. Do not copy Arda credentials,
domains, plan quantities, prices or dependency grants.

## Phased delivery

| Phase | Work | Exit evidence |
| --- | --- | --- |
| Discovery | Read local standards/blueprint/decisions; inspect source, APIs, jobs, storage, dependencies, deployed versions and registrations | Inventory and implemented/configured/accepted gap matrix |
| Design | Apply CoSpace v1.3.1 structural constraints; design independent Karda brand/background | Login HTML, all entry states, desktop/mobile checks, owner confirmation and frozen package |
| Entry implementation | Real Accounts, entitlement, role/error distinction, recovery, theme/language | Local PR, required gates and browser state checks |
| Interface alignment | Scoped S2S, C2, durable C3, signed lifecycle, ACK and reconciliation | Contract matrix, local fixes, platform issues and targeted regressions |
| Commercial design | Actual storage/AI/compute costs, key customer metrics and internal controls | Complete plan prices, cost scenarios and target contribution; owner confirmation before publication |
| Configuration/beta | Register actual dependencies/terminals/routes; deploy candidate | Traceable configuration, identity checks and authorized business/accounting acceptance |
| Production | Promote validated image through required human approval | Real origin/admission/workflow receipts, temporary-resource cleanup |
| Handoff | Record designs, PRs, releases, configurations, accepted and pending items | Consolidated delivery with explicit evidence limits |

Prepare concrete reviewable artifacts before requesting decisions. Independent
read-only discovery and reversible local fixes need not wait for every parameter.

## Interface checklist

- Accounts: PKCE/state/nonce, controlled returnTo, cookie/CSRF, callbacks, logout
  realm/client, backchannel and status fallback, refresh locking, truthful activity.
  Distinguish customer and workforce identities. Establish both fresh sessions
  before logout-isolation tests; test Karda as both initiator and receiver.
- Workspace: organization/workspace/user/role changes invalidate old scope. Check
  actual editors and jobs before promising work-surface recovery. Server-side
  authorization remains authoritative.
- S2S: verify signed actor, audience, scope, tenant bounds, TTL and rotation using
  Karda identities. Grant Atlas/Runos/Arda access only when actual calls require it.
- C2: authoritative plan and eligible pools, including zero/shared/purchased pools,
  exhaustion, concurrency and transport failures. Never turn outages into purchase.
- C3: real actions, stable idempotency, durable queues, automatic retry and receipts,
  retained exhaustion. No inserted usage or manual flush presented as automation.
- Lifecycle: signed-body binding, duplicate/reversed notifications, stop/re-enable,
  retention/deletion, committed ACK and missed-delivery reconciliation. Check list
  environment scope before permitting beta to apply product-wide production facts.
- Readiness: bounded real dependency checks with truthful applicable launch items;
  preserve liveness separately and do not grant unused dependencies to turn green.

## Knowledge-specific acceptance and costing

| Area | Audit and evidence |
| --- | --- |
| Ingestion/parsing | Authorized small sample, permissions, formats, sizes, jobs, retries and dedup |
| Chunking/indexing | Embeddings, task/version lineage, rebuild consistency and retry accounting |
| Retrieval/context | Rerank and citations, updated knowledge, tenant/document access denial tests |
| Storage/deletion | Source objects, parsed artifacts, versions, vectors and backups; logical quota vs physical cost; verified reclamation/retention |
| AI | Determine actual embedding/rerank/generation providers and billing units; for Atlas, raw-token attribution to platform-credit conversion without duplicates |
| External APIs | Agent retrieval/context API, scoped keys/S2S, rate limits, one authorized real request, receipt and cleanup |

Validate existing core workflows first. Missing product features are explicit
implementation scope, not something adapter configuration can claim to deliver.
Cost the whole package using actual Aliyun region/storage pricing plus indexing,
database, compute, traffic, models and support. Include heavy use, retries, rebuilds
and expansion scenarios. Show customer total price, package cost and contribution;
distinguish contribution from net profit. Do not transplant Arda's prices/quotas.

## Decisions and first deliverables

Confirm Karda domain/terminals/legacy-origin handling after actual configuration
inventory; confirm independent design after previews; confirm plans, credits,
storage, annual billing and sales mode after costing, before publication. Free may
be designed but unpublished, with coupon-based trials per owner preference; exact
Karda plan configuration is still a decision. Obtain concrete authorization for
costly inference or state-changing acceptance actions beyond existing scope and
follow Karda's production approval rules.

First implementation deliverables: current-state/version inventory; latest-contract
gap matrix split into local fix/platform issue/configuration/acceptance; independent
login preview and core knowledge workflow test plan; cost-backed commercial proposal
with the smallest necessary owner decision set. The present request is planning
only and does not start these implementation phases.
