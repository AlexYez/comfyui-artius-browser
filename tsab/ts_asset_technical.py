from __future__ import annotations

from pathlib import Path
from typing import Any

from .media.probe import TSMergeMissingAudioTechnicalInfo, TSMergeMissingVideoTechnicalInfo
from .ts_asset_payload import TSResolveTechnicalInfo
from .ts_utils import TSJsonDumps


def TSEnrichVideoTechnicalInfo(ts_row, ts_database, ts_tools, ts_technical: dict[str, Any] | None = None):
    if str(ts_row["type"] or "") != "video":
        return ts_row, (ts_technical or TSResolveTechnicalInfo(ts_row))
    ts_technical_info = dict(ts_technical or TSResolveTechnicalInfo(ts_row))
    if ts_technical_info.get("codec_name") and ts_technical_info.get("fps"):
        return ts_row, ts_technical_info
    ts_source_path = Path(str(ts_row["path"] or ""))
    if not ts_source_path.exists():
        return ts_row, ts_technical_info
    ts_probe = ts_tools.TSRunFFProbe(ts_source_path)
    ts_technical_info, ts_changed = TSMergeMissingVideoTechnicalInfo(
        ts_technical_info,
        ts_probe,
        str(ts_row["extension"] or ""),
    )
    if not ts_changed:
        return ts_row, ts_technical_info
    ts_updated_row = ts_database.TSUpsertAsset(ts_database.TSBuildUpdatedPayload(
        ts_row,
        ts_technical_json=TSJsonDumps(ts_technical_info),
        ts_fps=ts_technical_info.get("fps"),
    ))
    return ts_updated_row, ts_technical_info


def TSEnrichAudioTechnicalInfo(ts_row, ts_database, ts_tools, ts_technical: dict[str, Any] | None = None):
    if str(ts_row["type"] or "") != "audio":
        return ts_row, (ts_technical or TSResolveTechnicalInfo(ts_row))
    ts_technical_info = dict(ts_technical or TSResolveTechnicalInfo(ts_row))
    if ts_technical_info.get("codec_name") and ts_technical_info.get("channels"):
        return ts_row, ts_technical_info
    ts_source_path = Path(str(ts_row["path"] or ""))
    if not ts_source_path.exists():
        return ts_row, ts_technical_info
    ts_probe = ts_tools.TSRunFFProbe(ts_source_path)
    ts_technical_info, ts_changed = TSMergeMissingAudioTechnicalInfo(
        ts_technical_info,
        ts_probe,
        str(ts_row["extension"] or ""),
    )
    if not ts_changed:
        return ts_row, ts_technical_info
    ts_updated_row = ts_database.TSUpsertAsset(ts_database.TSBuildUpdatedPayload(
        ts_row,
        ts_technical_json=TSJsonDumps(ts_technical_info),
    ))
    return ts_updated_row, ts_technical_info
