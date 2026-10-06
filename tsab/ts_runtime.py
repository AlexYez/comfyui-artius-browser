from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

from aiohttp import web as TSWeb

from .ts_3d_thumbnail import TSSave3DThumbnail
from .ts_archive import TSArchiveEntry, TSArchiveNoSpaceError, TSArchiveService
from .ts_asset_catalog import TSAssetCatalogService
from .ts_asset_processing import TSAssetProcessingService
from .ts_browser_settings import TSBrowserSettingsService
from .ts_client_log import TSClientErrorLog
from .ts_config import TSConfigStore
from .ts_db import TSDatabase
from .ts_db_schema import TS_DB_SCHEMA_VERSION
from .ts_delete import TSDeleteService
from .ts_display_proxy import (
    TS_DISPLAY_MODE_PROXY,
    TS_DISPLAY_PROXY_CONTENT_TYPES,
    TSDisplayProxyService,
    TSResolveRowDisplayMode,
)
from .ts_handlers import TSHandlerRegistry
from .ts_indexer import TSIndexer
from .ts_load3d_stage import TSPrepare3DAssetForLoad3D
from .ts_logging import (
    TSIsProgressConsole,
    TSIsVerboseLogging,
    TSLogVerbose,
    TSSetProgressConsole,
    TSSetVerboseLogging,
)
from .ts_preview import TSPreviewCache
from .ts_reveal import TSRevealInFileManager
from .ts_routes import TSRegisterRoutes
from .ts_scan_service import TSScanService
from .ts_settings import TS_EVENT_ASSET_UPSERT
from .ts_storage import TSStoragePaths
from .ts_tools import TSToolLocator
from .ts_types import TSAssetStat
from .ts_utils import TSKeyedLockRegistry, TSNormalizePathString, TSRelativePosixPath
from .ts_workflows import TSWorkflowService

TSLogger = logging.getLogger("TSArtiusBrowser")
TSRuntimeSingleton = None


class TSAssetBrowserRuntime:
    def __init__(self) -> None:
        self.ts_storage_paths = TSStoragePaths()
        self.ts_config_store = TSConfigStore(self.ts_storage_paths.ts_config_path)
        self._TSApplyVerboseLoggingFromConfig()
        self.ts_browser_settings = TSBrowserSettingsService(self.ts_config_store)
        self.ts_database = TSDatabase(self.ts_storage_paths.ts_database_path)
        self.ts_tools = TSToolLocator(self.ts_config_store)
        self.ts_preview_cache = TSPreviewCache(self.ts_storage_paths, self.ts_config_store)
        self.ts_handler_registry = TSHandlerRegistry(self.ts_preview_cache, self.ts_tools)
        self.ts_display_proxy = TSDisplayProxyService(self.ts_storage_paths.ts_cache_directory, self.ts_tools)
        # Beside cache/, not inside it: Rebuild Cache deletes cache/ wholesale.
        self.ts_archive_service = TSArchiveService(self.ts_storage_paths.ts_asset_browser_directory / "archives")
        self.ts_delete_service = TSDeleteService(
            ts_database=self.ts_database,
            ts_preview_cache=self.ts_preview_cache,
            ts_get_roots=self.TSGetRoots,
            ts_emit_event=self.TSEmitEvent,
            ts_get_asset_lock=self._TSGetAssetLock,
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
        self.ts_asset_catalog = TSAssetCatalogService(
            ts_database=self.ts_database,
            ts_preview_cache=self.ts_preview_cache,
            ts_tools=self.ts_tools,
            ts_scan_service=self.ts_scan_service,
            ts_get_roots=self.TSGetRoots,
            ts_ensure_metadata=self._TSEnsureMetadata,
        )
        self.ts_bootstrapped = False
        # Per-asset locks are reference-counted and reclaimed once released so
        # the map cannot grow without bound across a long session on a large
        # library (one Lock per asset id ever touched used to leak until
        # restart).
        self.ts_asset_lock_registry = TSKeyedLockRegistry()
        self.ts_client_error_log = TSClientErrorLog()
        self.ts_3d_viewer_module_urls: dict[str, str | None] = {}
        TSLogVerbose("runtime.initialized")

    def _TSApplyVerboseLoggingFromConfig(self) -> None:
        try:
            ts_config = self.ts_config_store.TSLoadConfig()
            ts_logging_config = ts_config.get("logging", {}) if isinstance(ts_config, dict) else {}
            TSSetVerboseLogging(bool(ts_logging_config.get("enable_verbose", False)))
            TSSetProgressConsole(bool(ts_logging_config.get("enable_progress_console", True)))
        except Exception:
            # Logging configuration must never block startup.
            TSLogger.debug("Failed to apply logging configuration", exc_info=True)

    def TSCollectDiagnostics(self) -> dict[str, Any]:
        # Lightweight, support-oriented snapshot surfaced through /version so a
        # bug report can include environment state without shell access. All
        # lookups are cheap and best-effort — a failure in one field must not
        # blank the whole payload.
        ts_diagnostics: dict[str, Any] = {
            "schema_version": TS_DB_SCHEMA_VERSION,
            "verbose_logging": TSIsVerboseLogging(),
            "progress_console": TSIsProgressConsole(),
        }
        try:
            ts_config = self.ts_config_store.TSLoadConfig()
            ts_diagnostics["config_version"] = int(ts_config.get("version", 0) or 0)
        except Exception:
            ts_diagnostics["config_version"] = None
        try:
            ts_diagnostics["tools"] = {
                ts_tool_name: self.ts_tools.TSResolveTool(ts_tool_name)
                for ts_tool_name in ("ffmpeg", "ffprobe")
            }
        except Exception:
            ts_diagnostics["tools"] = {}
        try:
            ts_type_counts = self.ts_database.TSCountVisibleByType()
            ts_diagnostics["asset_counts"] = ts_type_counts
            ts_diagnostics["asset_total"] = sum(ts_type_counts.values())
        except Exception:
            ts_diagnostics["asset_counts"] = {}
            ts_diagnostics["asset_total"] = None
        try:
            ts_diagnostics["root_count"] = len(self.TSGetRoots())
        except Exception:
            ts_diagnostics["root_count"] = None
        try:
            ts_diagnostics["client_errors"] = self.ts_client_error_log.TSSnapshot()
        except Exception:
            ts_diagnostics["client_errors"] = []
        ts_diagnostics["memory"] = self._TSCollectMemoryDiagnostics()
        return ts_diagnostics

    def _TSCollectMemoryDiagnostics(self) -> dict[str, Any]:
        # Users report "generation gets slower once the browser is open", and
        # the answer turns on numbers nobody currently has: how much resident
        # memory this process holds, how many threads it runs, and how many
        # SQLite connections those threads opened (every per-connection PRAGMA
        # is paid once per connection). Reported here so a bug report can carry
        # measurements instead of impressions.
        ts_memory: dict[str, Any] = {
            "thread_count": threading.active_count(),
            "db_connections": getattr(self.ts_database, "ts_connection_count", None),
        }
        try:
            # psutil ships with ComfyUI itself, so this is not a new dependency
            # of ours - and if a build somehow lacks it, the field is simply
            # absent rather than the whole diagnostics block failing.
            import psutil

            ts_process = psutil.Process()
            ts_memory["process_rss_mb"] = round(ts_process.memory_info().rss / 1048576, 1)
            ts_system = psutil.virtual_memory()
            ts_memory["system_available_mb"] = round(ts_system.available / 1048576)
            ts_memory["system_total_mb"] = round(ts_system.total / 1048576)
        except Exception:
            TSLogVerbose("runtime.diagnostics.memory_unavailable")
        try:
            ts_memory["cache_db_mb"] = round(self.ts_storage_paths.ts_database_path.stat().st_size / 1048576, 1)
        except OSError:
            ts_memory["cache_db_mb"] = None
        return ts_memory

    def TSRecordClientErrors(self, ts_payload: dict[str, Any]) -> dict[str, Any]:
        ts_errors = ts_payload.get("errors") if isinstance(ts_payload, dict) else None
        ts_recorded = self.ts_client_error_log.TSRecord(ts_errors)
        return {"recorded": ts_recorded}

    def _TSGetAssetLock(self, ts_asset_id: int):
        # Returns a context manager (reference-counted lock handle). Callers use
        # `with self._TSGetAssetLock(id):`, matching the previous raw-Lock usage.
        return self.ts_asset_lock_registry(ts_asset_id)

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

    def TSIndexFiles(self, ts_root_id: str, ts_relative_paths: list[str]) -> dict[str, Any]:
        # The targeted counterpart of TSRequestScan: index exactly the files the
        # caller names instead of walking their root. Rows come back so the
        # panel learns about them the same way it does after an on-demand
        # upsert, without waiting for a scan-complete event.
        ts_result = self.ts_scan_service.TSIndexFiles(ts_root_id, ts_relative_paths)
        for ts_row in ts_result.pop("rows", []):
            self._TSEmitAssetUpsert(ts_row)
        return ts_result

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
        ts_asset_payload = self.ts_asset_catalog.TSBuildAssetCard(ts_row)
        self.TSEmitEvent(
            TS_EVENT_ASSET_UPSERT,
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
            try:
                ts_preview_file_path = self.ts_preview_cache.TSResolvePreviewPath(ts_preview_path)
            except ValueError as ts_error:
                TSLogVerbose("runtime.preview.outside_root", asset_id=int(ts_row["id"]), preview_path=ts_preview_path, error=str(ts_error))
            else:
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

    def _TSEnsurePreview(self, ts_row):
        return self.ts_asset_processing.TSEnsurePreview(ts_row)

    def _TSEnsureMetadata(self, ts_row):
        return self.ts_asset_processing.TSEnsureMetadata(ts_row)

    def TSQueryAssets(
        self,
        ts_search_text: str,
        ts_filters: dict[str, Any],
        ts_cursor_after: dict[str, Any] | None,
        ts_limit: int,
        ts_view: str = "flat",
    ) -> dict[str, Any]:
        return self.ts_asset_catalog.TSQueryAssets(
            ts_search_text=ts_search_text,
            ts_filters=ts_filters,
            ts_cursor_after=ts_cursor_after,
            ts_limit=ts_limit,
            ts_view=ts_view,
        )

    def TSGetAssetDetail(self, ts_asset_id: int) -> dict[str, Any] | None:
        return self.ts_asset_catalog.TSGetAssetDetail(ts_asset_id)

    def _TSApplyPreviewCacheHeaders(self, ts_response: TSWeb.StreamResponse) -> TSWeb.StreamResponse:
        ts_response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return ts_response

    def TSBuildPreviewResponse(self, ts_asset_id: int) -> TSWeb.FileResponse:
        TSLogVerbose("runtime.preview.response", asset_id=ts_asset_id)
        ts_row = self.ts_database.TSGetAssetPreviewRow(ts_asset_id)
        if ts_row is None:
            raise TSWeb.HTTPNotFound()
        ts_preview_path_value = str(ts_row["preview_path"] or "")
        ts_preview_file_path = None
        if ts_preview_path_value:
            try:
                ts_preview_file_path = self.ts_preview_cache.TSResolvePreviewPath(ts_preview_path_value)
            except ValueError as ts_error:
                TSLogVerbose("runtime.preview.outside_root", asset_id=ts_asset_id, preview_path=ts_preview_path_value, error=str(ts_error))
        if ts_preview_path_value and not self.ts_preview_cache.TSIsPlaceholderPreview(ts_preview_path_value) and (ts_preview_file_path is None or not ts_preview_file_path.exists()):
            try:
                # Regeneration is the rare path, and it needs the whole row.
                ts_full_row = self.ts_database.TSGetAssetById(ts_asset_id) or ts_row
                ts_row = self._TSEnsurePreview(ts_full_row) or ts_full_row
            except Exception:
                # Preview regeneration must not 500 the preview route: a
                # vanished file or a root removed from config falls back to
                # the type placeholder resolved below.
                TSLogger.warning("TS preview regeneration failed for asset %s", ts_asset_id, exc_info=True)
        ts_preview_path = self._TSResolvePreviewFilePath(ts_row)
        # is_file, not exists: if placeholder generation ever fails the
        # fallback resolves to the cache root directory, which must yield a
        # 404 rather than a FileResponse on a directory.
        if ts_preview_path is None or not ts_preview_path.is_file():
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
        ts_file_path = self._TSAuthorizeAssetPath(ts_row)
        if not ts_file_path.exists():
            raise TSWeb.HTTPNotFound()
        return self._TSApplyRevalidateHeaders(TSWeb.FileResponse(ts_file_path))

    def TSBuildDisplayResponse(self, ts_asset_id: int, ts_force_proxy: bool = False) -> TSWeb.FileResponse:
        """The file the lightbox SHOWS: the original, or a converted copy.

        ``ts_force_proxy`` is the lightbox reporting that the browser failed to
        play a file its codec list promised it could (a 10-bit H.264, an HEVC
        without hardware support): the copy is made regardless.
        """
        ts_row = self.ts_database.TSGetAssetById(ts_asset_id)
        if ts_row is None:
            raise TSWeb.HTTPNotFound()
        ts_file_path = self._TSAuthorizeAssetPath(ts_row)
        if not ts_file_path.is_file():
            raise TSWeb.HTTPNotFound()
        ts_type = str(ts_row["type"] or "")
        ts_mode = TSResolveRowDisplayMode(ts_row)
        if ts_mode != TS_DISPLAY_MODE_PROXY and not (ts_force_proxy and ts_type in {"image", "video"}):
            return self._TSApplyRevalidateHeaders(TSWeb.FileResponse(ts_file_path))
        # Deliberately NOT under the per-asset lock: a conversion can take
        # minutes, and the detail request the lightbox sends at the same time
        # takes that lock - its panel would say "Loading..." for the whole
        # transcode. The proxy has its own per-key lock, and it writes only to
        # its own cache, never to the asset row.
        ts_proxy_path = self.ts_display_proxy.TSEnsureProxy(ts_row, ts_file_path)
        if ts_proxy_path is None:
            # No ffmpeg, no usable encoder, or a file ffmpeg cannot decode.
            raise TSWeb.HTTPUnprocessableEntity(reason="Display copy could not be created")
        # Explicit type: Python's mimetypes table on Windows has no ".webp",
        # and the copy went out as application/octet-stream.
        ts_content_type = TS_DISPLAY_PROXY_CONTENT_TYPES.get(ts_proxy_path.suffix.lower(), "application/octet-stream")
        ts_response = TSWeb.FileResponse(ts_proxy_path, headers={"Content-Type": ts_content_type})
        # The URL carries the asset's content token, so a given URL always
        # means the same bytes.
        ts_response.headers["Cache-Control"] = "private, max-age=31536000, immutable"
        return ts_response

    def _TSApplyRevalidateHeaders(self, ts_response: TSWeb.StreamResponse) -> TSWeb.StreamResponse:
        # Originals may be kept, but must be revalidated on every use.
        # `no-store` forbade the browser from keeping the bytes at all, so the
        # lightbox's decoded neighbours, a re-opened video and every compare
        # tile were downloaded again in full. FileResponse already sends
        # ETag + Last-Modified and answers If-None-Match with 304, so a file
        # rewritten in place is still caught - it just costs a round trip, not
        # the file. `private`: user media never belongs in a shared cache.
        ts_response.headers["Cache-Control"] = "private, no-cache"
        return ts_response

    def _TSAuthorizeAssetPath(self, ts_row) -> Path:
        # The single gate every route that hands a stored asset file to the
        # caller must pass. A DB row can outlive its root (custom root removed
        # or disabled) until the next full scan prunes it, so the row alone
        # proves nothing: containment is re-checked against the roots that are
        # configured RIGHT NOW. Raises 404 rather than 403 - a revoked root
        # should look like it never existed.
        ts_file_path = Path(str(ts_row["path"]))
        ts_root = self._TSBuildRootMap().get(str(ts_row["root_id"]))
        if ts_root is None:
            TSLogVerbose("runtime.asset.unauthorized", root_id=str(ts_row["root_id"]), reason="root_not_configured")
            raise TSWeb.HTTPNotFound()
        try:
            ts_file_path.resolve().relative_to(Path(ts_root.ts_path).resolve())
        except (OSError, ValueError):
            TSLogVerbose("runtime.asset.unauthorized", root_id=str(ts_row["root_id"]), reason="outside_root")
            raise TSWeb.HTTPNotFound() from None
        return ts_file_path

    def TSSetAssetFavorite(self, ts_asset_id: int, ts_is_favorite: bool) -> dict[str, Any] | None:
        ts_row = self.ts_database.TSSetAssetFavorite(ts_asset_id, ts_is_favorite)
        if ts_row is None:
            return None
        # Emitted like any other row change so a second browser tab (and the
        # "favorites only" filter in this one) reflects the star immediately.
        self._TSEmitAssetUpsert(ts_row)
        return self.ts_asset_catalog.TSBuildAssetCard(ts_row)

    def TSRevealAsset(self, ts_asset_id: int) -> dict[str, Any]:
        # Same gate as /file: the file manager is pointed at a path only after
        # the row's root is re-checked against the roots configured now.
        ts_row = self.ts_database.TSGetAssetById(ts_asset_id)
        if ts_row is None:
            raise TSWeb.HTTPNotFound()
        ts_file_path = self._TSAuthorizeAssetPath(ts_row)
        if not ts_file_path.is_file():
            raise TSWeb.HTTPNotFound()
        return {"revealed": TSRevealInFileManager(ts_file_path)}

    def TSRevealRequestWorkflowFile(self, ts_request, ts_relative_path: str) -> dict[str, Any]:
        ts_workflow_path = self.ts_workflow_service.TSResolveRequestWorkflowPath(ts_request, ts_relative_path)
        if not ts_workflow_path.is_file():
            raise TSWeb.HTTPNotFound()
        return {"revealed": TSRevealInFileManager(ts_workflow_path)}

    def TSBuildAssetArchive(self, ts_asset_ids: list[int]) -> dict[str, Any]:
        """Pack the selected assets into one ZIP and say where to fetch it.

        Every file passes the same root re-check as /file: a ZIP must not
        become a way around it. Assets that are gone or no longer under a
        configured root are left out and counted in ``skipped``.
        """
        ts_unique_ids = list(dict.fromkeys(ts_asset_ids))
        ts_rows = self.ts_database.TSGetAssetFileRows(ts_unique_ids)
        ts_files: list[tuple[Path, str]] = []
        ts_skipped = 0
        for ts_asset_id in ts_unique_ids:
            ts_row = ts_rows.get(ts_asset_id)
            if ts_row is None:
                ts_skipped += 1
                continue
            try:
                ts_file_path = self._TSAuthorizeAssetPath(ts_row)
            except TSWeb.HTTPNotFound:
                ts_skipped += 1
                continue
            ts_files.append((ts_file_path, str(ts_row["filename"] or ts_file_path.name)))
        if not ts_files:
            raise TSWeb.HTTPNotFound(reason="No files to archive")
        try:
            ts_archive = self.ts_archive_service.TSBuild(ts_files)
        except TSArchiveNoSpaceError:
            raise TSWeb.HTTPInsufficientStorage(reason="Not enough disk space for the archive") from None
        if ts_archive is None:
            raise TSWeb.HTTPNotFound(reason="No files to archive")
        return {
            "url": f"/asset_browser/archive/{ts_archive['token']}",
            "filename": ts_archive["filename"],
            "count": ts_archive["count"],
            "skipped": ts_skipped + ts_archive["skipped"],
            "size_bytes": ts_archive["size_bytes"],
        }

    def TSGetAssetArchive(self, ts_token: str) -> TSArchiveEntry | None:
        return self.ts_archive_service.TSGet(ts_token)

    def TSReleaseAssetArchive(self, ts_token: str) -> None:
        self.ts_archive_service.TSRelease(ts_token)

    def TSDeleteAssets(self, ts_asset_ids: list[int]) -> dict[str, Any]:
        return self.ts_delete_service.TSDeleteAssets(ts_asset_ids)

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
            ts_get_asset_lock=self._TSGetAssetLock,
        )

    def TSPrepare3DAssetForLoad3D(self, ts_asset_id: int) -> dict[str, Any]:
        return TSPrepare3DAssetForLoad3D(
            ts_database=self.ts_database,
            ts_get_asset_lock=self._TSGetAssetLock,
            ts_authorize_asset_path=self._TSAuthorizeAssetPath,
            ts_input_directory=self.ts_storage_paths.ts_input_directory,
            ts_asset_id=ts_asset_id,
        )

    def TSCollectVersionInfo(self) -> dict[str, Any]:
        # Keeps the version-check cache location an internal detail. The route
        # layer used to import the service and reach into
        # ts_storage_paths.ts_asset_browser_directory itself - the only handler
        # that bypassed this facade.
        from .ts_version import TSCollectVersionInfo as TSCollectVersionInfoImpl

        return TSCollectVersionInfoImpl(self.ts_storage_paths.ts_asset_browser_directory)


def TSGetRuntime() -> TSAssetBrowserRuntime:
    global TSRuntimeSingleton
    if TSRuntimeSingleton is None:
        TSRuntimeSingleton = TSAssetBrowserRuntime()
    return TSRuntimeSingleton




