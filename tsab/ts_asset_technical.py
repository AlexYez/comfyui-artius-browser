from __future__ import annotations

from pathlib import Path
from typing import Any

from .media.probe import TSMergeMissingAudioTechnicalInfo, TSMergeMissingVideoTechnicalInfo
from .ts_asset_payload import TSResolveTechnicalInfo
from .ts_utils import TSJsonDumps


def _TSEnrichTechnicalInfo(ts_row, ts_database, ts_tools, ts_technical, *, ts_kind, ts_required_field, ts_merge):
    ts_technical_info = dict(ts_technical or TSResolveTechnicalInfo(ts_row))
    if str(ts_row["type"] or "") != ts_kind:
        return ts_row, ts_technical_info
    if ts_technical_info.get("codec_name") and ts_technical_info.get(ts_required_field):
        return ts_row, ts_technical_info
    if ts_technical_info.get("probe_attempted"):
        return ts_row, ts_technical_info
    if not ts_row["path"]:
        return ts_row, ts_technical_info
    ts_source_path = Path(str(ts_row["path"]))
    if not ts_source_path.exists():
        return ts_row, ts_technical_info
    ts_probe = ts_tools.TSRunFFProbe(ts_source_path)
    ts_technical_info, ts_changed = ts_merge(
        ts_technical_info,
        ts_probe,
        str(ts_row["extension"] or ""),
    )
    if not ts_changed:
        ts_technical_info["probe_attempted"] = True
    ts_updated_row = ts_database.TSUpdateAssetTechnicalInfo(
        ts_row,
        TSJsonDumps(ts_technical_info),
        ts_technical_info.get("fps") if ts_kind == "video" and ts_changed else None,
    )
    return ts_updated_row, TSResolveTechnicalInfo(ts_updated_row) if ts_updated_row is not None else {}


def TSEnrichVideoTechnicalInfo(ts_row, ts_database, ts_tools, ts_technical: dict[str, Any] | None = None):
    return _TSEnrichTechnicalInfo(
        ts_row, ts_database, ts_tools, ts_technical,
        ts_kind="video", ts_required_field="fps", ts_merge=TSMergeMissingVideoTechnicalInfo,
    )


def TSEnrichAudioTechnicalInfo(ts_row, ts_database, ts_tools, ts_technical: dict[str, Any] | None = None):
    return _TSEnrichTechnicalInfo(
        ts_row, ts_database, ts_tools, ts_technical,
        ts_kind="audio", ts_required_field="channels", ts_merge=TSMergeMissingAudioTechnicalInfo,
    )
