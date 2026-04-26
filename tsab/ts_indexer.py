from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
from typing import Any, Iterable

from .ts_hashing import TSComputeFileHash, TSDetectSupportedType
from .ts_logging import TSLogInfoIfVerbose, TSLogProgress, TSLogVerbose
from .ts_settings import (
    TS_3D_EXTENSIONS,
    TS_AUDIO_EXTENSIONS,
    TS_COMPANION_SUFFIXES,
    TS_IMAGE_EXTENSIONS,
    TS_LEGACY_STORAGE_DIRECTORY_NAMES,
    TS_DEFAULT_HASH_WORKERS,
    TS_DEFAULT_SCAN_BATCH,
    TS_EVENT_HEALTH,
    TS_EVENT_INDEX_COMPLETE,
    TS_EVENT_INDEX_PROGRESS,
    TS_EVENT_INDEX_START,
    TS_PROGRESS_EVENT_CANDIDATE_STEP,
    TS_PROGRESS_EVENT_FILE_STEP,
    TS_PROGRESS_LOG_PERCENT_STEP,
    TS_STORAGE_DIRECTORY_NAME,
    TS_SUPPORTED_EXTENSIONS,
    TS_VIDEO_EXTENSIONS,
)
from .ts_types import TSAssetPayload, TSAssetStat, TSRootDefinition, TSScanStatus
from .ts_utils import TSFolderPosixPath, TSNormalizePathString, TSRelativePosixPath

TSLogger = logging.getLogger("TSArtiusBrowser")
TS_IGNORED_DIRECTORY_NAMES = {TS_STORAGE_DIRECTORY_NAME.lower(), *(ts_name.lower() for ts_name in TS_LEGACY_STORAGE_DIRECTORY_NAMES)}


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
                                ts_discovered_payload = self._TSCarryRowValues(ts_discovered_payload, ts_existing_row, ts_reset_processing=True)
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

    def _TSCarryRowValues(
        self,
        ts_payload: TSAssetPayload,
        ts_existing_row: Any | None,
        *,
        ts_reset_processing: bool,
    ) -> TSAssetPayload:
        if ts_existing_row is None:
            return ts_payload
        ts_created_at = int(ts_existing_row["created_at"] or 0) or ts_payload.ts_created_at
        ts_tags = str(ts_existing_row["tags"] or "")
        ts_rating = int(ts_existing_row["rating"] or 0)
        ts_updates = {
            "ts_created_at": ts_created_at,
            "ts_tags": ts_tags,
            "ts_rating": ts_rating,
        }
        if ts_reset_processing:
            ts_updates.update(
                {
                    "ts_hash": "",
                    "ts_metadata": "{}",
                    "ts_technical_json": "{}",
                    "ts_prompt_text": "",
                    "ts_workflow_text": "",
                    "ts_is_indexed": False,
                    "ts_has_preview": False,
                    "ts_has_metadata": False,
                }
            )
        return replace(ts_payload, **ts_updates)

    def _TSIterAssetStatBatches(self, ts_root: TSRootDefinition, ts_batch_size: int) -> Iterable[list[TSAssetStat]]:
        ts_batch: list[TSAssetStat] = []
        for ts_asset_stat in self._TSIterAssetStats(ts_root):
            ts_batch.append(ts_asset_stat)
            if len(ts_batch) >= max(1, int(ts_batch_size)):
                yield ts_batch
                ts_batch = []
        if ts_batch:
            yield ts_batch

    def _TSComputeProgressPercent(self) -> float:
        if self.ts_status.ts_phase == "count":
            return 0.0
        if self.ts_status.ts_phase == "walk":
            if self.ts_status.ts_total_files <= 0:
                return 0.0
            return min(55.0, 55.0 * (self.ts_status.ts_scanned / max(1, self.ts_status.ts_total_files)))
        if self.ts_status.ts_phase == "hash":
            if self.ts_status.ts_total_candidates <= 0:
                return 100.0
            return min(100.0, 55.0 + (45.0 * (self.ts_status.ts_processed_candidates / max(1, self.ts_status.ts_total_candidates))))
        if self.ts_status.ts_phase == "idle" and self.ts_status.ts_completed_at is not None and not self.ts_status.ts_error:
            return 100.0
        return max(0.0, min(100.0, self.ts_status.ts_progress_percent))

    def _TSBuildProgressMessage(self) -> str:
        if self.ts_status.ts_phase == "count":
            return "Counting supported files"
        if self.ts_status.ts_phase == "walk":
            if self.ts_status.ts_total_files > 0:
                return f"Scanning files {self.ts_status.ts_scanned}/{self.ts_status.ts_total_files}"
            return f"Scanning files {self.ts_status.ts_scanned}"
        if self.ts_status.ts_phase == "hash":
            if self.ts_status.ts_total_candidates > 0:
                return f"Indexing changed assets {self.ts_status.ts_processed_candidates}/{self.ts_status.ts_total_candidates}"
            return "Finalizing index"
        if self.ts_status.ts_phase == "error":
            return self.ts_status.ts_error or "Scan failed"
        if self.ts_status.ts_phase == "idle" and self.ts_status.ts_completed_at is not None:
            return "Scan complete"
        return "Idle"

    def _TSBuildConsoleProgressBar(self, ts_percent: float, ts_width: int = 24) -> str:
        ts_clamped = max(0.0, min(100.0, ts_percent))
        ts_filled = int(round((ts_clamped / 100.0) * ts_width))
        return f"{'#' * ts_filled}{'-' * max(0, ts_width - ts_filled)}"

    def _TSEmitScanProgress(self, *, force_event: bool = False, force_log: bool = False) -> None:
        self.ts_status.ts_progress_percent = self._TSComputeProgressPercent()
        self.ts_status.ts_progress_message = self._TSBuildProgressMessage()
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
                self._TSBuildConsoleProgressBar(self.ts_status.ts_progress_percent),
                round(self.ts_status.ts_progress_percent),
                self.ts_status.ts_progress_message,
            )

    def _TSIterAssetStats(self, ts_root: TSRootDefinition) -> Iterable[TSAssetStat]:
        ts_ignored_paths = {ts_path.resolve() for ts_path in self.ts_storage_paths.TSIgnorePathsForRoot(ts_root)}
        ts_directory_stack = [ts_root.ts_path]
        while ts_directory_stack:
            ts_directory = ts_directory_stack.pop()
            ts_subdirectories, ts_file_entries = self._TSScanDirectory(ts_directory, ts_ignored_paths)
            ts_directory_stack.extend(ts_subdirectories)
            for ts_entry in ts_file_entries:
                try:
                    ts_entry_path = Path(ts_entry.path).resolve()
                    ts_stat = ts_entry.stat(follow_symlinks=False)
                    ts_relative_path = TSRelativePosixPath(ts_entry_path, ts_root.ts_path.resolve())
                    yield TSAssetStat(
                        ts_path=ts_entry_path,
                        ts_root=ts_root,
                        ts_relative_path=ts_relative_path,
                        ts_folder_path=TSFolderPosixPath(ts_relative_path),
                        ts_filename=ts_entry_path.name,
                        ts_extension=ts_entry_path.suffix.lower(),
                        ts_size_bytes=int(ts_stat.st_size),
                        ts_mtime_ns=int(getattr(ts_stat, "st_mtime_ns", int(ts_stat.st_mtime * 1000000000))),
                        ts_ctime_ns=int(getattr(ts_stat, "st_ctime_ns", int(ts_stat.st_ctime * 1000000000))),
                    )
                except OSError as ts_error:
                    TSLogVerbose("indexer.file.stat_failed", path=str(getattr(ts_entry, 'path', '')), error=str(ts_error))

    def _TSScanDirectory(self, ts_directory: Path, ts_ignored_paths: set[Path]) -> tuple[list[Path], list[os.DirEntry[str]]]:
        ts_subdirectories: list[Path] = []
        ts_file_entries: list[os.DirEntry[str]] = []
        try:
            with os.scandir(ts_directory) as ts_entries:
                for ts_entry in ts_entries:
                    ts_entry_path = Path(ts_entry.path)
                    if ts_entry.is_dir(follow_symlinks=False):
                        try:
                            ts_resolved_path = ts_entry_path.resolve()
                        except OSError:
                            continue
                        if ts_entry_path.name.lower() in TS_IGNORED_DIRECTORY_NAMES:
                            TSLogVerbose("indexer.path.ignored", path=str(ts_entry_path), reason="technical_directory")
                            continue
                        if ts_resolved_path in ts_ignored_paths:
                            TSLogVerbose("indexer.path.ignored", path=str(ts_entry_path))
                            continue
                        ts_subdirectories.append(ts_resolved_path)
                        continue
                    if ts_entry_path.suffix.lower() in TS_SUPPORTED_EXTENSIONS:
                        ts_file_entries.append(ts_entry)
        except OSError as ts_error:
            TSLogVerbose("indexer.directory.scan_failed", directory=str(ts_directory), error=str(ts_error))
            return [], []
        return ts_subdirectories, self._TSFilterCompanionEntries(ts_file_entries)

    def _TSNormalizeCompanionStem(self, ts_stem: str) -> str:
        ts_normalized = str(ts_stem or "").lower()
        ts_changed = True
        while ts_changed and ts_normalized:
            ts_changed = False
            for ts_suffix in TS_COMPANION_SUFFIXES:
                if ts_normalized.endswith(ts_suffix):
                    ts_normalized = ts_normalized[: -len(ts_suffix)].rstrip("._- ")
                    ts_changed = True
                    break
        return ts_normalized

    def _TSFilterCompanionEntries(self, ts_file_entries: list[os.DirEntry[str]]) -> list[os.DirEntry[str]]:
        ts_media_stems = {
            Path(ts_entry.path).stem.lower()
            for ts_entry in ts_file_entries
            if Path(ts_entry.path).suffix.lower() in (TS_VIDEO_EXTENSIONS | TS_AUDIO_EXTENSIONS | TS_3D_EXTENSIONS)
        }
        ts_result: list[os.DirEntry[str]] = []
        for ts_entry in ts_file_entries:
            ts_entry_path = Path(ts_entry.path)
            ts_extension = ts_entry_path.suffix.lower()
            if ts_extension not in TS_SUPPORTED_EXTENSIONS:
                continue
            if ts_extension in TS_IMAGE_EXTENSIONS:
                ts_stem = ts_entry_path.stem.lower()
                ts_base_stem = self._TSNormalizeCompanionStem(ts_stem)
                if ts_stem in ts_media_stems or (ts_base_stem and ts_base_stem in ts_media_stems):
                    TSLogVerbose("indexer.companion.skipped", path=str(ts_entry_path), related_stem=ts_base_stem or ts_stem)
                    continue
            ts_result.append(ts_entry)
        return ts_result

    def _TSProcessCandidateTuple(
        self,
        ts_candidate_tuple: tuple[TSAssetStat, Any | None],
    ) -> tuple[TSAssetPayload | None, Any | None]:
        ts_asset_stat, ts_existing_row = ts_candidate_tuple
        ts_kind = TSDetectSupportedType(ts_asset_stat.ts_path)
        if ts_kind is None:
            return None, ts_existing_row
        ts_handler = self.ts_handler_registry.TSResolveHandler(ts_asset_stat.ts_extension, ts_kind)
        if ts_handler is None:
            return None, ts_existing_row
        ts_hash = TSComputeFileHash(ts_asset_stat.ts_path)
        ts_payload = ts_handler.TSBuildIndexedPayload(ts_asset_stat, ts_hash)
        ts_processing_row = {
            "path": ts_payload.ts_path,
            "hash": ts_payload.ts_hash,
            "type": ts_payload.ts_type,
            "extension": ts_payload.ts_extension,
            "filename": ts_payload.ts_filename,
        }
        ts_preview_path = ts_handler.TSGeneratePreview(ts_processing_row)
        ts_has_preview = bool(ts_preview_path) and not self.ts_preview_cache.TSIsPlaceholderPreview(ts_preview_path)
        ts_metadata_payload = ts_handler.TSExtractMetadata(ts_processing_row)
        ts_metadata_json = str(ts_metadata_payload.get("metadata") or "{}")
        ts_prompt_text = str(ts_metadata_payload.get("prompt_text") or "")
        ts_workflow_text = str(ts_metadata_payload.get("workflow_text") or "")
        ts_has_metadata = bool(
            ts_metadata_payload.get("has_metadata")
            or (ts_metadata_json and ts_metadata_json != "{}")
            or ts_prompt_text
            or ts_workflow_text
            or ts_payload.ts_has_metadata
        )
        ts_payload = replace(
            ts_payload,
            ts_preview_path=ts_preview_path or ts_payload.ts_preview_path,
            ts_metadata=ts_metadata_json,
            ts_prompt_text=ts_prompt_text,
            ts_workflow_text=ts_workflow_text,
            ts_has_preview=ts_has_preview,
            ts_has_metadata=ts_has_metadata,
        )
        ts_payload = self._TSCarryRowValues(ts_payload, ts_existing_row, ts_reset_processing=False)
        return ts_payload, ts_existing_row



