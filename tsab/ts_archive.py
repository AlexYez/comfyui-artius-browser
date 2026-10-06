from __future__ import annotations

import os
import re
import secrets
import shutil
import threading
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .ts_logging import TSLogVerbose
from .ts_settings import TS_ARCHIVE_DISK_MARGIN_BYTES, TS_ARCHIVE_MAX_AGE_SECONDS

TS_ARCHIVE_TOKEN_PATTERN = re.compile(r"^[0-9a-f]{32}$")
TS_ARCHIVE_COPY_CHUNK_BYTES = 1024 * 1024
# Central-directory and local-header bytes per entry, generously: two copies
# of the name plus the fixed records and a ZIP64 extra field.
TS_ARCHIVE_ENTRY_OVERHEAD_BYTES = 1024
# Above this a member gets ZIP64 records from the start: zipfile refuses to
# switch midway if a file grows past 4 GiB while it is being copied.
TS_ARCHIVE_FORCE_ZIP64_BYTES = 2 * 1024 * 1024 * 1024


class TSArchiveNoSpaceError(Exception):
    """The drive cannot hold the archive and still keep its safety margin."""


@dataclass(frozen=True)
class TSArchiveEntry:
    ts_path: Path
    ts_filename: str
    ts_size_bytes: int
    ts_created_at: float


def TSBuildArchiveMemberName(ts_filename: str, ts_used: set[str]) -> str:
    """A flat, unique member name for one file.

    Files are packed side by side, without their folders: that is what
    "download these" means. Two renders called ComfyUI_00001_.png from
    different folders must not overwrite each other on extraction, and Windows
    and macOS compare names case-insensitively, so uniqueness is checked on
    the case-folded name.
    """
    ts_name = str(ts_filename or "").replace("\\", "_").replace("/", "_").strip() or "file"
    ts_stem, ts_dot, ts_suffix = ts_name.rpartition(".")
    if not ts_dot or not ts_stem:
        ts_stem, ts_suffix = ts_name, ""
    ts_candidate = ts_name
    ts_counter = 2
    while ts_candidate.casefold() in ts_used:
        ts_candidate = f"{ts_stem} ({ts_counter}).{ts_suffix}" if ts_suffix else f"{ts_stem} ({ts_counter})"
        ts_counter += 1
    ts_used.add(ts_candidate.casefold())
    return ts_candidate


def TSBuildArchiveDownloadName(ts_count: int, ts_now: float) -> str:
    ts_stamp = time.strftime("%Y%m%d-%H%M%S", time.localtime(ts_now))
    return f"artius-browser-{ts_count}-files-{ts_stamp}.zip"


class TSArchiveService:
    """ZIP archives for "Download selected", built on request, served once.

    Members are STORED, not deflated: images, video and audio are compressed
    already, so deflate would burn CPU for a percent or two, and a stored
    archive is written at disk speed. The archive is written to a seekable
    file - a streamed ZIP needs data descriptors, which some unzippers reject
    for stored members - so the browser gets a Content-Length and a real
    progress bar. It lives in its own directory, outside ``cache/``, because
    Rebuild Cache deletes ``cache/`` wholesale and must not pull a half-sent
    archive out from under a download.
    """

    def __init__(
        self,
        ts_directory: Path,
        *,
        ts_clock: Callable[[], float] = time.time,
        ts_free_bytes: Callable[[Path], int] | None = None,
    ) -> None:
        self.ts_directory = Path(ts_directory)
        self.ts_clock = ts_clock
        self.ts_free_bytes = ts_free_bytes or (lambda ts_path: shutil.disk_usage(ts_path).free)
        # One build at a time: two large selections packed in parallel would
        # race each other for the same disk space the check above measured.
        self.ts_build_lock = threading.Lock()
        self.ts_registry_lock = threading.Lock()
        self.ts_registry: dict[str, TSArchiveEntry] = {}

    def TSBuild(self, ts_files: list[tuple[Path, str]]) -> dict | None:
        """Pack ``(path, filename)`` pairs; returns the archive description.

        A file that cannot be opened (moved, deleted, locked by another
        program) is skipped and counted, not fatal. Returns None when not a
        single file could be added.
        """
        with self.ts_build_lock:
            self.ts_directory.mkdir(parents=True, exist_ok=True)
            self._TSSweep()
            ts_expected = 0
            for ts_path, _ts_name in ts_files:
                try:
                    ts_expected += Path(ts_path).stat().st_size + TS_ARCHIVE_ENTRY_OVERHEAD_BYTES
                except OSError:
                    continue
            if ts_expected + TS_ARCHIVE_DISK_MARGIN_BYTES > self.ts_free_bytes(self.ts_directory):
                TSLogVerbose("archive.no_space", expected_bytes=ts_expected)
                raise TSArchiveNoSpaceError()
            ts_token = secrets.token_hex(16)
            ts_partial = self.ts_directory / f"{ts_token}.part.zip"
            ts_target = self.ts_directory / f"{ts_token}.zip"
            try:
                ts_added, ts_skipped = self._TSWrite(ts_partial, ts_files)
            except BaseException:
                # A read error halfway through a member leaves a ZIP that
                # cannot be trusted; nothing of it is kept.
                self._TSUnlink(ts_partial)
                raise
            if ts_added == 0:
                self._TSUnlink(ts_partial)
                return None
            os.replace(ts_partial, ts_target)
            ts_now = self.ts_clock()
            ts_entry = TSArchiveEntry(
                ts_path=ts_target,
                ts_filename=TSBuildArchiveDownloadName(ts_added, ts_now),
                ts_size_bytes=ts_target.stat().st_size,
                ts_created_at=ts_now,
            )
            with self.ts_registry_lock:
                self.ts_registry[ts_token] = ts_entry
        TSLogVerbose("archive.built", count=ts_added, skipped=ts_skipped, size_bytes=ts_entry.ts_size_bytes)
        return {
            "token": ts_token,
            "filename": ts_entry.ts_filename,
            "count": ts_added,
            "skipped": ts_skipped,
            "size_bytes": ts_entry.ts_size_bytes,
        }

    def _TSWrite(self, ts_partial: Path, ts_files: list[tuple[Path, str]]) -> tuple[int, int]:
        ts_added = 0
        ts_skipped = 0
        ts_used_names: set[str] = set()
        # strict_timestamps=False: a file dated before 1980 (a camera with a
        # dead clock battery) is clamped instead of aborting the whole archive.
        with zipfile.ZipFile(ts_partial, "w", compression=zipfile.ZIP_STORED, allowZip64=True, strict_timestamps=False) as ts_zip:
            for ts_path, ts_name in ts_files:
                try:
                    ts_source = open(ts_path, "rb")
                except OSError:
                    ts_skipped += 1
                    continue
                with ts_source:
                    try:
                        ts_info = zipfile.ZipInfo.from_file(ts_path, TSBuildArchiveMemberName(ts_name, ts_used_names), strict_timestamps=False)
                    except OSError:
                        ts_skipped += 1
                        continue
                    ts_info.compress_type = zipfile.ZIP_STORED
                    with ts_zip.open(ts_info, "w", force_zip64=ts_info.file_size > TS_ARCHIVE_FORCE_ZIP64_BYTES) as ts_member:
                        shutil.copyfileobj(ts_source, ts_member, TS_ARCHIVE_COPY_CHUNK_BYTES)
                ts_added += 1
        return ts_added, ts_skipped

    def TSGet(self, ts_token: str) -> TSArchiveEntry | None:
        if not isinstance(ts_token, str) or not TS_ARCHIVE_TOKEN_PATTERN.match(ts_token):
            return None
        with self.ts_registry_lock:
            ts_entry = self.ts_registry.get(ts_token)
        if ts_entry is None or not ts_entry.ts_path.is_file():
            return None
        return ts_entry

    def TSRelease(self, ts_token: str) -> None:
        """Forget and delete an archive once it has been downloaded in full."""
        with self.ts_registry_lock:
            ts_entry = self.ts_registry.pop(ts_token, None)
        if ts_entry is not None and not self._TSUnlink(ts_entry.ts_path):
            # Windows keeps a file that is still open (a second download of
            # the same link); the next sweep takes it as an orphan.
            TSLogVerbose("archive.release.deferred", token=ts_token)

    def _TSSweep(self) -> None:
        # Runs under the build lock, so no .part file of a live build exists.
        ts_now = self.ts_clock()
        with self.ts_registry_lock:
            for ts_token, ts_entry in list(self.ts_registry.items()):
                if ts_now - ts_entry.ts_created_at > TS_ARCHIVE_MAX_AGE_SECONDS:
                    self.ts_registry.pop(ts_token, None)
            ts_live = {ts_entry.ts_path.name for ts_entry in self.ts_registry.values()}
        try:
            ts_candidates = list(self.ts_directory.iterdir())
        except OSError:
            return
        for ts_candidate in ts_candidates:
            # Only names this service writes; anything else in the folder is
            # not ours to delete. Unregistered archives are expired ones or
            # leftovers from before a restart, whose links died with the
            # registry.
            if ts_candidate.suffix != ".zip" or not TS_ARCHIVE_TOKEN_PATTERN.match(ts_candidate.name.split(".", 1)[0]):
                continue
            if ts_candidate.name not in ts_live:
                self._TSUnlink(ts_candidate)

    @staticmethod
    def _TSUnlink(ts_path: Path) -> bool:
        try:
            ts_path.unlink()
            return True
        except FileNotFoundError:
            return True
        except OSError:
            return False
