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


def TSExtractPromptText(ts_value: Any) -> str:
    ts_positive_candidates: list[str] = []
    ts_generic_candidates: list[str] = []
    ts_seen: set[str] = set()

    def TSNormalizePromptKey(ts_text: str) -> str:
        return re.sub(r"\s+", " ", ts_text).strip()

    def TSAddCandidate(ts_bucket: list[str], ts_text: Any) -> None:
        if not isinstance(ts_text, str):
            return
        ts_original = ts_text.strip()
        ts_clean_key = TSNormalizePromptKey(ts_original)
        if not ts_clean_key or ts_clean_key in ts_seen:
            return
        ts_seen.add(ts_clean_key)
        ts_bucket.append(ts_original)

    def TSExtractPreferredPrompt(ts_node: Any) -> str:
        if not isinstance(ts_node, dict):
            return ""
        for ts_prompt_key in ("Prompt", "prompt"):
            if ts_prompt_key not in ts_node:
                continue
            ts_direct_value = ts_node.get(ts_prompt_key)
            if isinstance(ts_direct_value, str):
                ts_direct_json = TSMaybeParseJsonText(ts_direct_value)
                if ts_direct_json is not None:
                    ts_direct_prompt = TSExtractPromptText(ts_direct_json)
                    if ts_direct_prompt:
                        return ts_direct_prompt[:16_000]
                ts_direct_text = ts_direct_value.strip()
                if ts_direct_text:
                    return ts_direct_text[:16_000]
            elif ts_direct_value is not None:
                ts_direct_prompt = TSExtractPromptText(ts_direct_value)
                if ts_direct_prompt:
                    return ts_direct_prompt[:16_000]
        return ""

    def TSExtractStructuredPrompt(ts_node: Any) -> bool:
        ts_found = False
        if isinstance(ts_node, dict):
            ts_nodes: list[dict[str, Any]] = []
            if isinstance(ts_node.get("nodes"), list):
                ts_nodes.extend(ts_child for ts_child in ts_node["nodes"] if isinstance(ts_child, dict))
            if any(isinstance(ts_child, dict) for ts_child in ts_node.values()):
                ts_nodes.extend(ts_child for ts_child in ts_node.values() if isinstance(ts_child, dict))

            for ts_child_node in ts_nodes:
                ts_class_type = str(ts_child_node.get("class_type") or ts_child_node.get("type") or "").lower()
                ts_title = str(
                    ts_child_node.get("title")
                    or ts_child_node.get("_meta", {}).get("title")
                    or ""
                ).lower()
                ts_name_blob = f"{ts_class_type} {ts_title}"
                ts_inputs = ts_child_node.get("inputs", {}) if isinstance(ts_child_node.get("inputs"), dict) else {}
                ts_text_value = None
                if isinstance(ts_inputs.get("text"), str):
                    ts_text_value = ts_inputs.get("text")
                elif isinstance(ts_child_node.get("widgets_values"), list) and ts_child_node["widgets_values"]:
                    ts_widget_value = ts_child_node["widgets_values"][0]
                    if isinstance(ts_widget_value, str):
                        ts_text_value = ts_widget_value
                if not isinstance(ts_text_value, str):
                    continue
                if "positive" in ts_name_blob:
                    TSAddCandidate(ts_positive_candidates, ts_text_value)
                    ts_found = True
                    continue
                if "cliptextencode" in ts_name_blob or "textencode" in ts_name_blob or "prompt" in ts_name_blob:
                    TSAddCandidate(ts_generic_candidates, ts_text_value)
                    ts_found = True
            if ts_found:
                return True
        return False

    ts_preferred_prompt = TSExtractPreferredPrompt(ts_value)
    if ts_preferred_prompt:
        return ts_preferred_prompt[:16_000]

    def TSWalk(ts_node: Any, ts_key_hint: str = "") -> None:
        if TSExtractStructuredPrompt(ts_node):
            return
        if isinstance(ts_node, dict):
            for ts_key, ts_child in ts_node.items():
                ts_lower_key = str(ts_key).lower()
                if ts_lower_key == "workflow":
                    continue
                if isinstance(ts_child, str):
                    ts_parsed_json = TSMaybeParseJsonText(ts_child)
                    if ts_parsed_json is not None:
                        TSWalk(ts_parsed_json, ts_lower_key)
                        continue
                    if "positive" in ts_lower_key:
                        TSAddCandidate(ts_positive_candidates, ts_child)
                    elif any(ts_token in ts_lower_key for ts_token in ("prompt", "negative", "comment", "parameters")):
                        TSAddCandidate(ts_generic_candidates, ts_child)
                TSWalk(ts_child, ts_lower_key)
            return
        if isinstance(ts_node, list):
            for ts_child in ts_node:
                TSWalk(ts_child, ts_key_hint)
            return
        if isinstance(ts_node, str):
            ts_parsed_json = TSMaybeParseJsonText(ts_node)
            if ts_parsed_json is not None:
                TSWalk(ts_parsed_json, ts_key_hint)
                return
            if "positive" in ts_key_hint:
                TSAddCandidate(ts_positive_candidates, ts_node)
            elif ts_key_hint in {"prompt", "negative"}:
                TSAddCandidate(ts_generic_candidates, ts_node)

    TSWalk(ts_value)
    ts_joined = "\n\n".join(ts_positive_candidates or ts_generic_candidates)
    return ts_joined[:16_000]

def TSExtractWorkflowText(ts_value: Any) -> str:
    ts_seen: set[str] = set()

    def TSNormalizeWorkflowCandidate(ts_candidate: Any) -> str:
        if ts_candidate is None:
            return ""
        if isinstance(ts_candidate, str):
            return ts_candidate.strip()
        if isinstance(ts_candidate, (dict, list)):
            return TSJsonDumps(ts_candidate)
        return str(ts_candidate).strip()

    def TSAddCandidate(ts_candidate: Any) -> str:
        ts_text = TSNormalizeWorkflowCandidate(ts_candidate)
        if not ts_text or ts_text in ts_seen:
            return ""
        ts_seen.add(ts_text)
        return ts_text

    def TSWalk(ts_node: Any) -> str:
        if isinstance(ts_node, dict):
            for ts_key in ("workflow", "Workflow"):
                if ts_key in ts_node:
                    ts_direct_value = ts_node[ts_key]
                    if isinstance(ts_direct_value, str):
                        ts_direct_text = TSAddCandidate(ts_direct_value)
                        if ts_direct_text:
                            return ts_direct_text
                        ts_direct_json = TSMaybeParseJsonText(ts_direct_value)
                        if ts_direct_json is not None:
                            ts_direct_json_text = TSAddCandidate(ts_direct_json)
                            if ts_direct_json_text:
                                return ts_direct_json_text
                    else:
                        ts_direct_text = TSAddCandidate(ts_direct_value)
                        if ts_direct_text:
                            return ts_direct_text
            for ts_child in ts_node.values():
                if isinstance(ts_child, str):
                    ts_child_json = TSMaybeParseJsonText(ts_child)
                    if ts_child_json is not None:
                        ts_nested_text = TSWalk(ts_child_json)
                        if ts_nested_text:
                            return ts_nested_text
                elif isinstance(ts_child, (dict, list)):
                    ts_nested_text = TSWalk(ts_child)
                    if ts_nested_text:
                        return ts_nested_text
            return ""
        if isinstance(ts_node, list):
            for ts_child in ts_node:
                ts_nested_text = TSWalk(ts_child)
                if ts_nested_text:
                    return ts_nested_text
            return ""
        if isinstance(ts_node, str):
            ts_parsed_json = TSMaybeParseJsonText(ts_node)
            if ts_parsed_json is not None:
                return TSWalk(ts_parsed_json)
            return ""
        return ""

    return TSWalk(ts_value)


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


def TSExtractTechnicalInfo(
    ts_value: Any,
    ts_kind: str = "",
    ts_width: Any = None,
    ts_height: Any = None,
    ts_duration: Any = None,
) -> dict[str, Any]:
    ts_probe = TSExtractFFProbePayload(ts_value)
    ts_format = ts_probe.get("format", {}) if isinstance(ts_probe, dict) else {}
    ts_streams = ts_probe.get("streams", []) if isinstance(ts_probe, dict) else []
    ts_video_stream = next(
        (ts_stream for ts_stream in ts_streams if isinstance(ts_stream, dict) and ts_stream.get("codec_type") == "video"),
        {},
    )
    ts_audio_stream = next(
        (ts_stream for ts_stream in ts_streams if isinstance(ts_stream, dict) and ts_stream.get("codec_type") == "audio"),
        {},
    )
    ts_width_value = TSParseMaybeInt(ts_width)
    if ts_width_value is None:
        ts_width_value = TSParseMaybeInt(ts_video_stream.get("width"))
    ts_height_value = TSParseMaybeInt(ts_height)
    if ts_height_value is None:
        ts_height_value = TSParseMaybeInt(ts_video_stream.get("height"))
    ts_duration_value = TSParseMaybeFloat(ts_duration)
    if ts_duration_value is None:
        ts_duration_value = TSParseMaybeFloat(
            ts_format.get("duration")
            or ts_video_stream.get("duration")
            or ts_audio_stream.get("duration")
        )
    ts_bit_rate = TSParseMaybeInt(
        ts_format.get("bit_rate")
        or ts_video_stream.get("bit_rate")
        or ts_audio_stream.get("bit_rate")
    )
    ts_format_name = str(ts_format.get("format_long_name") or ts_format.get("format_name") or "").strip()
    return {
        "kind": ts_kind,
        "format_name": ts_format_name,
        "bit_rate": ts_bit_rate,
        "duration": ts_duration_value,
        "width": ts_width_value,
        "height": ts_height_value,
    }


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
