from __future__ import annotations

import ast
import importlib.util
import json
import pathlib
import py_compile
import re
import shutil
import subprocess
import sys
import unittest


TS_REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
TS_SKIP_DIRS = {".git", ".codex_tmp", ".codex_tmp_esprima", "__pycache__", ".pytest_cache", ".ruff_cache"}


def TSIsSkippedPath(ts_path: pathlib.Path) -> bool:
    return any(ts_part in TS_SKIP_DIRS or ts_part.startswith(".codex_tmp") for ts_part in ts_path.parts)


def TSIterFiles(ts_pattern: str) -> list[pathlib.Path]:
    return sorted(
        ts_path
        for ts_path in TS_REPO_ROOT.rglob(ts_pattern)
        if ts_path.is_file() and not TSIsSkippedPath(ts_path.relative_to(TS_REPO_ROOT))
    )


def TSIterProductionFiles(ts_pattern: str) -> list[pathlib.Path]:
    return [
        ts_path
        for ts_path in TSIterFiles(ts_pattern)
        if ts_path.relative_to(TS_REPO_ROOT).parts[0] != "tests"
    ]


def TSRunCommand(ts_args: list[str]) -> None:
    print("+", " ".join(ts_args))
    subprocess.run(ts_args, cwd=TS_REPO_ROOT, check=True)


def TSCheckPythonSyntax() -> None:
    for ts_path in TSIterProductionFiles("*.py"):
        py_compile.compile(str(ts_path), doraise=True)
    print("python syntax: OK")


def TSCheckPyflakes() -> None:
    if importlib.util.find_spec("pyflakes") is None:
        print("pyflakes: skipped (module not installed)")
        return
    TSRunCommand([sys.executable, "-m", "pyflakes", "."])


def TSCheckJavaScriptSyntax() -> None:
    ts_node = shutil.which("node")
    if not ts_node:
        print("node --check: skipped (node not found)")
        return
    for ts_path in TSIterProductionFiles("*.js"):
        TSRunCommand([ts_node, "--check", str(ts_path.relative_to(TS_REPO_ROOT))])


def TSCheckFrontendCharacterization() -> None:
    ts_node = shutil.which("node")
    if not ts_node:
        print("frontend characterization: skipped (node not found)")
        return
    TSRunCommand([ts_node, "scripts/check_frontend_3d_characterization.mjs"])
    TSRunCommand([ts_node, "scripts/check_frontend_api_characterization.mjs"])
    TSRunCommand([ts_node, "scripts/check_frontend_cache_characterization.mjs"])
    TSRunCommand([ts_node, "scripts/check_frontend_panel_characterization.mjs"])
    TSRunCommand([ts_node, "scripts/check_frontend_viewer_characterization.mjs"])


def TSCheckJsonFiles() -> None:
    for ts_path in TSIterFiles("*.json"):
        json.loads(ts_path.read_text(encoding="utf-8-sig"))
    print("json: OK")


def TSCheckLocalization() -> None:
    ts_locale_path = TS_REPO_ROOT / "js" / "localization" / "en.json"
    ts_locale = json.loads(ts_locale_path.read_text(encoding="utf-8-sig"))
    ts_used_keys: set[str] = set()
    for ts_path in TSIterFiles("*.js"):
        ts_text = ts_path.read_text(encoding="utf-8-sig")
        ts_used_keys.update(re.findall(r'tsT\(\s*"([^"]+)"', ts_text))
        ts_used_keys.update(re.findall(r'\.t\(\s*"([^"]+)"', ts_text))

    for ts_prefix in ("type", "tooltip.type"):
        for ts_suffix in ("image", "video", "audio", "3d"):
            ts_used_keys.add(f"{ts_prefix}.{ts_suffix}")

    ts_missing = sorted(ts_key for ts_key in ts_used_keys if ts_key not in ts_locale)
    ts_unused = sorted(ts_key for ts_key in ts_locale if ts_key not in ts_used_keys)
    if ts_missing or ts_unused:
        if ts_missing:
            print("localization missing:")
            for ts_key in ts_missing:
                print("  ", ts_key)
        if ts_unused:
            print("localization unused:")
            for ts_key in ts_unused:
                print("  ", ts_key)
        raise SystemExit(1)
    print("localization: OK")


def TSCheckTopLevelDeadDefs() -> None:
    ts_py_defs: list[tuple[str, str, int, str]] = []
    ts_py_texts: dict[pathlib.Path, str] = {}
    for ts_path in TSIterProductionFiles("*.py"):
        ts_text = ts_path.read_text(encoding="utf-8-sig")
        ts_py_texts[ts_path] = ts_text
        ts_tree = ast.parse(ts_text)
        for ts_node in ts_tree.body:
            if isinstance(ts_node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                ts_py_defs.append((ts_path.as_posix(), ts_node.name, ts_node.lineno, type(ts_node).__name__))

    ts_js_defs: list[tuple[str, str, int]] = []
    ts_js_texts: dict[pathlib.Path, str] = {}
    ts_function_pattern = re.compile(
        r"^(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*\("
        r"|^(?:export\s+)?async\s+function\s+([A-Za-z_$][\w$]*)\s*\("
        r"|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^\)]*\)\s*=>"
        r"|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b",
        re.M,
    )
    for ts_path in TSIterProductionFiles("*.js"):
        ts_text = ts_path.read_text(encoding="utf-8-sig")
        ts_js_texts[ts_path] = ts_text
        for ts_match in ts_function_pattern.finditer(ts_text):
            ts_name = next(ts_group for ts_group in ts_match.groups() if ts_group)
            ts_lineno = ts_text[: ts_match.start()].count("\n") + 1
            ts_js_defs.append((ts_path.as_posix(), ts_name, ts_lineno))

    ts_counts: dict[str, int] = {}
    for ts_text in ts_py_texts.values():
        for _, ts_name, _, _ in ts_py_defs:
            ts_counts[ts_name] = ts_counts.get(ts_name, 0) + len(re.findall(rf"\b{re.escape(ts_name)}\b", ts_text))
    for ts_text in ts_js_texts.values():
        for _, ts_name, _ in ts_js_defs:
            ts_counts[ts_name] = ts_counts.get(ts_name, 0) + len(re.findall(rf"\b{re.escape(ts_name)}\b", ts_text))

    ts_issues: list[str] = []
    for ts_path, ts_name, ts_lineno, ts_kind in sorted(ts_py_defs):
        if ts_counts.get(ts_name, 0) == 1 and not ts_name.startswith("__"):
            ts_issues.append(f"PY {ts_path}:{ts_lineno}:{ts_kind}:{ts_name}")
    for ts_path, ts_name, ts_lineno in sorted(ts_js_defs):
        if ts_counts.get(ts_name, 0) == 1:
            ts_issues.append(f"JS {ts_path}:{ts_lineno}:{ts_name}")

    if ts_issues:
        print("possible dead top-level definitions:")
        print("\n".join(ts_issues))
        raise SystemExit(1)
    print("top-level dead defs: OK")


def TSCheckGitWhitespace() -> None:
    ts_git = shutil.which("git")
    if not ts_git:
        print("git diff --check: skipped (git not found)")
        return
    TSRunCommand([ts_git, "diff", "--check"])


def TSRunUnitTests() -> None:
    ts_tests_dir = TS_REPO_ROOT / "tests"
    if not ts_tests_dir.exists():
        print("unit tests: skipped (tests directory not found)")
        return
    ts_suite = unittest.defaultTestLoader.discover(str(ts_tests_dir))
    ts_result = unittest.TextTestRunner(verbosity=2).run(ts_suite)
    if not ts_result.wasSuccessful():
        raise SystemExit(1)


def main() -> int:
    TSCheckPythonSyntax()
    TSCheckPyflakes()
    TSCheckJavaScriptSyntax()
    TSCheckFrontendCharacterization()
    TSCheckJsonFiles()
    TSCheckLocalization()
    TSCheckTopLevelDeadDefs()
    TSRunUnitTests()
    TSCheckGitWhitespace()
    print("release checks: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
