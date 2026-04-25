from __future__ import annotations

from typing import Any

TS_BROWSER_SECTIONS = {"assets", "workflows"}
TS_VIEW_MODES = {"flat", "tree"}
TS_ASSET_SORT_KEYS = {"created_at", "filename", "size_bytes"}
TS_WORKFLOW_SORT_KEYS = {"created_at", "filename"}
TS_SORT_DIRECTIONS = {"asc", "desc"}
TS_ASSET_TYPES = {"image", "video", "audio", "3d"}


def TSNormalizeFolderPath(ts_value: Any) -> str:
    return str(ts_value or "").replace("\\", "/").strip("/")


def TSClampInt(ts_value: Any, ts_minimum: int, ts_maximum: int, ts_default: int) -> int:
    return max(ts_minimum, min(ts_maximum, int(ts_value or ts_default)))


def TSNormalizeChoice(ts_value: Any, ts_allowed_values: set[str], ts_default: str) -> str:
    ts_text_value = str(ts_value or ts_default)
    return ts_text_value if ts_text_value in ts_allowed_values else ts_default


def TSNormalizeUISettings(ts_ui: dict[str, Any] | None) -> dict[str, Any]:
    ts_ui = ts_ui if isinstance(ts_ui, dict) else {}
    return {
        "language": str(ts_ui.get("language") or "en"),
        "autoscan": bool(ts_ui.get("autoscan", True)),
        "browser_section": TSNormalizeChoice(ts_ui.get("browser_section"), TS_BROWSER_SECTIONS, "assets"),
        "asset_view_mode": str(ts_ui.get("asset_view_mode") or "flat"),
        "workflow_view_mode": str(ts_ui.get("workflow_view_mode") or "flat"),
        "asset_sort_key": str(ts_ui.get("asset_sort_key") or "created_at"),
        "asset_sort_direction": str(ts_ui.get("asset_sort_direction") or "desc"),
        "asset_preview_size": TSClampInt(ts_ui.get("asset_preview_size"), 48, 512, 180),
        "asset_search": str(ts_ui.get("asset_search") or ""),
        "workflow_sort_key": str(ts_ui.get("workflow_sort_key") or "created_at"),
        "workflow_sort_direction": str(ts_ui.get("workflow_sort_direction") or "desc"),
        "workflow_preview_size": TSClampInt(ts_ui.get("workflow_preview_size"), 48, 512, 180),
        "workflow_search": str(ts_ui.get("workflow_search") or ""),
        "asset_types": [
            str(ts_type)
            for ts_type in (ts_ui.get("asset_types") or [])
            if str(ts_type) in TS_ASSET_TYPES
        ],
        "selected_root_id": str(ts_ui.get("selected_root_id") or "all"),
        "selected_folder_path": TSNormalizeFolderPath(ts_ui.get("selected_folder_path")),
        "workflow_selected_folder_path": TSNormalizeFolderPath(ts_ui.get("workflow_selected_folder_path")),
        "expanded_folders": [str(ts_key) for ts_key in (ts_ui.get("expanded_folders") or []) if str(ts_key)],
        "browser_width": TSClampInt(ts_ui.get("browser_width"), 0, 1600, 0),
    }


def TSApplyUISettingsUpdates(ts_ui: dict[str, Any], ts_ui_updates: dict[str, Any] | None) -> None:
    ts_updates = ts_ui_updates if isinstance(ts_ui_updates, dict) else {}
    if "language" in ts_updates:
        ts_ui["language"] = str(ts_updates.get("language") or "en")
    if "autoscan" in ts_updates:
        ts_ui["autoscan"] = bool(ts_updates.get("autoscan", True))
    if "browser_section" in ts_updates:
        ts_ui["browser_section"] = TSNormalizeChoice(ts_updates.get("browser_section"), TS_BROWSER_SECTIONS, "assets")
    if "asset_view_mode" in ts_updates:
        ts_ui["asset_view_mode"] = TSNormalizeChoice(ts_updates.get("asset_view_mode"), TS_VIEW_MODES, "flat")
    if "workflow_view_mode" in ts_updates:
        ts_ui["workflow_view_mode"] = TSNormalizeChoice(ts_updates.get("workflow_view_mode"), TS_VIEW_MODES, "flat")
    if "asset_sort_key" in ts_updates:
        ts_ui["asset_sort_key"] = TSNormalizeChoice(ts_updates.get("asset_sort_key"), TS_ASSET_SORT_KEYS, "created_at")
    if "workflow_sort_key" in ts_updates:
        ts_ui["workflow_sort_key"] = TSNormalizeChoice(ts_updates.get("workflow_sort_key"), TS_WORKFLOW_SORT_KEYS, "created_at")
    if "asset_sort_direction" in ts_updates:
        ts_ui["asset_sort_direction"] = TSNormalizeChoice(ts_updates.get("asset_sort_direction"), TS_SORT_DIRECTIONS, "desc")
    if "workflow_sort_direction" in ts_updates:
        ts_ui["workflow_sort_direction"] = TSNormalizeChoice(ts_updates.get("workflow_sort_direction"), TS_SORT_DIRECTIONS, "desc")
    if "asset_preview_size" in ts_updates:
        try:
            ts_ui["asset_preview_size"] = TSClampInt(ts_updates.get("asset_preview_size"), 48, 512, 180)
        except (TypeError, ValueError):
            pass
    if "asset_search" in ts_updates:
        ts_ui["asset_search"] = str(ts_updates.get("asset_search") or "")
    if "workflow_preview_size" in ts_updates:
        try:
            ts_ui["workflow_preview_size"] = TSClampInt(ts_updates.get("workflow_preview_size"), 48, 512, 180)
        except (TypeError, ValueError):
            pass
    if "workflow_search" in ts_updates:
        ts_ui["workflow_search"] = str(ts_updates.get("workflow_search") or "")
    if "asset_types" in ts_updates:
        ts_asset_types = ts_updates.get("asset_types") or []
        if isinstance(ts_asset_types, (list, tuple, set)):
            ts_ui["asset_types"] = [str(ts_type) for ts_type in ts_asset_types if str(ts_type) in TS_ASSET_TYPES]
    if "selected_root_id" in ts_updates:
        ts_ui["selected_root_id"] = str(ts_updates.get("selected_root_id") or "all")
    if "selected_folder_path" in ts_updates:
        ts_ui["selected_folder_path"] = TSNormalizeFolderPath(ts_updates.get("selected_folder_path"))
    if "workflow_selected_folder_path" in ts_updates:
        ts_ui["workflow_selected_folder_path"] = TSNormalizeFolderPath(ts_updates.get("workflow_selected_folder_path"))
    if "expanded_folders" in ts_updates:
        ts_expanded_folders = ts_updates.get("expanded_folders") or []
        if isinstance(ts_expanded_folders, (list, tuple, set)):
            ts_ui["expanded_folders"] = [str(ts_key) for ts_key in ts_expanded_folders if str(ts_key)]
    if "browser_width" in ts_updates:
        try:
            ts_ui["browser_width"] = TSClampInt(ts_updates.get("browser_width"), 0, 1600, 0)
        except (TypeError, ValueError):
            pass
