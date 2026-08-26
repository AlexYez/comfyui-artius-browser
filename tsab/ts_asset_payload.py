from __future__ import annotations

from typing import Any
from urllib.parse import quote

from .ts_utils import TSJsonLoads, TSRowValue


def TSResolveTechnicalInfo(ts_row) -> dict[str, Any]:
    ts_technical = TSJsonLoads(ts_row["technical_json"], {})
    if isinstance(ts_technical, dict) and ts_technical:
        if not ts_technical.get("duration") and ts_row["duration"] is not None:
            ts_technical["duration"] = ts_row["duration"]
        if not ts_technical.get("width") and ts_row["width"] is not None:
            ts_technical["width"] = ts_row["width"]
        if not ts_technical.get("height") and ts_row["height"] is not None:
            ts_technical["height"] = ts_row["height"]
        if not ts_technical.get("fps") and ts_row["fps"] is not None:
            ts_technical["fps"] = ts_row["fps"]
        return ts_technical

    ts_result: dict[str, Any] = {"kind": str(ts_row["type"] or "")}
    if ts_row["duration"] is not None:
        ts_result["duration"] = ts_row["duration"]
    if ts_row["width"] is not None:
        ts_result["width"] = ts_row["width"]
    if ts_row["height"] is not None:
        ts_result["height"] = ts_row["height"]
    if ts_row["fps"] is not None:
        ts_result["fps"] = ts_row["fps"]
    if str(ts_row["extension"] or ""):
        ts_result["format_name"] = str(ts_row["extension"] or "").lstrip(".").upper()
    return ts_result


def TSResolveStudioTag(ts_row) -> dict[str, Any]:
    """The studio tag stored with a render, or {} when it has none.

    [AI agent] Read from the metadata blob the row already carries, so the
    grid can label studio work without a second query or a schema change.
    Assets from anywhere else return {} and render exactly as before.
    """
    ts_metadata = TSJsonLoads(TSRowValue(ts_row, "metadata", "") or "", {})
    if not isinstance(ts_metadata, dict):
        return {}
    ts_studio = ts_metadata.get("studio")
    return ts_studio if isinstance(ts_studio, dict) else {}


def TSFormatChannelLayout(ts_channels: Any) -> str:
    ts_channel_count = int(ts_channels or 0) if str(ts_channels or "").strip() else 0
    if ts_channel_count <= 0:
        return ""
    if ts_channel_count == 1:
        return "Mono"
    if ts_channel_count == 2:
        return "Stereo"
    return f"{ts_channel_count}ch"


def TSBuildNative3DViewerURL(ts_row, ts_root: dict[str, Any]) -> str:
    ts_root_id = str(ts_row["root_id"] or "")
    if ts_root_id not in {"input", "output"}:
        return ""
    ts_filename = str(ts_row["filename"] or "")
    if not ts_filename:
        return ""
    ts_folder_path = str(ts_row["folder_path"] or "")
    return (
        f"/view?filename={quote(ts_filename)}"
        f"&type={quote(ts_root_id)}"
        f"&subfolder={quote(ts_folder_path)}"
    )


def TSBuildAssetCard(ts_row, ts_roots: dict[str, dict[str, Any]], ts_preview_cache) -> dict[str, Any]:
    ts_root = ts_roots.get(str(ts_row["root_id"]), {})
    ts_preview_path = str(ts_row["preview_path"] or "")
    ts_preview_exists = False
    ts_preview_mtime_ns = 0
    if ts_preview_path:
        try:
            ts_preview_stat = ts_preview_cache.TSResolvePreviewPath(ts_preview_path).stat()
            ts_preview_exists = True
            ts_preview_mtime_ns = int(ts_preview_stat.st_mtime_ns)
        except (OSError, ValueError):
            ts_preview_exists = False
            ts_preview_mtime_ns = 0
    ts_file_cache_token = str(ts_row["hash"] or ts_row["mtime_ns"] or ts_row["id"])
    ts_preview_cache_token = (
        str(ts_preview_mtime_ns) if ts_preview_exists else f"placeholder-{ts_row['id']}"
    )
    ts_preview_url = f"/asset_browser/preview/{ts_row['id']}?v={ts_preview_cache_token}"
    ts_file_url = f"/asset_browser/file?id={ts_row['id']}&v={ts_file_cache_token}"
    ts_technical_info = TSResolveTechnicalInfo(ts_row) if str(ts_row["type"] or "") in {"video", "audio"} else {}
    # 3D capture keys are built as "{key}.3d" (see TSBuildPreviewPath), so the
    # cache filename is "{key}.3d.<ext>". Anchor on the stem suffix instead of
    # a substring so a normal preview whose path merely contains ".3d." cannot
    # be mislabeled as a 3D capture.
    ts_preview_filename = ts_preview_path.rsplit("/", 1)[-1].lower()
    ts_preview_is_3d_capture = ts_preview_exists and ts_preview_filename.rsplit(".", 1)[0].endswith(".3d")
    return {
        "id": ts_row["id"],
        "path": ts_row["path"],
        "type": ts_row["type"],
        "filename": ts_row["filename"],
        "extension": ts_row["extension"],
        "size_bytes": ts_row["size_bytes"],
        "folder_path": ts_row["folder_path"],
        "preview_url": ts_preview_url,
        "file_url": ts_file_url,
        "viewer_3d_url": TSBuildNative3DViewerURL(ts_row, ts_root) if str(ts_row["type"] or "") == "3d" else "",
        "preview_is_placeholder": (not ts_preview_exists) or ts_preview_cache.TSIsPlaceholderPreview(ts_preview_path),
        "preview_is_3d_capture": ts_preview_is_3d_capture,
        "scope": ts_row["scope"],
        "root_id": ts_row["root_id"],
        "width": ts_row["width"],
        "height": ts_row["height"],
        "duration": ts_row["duration"],
        "fps": ts_row["fps"],
        "allow_delete": bool(ts_root.get("allow_delete")),
        "root_label": ts_root.get("label", ts_row["root_id"]),
        "is_indexed": bool(ts_row["is_indexed"]),
        "is_favorite": bool(TSRowValue(ts_row, "is_favorite", 0)),
        "has_preview": bool(ts_row["has_preview"]),
        "has_metadata": bool(ts_row["has_metadata"]),
        "has_workflow": bool(str(ts_row["workflow_text"] or "")),
        # Videos carry an embedded prompt as often as they carry a
        # workflow, and as often as they carry neither - so the copy
        # action on a video card is offered only when there is something
        # to copy, rather than always, the way it is for an image.
        "has_prompt": bool(str(ts_row["prompt_text"] or "")),
        # [AI agent] Empty for every asset not made in TS Image Studio.
        "studio": TSResolveStudioTag(ts_row),
        "codec_name": str(ts_technical_info.get("codec_name") or ""),
        "audio_codec_name": str(ts_technical_info.get("audio_codec_name") or ""),
        "channel_layout": TSFormatChannelLayout(ts_technical_info.get("channels")),
        "audio_channel_layout": TSFormatChannelLayout(ts_technical_info.get("audio_channels")),
        "status": str(ts_row["status"] or "discovered"),
        "detail_loaded": False,
    }
