from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

from aiohttp import web as TSWeb

from .ts_3d_thumbnail import TSSave3DThumbnail
from .ts_asset_metadata import TSResolveAssetNegativePromptText, TSResolveAssetPromptText, TSResolveAssetWorkflowText
from .ts_asset_payload import TSBuildAssetCard, TSResolveTechnicalInfo
from .ts_asset_processing import TSAssetProcessingService
from .ts_asset_technical import TSEnrichAudioTechnicalInfo, TSEnrichVideoTechnicalInfo
from .ts_browser_settings import TSBrowserSettingsService
from .ts_config import TSConfigStore
from .ts_db import TSDatabase
from .ts_delete import TSDeleteService
from .ts_handlers import TSHandlerRegistry
from .ts_indexer import TSIndexer
from .ts_logging import TSLogVerbose
from .ts_preview import TSPreviewCache
from .ts_routes import TSRegisterRoutes
from .ts_scan_service import TSScanService
from .ts_storage import TSStoragePaths
from .ts_tools import TSToolLocator
from .ts_types import TSAssetStat
from .ts_utils import TSJsonLoads, TSNormalizePathString, TSRelativePosixPath
from .ts_workflows import TSWorkflowService

TSLogger = logging.getLogger("TSArtiusBrowser")
TSRuntimeSingleton = None


class TSAssetBrowserRuntime:
    def __init__(self) -> None:
        self.ts_storage_paths = TSStoragePaths()
        self.ts_config_store = TSConfigStore(self.ts_storage_paths.ts_config_path)
        self.ts_browser_settings = TSBrowserSettingsService(self.ts_config_store)
        self.ts_database = TSDatabase(self.ts_storage_paths.ts_database_path)
        self.ts_tools = TSToolLocator(self.ts_config_store)
        self.ts_preview_cache = TSPreviewCache(self.ts_storage_paths, self.ts_config_store)
        self.ts_handler_registry = TSHandlerRegistry(self.ts_preview_cache, self.ts_tools)
        self.ts_delete_service = TSDeleteService(
            ts_database=self.ts_database,
            ts_preview_cache=self.ts_preview_cache,
            ts_get_roots=self.TSGetRoots,
            ts_emit_event=self.TSEmitEvent,
        )
        self.ts_workflow_service = TSWorkflowService()
        self.ts_asset_processing = TSAssetProcessingService(
            ts_database=self.ts_database,
            ts_preview_cache=self.ts_preview_cache,
            ts_handler_registry=self.ts_handler_registry,
            ts_build_asset_stat=self._TSBuildAssetStatFromRow,
            ts_get_asset_lock=self._TSGetAssetLock,
            ts_emit_asset_upsert=self._TSEmitAssetUpsert,
        )
        self.ts_indexer = TSIndexer(
            ts_database=self.ts_database,
            ts_storage_paths=self.ts_storage_paths,
            ts_config_store=self.ts_config_store,
            ts_handler_registry=self.ts_handler_registry,
            ts_preview_cache=self.ts_preview_cache,
            ts_tools=self.ts_tools,
            ts_emit_callback=self.TSEmitEvent,
        )
        self.ts_scan_service = TSScanService(
            ts_indexer=self.ts_indexer,
            ts_database=self.ts_database,
            ts_preview_cache=self.ts_preview_cache,
            ts_output_directory=self.ts_storage_paths.ts_output_directory,
            ts_is_autoscan_enabled=self.TSIsAutoscanEnabled,
            ts_register_routes=lambda: TSRegisterRoutes(self),
        )
        self.ts_bootstrapped = False
        self.ts_asset_locks: dict[int, threading.Lock] = {}
        self.ts_asset_locks_guard = threading.Lock()
        self.ts_3d_viewer_module_urls: dict[str, str | None] = {}
        TSLogVerbose("runtime.initialized")

    def _TSHealthPayload(self) -> list[dict[str, Any]]:
        return [ts_issue.TSAsDict() for ts_issue in self.ts_tools.TSGetHealth()]

    def _TSGetAssetLock(self, ts_asset_id: int) -> threading.Lock:
        with self.ts_asset_locks_guard:
            ts_lock = self.ts_asset_locks.get(ts_asset_id)
            if ts_lock is None:
                ts_lock = threading.Lock()
                self.ts_asset_locks[ts_asset_id] = ts_lock
            return ts_lock

    def TSBootstrap(self) -> None:
        if self.ts_bootstrapped:
            TSLogVerbose("runtime.bootstrap.skipped", reason="already_bootstrapped")
            return
        self.ts_bootstrapped = True
        TSLogVerbose("runtime.bootstrap.start")
        try:
            TSRegisterRoutes(self)
        except Exception:
            TSLogger.exception("Failed to register Timesaver Artius Browser routes")
        self.TSStart()

    def TSStart(self) -> None:
        self.ts_scan_service.TSStart()

    def TSEmitEvent(self, ts_event_name: str, ts_payload: dict[str, Any]) -> None:
        try:
            from server import PromptServer

            ts_server = getattr(PromptServer, "instance", None)
            if ts_server is None:
                TSLogVerbose("runtime.event.skipped", event=ts_event_name, reason="prompt_server_unavailable")
                return
            TSLogVerbose("runtime.event.emit", event=ts_event_name, keys=sorted(ts_payload.keys()))
            ts_server.send_sync(ts_event_name, ts_payload)
        except Exception:
            TSLogger.debug("Failed to emit event %s", ts_event_name, exc_info=True)

    async def TSRequestScan(self, ts_scope: str | None = None, ts_root_id: str | None = None) -> bool:
        return await self.ts_scan_service.TSRequestScan(ts_scope=ts_scope, ts_root_id=ts_root_id)

    async def TSRequestCacheRebuild(self) -> dict[str, Any]:
        return await self.ts_scan_service.TSRequestCacheRebuild()

    def TSGetScanStatus(self) -> dict[str, Any]:
        return self.ts_scan_service.TSGetScanStatus()

    def TSIsAutoscanEnabled(self) -> bool:
        return self.ts_browser_settings.TSIsAutoscanEnabled()

    def TSGetUISettings(self) -> dict[str, Any]:
        return self.ts_browser_settings.TSGetUISettings()

    def TSSaveUISettings(self, ts_ui_updates: dict[str, Any] | None) -> dict[str, Any]:
        return self.ts_browser_settings.TSSaveUISettings(ts_ui_updates)

    def TSGetRoots(self) -> list[dict[str, Any]]:
        ts_config = self.ts_config_store.TSLoadConfig()
        ts_roots = self.ts_storage_paths.TSBuildBaseRoots(ts_config)
        ts_payload = [
            {
                "root_id": ts_root.ts_root_id,
                "scope": ts_root.ts_scope,
                "path": str(ts_root.ts_path).replace("\\", "/"),
                "allow_delete": ts_root.ts_allow_delete,
                "label": ts_root.ts_label or ts_root.ts_root_id,
            }
            for ts_root in ts_roots
        ]
        TSLogVerbose("runtime.roots", count=len(ts_payload), root_ids=[ts_root["root_id"] for ts_root in ts_payload])
        return ts_payload

    def _TSBuildRootMap(self) -> dict[str, Any]:
        ts_config = self.ts_config_store.TSLoadConfig()
        return {ts_root.ts_root_id: ts_root for ts_root in self.ts_storage_paths.TSBuildBaseRoots(ts_config)}

    def _TSBuildAssetStatFromRow(self, ts_row) -> TSAssetStat:
        ts_root_map = self._TSBuildRootMap()
        ts_root = ts_root_map.get(str(ts_row["root_id"]))
        if ts_root is None:
            raise RuntimeError(f"Unknown asset root {ts_row['root_id']}")
        ts_path = Path(str(ts_row["path"])).resolve()
        ts_stat = ts_path.stat()
        ts_relative_path = TSRelativePosixPath(ts_path, ts_root.ts_path.resolve())
        return TSAssetStat(
            ts_path=ts_path,
            ts_root=ts_root,
            ts_relative_path=ts_relative_path,
            ts_folder_path=TSRelativePosixPath(ts_path.parent, ts_root.ts_path.resolve()) if ts_path.parent != ts_root.ts_path.resolve() else "",
            ts_filename=ts_path.name,
            ts_extension=ts_path.suffix.lower(),
            ts_size_bytes=int(ts_stat.st_size),
            ts_mtime_ns=int(getattr(ts_stat, "st_mtime_ns", int(ts_stat.st_mtime * 1000000000))),
            ts_ctime_ns=int(getattr(ts_stat, "st_ctime_ns", int(ts_stat.st_ctime * 1000000000))),
        )

    def _TSEmitAssetUpsert(self, ts_row) -> None:
        if self.ts_indexer.TSGetStatus().get("running"):
            return
        ts_roots = {ts_root["root_id"]: ts_root for ts_root in self.TSGetRoots()}
        ts_asset_payload = TSBuildAssetCard(ts_row, ts_roots, self.ts_preview_cache)
        self.TSEmitEvent(
            "tsab:asset-upsert",
            {
                "id": ts_row["id"],
                "path": ts_row["path"],
                "type": ts_row["type"],
                "asset": ts_asset_payload,
            },
        )

    def _TSResolvePreviewFilePath(self, ts_row) -> Path:
        ts_preview_path = str(ts_row["preview_path"] or "")
        if ts_preview_path:
            ts_preview_file_path = self.ts_preview_cache.TSResolvePreviewPath(ts_preview_path)
            if ts_preview_file_path.exists():
                return ts_preview_file_path
        ts_placeholder_path = self.ts_preview_cache.TSGetTypePlaceholderPreview(str(ts_row["type"] or "image"))
        return self.ts_preview_cache.TSResolvePreviewPath(ts_placeholder_path)

    def _TSResolveFrontendAssetModuleURL(self, ts_pattern: str) -> str | None:
        if ts_pattern in self.ts_3d_viewer_module_urls:
            return self.ts_3d_viewer_module_urls[ts_pattern]
        try:
            from server import PromptServer

            ts_server = getattr(PromptServer, "instance", None)
            ts_web_root = getattr(ts_server, "web_root", None)
            if not ts_web_root:
                return None
            ts_assets_directory = Path(str(ts_web_root)) / "assets"
            if not ts_assets_directory.exists():
                return None
            ts_matches = sorted(ts_assets_directory.glob(ts_pattern))
            if not ts_matches:
                return None
            ts_module_url = f"/assets/{ts_matches[0].name}"
            self.ts_3d_viewer_module_urls[ts_pattern] = ts_module_url
            return ts_module_url
        except Exception as ts_error:
            TSLogVerbose("runtime.frontend_module.resolve.failed", pattern=ts_pattern, error=str(ts_error))
            return None

    def TSGet3DViewerSupport(self) -> dict[str, Any]:
        ts_viewer_module_url = self._TSResolveFrontendAssetModuleURL("useLoad3dViewer-*.js")
        ts_load3d_module_url = self._TSResolveFrontendAssetModuleURL("load3dService-*.js")
        return {
            "available": bool(ts_viewer_module_url or ts_load3d_module_url),
            "module_url": ts_viewer_module_url,
            "viewer_module_url": ts_viewer_module_url,
            "load3d_module_url": ts_load3d_module_url,
        }

    def TSWarmPreview(self, ts_asset_id: int) -> dict[str, Any]:
        return self.ts_asset_processing.TSWarmPreview(ts_asset_id)

    def _TSEnsureIndexed(self, ts_row):
        return self.ts_asset_processing.TSEnsureIndexed(ts_row)

    def _TSEnsurePreview(self, ts_row):
        return self.ts_asset_processing.TSEnsurePreview(ts_row)

    def _TSEnsureMetadata(self, ts_row):
        return self.ts_asset_processing.TSEnsureMetadata(ts_row)

    def TSQueryAssets(
        self,
        ts_search_text: str,
        ts_filters: dict[str, Any],
        ts_offset: int,
        ts_limit: int,
        ts_view: str = "flat",
    ) -> dict[str, Any]:
        TSLogVerbose("runtime.assets.query", search_text=ts_search_text, filters=ts_filters, offset=ts_offset, limit=ts_limit, view=ts_view)
        self.ts_scan_service.TSMaybeStartInitialAutoscan()
        ts_rows, ts_has_more = self.ts_database.TSQueryAssetsPage(
            ts_search_text=ts_search_text,
            ts_filters=ts_filters,
            ts_offset=ts_offset,
            ts_limit=ts_limit,
        )
        ts_roots = {ts_root["root_id"]: ts_root for ts_root in self.TSGetRoots()}
        ts_items = [TSBuildAssetCard(ts_row, ts_roots, self.ts_preview_cache) for ts_row in ts_rows]
        ts_scope_for_tree = None
        ts_root_id_for_tree = None
        if ts_filters.get("scopes") and len(ts_filters["scopes"]) == 1:
            ts_scope_for_tree = ts_filters["scopes"][0]
        if ts_filters.get("root_ids") and len(ts_filters["root_ids"]) == 1:
            ts_root_id_for_tree = ts_filters["root_ids"][0]
        ts_response = {
            "items": ts_items,
            "offset": ts_offset,
            "limit": ts_limit,
            "has_more": ts_has_more,
            "view": ts_view,
            "scan_status": self.TSGetScanStatus(),
            "health": self._TSHealthPayload(),
            "roots": list(ts_roots.values()),
            "folders": self.ts_database.TSListFolders(ts_scope_for_tree, ts_root_id_for_tree) if ts_view == "tree" else [],
        }
        TSLogVerbose("runtime.assets.response", returned=len(ts_items), has_more=ts_response["has_more"])
        return ts_response

    def TSGetAssetDetail(self, ts_asset_id: int) -> dict[str, Any] | None:
        TSLogVerbose("runtime.asset.detail", asset_id=ts_asset_id)
        ts_row = self.ts_database.TSGetAssetById(ts_asset_id)
        if ts_row is None:
            return None
        ts_row = self._TSEnsureMetadata(ts_row) or ts_row
        ts_roots = {ts_root["root_id"]: ts_root for ts_root in self.TSGetRoots()}
        ts_technical_info = TSResolveTechnicalInfo(ts_row)
        if str(ts_row["type"] or "") == "video":
            ts_row, ts_technical_info = TSEnrichVideoTechnicalInfo(ts_row, self.ts_database, self.ts_tools, ts_technical_info)
        elif str(ts_row["type"] or "") == "audio":
            ts_row, ts_technical_info = TSEnrichAudioTechnicalInfo(ts_row, self.ts_database, self.ts_tools, ts_technical_info)
        ts_payload = TSBuildAssetCard(ts_row, ts_roots, self.ts_preview_cache)
        ts_payload["detail_loaded"] = True
        ts_payload["metadata"] = TSJsonLoads(ts_row["metadata"], {})
        ts_payload["metadata_json"] = ts_row["metadata"]
        ts_payload["prompt_text"] = TSResolveAssetPromptText(ts_row)
        ts_payload["negative_prompt_text"] = TSResolveAssetNegativePromptText(ts_row)
        ts_payload["workflow_text"] = TSResolveAssetWorkflowText(ts_row)
        ts_payload["technical_info"] = ts_technical_info
        return ts_payload

    def _TSApplyNoStoreHeaders(self, ts_response: TSWeb.StreamResponse) -> TSWeb.StreamResponse:
        ts_response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        ts_response.headers["Pragma"] = "no-cache"
        ts_response.headers["Expires"] = "0"
        return ts_response

    def _TSApplyPreviewCacheHeaders(self, ts_response: TSWeb.StreamResponse) -> TSWeb.StreamResponse:
        ts_response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return ts_response

    def TSBuildPreviewResponse(self, ts_asset_id: int) -> TSWeb.FileResponse:
        TSLogVerbose("runtime.preview.response", asset_id=ts_asset_id)
        ts_row = self.ts_database.TSGetAssetById(ts_asset_id)
        if ts_row is None:
            raise TSWeb.HTTPNotFound()
        ts_preview_path_value = str(ts_row["preview_path"] or "")
        ts_preview_file_path = self.ts_preview_cache.TSResolvePreviewPath(ts_preview_path_value) if ts_preview_path_value else None
        if ts_preview_path_value and not self.ts_preview_cache.TSIsPlaceholderPreview(ts_preview_path_value) and (ts_preview_file_path is None or not ts_preview_file_path.exists()):
            ts_row = self._TSEnsurePreview(ts_row) or ts_row
        ts_preview_path = self._TSResolvePreviewFilePath(ts_row)
        if ts_preview_path is None or not ts_preview_path.exists():
            raise TSWeb.HTTPNotFound()
        return self._TSApplyPreviewCacheHeaders(TSWeb.FileResponse(ts_preview_path))

    def TSBuildFileResponse(self, ts_path: str | None = None, ts_asset_id: int | None = None) -> TSWeb.FileResponse:
        TSLogVerbose("runtime.file.response", asset_id=ts_asset_id, path=ts_path)
        ts_row = None
        if ts_asset_id is not None:
            ts_row = self.ts_database.TSGetAssetById(ts_asset_id)
        elif ts_path:
            ts_row = self.ts_database.TSGetAssetByPath(TSNormalizePathString(ts_path))
        if ts_row is None:
            raise TSWeb.HTTPNotFound()
        ts_file_path = Path(str(ts_row["path"]))
        if not ts_file_path.exists():
            raise TSWeb.HTTPNotFound()
        return self._TSApplyNoStoreHeaders(TSWeb.FileResponse(ts_file_path))

    def TSDeleteAssets(self, ts_asset_ids: list[int]) -> dict[str, Any]:
        return self.ts_delete_service.TSDeleteAssets(ts_asset_ids)

    def TSDeleteWorkflowFile(self, ts_workflow_path: Path) -> dict[str, Any]:
        return self.ts_workflow_service.TSDeleteWorkflowFile(ts_workflow_path)

    def TSDeleteRequestWorkflowFile(self, ts_request, ts_relative_path: str) -> dict[str, Any]:
        return self.ts_workflow_service.TSDeleteRequestWorkflowFile(ts_request, ts_relative_path)

    def TSSave3DThumbnail(self, ts_asset_id: int, ts_image_data_url: str) -> dict[str, Any]:
        return TSSave3DThumbnail(
            ts_asset_id=ts_asset_id,
            ts_image_data_url=ts_image_data_url,
            ts_database=self.ts_database,
            ts_preview_cache=self.ts_preview_cache,
            ts_get_roots=self.TSGetRoots,
            ts_emit_asset_upsert=self._TSEmitAssetUpsert,
        )


def TSGetRuntime() -> TSAssetBrowserRuntime:
    global TSRuntimeSingleton
    if TSRuntimeSingleton is None:
        TSRuntimeSingleton = TSAssetBrowserRuntime()
    return TSRuntimeSingleton




