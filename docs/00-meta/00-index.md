# Arda docs index

Top-level map of `docs/`. Numbering follows the org docs taxonomy
(vxture-platform `docs/10-standards/070-docs-taxonomy.md`): numbered = formal
(permanent), unnumbered = temporary (delete on sight); numbers keep gaps for
insertion. Enforced by `scripts/guardrails/check-docs-numbering.mjs --strict`
in CI quality-gate.

| Decade | Directory | Holds |
| ------ | --------- | ----- |
| 00 | `00-meta/` | About the docs themselves (this index) |
| 10 | `10-standards/` | Full-stack engineering standards arda implements (org standards live in vxture-platform `docs/10-standards/`) |
| 20 | `20-specs/` | Product/business specs (product scope, domains, security) |
| 30 | `30-design/` | Architecture, ADRs (`decisions/`), domain design (`arda-{plat,biz,data,ent}-NNN` series) |
| 40 | `40-implementation/` | Repository layout, scripts, coding guides |
| 50 | `50-deployment/` | Deployment, checklists, infra |
| 60 | `60-operations/` | Operations, GitHub Actions, operator runbook, tech-debt register (`40-tech-debt.md`, TD-NNN) |
| 70 | `70-workplan/` | Plans and roadmaps |
| 80 | `80-liaison/` | Cross-org correspondence with the vxture platform (replies/handoffs, `YYMMDDHHMM`-stamped) |
| 90 | `90-memory/` | In-repo AI handoff (agent entry point) |

Domain-doc naming in this repo uses the hyphen variant
`arda-{sub}-NNN-slug.md` (`sub` in plat/biz/data/ent; `NNN`: 1xx architecture /
2xx schema-detail / 3xx implementation / 4xx functions), predating and mapped
to the org `{kind}_{domain}_{NNN}_{slug}` form - kept per owner decision
(2026-07-17); the guardrail accepts both.

Type registers (append-only, stable IDs, never renumbered):
- `30-design/decisions/ADR-NNN-*.md` - architecture decisions (current:
  ADR-001, ADR-011; the gap is intentional).
- `60-operations/40-tech-debt.md` - tech-debt register, TD-NNN (current: TD-001).
