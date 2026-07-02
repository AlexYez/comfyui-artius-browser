from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Iterable

import folder_paths

from .ts_settings import TS_LEGACY_STORAGE_DIRECTORY_NAMES, TS_STORAGE_DIRECTORY_NAME
from .ts_logging import TSLogVerbose
from .ts_types import TSRootDefinition
from .ts_utils import TSNormalizePathString


class TSStoragePaths:
    def __init__(self) -> None:
        ts_output_candidate = Path(folder_paths.get_output_directory())
        ts_base_candidate = Path(getattr(folder_paths, "base_path", ts_output_candidate.parent))
        ts_fallback_base = ts_output_candidate.parent if ts_output_candidate.is_absolute() else Path.cwd()

        self.ts_base_directory = self._TSResolveAgainstBase(ts_base_candidate, ts_fallback_base)
        self.ts_output_directory = self._TSResolveAgainstBase(ts_output_candidate, self.ts_base_directory)
        self.ts_input_directory = self._TSResolveAgainstBase(Path(folder_paths.get_input_directory()), self.ts_base_directory)
        self.ts_asset_browser_directory = self.ts_output_directory / TS_STORAGE_DIRECTORY_NAME
        self.ts_ignored_storage_directories = [self.ts_asset_browser_directory]
        for ts_legacy_name in TS_LEGACY_STORAGE_DIRECTORY_NAMES:
            ts_legacy_directory = self.ts_output_directory / ts_legacy_name
            if ts_legacy_directory != self.ts_asset_browser_directory:
                self.ts_ignored_storage_directories.append(ts_legacy_directory)
        self.ts_database_path = self.ts_asset_browser_directory / "db.sqlite"
        self.ts_config_path = self.ts_asset_browser_directory / "config.json"
        self.ts_cache_directory = self.ts_asset_browser_directory / "cache"
        self.ts_thumbnail_directory = self.ts_cache_directory / "thumbnails"
        self.ts_video_frame_directory = self.ts_cache_directory / "video_frames"
        self.ts_waveform_directory = self.ts_cache_directory / "waveforms"
        self.ts_placeholder_directory = self.ts_cache_directory / "placeholders"
        self.TSEnsureDirectories()
        TSLogVerbose(
            "storage.paths.initialized",
            base_directory=str(self.ts_base_directory),
            output_directory=str(self.ts_output_directory),
            input_directory=str(self.ts_input_directory),
            asset_browser_directory=str(self.ts_asset_browser_directory),
        )

    def _TSResolveAgainstBase(self, ts_path_value: str | Path, ts_base_directory: Path) -> Path:
        ts_path = Path(ts_path_value).expanduser()
        if ts_path.is_absolute():
            return ts_path.resolve()
        return (ts_base_directory / ts_path).resolve()

    @staticmethod
    def _TSStableCustomRootId(ts_custom_path: Path) -> str:
        ts_path_key = TSNormalizePathString(ts_custom_path).encode("utf-8")
        return f"custom_{hashlib.blake2b(ts_path_key, digest_size=8).hexdigest()}"

    def TSEnsureDirectories(self) -> None:
        self.ts_asset_browser_directory.mkdir(parents=True, exist_ok=True)
        self.ts_cache_directory.mkdir(parents=True, exist_ok=True)
        self.ts_thumbnail_directory.mkdir(parents=True, exist_ok=True)
        self.ts_video_frame_directory.mkdir(parents=True, exist_ok=True)
        self.ts_waveform_directory.mkdir(parents=True, exist_ok=True)
        self.ts_placeholder_directory.mkdir(parents=True, exist_ok=True)
        TSLogVerbose("storage.directories.ensured", root=str(self.ts_asset_browser_directory))

    def TSResolveCachePath(self, ts_relative_cache_path: str) -> Path:
        ts_candidate = Path(ts_relative_cache_path)
        if ts_candidate.is_absolute():
            ts_resolved = ts_candidate.resolve()
        else:
            ts_resolved = (self.ts_asset_browser_directory / ts_candidate).resolve()
        ts_root = self.ts_asset_browser_directory.resolve()
        try:
            ts_resolved.relative_to(ts_root)
        except ValueError as ts_error:
            TSLogVerbose(
                "storage.cache_path.outside_root",
                cache_root=str(ts_root),
                requested_path=str(ts_relative_cache_path),
                resolved_path=str(ts_resolved),
            )
            raise ValueError(
                f"Cache path '{ts_relative_cache_path}' resolves outside asset browser cache root"
            ) from ts_error
        return ts_resolved

    def TSBuildBaseRoots(self, ts_config: dict) -> list[TSRootDefinition]:
        ts_roots: list[TSRootDefinition] = []
        ts_root_config = ts_config.get("roots", {})

        ts_output_config = ts_root_config.get("output", {})
        if ts_output_config.get("enabled", True):
            ts_roots.append(
                TSRootDefinition(
                    ts_root_id="output",
                    ts_scope="output",
                    ts_path=self.ts_output_directory,
                    ts_allow_delete=bool(ts_output_config.get("allow_delete", True)),
                    ts_enabled=True,
                    ts_label="Output",
                )
            )

        ts_input_config = ts_root_config.get("input", {})
        if ts_input_config.get("enabled", True):
            ts_roots.append(
                TSRootDefinition(
                    ts_root_id="input",
                    ts_scope="input",
                    ts_path=self.ts_input_directory,
                    ts_allow_delete=bool(ts_input_config.get("allow_delete", True)),
                    ts_enabled=True,
                    ts_label="Input",
                )
            )

        ts_custom_roots = ts_config.get("custom_roots", []) if isinstance(ts_config, dict) else []
        if not isinstance(ts_custom_roots, list):
            TSLogVerbose("storage.root.custom.skipped", reason="invalid_custom_roots")
            ts_custom_roots = []
        for ts_custom_root in ts_custom_roots:
            if not isinstance(ts_custom_root, dict):
                TSLogVerbose("storage.root.custom.skipped", reason="invalid_custom_root")
                continue
            if not ts_custom_root.get("enabled", True):
                continue
            ts_custom_raw_path = str(ts_custom_root.get("path", "")).strip()
            if not ts_custom_raw_path:
                TSLogVerbose("storage.root.custom.skipped", reason="empty_path")
                continue
            ts_custom_path = Path(ts_custom_raw_path).expanduser()
            if not ts_custom_path.is_absolute():
                ts_custom_path = self._TSResolveAgainstBase(ts_custom_path, self.ts_base_directory)
            else:
                ts_custom_path = ts_custom_path.resolve()
            if not ts_custom_path.exists():
                TSLogVerbose(
                    "storage.root.custom.skipped",
                    reason="path_missing",
                    path=str(ts_custom_path),
                )
                continue
            ts_root_id = str(ts_custom_root.get("id") or self._TSStableCustomRootId(ts_custom_path))
            ts_roots.append(
                TSRootDefinition(
                    ts_root_id=ts_root_id,
                    ts_scope="custom",
                    ts_path=ts_custom_path,
                    ts_allow_delete=bool(ts_custom_root.get("allow_delete", False)),
                    ts_enabled=True,
                    ts_label=str(ts_custom_root.get("label") or ts_custom_path.name or ts_root_id),
                )
            )

        TSLogVerbose(
            "storage.roots.built",
            roots=[
                {
                    "root_id": ts_root.ts_root_id,
                    "scope": ts_root.ts_scope,
                    "path": str(ts_root.ts_path),
                    "allow_delete": ts_root.ts_allow_delete,
                }
                for ts_root in ts_roots
            ],
        )
        return ts_roots

    def TSIgnorePathsForRoot(self, ts_root: TSRootDefinition) -> Iterable[Path]:
        ts_root_path = ts_root.ts_path.resolve()
        ts_ignored_paths: list[Path] = []
        for ts_ignored_path in self.ts_ignored_storage_directories:
            try:
                ts_ignored_resolved = ts_ignored_path.resolve()
                ts_ignored_resolved.relative_to(ts_root_path)
            except ValueError:
                continue
            ts_ignored_paths.append(ts_ignored_resolved)
        return ts_ignored_paths

