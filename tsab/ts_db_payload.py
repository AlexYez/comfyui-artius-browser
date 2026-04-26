from __future__ import annotations

from dataclasses import replace
from typing import Any

from .ts_types import TSAssetPayload


def TSComputeAssetStatus(ts_is_indexed: bool, ts_has_preview: bool, ts_has_metadata: bool) -> str:
    if ts_is_indexed and ts_has_preview and ts_has_metadata:
        return "metadata_ready"
    if ts_is_indexed and ts_has_preview:
        return "previewed"
    if ts_is_indexed:
        return "indexed"
    return "discovered"


def TSPayloadFromAssetRow(ts_row: Any) -> TSAssetPayload:
    return TSAssetPayload(
        ts_path=str(ts_row["path"]),
        ts_type=str(ts_row["type"]),
        ts_preview_path=str(ts_row["preview_path"] or ""),
        ts_metadata=str(ts_row["metadata"] or "{}"),
        ts_technical_json=str(ts_row["technical_json"] or "{}"),
        ts_mtime_ns=int(ts_row["mtime_ns"] or 0),
        ts_hash=str(ts_row["hash"] or ""),
        ts_folder_path=str(ts_row["folder_path"] or ""),
        ts_duration=ts_row["duration"],
        ts_width=ts_row["width"],
        ts_height=ts_row["height"],
        ts_fps=ts_row["fps"],
        ts_size_bytes=int(ts_row["size_bytes"] or 0),
        ts_filename=str(ts_row["filename"] or ""),
        ts_extension=str(ts_row["extension"] or ""),
        ts_scope=str(ts_row["scope"] or "output"),
        ts_root_id=str(ts_row["root_id"] or "output"),
        ts_prompt_text=str(ts_row["prompt_text"] or ""),
        ts_workflow_text=str(ts_row["workflow_text"] or ""),
        ts_created_at=int(ts_row["created_at"] or 0),
        ts_is_indexed=bool(ts_row["is_indexed"]),
        ts_has_preview=bool(ts_row["has_preview"]),
        ts_has_metadata=bool(ts_row["has_metadata"]),
        ts_tags=str(ts_row["tags"] or ""),
        ts_rating=int(ts_row["rating"] or 0),
    )


def TSBuildUpdatedAssetPayload(ts_row: Any, **ts_overrides: Any) -> TSAssetPayload:
    return replace(TSPayloadFromAssetRow(ts_row), **ts_overrides)
