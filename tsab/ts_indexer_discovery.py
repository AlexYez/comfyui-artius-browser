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
    "TSBuildAssetStatForRelativePath",
    "TSFilterCompanionEntries",
    "TSIterAssetStats",
    "TSNormalizeCompanionStem",
    "TSScanDirectory",
]

TS_COMPANION_MEDIA_EXTENSIONS = TS_VIDEO_EXTENSIONS | TS_AUDIO_EXTENSIONS | TS_3D_EXTENSIONS
TS_IGNORED_DIRECTORY_NAMES = {TS_STORAGE_DIRECTORY_NAME.lower(), *(ts_name.lower() for ts_name in TS_LEGACY_STORAGE_DIRECTORY_NAMES)}

# AppleDouble sidecars. macOS writes "._<name>" next to every file it copies to
# a volume that cannot hold resource forks and extended attributes (exFAT/FAT32
# sticks, most SMB/NAS shares). "._render.png" has a .png suffix, so without
# this it is indexed as an image, fails to decode, and keeps a placeholder
# forever - one ghost card per real asset.
TS_APPLEDOUBLE_PREFIX = "._"

# macOS packages: directories the Finder presents as single documents. Walking
# into them indexes an application's icons or a Photos library's internal
# masters. Matched by suffix because the names themselves are arbitrary.
TS_IGNORED_DIRECTORY_SUFFIXES = (
    ".app",
    ".photoslibrary",
    ".fcpbundle",
    ".imovielibrary",
    ".tvlibrary",
    ".framework",
)


def TSIsIgnoredDirectory(ts_name: str) -> bool:
    ts_lowered = ts_name.lower()
    return ts_lowered in TS_IGNORED_DIRECTORY_NAMES or ts_lowered.endswith(TS_IGNORED_DIRECTORY_SUFFIXES)


def TSIsIgnoredFileName(ts_name: str) -> bool:
    return ts_name.startswith(TS_APPLEDOUBLE_PREFIX)


def TSBuildAssetStatForRelativePath(ts_root: TSRootDefinition, ts_relative_path: str) -> TSAssetStat | None:
    """Stat ONE file named relative to a root, for the targeted index path.

    The caller is the frontend, naming the files ComfyUI just wrote, so the
    input is untrusted: the path is normalized, rejected outright if it tries
    to leave the root by any spelling, and the RESOLVED result is checked
    against the resolved root again (which is what catches a symlink pointing
    outside). Returns None for anything that is not a readable regular file
    inside the root - never raises, because one bad name must not cost the
    caller the files named beside it.
    """
    ts_normalized = str(ts_relative_path or "").replace("\\", "/").strip()
    if not ts_normalized:
        return None
    ts_segments = [ts_segment for ts_segment in ts_normalized.split("/") if ts_segment]
    if not ts_segments or any(ts_segment in {".", ".."} for ts_segment in ts_segments):
        return None
    if TSIsIgnoredFileName(ts_segments[-1]) or any(TSIsIgnoredDirectory(ts_segment) for ts_segment in ts_segments[:-1]):
        return None
    try:
        ts_resolved_root = Path(ts_root.ts_path).resolve()
        ts_path = (ts_resolved_root / "/".join(ts_segments)).resolve()
        ts_path.relative_to(ts_resolved_root)
        if not ts_path.is_file():
            return None
        ts_stat = ts_path.stat()
        ts_file_relative_path = TSRelativePosixPath(ts_path, ts_resolved_root)
    except (OSError, ValueError) as ts_error:
        TSLogVerbose("indexer.relative_file.rejected", relative_path=ts_normalized, error=str(ts_error))
        return None
    if ts_path.suffix.lower() not in TS_SUPPORTED_EXTENSIONS:
        return None
    return TSAssetStat(
        ts_path=ts_path,
        ts_root=ts_root,
        ts_relative_path=ts_file_relative_path,
        ts_folder_path=TSFolderPosixPath(ts_file_relative_path),
        ts_filename=ts_path.name,
        ts_extension=ts_path.suffix.lower(),
        ts_size_bytes=int(ts_stat.st_size),
        ts_mtime_ns=int(getattr(ts_stat, "st_mtime_ns", int(ts_stat.st_mtime * 1000000000))),
        ts_ctime_ns=int(getattr(ts_stat, "st_ctime_ns", int(ts_stat.st_ctime * 1000000000))),
    )


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
                    if TSIsIgnoredDirectory(ts_entry_path.name):
                        TSLogVerbose("indexer.path.ignored", path=str(ts_entry_path), reason="technical_directory")
                        continue
                    if ts_resolved_path in ts_ignored_paths:
                        TSLogVerbose("indexer.path.ignored", path=str(ts_entry_path))
                        continue
                    ts_subdirectories.append(ts_resolved_path)
                    continue
                if TSIsIgnoredFileName(ts_entry.name):
                    TSLogVerbose("indexer.path.ignored", path=str(ts_entry_path), reason="appledouble_sidecar")
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


def _TSPathSuffix(ts_name: str) -> str:
    # Path(name).suffix without building a Path: a leading dot is a hidden
    # file, not an extension, and a trailing dot is no extension at all.
    ts_dot = ts_name.rfind(".")
    return ts_name[ts_dot:] if 0 < ts_dot < len(ts_name) - 1 else ""


def TSIterAssetStats(
    ts_root: TSRootDefinition,
    ts_ignored_paths: set[Path],
    ts_failed_directories: list[str] | None = None,
) -> Iterable[TSAssetStat]:
    ts_resolved_root = ts_root.ts_path.resolve()
    # The walk starts from the RESOLVED root and TSScanDirectory resolves every
    # subdirectory it descends into, so "<resolved dir>/<entry name>" already
    # is the resolved path of a regular file. Resolving it once more cost a
    # system call per file (on Windows an open handle): 560 ms of a 580 ms
    # walk over 6.9k files. Only a symlinked FILE can still point elsewhere.
    ts_directory_stack = [ts_resolved_root]
    # Relative paths by string slicing, for the same reason: every entry of a
    # walk from the resolved root starts with this prefix, and pathlib's
    # relative_to/suffix/parent were most of what was left of the walk time.
    ts_root_prefix = os.path.join(str(ts_resolved_root), "")
    while ts_directory_stack:
        ts_directory = ts_directory_stack.pop()
        ts_subdirectories, ts_file_entries = TSScanDirectory(ts_directory, ts_ignored_paths, ts_failed_directories)
        ts_directory_stack.extend(ts_subdirectories)
        for ts_entry in ts_file_entries:
            try:
                ts_entry_text = ts_entry.path
                ts_filename = ts_entry.name
                if ts_entry.is_symlink():
                    ts_entry_path = Path(ts_entry_text).resolve()
                    ts_entry_text = str(ts_entry_path)
                    ts_filename = ts_entry_path.name
                else:
                    ts_entry_path = Path(ts_entry_text)
                # stat() follows symlinks on purpose: the row is keyed by the
                # RESOLVED path, so size/mtime must describe that same file or
                # the mtime+size cheap-compare re-indexes it on every scan.
                ts_stat = ts_entry.stat()
                if ts_entry_text.startswith(ts_root_prefix):
                    ts_relative_path = ts_entry_text[len(ts_root_prefix):].replace(os.sep, "/")
                else:
                    # A symlinked file resolved outside the prefix: the
                    # pathlib check raises ValueError when it left the root.
                    ts_relative_path = TSRelativePosixPath(ts_entry_path, ts_resolved_root)
                yield TSAssetStat(
                    ts_path=ts_entry_path,
                    ts_root=ts_root,
                    ts_relative_path=ts_relative_path,
                    ts_folder_path=ts_relative_path.rsplit("/", 1)[0] if "/" in ts_relative_path else "",
                    ts_filename=ts_filename,
                    ts_extension=_TSPathSuffix(ts_filename).lower(),
                    ts_size_bytes=int(ts_stat.st_size),
                    ts_mtime_ns=int(getattr(ts_stat, "st_mtime_ns", int(ts_stat.st_mtime * 1000000000))),
                    ts_ctime_ns=int(getattr(ts_stat, "st_ctime_ns", int(ts_stat.st_ctime * 1000000000))),
                )
            except (OSError, ValueError) as ts_error:
                # ValueError: TSRelativePosixPath raises it for a symlinked
                # entry whose target resolves outside the root. Skip that single
                # file - letting it escape would abort the entire scan.
                TSLogVerbose("indexer.file.stat_failed", path=str(getattr(ts_entry, 'path', '')), error=str(ts_error))
