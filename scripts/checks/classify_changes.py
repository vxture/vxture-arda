#!/usr/bin/env python3
"""Allow-list change classifier for the release pipeline (release.yml detect).

Given a list of changed file paths (repo-root-relative), decide:

  - deployable    : whether the target environment should run a deploy at all
  - build_images  : which images must be rebuilt (subset of ALL_IMAGES)

Model: allow-list / default-skip. A path ships nothing to the runtime unless a
rule explicitly claims it. Adding a new top-level path is therefore safe by
default (non-deployable) until a rule claims it - the opposite of a deny-list,
where every new path defaults to deploying.

This module is pure and importable; the CLI at the bottom is what release.yml
calls. Keep the rules here as the single source of truth - the workflow holds no
path logic of its own.
"""
from __future__ import annotations

import json
import sys

# Image names, kept in sync with the release.yml build matrix and
# docker-compose.yml. arda owns exactly one image (TLS/proxy moved to the shared
# worker-01 edge, so there is no longer an arda-nginx image).
ALL_IMAGES = (
    "arda-app",
)

# Root-level files that ship nothing to the runtime (build/repo metadata and
# templates; the server keeps its own .env, so .env.example is documentation).
_SKIP_ROOT_FILES = frozenset({
    "LICENSE",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".npmrc",
    ".env.example",
    ".gitleaks.toml",
})

# Prefixes whose changes never reach a runtime image or the deploy step.
_SKIP_PREFIXES = ("docs/", ".claude/", ".github/", "scripts/")

# Prefixes / exact paths that require a deploy but rebuild no image. configs/ is
# now just the edge vhost source artifacts (configs/edge/), which an operator
# installs on worker-01; deploy/ and docker-compose.yml are re-read on the
# server at deploy time. None of these rebuild a runtime image.
_DEPLOY_PREFIXES = ("configs/", "deploy/")
_DEPLOY_FILES = frozenset({"docker-compose.yml"})


def classify_file(path):
    """Classify a single path.

    Returns (kind, images):
      ("image", frozenset(...))  -> deployable, rebuild those images
      ("deploy", frozenset())    -> deployable, rebuild no image
      ("skip", frozenset())      -> non-deployable
      ("unknown", frozenset())   -> claimed by no rule
    """
    # A: image-relevant paths (build context / Dockerfile inputs).
    if path.startswith("portals/app/"):
        return ("image", frozenset({"arda-app"}))
    if path.startswith("portals/packages/") or path in {
        "portals/package.json",
        "portals/package-lock.json",
        "portals/.dockerignore",
    }:
        # Workspace root manifests + internal shared package(s) feed the app
        # image (npm workspaces; @arda/shared is hoisted into the app build).
        return ("image", frozenset({"arda-app"}))

    # B: deployable, no image rebuild.
    if path.startswith(_DEPLOY_PREFIXES) or path in _DEPLOY_FILES:
        return ("deploy", frozenset())

    # C: non-deployable (docs, CI plumbing, repo-side tooling, root metadata).
    if path.startswith(_SKIP_PREFIXES):
        return ("skip", frozenset())
    if "/" not in path and (path.endswith(".md") or path in _SKIP_ROOT_FILES):
        return ("skip", frozenset())

    # Claimed by no rule. At runtime this is treated as non-deployable
    # (default-skip).
    return ("unknown", frozenset())


def classify(files):
    """Aggregate a change set into {deployable, build_images, unknown}."""
    build = set()
    deployable = False
    unknown = []
    for raw in files:
        path = raw.strip()
        if not path:
            continue
        kind, images = classify_file(path)
        if kind == "image":
            build.update(images)
            deployable = True
        elif kind == "deploy":
            deployable = True
        elif kind == "unknown":
            unknown.append(path)
        # "skip" contributes nothing.
    return {
        "deployable": deployable,
        "build_images": sorted(build),
        "unknown": sorted(unknown),
    }


def _main(argv):
    if "--all-images" in argv:
        print(json.dumps(sorted(ALL_IMAGES)))
        return 0
    result = classify(sys.stdin.read().splitlines())
    # release.yml consumes deployable + build_images. Unknowns are omitted here
    # (default-skip).
    print(json.dumps({
        "deployable": result["deployable"],
        "build_images": result["build_images"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
