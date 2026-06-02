from __future__ import annotations

from .common import TSBuildDiscoveredPayload, TSBuildIndexedPayload
from .probe import TSBuildVideoTechnicalInfo
from ..ts_settings import TS_VIDEO_EXTENSIONS
from ..ts_types import TSAssetPayload, TSAssetStat
from ..ts_utils import TSJsonDumps


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
        return {
            "metadata": "{}",
            "prompt_text": "",
            "has_metadata": True,
        }
