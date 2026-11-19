from __future__ import annotations

from .ts_metadata_extract import TSExtractPromptText, TSExtractWorkflowText
from .ts_settings import TS_IMAGE_METADATA_VERSION, TS_PROMPT_PARTS_VERSION
from .ts_utils import TSJsonLoads, TSRowValue


def TSNeedsPromptMetadataRefresh(ts_asset_type: str, ts_metadata, *, ts_on_access: bool = True) -> bool:
    """Refresh old image adapters on access and stamp even empty results."""
    ts_blob = ts_metadata if isinstance(ts_metadata, dict) else {}
    if ts_asset_type == "image":
        if ts_on_access:
            return ts_blob.get("image_metadata_version") != TS_IMAGE_METADATA_VERSION
        # Keep the old scan behavior for rows with stale prompt parts, but
        # don't queue a rehash of every unchanged image for a parser revision.
        if "image_metadata_version" in ts_blob:
            return False
        if isinstance(ts_metadata, dict) and not ts_blob:
            return False
    elif ts_asset_type != "video":
        return False
    try:
        return int(ts_blob.get("prompt_parts_version") or 0) < TS_PROMPT_PARTS_VERSION
    except (TypeError, ValueError, OverflowError):
        return True


def TSResolveAssetPromptText(ts_row) -> str:
    ts_metadata = TSJsonLoads(ts_row["metadata"], {})
    if isinstance(ts_metadata, dict):
        ts_positive_prompt_text = str(ts_metadata.get("positive_prompt_text") or "")
        if ts_positive_prompt_text:
            return ts_positive_prompt_text
    ts_prompt_text = str(ts_row["prompt_text"] or "")
    if ts_prompt_text:
        return ts_prompt_text
    if ts_metadata:
        return TSExtractPromptText(ts_metadata)
    return ""


def TSResolveAssetNegativePromptText(ts_row) -> str:
    ts_metadata = TSJsonLoads(ts_row["metadata"], {})
    if not isinstance(ts_metadata, dict):
        return ""
    return str(ts_metadata.get("negative_prompt_text") or "")


def TSResolveAssetWorkflowText(ts_row) -> str:
    ts_workflow_text = str(ts_row["workflow_text"] or "")
    if ts_workflow_text:
        return ts_workflow_text
    ts_metadata = TSJsonLoads(ts_row["metadata"], {})
    if ts_metadata:
        return TSExtractWorkflowText(ts_metadata)
    return ""


def TSResolveAssetModels(ts_row) -> list[str]:
    # Structured list from the metadata blob (written by the image handler);
    # the newline-joined model_text column is the FTS mirror, used as the
    # fallback for rows written before the blob carried the list.
    ts_metadata = TSJsonLoads(ts_row["metadata"], {})
    if isinstance(ts_metadata, dict):
        ts_models = ts_metadata.get("models")
        if isinstance(ts_models, list):
            return [str(ts_model) for ts_model in ts_models if str(ts_model).strip()]
    return [ts_line for ts_line in str(TSRowValue(ts_row, "model_text") or "").split("\n") if ts_line.strip()]


def TSResolveAssetSeedText(ts_row) -> str:
    ts_metadata = TSJsonLoads(ts_row["metadata"], {})
    if not isinstance(ts_metadata, dict):
        return ""
    return str(ts_metadata.get("seed") or "")
