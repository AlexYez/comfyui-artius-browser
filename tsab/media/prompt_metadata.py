from __future__ import annotations

import json


def TSExtractPromptPartsFromPromptField(ts_prompt_value) -> tuple[str, str]:
    if not isinstance(ts_prompt_value, str):
        return "", ""
    ts_prompt_text = ts_prompt_value.strip()
    if not ts_prompt_text:
        return "", ""
    try:
        ts_prompt_payload = json.loads(ts_prompt_text)
    except json.JSONDecodeError:
        return ts_prompt_text[:16_000], ""

    if not isinstance(ts_prompt_payload, dict):
        return ts_prompt_text[:16_000], ""

    ts_positive_candidates: list[str] = []
    ts_negative_candidates: list[str] = []
    ts_fallback_candidates: list[str] = []
    ts_seen_by_bucket: dict[int, set[str]] = {}

    def TSAddCandidate(ts_bucket: list[str], ts_text_value) -> None:
        if not isinstance(ts_text_value, str):
            return
        ts_text_clean = ts_text_value.strip()
        if not ts_text_clean:
            return
        ts_text_key = " ".join(ts_text_clean.split())
        ts_bucket_key = id(ts_bucket)
        ts_bucket_seen = ts_seen_by_bucket.setdefault(ts_bucket_key, set())
        if not ts_text_key or ts_text_key in ts_bucket_seen:
            return
        ts_bucket_seen.add(ts_text_key)
        ts_bucket.append(ts_text_clean)

    def TSExtractNodeText(ts_node: dict) -> str:
        ts_inputs = ts_node.get("inputs", {}) if isinstance(ts_node.get("inputs"), dict) else {}
        ts_text_value = ts_inputs.get("text")
        if isinstance(ts_text_value, str):
            return ts_text_value
        ts_widgets_values = ts_node.get("widgets_values")
        if isinstance(ts_widgets_values, list) and ts_widgets_values and isinstance(ts_widgets_values[0], str):
            return ts_widgets_values[0]
        return ""

    def TSNormalizePromptKey(ts_text_value: str) -> str:
        return " ".join(ts_text_value.split())

    def TSResolveNodeReference(ts_reference_value) -> str:
        if isinstance(ts_reference_value, (list, tuple)) and ts_reference_value:
            ts_node_reference = str(ts_reference_value[0])
            return ts_node_reference if ts_node_reference in ts_prompt_payload else ""
        if isinstance(ts_reference_value, (str, int)):
            ts_node_reference = str(ts_reference_value)
            return ts_node_reference if ts_node_reference in ts_prompt_payload else ""
        return ""

    ts_text_by_node_id: dict[str, str] = {}

    for ts_node_id, ts_node in ts_prompt_payload.items():
        if not isinstance(ts_node, dict):
            continue
        ts_text_value = TSExtractNodeText(ts_node)
        if not isinstance(ts_text_value, str):
            continue
        ts_text_clean = ts_text_value.strip()
        if not ts_text_clean:
            continue
        ts_text_by_node_id[str(ts_node_id)] = ts_text_clean
        ts_class_type = str(ts_node.get("class_type") or ts_node.get("type") or "").lower()
        ts_meta = ts_node.get("_meta") if isinstance(ts_node.get("_meta"), dict) else {}
        ts_title = str(ts_meta.get("title") or ts_node.get("title") or "").lower()
        ts_name_blob = f"{ts_class_type} {ts_title}"
        if "negative" in ts_name_blob:
            TSAddCandidate(ts_negative_candidates, ts_text_clean)
            continue
        if "positive" in ts_name_blob:
            TSAddCandidate(ts_positive_candidates, ts_text_clean)
            continue
        if "cliptextencode" in ts_name_blob or "textencode" in ts_name_blob or "prompt" in ts_name_blob:
            TSAddCandidate(ts_fallback_candidates, ts_text_clean)

    def TSCollectPromptTextsFromReference(ts_reference_value, ts_visited: set[str] | None = None) -> list[str]:
        ts_reference_id = TSResolveNodeReference(ts_reference_value)
        if not ts_reference_id:
            return []
        ts_seen_nodes = ts_visited if ts_visited is not None else set()
        if ts_reference_id in ts_seen_nodes:
            return []
        ts_seen_nodes.add(ts_reference_id)
        ts_reference_node = ts_prompt_payload.get(ts_reference_id)
        if not isinstance(ts_reference_node, dict):
            return []
        ts_collected: list[str] = []
        ts_direct_text = ts_text_by_node_id.get(ts_reference_id, "")
        if ts_direct_text:
            ts_collected.append(ts_direct_text)
        ts_reference_inputs = ts_reference_node.get("inputs", {}) if isinstance(ts_reference_node.get("inputs"), dict) else {}
        for ts_input_value in ts_reference_inputs.values():
            ts_collected.extend(TSCollectPromptTextsFromReference(ts_input_value, ts_seen_nodes))
        return ts_collected

    for ts_node in ts_prompt_payload.values():
        if not isinstance(ts_node, dict):
            continue
        ts_inputs = ts_node.get("inputs", {}) if isinstance(ts_node.get("inputs"), dict) else {}
        ts_positive_reference = TSResolveNodeReference(ts_inputs.get("positive"))
        ts_negative_reference = TSResolveNodeReference(ts_inputs.get("negative"))
        for ts_positive_text in TSCollectPromptTextsFromReference(ts_positive_reference):
            TSAddCandidate(ts_positive_candidates, ts_positive_text)
        for ts_negative_text in TSCollectPromptTextsFromReference(ts_negative_reference):
            TSAddCandidate(ts_negative_candidates, ts_negative_text)

    def TSIsNodeLinkTuple(ts_value) -> bool:
        if not isinstance(ts_value, list) or len(ts_value) != 2:
            return False
        ts_link_target = ts_value[0]
        if not isinstance(ts_link_target, (str, int)):
            return False
        return str(ts_link_target) in ts_prompt_payload

    if not ts_positive_candidates and not ts_negative_candidates and not ts_fallback_candidates:
        def TSWalkPromptPayload(ts_node, ts_key_hint: str = "") -> None:
            if isinstance(ts_node, dict):
                for ts_key, ts_child in ts_node.items():
                    TSWalkPromptPayload(ts_child, str(ts_key).lower())
                return
            if isinstance(ts_node, list):
                if TSIsNodeLinkTuple(ts_node):
                    return
                for ts_child in ts_node:
                    TSWalkPromptPayload(ts_child, ts_key_hint)
                return
            if not isinstance(ts_node, str):
                return
            if "negative" in ts_key_hint:
                TSAddCandidate(ts_negative_candidates, ts_node)
            elif "positive" in ts_key_hint:
                TSAddCandidate(ts_positive_candidates, ts_node)
            elif ts_key_hint in {"prompt", "text"}:
                TSAddCandidate(ts_fallback_candidates, ts_node)

        TSWalkPromptPayload(ts_prompt_payload)

    # Drop any positive text that leaked into the negative bucket. The negative
    # reference walk recurses through every input, so shared upstream nodes
    # (ConditioningConcat/Combine, region tricks) can pull positive prompt text
    # into ts_negative_candidates and surface it after a line break.
    ts_positive_keys = {TSNormalizePromptKey(ts_text_value) for ts_text_value in ts_positive_candidates}
    if ts_positive_keys:
        ts_negative_candidates = [
            ts_text_value
            for ts_text_value in ts_negative_candidates
            if TSNormalizePromptKey(ts_text_value) not in ts_positive_keys
        ]

    ts_negative_keys = {TSNormalizePromptKey(ts_text_value) for ts_text_value in ts_negative_candidates}
    ts_positive_fallback_candidates = [
        ts_text_value
        for ts_text_value in ts_fallback_candidates
        if TSNormalizePromptKey(ts_text_value) not in ts_negative_keys
    ]
    if ts_positive_candidates:
        ts_positive_prompt = "\n\n".join(ts_positive_candidates)[:16_000]
    elif ts_positive_fallback_candidates:
        ts_positive_prompt = "\n\n".join(ts_positive_fallback_candidates)[:16_000]
    elif not ts_negative_candidates:
        ts_positive_prompt = "\n\n".join(ts_fallback_candidates)[:16_000]
    else:
        ts_positive_prompt = ""
    ts_negative_prompt = "\n\n".join(ts_negative_candidates)[:16_000]
    if ts_positive_prompt and TSNormalizePromptKey(ts_positive_prompt) == TSNormalizePromptKey(ts_negative_prompt):
        ts_negative_prompt = ""
    return ts_positive_prompt, ts_negative_prompt


def _TSNormalizeSeedValue(ts_value) -> str:
    if isinstance(ts_value, bool):
        return ""
    if isinstance(ts_value, int):
        return str(ts_value)
    if isinstance(ts_value, str):
        ts_clean = ts_value.strip()
        if ts_clean and ts_clean.lstrip("-").isdigit():
            return ts_clean
    return ""


def TSExtractSeedFromPromptField(ts_prompt_value) -> str:
    """Collect the generation seed(s) from the API-format PNG ``Prompt`` JSON.

    Reads every node's ``inputs.seed`` / ``inputs.noise_seed`` integer value
    (a linked seed is a ``[node_id, slot]`` list, so the literal value is
    picked up from the upstream provider node instead). Deduplicates while
    preserving order and joins multiple distinct seeds with ", ".
    """
    if not isinstance(ts_prompt_value, str):
        return ""
    ts_prompt_text = ts_prompt_value.strip()
    if not ts_prompt_text:
        return ""
    try:
        ts_prompt_payload = json.loads(ts_prompt_text)
    except json.JSONDecodeError:
        return ""
    if not isinstance(ts_prompt_payload, dict):
        return ""
    ts_seeds: list[str] = []
    ts_seen: set[str] = set()
    for ts_node in ts_prompt_payload.values():
        if not isinstance(ts_node, dict):
            continue
        ts_inputs = ts_node.get("inputs", {})
        if not isinstance(ts_inputs, dict):
            continue
        for ts_seed_key in ("seed", "noise_seed"):
            ts_seed_text = _TSNormalizeSeedValue(ts_inputs.get(ts_seed_key))
            if ts_seed_text and ts_seed_text not in ts_seen:
                ts_seen.add(ts_seed_text)
                ts_seeds.append(ts_seed_text)
    return ", ".join(ts_seeds)
