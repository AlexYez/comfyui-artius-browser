from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from send2trash import send2trash as TSSendToTrash

from .ts_logging import TSLogVerbose
from .ts_settings import TS_EVENT_ASSET_REMOVE


class TSDeleteService:
    def __init__(
        self,
        ts_database,
        ts_preview_cache,
        ts_get_roots: Callable[[], list[dict[str, Any]]],
        ts_emit_event: Callable[[str, dict[str, Any]], None],
        ts_send_to_trash: Callable[[str], None] = TSSendToTrash,
    ) -> None:
        self.ts_database = ts_database
        self.ts_preview_cache = ts_preview_cache
        self.ts_get_roots = ts_get_roots
        self.ts_emit_event = ts_emit_event
        self.ts_send_to_trash = ts_send_to_trash

    def TSDeleteAssets(self, ts_asset_ids: list[int]) -> dict[str, Any]:
        TSLogVerbose("runtime.assets.delete.request", asset_ids=ts_asset_ids)
        ts_deleted_ids: list[int] = []
        ts_skipped_ids: list[int] = []
        ts_deleted_refs: list[tuple[int, str, str]] = []
        ts_roots = {ts_root["root_id"]: ts_root for ts_root in self.ts_get_roots()}
        for ts_asset_id in ts_asset_ids:
            ts_row = self.ts_database.TSGetAssetById(ts_asset_id)
            if ts_row is None:
                ts_skipped_ids.append(ts_asset_id)
                TSLogVerbose("runtime.asset.delete.skipped", asset_id=ts_asset_id, reason="missing_row")
                continue

            ts_root = ts_roots.get(str(ts_row["root_id"]))
            if not ts_root or not ts_root.get("allow_delete"):
                ts_skipped_ids.append(ts_asset_id)
                TSLogVerbose("runtime.asset.delete.skipped", asset_id=ts_asset_id, reason="delete_not_allowed")
                continue

            ts_file_path = Path(str(ts_row["path"]))
            ts_root_path = Path(str(ts_root["path"])).resolve()
            try:
                try:
                    ts_file_path.resolve().relative_to(ts_root_path)
                except ValueError:
                    ts_skipped_ids.append(ts_asset_id)
                    TSLogVerbose("runtime.asset.delete.skipped", asset_id=ts_asset_id, reason="outside_root")
                    continue
                if ts_file_path.exists():
                    self.ts_send_to_trash(str(ts_file_path))
            except (OSError, PermissionError) as ts_error:
                ts_skipped_ids.append(ts_asset_id)
                TSLogVerbose("runtime.asset.delete.skipped", asset_id=ts_asset_id, reason=str(ts_error))
                continue

            ts_deleted_refs.append((ts_asset_id, str(ts_row["path"]), str(ts_row["preview_path"] or "")))
            ts_deleted_ids.append(ts_asset_id)

        if ts_deleted_ids:
            # One batched DB delete: a single companion-flag recompute per
            # touched folder instead of one per asset.
            self.ts_database.TSDeleteAssetIds(ts_deleted_ids)
            # Purge previews after the rows are gone so a preview shared only
            # within this batch is correctly detected as unreferenced.
            ts_checked_previews: set[str] = set()
            for ts_asset_id, _ts_path, ts_preview_path in ts_deleted_refs:
                if not ts_preview_path or ts_preview_path in ts_checked_previews:
                    continue
                ts_checked_previews.add(ts_preview_path)
                if self.ts_database.TSCountPreviewReferences(ts_preview_path, ts_asset_id) == 0:
                    self.ts_preview_cache.TSPurgePreview(ts_preview_path)
            for ts_asset_id, ts_path, _ts_preview_path in ts_deleted_refs:
                TSLogVerbose("runtime.asset.deleted", asset_id=ts_asset_id, path=ts_path)
                self.ts_emit_event(TS_EVENT_ASSET_REMOVE, {"id": ts_asset_id, "path": ts_path})
        return {"deleted": ts_deleted_ids, "skipped": ts_skipped_ids}
