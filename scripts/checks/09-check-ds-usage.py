#!/usr/bin/env python3
"""Design-system usage guardrail for the arda app.

The arda app must consume @vxture/design-system completely: DS React components
plus DS token CSS variables (var(--vx-*)). It must NOT hand-build design
primitives (raw colors, local fonts, local --vx-* token definitions) or
duplicate DS component styles (buttons, cards, badges, inputs, ...). When the
DS lacks something, the fix is to extend the DS package, not to self-build in
the app.

This script reports violations:

    python scripts/checks/09-check-ds-usage.py            # report, exit 0
    python scripts/checks/09-check-ds-usage.py --strict   # exit 1 on findings

It is wired (with --strict) into .github/workflows/ci.yml static-checks so
regressions are blocked.

A line may opt out of a single rule with a trailing "ds-allow" comment, e.g.
    color: #fff; /* ds-allow: vendor canvas fallback */
Use sparingly and explain why.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
# Scanned workspaces (repo-root-relative under portals/). The single app and the
# internal shared package are the surfaces that must stay DS-pure.
SCAN_TARGETS = ("app", "packages/shared")
SCAN_SUBDIRS = ("app", "components", "lib", "src")
SKIP_DIR_NAMES = {"node_modules", ".next", "dist", "build", "__pycache__"}
ALLOW_MARKER = "ds-allow"

# Raw color literals: hex (3/4/6/8 digits) and rgb()/hsl() function forms.
HEX_COLOR = re.compile(r"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])")
FUNC_COLOR = re.compile(r"\b(?:rgba?|hsla?)\(")
# Local definition of a DS token (must come from the DS package).
LOCAL_VX_TOKEN = re.compile(r"(?m)^\s*--vx-[A-Za-z0-9-]+\s*:")
FONT_FACE = re.compile(r"@font-face")
FONT_FAMILY = re.compile(r"\bfont-family\s*:")
NEXT_FONT_IMPORT = re.compile(r"""from\s+["']next/font(?:/google|/local)?["']""")

# Selectors that duplicate DS components; these belong to DS, not app CSS.
COMPONENT_CLASSES = (
    "btn", "card", "section-card", "metric-card", "metric-label", "metric-value",
    "app-badge", "badge", "input", "code-box", "notice", "admin-card",
    "card-title", "card-desc", "card-link",
)
COMPONENT_CLASS_RE = re.compile(
    r"(?:^|[\s,>+~])\.(?:" + "|".join(re.escape(c) for c in COMPONENT_CLASSES) + r")(?![\w-])"
)

REQUIRED_LAYOUT_IMPORTS = (
    "@vxture/design-system/styles/globals.css",
    # arda is a vxture sub-brand; the DS ships brands/vxture.css (no arda.css).
    "@vxture/design-system/styles/brands/vxture.css",
)


class Finding:
    __slots__ = ("target", "path", "line", "rule", "text")

    def __init__(self, target: str, path: Path, line: int, rule: str, text: str) -> None:
        self.target = target
        self.path = path
        self.line = line
        self.rule = rule
        self.text = text


def rel(path: Path) -> str:
    return path.relative_to(PROJECT_ROOT).as_posix()


def iter_files(target: str):
    base = PROJECT_ROOT / "portals" / target
    for sub in SCAN_SUBDIRS:
        root = base / sub
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if any(part in SKIP_DIR_NAMES for part in path.relative_to(PROJECT_ROOT).parts):
                continue
            if path.suffix in (".css", ".ts", ".tsx"):
                yield path


def is_comment(stripped: str) -> bool:
    return stripped.startswith(("/*", "*", "//"))


def selector_opener(stripped: str) -> bool:
    return stripped.endswith("{") or stripped.endswith(",")


def scan_file(target: str, path: Path, findings: list[Finding]) -> None:
    text = path.read_text(encoding="utf-8", errors="replace")
    is_css = path.suffix == ".css"
    for i, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped or is_comment(stripped) or ALLOW_MARKER in line:
            continue

        if HEX_COLOR.search(line) or FUNC_COLOR.search(line):
            findings.append(Finding(target, path, i, "raw-color", stripped))

        if is_css:
            if LOCAL_VX_TOKEN.search(line):
                findings.append(Finding(target, path, i, "local-vx-token", stripped))
            if FONT_FACE.search(line):
                findings.append(Finding(target, path, i, "local-font-face", stripped))
            elif FONT_FAMILY.search(line) and "var(--" not in line:
                findings.append(Finding(target, path, i, "literal-font-family", stripped))
            if selector_opener(stripped) and COMPONENT_CLASS_RE.search(line):
                findings.append(Finding(target, path, i, "duplicates-ds-component", stripped))
        else:
            if NEXT_FONT_IMPORT.search(line) and path.name != "layout.tsx":
                findings.append(Finding(target, path, i, "local-font-import", stripped))


def check_required_imports(findings: list[Finding]) -> None:
    layout = PROJECT_ROOT / "portals" / "app" / "app" / "layout.tsx"
    if not layout.is_file():
        return
    text = layout.read_text(encoding="utf-8", errors="replace")
    for needle in REQUIRED_LAYOUT_IMPORTS:
        if needle not in text:
            findings.append(
                Finding("app", layout, 1, "missing-required-import", f"layout must import {needle}")
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Design-system usage guardrail for the arda app.")
    parser.add_argument("--strict", action="store_true", help="exit 1 when findings exist")
    args = parser.parse_args()

    findings: list[Finding] = []
    check_required_imports(findings)
    for target in SCAN_TARGETS:
        for path in iter_files(target):
            scan_file(target, path, findings)

    if not findings:
        print("[ OK ] arda app consumes the design system without self-built primitives")
        return 0

    by_rule: dict[str, list[Finding]] = {}
    by_target: dict[str, int] = {t: 0 for t in SCAN_TARGETS}
    for f in findings:
        by_rule.setdefault(f.rule, []).append(f)
        by_target[f.target] = by_target.get(f.target, 0) + 1

    for rule in sorted(by_rule):
        items = by_rule[rule]
        print(f"[{rule}] {len(items)} finding(s)")
        for f in items:
            print(f"  {rel(f.path)}:{f.line}: {f.text}")
        print("")

    print("Summary by target:")
    for target in SCAN_TARGETS:
        print(f"  {target}: {by_target[target]}")
    print(f"Total findings: {len(findings)}")

    if args.strict:
        print("[FAIL] design-system usage guardrail found violations")
        return 1
    print("[note] report-only mode; pass --strict to fail on findings")
    return 0


if __name__ == "__main__":
    sys.exit(main())
