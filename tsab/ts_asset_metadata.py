from __future__ import annotations

from .ts_metadata_extract import TSExtractPromptText, TSExtractWorkflowText
from .ts_settings import TS_PROMPT_PARTS_VERSION
from .ts_utils import TSJsonLoads, TSRowValue


def TSNeedsPromptMetadataRefresh(ts_asset_type: str, ts_metadata) -> bool:
    """True when a row's stored prompt/workflow blob predates the current rules.

    Images and videos answer differently, on purpose. An image with an EMPTY
    blob has already been read and simply has no prompt in it, so calling that
    stale would re-open the file on every single detail view, forever. A video
    always gets a version stamp written back - including one with no tags at
    all - so for a video a missing stamp genuinely means "never extracted under
    the current rules", which is the state of every video row indexed before
    embedded workflows were read at all.
    """
    ts_stored_version = (
        int(ts_metadata.get("prompt_parts_version") or 0) if isinstance(ts_metadata, dict) else 0
    )
    if ts_asset_type == "image":
        return (
            not isinstance(ts_metadata, dict)
            or (bool(ts_metadata) and ts_stored_version < TS_PROMPT_PARTS_VERSION)
        )
    if ts_asset_type == "video":
        return ts_stored_version < TS_PROMPT_PARTS_VERSION
    return False


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
