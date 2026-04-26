from __future__ import annotations

from .ts_metadata_extract import TSExtractPromptText, TSExtractWorkflowText
from .ts_utils import TSJsonLoads


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
