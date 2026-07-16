#!/usr/bin/env python3
"""Static checks for high-risk deployment contracts in the arda repo.

This is not a shell parser. It verifies concrete safety guardrails that wire the
CI/CD pipeline (.github/workflows), the container image set, and the deploy
package together so they cannot silently drift apart.

Run from repo root, returns non-zero on any violation:

    python scripts/checks/06-check-deploy-contracts.py
"""
from __future__ import annotations

import sys
import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEPLOY_WORKFLOW = ".github/workflows/deploy.yml"
BUILD_WORKFLOW = ".github/workflows/build.yml"
CI_WORKFLOW = ".github/workflows/ci.yml"
SECRET_SCAN_WORKFLOW = ".github/workflows/secret-scan.yml"
PROMOTE_WORKFLOW = ".github/workflows/promote.yml"

# arda owns exactly one image (TLS/proxy moved to the shared public edge, so
# there is no arda-nginx image). The docker-build matrix, the compose image
# references, and the change classifier must all agree on this single image.
EXPECTED_ARDA_IMAGES = {
    "arda-app",
}
EXPECTED_COMPOSE_IMAGE_REFS = (
    "${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/arda-app:${IMAGE_TAG:-latest}",
)

# Source inputs only. A server checkout can hold local runtime files
# (.env.bak.*, generated data, caches); contract checks must never scan those.
SOURCE_SCAN_PATHS: tuple[Path, ...] = (
    Path(".editorconfig"),
    Path(".env.example"),
    Path(".gitattributes"),
    Path("README.md"),
    Path("docker-compose.yml"),
    Path(".github"),
    Path("configs"),
    Path("scripts"),
    Path("services"),
    Path("deploy"),
)
SKIP_DIR_NAMES = {
    ".git",
    ".next",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    "node_modules",
    "data",
    "backup",
    "private",
    "runtime",
    "generated",
}
SKIP_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".pem",
    ".key",
    ".crt",
    ".csr",
    ".p12",
    ".pfx",
    ".log",
}
SKIP_NAME_SUFFIXES = (".bak", ".backup", ".old", ".tmp", ".swp", ".swo")


CHECKS: list[tuple[str, Path, list[str]]] = [
    (
        "deploy triggers on beta-*/v*.*.* tags, passes SHA and secrets",
        Path(DEPLOY_WORKFLOW),
        [
            "beta-*",
            "v*.*.*",
            "${{ github.sha }}",
            "NODE_AUTH_TOKEN",
            "ALIYUN_ACR_USERNAME",
            "ALIYUN_ACR_PASSWORD",
        ],
    ),
    (
        "build workflow builds the owned image with private npm + ACR",
        Path(BUILD_WORKFLOW),
        [
            "name: docker-build",
            "arda-app",
            "NODE_AUTH_TOKEN=${{ secrets.NODE_AUTH_TOKEN }}",
            "vars.ALIYUN_ACR_REGISTRY",
            "vars.ALIYUN_ACR_NAMESPACE",
            "ALIYUN_ACR_USERNAME",
            "ALIYUN_ACR_PASSWORD",
        ],
    ),
    (
        "build workflow builds an image once and retags by digest for repeat tags",
        Path(BUILD_WORKFLOW),
        [
            "Decide build vs retag",
            "steps.decide.outputs.build == 'true'",
            "steps.decide.outputs.build == 'false'",
            "docker buildx imagetools create",
        ],
    ),
    (
        "deploy routes tag prefix to environment (beta-*->beta, v*.*.*->production)",
        Path(DEPLOY_WORKFLOW),
        [
            "environment=beta",
            "environment=production",
            "name: ${{ needs.detect.outputs.environment }}",
        ],
    ),
    (
        "deploy job consumes build output with GHCR primary and ACR fallback",
        Path(DEPLOY_WORKFLOW),
        [
            "name: deploy",
            "needs: [detect, call-build]",
            "packages: read",
            "cancel-in-progress: false",
            'export IMAGE_REGISTRY="$GHCR_REGISTRY"',
            'export IMAGE_NAMESPACE="$GHCR_NAMESPACE"',
            'export FALLBACK_IMAGE_REGISTRY="$ALIYUN_ACR_REGISTRY"',
            'export FALLBACK_IMAGE_NAMESPACE="$ALIYUN_ACR_NAMESPACE"',
            "bash deploy.sh all",
            "bash deploy.sh verify",
            "-o ServerAliveInterval=30",
            "-o ServerAliveCountMax=20",
            "-o ConnectTimeout=30",
        ],
    ),
    (
        "ci quality-gate runs the contract and design-system checks",
        Path(CI_WORKFLOW),
        [
            "name: quality-gate",
            "06-check-deploy-contracts.py",
            "09-check-ds-usage.py --strict",
            "docker compose --env-file .env.example config --quiet",
        ],
    ),
    (
        "ci triggers on pull_request to main and push main (governance #1)",
        Path(CI_WORKFLOW),
        [
            "pull_request:",
            "push:",
            "- main",
        ],
    ),
    (
        "secret-scan workflow runs a pinned full-history gitleaks required check",
        Path(SECRET_SCAN_WORKFLOW),
        [
            "name: gitleaks",
            "fetch-depth: 0",
            "gitleaks detect",
            "--config .gitleaks.toml",
            "--exit-code 1",
        ],
    ),
    (
        "ci audit gate scans the lockfile with a pinned osv-scanner and explicit config",
        Path(CI_WORKFLOW),
        [
            "name: audit",
            "osv-scanner scan",
            "-L portals/package-lock.json",
            "--config .osv-scanner.toml",
        ],
    ),
    (
        "deploy env loader resolves repository root and sources the operator env",
        Path("deploy/lib/01-env.sh"),
        [
            "PROJECT_ROOT=",
            "$PROJECT_ROOT/etc/.env",
        ],
    ),
]


# Forbidden substrings are assembled from fragments so this checker file itself
# never contains the literal it is searching for (which would self-match).
FORBIDDEN: list[tuple[str, Path, str]] = [
    (
        "legacy vpn control panel artifacts must not appear in arda",
        Path("."),
        "marz" + "ban",
    ),
    (
        "legacy vpn protocol destination config must not appear in arda",
        Path("."),
        "REAL" + "ITY_DEST",
    ),
    (
        "legacy vpn core config must not appear in arda",
        Path("."),
        "xray_" + "config",
    ),
    (
        "legacy udp obfuscation config must not appear in arda",
        Path("."),
        "hys" + "teria",
    ),
    (
        "legacy subscription proxy service must not appear in arda",
        Path("."),
        "sub" + "proxy",
    ),
    (
        "legacy rule-set subscription template must not appear in arda",
        Path("."),
        "clash-" + "subscription",
    ),
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def should_skip(path: Path) -> bool:
    rel_path = path.relative_to(PROJECT_ROOT)
    rel_parts = rel_path.parts
    if any(part in SKIP_DIR_NAMES for part in rel_parts):
        return True

    name = path.name
    if name.startswith(".env") and name != ".env.example":
        return True
    if ".bak." in name or name.endswith(SKIP_NAME_SUFFIXES):
        return True
    if path.suffix.lower() in SKIP_SUFFIXES:
        return True
    return False


def iter_text_files(root: Path):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if should_skip(path):
            continue
        yield path


def iter_source_files():
    for rel_path in SOURCE_SCAN_PATHS:
        path = PROJECT_ROOT / rel_path
        if path.is_file():
            if not should_skip(path):
                yield path
            continue
        if path.is_dir():
            yield from iter_text_files(path)


def non_ascii_locations(text: str) -> list[tuple[int, str]]:
    locations: list[tuple[int, str]] = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        if any(ord(ch) > 127 for ch in line):
            locations.append((line_no, line.strip()))
    return locations


def check_compose_image_refs() -> list[str]:
    path = PROJECT_ROOT / "docker-compose.yml"
    if not path.exists():
        return ["[docker-compose.yml] not found"]
    text = read(path)
    problems: list[str] = []
    for ref in EXPECTED_COMPOSE_IMAGE_REFS:
        if ref not in text:
            problems.append(f"docker-compose.yml must reference owned image {ref!r}")
    return problems


def check_docker_build_image_matrix() -> list[str]:
    path = PROJECT_ROOT / BUILD_WORKFLOW
    if not path.exists():
        return [f"[{BUILD_WORKFLOW}] not found"]
    text = read(path)
    matrix_images = set(re.findall(r"^\s+- image: (arda-[a-z0-9-]+)\s*$", text, flags=re.MULTILINE))
    problems: list[str] = []
    if matrix_images != EXPECTED_ARDA_IMAGES:
        problems.append(
            "docker-build matrix images must be exactly "
            f"{sorted(EXPECTED_ARDA_IMAGES)!r}; got {sorted(matrix_images)!r}"
        )

    required_tag_patterns = (
        "ghcr.io/${{ env.GHCR_NAMESPACE }}/${{ matrix.image }}:${{ steps.meta.outputs.image_tag }}",
        "ghcr.io/${{ env.GHCR_NAMESPACE }}/${{ matrix.image }}:${{ steps.meta.outputs.ref_tag }}",
        "${{ env.ACR_REGISTRY }}/${{ env.ACR_NAMESPACE }}/${{ matrix.image }}:${{ steps.meta.outputs.image_tag }}",
        "${{ env.ACR_REGISTRY }}/${{ env.ACR_NAMESPACE }}/${{ matrix.image }}:${{ steps.meta.outputs.ref_tag }}",
    )
    missing_tags = [tag for tag in required_tag_patterns if tag not in text]
    if missing_tags:
        problems.append(f"docker-build must publish GHCR and ACR sha/branch tags: missing {missing_tags!r}")
    return problems


def check_promote_workflow_retired() -> list[str]:
    # branch-promotion (develop -> main fast-forward) has no place in the
    # trunk-based model - deploys are tag-triggered, not promoted between
    # branches. Its reappearance means gitflow crept back in.
    path = PROJECT_ROOT / PROMOTE_WORKFLOW
    if path.exists():
        return [f"[{PROMOTE_WORKFLOW}] must not exist in the trunk-based model"]
    return []


def check_classifier_removed() -> list[str]:
    # The path-based change classifier belonged to the branch-push deploy
    # model (skip a deploy if nothing deployable changed). Tag pushes are
    # already a deliberate release action, so it was retired along with
    # release.yml - its reappearance means the old gating logic crept back.
    path = PROJECT_ROOT / "scripts/checks/classify_changes.py"
    if path.exists():
        return ["[scripts/checks/classify_changes.py] must not exist in the tag-triggered model"]
    return []


def check_env_example_is_source_safe() -> list[str]:
    # The production deploy sources .env via bash (set -a; source .env). A bare
    # multi-word value like `KEY=a b c` makes bash run `b c` as a command (exit
    # 127), aborting the deploy. docker compose --env-file does not word-split, so
    # this slips past compose validation; guard it here. Values with whitespace
    # must be quoted.
    problems: list[str] = []
    path = PROJECT_ROOT / ".env.example"
    if not path.exists():
        return ["[.env.example] not found"]
    assign = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=(.*)$")
    for line_no, raw in enumerate(read(path).splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = assign.match(line)
        if not m:
            continue
        value = m.group(1)
        if not value:
            continue
        quoted = (value[0] == value[-1] and value[0] in ("'", '"') and len(value) >= 2)
        if not quoted and any(ch.isspace() for ch in value):
            problems.append(f".env.example:{line_no}: unquoted value with whitespace breaks `source`: {line}")
    return problems


CUSTOM_CHECKS = (
    ("env.example is bash-source-safe", check_env_example_is_source_safe),
    ("compose references the owned image", check_compose_image_refs),
    ("docker build matrix publishes the exact owned image", check_docker_build_image_matrix),
    ("branch-promotion workflow retired", check_promote_workflow_retired),
    ("path-based change classifier retired", check_classifier_removed),
)


def main() -> int:
    failed = 0

    for label, rel_path, required in CHECKS:
        path = PROJECT_ROOT / rel_path
        if not path.exists():
            print(f"[FAIL] {label}: missing file {rel_path}")
            failed += 1
            continue

        text = read(path)
        missing = [needle for needle in required if needle not in text]
        if missing:
            print(f"[FAIL] {label}: missing {missing!r}")
            failed += 1
        else:
            print(f"[ OK ] {label}")

    for label, check in CUSTOM_CHECKS:
        problems = check()
        if problems:
            print(f"[FAIL] {label}")
            for problem in problems:
                print(f"[FAIL]   {problem}")
            failed += 1
        else:
            print(f"[ OK ] {label}")

    ascii_failures: list[str] = []
    for path in iter_source_files():
        text = read(path)
        for line_no, line in non_ascii_locations(text):
            rel = path.relative_to(PROJECT_ROOT).as_posix()
            ascii_failures.append(f"{rel}:{line_no}: {line}")
    if ascii_failures:
        print("[FAIL] source maintenance files must use ASCII text")
        for item in ascii_failures[:50]:
            print(f"[FAIL]   {item}")
        if len(ascii_failures) > 50:
            print(f"[FAIL]   ... {len(ascii_failures) - 50} more")
        failed += 1
    else:
        print("[ OK ] source maintenance files use ASCII text")

    for label, rel_path, needle in FORBIDDEN:
        paths = [PROJECT_ROOT / rel_path] if rel_path != Path(".") else list(iter_source_files())
        matches = []
        for path in paths:
            if path.exists() and needle in read(path):
                matches.append(path.relative_to(PROJECT_ROOT).as_posix())
        if matches:
            print(f"[FAIL] {label}: found forbidden token in {matches}")
            failed += 1
        else:
            print(f"[ OK ] {label}")

    if failed:
        print(f"[FAIL] script contract checks failed: {failed}")
        return 1

    print("[ OK ] script contract checks passed")
    return 0


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(
        description="Static checks for high-risk deployment contracts in arda.",
        epilog="Run from repo root: python3 scripts/checks/06-check-deploy-contracts.py",
    )
    parser.parse_args()
    sys.exit(main())
