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
    TS_LEGACY_STORAGE_DIRECTORY_NAMES,
    TS_STORAGE_DIRECTORY_NAME,
    TS_SUPPORTED_EXTENSIONS,
    TS_VIDEO_EXTENSIONS,
)
from .ts_types import TSAssetStat, TSRootDefinition
from .ts_utils import TSFolderPosixPath, TSRelativePosixPath

TS_COMPANION_MEDIA_EXTENSIONS = TS_VIDEO_EXTENSIONS | TS_AUDIO_EXTENSIONS | TS_3D_EXTENSIONS
TS_IGNORED_DIRECTORY_NAMES = {TS_STORAGE_DIRECTORY_NAME.lower(), *(ts_name.lower() for ts_name in TS_LEGACY_STORAGE_DIRECTORY_NAMES)}


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


def TSScanDirectory(ts_directory: Path, ts_ignored_paths: set[Path]) -> tuple[list[Path], list[os.DirEntry[str]]]:
    ts_subdirectories: list[Path] = []
    ts_file_entries: list[os.DirEntry[str]] = []
    try:
        with os.scandir(ts_directory) as ts_entries:
            for ts_entry in ts_entries:
                ts_entry_path = Path(ts_entry.path)
                if ts_entry.is_dir(follow_symlinks=False):
                    try:
                        ts_resolved_path = ts_entry_path.resolve()
                    except OSError:
                        continue
                    if ts_entry_path.name.lower() in TS_IGNORED_DIRECTORY_NAMES:
                        TSLogVerbose("indexer.path.ignored", path=str(ts_entry_path), reason="technical_directory")
                        continue
                    if ts_resolved_path in ts_ignored_paths:
                        TSLogVerbose("indexer.path.ignored", path=str(ts_entry_path))
                        continue
                    ts_subdirectories.append(ts_resolved_path)
                    continue
                if ts_entry_path.suffix.lower() in TS_SUPPORTED_EXTENSIONS:
                    ts_file_entries.append(ts_entry)
    except OSError as ts_error:
        TSLogVerbose("indexer.directory.scan_failed", directory=str(ts_directory), error=str(ts_error))
        return [], []
    return ts_subdirectories, TSFilterCompanionEntries(ts_file_entries)


def TSIterAssetStats(ts_root: TSRootDefinition, ts_ignored_paths: set[Path]) -> Iterable[TSAssetStat]:
    ts_directory_stack = [ts_root.ts_path]
    while ts_directory_stack:
        ts_directory = ts_directory_stack.pop()
        ts_subdirectories, ts_file_entries = TSScanDirectory(ts_directory, ts_ignored_paths)
        ts_directory_stack.extend(ts_subdirectories)
        for ts_entry in ts_file_entries:
            try:
                ts_entry_path = Path(ts_entry.path).resolve()
                ts_stat = ts_entry.stat(follow_symlinks=False)
                ts_relative_path = TSRelativePosixPath(ts_entry_path, ts_root.ts_path.resolve())
                yield TSAssetStat(
                    ts_path=ts_entry_path,
                    ts_root=ts_root,
                    ts_relative_path=ts_relative_path,
                    ts_folder_path=TSFolderPosixPath(ts_relative_path),
                    ts_filename=ts_entry_path.name,
                    ts_extension=ts_entry_path.suffix.lower(),
                    ts_size_bytes=int(ts_stat.st_size),
                    ts_mtime_ns=int(getattr(ts_stat, "st_mtime_ns", int(ts_stat.st_mtime * 1000000000))),
                    ts_ctime_ns=int(getattr(ts_stat, "st_ctime_ns", int(ts_stat.st_ctime * 1000000000))),
                )
            except OSError as ts_error:
                TSLogVerbose("indexer.file.stat_failed", path=str(getattr(ts_entry, 'path', '')), error=str(ts_error))
