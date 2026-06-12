from __future__ import annotations

from typing import Any, Protocol

from .media.audio import TSAudioHandler
from .media.image import TSImageHandler
from .media.three_d import TS3DHandler
from .media.video import TSVideoHandler
from .ts_types import TSAssetPayload, TSAssetStat


class TSAssetHandler(Protocol):
    ts_kind: str
    ts_extensions: set[str]

    def TSBuildDiscoveredPayload(self, ts_asset_stat: TSAssetStat) -> TSAssetPayload: ...
    def TSBuildIndexedPayload(self, ts_asset_stat: TSAssetStat, ts_asset_hash: str) -> TSAssetPayload: ...
    def TSGeneratePreview(self, ts_row: dict[str, Any]) -> str: ...
    def TSExtractMetadata(self, ts_row: dict[str, Any]) -> dict[str, str]: ...


class TSHandlerRegistry:
    def __init__(self, ts_preview_cache, ts_tools) -> None:
        self.ts_handlers = [
            TSImageHandler(ts_preview_cache, ts_tools),
            TSVideoHandler(ts_preview_cache, ts_tools),
            TSAudioHandler(ts_preview_cache, ts_tools),
            TS3DHandler(ts_preview_cache),
        ]
        self.ts_extension_map: dict[str, TSAssetHandler] = {}
        self.ts_kind_map: dict[str, TSAssetHandler] = {}
        for ts_handler in self.ts_handlers:
            for ts_extension in ts_handler.ts_extensions:
                self.ts_extension_map[ts_extension] = ts_handler
            self.ts_kind_map[ts_handler.ts_kind] = ts_handler

    def TSResolveHandler(self, ts_extension: str, ts_kind: str | None):
        ts_handler = self.ts_extension_map.get(str(ts_extension or "").lower())
        if ts_handler is not None:
            return ts_handler
        if ts_kind:
            return self.ts_kind_map.get(ts_kind)
        return None