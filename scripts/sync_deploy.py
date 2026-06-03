#!/usr/bin/env python3
"""Sync the public / runtime file set from this master working copy into a
ComfyUI deploy directory (``custom_nodes/comfyu-artius-browser``).

The master working copy holds *everything* — runtime code plus the private
development assets (``tests/``, ``project_memory/``, ``doc/``, ``CLAUDE.md`` /
``AGENTS.md``). The deploy must contain *only* the shippable runtime files,
i.e. exactly the set that is tracked in the public repository. Run this after
changing runtime code so the live ComfyUI install matches the master:

    python scripts/sync_deploy.py --target "D:/AiApps/ComfyUI/comfyui/ComfyUI/custom_nodes/comfyu-artius-browser"
    # or, with the target in an env var:
    TS_DEPLOY_DIR="D:/.../comfyu-artius-browser" python scripts/sync_deploy.py
    # preview without touching anything:
    python scripts/sync_deploy.py --target "D:/..." --dry-run

Safety:
- nothing happens unless ``--target`` / ``TS_DEPLOY_DIR`` is supplied;
- the target must already look like an Artius Browser install (or pass
  ``--init`` to populate a fresh/empty directory);
- ``.git`` and the runtime cache dirs in the target are never touched.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

TS_ROOT = Path(__file__).resolve().parents[1]

# The public / runtime file set — identical to what the public repo tracks.
# Anything not listed here is development-only and stays in the master.
TS_PUBLIC = [
    "__init__.py",
    "tsab",
    "js",
    "scripts",
    "img",
    ".github",
    "pyproject.toml",
    "requirements.txt",
    "README.md",
    "LICENSE.txt",
    "CHANGELOG.md",
    "icon.png",
    ".comfyignore",
    ".gitignore",
    ".pre-commit-config.yaml",
]

# Entries in the target that are never deleted even though they are not part of
# the public set (a sync must never destroy git history or the runtime cache).
TS_PROTECT = {".git", ".ts_artius_browser", ".asset_browser"}

# Junk that is never copied into the deploy.
TS_COPY_IGNORE = shutil.ignore_patterns(
    "__pycache__", "*.pyc", "*.pyo", "*.log", "*.tmp", "*.bak", "node_modules", "test-results",
)


def _ts_copy(ts_src: Path, ts_dst: Path) -> None:
    if ts_src.is_dir():
        if ts_dst.exists():
            shutil.rmtree(ts_dst)
        shutil.copytree(ts_src, ts_dst, ignore=TS_COPY_IGNORE)
    else:
        ts_dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ts_src, ts_dst)


def main() -> int:
    ts_parser = argparse.ArgumentParser(description="Sync runtime files to a ComfyUI deploy dir.")
    ts_parser.add_argument("--target", default=os.environ.get("TS_DEPLOY_DIR"))
    ts_parser.add_argument("--init", action="store_true", help="allow populating a fresh/empty target")
    ts_parser.add_argument("--dry-run", action="store_true", help="print actions without changing files")
    ts_args = ts_parser.parse_args()

    if not ts_args.target:
        print("error: pass --target or set TS_DEPLOY_DIR (the custom_nodes/comfyu-artius-browser path)")
        return 2

    ts_target = Path(ts_args.target).resolve()
    if ts_target == TS_ROOT:
        print("error: target must differ from the master working copy")
        return 2

    ts_looks_like_install = (ts_target / "__init__.py").exists() and (ts_target / "tsab").is_dir()
    if ts_target.exists() and not ts_looks_like_install and not ts_args.init:
        print(f"error: {ts_target} does not look like an Artius Browser install; pass --init to populate it")
        return 2

    print(f"master: {TS_ROOT}")
    print(f"deploy: {ts_target}{'  (dry-run)' if ts_args.dry_run else ''}")
    if not ts_args.dry_run:
        ts_target.mkdir(parents=True, exist_ok=True)

    ts_missing = [ts_name for ts_name in TS_PUBLIC if not (TS_ROOT / ts_name).exists()]
    if ts_missing:
        print(f"warning: not present in master, skipped: {', '.join(ts_missing)}", file=sys.stderr)

    for ts_name in TS_PUBLIC:
        ts_src = TS_ROOT / ts_name
        if not ts_src.exists():
            continue
        print(f"  copy   {ts_name}")
        if not ts_args.dry_run:
            _ts_copy(ts_src, ts_target / ts_name)

    if ts_target.exists():
        ts_public = set(TS_PUBLIC)
        for ts_entry in sorted(ts_path.name for ts_path in ts_target.iterdir()):
            if ts_entry in ts_public or ts_entry in TS_PROTECT:
                continue
            ts_victim = ts_target / ts_entry
            print(f"  remove {ts_entry}")
            if not ts_args.dry_run:
                if ts_victim.is_dir():
                    shutil.rmtree(ts_victim)
                else:
                    ts_victim.unlink()

    print("done" + (" (dry-run)" if ts_args.dry_run else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
