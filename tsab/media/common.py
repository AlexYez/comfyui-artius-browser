from __future__ import annotations

from ..ts_types import TSAssetPayload, TSAssetStat
from ..ts_utils import TSNormalizePathString, TSUnixSecondsFromNanoseconds


def TSBuildAssetPayloadBase(
    ts_asset_stat: TSAssetStat,
    ts_kind: str,
    ts_placeholder_preview: str,
    *,
    ts_is_indexed: bool,
    ts_asset_hash: str = "",
    ts_technical_json: str = "{}",
    ts_duration: float | None = None,
    ts_width: int | None = None,
    ts_height: int | None = None,
    ts_fps: float | None = None,
    ts_has_preview: bool = False,
    ts_has_metadata: bool = False,
) -> TSAssetPayload:
    return TSAssetPayload(
        ts_path=TSNormalizePathString(ts_asset_stat.ts_path),
        ts_type=ts_kind,
        ts_preview_path=ts_placeholder_preview,
        ts_technical_json=ts_technical_json,
        ts_mtime_ns=ts_asset_stat.ts_mtime_ns,
        ts_hash=ts_asset_hash,
        ts_folder_path=ts_asset_stat.ts_folder_path,
        ts_duration=ts_duration,
        ts_width=ts_width,
        ts_height=ts_height,
        ts_fps=ts_fps,
        ts_size_bytes=ts_asset_stat.ts_size_bytes,
        ts_filename=ts_asset_stat.ts_filename,
        ts_extension=ts_asset_stat.ts_extension,
        ts_scope=ts_asset_stat.ts_root.ts_scope,
        ts_root_id=ts_asset_stat.ts_root.ts_root_id,
        ts_created_at=TSUnixSecondsFromNanoseconds(ts_asset_stat.ts_ctime_ns),
        ts_is_indexed=ts_is_indexed,
        ts_has_preview=ts_has_preview,
        ts_has_metadata=ts_has_metadata,
    )


def TSBuildDiscoveredPayload(
    ts_asset_stat: TSAssetStat,
    ts_kind: str,
    ts_placeholder_preview: str,
) -> TSAssetPayload:
    return TSBuildAssetPayloadBase(
        ts_asset_stat,
        ts_kind,
        ts_placeholder_preview,
        ts_is_indexed=False,
        ts_has_preview=False,
        ts_has_metadata=False,
    )


def TSBuildIndexedPayload(
    ts_asset_stat: TSAssetStat,
    ts_kind: str,
    ts_placeholder_preview: str,
    ts_asset_hash: str,
    **ts_overrides,
) -> TSAssetPayload:
    return TSBuildAssetPayloadBase(
        ts_asset_stat,
        ts_kind,
        ts_placeholder_preview,
        ts_is_indexed=True,
        ts_asset_hash=ts_asset_hash,
        **ts_overrides,
    )