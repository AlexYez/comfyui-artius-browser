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
            # v15 introduced a single tree_panel_width key; v16 split it per-section
            ts_result.setdefault("ui", {}).setdefault("tree_panel_width", 220)
            ts_result["version"] = 15
        if TSCurrentVersion() < 16:
            ts_ui = ts_result.setdefault("ui", {})
            ts_legacy_width = ts_ui.pop("tree_panel_width", None)
            ts_user_ui = ts_config.get("ui") if isinstance(ts_config, dict) else None
            ts_user_ui = ts_user_ui if isinstance(ts_user_ui, dict) else {}
            ts_seed_width = ts_legacy_width if ts_legacy_width is not None else ts_default["ui"]["asset_tree_panel_width"]
            if "asset_tree_panel_width" not in ts_user_ui:
                ts_ui["asset_tree_panel_width"] = ts_seed_width
            if "workflow_tree_panel_width" not in ts_user_ui:
                ts_ui["workflow_tree_panel_width"] = ts_seed_width
            ts_result["version"] = 16
        if TSCurrentVersion() < 17:
            # v17 raises preview quality defaults (thumbnail_size 104→256,
            # waveform 384×200→768×320). Old configs had these baked in by
            # the v8 migration, so we replace them only if they still hold
            # the v8 defaults — any deliberate user customization is left
            # alone. (image_quality is handled in v18 below.)
            ts_preview = ts_result.setdefault("preview", {})
            _TS_V17_OLD_DEFAULTS = {
                "thumbnail_size": 104,
                "waveform_width": 384,
                "waveform_height": 200,
            }
            for ts_key, ts_old_default in _TS_V17_OLD_DEFAULTS.items():
                if ts_preview.get(ts_key) == ts_old_default:
                    ts_preview[ts_key] = ts_default["preview"][ts_key]
            ts_result["version"] = 17
        if TSCurrentVersion() < 18:
            # v18 corrects the v17 image_quality bump (82) which was too
            # aggressive for a thumbnail cache — encode time rose 4-5×.
            # New default is 60. We rewrite the key only if it currently
            # holds either the v8 default (42) or the v17 overshoot (82);
            # any other value is a deliberate user choice and is preserved.
            ts_preview = ts_result.setdefault("preview", {})
            if ts_preview.get("image_quality") in (42, 82):
                ts_preview["image_quality"] = ts_default["preview"]["image_quality"]
            ts_result["version"] = 18
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
