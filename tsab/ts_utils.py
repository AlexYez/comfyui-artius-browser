from __future__ import annotations

import json
import math
import os
import re
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


def TSNormalizePathString(ts_path_value: str | os.PathLike[str]) -> str:
    ts_path = Path(ts_path_value).resolve()
    return os.path.normcase(str(ts_path)).replace("\\", "/")


def TSRelativePosixPath(ts_path: Path, ts_root: Path) -> str:
    ts_relative = ts_path.relative_to(ts_root).as_posix()
    return "" if ts_relative == "." else ts_relative


def TSFolderPosixPath(ts_relative_path: str) -> str:
    ts_folder = str(Path(ts_relative_path).parent).replace("\\", "/")
    if ts_folder == ".":
        return ""
    return ts_folder


def TSUnixSecondsFromNanoseconds(ts_nanoseconds: int) -> int:
    return int(ts_nanoseconds // 1_000_000_000)


def TSJsonDumps(ts_value: Any) -> str:
    return json.dumps(ts_value, ensure_ascii=False, sort_keys=True, default=str)


def TSJsonLoads(ts_value: str | None, ts_default: Any) -> Any:
    if not ts_value:
        return ts_default
    try:
        return json.loads(ts_value)
    except json.JSONDecodeError:
        return ts_default


def TSMaybeParseJsonText(ts_value: Any) -> Any | None:
    if not isinstance(ts_value, str):
        return None
    ts_text = ts_value.strip()
    if not ts_text or ts_text[0] not in {"{", "["}:
        return None
    try:
        return json.loads(ts_text)
    except json.JSONDecodeError:
        return None


def TSParseMaybeFloat(ts_value: Any) -> float | None:
    if ts_value is None or ts_value == "":
        return None
    if isinstance(ts_value, (int, float)):
        return float(ts_value)
    ts_text = str(ts_value).strip()
    if not ts_text:
        return None
    if "/" in ts_text:
        try:
            ts_left, ts_right = ts_text.split("/", 1)
            ts_denominator = float(ts_right)
            if ts_denominator == 0:
                return None
            return float(ts_left) / ts_denominator
        except ValueError:
            return None
    ts_match = re.search(r"-?\d+(?:\.\d+)?", ts_text)
    if not ts_match:
        return None
    try:
        return float(ts_match.group(0))
    except ValueError:
        return None


def TSParseMaybeInt(ts_value: Any) -> int | None:
    ts_float = TSParseMaybeFloat(ts_value)
    if ts_float is None or math.isnan(ts_float):
        return None
    return int(ts_float)


def TSBuildFTSQuery(ts_text: str) -> str:
    ts_tokens = [ts_token for ts_token in re.split(r"\s+", ts_text.strip()) if ts_token]
    ts_query_parts: list[str] = []
    for ts_token in ts_tokens:
        ts_clean = ts_token.replace('"', "").replace("'", "")
        if not ts_clean:
            continue
        ts_query_parts.append(f'"{ts_clean}"*')
    return " AND ".join(ts_query_parts)


def TSParseQueryList(ts_value: str | None) -> list[str]:
    if not ts_value:
        return []
    return [ts_item.strip() for ts_item in ts_value.split(",") if ts_item.strip()]


def TSParseDateToEpoch(ts_value: str | None, ts_end_of_day: bool = False) -> int | None:
    if not ts_value:
        return None
    try:
        ts_date = datetime.strptime(ts_value, "%Y-%m-%d")
    except ValueError:
        return None
    if ts_end_of_day:
        ts_date = ts_date.replace(hour=23, minute=59, second=59)
    ts_date = ts_date.replace(tzinfo=timezone.utc)
    return int(ts_date.timestamp())


class TSKeyedLockRegistry:
    """Hand out one lock per key and reclaim it once no caller holds it.

    Prevents unbounded growth of a per-key lock dict on a long-lived server
    with a very large library (asset locks, preview-key locks): an entry is
    created on first use, reference-counted while callers hold the returned
    context manager, and removed when the last holder releases it.

    The reference count is incremented under the guard *before* the handle is
    returned, so an entry can never be evicted while a live handle still points
    at its lock — that invariant is what makes eviction safe. If it were
    dropped, two callers could obtain two different lock objects for the same
    key (one from the dict, one freshly created after eviction) and both enter
    the critical section at once.
    """

    def __init__(self) -> None:
        self._ts_guard = threading.Lock()
        self._ts_entries: dict[Any, list] = {}

    def __call__(self, ts_key: Any):
        with self._ts_guard:
            ts_entry = self._ts_entries.get(ts_key)
            if ts_entry is None:
                ts_entry = [threading.Lock(), 0]
                self._ts_entries[ts_key] = ts_entry
            ts_entry[1] += 1
            ts_lock = ts_entry[0]
        return self._TSHold(ts_key, ts_lock)

    @contextmanager
    def _TSHold(self, ts_key: Any, ts_lock: threading.Lock) -> Iterator[threading.Lock]:
        ts_lock.acquire()
        try:
            yield ts_lock
        finally:
            ts_lock.release()
            with self._ts_guard:
                ts_entry = self._ts_entries.get(ts_key)
                if ts_entry is not None:
                    ts_entry[1] -= 1
                    if ts_entry[1] <= 0:
                        del self._ts_entries[ts_key]


def TSParseAssetCursor(ts_query: Any) -> dict[str, Any] | None:
    ts_after_sort = ts_query.get("after_sort")
    ts_after_id = ts_query.get("after_id")
    if ts_after_sort is None or ts_after_id is None:
        return None
    ts_after_sort_text = str(ts_after_sort)
    if ts_after_sort_text == "":
        return None
    try:
        ts_id_value = int(ts_after_id)
    except (TypeError, ValueError):
        return None
    if ts_id_value <= 0:
        return None
    return {"sort_value": ts_after_sort_text, "id": ts_id_value}
