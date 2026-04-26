from __future__ import annotations

import re
from typing import Any

from .ts_utils import TSJsonDumps, TSMaybeParseJsonText


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
