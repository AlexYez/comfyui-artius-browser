from __future__ import annotations

from dataclasses import replace
from typing import Any, Callable

from .ts_hashing import TSComputeFileHash, TSDetectSupportedType
from .ts_indexer_payload import TSCarryExistingRowValues
from .ts_logging import TSLogVerbose
from .ts_types import TSAssetPayload, TSAssetStat


def TSProcessCandidateTuple(
    ts_candidate_tuple: tuple[TSAssetStat, Any | None],
    ts_handler_registry,
    ts_preview_cache,
    *,
    ts_detect_supported_type: Callable[[Any], str | None] = TSDetectSupportedType,
    ts_compute_file_hash: Callable[[Any], str] = TSComputeFileHash,
) -> tuple[TSAssetPayload | None, Any | None]:
    ts_asset_stat, ts_existing_row = ts_candidate_tuple
    ts_kind = ts_detect_supported_type(ts_asset_stat.ts_path)
    if ts_kind is None:
        return None, ts_existing_row
    ts_handler = ts_handler_registry.TSResolveHandler(ts_asset_stat.ts_extension, ts_kind)
    if ts_handler is None:
        return None, ts_existing_row
    try:
        ts_hash = ts_compute_file_hash(ts_asset_stat.ts_path)
        ts_payload = ts_handler.TSBuildIndexedPayload(ts_asset_stat, ts_hash)
        ts_processing_row = {
            "path": ts_payload.ts_path,
            "hash": ts_payload.ts_hash,
            "type": ts_payload.ts_type,
            "extension": ts_payload.ts_extension,
            "filename": ts_payload.ts_filename,
        }
        ts_preview_path = ts_handler.TSGeneratePreview(ts_processing_row)
        ts_has_preview = bool(ts_preview_path) and not ts_preview_cache.TSIsPlaceholderPreview(ts_preview_path)
        ts_metadata_payload = ts_handler.TSExtractMetadata(ts_processing_row)
        ts_metadata_json = str(ts_metadata_payload.get("metadata") or "{}")
        ts_prompt_text = str(ts_metadata_payload.get("prompt_text") or "")
        ts_workflow_text = str(ts_metadata_payload.get("workflow_text") or "")
        ts_model_text = str(ts_metadata_payload.get("model_text") or "")
        ts_has_metadata = bool(
            ts_metadata_payload.get("has_metadata")
            or (ts_metadata_json and ts_metadata_json != "{}")
            or ts_prompt_text
            or ts_workflow_text
            or ts_payload.ts_has_metadata
        )
        ts_payload = replace(
            ts_payload,
            ts_preview_path=ts_preview_path or ts_payload.ts_preview_path,
            ts_metadata=ts_metadata_json,
            ts_prompt_text=ts_prompt_text,
            ts_workflow_text=ts_workflow_text,
            ts_model_text=ts_model_text,
            ts_has_preview=ts_has_preview,
            ts_has_metadata=ts_has_metadata,
        )
        ts_payload = TSCarryExistingRowValues(ts_payload, ts_existing_row, ts_reset_processing=False)
        return ts_payload, ts_existing_row
    except Exception as ts_error:
        TSLogVerbose(
            "indexer.candidate.failed",
            path=str(ts_asset_stat.ts_path),
            extension=ts_asset_stat.ts_extension,
            error=repr(ts_error),
        )
        return None, ts_existing_row
