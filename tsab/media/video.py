from __future__ import annotations

from pathlib import Path

from .common import TSBuildDiscoveredPayload, TSBuildIndexedPayload
from .probe import TSBuildVideoTechnicalInfo
from .prompt_metadata import (
    TSExtractModelsFromPromptField,
    TSExtractPromptPartsFromPromptField,
    TSExtractSeedFromPromptField,
)
from ..ts_metadata_extract import TSExtractWorkflowText
from ..ts_settings import TS_PROMPT_PARTS_VERSION, TS_VIDEO_EXTENSIONS
from ..ts_types import TSAssetPayload, TSAssetStat
from ..ts_utils import TSJsonDumps

# ComfyUI's SaveVideo / SaveWEBM write the API prompt and the UI graph as
# container tags, under exactly these names and in the same JSON shape the PNG
# chunks carry - so the prompt parsing below is the image path's, unchanged.
TS_VIDEO_PROMPT_TAG = "prompt"
TS_VIDEO_WORKFLOW_TAG = "workflow"


class TSVideoHandler:
    ts_kind = "video"
    ts_extensions = TS_VIDEO_EXTENSIONS

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
        ts_preview_key = self.ts_preview_cache.TSBuildAssetPreviewKey(ts_asset_hash, ts_asset_stat.ts_path)
        ts_probe, ts_preview_path = self.ts_preview_cache.TSGenerateVideoPosterParallel(
            ts_asset_stat.ts_path, ts_preview_key, self.ts_tools
        )
        ts_technical = TSBuildVideoTechnicalInfo(ts_probe, ts_asset_stat.ts_extension)
        ts_has_preview = bool(ts_preview_path) and not self.ts_preview_cache.TSIsPlaceholderPreview(ts_preview_path)
        return TSBuildIndexedPayload(
            ts_asset_stat,
            self.ts_kind,
            ts_preview_path or self.ts_preview_cache.TSGetTypePlaceholderPreview(self.ts_kind),
            ts_asset_hash,
            ts_technical_json=TSJsonDumps(ts_technical),
            ts_duration=ts_technical.get("duration"),
            ts_width=ts_technical.get("width"),
            ts_height=ts_technical.get("height"),
            ts_fps=ts_technical.get("fps"),
            ts_has_preview=ts_has_preview,
            ts_has_metadata=True,
        )

    def TSGeneratePreview(self, ts_row) -> str:
        ts_preview_key = self.ts_preview_cache.TSBuildAssetPreviewKey(str(ts_row["hash"] or ""), ts_row["path"])
        return self.ts_preview_cache.TSGenerateVideoPoster(ts_row["path"], ts_preview_key, self.ts_tools)

    def TSExtractMetadata(self, ts_row) -> dict[str, str]:
        ts_tags = {}
        try:
            ts_tags = self.ts_tools.TSProbeContainerTags(Path(str(ts_row["path"])))
        except Exception:
            # A vanished or unreadable file yields "no metadata" rather than
            # raising through the on-demand ensure chain, matching how the
            # image handler treats a corrupt PNG.
            ts_tags = {}
        ts_prompt_field = ts_tags.get(TS_VIDEO_PROMPT_TAG) or ""
        ts_workflow_field = ts_tags.get(TS_VIDEO_WORKFLOW_TAG) or ""
        ts_prompt_text, ts_negative_prompt_text = TSExtractPromptPartsFromPromptField(ts_prompt_field)
        ts_seed_text = TSExtractSeedFromPromptField(ts_prompt_field)
        ts_models = TSExtractModelsFromPromptField(ts_prompt_field)
        ts_workflow_text = TSExtractWorkflowText({"Workflow": ts_workflow_field}) if ts_workflow_field else ""
        # The version stamp is written even when the file carries no tags at
        # all. That is what makes this run once per video: TSEnsureMetadata
        # treats a missing stamp as "not extracted yet", so an empty blob would
        # re-probe on every single detail view, forever.
        ts_metadata_payload = {
            "prompt_parts_version": TS_PROMPT_PARTS_VERSION,
            "positive_prompt_text": ts_prompt_text,
            "negative_prompt_text": ts_negative_prompt_text,
            "seed": ts_seed_text,
            "models": ts_models,
        }
        return {
            "metadata": TSJsonDumps(ts_metadata_payload),
            "prompt_text": ts_prompt_text,
            "workflow_text": ts_workflow_text,
            "model_text": "\n".join(ts_models),
            "has_metadata": True,
        }
