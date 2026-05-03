from __future__ import annotations

from dataclasses import replace
from typing import Any

from .ts_types import TSAssetPayload


def TSCarryExistingRowValues(
    ts_payload: TSAssetPayload,
    ts_existing_row: Any | None,
    *,
    ts_reset_processing: bool,
) -> TSAssetPayload:
    if ts_existing_row is None:
        return ts_payload
    ts_created_at = int(ts_existing_row["created_at"] or 0) or ts_payload.ts_created_at
    ts_updates: dict[str, Any] = {
        "ts_created_at": ts_created_at,
    }
    if ts_reset_processing:
        ts_updates.update(
            {
                "ts_hash": "",
                "ts_metadata": "{}",
                "ts_technical_json": "{}",
                "ts_prompt_text": "",
                "ts_workflow_text": "",
                "ts_is_indexed": False,
                "ts_has_preview": False,
                "ts_has_metadata": False,
            }
        )
    return replace(ts_payload, **ts_updates)
