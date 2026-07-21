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
 *   {kind}_{domain}_{NNN}_slug.md     - org underscore domain-doc form (the
 *                                       form NEW domain docs must use, E1)
 *   ADR-NNN* / TD-NNN*                - type registers (append-only IDs)
 *
 * Grandfathered (E1, rectification requirements): the pre-tightening
 * arda-{sub}-NNN-slug.md hyphen form is NO LONGER a blanket-legal form. The
 * existing hyphen-named docs are frozen in docs-numbering-legacy.txt and still
 * pass by exact path; any NEW file using the hyphen form is a violation and
 * must adopt the underscore family instead.
 *
 * Default = report mode (list violations, exit 0); --strict = hard gate
 * (wired into CI quality-gate static-checks).
 */

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DOCS_ROOT = "docs";
const STRICT = process.argv.includes("--strict");

// Root-level non-content whitelist (config/entry files).
const WHITELIST = new Set(["README.md"]);

// Frozen grandfather set of existing arda-{sub}-NNN hyphen-form docs (E1). Read
// from the sibling freeze-list; entries are repo-relative, forward-slash paths.
// A file passes ONLY if it is listed here by exact path - new hyphen-form files
// are not, so they fail and must use the underscore family.
const LEGACY_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "docs-numbering-legacy.txt",
);
let LEGACY = new Set();
try {
  LEGACY = new Set(
    readFileSync(LEGACY_FILE, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );
} catch {
  // No freeze-list: treat as empty (every hyphen-form doc then flags).
}

const NUMBERED = [
  /^\d{2,3}-.+\.md$/u, // NN(N)-slug.md (includes 00-index.md)
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
  const relPath = relative(".", file).replaceAll("\\", "/");
  if (LEGACY.has(relPath)) return true; // grandfathered hyphen-form doc (E1)
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
    `\n[docs-numbering] STRICT: unnumbered file = violation - number it` +
      ` (NN-slug / {kind}_{domain}_{NNN}_slug / ADR-NNN / TD-NNN) or delete it.` +
      ` The arda-{sub}-NNN hyphen form is retired for new docs (E1).`,
  );
  process.exit(1);
}
console.log(`\n[docs-numbering] report mode (not blocking). Wire --strict into CI when clean.`);
process.exit(0);
