from __future__ import annotations

import asyncio
import logging
import threading
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
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
        self.ts_pending_requests: list[dict[str, str | None]] = []
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

    async def TSRunExclusiveMaintenance(self, ts_maintenance_callable) -> bool:
        # Runs a blocking maintenance action (cache rebuild reset) while
        # holding the same lock that guards scan-task creation. Checking the
        # status dict alone is racy: "running" flips true only once the worker
        # thread starts, so a just-created scan task could interleave with
        # TSResetIndex + VACUUM. Holding ts_async_lock here means no scan task
        # can be created mid-maintenance, and an existing task blocks it.
        async with self.ts_async_lock:
            if self.ts_scan_task is not None and not self.ts_scan_task.done():
                return False
            await asyncio.to_thread(ts_maintenance_callable)
            return True

    async def TSStartBackgroundScan(self, ts_scope: str | None = None, ts_root_id: str | None = None) -> bool:
        async with self.ts_async_lock:
            if self.ts_scan_task is not None and not self.ts_scan_task.done():
                # Keep every distinct queued request: a single pending slot
                # silently dropped an earlier "rescan root A" when "rescan
                # root B" arrived while a scan was running.
                ts_pending_request = {"scope": ts_scope, "root_id": ts_root_id}
                if ts_pending_request not in self.ts_pending_requests:
                    self.ts_pending_requests.append(ts_pending_request)
                TSLogVerbose("indexer.scan.queued", scope=ts_scope, root_id=ts_root_id)
                return False
            self.ts_scan_task = asyncio.create_task(self._TSRunScanAsync(ts_scope, ts_root_id))
            TSLogVerbose("indexer.scan.started_async", scope=ts_scope, root_id=ts_root_id)
            return True

    async def _TSRunScanAsync(self, ts_scope: str | None, ts_root_id: str | None) -> None:
        await asyncio.to_thread(self.TSRunScanSync, ts_scope, ts_root_id)
        async with self.ts_async_lock:
            if self.ts_pending_requests:
                ts_pending = self.ts_pending_requests.pop(0)
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
            self.ts_tools.TSInvalidateMissingTools()
            self.ts_emit_callback(TS_EVENT_HEALTH, {"issues": [ts_issue.TSAsDict() for ts_issue in self.ts_tools.TSGetHealth()]})

            try:
                ts_config = self.ts_config_store.TSLoadConfig()
                ts_roots = self.ts_storage_paths.TSBuildBaseRoots(ts_config)
                if ts_scope:
                    ts_roots = [ts_root for ts_root in ts_roots if ts_root.ts_scope == ts_scope]
                if ts_root_id:
                    ts_roots = [ts_root for ts_root in ts_roots if ts_root.ts_root_id == ts_root_id]
                ts_unavailable_roots = [ts_root for ts_root in ts_roots if not ts_root.ts_path.is_dir()]
                if ts_unavailable_roots:
                    # A missing root directory (unplugged drive, network share
                    # down) must not be treated as "all assets deleted" -
                    # skipping it here keeps the root out of both the walk and
                    # the stale-row prune below.
                    TSLogger.warning(
                        "TS asset scan skipping unavailable roots: %s",
                        ", ".join(f"{ts_root.ts_root_id}={ts_root.ts_path}" for ts_root in ts_unavailable_roots),
                    )
                    ts_roots = [ts_root for ts_root in ts_roots if ts_root not in ts_unavailable_roots]
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
                ts_incomplete_root_ids: set[str] = set()
                self._TSEmitScanProgress(force_event=True, force_log=True)

                for ts_root in ts_roots:
                    ts_failed_directories: list[str] = []
                    for ts_asset_stat_batch in self._TSIterAssetStatBatches(ts_root, 500, ts_failed_directories):
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

                    if ts_failed_directories:
                        # Same rule as the unavailable-root guard above: an
                        # unreadable subdirectory (network share blip, sharing
                        # violation, permission error) must not be treated as
                        # "all assets under it were deleted".
                        ts_incomplete_root_ids.add(ts_root.ts_root_id)
                        TSLogger.warning(
                            "TS asset scan skipping stale-row prune for root %s: %d directories unreadable (first: %s)",
                            ts_root.ts_root_id,
                            len(ts_failed_directories),
                            ts_failed_directories[0],
                        )

                self.ts_status.ts_total_files = self.ts_status.ts_scanned
                ts_prunable_root_ids = [
                    ts_root.ts_root_id for ts_root in ts_roots if ts_root.ts_root_id not in ts_incomplete_root_ids
                ]
                ts_root_asset_refs = (
                    self.ts_database.TSGetRootAssetRefs(ts_prunable_root_ids) if ts_prunable_root_ids else []
                )
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

                # Sliding-window pipeline instead of a per-batch barrier: with
                # executor.map on fixed batches, a batch could not advance until
                # its slowest candidate finished (one 4K video stalled 127 fast
                # images). Here a fresh candidate is submitted as soon as any
                # in-flight one completes, so workers never idle on a barrier.
                # Memory stays bounded by the window (worker_count * 2 futures)
                # plus one pending upsert batch — important for 100k-file
                # rebuilds. Semantics are unchanged: the same payloads are
                # upserted, previews for re-hashed assets are purged the same
                # way, progress is counted per result, and DB writes are still
                # grouped in batch_size chunks (companion-flag recompute per
                # touched folder is idempotent, so grouping/order does not affect
                # the final state — matching the previous per-batch behavior).
                ts_max_in_flight = max(1, ts_worker_count) * 2
                ts_candidate_iterator = iter(ts_candidate_stats)
                ts_upsert_payloads: list[TSAssetPayload] = []
                with ThreadPoolExecutor(max_workers=max(1, ts_worker_count)) as ts_executor:
                    ts_in_flight = set()
                    for _ts_slot in range(ts_max_in_flight):
                        ts_next_candidate = next(ts_candidate_iterator, None)
                        if ts_next_candidate is None:
                            break
                        ts_in_flight.add(ts_executor.submit(self._TSProcessCandidateTuple, ts_next_candidate))

                    while ts_in_flight:
                        ts_completed, ts_in_flight = wait(ts_in_flight, return_when=FIRST_COMPLETED)
                        for ts_future in ts_completed:
                            ts_payload, ts_existing_row = ts_future.result()
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
                            ts_next_candidate = next(ts_candidate_iterator, None)
                            if ts_next_candidate is not None:
                                ts_in_flight.add(ts_executor.submit(self._TSProcessCandidateTuple, ts_next_candidate))
                            if len(ts_upsert_payloads) >= ts_batch_size:
                                self.ts_database.TSUpsertAssets(ts_upsert_payloads, ts_return_rows=False)
                                self.ts_status.ts_changed += len(ts_upsert_payloads)
                                ts_upsert_payloads = []
                if ts_upsert_payloads:
                    self.ts_database.TSUpsertAssets(ts_upsert_payloads, ts_return_rows=False)
                    self.ts_status.ts_changed += len(ts_upsert_payloads)

                self.ts_status.ts_running = False
                self.ts_status.ts_phase = "idle"
                self.ts_status.ts_progress_percent = 100.0
                self.ts_status.ts_progress_message = "Scan complete"
                self.ts_status.ts_completed_at = time.time()
                ts_type_counts = self.ts_database.TSCountVisibleByType([ts_root.ts_root_id for ts_root in ts_roots])
                ts_total_visible = sum(ts_type_counts.values())
                # Reconcile orphaned preview files only on a full scan (all
                # roots): the post-generation autoscan is scoped to a single
                # root and runs after every prompt, so gating on a full scan
                # keeps a whole-cache directory walk off that hot path while
                # still cleaning up crash/interrupt orphans at startup and on a
                # manual "All Folders" rescan.
                if ts_scope is None and ts_root_id is None:
                    try:
                        ts_referenced_previews = self.ts_database.TSGetAllPreviewPaths()
                        ts_purged_previews = self.ts_preview_cache.TSPurgeOrphanedPreviews(ts_referenced_previews)
                        if ts_purged_previews:
                            TSLogInfoIfVerbose(
                                "TS preview cache maintenance removed %s orphaned previews",
                                ts_purged_previews,
                            )
                    except Exception:
                        TSLogger.exception("TS preview cache maintenance failed")
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

    def _TSIterAssetStatBatches(
        self,
        ts_root: TSRootDefinition,
        ts_batch_size: int,
        ts_failed_directories: list[str] | None = None,
    ) -> Iterable[list[TSAssetStat]]:
        ts_batch: list[TSAssetStat] = []
        for ts_asset_stat in self._TSIterAssetStats(ts_root, ts_failed_directories):
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

    def _TSIterAssetStats(
        self,
        ts_root: TSRootDefinition,
        ts_failed_directories: list[str] | None = None,
    ) -> Iterable[TSAssetStat]:
        ts_ignored_paths = {ts_path.resolve() for ts_path in self.ts_storage_paths.TSIgnorePathsForRoot(ts_root)}
        return TSIterAssetStats(ts_root, ts_ignored_paths, ts_failed_directories)

    def _TSProcessCandidateTuple(
        self,
        ts_candidate_tuple: tuple[TSAssetStat, Any | None],
    ) -> tuple[TSAssetPayload | None, Any | None]:
        return TSProcessCandidateTuple(ts_candidate_tuple, self.ts_handler_registry, self.ts_preview_cache)



