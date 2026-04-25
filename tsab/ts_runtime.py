from __future__ import annotations

from dataclasses import replace
import logging
import threading
from pathlib import Path
from typing import Any
from urllib.parse import quote

from aiohttp import web as TSWeb

from .ts_config import TSConfigStore
from .ts_db import TSDatabase
from .ts_delete import TSDeleteService
from .ts_handlers import TSHandlerRegistry
from .ts_hashing import TSComputeFileHash, TSDetectSupportedType
from .ts_indexer import TSIndexer
from .ts_logging import TSLogInfoIfVerbose, TSLogVerbose
from .media.probe import TSMergeMissingAudioTechnicalInfo, TSMergeMissingVideoTechnicalInfo
from .ts_preview import TSPreviewCache
from .ts_routes import TSRegisterRoutes
from .ts_storage import TSStoragePaths
from .ts_tools import TSToolLocator
from .ts_types import TSAssetStat
from .ts_ui_settings import TSApplyUISettingsUpdates, TSNormalizeUISettings
from .ts_utils import TSExtractPromptText, TSExtractWorkflowText, TSJsonDumps, TSJsonLoads, TSNormalizePathString, TSRelativePosixPath

TSLogger = logging.getLogger("TSArtiusBrowser")
TSRuntimeSingleton = None


class TSAssetBrowserRuntime:
    def __init__(self) -> None:
        self.ts_storage_paths = TSStoragePaths()
        self.ts_config_store = TSConfigStore(self.ts_storage_paths.ts_config_path)
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
        self.ts_indexer = TSIndexer(
            ts_database=self.ts_database,
            ts_storage_paths=self.ts_storage_paths,
            ts_config_store=self.ts_config_store,
            ts_handler_registry=self.ts_handler_registry,
            ts_preview_cache=self.ts_preview_cache,
            ts_tools=self.ts_tools,
            ts_emit_callback=self.TSEmitEvent,
        )
        self.ts_bootstrapped = False
        self.ts_start_scan_scheduled = False
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
        try:
            if not self.TSIsAutoscanEnabled():
                TSLogVerbose("runtime.scan.schedule.skipped", reason="autoscan_disabled")
                return
            from server import PromptServer

            ts_server = getattr(PromptServer, "instance", None)
            if ts_server is None or getattr(ts_server, "loop", None) is None:
                TSLogVerbose("runtime.start.skipped", reason="prompt_server_loop_unavailable")
                return
            TSRegisterRoutes(self)
            ts_loop = ts_server.loop
            if self.ts_start_scan_scheduled:
                TSLogVerbose("runtime.scan.schedule.skipped", reason="already_scheduled")
                return
            self.ts_start_scan_scheduled = True
            TSLogInfoIfVerbose(
                "Scheduling Timesaver Artius Browser scan for %s",
                self.ts_storage_paths.ts_output_directory,
            )
            TSLogVerbose("runtime.scan.scheduled", output_directory=str(self.ts_storage_paths.ts_output_directory))
            ts_loop.call_soon_threadsafe(lambda: ts_loop.create_task(self.ts_indexer.TSStartBackgroundScan()))
        except Exception:
            TSLogger.exception("Failed to start Timesaver Artius Browser background scan")

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
        TSLogVerbose("runtime.scan.requested", scope=ts_scope, root_id=ts_root_id)
        return await self.ts_indexer.TSStartBackgroundScan(ts_scope=ts_scope, ts_root_id=ts_root_id)

    async def TSRequestCacheRebuild(self) -> dict[str, Any]:
        TSLogVerbose("runtime.rebuild.requested")
        if bool(self.TSGetScanStatus().get("running")):
            TSLogVerbose("runtime.rebuild.skipped", reason="scan_running")
            return {"started": False, "status": self.TSGetScanStatus()}
        self.ts_database.TSResetIndex()
        self.ts_preview_cache.TSClearGeneratedCache()
        ts_started = await self.ts_indexer.TSStartBackgroundScan()
        return {"started": ts_started, "status": self.TSGetScanStatus()}

    def TSGetScanStatus(self) -> dict[str, Any]:
        return self.ts_indexer.TSGetStatus()

    def TSIsAutoscanEnabled(self) -> bool:
        return bool(self.ts_config_store.TSLoadConfig().get("ui", {}).get("autoscan", True))

    def TSGetUISettings(self) -> dict[str, Any]:
        ts_ui = self.ts_config_store.TSLoadConfig().get("ui", {})
        return TSNormalizeUISettings(ts_ui)

    def TSSaveUISettings(self, ts_ui_updates: dict[str, Any] | None) -> dict[str, Any]:
        ts_config = self.ts_config_store.TSLoadConfig()
        ts_ui = ts_config.setdefault("ui", {})
        TSApplyUISettingsUpdates(ts_ui, ts_ui_updates)
        self.ts_config_store.TSSaveConfig(ts_config)
        return self.TSGetUISettings()

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
        ts_asset_payload = self._TSAssetRowToCard(ts_row, ts_roots)
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
        ts_row = self.ts_database.TSGetAssetById(ts_asset_id)
        if ts_row is None:
            return {"queued": False, "reason": "missing"}
        ts_preview_path = str(ts_row["preview_path"] or "")
        if bool(ts_row["has_preview"]) and ts_preview_path and self.ts_preview_cache.TSResolvePreviewPath(ts_preview_path).exists():
            return {"queued": False, "reason": "ready"}
        return {"queued": False, "reason": "disabled"}

    def _TSResolvePromptText(self, ts_row) -> str:
        ts_metadata = TSJsonLoads(ts_row["metadata"], {})
        if isinstance(ts_metadata, dict):
            ts_positive_prompt_text = str(ts_metadata.get("positive_prompt_text") or "")
            if ts_positive_prompt_text:
                return ts_positive_prompt_text
        ts_prompt_text = str(ts_row["prompt_text"] or "")
        if ts_prompt_text:
            return ts_prompt_text
        if ts_metadata:
            return TSExtractPromptText(ts_metadata)
        return ""

    def _TSResolveNegativePromptText(self, ts_row) -> str:
        ts_metadata = TSJsonLoads(ts_row["metadata"], {})
        if not isinstance(ts_metadata, dict):
            return ""
        return str(ts_metadata.get("negative_prompt_text") or "")

    def _TSResolveWorkflowText(self, ts_row) -> str:
        ts_workflow_text = str(ts_row["workflow_text"] or "")
        if ts_workflow_text:
            return ts_workflow_text
        ts_metadata = TSJsonLoads(ts_row["metadata"], {})
        if ts_metadata:
            return TSExtractWorkflowText(ts_metadata)
        return ""

    def _TSResolveTechnicalInfo(self, ts_row) -> dict[str, Any]:
        ts_technical = TSJsonLoads(ts_row["technical_json"], {})
        if isinstance(ts_technical, dict) and ts_technical:
            if not ts_technical.get("duration") and ts_row["duration"] is not None:
                ts_technical["duration"] = ts_row["duration"]
            if not ts_technical.get("width") and ts_row["width"] is not None:
                ts_technical["width"] = ts_row["width"]
            if not ts_technical.get("height") and ts_row["height"] is not None:
                ts_technical["height"] = ts_row["height"]
            if not ts_technical.get("fps") and ts_row["fps"] is not None:
                ts_technical["fps"] = ts_row["fps"]
            return ts_technical
        ts_result: dict[str, Any] = {"kind": str(ts_row["type"] or "")}
        if ts_row["duration"] is not None:
            ts_result["duration"] = ts_row["duration"]
        if ts_row["width"] is not None:
            ts_result["width"] = ts_row["width"]
        if ts_row["height"] is not None:
            ts_result["height"] = ts_row["height"]
        if ts_row["fps"] is not None:
            ts_result["fps"] = ts_row["fps"]
        if str(ts_row["extension"] or ""):
            ts_result["format_name"] = str(ts_row["extension"] or "").lstrip(".").upper()
        return ts_result

    def _TSFormatChannelLayout(self, ts_channels: Any) -> str:
        ts_channel_count = int(ts_channels or 0) if str(ts_channels or "").strip() else 0
        if ts_channel_count <= 0:
            return ""
        if ts_channel_count == 1:
            return "Mono"
        if ts_channel_count == 2:
            return "Stereo"
        return f"{ts_channel_count}ch"

    def _TSEnrichVideoTechnicalInfo(self, ts_row, ts_technical: dict[str, Any] | None = None):
        if str(ts_row["type"] or "") != "video":
            return ts_row, (ts_technical or self._TSResolveTechnicalInfo(ts_row))
        ts_technical_info = dict(ts_technical or self._TSResolveTechnicalInfo(ts_row))
        if ts_technical_info.get("codec_name") and ts_technical_info.get("fps"):
            return ts_row, ts_technical_info
        ts_source_path = Path(str(ts_row["path"] or ""))
        if not ts_source_path.exists():
            return ts_row, ts_technical_info
        ts_probe = self.ts_tools.TSRunFFProbe(ts_source_path)
        ts_technical_info, ts_changed = TSMergeMissingVideoTechnicalInfo(
            ts_technical_info,
            ts_probe,
            str(ts_row["extension"] or ""),
        )
        if not ts_changed:
            return ts_row, ts_technical_info
        ts_updated_row = self.ts_database.TSUpsertAsset(self.ts_database.TSBuildUpdatedPayload(
            ts_row,
            ts_technical_json=TSJsonDumps(ts_technical_info),
            ts_fps=ts_technical_info.get("fps"),
        ))
        return ts_updated_row, ts_technical_info

    def _TSEnrichAudioTechnicalInfo(self, ts_row, ts_technical: dict[str, Any] | None = None):
        if str(ts_row["type"] or "") != "audio":
            return ts_row, (ts_technical or self._TSResolveTechnicalInfo(ts_row))
        ts_technical_info = dict(ts_technical or self._TSResolveTechnicalInfo(ts_row))
        if ts_technical_info.get("codec_name") and ts_technical_info.get("channels"):
            return ts_row, ts_technical_info
        ts_source_path = Path(str(ts_row["path"] or ""))
        if not ts_source_path.exists():
            return ts_row, ts_technical_info
        ts_probe = self.ts_tools.TSRunFFProbe(ts_source_path)
        ts_technical_info, ts_changed = TSMergeMissingAudioTechnicalInfo(
            ts_technical_info,
            ts_probe,
            str(ts_row["extension"] or ""),
        )
        if not ts_changed:
            return ts_row, ts_technical_info
        ts_updated_row = self.ts_database.TSUpsertAsset(self.ts_database.TSBuildUpdatedPayload(
            ts_row,
            ts_technical_json=TSJsonDumps(ts_technical_info),
        ))
        return ts_updated_row, ts_technical_info

    def _TSEnsureIndexed(self, ts_row):
        if ts_row is None:
            return None
        ts_asset_id = int(ts_row["id"])
        with self._TSGetAssetLock(ts_asset_id):
            ts_fresh_row = self.ts_database.TSGetAssetById(ts_asset_id)
            if ts_fresh_row is None:
                return None
            if bool(ts_fresh_row["is_indexed"]):
                return ts_fresh_row
            ts_path = Path(str(ts_fresh_row["path"]))
            if not ts_path.exists():
                self.ts_database.TSDeleteAssetIds([ts_asset_id])
                return None
            ts_kind = TSDetectSupportedType(ts_path)
            if ts_kind is None:
                self.ts_database.TSDeleteAssetIds([ts_asset_id])
                return None
            ts_handler = self.ts_handler_registry.TSResolveHandler(str(ts_fresh_row["extension"] or ""), ts_kind)
            if ts_handler is None:
                return ts_fresh_row
            ts_asset_stat = self._TSBuildAssetStatFromRow(ts_fresh_row)
            ts_hash = TSComputeFileHash(ts_asset_stat.ts_path)
            ts_payload = ts_handler.TSBuildIndexedPayload(ts_asset_stat, ts_hash)
            ts_payload = replace(
                self.ts_database.TSPayloadFromRow(ts_fresh_row),
                ts_preview_path=ts_payload.ts_preview_path,
                ts_metadata=ts_payload.ts_metadata,
                ts_technical_json=ts_payload.ts_technical_json,
                ts_mtime_ns=ts_payload.ts_mtime_ns,
                ts_hash=ts_payload.ts_hash,
                ts_folder_path=ts_payload.ts_folder_path,
                ts_duration=ts_payload.ts_duration,
                ts_width=ts_payload.ts_width,
                ts_height=ts_payload.ts_height,
                ts_fps=ts_payload.ts_fps,
                ts_size_bytes=ts_payload.ts_size_bytes,
                ts_filename=ts_payload.ts_filename,
                ts_extension=ts_payload.ts_extension,
                ts_scope=ts_payload.ts_scope,
                ts_root_id=ts_payload.ts_root_id,
                ts_created_at=ts_payload.ts_created_at or int(ts_fresh_row["created_at"] or 0),
                ts_is_indexed=True,
                ts_has_preview=False,
                ts_has_metadata=bool(ts_payload.ts_has_metadata),
                ts_prompt_text=ts_payload.ts_prompt_text,
            )
            ts_updated_row = self.ts_database.TSUpsertAsset(ts_payload)
            self._TSEmitAssetUpsert(ts_updated_row)
            return ts_updated_row

    def _TSEnsurePreview(self, ts_row):
        if ts_row is None:
            return None
        ts_row = self._TSEnsureIndexed(ts_row)
        if ts_row is None:
            return None
        ts_asset_id = int(ts_row["id"])
        with self._TSGetAssetLock(ts_asset_id):
            ts_fresh_row = self.ts_database.TSGetAssetById(ts_asset_id)
            if ts_fresh_row is None:
                return None
            ts_preview_path = str(ts_fresh_row["preview_path"] or "")
            if bool(ts_fresh_row["has_preview"]) and ts_preview_path and self.ts_preview_cache.TSResolvePreviewPath(ts_preview_path).exists():
                return ts_fresh_row
            ts_handler = self.ts_handler_registry.TSResolveHandler(str(ts_fresh_row["extension"] or ""), str(ts_fresh_row["type"] or ""))
            if ts_handler is None:
                return ts_fresh_row
            ts_preview_path = ts_handler.TSGeneratePreview(ts_fresh_row)
            ts_has_preview = bool(ts_preview_path) and not self.ts_preview_cache.TSIsPlaceholderPreview(ts_preview_path)
            ts_payload = self.ts_database.TSBuildUpdatedPayload(
                ts_fresh_row,
                ts_preview_path=ts_preview_path,
                ts_has_preview=ts_has_preview,
            )
            ts_updated_row = self.ts_database.TSUpsertAsset(ts_payload)
            self._TSEmitAssetUpsert(ts_updated_row)
            return ts_updated_row

    def _TSEnsureMetadata(self, ts_row):
        if ts_row is None:
            return None
        ts_row = self._TSEnsurePreview(ts_row)
        if ts_row is None:
            return None
        ts_asset_id = int(ts_row["id"])
        with self._TSGetAssetLock(ts_asset_id):
            ts_fresh_row = self.ts_database.TSGetAssetById(ts_asset_id)
            if ts_fresh_row is None:
                return None
            ts_metadata = TSJsonLoads(ts_fresh_row["metadata"], {})
            ts_needs_image_prompt_refresh = str(ts_fresh_row["type"] or "") == "image" and (
                not isinstance(ts_metadata, dict) or int(ts_metadata.get("prompt_parts_version") or 0) < 3
            )
            if bool(ts_fresh_row["has_metadata"]) and not ts_needs_image_prompt_refresh:
                return ts_fresh_row
            ts_handler = self.ts_handler_registry.TSResolveHandler(str(ts_fresh_row["extension"] or ""), str(ts_fresh_row["type"] or ""))
            if ts_handler is None:
                return ts_fresh_row
            ts_metadata_payload = ts_handler.TSExtractMetadata(ts_fresh_row)
            ts_metadata_json = str(ts_metadata_payload.get("metadata") or "{}")
            ts_prompt_text = str(ts_metadata_payload.get("prompt_text") or "")
            ts_workflow_text = str(ts_metadata_payload.get("workflow_text") or "")
            ts_has_metadata = bool(ts_metadata_json and ts_metadata_json != "{}") or bool(ts_prompt_text) or bool(ts_workflow_text)
            ts_payload = self.ts_database.TSBuildUpdatedPayload(
                ts_fresh_row,
                ts_metadata=ts_metadata_json,
                ts_prompt_text=ts_prompt_text,
                ts_workflow_text=ts_workflow_text,
                ts_has_metadata=ts_has_metadata,
            )
            ts_updated_row = self.ts_database.TSUpsertAsset(ts_payload)
            self._TSEmitAssetUpsert(ts_updated_row)
            return ts_updated_row

    def TSQueryAssets(
        self,
        ts_search_text: str,
        ts_filters: dict[str, Any],
        ts_offset: int,
        ts_limit: int,
        ts_view: str = "flat",
    ) -> dict[str, Any]:
        TSLogVerbose("runtime.assets.query", search_text=ts_search_text, filters=ts_filters, offset=ts_offset, limit=ts_limit, view=ts_view)
        ts_scan_status = self.TSGetScanStatus()
        if self.TSIsAutoscanEnabled() and not ts_scan_status.get("running") and ts_scan_status.get("started_at") is None:
            self.TSStart()
        ts_rows, ts_has_more = self.ts_database.TSQueryAssetsPage(
            ts_search_text=ts_search_text,
            ts_filters=ts_filters,
            ts_offset=ts_offset,
            ts_limit=ts_limit,
        )
        ts_roots = {ts_root["root_id"]: ts_root for ts_root in self.TSGetRoots()}
        ts_items = [self._TSAssetRowToCard(ts_row, ts_roots) for ts_row in ts_rows]
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
        ts_technical_info = self._TSResolveTechnicalInfo(ts_row)
        if str(ts_row["type"] or "") == "video":
            ts_row, ts_technical_info = self._TSEnrichVideoTechnicalInfo(ts_row, ts_technical_info)
        elif str(ts_row["type"] or "") == "audio":
            ts_row, ts_technical_info = self._TSEnrichAudioTechnicalInfo(ts_row, ts_technical_info)
        ts_payload = self._TSAssetRowToCard(ts_row, ts_roots)
        ts_payload["detail_loaded"] = True
        ts_payload["metadata"] = TSJsonLoads(ts_row["metadata"], {})
        ts_payload["metadata_json"] = ts_row["metadata"]
        ts_payload["prompt_text"] = self._TSResolvePromptText(ts_row)
        ts_payload["negative_prompt_text"] = self._TSResolveNegativePromptText(ts_row)
        ts_payload["workflow_text"] = self._TSResolveWorkflowText(ts_row)
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
        return self.ts_delete_service.TSDeleteWorkflowFile(ts_workflow_path)

    def TSSave3DThumbnail(self, ts_asset_id: int, ts_image_data_url: str) -> dict[str, Any]:
        ts_row = self.ts_database.TSGetAssetById(ts_asset_id)
        if ts_row is None:
            raise TSWeb.HTTPNotFound()
        if str(ts_row["type"] or "") != "3d":
            raise TSWeb.HTTPBadRequest(reason="Asset is not a 3D model")
        ts_preview_key = self.ts_preview_cache.TSBuildAssetPreviewKey(str(ts_row["hash"] or ""), Path(str(ts_row["path"])))
        ts_preview_path = self.ts_preview_cache.TSPersist3DCapturePreview(ts_preview_key, ts_image_data_url)
        if not ts_preview_path:
            raise TSWeb.HTTPBadRequest(reason="Invalid 3D thumbnail payload")
        ts_payload = self.ts_database.TSBuildUpdatedPayload(
            ts_row,
            ts_preview_path=ts_preview_path,
            ts_has_preview=True,
        )
        ts_updated_row = self.ts_database.TSUpsertAsset(ts_payload)
        self._TSEmitAssetUpsert(ts_updated_row)
        ts_roots = {ts_root["root_id"]: ts_root for ts_root in self.TSGetRoots()}
        return self._TSAssetRowToCard(ts_updated_row, ts_roots)

    def _TSBuildNative3DViewerURL(self, ts_row, ts_root: dict[str, Any]) -> str:
        ts_root_id = str(ts_row["root_id"] or "")
        if ts_root_id not in {"input", "output"}:
            return ""
        ts_filename = str(ts_row["filename"] or "")
        if not ts_filename:
            return ""
        ts_folder_path = str(ts_row["folder_path"] or "")
        return (
            f"/view?filename={quote(ts_filename)}"
            f"&type={quote(ts_root_id)}"
            f"&subfolder={quote(ts_folder_path)}"
        )
    def _TSAssetRowToCard(self, ts_row, ts_roots: dict[str, dict[str, Any]]) -> dict[str, Any]:
        ts_root = ts_roots.get(str(ts_row["root_id"]), {})
        ts_preview_path = str(ts_row["preview_path"] or "")
        ts_preview_exists = bool(ts_preview_path) and self.ts_preview_cache.TSResolvePreviewPath(ts_preview_path).exists()
        ts_file_cache_token = str(ts_row["hash"] or ts_row["mtime_ns"] or ts_row["id"])
        ts_preview_cache_token = str(ts_preview_path if ts_preview_exists else f"placeholder-{ts_row['id']}")
        ts_preview_url = f"/asset_browser/preview/{ts_row['id']}?v={ts_preview_cache_token}"
        ts_file_url = f"/asset_browser/file?id={ts_row['id']}&v={ts_file_cache_token}"
        ts_technical_info = self._TSResolveTechnicalInfo(ts_row) if str(ts_row["type"] or "") in {"video", "audio"} else {}
        return {
            "id": ts_row["id"],
            "path": ts_row["path"],
            "type": ts_row["type"],
            "filename": ts_row["filename"],
            "extension": ts_row["extension"],
            "size_bytes": ts_row["size_bytes"],
            "folder_path": ts_row["folder_path"],
            "preview_url": ts_preview_url,
            "file_url": ts_file_url,
            "viewer_3d_url": self._TSBuildNative3DViewerURL(ts_row, ts_root) if str(ts_row["type"] or "") == "3d" else "",
            "preview_is_placeholder": (not ts_preview_exists) or self.ts_preview_cache.TSIsPlaceholderPreview(ts_preview_path),
            "preview_is_3d_capture": ts_preview_exists and ".3d." in ts_preview_path.lower(),
            "scope": ts_row["scope"],
            "root_id": ts_row["root_id"],
            "width": ts_row["width"],
            "height": ts_row["height"],
            "duration": ts_row["duration"],
            "fps": ts_row["fps"],
            "allow_delete": bool(ts_root.get("allow_delete")),
            "root_label": ts_root.get("label", ts_row["root_id"]),
            "is_indexed": bool(ts_row["is_indexed"]),
            "has_preview": bool(ts_row["has_preview"]),
            "has_metadata": bool(ts_row["has_metadata"]),
            "has_workflow": bool(str(ts_row["workflow_text"] or "")),
            "codec_name": str(ts_technical_info.get("codec_name") or ""),
            "audio_codec_name": str(ts_technical_info.get("audio_codec_name") or ""),
            "channel_layout": self._TSFormatChannelLayout(ts_technical_info.get("channels")),
            "audio_channel_layout": self._TSFormatChannelLayout(ts_technical_info.get("audio_channels")),
            "status": str(ts_row["status"] or "discovered"),
            "detail_loaded": False,
        }


def TSGetRuntime() -> TSAssetBrowserRuntime:
    global TSRuntimeSingleton
    if TSRuntimeSingleton is None:
        TSRuntimeSingleton = TSAssetBrowserRuntime()
    return TSRuntimeSingleton




