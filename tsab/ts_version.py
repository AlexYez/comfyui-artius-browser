from __future__ import annotations

import json
import re
import threading
import time
import urllib.request
from http.client import HTTPException
from pathlib import Path
from typing import Any

from .ts_logging import TSLogVerbose

TS_PYPROJECT_PATH = Path(__file__).resolve().parent.parent / "pyproject.toml"
TS_REPOSITORY_URL = "https://github.com/AlexYez/comfyui-artius-browser"
TS_RELEASES_URL = f"{TS_REPOSITORY_URL}/releases"
TS_GITHUB_PYPROJECT_URL = "https://raw.githubusercontent.com/AlexYez/comfyui-artius-browser/main/pyproject.toml"
TS_REGISTRY_NODE_ID = "comfyui-artius-browser"
TS_REGISTRY_INSTALL_URL = f"https://api.comfy.org/nodes/{TS_REGISTRY_NODE_ID}/install"
TS_REMOTE_FETCH_TIMEOUT_SECONDS = 6.0
TS_REMOTE_CACHE_TTL_SECONDS = 3600.0
TS_REMOTE_RETRY_DELAY_SECONDS = 900.0
TS_VERSION_CACHE_FILE_NAME = "version_check.json"

_TS_TOML_TABLE_PATTERN = re.compile(r"^[ \t]*\[([^\r\n\]]+)\]", re.MULTILINE)
_TS_VERSION_LINE_PATTERN = re.compile(r"""^[ \t]*version\s*=\s*(["'])([^"'\r\n]+)\1""", re.MULTILINE)
_TS_STABLE_VERSION_PATTERN = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+")
_TS_VERSION_CACHE_LOCK = threading.Lock()


def _TSExtractVersionFromText(ts_text: str) -> str | None:
    if not isinstance(ts_text, str):
        return None
    ts_tables = list(_TS_TOML_TABLE_PATTERN.finditer(ts_text))
    for ts_index, ts_table in enumerate(ts_tables):
        if ts_table.group(1).strip() == "project":
            ts_end = ts_tables[ts_index + 1].start() if ts_index + 1 < len(ts_tables) else len(ts_text)
            ts_match = _TS_VERSION_LINE_PATTERN.search(ts_text, ts_table.end(), ts_end)
            return (ts_match.group(2).strip() or None) if ts_match else None
    return None


def TSReadLocalVersion() -> str | None:
    try:
        ts_text = TS_PYPROJECT_PATH.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError) as ts_error:
        TSLogVerbose("version.local.read_failed", path=str(TS_PYPROJECT_PATH), error=str(ts_error))
        return None
    return _TSExtractVersionFromText(ts_text)


def TSFetchGitHubVersion() -> str:
    ts_request = urllib.request.Request(
        TS_GITHUB_PYPROJECT_URL,
        headers={"Cache-Control": "no-cache", "User-Agent": "comfyui-artius-browser/version-check"},
    )
    with urllib.request.urlopen(ts_request, timeout=TS_REMOTE_FETCH_TIMEOUT_SECONDS) as ts_response:
        ts_text = ts_response.read().decode("utf-8-sig")
    ts_version = _TSExtractVersionFromText(ts_text)
    if not ts_version or not _TSParseVersionTuple(ts_version):
        raise ValueError("Missing stable project version in GitHub pyproject.toml")
    return ts_version


def TSFetchRegistryVersion() -> str | None:
    ts_request = urllib.request.Request(
        TS_REGISTRY_INSTALL_URL,
        headers={"Accept": "application/json", "User-Agent": "comfyui-artius-browser/version-check"},
    )
    # Use the release offered for installation by the Registry. Its public
    # node metadata and its list filtered by status can name different versions.
    with urllib.request.urlopen(ts_request, timeout=TS_REMOTE_FETCH_TIMEOUT_SECONDS) as ts_response:
        ts_release = json.load(ts_response)
    if not isinstance(ts_release, dict) or not isinstance(ts_release.get("version"), str):
        raise ValueError("Missing version in Registry install response")
    ts_version = ts_release["version"]
    ts_download_url = ts_release.get("downloadUrl")
    if ts_release.get("deprecated") or not isinstance(ts_download_url, str) or not ts_download_url.startswith("https://"):
        return None
    return ts_version if _TSParseVersionTuple(ts_version) else None


def _TSParseVersionTuple(ts_version: str) -> tuple[int, ...]:
    if len(ts_version) > 64 or not _TS_STABLE_VERSION_PATTERN.fullmatch(ts_version):
        return ()
    return tuple(int(ts_part) for ts_part in ts_version.split("."))


def _TSReadVersionCheckFile(ts_cache_dir: Path) -> dict[str, Any]:
    ts_path = ts_cache_dir / TS_VERSION_CACHE_FILE_NAME
    try:
        ts_text = ts_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    except (OSError, UnicodeError) as ts_error:
        TSLogVerbose("version.cache.read_failed", path=str(ts_path), error=str(ts_error))
        return {}
    try:
        ts_payload = json.loads(ts_text)
    except (ValueError, TypeError) as ts_error:
        TSLogVerbose("version.cache.parse_failed", path=str(ts_path), error=str(ts_error))
        return {}
    return ts_payload if isinstance(ts_payload, dict) else {}


def _TSWriteVersionCheckFile(ts_cache_dir: Path, ts_payload: dict[str, Any]) -> None:
    ts_path = ts_cache_dir / TS_VERSION_CACHE_FILE_NAME
    try:
        ts_cache_dir.mkdir(parents=True, exist_ok=True)
        ts_path.write_text(json.dumps(ts_payload, ensure_ascii=False), encoding="utf-8")
    except OSError as ts_error:
        TSLogVerbose("version.cache.write_failed", path=str(ts_path), error=str(ts_error))


def _TSCheckRemoteVersion() -> tuple[str | None, str]:
    try:
        return TSFetchGitHubVersion(), "github"
    except (OSError, HTTPException, ValueError) as ts_error:
        TSLogVerbose("version.remote.fetch_failed", url=TS_GITHUB_PYPROJECT_URL, error=str(ts_error))
    try:
        ts_version = TSFetchRegistryVersion()
        if ts_version:
            return ts_version, "registry"
    except (OSError, HTTPException, ValueError) as ts_error:
        TSLogVerbose("version.remote.fetch_failed", url=TS_REGISTRY_INSTALL_URL, error=str(ts_error))
    return None, "unavailable"


def _TSResolveRemoteVersion(ts_cache_dir: Path) -> tuple[str | None, str]:
    with _TS_VERSION_CACHE_LOCK:
        ts_cached = _TSReadVersionCheckFile(ts_cache_dir)
        ts_checked_at = ts_cached.get("checked_at")
        ts_source = ts_cached.get("source")
        ts_remote = ts_cached.get("remote")
        ts_ttl = TS_REMOTE_CACHE_TTL_SECONDS if ts_source == "github" else TS_REMOTE_RETRY_DELAY_SECONDS
        ts_valid_result = (
            ts_source in ("github", "registry") and isinstance(ts_remote, str) and bool(_TSParseVersionTuple(ts_remote))
        ) or (ts_source == "unavailable" and ts_remote is None)
        ts_now = time.time()
        if (
            ts_valid_result
            and type(ts_checked_at) in (int, float)
            and ts_now - ts_ttl < ts_checked_at <= ts_now
        ):
            return ts_remote, ts_source

        # This runs in a worker thread. Concurrent requests share one check.
        ts_remote, ts_source = _TSCheckRemoteVersion()
        _TSWriteVersionCheckFile(ts_cache_dir, {
            "source": ts_source,
            "checked_at": time.time(),
            "remote": ts_remote,
        })
        return ts_remote, ts_source


def TSCollectVersionInfo(ts_cache_dir: Path) -> dict[str, Any]:
    ts_remote, ts_source = _TSResolveRemoteVersion(ts_cache_dir)
    ts_local = TSReadLocalVersion()
    ts_local_parts = _TSParseVersionTuple(ts_local or "")
    ts_remote_parts = _TSParseVersionTuple(ts_remote or "")
    ts_update_available = bool(ts_local_parts and ts_local_parts < ts_remote_parts)
    TSLogVerbose(
        "version.info",
        local=ts_local,
        remote=ts_remote,
        source=ts_source,
        update_available=ts_update_available,
    )
    return {
        "local": ts_local,
        "remote": ts_remote,
        "update_available": ts_update_available,
        "repository_url": TS_REPOSITORY_URL,
        "release_url": TS_RELEASES_URL,
        "remote_source": ts_source,
        "update_url": TS_REPOSITORY_URL,
    }
