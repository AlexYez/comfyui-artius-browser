from __future__ import annotations

import json
import math
import os
import re
import threading
import unicodedata
from contextlib import AbstractContextManager, contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator


def TSNormalizeSearchText(ts_value: str | None) -> str:
    """Put text into NFC so a search matches what the filesystem handed us.

    macOS stores filenames decomposed (NFD): "мой" arrives from os.scandir as
    "мо" + "и" + a combining breve, while any keyboard produces the composed
    form. FTS5's unicode61 strips LATIN diacritics, so cafe/grun match either
    way, but it leaves Cyrillic combining marks alone - so "мой" or "ёлка"
    found nothing at all on a Mac. Normalizing both the indexed text and the
    query to NFC makes the two sides comparable; on Windows and Linux, where
    names are already composed, this is a no-op.
    """
    return unicodedata.normalize("NFC", str(ts_value or ""))


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


def TSRowValue(ts_row: Any, ts_key: str, ts_default: Any = None) -> Any:
    """Read a column that may be absent from an older/partial row shape.

    Columns added by an additive migration (model_text, is_favorite) exist in
    every migrated database, but a stale assets_view, a hand-built row in a
    caller, or a test fixture can still lack them. sqlite3.Row raises
    IndexError and a dict raises KeyError; both mean "not present here".
    """
    try:
        return ts_row[ts_key]
    except (IndexError, KeyError):
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


# SQLite stores INTEGER as a signed 64-bit value; binding anything outside
# that range as a query parameter raises OverflowError, which would surface as
# a 500 for what is really malformed client input. Python ints are unbounded,
# so every externally supplied integer that can reach SQL passes through here.
TS_SQLITE_INT_MIN = -(2 ** 63)
TS_SQLITE_INT_MAX = 2 ** 63 - 1


def TSClampToSqliteInt(ts_value: int) -> int:
    return max(TS_SQLITE_INT_MIN, min(TS_SQLITE_INT_MAX, int(ts_value)))


def TSIsSqliteInt(ts_value: int) -> bool:
    return TS_SQLITE_INT_MIN <= ts_value <= TS_SQLITE_INT_MAX


def TSParseMaybeInt(ts_value: Any) -> int | None:
    ts_float = TSParseMaybeFloat(ts_value)
    # isfinite() rather than a bare isnan(): float("9" * 400) is inf, not an
    # error, and int(inf) raises OverflowError - which would escape a query
    # param parser and turn junk input into a 500 instead of a clamp.
    if ts_float is None or not math.isfinite(ts_float):
        return None
    # Clamping (not rejecting) keeps the filter semantics: an absurd
    # min_width simply matches nothing, exactly as the user asked for.
    return TSClampToSqliteInt(int(ts_float))


def TSBuildFTSQuery(ts_text: str) -> str:
    # NFC on the query side; _TSSyncFTSRow does the same for the indexed text.
    ts_tokens = [ts_token for ts_token in re.split(r"\s+", TSNormalizeSearchText(ts_text).strip()) if ts_token]
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
    # Interpret the bound in LOCAL time. The value comes from an
    # <input type="date">, i.e. the calendar day as the user sees it, and it is
    # compared against created_at, which is derived from local filesystem
    # timestamps. Pinning it to UTC shifted every boundary by the machine's
    # offset, so "created today" dropped the first hours of the user's day.
    # A naive datetime's .timestamp() already resolves against the local zone.
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
        self._ts_entries: dict[Any, list[Any]] = {}

    def __call__(self, ts_key: Any) -> "AbstractContextManager[threading.Lock]":
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
    # Out of SQLite's integer range means no such row can exist; treat it like
    # any other junk cursor and serve the first page instead of failing.
    if ts_id_value <= 0 or not TSIsSqliteInt(ts_id_value):
        return None
    return {"sort_value": ts_after_sort_text, "id": ts_id_value}
