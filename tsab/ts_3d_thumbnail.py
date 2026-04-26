from __future__ import annotations

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
) -> dict[str, Any]:
    ts_row = ts_database.TSGetAssetById(ts_asset_id)
    if ts_row is None:
        raise TSWeb.HTTPNotFound()
    if str(ts_row["type"] or "") != "3d":
        raise TSWeb.HTTPBadRequest(reason="Asset is not a 3D model")
    ts_preview_key = ts_preview_cache.TSBuildAssetPreviewKey(str(ts_row["hash"] or ""), Path(str(ts_row["path"])))
    ts_preview_path = ts_preview_cache.TSPersist3DCapturePreview(ts_preview_key, ts_image_data_url)
    if not ts_preview_path:
        raise TSWeb.HTTPBadRequest(reason="Invalid 3D thumbnail payload")
    ts_payload = ts_database.TSBuildUpdatedPayload(
        ts_row,
        ts_preview_path=ts_preview_path,
        ts_has_preview=True,
    )
    ts_updated_row = ts_database.TSUpsertAsset(ts_payload)
    ts_emit_asset_upsert(ts_updated_row)
    ts_roots = {ts_root["root_id"]: ts_root for ts_root in ts_get_roots()}
    return TSBuildAssetCard(ts_updated_row, ts_roots, ts_preview_cache)
