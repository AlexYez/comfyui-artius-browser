from __future__ import annotations

from PIL import Image

from .common import TSBuildDiscoveredPayload, TSBuildIndexedPayload
from .prompt_metadata import TSExtractPromptPartsFromPromptField
from ..ts_metadata_extract import TSExtractWorkflowText
from ..ts_types import TSAssetPayload, TSAssetStat
from ..ts_utils import TSJsonDumps


class TSImageHandler:
    ts_kind = "image"
    ts_extensions = {".png", ".jpg", ".jpeg", ".webp", ".avif"}

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
        with Image.open(ts_image_path) as ts_image:
            ts_metadata_sources = []
            if isinstance(getattr(ts_image, "info", None), dict):
                ts_metadata_sources.append(ts_image.info)
            if isinstance(getattr(ts_image, "text", None), dict):
                ts_metadata_sources.append(ts_image.text)
            for ts_source in ts_metadata_sources:
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
        return ts_metadata

    def TSExtractMetadata(self, ts_row) -> dict[str, str]:
        ts_metadata = self._TSReadImageMetadata(ts_row["path"])
        ts_prompt_field = ts_metadata.get("Prompt") or ts_metadata.get("prompt") or ""
        ts_workflow_field = ts_metadata.get("Workflow") or ts_metadata.get("workflow") or ""
        ts_prompt_text, ts_negative_prompt_text = TSExtractPromptPartsFromPromptField(ts_prompt_field)
        ts_workflow_text = TSExtractWorkflowText({"Workflow": ts_workflow_field}) if ts_workflow_field else ""
        ts_metadata_payload = {}
        if ts_prompt_text or ts_negative_prompt_text or ts_workflow_text:
            ts_metadata_payload = {
                "prompt_parts_version": 3,
                "positive_prompt_text": ts_prompt_text,
                "negative_prompt_text": ts_negative_prompt_text,
            }
        return {
            "metadata": TSJsonDumps(ts_metadata_payload) if ts_metadata_payload else "{}",
            "prompt_text": ts_prompt_text,
            "workflow_text": ts_workflow_text,
            "has_metadata": True,
        }
