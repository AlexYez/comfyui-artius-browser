from __future__ import annotations

from .common import TSBuildDiscoveredPayload, TSBuildIndexedPayload
from ..ts_types import TSAssetPayload, TSAssetStat
from ..ts_utils import TSJsonDumps, TSParseMaybeFloat, TSParseMaybeInt


class TSVideoHandler:
    ts_kind = "video"
    ts_extensions = {".mp4", ".mov", ".webm", ".prores"}

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
        ts_probe = self.ts_tools.TSRunFFProbe(ts_asset_stat.ts_path)
        ts_streams = ts_probe.get("streams", []) if isinstance(ts_probe, dict) else []
        ts_video_stream = next(
            (ts_stream for ts_stream in ts_streams if isinstance(ts_stream, dict) and ts_stream.get("codec_type") == "video"),
            {},
        )
        ts_format = ts_probe.get("format", {}) if isinstance(ts_probe, dict) else {}
        ts_width = TSParseMaybeInt(ts_video_stream.get("width"))
        ts_height = TSParseMaybeInt(ts_video_stream.get("height"))
        ts_fps = TSParseMaybeFloat(ts_video_stream.get("avg_frame_rate") or ts_video_stream.get("r_frame_rate"))
        ts_duration = TSParseMaybeFloat(ts_format.get("duration") or ts_video_stream.get("duration"))
        ts_technical = {
            "kind": self.ts_kind,
            "format_name": str(ts_format.get("format_long_name") or ts_format.get("format_name") or ts_asset_stat.ts_extension.lstrip(".").upper()),
            "bit_rate": TSParseMaybeInt(ts_format.get("bit_rate") or ts_video_stream.get("bit_rate")),
            "duration": ts_duration,
            "width": ts_width,
            "height": ts_height,
            "fps": ts_fps,
        }
        return TSBuildIndexedPayload(
            ts_asset_stat,
            self.ts_kind,
            self.ts_preview_cache.TSGetTypePlaceholderPreview(self.ts_kind),
            ts_asset_hash,
            ts_technical_json=TSJsonDumps(ts_technical),
            ts_duration=ts_duration,
            ts_width=ts_width,
            ts_height=ts_height,
            ts_fps=ts_fps,
            ts_has_preview=False,
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