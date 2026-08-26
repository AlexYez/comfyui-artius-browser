from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Callable

from .ts_asset_metadata import TSNeedsPromptMetadataRefresh
from .ts_hashing import TSComputeFileHash, TSDetectSupportedType
from .ts_types import TSAssetStat
from .ts_utils import TSJsonLoads


class TSAssetProcessingService:
    def __init__(
        self,
        ts_database,
        ts_preview_cache,
        ts_handler_registry,
        ts_build_asset_stat: Callable[[object], TSAssetStat],
        ts_get_asset_lock: Callable[[int], object],
        ts_emit_asset_upsert: Callable[[object], None],
        ts_compute_file_hash: Callable[[Path], str] = TSComputeFileHash,
        ts_detect_supported_type: Callable[[Path], str | None] = TSDetectSupportedType,
    ) -> None:
        self.ts_database = ts_database
        self.ts_preview_cache = ts_preview_cache
        self.ts_handler_registry = ts_handler_registry
        self.ts_build_asset_stat = ts_build_asset_stat
        self.ts_get_asset_lock = ts_get_asset_lock
        self.ts_emit_asset_upsert = ts_emit_asset_upsert
        self.ts_compute_file_hash = ts_compute_file_hash
        self.ts_detect_supported_type = ts_detect_supported_type

    def TSWarmPreview(self, ts_asset_id: int) -> dict[str, object]:
        ts_row = self.ts_database.TSGetAssetById(ts_asset_id)
        if ts_row is None:
            return {"queued": False, "reason": "missing"}
        ts_preview_path = str(ts_row["preview_path"] or "")
        if bool(ts_row["has_preview"]) and ts_preview_path and self._TSPreviewFileReady(ts_preview_path):
            return {"queued": False, "reason": "ready"}
        return {"queued": False, "reason": "disabled"}

    def _TSPreviewFileReady(self, ts_preview_path: str) -> bool:
        try:
            return self.ts_preview_cache.TSResolvePreviewPath(ts_preview_path).exists()
        except ValueError:
            return False

    def TSEnsureIndexed(self, ts_row):
        if ts_row is None:
            return None
        ts_asset_id = int(ts_row["id"])
        with self.ts_get_asset_lock(ts_asset_id):
            ts_fresh_row = self.ts_database.TSGetAssetById(ts_asset_id)
            if ts_fresh_row is None:
                return None
            if bool(ts_fresh_row["is_indexed"]):
                return ts_fresh_row
            ts_path = Path(str(ts_fresh_row["path"]))
            if not ts_path.exists():
                self.ts_database.TSDeleteAssetIds([ts_asset_id])
                return None
            ts_kind = self.ts_detect_supported_type(ts_path)
            if ts_kind is None:
                self.ts_database.TSDeleteAssetIds([ts_asset_id])
                return None
            ts_handler = self.ts_handler_registry.TSResolveHandler(str(ts_fresh_row["extension"] or ""), ts_kind)
            if ts_handler is None:
                return ts_fresh_row
            ts_asset_stat = self.ts_build_asset_stat(ts_fresh_row)
            ts_hash = self.ts_compute_file_hash(ts_asset_stat.ts_path)
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
            self.ts_emit_asset_upsert(ts_updated_row)
            return ts_updated_row

    def TSEnsurePreview(self, ts_row):
        if ts_row is None:
            return None
        ts_row = self.TSEnsureIndexed(ts_row)
        if ts_row is None:
            return None
        ts_asset_id = int(ts_row["id"])
        with self.ts_get_asset_lock(ts_asset_id):
            ts_fresh_row = self.ts_database.TSGetAssetById(ts_asset_id)
            if ts_fresh_row is None:
                return None
            ts_preview_path = str(ts_fresh_row["preview_path"] or "")
            if bool(ts_fresh_row["has_preview"]) and ts_preview_path and self._TSPreviewFileReady(ts_preview_path):
                return ts_fresh_row
            if (
                ts_preview_path
                and self.ts_preview_cache.TSIsPlaceholderPreview(ts_preview_path)
                and self._TSPreviewFileReady(ts_preview_path)
            ):
                # A stored placeholder means generation already failed for this
                # exact file revision. Re-running ffmpeg/PIL on every detail
                # view of a corrupt file is a retry storm; retry only once the
                # source file changes (or after Rebuild Cache).
                try:
                    ts_current_mtime_ns = Path(str(ts_fresh_row["path"])).stat().st_mtime_ns
                except OSError:
                    return ts_fresh_row
                if ts_current_mtime_ns == int(ts_fresh_row["mtime_ns"] or 0):
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
            self.ts_emit_asset_upsert(ts_updated_row)
            return ts_updated_row

    def TSEnsureMetadata(self, ts_row):
        if ts_row is None:
            return None
        ts_row = self.TSEnsurePreview(ts_row)
        if ts_row is None:
            return None
        ts_asset_id = int(ts_row["id"])
        with self.ts_get_asset_lock(ts_asset_id):
            ts_fresh_row = self.ts_database.TSGetAssetById(ts_asset_id)
            if ts_fresh_row is None:
                return None
            ts_metadata = TSJsonLoads(ts_fresh_row["metadata"], {})
            # Re-extract only images whose STORED prompt metadata predates the
            # current prompt_parts_version (5 added seed/negative, 6 added the
            # model list) or is malformed. An empty metadata blob means the
            # image was already processed and simply has no prompt data —
            # treating that as stale re-opened the file, re-upserted the row and
            # re-emitted an asset-upsert event on every single detail view,
            # forever.
            ts_needs_prompt_refresh = TSNeedsPromptMetadataRefresh(
                str(ts_fresh_row["type"] or ""), ts_metadata
            )
            if bool(ts_fresh_row["has_metadata"]) and not ts_needs_prompt_refresh:
                return ts_fresh_row
            ts_handler = self.ts_handler_registry.TSResolveHandler(str(ts_fresh_row["extension"] or ""), str(ts_fresh_row["type"] or ""))
            if ts_handler is None:
                return ts_fresh_row
            ts_metadata_payload = ts_handler.TSExtractMetadata(ts_fresh_row)
            ts_metadata_json = str(ts_metadata_payload.get("metadata") or "{}")
            ts_prompt_text = str(ts_metadata_payload.get("prompt_text") or "")
            ts_workflow_text = str(ts_metadata_payload.get("workflow_text") or "")
            ts_model_text = str(ts_metadata_payload.get("model_text") or "")
            ts_has_metadata = bool(
                ts_metadata_payload.get("has_metadata")
                or (ts_metadata_json and ts_metadata_json != "{}")
                or ts_prompt_text
                or ts_workflow_text
            )
            ts_payload = self.ts_database.TSBuildUpdatedPayload(
                ts_fresh_row,
                ts_metadata=ts_metadata_json,
                ts_prompt_text=ts_prompt_text,
                ts_workflow_text=ts_workflow_text,
                ts_model_text=ts_model_text,
                ts_has_metadata=ts_has_metadata,
            )
            ts_updated_row = self.ts_database.TSUpsertAsset(ts_payload)
            self.ts_emit_asset_upsert(ts_updated_row)
            return ts_updated_row
