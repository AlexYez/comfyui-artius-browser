from __future__ import annotations

import json
import re
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .ts_logging import TSLogVerbose

TS_PYPROJECT_PATH = Path(__file__).resolve().parent.parent / "pyproject.toml"
TS_REPOSITORY_URL = "https://github.com/AlexYez/comfyui-artius-browser"
TS_RELEASES_URL = f"{TS_REPOSITORY_URL}/releases"
TS_REMOTE_PYPROJECT_URL = "https://raw.githubusercontent.com/AlexYez/comfyui-artius-browser/main/pyproject.toml"
TS_REMOTE_FETCH_TIMEOUT_SECONDS = 6.0
TS_REMOTE_CACHE_TTL_SECONDS = 86400.0
TS_VERSION_CACHE_FILE_NAME = "version_check.json"

_TS_VERSION_LINE_PATTERN = re.compile(r'^\s*version\s*=\s*["\']([^"\']+)["\']', re.MULTILINE)
_TS_VERSION_NUMERIC_PREFIX = re.compile(r"^\d+")
_TS_LOCAL_VERSION_CACHE: str | None = None
_TS_VERSION_CACHE_LOCK = threading.Lock()


def _TSExtractVersionFromText(ts_text: str) -> str | None:
    if not isinstance(ts_text, str):
        return None
    ts_match = _TS_VERSION_LINE_PATTERN.search(ts_text)
    if ts_match is None:
        return None
    ts_version = ts_match.group(1).strip()
    return ts_version or None


def TSReadLocalVersion() -> str | None:
    global _TS_LOCAL_VERSION_CACHE
    if _TS_LOCAL_VERSION_CACHE is not None:
        return _TS_LOCAL_VERSION_CACHE
    try:
        ts_text = TS_PYPROJECT_PATH.read_text(encoding="utf-8")
    except OSError as ts_error:
        TSLogVerbose("version.local.read_failed", path=str(TS_PYPROJECT_PATH), error=str(ts_error))
        return None
    ts_version = _TSExtractVersionFromText(ts_text)
    if ts_version is not None:
        _TS_LOCAL_VERSION_CACHE = ts_version
    return ts_version


def TSFetchRemoteVersionString() -> str | None:
    ts_request = urllib.request.Request(
        TS_REMOTE_PYPROJECT_URL,
        headers={"User-Agent": "comfyui-artius-browser/version-check"},
    )
    try:
        with urllib.request.urlopen(ts_request, timeout=TS_REMOTE_FETCH_TIMEOUT_SECONDS) as ts_response:
            ts_raw = ts_response.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, OSError) as ts_error:
        TSLogVerbose("version.remote.fetch_failed", url=TS_REMOTE_PYPROJECT_URL, error=str(ts_error))
        return None
    return _TSExtractVersionFromText(ts_raw)


def _TSParseVersionTuple(ts_version: str) -> tuple[int, ...]:
    ts_components: list[int] = []
    for ts_part in str(ts_version or "").split("."):
        ts_match = _TS_VERSION_NUMERIC_PREFIX.match(ts_part.strip())
        if ts_match is None:
            break
        ts_components.append(int(ts_match.group(0)))
    return tuple(ts_components)


def TSCompareVersions(ts_left: str | None, ts_right: str | None) -> int:
    ts_left_tuple = _TSParseVersionTuple(ts_left or "")
    ts_right_tuple = _TSParseVersionTuple(ts_right or "")
    if ts_left_tuple == ts_right_tuple:
        return 0
    return -1 if ts_left_tuple < ts_right_tuple else 1


def _TSReadVersionCheckFile(ts_cache_dir: Path) -> dict[str, Any]:
    ts_path = ts_cache_dir / TS_VERSION_CACHE_FILE_NAME
    try:
        ts_text = ts_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    except OSError as ts_error:
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


def _TSResolveRemoteVersion(ts_cache_dir: Path) -> str | None:
    with _TS_VERSION_CACHE_LOCK:
        ts_now = time.time()
        ts_cached = _TSReadVersionCheckFile(ts_cache_dir)
        ts_last_attempt_at = float(ts_cached.get("last_attempt_at") or 0.0)
        ts_age = ts_now - ts_last_attempt_at
        if 0 <= ts_age < TS_REMOTE_CACHE_TTL_SECONDS:
            ts_remote_value = ts_cached.get("remote")
            return ts_remote_value if isinstance(ts_remote_value, str) else None
        ts_fresh_remote = TSFetchRemoteVersionString()
        ts_updated = dict(ts_cached)
        ts_updated["last_attempt_at"] = ts_now
        if ts_fresh_remote is not None:
            ts_updated["remote"] = ts_fresh_remote
            ts_updated["checked_at"] = ts_now
        _TSWriteVersionCheckFile(ts_cache_dir, ts_updated)
        if ts_fresh_remote is not None:
            return ts_fresh_remote
        ts_stale_remote = ts_cached.get("remote")
        return ts_stale_remote if isinstance(ts_stale_remote, str) else None


def TSCollectVersionInfo(ts_cache_dir: Path) -> dict[str, Any]:
    ts_local = TSReadLocalVersion()
    ts_remote = _TSResolveRemoteVersion(ts_cache_dir)
    ts_update_available = bool(ts_local and ts_remote and TSCompareVersions(ts_local, ts_remote) < 0)
    TSLogVerbose(
        "version.info",
        local=ts_local,
        remote=ts_remote,
        update_available=ts_update_available,
    )
    return {
        "local": ts_local,
        "remote": ts_remote,
        "update_available": ts_update_available,
        "repository_url": TS_REPOSITORY_URL,
        "release_url": TS_RELEASES_URL,
    }
