from __future__ import annotations

from typing import Any, Callable

from .ts_asset_metadata import TSResolveAssetNegativePromptText, TSResolveAssetPromptText, TSResolveAssetWorkflowText
from .ts_asset_payload import TSBuildAssetCard, TSResolveTechnicalInfo
from .ts_asset_technical import TSEnrichAudioTechnicalInfo, TSEnrichVideoTechnicalInfo
from .ts_logging import TSLogVerbose
from .ts_utils import TSJsonLoads


class TSAssetCatalogService:
    def __init__(
        self,
        ts_database,
        ts_preview_cache,
        ts_tools,
        ts_scan_service,
        ts_get_roots: Callable[[], list[dict[str, Any]]],
        ts_ensure_metadata: Callable[[Any], Any],
    ) -> None:
        self.ts_database = ts_database
        self.ts_preview_cache = ts_preview_cache
        self.ts_tools = ts_tools
        self.ts_scan_service = ts_scan_service
        self.ts_get_roots = ts_get_roots
        self.ts_ensure_metadata = ts_ensure_metadata

    def _TSHealthPayload(self) -> list[dict[str, Any]]:
        return [ts_issue.TSAsDict() for ts_issue in self.ts_tools.TSGetHealth()]

    def _TSRootMap(self) -> dict[str, dict[str, Any]]:
        return {ts_root["root_id"]: ts_root for ts_root in self.ts_get_roots()}

    def TSBuildAssetCard(self, ts_row) -> dict[str, Any]:
        return TSBuildAssetCard(ts_row, self._TSRootMap(), self.ts_preview_cache)

    def TSQueryAssets(
        self,
        ts_search_text: str,
        ts_filters: dict[str, Any],
        ts_cursor_after: dict[str, Any] | None,
        ts_limit: int,
        ts_view: str = "flat",
    ) -> dict[str, Any]:
        TSLogVerbose("runtime.assets.query", search_text=ts_search_text, filters=ts_filters, cursor_after=ts_cursor_after, limit=ts_limit, view=ts_view)
        self.ts_scan_service.TSMaybeStartInitialAutoscan()
        ts_rows, ts_has_more, ts_next_cursor = self.ts_database.TSQueryAssetsPage(
            ts_search_text=ts_search_text,
            ts_filters=ts_filters,
            ts_cursor_after=ts_cursor_after,
            ts_limit=ts_limit,
        )
        ts_roots = self._TSRootMap()
        ts_scope_for_tree = None
        ts_root_id_for_tree = None
        if ts_filters.get("scopes") and len(ts_filters["scopes"]) == 1:
            ts_scope_for_tree = ts_filters["scopes"][0]
        if ts_filters.get("root_ids") and len(ts_filters["root_ids"]) == 1:
            ts_root_id_for_tree = ts_filters["root_ids"][0]
        ts_response = {
            "items": [TSBuildAssetCard(ts_row, ts_roots, self.ts_preview_cache) for ts_row in ts_rows],
            "limit": ts_limit,
            "has_more": ts_has_more,
            "next_cursor": ts_next_cursor,
            "view": ts_view,
            "scan_status": self.ts_scan_service.TSGetScanStatus(),
            "health": self._TSHealthPayload(),
            "roots": list(ts_roots.values()),
            "folders": self.ts_database.TSListFolders(ts_scope_for_tree, ts_root_id_for_tree) if ts_view == "tree" else [],
        }
        TSLogVerbose("runtime.assets.response", returned=len(ts_response["items"]), has_more=ts_response["has_more"])
        return ts_response

    def TSGetAssetDetail(self, ts_asset_id: int) -> dict[str, Any] | None:
        TSLogVerbose("runtime.asset.detail", asset_id=ts_asset_id)
        ts_row = self.ts_database.TSGetAssetById(ts_asset_id)
        if ts_row is None:
            return None
        ts_row = self.ts_ensure_metadata(ts_row) or ts_row
        ts_technical_info = TSResolveTechnicalInfo(ts_row)
        if str(ts_row["type"] or "") == "video":
            ts_row, ts_technical_info = TSEnrichVideoTechnicalInfo(ts_row, self.ts_database, self.ts_tools, ts_technical_info)
        elif str(ts_row["type"] or "") == "audio":
            ts_row, ts_technical_info = TSEnrichAudioTechnicalInfo(ts_row, self.ts_database, self.ts_tools, ts_technical_info)
        ts_payload = TSBuildAssetCard(ts_row, self._TSRootMap(), self.ts_preview_cache)
        ts_payload["detail_loaded"] = True
        ts_payload["metadata"] = TSJsonLoads(ts_row["metadata"], {})
        ts_payload["metadata_json"] = ts_row["metadata"]
        ts_payload["prompt_text"] = TSResolveAssetPromptText(ts_row)
        ts_payload["negative_prompt_text"] = TSResolveAssetNegativePromptText(ts_row)
        ts_payload["workflow_text"] = TSResolveAssetWorkflowText(ts_row)
        ts_payload["technical_info"] = ts_technical_info
        return ts_payload
