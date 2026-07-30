from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from .ts_companion import TSNormalizeCompanionStem
from .ts_logging import TSLogVerbose
from .ts_settings import (
    TS_3D_EXTENSIONS,
    TS_AUDIO_EXTENSIONS,
    TS_IMAGE_EXTENSIONS,
    TS_LEGACY_STORAGE_DIRECTORY_NAMES,
    TS_STORAGE_DIRECTORY_NAME,
    TS_SUPPORTED_EXTENSIONS,
    TS_VIDEO_EXTENSIONS,
)
from .ts_types import TSAssetStat, TSRootDefinition
from .ts_utils import TSFolderPosixPath, TSRelativePosixPath

__all__ = [
    "TSFilterCompanionEntries",
    "TSIterAssetStats",
    "TSNormalizeCompanionStem",
    "TSScanDirectory",
]

TS_COMPANION_MEDIA_EXTENSIONS = TS_VIDEO_EXTENSIONS | TS_AUDIO_EXTENSIONS | TS_3D_EXTENSIONS
TS_IGNORED_DIRECTORY_NAMES = {TS_STORAGE_DIRECTORY_NAME.lower(), *(ts_name.lower() for ts_name in TS_LEGACY_STORAGE_DIRECTORY_NAMES)}


def TSFilterCompanionEntries(ts_file_entries: Iterable[os.DirEntry[str]]) -> list[os.DirEntry[str]]:
    # Match the DB's companion definition exactly (_TSRecomputeCompanionFlags
    # compares NORMALIZED stems on both sides): comparing raw media stems here
    # while the DB compares normalized ones let an image be indexed yet flagged
    # invisible (e.g. "final.png" next to "final_preview.mp4"). Normalizing
    # both sides is strictly broader than the old raw-or-normalized check.
    ts_entries_with_paths = [(ts_entry, Path(ts_entry.path)) for ts_entry in ts_file_entries]
    ts_media_stems = {
        ts_normalized_stem
        for _ts_entry, ts_entry_path in ts_entries_with_paths
        if ts_entry_path.suffix.lower() in TS_COMPANION_MEDIA_EXTENSIONS
        and (ts_normalized_stem := TSNormalizeCompanionStem(ts_entry_path.stem.lower()))
    }
    ts_result: list[os.DirEntry[str]] = []
    for ts_entry, ts_entry_path in ts_entries_with_paths:
        ts_extension = ts_entry_path.suffix.lower()
        if ts_extension not in TS_SUPPORTED_EXTENSIONS:
            continue
        if ts_extension in TS_IMAGE_EXTENSIONS:
            ts_base_stem = TSNormalizeCompanionStem(ts_entry_path.stem.lower())
            if ts_base_stem and ts_base_stem in ts_media_stems:
                TSLogVerbose("indexer.companion.skipped", path=str(ts_entry_path), related_stem=ts_base_stem)
                continue
        ts_result.append(ts_entry)
    return ts_result


def TSScanDirectory(
    ts_directory: Path,
    ts_ignored_paths: set[Path],
    ts_failed_directories: list[str] | None = None,
) -> tuple[list[Path], list[os.DirEntry[str]]]:
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
        # The whole subtree drops out of the walk here. Record it so the caller
        # can tell a partial walk from a complete one - the stale-row prune must
        # not read "directory unreadable" as "every asset under it was deleted".
        TSLogVerbose("indexer.directory.scan_failed", directory=str(ts_directory), error=str(ts_error))
        if ts_failed_directories is not None:
            ts_failed_directories.append(str(ts_directory))
        return [], []
    return ts_subdirectories, TSFilterCompanionEntries(ts_file_entries)


def TSIterAssetStats(
    ts_root: TSRootDefinition,
    ts_ignored_paths: set[Path],
    ts_failed_directories: list[str] | None = None,
) -> Iterable[TSAssetStat]:
    ts_directory_stack = [ts_root.ts_path]
    ts_resolved_root = ts_root.ts_path.resolve()
    while ts_directory_stack:
        ts_directory = ts_directory_stack.pop()
        ts_subdirectories, ts_file_entries = TSScanDirectory(ts_directory, ts_ignored_paths, ts_failed_directories)
        ts_directory_stack.extend(ts_subdirectories)
        for ts_entry in ts_file_entries:
            try:
                ts_entry_path = Path(ts_entry.path).resolve()
                # stat() follows symlinks on purpose: the row is keyed by the
                # RESOLVED path, so size/mtime must describe that same file or
                # the mtime+size cheap-compare re-indexes it on every scan.
                ts_stat = ts_entry.stat()
                ts_relative_path = TSRelativePosixPath(ts_entry_path, ts_resolved_root)
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
            except (OSError, ValueError) as ts_error:
                # ValueError: TSRelativePosixPath raises it for a symlinked
                # entry whose target resolves outside the root. Skip that single
                # file - letting it escape would abort the entire scan.
                TSLogVerbose("indexer.file.stat_failed", path=str(getattr(ts_entry, 'path', '')), error=str(ts_error))
