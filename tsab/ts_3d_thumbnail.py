from __future__ import annotations

from contextlib import nullcontext
from pathlib import Path
from typing import Any, Callable

from aiohttp import web as TSWeb

from .ts_asset_payload import TSBuildAssetCard


def TSSave3DThumbnail(
    ts_asset_id: int,
    ts_image_data_url: str,
    ts_database,
    ts_preview_cache,
    ts_get_roots: Callable[[], list[dict[str, Any]]],
    ts_emit_asset_upsert: Callable[[object], None],
    ts_get_asset_lock: Callable[[int], Any] | None = None,
) -> dict[str, Any]:
    ts_row = ts_database.TSGetAssetById(ts_asset_id)
    if ts_row is None:
        raise TSWeb.HTTPNotFound()
    if str(ts_row["type"] or "") != "3d":
        raise TSWeb.HTTPBadRequest(reason="Asset is not a 3D model")
    ts_lock = ts_get_asset_lock(ts_asset_id) if ts_get_asset_lock is not None else nullcontext()
    # Same per-asset lock the rest of the write paths use, and the row is read
    # AGAIN inside it: decoding the capture and writing the preview file takes
    # long enough for a delete to land in between, and the upsert below would
    # otherwise recreate the row for an asset already in the trash.
    with ts_lock:
        ts_fresh_row = ts_database.TSGetAssetById(ts_asset_id)
        if ts_fresh_row is None:
            raise TSWeb.HTTPNotFound()
        ts_preview_key = ts_preview_cache.TSBuildAssetPreviewKey(
            str(ts_fresh_row["hash"] or ""), Path(str(ts_fresh_row["path"]))
        )
        ts_preview_path = ts_preview_cache.TSPersist3DCapturePreview(ts_preview_key, ts_image_data_url)
        if not ts_preview_path:
            raise TSWeb.HTTPBadRequest(reason="Invalid 3D thumbnail payload")
        ts_payload = ts_database.TSBuildUpdatedPayload(
            ts_fresh_row,
            ts_preview_path=ts_preview_path,
            ts_has_preview=True,
        )
        ts_updated_row = ts_database.TSUpsertAsset(ts_payload)
    ts_emit_asset_upsert(ts_updated_row)
    ts_roots = {ts_root["root_id"]: ts_root for ts_root in ts_get_roots()}
    return TSBuildAssetCard(ts_updated_row, ts_roots, ts_preview_cache)
