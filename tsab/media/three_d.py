from __future__ import annotations

from .common import TSBuildDiscoveredPayload, TSBuildIndexedPayload
from ..ts_settings import TS_3D_EXTENSIONS
from ..ts_types import TSAssetPayload, TSAssetStat
from ..ts_utils import TSJsonDumps


class TS3DHandler:
    ts_kind = "3d"
    ts_extensions = TS_3D_EXTENSIONS

    def __init__(self, ts_preview_cache) -> None:
        self.ts_preview_cache = ts_preview_cache

    def TSBuildDiscoveredPayload(self, ts_asset_stat: TSAssetStat) -> TSAssetPayload:
        return TSBuildDiscoveredPayload(
            ts_asset_stat,
            self.ts_kind,
            self.ts_preview_cache.TSGetTypePlaceholderPreview(self.ts_kind),
        )

    def TSBuildIndexedPayload(self, ts_asset_stat: TSAssetStat, ts_asset_hash: str) -> TSAssetPayload:
        ts_technical = {
            "kind": self.ts_kind,
            "format_name": ts_asset_stat.ts_extension.lstrip(".").upper(),
        }
        return TSBuildIndexedPayload(
            ts_asset_stat,
            self.ts_kind,
            self.ts_preview_cache.TSGetTypePlaceholderPreview(self.ts_kind),
            ts_asset_hash,
            ts_technical_json=TSJsonDumps(ts_technical),
            ts_has_preview=False,
            ts_has_metadata=True,
        )

    def TSGeneratePreview(self, ts_row) -> str:
        ts_preview_key = self.ts_preview_cache.TSBuildAssetPreviewKey(str(ts_row["hash"] or ""), ts_row["path"])
        return self.ts_preview_cache.TSGenerate3DPoster(ts_row["path"], ts_preview_key)

    def TSExtractMetadata(self, ts_row) -> dict[str, str]:
        return {
            "metadata": "{}",
            "prompt_text": "",
            "has_metadata": True,
        }