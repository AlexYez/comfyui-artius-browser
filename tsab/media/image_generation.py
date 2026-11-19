"""Adapters for embedded generation metadata. Precedence is defined at the bottom."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from .prompt_metadata import (
    TSExtractModelsFromPromptField,
    TSExtractPromptPartsFromPromptField,
    TSExtractSeedFromPromptField,
)

TS_GENERATION_TEXT_KEYS = frozenset({
    "prompt", "workflow", "parameters", "comment", "description", "usercomment",
    "invokeai_metadata", "metadata", "generation_data", "generation_parameters",
    "positive_prompt", "negative_prompt", "negative prompt", "seed", "steps",
    "sampler", "scheduler", "cfg_scale", "size", "model", "denoise",
})

_TS_FIELD_LABELS = {
    "seed": "Seed", "noise_seed": "Seed", "steps": "Steps", "cfg": "CFG scale",
    "cfg_scale": "CFG scale", "scale": "CFG scale", "sampler": "Sampler",
    "sampler_name": "Sampler", "scheduler": "Schedule type", "schedule_type": "Schedule type",
    "denoise": "Denoising strength", "denoising_strength": "Denoising strength",
    "size": "Size", "width": "Width", "height": "Height", "model": "Model",
    "strength": "Denoising strength", "guidance_scale": "Guidance scale",
}
_TS_GLOBAL_FIELDS = {"seed", "noise_seed", "width", "height"}
_TS_INFOTEXT_FIELD = re.compile(
    r'[ \t]*([\w][\w ./()\-]{0,79}):[ \t]*("(?:\\.|[^"\\])*"[ \t]*|[^",][^,]*|)(?:,|$)'
)
_TS_NEGATIVE_MARKER = re.compile(r"^\s*Negative prompt:\s*", re.I)
_TS_SAMPLER_WIDGETS = {
    "KSampler": ("seed", "", "steps", "cfg", "sampler_name", "scheduler", "denoise"),
    "KSamplerAdvanced": ("", "noise_seed", "", "steps", "cfg", "sampler_name", "scheduler"),
}


@dataclass
class TSImageGeneration:
    ts_positive: str = ""
    ts_negative: str = ""
    ts_seed: str = ""
    ts_models: list[str] = field(default_factory=list)
    ts_parameters: dict[str, str] = field(default_factory=dict)
    ts_workflow: str = ""
    ts_parameters_are_defaults: bool = False


def _TSJsonObject(ts_value: str) -> dict:
    if not ts_value.lstrip().startswith("{"):
        return {}
    try:
        ts_data = json.loads(ts_value)
    except (ValueError, RecursionError):
        return {}
    return ts_data if isinstance(ts_data, dict) else {}


def _TSString(ts_value) -> str:
    if isinstance(ts_value, str):
        return ts_value.strip()[:16_000]
    if isinstance(ts_value, (int, float)) and not isinstance(ts_value, bool):
        return str(ts_value)
    return ""


def _TSModelName(ts_value) -> str:
    if isinstance(ts_value, dict):
        ts_value = ts_value.get("name") or ts_value.get("model_name")
    return _TSString(ts_value)[:512]


def _TSWorkflow(ts_value) -> str:
    ts_graph = _TSJsonObject(ts_value) if isinstance(ts_value, str) else ts_value
    if isinstance(ts_graph, dict) and isinstance(ts_graph.get("nodes"), list):
        return ts_value.strip() if isinstance(ts_value, str) else json.dumps(ts_graph, ensure_ascii=False)
    return ""


def _TSNativePrompt(ts_text: str) -> TSImageGeneration:
    ts_data = _TSJsonObject(ts_text)
    if not ts_data or not any(isinstance(ts_node, dict) and isinstance(ts_node.get("inputs"), dict)
                              for ts_node in ts_data.values()):
        return TSImageGeneration()
    try:
        ts_positive, ts_negative = TSExtractPromptPartsFromPromptField(ts_text)
    except RecursionError:
        ts_positive, ts_negative = "", ""
    ts_seed = TSExtractSeedFromPromptField(ts_text)
    ts_params: dict[str, str] = {}
    for ts_node in ts_data.values():
        if not isinstance(ts_node, dict) or not isinstance(ts_node.get("inputs"), dict):
            continue
        if not ({"seed", "noise_seed", "sampler_name", "scheduler", "denoise", "cfg"} & ts_node["inputs"].keys()):
            continue
        for ts_key, ts_value in ts_node["inputs"].items():
            ts_label = _TS_FIELD_LABELS.get(ts_key)
            ts_text_value = _TSString(ts_value)
            if ts_label and ts_text_value and ts_key not in _TS_GLOBAL_FIELDS and ts_key != "model":
                ts_values = ts_params.get(ts_label, "").split(" / ")
                if ts_text_value not in ts_values:
                    ts_params[ts_label] = " / ".join(filter(None, [*ts_values, ts_text_value]))[:4096]
    if ts_seed:
        ts_params["Seed"] = ts_seed
    return TSImageGeneration(ts_positive, ts_negative, ts_seed, TSExtractModelsFromPromptField(ts_text), ts_params)


def _TSInfotext(ts_text: str) -> TSImageGeneration:
    ts_lines = ts_text.strip().splitlines()
    if not ts_lines or not ts_lines[-1].lstrip().lower().startswith("steps:"):
        return TSImageGeneration()
    ts_params = {}
    ts_footer = ts_lines.pop()
    if len(ts_footer) > 65_536:
        return TSImageGeneration()
    ts_offset = 0
    # Require a complete footer, including quoted comma-separated values.
    # This prevents an ordinary prompt line beginning "Steps:" from taking over.
    for _ in range(128):
        if ts_offset == len(ts_footer):
            break
        ts_match = _TS_INFOTEXT_FIELD.match(ts_footer, ts_offset)
        if not ts_match:
            return TSImageGeneration()
        ts_key, ts_value = (ts_part.strip() for ts_part in ts_match.groups())
        if ts_value.startswith('"'):
            try:
                ts_value = json.loads(ts_value)
            except ValueError:
                pass
        ts_params[ts_key] = ts_value.strip()[:4096]
        ts_offset = ts_match.end()
    if ts_offset != len(ts_footer):
        return TSImageGeneration()
    ts_normal = {ts_key.lower(): ts_value for ts_key, ts_value in ts_params.items()}
    if not ts_normal.get("steps", "").isdigit() or not {"sampler", "seed", "size", "cfg scale"} & ts_normal.keys():
        return TSImageGeneration()
    ts_positive: list[str] = []
    ts_negative: list[str] = []
    ts_target = ts_positive
    for ts_line in ts_lines:
        if ts_target is ts_positive and (ts_marker := _TS_NEGATIVE_MARKER.match(ts_line)):
            ts_target = ts_negative
            ts_line = ts_line[ts_marker.end():]
        ts_target.append(ts_line)
    ts_model = _TSModelName(ts_normal.get("model"))
    return TSImageGeneration(
        "\n".join(ts_positive).strip()[:16_000], "\n".join(ts_negative).strip()[:16_000],
        ts_normal.get("seed", ""), [ts_model] if ts_model else [], ts_params,
    )


def _TSStructured(ts_data: dict, ts_description: str = "") -> TSImageGeneration:
    ts_positive = _TSString(ts_data.get("positive_prompt") or ts_data.get("positive") or ts_data.get("prompt"))
    ts_negative = _TSString(ts_data.get("negative_prompt") or ts_data.get("negative") or ts_data.get("uc"))
    if not ts_positive and ts_description and "uc" in ts_data and "seed" in ts_data:
        ts_positive = _TSString(ts_description)
    ts_settings = ts_data.get("parameters")
    ts_fields = {**ts_settings, **ts_data} if isinstance(ts_settings, dict) else ts_data
    ts_parameters = {}
    for ts_key, ts_value in ts_fields.items():
        ts_label = _TS_FIELD_LABELS.get(ts_key)
        ts_text = _TSModelName(ts_value) if ts_key == "model" else _TSString(ts_value)
        if ts_label and ts_text:
            ts_parameters.setdefault(ts_label, ts_text[:4096])
    ts_model = ts_parameters.get("Model", "")
    return TSImageGeneration(
        ts_positive, ts_negative, ts_parameters.get("Seed", ""), [ts_model] if ts_model else [],
        ts_parameters, _TSWorkflow(ts_data.get("workflow")),
    )


def _TSWorkflowDefaults(ts_workflow: str) -> TSImageGeneration:
    """Read known built-in widgets when the executed graph is unavailable."""
    ts_graph = _TSJsonObject(ts_workflow)
    ts_links = ts_graph.get("links")
    ts_links_by_id: dict[str, list] = {}
    for ts_link in ts_links if isinstance(ts_links, list) else ():
        if isinstance(ts_link, dict):
            ts_link = [ts_link.get("id"), ts_link.get("origin_id"), ts_link.get("origin_slot")]
        if (isinstance(ts_link, list) and len(ts_link) >= 3
                and all(isinstance(ts_part, (str, int)) for ts_part in ts_link[:3])):
            ts_links_by_id[str(ts_link[0])] = [str(ts_link[1]), ts_link[2]]
    ts_native: dict[str, dict] = {}
    for ts_node in ts_graph.get("nodes", []):
        if not isinstance(ts_node, dict) or not isinstance(ts_node.get("id"), (str, int)):
            continue
        ts_type = _TSString(ts_node.get("type"))
        ts_widgets = ts_node.get("widgets_values")
        ts_inputs = {}
        if isinstance(ts_widgets, list):
            ts_fields = _TS_SAMPLER_WIDGETS.get(ts_type, ())
            if ts_type == "CLIPTextEncode":
                ts_fields = ("text",)
            elif ts_type == "CheckpointLoaderSimple":
                ts_fields = ("ckpt_name",)
            ts_inputs.update((ts_key, ts_value) for ts_key, ts_value in zip(ts_fields, ts_widgets) if ts_key)
        ts_node_inputs = ts_node.get("inputs")
        if isinstance(ts_node_inputs, list):
            for ts_port in ts_node_inputs:
                if isinstance(ts_port, dict) and isinstance(ts_port.get("name"), str):
                    ts_link = ts_links_by_id.get(str(ts_port.get("link")))
                    if ts_link:
                        ts_inputs[ts_port["name"]] = ts_link
        ts_native[str(ts_node["id"])] = {"inputs": ts_inputs, "class_type": ts_type, "title": ts_node.get("title")}
    return _TSNativePrompt(json.dumps(ts_native, ensure_ascii=False))


def TSResolveImageGeneration(ts_entries: dict[str, str]) -> TSImageGeneration:
    ts_prompt = ts_entries.get("prompt", "")
    ts_description = ts_entries.get("description", "")
    ts_result = TSImageGeneration(ts_workflow=_TSWorkflow(ts_entries.get("workflow")))
    ts_seen_params: set[str] = set()
    # Native executed ComfyUI data wins. Recognized producer records supply
    # missing fields, then explicit JSON/text fields. Workflow is independent:
    # infotext and a ComfyUI API prompt are not editable workflow graphs.
    ts_prompt_infotext = _TSInfotext(ts_prompt)
    ts_sources = [_TSNativePrompt(ts_prompt)]
    for ts_key in ("parameters", "usercomment", "comment", "description"):
        ts_sources.append(_TSInfotext(ts_entries.get(ts_key, "")))
    ts_sources.append(ts_prompt_infotext)
    for ts_key in ("invokeai_metadata", "generation_data", "generation_parameters", "metadata",
                   "parameters", "prompt", "comment", "usercomment", "description"):
        ts_sources.append(_TSStructured(_TSJsonObject(ts_entries.get(ts_key, "")), ts_description))
    ts_explicit = dict(ts_entries)
    # Leave arbitrary JSON and full infotext to their own adapters.
    ts_explicit["prompt"] = "" if ts_prompt.lstrip().startswith(("{", "[")) or ts_prompt_infotext.ts_parameters else ts_prompt
    ts_explicit["negative_prompt"] = ts_entries.get("negative_prompt") or ts_entries.get("negative prompt", "")
    ts_sources.append(_TSStructured(ts_explicit))
    for ts_source in ts_sources:
        ts_result.ts_positive = ts_result.ts_positive or ts_source.ts_positive
        ts_result.ts_negative = ts_result.ts_negative or ts_source.ts_negative
        ts_result.ts_seed = ts_result.ts_seed or ts_source.ts_seed
        ts_result.ts_models = ts_result.ts_models or ts_source.ts_models
        ts_result.ts_workflow = ts_result.ts_workflow or ts_source.ts_workflow
        for ts_label, ts_value in ts_source.ts_parameters.items():
            ts_key = ts_label.casefold()
            if ts_key not in ts_seen_params and len(ts_result.ts_parameters) < 128:
                ts_seen_params.add(ts_key)
                ts_result.ts_parameters[ts_label] = ts_value
    if ts_result.ts_workflow and not (ts_result.ts_positive or ts_result.ts_negative or ts_result.ts_parameters):
        ts_defaults = _TSWorkflowDefaults(ts_result.ts_workflow)
        ts_result.ts_positive = ts_defaults.ts_positive
        ts_result.ts_negative = ts_defaults.ts_negative
        ts_result.ts_models = ts_result.ts_models or ts_defaults.ts_models
        ts_result.ts_parameters = ts_defaults.ts_parameters
        ts_result.ts_parameters_are_defaults = bool(ts_defaults.ts_parameters)
    return ts_result
