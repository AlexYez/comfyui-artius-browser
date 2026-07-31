from __future__ import annotations

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
        ts_metadata_payload = {}
        if ts_prompt_text or ts_negative_prompt_text or ts_workflow_text or ts_seed_text or ts_models:
            ts_metadata_payload = {
                "prompt_parts_version": TS_PROMPT_PARTS_VERSION,
                "positive_prompt_text": ts_prompt_text,
                "negative_prompt_text": ts_negative_prompt_text,
                "seed": ts_seed_text,
                "models": ts_models,
            }
        return {
            "metadata": TSJsonDumps(ts_metadata_payload) if ts_metadata_payload else "{}",
            "prompt_text": ts_prompt_text,
            "workflow_text": ts_workflow_text,
            # Newline-joined for the FTS "model_text" column; the structured
            # list stays in the metadata blob for display.
            "model_text": "\n".join(ts_models),
            "has_metadata": True,
        }
