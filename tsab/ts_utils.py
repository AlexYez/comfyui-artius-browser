from __future__ import annotations

import json
import math
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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


def TSExtractFFProbePayload(ts_value: Any) -> dict[str, Any]:
    if isinstance(ts_value, str):
        ts_parsed_json = TSMaybeParseJsonText(ts_value)
        if ts_parsed_json is None:
            return {}
        return TSExtractFFProbePayload(ts_parsed_json)
    if not isinstance(ts_value, dict):
        return {}
    if isinstance(ts_value.get("ffprobe"), dict):
        return ts_value["ffprobe"]
    if isinstance(ts_value.get("format"), dict) or isinstance(ts_value.get("streams"), list):
        return ts_value
    return {}
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
