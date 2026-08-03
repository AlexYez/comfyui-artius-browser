from __future__ import annotations

import json

from PIL import Image

from .common import TSBuildDiscoveredPayload, TSBuildIndexedPayload
from .prompt_metadata import (
    TSExtractModelsFromPromptField,
    TSExtractPromptPartsFromPromptField,
    TSExtractSeedFromPromptField,
)
from ..ts_metadata_extract import TSExtractWorkflowText
from ..ts_settings import TS_IMAGE_EXTENSIONS, TS_PROMPT_PARTS_VERSION
from ..ts_types import TSAssetPayload, TSAssetStat
from ..ts_utils import TSJsonDumps

# The only PNG text keys this handler reads (see TSExtractMetadata). Used to
# decide whether the expensive post-IDAT text-chunk read is worth doing.
TS_PNG_METADATA_KEYS = ("Prompt", "prompt", "Workflow", "workflow")


# [AI agent] Session snapshot written by TS Image Studio (comfyui-timesaver).
# It sits in its own PNG text chunk beside ComfyUI's Prompt/Workflow, so an
# image made in the studio can be told apart from any other render and shown
# with the mode it was made in. Images without the chunk are unaffected — the
# browser behaves exactly as it did before.
TS_STUDIO_CHUNK_KEY = "ts_studio"
TS_STUDIO_APP_ID = "ts-image-studio"


def TSExtractStudioSession(ts_metadata: dict[str, str]) -> dict[str, str]:
    """The studio tag for a render, or {} for anything not made in it.

    Only the few fields a browser can display are kept: the whole snapshot
    stays in the file, where the studio itself reads it back from.
    """
    ts_raw = ts_metadata.get(TS_STUDIO_CHUNK_KEY) or ""
    if not ts_raw:
        return {}
    try:
        ts_snapshot = json.loads(ts_raw)
    except Exception:
        # A damaged chunk costs the tag, never the rest of the metadata.
        return {}
    if not isinstance(ts_snapshot, dict):
        return {}
    ts_mode = str(ts_snapshot.get("ui_mode") or ts_snapshot.get("mode") or "").strip()
    if not ts_mode:
        return {}
    ts_values = ts_snapshot.get("values")
    ts_tag = {
        "app": TS_STUDIO_APP_ID,
        "mode": ts_mode,
        "backend_mode": str(ts_snapshot.get("mode") or "").strip(),
        "family": str(ts_snapshot.get("family") or "").strip(),
        "family_label": str(ts_snapshot.get("family_label") or "").strip(),
        "backend": str(ts_snapshot.get("backend") or "").strip(),
    }
    if isinstance(ts_values, dict):
        # Settings worth seeing at a glance; everything else is a click away.
        for ts_key in ("seed", "steps", "cfg", "denoise", "width", "height"):
            ts_value = ts_values.get(ts_key)
            if isinstance(ts_value, (int, float, str)) and str(ts_value) != "":
                ts_tag[ts_key] = ts_value
    ts_loras = ts_snapshot.get("loras")
    if isinstance(ts_loras, list) and ts_loras:
        ts_tag["lora_count"] = len(ts_loras)
    return ts_tag


def _TSCollectMetadataEntries(ts_metadata: dict[str, str], ts_source: dict) -> None:
    for ts_key, ts_value in ts_source.items():
        if ts_value is None:
            continue
        if isinstance(ts_value, bytes):
            try:
                ts_text = ts_value.decode("utf-8", errors="replace")
            except Exception:
                continue
        else:
            ts_text = str(ts_value)
        if not ts_text:
            continue
        ts_metadata[str(ts_key)] = ts_text


class TSImageHandler:
    ts_kind = "image"
    ts_extensions = TS_IMAGE_EXTENSIONS

    def __init__(self, ts_preview_cache, ts_tools) -> None:
        self.ts_preview_cache = ts_preview_cache
        self.ts_tools = ts_tools

    def TSBuildDiscoveredPayload(self, ts_asset_stat: TSAssetStat) -> TSAssetPayload:
        return TSBuildDiscoveredPayload(
            ts_asset_stat,
            self.ts_kind,
            self.ts_preview_cache.TSGetTypePlaceholderPreview(self.ts_kind),
        )

    def TSBuildIndexedPayload(self, ts_asset_stat: TSAssetStat, ts_asset_hash: str) -> TSAssetPayload:
        ts_width = None
        ts_height = None
        try:
            with Image.open(ts_asset_stat.ts_path) as ts_image:
                ts_width, ts_height = ts_image.size
                try:
                    ts_orientation = int(ts_image.getexif().get(274, 1))
                except Exception:
                    ts_orientation = 1
                if ts_orientation in {5, 6, 7, 8}:
                    ts_width, ts_height = ts_height, ts_width
        except Exception:
            ts_width = None
            ts_height = None
        return TSBuildIndexedPayload(
            ts_asset_stat,
            self.ts_kind,
            self.ts_preview_cache.TSGetTypePlaceholderPreview(self.ts_kind),
            ts_asset_hash,
            ts_width=ts_width,
            ts_height=ts_height,
            ts_has_preview=False,
            ts_has_metadata=False,
        )

    def TSGeneratePreview(self, ts_row) -> str:
        ts_preview_key = self.ts_preview_cache.TSBuildAssetPreviewKey(str(ts_row["hash"] or ""), ts_row["path"])
        return self.ts_preview_cache.TSGenerateImageThumbnail(ts_row["path"], ts_preview_key)

    def _TSReadImageMetadata(self, ts_image_path) -> dict[str, str]:
        ts_metadata: dict[str, str] = {}
        try:
            with Image.open(ts_image_path) as ts_image:
                if isinstance(getattr(ts_image, "info", None), dict):
                    _TSCollectMetadataEntries(ts_metadata, ts_image.info)
                # PngImageFile.text is a property that calls load(), decoding the
                # entire IDAT stream and discarding the pixels, just to reach
                # text chunks stored AFTER the image data. ComfyUI writes
                # Prompt/Workflow BEFORE IDAT, so info already carries them and
                # that decode is pure waste - it doubles the per-image decoding a
                # scan does. Only pay for it when the fields we actually read are
                # missing, which is the third-party-writer case it exists for.
                if not any(ts_key in ts_metadata for ts_key in TS_PNG_METADATA_KEYS):
                    ts_text_chunks = getattr(ts_image, "text", None)
                    if isinstance(ts_text_chunks, dict):
                        _TSCollectMetadataEntries(ts_metadata, ts_text_chunks)
        except Exception:
            # Corrupt or vanished files yield "no metadata" instead of
            # raising through the on-demand ensure chain (mirrors the
            # unreadable-image handling in TSBuildIndexedPayload above).
            return {}
        return ts_metadata

    def TSExtractMetadata(self, ts_row) -> dict[str, str]:
        ts_metadata = self._TSReadImageMetadata(ts_row["path"])
        ts_prompt_field = ts_metadata.get("Prompt") or ts_metadata.get("prompt") or ""
        ts_workflow_field = ts_metadata.get("Workflow") or ts_metadata.get("workflow") or ""
        ts_prompt_text, ts_negative_prompt_text = TSExtractPromptPartsFromPromptField(ts_prompt_field)
        ts_seed_text = TSExtractSeedFromPromptField(ts_prompt_field)
        ts_models = TSExtractModelsFromPromptField(ts_prompt_field)
        ts_workflow_text = TSExtractWorkflowText({"Workflow": ts_workflow_field}) if ts_workflow_field else ""
        ts_studio = TSExtractStudioSession(ts_metadata)
        ts_metadata_payload = {}
        if ts_prompt_text or ts_negative_prompt_text or ts_workflow_text or ts_seed_text or ts_models or ts_studio:
            ts_metadata_payload = {
                "prompt_parts_version": TS_PROMPT_PARTS_VERSION,
                "positive_prompt_text": ts_prompt_text,
                "negative_prompt_text": ts_negative_prompt_text,
                "seed": ts_seed_text,
                "models": ts_models,
            }
            if ts_studio:
                ts_metadata_payload["studio"] = ts_studio
        return {
            "metadata": TSJsonDumps(ts_metadata_payload) if ts_metadata_payload else "{}",
            "prompt_text": ts_prompt_text,
            "workflow_text": ts_workflow_text,
            # Newline-joined for the FTS "model_text" column; the structured
            # list stays in the metadata blob for display.
            "model_text": "\n".join(ts_models),
            "has_metadata": True,
        }
