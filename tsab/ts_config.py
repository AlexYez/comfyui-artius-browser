from __future__ import annotations

import copy
import json
from pathlib import Path

from .ts_settings import TS_DEFAULT_CONFIG
from .ts_logging import TSLogVerbose
from .ts_utils import TSJsonDumps


class TSConfigStore:
    def __init__(self, ts_config_path: Path) -> None:
        self.ts_config_path = ts_config_path
        self.ts_cached_config: dict | None = None

    def TSBuildDefaultConfig(self) -> dict:
        return copy.deepcopy(TS_DEFAULT_CONFIG)

    def TSLoadConfig(self) -> dict:
        if self.ts_cached_config is not None:
            return copy.deepcopy(self.ts_cached_config)
        if not self.ts_config_path.exists():
            self.ts_cached_config = self.TSBuildDefaultConfig()
            self.TSSaveConfig(self.ts_cached_config)
            return copy.deepcopy(self.ts_cached_config)
        try:
            ts_loaded = json.loads(self.ts_config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as ts_error:
            TSLogVerbose("config.load.failed", path=str(self.ts_config_path), error=str(ts_error))
            ts_loaded = self.TSBuildDefaultConfig()
            self._TSBackupCorruptConfig()
            self.TSSaveConfig(ts_loaded)
        ts_merged = self.TSMergeDefaults(ts_loaded)
        self.ts_cached_config = ts_merged
        return copy.deepcopy(ts_merged)

    def TSSaveConfig(self, ts_config: dict) -> dict:
        ts_merged = self.TSMergeDefaults(ts_config)
        self._TSWriteConfigAtomically(ts_merged)
        self.ts_cached_config = ts_merged
        return copy.deepcopy(ts_merged)

    def TSReloadConfig(self) -> dict:
        self.ts_cached_config = None
        return self.TSLoadConfig()

    def TSMergeDefaults(self, ts_config: dict) -> dict:
        ts_default = self.TSBuildDefaultConfig()
        ts_overrides = ts_config if isinstance(ts_config, dict) else {}
        ts_result = self._TSDeepMerge(ts_default, ts_overrides)
        self._TSNormalizeTopLevelSections(ts_result, ts_default)

        def TSCurrentVersion() -> int:
            try:
                return int(ts_result.get("version", 0) or 0)
            except (TypeError, ValueError):
                return 0

        if TSCurrentVersion() < 5:
            ts_input_root = ts_result.setdefault("roots", {}).setdefault("input", {})
            ts_input_root["enabled"] = True
            ts_input_root["allow_delete"] = True
            ts_result["version"] = 5
        if TSCurrentVersion() < 6:
            ts_result.setdefault("ui", {}).setdefault("selected_root_id", "all")
            ts_result.setdefault("ui", {}).setdefault("selected_folder_path", "")
            ts_result.setdefault("ui", {}).setdefault("browser_width", 0)
            ts_result["version"] = 6
        if TSCurrentVersion() < 7:
            ts_tools = ts_result.setdefault("tools", {})
            ts_tools.setdefault("ffprobe_workers", ts_default["tools"]["ffprobe_workers"])
            ts_tools.setdefault("ffmpeg_workers", ts_default["tools"]["ffmpeg_workers"])
            ts_result["version"] = 7
        if TSCurrentVersion() < 8:
            ts_tools = ts_result.setdefault("tools", {})
            ts_tools["ffprobe_workers"] = ts_default["tools"]["ffprobe_workers"]
            ts_tools["ffmpeg_workers"] = ts_default["tools"]["ffmpeg_workers"]
            ts_indexing = ts_result.setdefault("indexing", {})
            ts_indexing["batch_size"] = ts_default["indexing"]["batch_size"]
            ts_indexing["hash_workers"] = ts_default["indexing"]["hash_workers"]
            ts_preview = ts_result.setdefault("preview", {})
            ts_preview["thumbnail_size"] = ts_default["preview"]["thumbnail_size"]
            ts_preview["image_format"] = ts_default["preview"]["image_format"]
            ts_preview["image_quality"] = ts_default["preview"]["image_quality"]
            ts_preview["video_frame_time"] = ts_default["preview"]["video_frame_time"]
            ts_preview["waveform_width"] = ts_default["preview"]["waveform_width"]
            ts_preview["waveform_height"] = ts_default["preview"]["waveform_height"]
            ts_preview["placeholder_width"] = ts_default["preview"]["placeholder_width"]
            ts_preview["placeholder_height"] = ts_default["preview"]["placeholder_height"]
            ts_result["version"] = 8
        if TSCurrentVersion() < 9:
            ts_tools = ts_result.setdefault("tools", {})
            ts_tools.pop("exiftool", None)
            ts_tools.pop("use_persistent_exiftool", None)
            ts_tools["ffprobe_workers"] = ts_default["tools"]["ffprobe_workers"]
            ts_tools["ffmpeg_workers"] = ts_default["tools"]["ffmpeg_workers"]
            ts_result["version"] = 9
        if TSCurrentVersion() < 10:
            ts_result.setdefault("ui", {}).setdefault("autoscan", True)
            ts_result["version"] = 10
        if TSCurrentVersion() < 11:
            ts_ui = ts_result.setdefault("ui", {})
            ts_ui.setdefault("asset_view_mode", "flat")
            ts_ui.setdefault("workflow_view_mode", "flat")
            ts_ui.setdefault("asset_sort_key", "created_at")
            ts_ui.setdefault("asset_sort_direction", "desc")
            ts_ui.setdefault("asset_preview_size", 120)
            ts_ui.setdefault("workflow_sort_key", "created_at")
            ts_ui.setdefault("workflow_sort_direction", "desc")
            ts_ui.setdefault("workflow_preview_size", 120)
            ts_ui.setdefault("asset_types", [])
            ts_ui.setdefault("workflow_selected_folder_path", "")
            ts_ui.setdefault("expanded_folders", [])
            for ts_legacy_key in ("view_mode", "sort_key", "sort_direction", "preview_size"):
                ts_ui.pop(ts_legacy_key, None)
            ts_result["version"] = 11
        if TSCurrentVersion() < 12:
            ts_ui = ts_result.setdefault("ui", {})
            ts_ui.setdefault("asset_search", "")
            ts_ui.setdefault("workflow_search", "")
            ts_result["version"] = 12
        if TSCurrentVersion() < 13:
            ts_ui = ts_result.setdefault("ui", {})
            ts_ui.setdefault("browser_section", "assets")
            ts_result["version"] = 13
        if TSCurrentVersion() < 14:
            ts_tools = ts_result.setdefault("tools", {})
            ts_tools["ffprobe_workers"] = ts_default["tools"]["ffprobe_workers"]
            ts_tools["ffmpeg_workers"] = ts_default["tools"]["ffmpeg_workers"]
            ts_result["version"] = 14
        if TSCurrentVersion() < 15:
            ts_result.setdefault("ui", {}).setdefault("tree_panel_width", ts_default["ui"]["tree_panel_width"])
            ts_result["version"] = 15
        self._TSNormalizeTopLevelSections(ts_result, ts_default)
        return ts_result

    def _TSDeepMerge(self, ts_base: dict, ts_override: dict) -> dict:
        ts_result = copy.deepcopy(ts_base)
        for ts_key, ts_value in (ts_override or {}).items():
            if isinstance(ts_value, dict) and isinstance(ts_result.get(ts_key), dict):
                ts_result[ts_key] = self._TSDeepMerge(ts_result[ts_key], ts_value)
            else:
                ts_result[ts_key] = copy.deepcopy(ts_value)
        return ts_result

    def _TSNormalizeTopLevelSections(self, ts_config: dict, ts_default: dict) -> None:
        for ts_key in ("roots", "tools", "indexing", "preview", "ui"):
            if not isinstance(ts_config.get(ts_key), dict):
                ts_config[ts_key] = copy.deepcopy(ts_default[ts_key])
        ts_custom_roots = ts_config.get("custom_roots")
        if not isinstance(ts_custom_roots, list):
            ts_config["custom_roots"] = []
            return
        ts_config["custom_roots"] = [
            copy.deepcopy(ts_custom_root)
            for ts_custom_root in ts_custom_roots
            if isinstance(ts_custom_root, dict)
        ]

    def _TSWriteConfigAtomically(self, ts_config: dict) -> None:
        self.ts_config_path.parent.mkdir(parents=True, exist_ok=True)
        ts_temp_path = self.ts_config_path.with_name(f".{self.ts_config_path.name}.tmp")
        ts_temp_path.write_text(TSJsonDumps(ts_config), encoding="utf-8")
        ts_temp_path.replace(self.ts_config_path)

    def _TSBackupCorruptConfig(self) -> None:
        if not self.ts_config_path.exists():
            return
        ts_backup_path = self.ts_config_path.with_suffix(f"{self.ts_config_path.suffix}.corrupt")
        try:
            self.ts_config_path.replace(ts_backup_path)
            TSLogVerbose("config.corrupt.backed_up", path=str(self.ts_config_path), backup_path=str(ts_backup_path))
        except OSError as ts_error:
            TSLogVerbose("config.corrupt.backup.failed", path=str(self.ts_config_path), error=str(ts_error))
