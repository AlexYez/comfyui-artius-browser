from __future__ import annotations

import asyncio
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Iterable

from .ts_indexer_discovery import TSIterAssetStats
from .ts_indexer_payload import TSCarryExistingRowValues
from .ts_indexer_processing import TSProcessCandidateTuple
from .ts_indexer_progress import TSBuildConsoleProgressBar, TSBuildProgressMessage, TSComputeProgressPercent
from .ts_logging import TSLogInfoIfVerbose, TSLogProgress, TSLogVerbose
from .ts_settings import (
    TS_DEFAULT_HASH_WORKERS,
    TS_DEFAULT_SCAN_BATCH,
    TS_EVENT_HEALTH,
    TS_EVENT_INDEX_COMPLETE,
    TS_EVENT_INDEX_PROGRESS,
    TS_EVENT_INDEX_START,
    TS_PROGRESS_EVENT_CANDIDATE_STEP,
    TS_PROGRESS_EVENT_FILE_STEP,
    TS_PROGRESS_LOG_PERCENT_STEP,
)
from .ts_types import TSAssetPayload, TSAssetStat, TSRootDefinition, TSScanStatus
from .ts_utils import TSNormalizePathString

TSLogger = logging.getLogger("TSArtiusBrowser")


class TSIndexer:
    def __init__(
        self,
        ts_database,
        ts_storage_paths,
        ts_config_store,
        ts_handler_registry,
        ts_preview_cache,
        ts_tools,
        ts_emit_callback,
    ) -> None:
        self.ts_database = ts_database
        self.ts_storage_paths = ts_storage_paths
        self.ts_config_store = ts_config_store
        self.ts_handler_registry = ts_handler_registry
        self.ts_preview_cache = ts_preview_cache
        self.ts_tools = ts_tools
        self.ts_emit_callback = ts_emit_callback
        self.ts_async_lock = asyncio.Lock()
        self.ts_thread_lock = threading.Lock()
        self.ts_scan_task: asyncio.Task | None = None
        self.ts_pending_request: dict[str, str | None] | None = None
        self.ts_last_progress_bucket = -1
        self.ts_status = TSScanStatus(
            ts_running=False,
            ts_phase="idle",
            ts_scanned=0,
            ts_changed=0,
            ts_total_candidates=0,
            ts_processed_candidates=0,
            ts_total_files=0,
            ts_deleted=0,
            ts_progress_percent=0.0,
            ts_progress_message="",
            ts_started_at=None,
            ts_completed_at=None,
            ts_error=None,
        )

    def TSGetStatus(self) -> dict[str, Any]:
        return self.ts_status.TSAsDict()

    async def TSStartBackgroundScan(self, ts_scope: str | None = None, ts_root_id: str | None = None) -> bool:
        async with self.ts_async_lock:
            if self.ts_scan_task is not None and not self.ts_scan_task.done():
                self.ts_pending_request = {"scope": ts_scope, "root_id": ts_root_id}
                TSLogVerbose("indexer.scan.queued", scope=ts_scope, root_id=ts_root_id)
                return False
            self.ts_scan_task = asyncio.create_task(self._TSRunScanAsync(ts_scope, ts_root_id))
            TSLogVerbose("indexer.scan.started_async", scope=ts_scope, root_id=ts_root_id)
            return True

    async def _TSRunScanAsync(self, ts_scope: str | None, ts_root_id: str | None) -> None:
        await asyncio.to_thread(self.TSRunScanSync, ts_scope, ts_root_id)
        async with self.ts_async_lock:
            if self.ts_pending_request is not None:
                ts_pending = self.ts_pending_request
                self.ts_pending_request = None
                TSLogVerbose("indexer.scan.dequeued", scope=ts_pending.get("scope"), root_id=ts_pending.get("root_id"))
                self.ts_scan_task = asyncio.create_task(self._TSRunScanAsync(ts_pending.get("scope"), ts_pending.get("root_id")))
            else:
                self.ts_scan_task = None

    def TSRunScanSync(self, ts_scope: str | None = None, ts_root_id: str | None = None) -> None:
        with self.ts_thread_lock:
            self.ts_last_progress_bucket = -1
            self.ts_status = TSScanStatus(
                ts_running=True,
                ts_phase="walk",
                ts_scanned=0,
                ts_changed=0,
                ts_total_candidates=0,
                ts_processed_candidates=0,
                ts_total_files=0,
                ts_deleted=0,
                ts_progress_percent=0.0,
                ts_progress_message="Scanning files",
                ts_started_at=time.time(),
                ts_completed_at=None,
                ts_error=None,
            )
            self.ts_emit_callback(TS_EVENT_INDEX_START, {"status": self.TSGetStatus()})
            self.ts_emit_callback(TS_EVENT_HEALTH, {"issues": [ts_issue.TSAsDict() for ts_issue in self.ts_tools.TSGetHealth()]})

            try:
                ts_config = self.ts_config_store.TSLoadConfig()
                ts_roots = self.ts_storage_paths.TSBuildBaseRoots(ts_config)
                if ts_scope:
                    ts_roots = [ts_root for ts_root in ts_roots if ts_root.ts_scope == ts_scope]
                if ts_root_id:
                    ts_roots = [ts_root for ts_root in ts_roots if ts_root.ts_root_id == ts_root_id]
                TSLogInfoIfVerbose(
                    "TS asset scan start: %s",
                    ", ".join(f"{ts_root.ts_root_id}={ts_root.ts_path}" for ts_root in ts_roots) or "<none>",
                )
                TSLogVerbose(
                    "indexer.scan.start",
                    scope=ts_scope,
                    root_id=ts_root_id,
                    roots=[
                        {"root_id": ts_root.ts_root_id, "scope": ts_root.ts_scope, "path": str(ts_root.ts_path)}
                        for ts_root in ts_roots
                    ],
                )

                if not ts_roots:
                    self.ts_status.ts_running = False
                    self.ts_status.ts_phase = "idle"
                    self.ts_status.ts_progress_percent = 100.0
                    self.ts_status.ts_progress_message = "No asset roots configured"
                    self.ts_status.ts_completed_at = time.time()
                    self.ts_emit_callback(TS_EVENT_INDEX_COMPLETE, {"status": self.TSGetStatus()})
                    return

                ts_candidate_stats: list[tuple[TSAssetStat, Any | None]] = []
                ts_seen_paths: set[str] = set()
                self._TSEmitScanProgress(force_event=True, force_log=True)

                for ts_root in ts_roots:
                    for ts_asset_stat_batch in self._TSIterAssetStatBatches(ts_root, 500):
                        ts_path_batch = [TSNormalizePathString(ts_asset_stat.ts_path) for ts_asset_stat in ts_asset_stat_batch]
                        ts_existing_rows = self.ts_database.TSGetSnapshotBatch(ts_path_batch)
                        ts_discovered_payloads: list[TSAssetPayload] = []
                        ts_pending_candidates: list[tuple[TSAssetStat, Any | None, bool]] = []

                        for ts_asset_stat in ts_asset_stat_batch:
                            ts_normalized_path = TSNormalizePathString(ts_asset_stat.ts_path)
                            ts_seen_paths.add(ts_normalized_path)
                            ts_existing_row = ts_existing_rows.get(ts_normalized_path)
                            self.ts_status.ts_scanned += 1
                            ts_handler = self.ts_handler_registry.TSResolveHandler(ts_asset_stat.ts_extension, None)
                            if ts_handler is None:
                                continue
                            ts_stat_changed = (
                                ts_existing_row is None
                                or int(ts_existing_row["mtime_ns"] or 0) != ts_asset_stat.ts_mtime_ns
                                or int(ts_existing_row["size_bytes"] or 0) != ts_asset_stat.ts_size_bytes
                                or str(ts_existing_row["type"] or "") != ts_handler.ts_kind
                            )
                            ts_needs_index = (
                                ts_stat_changed
                                or ts_existing_row is None
                                or not bool(ts_existing_row["is_indexed"])
                                or not bool(ts_existing_row["has_preview"])
                                or not bool(ts_existing_row["has_metadata"])
                            )
                            if ts_stat_changed:
                                ts_discovered_payload = ts_handler.TSBuildDiscoveredPayload(ts_asset_stat)
                                ts_discovered_payload = TSCarryExistingRowValues(ts_discovered_payload, ts_existing_row, ts_reset_processing=True)
                                if ts_existing_row is not None:
                                    ts_existing_preview_path = str(ts_existing_row["preview_path"] or "")
                                    if ts_existing_preview_path and self.ts_database.TSCountPreviewReferences(ts_existing_preview_path, int(ts_existing_row["id"])) == 0:
                                        self.ts_preview_cache.TSPurgePreview(ts_existing_preview_path)
                                ts_discovered_payloads.append(ts_discovered_payload)
                            ts_pending_candidates.append((ts_asset_stat, ts_existing_row, ts_stat_changed))
                            if self.ts_status.ts_scanned % max(1, TS_PROGRESS_EVENT_FILE_STEP) == 0:
                                self._TSEmitScanProgress()

                        ts_catalog_rows_by_path: dict[str, Any] = {}
                        if ts_discovered_payloads:
                            ts_catalog_rows = self.ts_database.TSUpsertAssets(ts_discovered_payloads)
                            ts_catalog_rows_by_path = {str(ts_row["path"]): ts_row for ts_row in ts_catalog_rows}

                        for ts_asset_stat, ts_existing_row, ts_stat_changed in ts_pending_candidates:
                            ts_normalized_path = TSNormalizePathString(ts_asset_stat.ts_path)
                            ts_effective_row = ts_catalog_rows_by_path.get(ts_normalized_path, ts_existing_row)
                            ts_needs_index = (
                                ts_stat_changed
                                or ts_effective_row is None
                                or not bool(ts_effective_row["is_indexed"])
                                or not bool(ts_effective_row["has_preview"])
                                or not bool(ts_effective_row["has_metadata"])
                            )
                            if ts_needs_index:
                                ts_candidate_stats.append((ts_asset_stat, ts_effective_row))

                self.ts_status.ts_total_files = self.ts_status.ts_scanned
                ts_root_asset_refs = self.ts_database.TSGetRootAssetRefs([ts_root.ts_root_id for ts_root in ts_roots])
                ts_deleted_rows = [ts_row for ts_row in ts_root_asset_refs if str(ts_row["path"]) not in ts_seen_paths]
                self.ts_status.ts_deleted = len(ts_deleted_rows)
                if ts_deleted_rows:
                    for ts_row in ts_deleted_rows:
                        ts_preview_path = str(ts_row["preview_path"] or "")
                        if ts_preview_path and self.ts_database.TSCountPreviewReferences(ts_preview_path, int(ts_row["id"])) == 0:
                            self.ts_preview_cache.TSPurgePreview(ts_preview_path)
                    self.ts_database.TSDeleteAssetIds([int(ts_row["id"]) for ts_row in ts_deleted_rows])

                self.ts_status.ts_phase = "hash"
                self.ts_status.ts_total_candidates = len(ts_candidate_stats)
                self.ts_status.ts_processed_candidates = 0
                ts_worker_count = int(ts_config.get("indexing", {}).get("hash_workers", TS_DEFAULT_HASH_WORKERS))
                ts_batch_size = int(ts_config.get("indexing", {}).get("batch_size", TS_DEFAULT_SCAN_BATCH))
                self._TSEmitScanProgress(force_event=True, force_log=True)

                with ThreadPoolExecutor(max_workers=max(1, ts_worker_count)) as ts_executor:
                    for ts_batch_start in range(0, len(ts_candidate_stats), ts_batch_size):
                        ts_batch = ts_candidate_stats[ts_batch_start : ts_batch_start + ts_batch_size]
                        ts_executor_batch = list(ts_batch)
                        ts_processed_results = list(ts_executor.map(self._TSProcessCandidateTuple, ts_executor_batch))
                        ts_upsert_payloads: list[TSAssetPayload] = []
                        for ts_payload, ts_existing_row in ts_processed_results:
                            self.ts_status.ts_processed_candidates += 1
                            if ts_payload is not None:
                                if ts_existing_row is not None and str(ts_existing_row["hash"] or "") != ts_payload.ts_hash:
                                    ts_existing_preview_path = str(ts_existing_row["preview_path"] or "")
                                    if ts_existing_preview_path and self.ts_database.TSCountPreviewReferences(ts_existing_preview_path, int(ts_existing_row["id"])) == 0:
                                        self.ts_preview_cache.TSPurgePreview(ts_existing_preview_path)
                                ts_upsert_payloads.append(ts_payload)
                            if (
                                self.ts_status.ts_processed_candidates % max(1, TS_PROGRESS_EVENT_CANDIDATE_STEP) == 0
                                or self.ts_status.ts_processed_candidates >= self.ts_status.ts_total_candidates
                            ):
                                self._TSEmitScanProgress()
                        if ts_upsert_payloads:
                            self.ts_database.TSUpsertAssets(ts_upsert_payloads)
                            self.ts_status.ts_changed += len(ts_upsert_payloads)

                self.ts_status.ts_running = False
                self.ts_status.ts_phase = "idle"
                self.ts_status.ts_progress_percent = 100.0
                self.ts_status.ts_progress_message = "Scan complete"
                self.ts_status.ts_completed_at = time.time()
                ts_type_counts = self.ts_database.TSCountVisibleByType([ts_root.ts_root_id for ts_root in ts_roots])
                ts_total_visible = sum(ts_type_counts.values())
                self._TSEmitScanProgress(force_event=True, force_log=True)
                TSLogInfoIfVerbose(
                    "TS asset scan complete: scanned=%s changed=%s deleted=%s candidates=%s",
                    self.ts_status.ts_scanned,
                    self.ts_status.ts_changed,
                    self.ts_status.ts_deleted,
                    self.ts_status.ts_total_candidates,
                )
                TSLogInfoIfVerbose(
                    "TS asset summary: total=%s image=%s video=%s audio=%s 3d=%s",
                    ts_total_visible,
                    ts_type_counts.get("image", 0),
                    ts_type_counts.get("video", 0),
                    ts_type_counts.get("audio", 0),
                    ts_type_counts.get("3d", 0),
                )
                self.ts_emit_callback(TS_EVENT_INDEX_COMPLETE, {"status": self.TSGetStatus()})
            except Exception as ts_exception:
                TSLogger.exception("TS asset scan failed")
                TSLogVerbose("indexer.scan.failed", error=str(ts_exception))
                self.ts_status.ts_running = False
                self.ts_status.ts_phase = "error"
                self.ts_status.ts_error = str(ts_exception)
                self.ts_status.ts_completed_at = time.time()
                self.ts_status.ts_progress_message = str(ts_exception)
                self.ts_emit_callback(TS_EVENT_INDEX_COMPLETE, {"status": self.TSGetStatus()})

    def _TSIterAssetStatBatches(self, ts_root: TSRootDefinition, ts_batch_size: int) -> Iterable[list[TSAssetStat]]:
        ts_batch: list[TSAssetStat] = []
        for ts_asset_stat in self._TSIterAssetStats(ts_root):
            ts_batch.append(ts_asset_stat)
            if len(ts_batch) >= max(1, int(ts_batch_size)):
                yield ts_batch
                ts_batch = []
        if ts_batch:
            yield ts_batch

    def _TSEmitScanProgress(self, *, force_event: bool = False, force_log: bool = False) -> None:
        self.ts_status.ts_progress_percent = TSComputeProgressPercent(self.ts_status)
        self.ts_status.ts_progress_message = TSBuildProgressMessage(self.ts_status)
        if force_event or self.ts_status.ts_running:
            self.ts_emit_callback(
                TS_EVENT_INDEX_PROGRESS,
                {
                    "status": self.TSGetStatus(),
                    "message": self.ts_status.ts_progress_message,
                },
            )
        ts_step = max(1, int(TS_PROGRESS_LOG_PERCENT_STEP))
        ts_bucket = int(self.ts_status.ts_progress_percent // ts_step)
        if force_log or ts_bucket > self.ts_last_progress_bucket:
            self.ts_last_progress_bucket = ts_bucket
            TSLogProgress(
                "TS asset scan progress: [%s] %3d%% | %s",
                TSBuildConsoleProgressBar(self.ts_status.ts_progress_percent),
                round(self.ts_status.ts_progress_percent),
                self.ts_status.ts_progress_message,
            )

    def _TSIterAssetStats(self, ts_root: TSRootDefinition) -> Iterable[TSAssetStat]:
        ts_ignored_paths = {ts_path.resolve() for ts_path in self.ts_storage_paths.TSIgnorePathsForRoot(ts_root)}
        return TSIterAssetStats(ts_root, ts_ignored_paths)

    def _TSProcessCandidateTuple(
        self,
        ts_candidate_tuple: tuple[TSAssetStat, Any | None],
    ) -> tuple[TSAssetPayload | None, Any | None]:
        return TSProcessCandidateTuple(ts_candidate_tuple, self.ts_handler_registry, self.ts_preview_cache)



