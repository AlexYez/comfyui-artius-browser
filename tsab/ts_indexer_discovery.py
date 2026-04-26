from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from .ts_logging import TSLogVerbose
from .ts_settings import (
    TS_3D_EXTENSIONS,
    TS_AUDIO_EXTENSIONS,
    TS_COMPANION_SUFFIXES,
    TS_IMAGE_EXTENSIONS,
    TS_SUPPORTED_EXTENSIONS,
    TS_VIDEO_EXTENSIONS,
)

TS_COMPANION_MEDIA_EXTENSIONS = TS_VIDEO_EXTENSIONS | TS_AUDIO_EXTENSIONS | TS_3D_EXTENSIONS


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


def TSFilterCompanionEntries(ts_file_entries: Iterable[os.DirEntry[str]]) -> list[os.DirEntry[str]]:
    ts_entries_with_paths = [(ts_entry, Path(ts_entry.path)) for ts_entry in ts_file_entries]
    ts_media_stems = {
        ts_entry_path.stem.lower()
        for _ts_entry, ts_entry_path in ts_entries_with_paths
        if ts_entry_path.suffix.lower() in TS_COMPANION_MEDIA_EXTENSIONS
    }
    ts_result: list[os.DirEntry[str]] = []
    for ts_entry, ts_entry_path in ts_entries_with_paths:
        ts_extension = ts_entry_path.suffix.lower()
        if ts_extension not in TS_SUPPORTED_EXTENSIONS:
            continue
        if ts_extension in TS_IMAGE_EXTENSIONS:
            ts_stem = ts_entry_path.stem.lower()
            ts_base_stem = TSNormalizeCompanionStem(ts_stem)
            if ts_stem in ts_media_stems or (ts_base_stem and ts_base_stem in ts_media_stems):
                TSLogVerbose("indexer.companion.skipped", path=str(ts_entry_path), related_stem=ts_base_stem or ts_stem)
                continue
        ts_result.append(ts_entry)
    return ts_result
