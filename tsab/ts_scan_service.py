from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any, Callable

from .ts_logging import TSLogInfoIfVerbose, TSLogVerbose

TSLogger = logging.getLogger("TSArtiusBrowser")


def TSGetPromptServerInstance():
    from server import PromptServer

    return getattr(PromptServer, "instance", None)


class TSScanService:
    def __init__(
        self,
        ts_indexer,
        ts_database,
        ts_preview_cache,
        ts_output_directory: Path,
        ts_is_autoscan_enabled: Callable[[], bool],
        ts_register_routes: Callable[[], None],
        ts_get_prompt_server: Callable[[], Any] = TSGetPromptServerInstance,
    ) -> None:
        self.ts_indexer = ts_indexer
        self.ts_database = ts_database
        self.ts_preview_cache = ts_preview_cache
        self.ts_output_directory = ts_output_directory
        self.ts_is_autoscan_enabled = ts_is_autoscan_enabled
        self.ts_register_routes = ts_register_routes
        self.ts_get_prompt_server = ts_get_prompt_server
        self.ts_start_scan_scheduled = False

    def TSStart(self) -> None:
        try:
            if not self.ts_is_autoscan_enabled():
                TSLogVerbose("runtime.scan.schedule.skipped", reason="autoscan_disabled")
                return
            ts_server = self.ts_get_prompt_server()
            if ts_server is None or getattr(ts_server, "loop", None) is None:
                TSLogVerbose("runtime.start.skipped", reason="prompt_server_loop_unavailable")
                return
            self.ts_register_routes()
            ts_loop = ts_server.loop
            if self.ts_start_scan_scheduled:
                TSLogVerbose("runtime.scan.schedule.skipped", reason="already_scheduled")
                return
            self.ts_start_scan_scheduled = True
            TSLogInfoIfVerbose(
                "Scheduling Timesaver Artius Browser scan for %s",
                self.ts_output_directory,
            )
            TSLogVerbose("runtime.scan.scheduled", output_directory=str(self.ts_output_directory))
            ts_loop.call_soon_threadsafe(lambda: ts_loop.create_task(self.ts_indexer.TSStartBackgroundScan()))
        except Exception:
            TSLogger.exception("Failed to start Timesaver Artius Browser background scan")

    async def TSRequestScan(self, ts_scope: str | None = None, ts_root_id: str | None = None) -> bool:
        TSLogVerbose("runtime.scan.requested", scope=ts_scope, root_id=ts_root_id)
        return await self.ts_indexer.TSStartBackgroundScan(ts_scope=ts_scope, ts_root_id=ts_root_id)

    async def TSRequestCacheRebuild(self) -> dict[str, Any]:
        TSLogVerbose("runtime.rebuild.requested")
        if bool(self.TSGetScanStatus().get("running")):
            TSLogVerbose("runtime.rebuild.skipped", reason="scan_running")
            return {"started": False, "status": self.TSGetScanStatus()}
        # Both calls are heavy and blocking (VACUUM over the whole DB, rmtree
        # over the whole preview cache). Running them inline would freeze the
        # ComfyUI event loop - every route, websocket heartbeat and prompt
        # progress update - for as long as the rebuild takes.
        await asyncio.to_thread(self.ts_database.TSResetIndex)
        await asyncio.to_thread(self.ts_preview_cache.TSClearGeneratedCache)
        ts_started = await self.ts_indexer.TSStartBackgroundScan()
        return {"started": ts_started, "status": self.TSGetScanStatus()}

    def TSGetScanStatus(self) -> dict[str, Any]:
        return self.ts_indexer.TSGetStatus()

    def TSMaybeStartInitialAutoscan(self) -> None:
        ts_scan_status = self.TSGetScanStatus()
        if (
            self.ts_is_autoscan_enabled()
            and not ts_scan_status.get("running")
            and ts_scan_status.get("started_at") is None
        ):
            self.TSStart()
