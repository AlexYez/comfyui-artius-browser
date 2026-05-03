from __future__ import annotations

from .ts_settings import TS_COMPANION_SUFFIXES


def TSNormalizeCompanionStem(ts_stem: str) -> str:
    ts_normalized = str(ts_stem or "").lower()
    ts_changed = True
    while ts_changed and ts_normalized:
        ts_changed = False
        for ts_suffix in TS_COMPANION_SUFFIXES:
            if ts_normalized.endswith(ts_suffix):
                ts_normalized = ts_normalized[: -len(ts_suffix)].rstrip("._- ")
                ts_changed = True
                break
    return ts_normalized


def TSComputeCompanionStemFromFilename(ts_filename: str, ts_extension: str) -> str:
    ts_filename = str(ts_filename or "")
    ts_extension = str(ts_extension or "")
    if ts_extension and ts_filename.lower().endswith(ts_extension.lower()):
        ts_stem_raw = ts_filename[: -len(ts_extension)]
    else:
        ts_dot = ts_filename.rfind(".")
        ts_stem_raw = ts_filename[:ts_dot] if ts_dot > 0 else ts_filename
    return TSNormalizeCompanionStem(ts_stem_raw)
