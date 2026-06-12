from __future__ import annotations

from typing import Any

from .ts_settings import TS_DEFAULT_PREVIEW_SIZE, TS_PREVIEW_SIZE_MAX, TS_PREVIEW_SIZE_MIN

TS_BROWSER_SECTIONS = {"assets", "workflows"}
TS_VIEW_MODES = {"flat", "tree"}
TS_ASSET_SORT_KEYS = {"created_at", "filename", "size_bytes"}
TS_WORKFLOW_SORT_KEYS = {"created_at", "filename"}
TS_SORT_DIRECTIONS = {"asc", "desc"}
TS_ASSET_TYPES = {"image", "video", "audio", "3d"}


def TSNormalizeFolderPath(ts_value: Any) -> str:
    return str(ts_value or "").replace("\\", "/").strip("/")


def TSParseClampedInt(ts_value: Any, ts_minimum: int, ts_maximum: int) -> int | None:
    try:
        return max(ts_minimum, min(ts_maximum, int(ts_value)))
    except (TypeError, ValueError):
        return None


def TSClampInt(ts_value: Any, ts_minimum: int, ts_maximum: int, ts_default: int) -> int:
    ts_clamped_value = TSParseClampedInt(ts_value or ts_default, ts_minimum, ts_maximum)
    return ts_clamped_value if ts_clamped_value is not None else ts_default


def TSParseClampedFloat(ts_value: Any, ts_minimum: float, ts_maximum: float) -> float | None:
    try:
        return max(ts_minimum, min(ts_maximum, float(ts_value)))
    except (TypeError, ValueError):
        return None


def TSClampFloat(ts_value: Any, ts_minimum: float, ts_maximum: float, ts_default: float) -> float:
    ts_clamped_value = TSParseClampedFloat(ts_value if ts_value is not None else ts_default, ts_minimum, ts_maximum)
    return ts_clamped_value if ts_clamped_value is not None else ts_default


def TSNormalizeChoice(ts_value: Any, ts_allowed_values: set[str], ts_default: str) -> str:
    ts_text_value = str(ts_value or ts_default)
    return ts_text_value if ts_text_value in ts_allowed_values else ts_default


def TSNormalizeStringSequence(ts_value: Any) -> list[str]:
    if not isinstance(ts_value, (list, tuple, set)):
        return []
    return [str(ts_item) for ts_item in ts_value if str(ts_item)]


def TSNormalizeUISettings(ts_ui: dict[str, Any] | None) -> dict[str, Any]:
    ts_ui = ts_ui if isinstance(ts_ui, dict) else {}
    return {
        "language": str(ts_ui.get("language") or "en"),
        "autoscan": bool(ts_ui.get("autoscan", True)),
        "browser_section": TSNormalizeChoice(ts_ui.get("browser_section"), TS_BROWSER_SECTIONS, "assets"),
        "asset_view_mode": TSNormalizeChoice(ts_ui.get("asset_view_mode"), TS_VIEW_MODES, "flat"),
        "workflow_view_mode": TSNormalizeChoice(ts_ui.get("workflow_view_mode"), TS_VIEW_MODES, "flat"),
        "asset_sort_key": TSNormalizeChoice(ts_ui.get("asset_sort_key"), TS_ASSET_SORT_KEYS, "created_at"),
        "asset_sort_direction": TSNormalizeChoice(ts_ui.get("asset_sort_direction"), TS_SORT_DIRECTIONS, "desc"),
        "asset_preview_size": TSClampInt(ts_ui.get("asset_preview_size"), TS_PREVIEW_SIZE_MIN, TS_PREVIEW_SIZE_MAX, TS_DEFAULT_PREVIEW_SIZE),
        "asset_search": str(ts_ui.get("asset_search") or ""),
        "workflow_sort_key": TSNormalizeChoice(ts_ui.get("workflow_sort_key"), TS_WORKFLOW_SORT_KEYS, "created_at"),
        "workflow_sort_direction": TSNormalizeChoice(ts_ui.get("workflow_sort_direction"), TS_SORT_DIRECTIONS, "desc"),
        "workflow_preview_size": TSClampInt(ts_ui.get("workflow_preview_size"), TS_PREVIEW_SIZE_MIN, TS_PREVIEW_SIZE_MAX, TS_DEFAULT_PREVIEW_SIZE),
        "workflow_search": str(ts_ui.get("workflow_search") or ""),
        "asset_types": [ts_type for ts_type in TSNormalizeStringSequence(ts_ui.get("asset_types")) if ts_type in TS_ASSET_TYPES],
        "selected_root_id": str(ts_ui.get("selected_root_id") or "all"),
        "selected_folder_path": TSNormalizeFolderPath(ts_ui.get("selected_folder_path")),
        "workflow_selected_folder_path": TSNormalizeFolderPath(ts_ui.get("workflow_selected_folder_path")),
        "expanded_folders": TSNormalizeStringSequence(ts_ui.get("expanded_folders")),
        "browser_width": TSClampInt(ts_ui.get("browser_width"), 0, 1600, 0),
        "asset_tree_panel_width": TSClampInt(ts_ui.get("asset_tree_panel_width"), 120, 700, 220),
        "workflow_tree_panel_width": TSClampInt(ts_ui.get("workflow_tree_panel_width"), 120, 700, 220),
        "toolbar_scale": TSClampFloat(ts_ui.get("toolbar_scale"), 0.6, 1.0, 1.0),
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
        ts_preview_size = TSParseClampedInt(ts_updates.get("asset_preview_size"), TS_PREVIEW_SIZE_MIN, TS_PREVIEW_SIZE_MAX)
        if ts_preview_size is not None:
            ts_ui["asset_preview_size"] = ts_preview_size
    if "asset_search" in ts_updates:
        ts_ui["asset_search"] = str(ts_updates.get("asset_search") or "")
    if "workflow_preview_size" in ts_updates:
        ts_preview_size = TSParseClampedInt(ts_updates.get("workflow_preview_size"), TS_PREVIEW_SIZE_MIN, TS_PREVIEW_SIZE_MAX)
        if ts_preview_size is not None:
            ts_ui["workflow_preview_size"] = ts_preview_size
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
        ts_browser_width = TSParseClampedInt(ts_updates.get("browser_width"), 0, 1600)
        if ts_browser_width is not None:
            ts_ui["browser_width"] = ts_browser_width
    if "asset_tree_panel_width" in ts_updates:
        ts_asset_tree_panel_width = TSParseClampedInt(ts_updates.get("asset_tree_panel_width"), 120, 700)
        if ts_asset_tree_panel_width is not None:
            ts_ui["asset_tree_panel_width"] = ts_asset_tree_panel_width
    if "workflow_tree_panel_width" in ts_updates:
        ts_workflow_tree_panel_width = TSParseClampedInt(ts_updates.get("workflow_tree_panel_width"), 120, 700)
        if ts_workflow_tree_panel_width is not None:
            ts_ui["workflow_tree_panel_width"] = ts_workflow_tree_panel_width
    if "toolbar_scale" in ts_updates:
        ts_toolbar_scale = TSParseClampedFloat(ts_updates.get("toolbar_scale"), 0.6, 1.0)
        if ts_toolbar_scale is not None:
            ts_ui["toolbar_scale"] = ts_toolbar_scale
