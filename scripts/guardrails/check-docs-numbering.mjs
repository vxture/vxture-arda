#!/usr/bin/env node
/**
 * check-docs-numbering.mjs - docs/ numbering iron-rule guardrail.
 *
 * Enforces the org docs taxonomy meta-rule (vxture-platform
 * docs/10-standards/070-docs-taxonomy.md): numbered = formal (permanent),
 * unnumbered = temporary (delete on sight). Scans every .md under docs/;
 * anything that is not an index, not whitelisted and matches no legal
 * numbered form is a violation.
 *
 * Legal numbered forms (any one suffices):
 *   00-index.md / NN-slug.md          - in-directory sequence (tens jumps)
 *   arda-{sub}-NNN-slug.md            - arda domain docs (hyphen variant of
 *                                       the org {kind}_{domain}_{NNN} form;
 *                                       kept per owner decision 2026-07-17)
 *   {prefix}_{NNN}_slug.md            - org underscore domain-doc form
 *   ADR-NNN* / TD-NNN*                - type registers (append-only IDs)
 *
 * Default = report mode (list violations, exit 0); --strict = hard gate
 * (wired into CI quality-gate static-checks).
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";

const DOCS_ROOT = "docs";
const STRICT = process.argv.includes("--strict");

// Root-level non-content whitelist (config/entry files).
const WHITELIST = new Set(["README.md"]);

const NUMBERED = [
  /^\d{2,3}-.+\.md$/u, // NN(N)-slug.md (includes 00-index.md)
  /^arda-[a-z]+-\d{3}(-.+)?\.md$/u, // arda-{sub}-NNN-slug (hyphen domain docs)
  /^[a-z][a-z0-9-]*(_[a-z][a-z0-9-]*)?_\d{3}[_.-].*\.md$/u, // {prefix}(_{domain})?_{NNN}_slug
  /^(ADR|TD)-\d{3}.*\.md$/u, // type registers
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function isNumbered(file) {
  const name = basename(file);
  if (WHITELIST.has(name)) return true;
  return NUMBERED.some((re) => re.test(name));
}

let files;
try {
  files = walk(DOCS_ROOT);
} catch {
  console.log(`[docs-numbering] no ${DOCS_ROOT}/ - skip`);
  process.exit(0);
}

const violations = files
  .filter((f) => !isNumbered(f))
  .map((f) => relative(".", f).replaceAll("\\", "/"))
  .sort();

if (violations.length === 0) {
  console.log(`[docs-numbering] OK - ${files.length} docs, all numbered.`);
  process.exit(0);
}

console.log(
  `[docs-numbering] ${violations.length} unnumbered .md (= temporary/to-delete or to-number, see org docs-taxonomy):`,
);
for (const v of violations) console.log(`  ${v}`);

if (STRICT) {
  console.error(
    `\n[docs-numbering] STRICT: unnumbered file = violation - number it (NN-/domain-doc/ADR-.TD-) or delete it.`,
  );
  process.exit(1);
}
console.log(`\n[docs-numbering] report mode (not blocking). Wire --strict into CI when clean.`);
process.exit(0);
